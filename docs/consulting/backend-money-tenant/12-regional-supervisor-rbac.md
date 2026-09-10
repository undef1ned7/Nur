# 12. Региональные руководители, изоляция по региону, равномерное деление лидов

**Приоритет:** P1 — новая ролевая модель для консалтинга.
**Дата:** 09.09.2026
**Фронт:** `src/utils/consultingFunnelAccess.js`,
`src/Components/Sidebar/config/sectors/consultingMenu.js`,
`src/Components/Sectors/Consulting/{Funnel,leads,sale,Teachers}/…`,
`src/api/{employees,consultingLeads}.js`.
**Связано:** [06-regional-funnels-routing.md](./06-regional-funnels-routing.md),
[07-seller-access-isolation.md](./07-seller-access-isolation.md),
[../regional-funnels-distribution.md](../regional-funnels-distribution.md),
[../../roles-and-employees.md](../../roles-and-employees.md).

---

## 1. Постановка

| Роль | Что видит | Что может |
|---|---|---|
| **`owner` / `admin` / `rop`** | Все воронки, все лиды, все регионы, настройки | Всё (как сейчас, `isConsultingFunnelManager`) |
| **`supervisor`** (руководитель региона) — **НОВАЯ** | Только лиды и воронки **своих регионов**; внутри региона — **все** лиды любого владельца | Создавать сотрудников своего региона, назначать им лиды своего региона, вести доску региона. **Нет** доступа к глобальным настройкам, чужим регионам |
| **`salesperson`** (сотрудник) | Только **свои** лиды (`owner=self`) внутри воронки своего региона | Работать со своими лидами; назначать не может |

Ключевые требования из ТЗ:

1. У `supervisor` может быть **один или несколько** регионов (пример: один
   руководитель — только «Ош», другой — «Бишкек»).
2. Сотрудников заводит **сам руководитель**, они автоматически привязаны к его
   региону и получают роль `salesperson`.
3. Руководитель распределяет лиды **своего** региона между **своими**
   сотрудниками.
4. Сотрудник видит только свои лиды.
5. Общий поток лидов делится по регионам **поровну** («100 лидов → ~33/33/34»).

---

## 2. Модель данных

### 2.1. Регион как справочник

Регион уже частично описан в `RegionalFunnelRule`
([06 §6.2](./06-regional-funnels-routing.md)). Довести до полноценного
справочника (одна запись на `region_code` в компании):

```python
class RegionalFunnelRule(models.Model):
    routing         = FK(RegionalFunnelRouting, related_name="rules")
    funnel          = FK("Funnel", on_delete=CASCADE)   # региональная воронка
    region_code     = CharField(max_length=32)          # bishkek | osh | jalal_abad | <custom>
    label           = CharField(max_length=64, blank=True)   # НОВОЕ: «Ош»
    phone_prefixes  = JSONField(default=list)
    wazzup_account_ids = JSONField(default=list)
    source_channels = JSONField(default=list)
    assign_role_ids = JSONField(default=list)
    assign_strategy = CharField(max_length=16, default="round_robin")
    is_active       = BooleanField(default=True)         # НОВОЕ

    class Meta:
        unique_together = ("routing", "region_code")     # НОВОЕ
```

### 2.2. Привязка пользователя к регионам

```python
# users app
class User(AbstractUser):
    # role: добавить choice "supervisor"
    consulting_region_codes = ArrayField(
        models.CharField(max_length=32), default=list, blank=True
    )
    # supervisor: >= 1 код; salesperson: ровно 1 (наследует от создателя);
    # owner/admin/rop: пусто = «все регионы».
```

- `salesperson`, созданный руководителем, получает
  `consulting_region_codes = [<регион создателя>]` (если у руководителя
  несколько — обязателен выбор одного в форме).
- Смена региона сотрудника — только `owner/admin` или его руководитель.

### 2.3. Денормализация региона в лид

Чтобы фильтрация была по одному индексу, а не join через воронку → правило:

