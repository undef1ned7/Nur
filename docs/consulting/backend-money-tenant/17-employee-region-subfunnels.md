# 17. Воронки сотрудников как подворонки региональной воронки

**ТЗ:** обычный сотрудник может завести собственную воронку продаж; такая
воронка автоматически «подшивается» к региональной воронке его региона.
Руководитель, открыв вкладку региона (например «Ош»), видит рядом свои
подворонки и подворонки всех сотрудников этого региона.

**Страница:** `/crm/consulting/funnel`
**Фронт:**
`src/Components/Sectors/Consulting/Funnel/Funnel.jsx` (`FunnelForm`, ряд вкладок,
второй ряд «подворонок»),
`src/utils/consultingFunnelTree.js` (сборка дерева `roots → children`),
`src/utils/consultingFunnelAccess.js` (`canCreateConsultingFunnel`,
`filterFunnelsForUser`),
`src/utils/consultingFunnelDefaults.js` (`getFunnelParentId`, `isEmployeeFunnel`,
`getFunnelOwnerUserId`),
`src/store/creators/funnelThunk.js` (`createFunnel`/`updateFunnel` → `POST/PATCH
/consalting/funnels/`),
`src/Components/DepartmentDetails/AccessList.jsx` (право `can_create_funnel`).

Смежное: [06-regional-funnels-routing.md](./06-regional-funnels-routing.md),
[12-regional-supervisor-rbac.md](./12-regional-supervisor-rbac.md),
[07-seller-access-isolation.md](./07-seller-access-isolation.md),
[../backend/03-funnel-hierarchy.md](../backend/03-funnel-hierarchy.md) (цепочка
`next_funnel` — это другое поле, не путать с `parent_funnel`).

---

## 17.1. Задача

Сейчас:

- Кнопка «+ Воронка» и `POST /consalting/funnels/` доступны только
  `owner/admin/rop`.
- У воронки нет понятия «родитель». Региональные воронки (Бишкек, Ош,
  Джалал‑Абад) и ролевые/основная лежат в одном плоском списке вкладок.
- Сотрудник не может организовать свой процесс отдельной воронкой, а
  руководитель — увидеть воронки сотрудников, сгруппированные по региону.

Нужно:

1. Новое право сотрудника **`can_create_funnel`**.
2. Новое поле воронки **`parent_funnel`** (self‑FK) + вид **`funnel_kind =
   "employee"`** и владелец **`owner_user`**.
3. При создании воронки **обычным сотрудником** сервер:
   - ставит `parent_funnel` = региональная воронка региона сотрудника;
   - наследует `region_code` от родителя;
   - ставит `owner_user = <сотрудник>`, `funnel_kind = "employee"`;
   - создаёт 3 системные стадии (как в
     [06 §6.5a](./06-regional-funnels-routing.md));
   - выдаёт автору `FunnelGrant` (view + manage_leads + manage_stages), чтобы
     он сразу видел и вёл свою воронку.
4. `filterFunnelsForUser` (бэкенд‑скоуп `GET /consalting/funnels/`) должен
   отдавать сотруднику его собственные подворонки, а руководителю/владельцу —
   все подворонки его регионов.
5. Доски подворонок независимы; счётчики региона на фронте агрегируются из
   дочерних досок (бэкенд менять не нужно, но см. §17.6 про `board/`).

---

## 17.2. Изменения модели

```python
class Funnel(models.Model):
    class FunnelKind(models.TextChoices):
        MAIN = "main", "Основная"
        ROLE = "role", "Ролевая"
        REGION = "region", "Региональная"
        CUSTOM = "custom", "Пользовательская"
        EMPLOYEE = "employee", "Воронка сотрудника"

    # --- НОВЫЕ ПОЛЯ ---
    parent_funnel = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="child_funnels",
    )
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="owned_funnels",
    )
    funnel_kind = models.CharField(
        max_length=16, choices=FunnelKind.choices, default=FunnelKind.CUSTOM,
    )
    # region_code уже есть у региональных воронок (см. RegionalFunnelRule).
```

```python
class EmployeePermissions(models.Model):   # там же, где can_view_funnel и т.д.
    can_create_funnel = models.BooleanField(default=False)
```

**Инварианты модели:**

- `parent_funnel` не может ссылаться сам на себя; глубина дерева — максимум 1
  (родитель не может иметь своего родителя). Попытка вложить подворонку в
  подворонку → `400 {"parent_funnel": "Нельзя вложить воронку в подворонку."}`.
- `parent_funnel` допустим только для `funnel_kind in {custom, employee}`.
  Для `main`/`role` — игнорировать/`400`.
- Родителем может быть только воронка с `region_code` (региональная).
  Иначе → `400 {"parent_funnel": "Родитель должен быть региональной воронкой."}`.
- При заданном `parent_funnel` поле `region_code` **наследуется** от родителя
  (сервер перезаписывает то, что прислал клиент).
- `is_main = True` несовместимо с `parent_funnel` → `400`.

---

## 17.3. Право `can_create_funnel`

