# 11. Provision CRM-аккаунта: сектор «Маркет» + фикс краша кассы

**Приоритет:** P0 — провижн CRM-аккаунта клиента падает на проде 100%.
**Дата:** 09.09.2026
**Фронт:** `src/api/consultingTenant.js`,
`src/Components/Sectors/Consulting/client/ConsultingClientDetail.jsx`.
**Связано:** [04-tenant-lifecycle.md](./04-tenant-lifecycle.md) §10.3,
[scenario-tenant.md](./scenario-tenant.md), [10-backend-issues.md](./10-backend-issues.md) P3-7.

---

## 1. Симптом

`POST /consalting/clients/{id}/provision-tenant/` → `provision_status: "failed"`:

```
provision_error:
null value in column "is_active" of relation "construction_cashbox"
violates not-null constraint
DETAIL: Failing row contains
(3e71f7c6-…, Основная касса компании, 8020a53b-…, null, f,
 2026-09-09 11:22:51.71+00, 2026-09-09 11:22:51.71+00, null, null, null, null).
```

`provision_tenant_account` обёрнут в `@transaction.atomic`, поэтому компания
откатывается целиком: в ответе `nur_company_id: null`, `provisioned_at: null`.
Никаких «полукомпаний» в БД не остаётся — чинить нужно только код, данные
чистить не требуется.

## 2. Две независимые задачи

| # | Что | Тип |
|---|---|---|
| **A** | `create_company_with_owner` создаёт дефолтную кассу без `is_active` → `IntegrityError` | баг, P0 |
| **B** | Сектор новой компании должен быть **«Маркет»**, а не «Стройка» / «первый попавшийся» | требование продукта |

---

## 3. Задача A — краш `construction_cashbox.is_active`

### 3.1. Корень

Консалтинг переиспользует модель кассы из `construction` (см.
[10-backend-issues.md](./10-backend-issues.md) P3-7). При создании компании
(`create_company_with_owner`) заводится «Основная касса компании». Вставка
делается **без поля `is_active`**, а колонка `construction_cashbox.is_active`
объявлена `NOT NULL` и **без database default** (миграция добавила `NOT NULL`,
но `default=True` есть только на уровне Python-модели ИЛИ отсутствует вовсе —
проверить). Поэтому `INSERT` с пропущенным полем → `null` → отказ.

Разбор failing row (порядок колонок `construction_cashbox`):

```
id            = 3e71f7c6-…
name          = "Основная касса компании"
company_id    = 8020a53b-…      (только что созданная компания)
department_id = null
<bool>        = f               (например is_main / is_default = false)
created_at    = 2026-09-09 11:22:51
updated_at    = 2026-09-09 11:22:51
is_active     = null            ← нарушение NOT NULL
…             = null,null,null
```

### 3.2. Фикс (сделать все три пункта)

1. **Явно передавать `is_active=True`** во всех местах, где создаётся дефолтная
   касса при провижне/регистрации компании:

   ```python
   Cashbox.objects.create(
       company=company,
       name="Основная касса компании",
       is_active=True,
       # + любые прочие NOT NULL поля этой модели
   )
   ```

2. **Database default + backfill** — миграция в приложении `construction`:

   ```python
   migrations.AlterField(
       model_name="cashbox",
       name="is_active",
       field=models.BooleanField(default=True),
   )
   # data migration: Cashbox.objects.filter(is_active__isnull=True).update(is_active=True)
   ```

   (`AlterField` с `default=True` в Django ставит `DEFAULT true` на колонку и
   не оставляет `NULL` в новых строках; отдельно закрыть исторические `NULL`.)

3. **Проверить остальные NOT NULL поля** `construction_cashbox` (`department_id`,
   булев флаг со значением `f`, хвостовые `null`-колонки) — у каждого должен быть
   либо DB default, либо явная передача при создании дефолтной кассы. Failing row
   показывает 3 хвостовых `null` — если хоть одно из них `NOT NULL`, следующая
   попытка упадёт на нём.

### 3.3. Сделать создание кассы устойчивым