```python
class Lead(models.Model):
    region_code = CharField(max_length=32, blank=True, db_index=True)

class InboundLead(models.Model):
    region_code = CharField(max_length=32, blank=True, db_index=True)
```

`region_code` проставляется при создании лида (webhook / ручное / redistribute)
из правила выбранной воронки; при `transfer` в воронку другого региона —
обновляется.

---

## 3. Резолв региона входящего лида

Дополняет алгоритм [06 §6.3](./06-regional-funnels-routing.md):

```text
1. region = resolve_region(phone_prefix, wazzup_account_id, source)
      longest phone_prefix wins → wazzup_account → source_channel
2. IF region is None:               # регион не определён
      region = pick_region_balanced(company)     # см. §4
3. funnel = rule(region).funnel
4. stage  = first stage of funnel
5. Lead.create(funnel=funnel, stage=stage, region_code=region, owner=null)
   InboundLead.region_code = region
6. assign_owner_within_region(lead, rule)   # RR по assign_role_ids региона
7. WS: lead.created (+ lead.assigned если распределилось)
```

Повторное сообщение того же чата **не меняет** `region_code` / `funnel`.

---

## 4. Равномерное деление лидов по регионам

### 4.1. «Живое» деление (по мере поступления)

`pick_region_balanced(company)` — для лидов без определённого региона:

```python
def pick_region_balanced(company):
    regions = list(active_region_codes(company))          # порядок стабильный
    if not regions:
        return None
    # least-loaded: регион с наименьшим числом ОТКРЫТЫХ лидов
    load = open_leads_count_by_region(company, regions)   # {code: int}
    return min(regions, key=lambda c: (load[c], regions.index(c)))
```

- Метрика нагрузки — **открытые** лиды (`status not in (converted, rejected)`),
  а не все за всё время.
- Тай-брейк — по порядку регионов (детерминированность).
- Альтернатива least-loaded — строгий round-robin по `routing._rr_cursor`
  (уже есть поле). Выбор стратегии — `routing.balance_strategy`
  (`least_loaded` | `round_robin`, дефолт `least_loaded`).

### 4.2. Разовое выравнивание существующей базы

Кнопка «Разделить лиды по регионам» (owner/admin):

```
POST /consalting/regional-funnel-routing/redistribute/
{
  "scope": "main_unassigned",   // main_unassigned | all_open | inbound_new
  "regions": ["bishkek","osh","jalal_abad"],   // необязательно, по умолчанию все активные
  "dry_run": true
}
```

Алгоритм:

```python
targets = leads_for_scope(scope)          # queryset открытых лидов
ids = list(targets.values_list("id", flat=True))
n, k = len(ids), len(regions)
base, rem = divmod(n, k)
# регионы, отсортированные по текущей нагрузке ASC — им идёт +1
order = sorted(regions, key=lambda c: open_leads_count(c))
plan = {c: base + (1 if i < rem else 0) for i, c in enumerate(order)}

if dry_run:
    return {"planned": plan, "total": n}

# распределяем последовательно; owner оставляем null — назначит руководитель
i = 0
for code, cnt in plan.items():
    rule = rule_for(code)
    for lead in targets[i:i+cnt]:
        move_lead(lead, funnel=rule.funnel, stage=first_stage(rule.funnel),
                  region_code=code, owner=None, transition="redistribute")
    i += cnt
audit_log("regional.redistribute", actor=user, plan=plan, scope=scope)
return {"planned": plan, "moved": n}
```

Ответ:

```jsonc
{ "planned": { "bishkek": 34, "osh": 33, "jalal_abad": 33 }, "moved": 100 }
```

**Инварианты:**

- Делить нацело: `sum(planned.values()) == total`, разброс ≤ 1.
- Не трогать `converted` / `rejected` и лиды, уже назначенные владельцу
  (если `scope != all_open`).
- Идемпотентно по духу: повторный запуск на уже разложенной базе с
  `scope=main_unassigned` вернёт `moved: 0`.
- Одна транзакция или чанки по 500 с `select_for_update`.

---