- Хранится в тех же правах сотрудника, что `can_view_funnel`,
  `can_manage_funnel_leads` (эндпоинт `PATCH /consalting/employees/{id}/`,
  сериализатор карточки сотрудника, ответ `GET /users/profile/`).
- Отдаётся во всех местах, где сейчас отдаются булевы `can_*` (профиль,
  список сотрудников, карточка).
- Кастомная роль тоже может нести `can_create_funnel` (если права наследуются
  от роли — учитывать при вычислении эффективного значения).

Матрица доступа к `POST /consalting/funnels/`:

| Роль | Может создать | Тип создаваемой воронки |
|---|---|---|
| `owner` / `admin` / `rop` | да | любой; `parent_funnel` выбирается вручную |
| `supervisor` | да, только в свой регион | `employee`/`custom`, `parent_funnel` — региональная воронка его региона |
| сотрудник c `can_create_funnel=true` | да | `employee`, `parent_funnel` = воронка его региона (сервер сам) |
| сотрудник без права | **403** | — |

---

## 17.4. `POST /consalting/funnels/` — поведение

### 17.4.1. Запрос (обычный сотрудник)

```jsonc
// сотрудник parent_funnel НЕ присылает — сервер его вычисляет
{
  "name": "Тёплые лиды — доп. обзвон",
  "description": "",
  "is_active": true
}
```

### 17.4.2. Запрос (руководитель)

```jsonc
{
  "name": "Ош — партнёрская программа",
  "description": "",
  "is_active": true,
  "parent_funnel": "уuid-региональной-воронки-ош"   // или null → верхний уровень
}
```

### 17.4.3. Алгоритм сервера

```text
1. permission_check:
     manager                       → OK
     supervisor                    → OK, но parent обязателен и в его регионе
     employee & can_create_funnel  → OK
     else                          → 403
2. resolve_parent:
     IF manager/supervisor AND body.parent_funnel:
         parent = Funnel(id=body.parent_funnel), проверить region/тип/скоуп
     ELIF employee OR supervisor:
         region_code = first(user.consulting_region_codes)
         parent = RegionalFunnelRule.funnel WHERE region_code == region_code
                  (fallback: Funnel WHERE region_code == region_code, funnel_kind=region)
         IF parent is None:
             # регион не настроен — не роняем запрос
             parent = None            # воронка станет верхнеуровневой
             warn -> ответ содержит "parent_funnel": null, "detail_hint": "регион не сопоставлен"
     ELSE (manager без parent):
         parent = None
3. kind:
     employee/supervisor           → "employee"
     manager без parent            → "custom"
     manager c parent              → "custom" (или "employee" — на усмотрение, UI не различает)
4. create Funnel(
       company=user.company, name, description, is_active,
       parent_funnel=parent,
       region_code=(parent.region_code if parent else None),
       owner_user=(user if kind == "employee" else None),
       funnel_kind=kind,
   )
5. create 3 системные стадии (intake / in_progress / completed) — см. 06 §6.5a
6. IF owner_user:
       FunnelGrant.objects.create(
           employee=user, funnel=funnel,
           can_manage_leads=True, can_manage_stages=True,
       )
7. broadcast: funnel.created (в комнату компании + автору)
8. 201 → сериализованная воронка (см. §17.5)
```

### 17.4.4. Валидация

| Ситуация | Ответ |
|---|---|
| нет `name` | `400 {"name": ["Обязательное поле."]}` |
| сотрудник без `can_create_funnel` | `403 {"detail": "Нет права на создание воронок."}` |
| supervisor указал parent не своего региона | `403 {"detail": "Регион вне вашей зоны."}` |
| `parent_funnel` не существует / не в компании | `400 {"parent_funnel": ["Не найдено."]}` |
| `parent_funnel` — не региональная | `400 {"parent_funnel": ["Родитель должен быть региональной воронкой."]}` |
| `parent_funnel` сам является подворонкой | `400 {"parent_funnel": ["Нельзя вложить воронку в подворонку."]}` |
| `is_main=true` + `parent_funnel` | `400 {"is_main": ["Главная воронка не может быть подворонкой."]}` |
| у компании нет лимита воронок в тарифе | `402/403` с понятным `detail` (если лимиты есть) |

---

## 17.5. Сериализация воронки

К текущему ответу воронки добавить:

```jsonc
{
  "id": "uuid",
  "name": "Тёплые лиды — доп. обзвон",
  "funnel_kind": "employee",
  "region_code": "osh",
  "parent_funnel": "uuid-osh",           // id родителя или null
  "parent_funnel_name": "Ош",            // для подписи, опционально
  "owner_user": "uuid-user",             // id создателя или null
  "owner_user_name": "Айбек Осмонов",    // ФИО создателя, опционально
  "is_main": false,
  "is_active": true,
  "leads_count": 0,
  "created_at": "2026-09-10T12:00:00Z"
  // ...остальные поля как сейчас (next_funnel, is_final, stage_sla_hours, ...)
}
```

Фронт устойчив к разным именам (`parent_funnel` | `parent_funnel_id` | `parent`;
`owner_user` | `owner_user_id` | `created_by`), но канон — как выше.

`GET /consalting/funnels/` возвращает **плоский список** (и родителей, и
подворонки) — дерево строит фронт по `parent_funnel`. Порядок не важен.