`create_company_with_owner` (или хук провижна) — обернуть создание дефолтной
кассы так, чтобы:

- оно было **идемпотентным** (`get_or_create` по `company` + `name`);
- при ошибке создания кассы падал **весь** провижн (уже так — `@transaction.atomic`),
  но `provision_error` содержал понятный текст, а не голый `IntegrityError`
  (`except IntegrityError as e: raise ValidationError({"detail": "Не удалось создать
  кассу компании: …"})`).

---

## 4. Задача B — сектор «Маркет» по умолчанию

### 4.1. Как сейчас

```python
# 04-tenant-lifecycle.md §10.3
company, user, password = create_company_with_owner(
    …,
    sector_id=tariff.crm_sector_id,   # ← у тарифа не заполнено → None
    …
)
```

При `tariff.crm_sector_id = None` бэк подставляет сектор «Стройка» (или первый
по списку). Нужен детерминированный дефолт — **«Маркет»**.

### 4.2. Требуемое поведение

Резолв сектора для провижна — строго по приоритету:

```text
1. body.crm_sector          (явный override из запроса, см. §4.4)   — если валиден
2. tariff.crm_sector_id                                              — если задан
3. settings.CONSULTING_DEFAULT_CRM_SECTOR_ID  (= id сектора «Маркет»)
4. Sector.objects.get(slug="market")  /  name ILIKE 'маркет'
5. если не разрешилось — provision FAILED c понятным текстом,
   НЕ подставлять «первый сектор» молча
```

Добавить настройку:

```python
# settings.py
CONSULTING_DEFAULT_CRM_SECTOR_ID = env.int("CONSULTING_DEFAULT_CRM_SECTOR_ID", default=None)
# значение = id сектора «Маркет» из /users/industries/ (sectors[].id)
```

Хелпер:

```python
def resolve_provision_sector_id(*, override=None, tariff=None):
    if override and Sector.objects.filter(id=override).exists():
        return override
    if tariff and tariff.crm_sector_id:
        return tariff.crm_sector_id
    if settings.CONSULTING_DEFAULT_CRM_SECTOR_ID:
        return settings.CONSULTING_DEFAULT_CRM_SECTOR_ID
    market = Sector.objects.filter(slug="market").first() \
          or Sector.objects.filter(name__iexact="маркет").first() \
          or Sector.objects.filter(name__iexact="market").first()
    if market:
        return market.id
    raise ValidationError({"detail":
        "Не задан сектор CRM-аккаунта. Заполните tariff.crm_sector_id или "
        "CONSULTING_DEFAULT_CRM_SECTOR_ID."})
```

`create_company_with_owner` вызывать с `sector_id=resolve_provision_sector_id(...)`.

### 4.3. Каталог секторов = как в регистрации

Сектор берётся из того же справочника, что и обычная регистрация компании:
`GET /users/industries/` → `[{ id, name, sectors: [{ id, name, slug }] }]`.
`sector_id` = `sectors[].id`. Убедиться, что у сектора «Маркет» есть стабильный
`slug` (`market`) — фронт и настройка опираются на него.

### 4.4. Override в запросе (для ручных случаев)

`POST /consalting/clients/{id}/provision-tenant/`

```jsonc
{ "crm_sector": 3 }   // необязательное; id сектора из /users/industries/
```

- Валидировать, что сектор существует; иначе `400
  {"detail": "Неизвестный сектор."}`.
- Игнорировать, если у клиента уже есть `nur_company_id` (идемпотентность
  провижна не меняется).
- Дефолт при отсутствии поля — §4.2.