## 5. Матрица доступа (обязательно на сервере)

`region ∈ me` = `lead.region_code in request.user.consulting_region_codes`.
Для `owner/admin/rop` условие всегда истинно (регионов нет = все).

| Эндпоинт | `owner/admin/rop` | `supervisor` | `salesperson` |
|---|---|---|---|
| `GET /funnels/` | все | воронки своих регионов + Внедрение (если grant) | воронка своего региона |
| `GET /funnels/{id}/board/` | все карточки | все карточки, если `funnel.region ∈ me`, иначе `403` | только `owner=self` в воронке своего региона |
| `GET /consalting/inbound-leads/` | все | `region_code ∈ me` (параметр `region` игнорируется вне своих) | `403` (или `owner=self`, если выдан `can_view_leads_inbox`) |
| `GET /consalting/inbound-leads/counters/`, `/analytics/` | все | срез по своим регионам | свой срез |
| `POST /inbound-leads/{id}/assign/` | любой сотрудник | только `region(lead) ∈ me` **и** получатель — сотрудник этого региона; иначе `403` | `403` |
| `POST /leads/{id}/assign/`, `/claim/`, `/transfer/` | без ограничений | в пределах своих регионов; `transfer` в чужой регион — `403` | `claim` только своих региона; `assign` — `403` |
| `GET /consalting/sales/` | все | `?region ∈ me` (или лиды своих регионов) | `?user=self` |
| `GET /consalting/employees/` | все | `consulting_region_codes ∩ me ≠ ∅` | `403` / только сам |
| `POST /users/employees/create/` | любой | см. §6 (форс роль + регион, запрет эскалации прав) | `403` |
| `PATCH /users/employees/{id}/` | любой | только сотрудников своих регионов; нельзя поднять права | `403` |
| `GET/PUT /consalting/regional-funnel-routing/`, `/lead-distribution/`, Wazzup | полный | **read-only** `GET`, `PUT` → `403` | `403` |
| `POST …/redistribute/` | да | `403` (или только по своему региону — не в этой итерации) | `403` |

Фронт дублирует это для UX, но **источник правды — сервер**.

---

## 6. Создание сотрудников руководителем

`POST /users/employees/create/` от `supervisor`:

**Сервер принудительно (clamp), игнорируя присланное:**

- `role = "salesperson"` (руководитель не может создать `admin` / `rop` /
  другого `supervisor`);
- `consulting_region_codes = [X]`, где `X ∈ creator.consulting_region_codes`;
  если у создателя один регион — берётся он; если несколько — поле `region_code`
  в запросе **обязательно** и должно быть из его набора, иначе `400`;
- все `can_view_all_*`, `can_view_leads_inbox`, `can_*_settings`,
  `can_view_analytics` (компанийная) → `false`;
- `funnel_grants` — только на воронку своего региона;
- компания и `created_by` — от создателя.

**Ответ:** созданный сотрудник + сгенерированный пароль (как обычный
employee-create).

`GET /users/employees/` для `supervisor` — только сотрудники, у которых
`consulting_region_codes` пересекается с его набором (+ он сам).

---

## 7. Изменения API (сводка)

### 7.1. Профиль (`GET /users/profile/` и в employee-list)

```jsonc
{
  "role": "supervisor",
  "consulting_region_codes": ["osh"],        // [] для owner/admin/rop
  "consulting_regions": [                      // денорм для UI, необязательно
    { "code": "osh", "label": "Ош", "funnel_id": "uuid" }
  ]
}
```

### 7.2. Регионы

```
GET /consalting/regions/        → [{ code, label, funnel_id, is_active,
                                     open_leads, employees_count }]
```

### 7.3. Списки лидов — фильтр по региону

`GET /consalting/inbound-leads/?region=osh` и
`GET /consalting/leads/?region=osh` — для `owner/admin/rop`; для `supervisor`
разрешён только из своих, иначе игнор/`403`.

Элемент лида — добавить `region_code`, `region_label`.

### 7.4. Redistribute