---

## 17.6. Скоуп `GET /consalting/funnels/` и досок

| Кто | Видит |
|---|---|
| `owner/admin/rop` | все воронки компании, включая все подворонки |
| `supervisor` | региональные воронки своих регионов + **их подворонки** (любых сотрудников этих регионов) + явные `FunnelGrant` |
| сотрудник (изоляция по owner) | ролевая воронка + главная (если не изолирован) + `FunnelGrant` + **свои подворонки** (`owner_user == me`) |

Правило для подворонок: подворонка наследует видимость родителя для
руководителя/супервайзера; для сотрудника видима, если он владелец или у него
есть grant. Совпадает с фронтовым `filterFunnelsForUser`
(`getFunnelOwnerUserId(f) === me` → allow).

`GET /consalting/funnels/{id}/board/` для подворонки — как для обычной воронки
(колонки = её стадии, лиды = лиды этой воронки). Родительская вкладка на фронте
показывает **свою** доску; агрегированный счётчик по детям фронт считает сам из
`boardsMap`. Отдельного «сводного» board не требуется.

---

## 17.7. `PATCH /consalting/funnels/{id}/`

- Смена `parent_funnel`:
  - `owner/admin/rop` — можно переносить подворонку между регионами
    (при переносе `region_code` пересчитывается от нового родителя; лиды
    внутри не трогаются, но у них меняется эффективный регион — залогировать).
  - `supervisor` — только в пределах своих регионов.
  - автор‑сотрудник — **нельзя** менять `parent_funnel` (только `name`,
    `description`, `is_active`, стадии). Присланное поле игнорировать.
- `owner_user` неизменяем через API (ставится только при создании).
- Удаление (`DELETE`) подворонки: `owner/admin/rop`, а также автор‑сотрудник
  для **своей** воронки, если в ней нет незакрытых лидов (иначе `409` с
  требованием сперва перенести/закрыть лиды). Системную/основную/ролевую —
  как сейчас, нельзя.

---

## 17.8. Реалтайм

- `funnel.created` / `funnel.updated` / `funnel.deleted` — в комнату компании
  (руководитель видит появление подворонки без перезагрузки) и персонально
  автору.
- Payload содержит `parent_funnel`, `owner_user`, `funnel_kind`, `region_code`
  — фронт вставит вкладку в нужный регион.

---

## 17.9. Миграция

1. Добавить поля `parent_funnel`, `owner_user`, `funnel_kind`,
   `can_create_funnel` (default `false`).
2. Проставить `funnel_kind` существующим воронкам:
   `main` → is_main; `role` → custom_role задан; `region` → region_code задан и
   не подворонка; остальные → `custom`.
3. `parent_funnel` у всех существующих — `null` (плоская структура сохраняется).
4. Никаких данных не теряем: фронт при `parent_funnel == null` показывает
   воронку как верхнеуровневую вкладку (текущее поведение).

---

## 17.10. Чек-лист приёмки

### Право и создание
- [ ] Сотрудник без `can_create_funnel` не видит кнопку «+ Воронка», `POST
      /funnels/` → `403`.
- [ ] Выдача `can_create_funnel` в модалке «Доступы» сохраняется и приходит в
      `GET /users/profile/`.
- [ ] Сотрудник из Оша создаёт воронку → `parent_funnel` = воронка «Ош»,
      `region_code = "osh"`, `funnel_kind = "employee"`, `owner_user` = он сам.
- [ ] Новая подворонка сразу имеет 3 системные стадии.
- [ ] Автор сразу видит свою воронку на доске и может добавлять стадии/лиды
      (есть `FunnelGrant`).

### Отображение у руководителя
- [ ] Владелец открывает вкладку «Ош» → под ней ряд подворонок: «Регион
      целиком» + по одной на каждого сотрудника с его ФИО.
- [ ] Счётчик на вкладке «Ош» показывает свои лиды + бейдж `+N` с числом
      подворонок; тултип — суммарные лиды детей.
- [ ] Переключение на подворонку показывает её доску; «Регион целиком»
      возвращает доску региональной воронки.
- [ ] Региональный фильтр (dropdown) «Ош» оставляет и «Ош», и её подворонки
      (наследуемый `region_code`).

### Скоуп и изоляция
- [ ] Сотрудник Оша не видит подворонок Бишкека.
- [ ] Supervisor Оша видит подворонки всех сотрудников Оша.
- [ ] Продавец не видит чужие подворонки своего региона (только свои + grants).

### Правки и удаление
- [ ] Автор‑сотрудник не может сменить `parent_funnel` своей воронки.
- [ ] Владелец переносит подворонку Ош → Бишкек, `region_code` пересчитан.
- [ ] Удаление подворонки с открытыми лидами → `409`.
- [ ] `main` / ролевую / региональную воронку в подворонку превратить нельзя.

### Регресс
- [ ] Компании без региональных воронок: сотрудник с правом создаёт
      верхнеуровневую воронку (`parent_funnel = null`), всё работает как раньше.
- [ ] Существующие воронки после миграции: `parent_funnel = null`, вкладки
      как прежде.