`GET /consalting/clients/{id}/tenant-account/` — в ответ добавить фактический
сектор (уже есть поле `sector` в контракте, [04 §10.5](./04-tenant-lifecycle.md#L129)):
при `failed` возвращать тот, что **будет** использован (резолв по §4.2), чтобы
фронт показал его в подсказке.

---

## 5. Порядок side-effects при провижне (свести воедино)

`provision_tenant_account` (внутри одной транзакции):

```text
1. Идемпотентность: client.nur_company_id есть → status=created, return
2. email = lead.email or client.email; нет → FAILED "укажите email"
3. sector_id = resolve_provision_sector_id(override, tariff)         (§4.2)
4. plan_id  = tariff.crm_subscription_plan_id (или дефолт, если ввели)
5. create_company_with_owner(email, …, sector_id, subscription_plan_id,
       end_date = today + (tariff.initial_access_days or 30)):
     5.1 Company + owner User
     5.2 Cashbox.get_or_create(company, name="Основная касса компании",
             defaults={is_active=True, …все NOT NULL поля})          (§3.2)
     5.3 прочие дефолты сектора (склад/категории) — если есть, тоже с NOT NULL
   except EmailAlreadyExists → FAILED "Email уже зарегистрирован…"
   except IntegrityError e  → FAILED f"Не удалось инициализировать компанию: {e}"
6. client.nur_company = company; status=created; provisioned_at=now; error=""
7. notify_tenant_credentials(client, user, password)
8. audit_log("tenant.provision", …)
```

---

## 6. Чек-лист приёмки

### Задача A

- [ ] `POST /consalting/clients/{id}/provision-tenant/` для тарифа без
      `crm_sector_id` → `201`/`200`, `provision_status="created"`,
      `nur_company_id` заполнен.
- [ ] В `construction_cashbox` у новой компании ровно одна строка
      «Основная касса компании» с `is_active=true`.
- [ ] Повторный вызов провижна не создаёт вторую кассу (`get_or_create`).
- [ ] Миграция проставила `is_active=true` всем историческим строкам с `NULL`.
- [ ] Колонка `construction_cashbox.is_active` имеет `DEFAULT true` в БД
      (`\d construction_cashbox`).
- [ ] Ни одно другое `NOT NULL` поле кассы не роняет `INSERT` дефолтной кассы.
- [ ] `provision_error` при сбое инициализации компании — человекочитаемый,
      без голого `IntegrityError`/SQL.

### Задача B

- [ ] Тариф без `crm_sector_id` + `CONSULTING_DEFAULT_CRM_SECTOR_ID` не задан
      → сектор компании = «Маркет» (по `slug="market"`).
- [ ] `CONSULTING_DEFAULT_CRM_SECTOR_ID` задан → используется он.
- [ ] `tariff.crm_sector_id` задан → приоритет у тарифа (override не передан).
- [ ] `POST provision-tenant { "crm_sector": <id market> }` → компания в
      секторе «Маркет» даже если тариф указывает другой.
- [ ] `crm_sector` с несуществующим id → `400 {"detail":"Неизвестный сектор."}`.
- [ ] Нельзя молча получить «первый сектор»: неразрешённый сектор → `FAILED`
      с понятным текстом.
- [ ] `GET tenant-account` возвращает `sector` = фактический/планируемый.
- [ ] У сектора «Маркет» в `/users/industries/` есть `slug="market"`.

### Сквозной сценарий

- [ ] Лид → создать клиента (email заполнен) → оплата по лиду с тарифом
      `provisions_crm_account=True` → подтверждение в кассе → провижн создаёт
      компанию **в секторе Маркет**, касса `is_active=true`, клиенту уходят
      логин/пароль, `end_date = today + initial_access_days`.
- [ ] Абонентский платёж этого клиента после подтверждения продлевает
      `company.end_date` (`extend_tenant_subscription`).

---

## 7. Что делает фронт (уже готово)

- `provisionClientTenant(clientId, { crm_sector })` — шлёт override.
- Карточка клиента, блок «CRM-аккаунт NurCRM»: при `failed`/`none`/`pending`
  показывает выбор сектора (по умолчанию «Маркет») и кнопку
  «Создать / повторить аккаунт».
- Список секторов — `GET /users/industries/` (flatten `sectors[]`).

Бэку остаётся закрыть §3–§5. После этого поле выбора на фронте можно оставить
как «страховку» или скрыть за дефолтом «Маркет».