`POST /consalting/regional-funnel-routing/redistribute/` — см. §4.2.

### 7.5. Employee create/update

`region_code` (create, если у руководителя >1 региона) и
`consulting_region_codes` (update, только owner/admin).

**Назначение самой роли `supervisor`** (owner/admin) — через тот же
`POST /users/employees/create/` и `PUT /users/employees/{id}/`:

```jsonc
// создание руководителя или смена роли существующего сотрудника
{ "role": "supervisor", "custom_role": null,
  "consulting_region_codes": ["osh", "bishkek"] }   // >= 1 код обязателен
```

- `consulting_region_codes` для `role="supervisor"` — обязателен и непустой,
  иначе `400`.
- Смена роли supervisor → любую другую: сервер очищает
  `consulting_region_codes` (фронт присылает `[]`).
- `GET /users/employees/` и `GET /users/profile/` — возвращают
  `consulting_region_codes` (или `consulting_regions: [{code,label}]`) у каждого
  сотрудника, чтобы список «Сотрудники» показывал регионы руководителя.

---

## 8. Что делает фронт

> **Статус: реализовано.** Всё ниже уже в коде и работает, как только бэк
> отдаёт `role:"supervisor"` + `consulting_region_codes` в профиле и поднимает
> `GET /consalting/regions/` (+ `redistribute`). До этого региональные элементы
> просто не показываются, остальной UI без изменений.
>
> Файлы: `utils/consultingFunnelAccess.js` (+ `.test.js`),
> `api/consultingRegions.js`, `common/useConsultingRegions.js`,
> `common/RegionFilter.jsx`, `Sidebar/hooks/useMenuPermissions.js`,
> `leads/{Leads,LeadsInbox,LeadsDistribution}.jsx`,
> `leads/modals/AssignLeadModal.jsx`, `Funnel/Funnel.jsx`, `Teachers/Teachers.jsx`.

### 8.1. `consultingFunnelAccess.js`

```js
isConsultingRegionalSupervisor(profile)   // role === "supervisor"
getUserRegionCodes(profile)               // profile.consulting_region_codes || []
canAccessConsultingLeadInbox(profile)     // + true для supervisor (регион-скоуп)
canViewConsultingFunnel(profile)          // + true для supervisor
shouldIsolateConsultingByOwner(profile)   // supervisor → false (видит весь регион)
canAccessConsultingLeadSettings(profile)  // supervisor → false
canManageConsultingEmployees(profile)     // + true для supervisor (регион-скоуп)
filterFunnelsForUser(funnels, profile)    // supervisor → f.region_code ∈ me
```

### 8.2. Меню (`consultingMenu.js`)

| Пункт | `supervisor` |
|---|---|
| Лиды | ✓ (регион) |
| Воронка | ✓ (регион) |
| Чаты | ✓ (регион) |
| Продажи | ✓ (регион) |
| Аналитика | ✓ (регион) |
| Сотрудники | ✓ (регион) |
| Распределение / Настройки / Wazzup | ✗ |

### 8.3. Экраны

- **Лиды / Воронка / Аналитика:** чип выбора региона — активен для
  `owner/admin/rop` (список из `/consalting/regions/`), зафиксирован и скрыт
  для `supervisor` (или переключатель между его регионами, если их несколько).
- **Воронка:** переключатель «Мои / Все / Пул» — для `supervisor` доступны
  «Все (регион)» и «Пул (регион)», по умолчанию «Все».
- **Сотрудники (создаёт руководитель):** кнопка «+ Сотрудник» видна
  `supervisor`; в форме поле «Регион» предзаполнено и заблокировано (или выбор
  из своих), роль — зафиксирована «Продавец», расширенные права скрыты.
- **Сотрудники (owner/admin назначает роль `supervisor`):** в выпадашке роли —
  пункт «Руководитель региона» (виден, если в компании есть регионы). При его
  выборе появляется мультивыбор регионов (чекбоксы из `/consalting/regions/`),
  ≥ 1 обязателен. Доступно и в «Новый сотрудник», и в «Изменить сотрудника».
  На карточке в списке у руководителя показываются его регионы.
  Файл: `Teachers/Teachers.jsx` (`RegionChecklist`, `roleOptions` +
  `sys:supervisor`, `submitEmployeeCreate` / `submitEmployeeEdit` шлют
  `role:"supervisor"` + `consulting_region_codes`).
- **Назначение лида** (`AssignLeadModal`, `FunnelEmployeesPicker`): список
  получателей — только сотрудники региона лида.
- **Настройки → «Разделить лиды по регионам»:** кнопка у `owner/admin`, вызывает
  `redistribute` c `dry_run: true`, показывает план (`34 / 33 / 33`), затем
  повторный вызов без `dry_run`.

---

## 9. Миграция и раскатка

1. Добавить `role="supervisor"`, `consulting_region_codes`, `Lead.region_code`,
   `InboundLead.region_code`, поля `RegionalFunnelRule.label/is_active`.
2. Бэкфилл `region_code` у существующих лидов: по `funnel` → `rule.region_code`;
   у оставшихся (на `is_main`) — по телефонному префиксу, иначе `""`.
3. `rop` и текущие `salesperson` — поведение не меняется, пока не заданы регионы.
4. Назначить регионы существующим руководителям вручную (owner в UI сотрудников).
5. Прогнать `redistribute` c `scope=main_unassigned` для «зависших» на главной.

---

## 10. Чек-лист приёмки

### Роль supervisor

- [ ] `supervisor` с `["osh"]` видит в `/funnels/` только воронку Ош
      (+ Внедрение по grant), не видит Бишкек.
- [ ] `GET /funnels/{bishkek_id}/board/` от supervisor Ош → `403`.
- [ ] `GET /inbound-leads/` от supervisor Ош → только `region_code="osh"`;
      `?region=bishkek` не расширяет выдачу.
- [ ] Внутри своего региона supervisor видит лиды **всех** владельцев.
- [ ] `PUT /regional-funnel-routing/` от supervisor → `403`; `GET` → `200`.

### Сотрудники

- [ ] owner/admin в «Сотрудники» назначает роль «Руководитель региона» +
      ≥ 1 регион → `PUT /users/employees/{id}/ { role:"supervisor",
      consulting_region_codes:[…] }`; пустой список регионов → `400`.
- [ ] Смена роли supervisor → продавец очищает `consulting_region_codes`.
- [ ] supervisor создаёт сотрудника → `role=salesperson`,
      `consulting_region_codes=["osh"]`, все `can_view_all_*=false`.
- [ ] Присланные в запросе `role=admin` / чужой регион / `can_view_all_sales`
      игнорируются или дают `400`.
- [ ] supervisor с двумя регионами без `region_code` в запросе → `400`.
- [ ] `GET /employees/` от supervisor → только сотрудники его регионов.
- [ ] salesperson видит только свои лиды (`owner=self`) в воронке своего региона.
- [ ] supervisor назначает лид Ош только сотруднику Ош; попытка назначить
      сотруднику Бишкека → `403`.

### Равномерное деление

- [ ] `redistribute {scope:"main_unassigned", dry_run:true}` при 100 лидах и
      3 регионах → `planned` = `{34,33,33}`, сумма 100, разброс ≤ 1.
- [ ] Без `dry_run` — лиды реально перемещены в воронки регионов, `owner=null`,
      `region_code` проставлен.
- [ ] Повторный запуск → `moved: 0`.
- [ ] `converted` / `rejected` не тронуты.
- [ ] Живой inbound без региона идёт в наименее загруженный регион
      (или строгий RR при `balance_strategy=round_robin`).
- [ ] Два одновременных inbound без региона не попадают оба в один регион
      из-за гонки (`select_for_update` на курсоре/счётчике).

### Регрессия

- [ ] `owner` / `admin` / `rop` видят всё, как раньше.
- [ ] Компании без региональных правил (`routing.enabled=false`) работают по
      старому 1A (main funnel), новые поля не влияют.
