# 23. Автоопределение существующего NurCRM-аккаунта по email клиента

**Приоритет:** P1 — сейчас провижн для клиента с уже существующим email
**молча упирается в ручной шаг** («Привяжите вручную в platform-admin»),
хотя вся информация для автоматической привязки уже есть.
**Дата:** 12.09.2026
**Бэкенд:** `apps/consalting/services/tenant_lifecycle.py`
(`provision_tenant_account`), новый эндпоинт `GET
/consalting/tenant-accounts/lookup/`, новый эндпоинт `POST
/consalting/clients/{id}/link-tenant/`.
**Фронт (реализовано):** `src/api/consultingTenant.js`
(`lookupTenantAccountByEmail`, `linkClientTenant`),
`src/Components/Sectors/Consulting/client/ConsultingClientDetail.jsx`.
**Связано:** [04-tenant-lifecycle.md §10.3](./04-tenant-lifecycle.md#103-provision_tenant_account),
[11-provision-market-sector.md](./11-provision-market-sector.md),
[08-lead-client-conversion.md](./08-lead-client-conversion.md) (дедуп
`Client`, но там дедуп **внутри** consulting; здесь — дедуп с NurCRM-аккаунтом
**вне** consulting, это разные сущности, см. §1).

---

## 1. Постановка задачи и что это НЕ дедуп `Client`

Формулировка от продукта: «Автоматически определять аккаунт клиента, если у
него был аккаунт до добавления нашего консалтинга; если создали нового
клиента для консалтинга с почтой уже существующего — его сразу должно
определять».

Важно не перепутать с уже описанным в [08](./08-lead-client-conversion.md)
дедупом — там речь о модели `Client` **внутри** консалтинга (карточка
клиента консалтинга, чтобы не плодить дубли лидов одного и того же человека).
Здесь — другая сущность: **NurCRM tenant-аккаунт** (`Company` + `User`,
которым клиент реально логинится в свою CRM после того, как консалтинг
поставил ему аккаунт, см. [04](./04-tenant-lifecycle.md)).

Сценарий, который сейчас не покрыт:

1. Некий Х. ранее сам зарегистрировался в NurCRM напрямую (не через
   консалтинг) под email `x@example.kg` — у него уже есть `Company` + `User`.
2. Позже кто-то из консалтинга заводит Х. как клиента консалтинга (`Client`,
   не тот же самый объект, что `Company`/`User`) с тем же email — например,
   он пришёл как лид на услуги консалтинга, а не как прямая регистрация.
3. Продают ему тариф с `provisions_crm_account=True`, оплата подтверждена в
   кассе → `provision_tenant_account` пытается `create_company_with_owner`.
4. Django/бэк ловит `EmailAlreadyExists` (email уже занят существующим
   `User`) → `provision_status = FAILED`, `provision_error = "Email уже
   зарегистрирован. Привяжите вручную в platform-admin."` ([04 §10.3](./04-tenant-lifecycle.md#103-provision_tenant_account)).
5. Дальше — тупик для сотрудника консалтинга: он не платформенный админ,
   идёт звать кого-то с доступом в platform-admin, чтобы вручную найти
   компанию Х. по email и проставить `client.nur_company` руками.

Задача — убрать этот ручной шаг: **найти** существующий аккаунт **до** или
**вместо** попытки его создать, и дать сотруднику консалтинга (owner/admin,
без platform-admin) привязать одним кликом.

---

## 2. Новые эндпоинты

### 2.1. `GET /consalting/tenant-accounts/lookup/?email=...`

Ищет существующий NurCRM `User`/`Company` по email — **независимо** от того,
привязан ли он уже к какому-то `Client` консалтинга или нет. Используется
фронтом проактивно (до попытки провижна), как только у клиента известен
email.

```jsonc
// 200, есть совпадение
{
  "match": {
    "nur_company_id": 42,
    "company_name": "ОсОО Ромашка",
    "owner_email": "x@example.kg",
    "sector": { "id": 3, "name": "Маркет" },
    "end_date": "2026-04-01"
  }
}

// 200, совпадений нет
{ "match": null }
```

**Права:** owner/admin/rop компании-консалтинга (та же матрица, что у
`provision-tenant`, [04 §10.5](./04-tenant-lifecycle.md#105-эндпоинты)).
Эндпоинт **read-only**, ничего не создаёт и не меняет — безопасно дёргать
при каждом открытии карточки клиента.

**Важно про приватность**: возвращать только минимальный набор полей
(`company_name`, `sector`, `end_date`) — **не** возвращать пароль/токены/
список сотрудников чужой компании. `owner_email` можно отдавать, так как
это тот же email, который сотрудник консалтинга уже ввёл для поиска (не
раскрытие новой информации).

### 2.2. `POST /consalting/clients/{id}/link-tenant/`

Привязывает `client.nur_company` к **уже существующей** компании, минуя
`create_company_with_owner` (не создаёт нового `User`/`Company`, не меняет
пароль владельца).

```jsonc
// Request
{ "nur_company_id": 42 }
```

```jsonc
// 200 — тот же формат ответа, что у provision-tenant/tenant-account
{
  "provision_status": "created",
  "provision_status_display": "Аккаунт создан",
  "provision_error": null,
  "provisioned_at": "2026-09-12T10:00:00+06:00",
  "nur_company_id": 42,
  "company_name": "ОсОО Ромашка",
  "owner_email": "x@example.kg",
  "end_date": "2026-04-01",
  "subscription_plan": { "id": 1, "name": "Старт" },
  "sector": { "id": 3, "name": "Маркет" }
}
```

Ошибки:

| Ситуация | Ответ |
|---|---|
| `nur_company_id` не существует | `400 {"detail": "Компания не найдена."}` |
| у клиента УЖЕ есть свой `nur_company_id` (другой) | `409 {"detail": "У клиента уже есть привязанный аккаунт. Сначала отвяжите текущий."}` |
| не owner/admin/rop | `403` |
| эта компания уже привязана к **другому** `Client` этого же консалтинга | `409 {"detail": "Этот аккаунт уже привязан к другому клиенту консалтинга."}` — **важно**: один NurCRM-аккаунт не должен приклеиваться к двум разным карточкам `Client` одновременно, иначе сломается `extend_tenant_subscription` (непонятно, чья абонентка продлевает чей `company.end_date`) |

**Реализация** (переиспользует то, что уже есть в `provision_tenant_account`,
просто без ветки создания):

```python
@transaction.atomic
def link_existing_tenant(*, client, nur_company_id, actor):
    if client.nur_company_id:
        raise ValidationError({"detail": "У клиента уже есть привязанный аккаунт."})

    company = Company.objects.filter(id=nur_company_id).first()
    if not company:
        raise ValidationError({"detail": "Компания не найдена."})

    if Client.objects.filter(nur_company=company).exclude(id=client.id).exists():
        raise ValidationError({"detail": "Этот аккаунт уже привязан к другому клиенту консалтинга."})

    client.nur_company = company
    client.provision_status = ProvisionStatus.CREATED
    client.provisioned_at = timezone.now()
    client.provision_error = ""
    client.save()

    audit_log("tenant.link_existing", actor=actor, client=client, company=company)
    return serialize_tenant_account(client)
```

---

## 3. Изменение `provision_tenant_account` (см. [04 §10.3](./04-tenant-lifecycle.md#103-provision_tenant_account))

Текущее поведение при коллизии email — тупиковое (`FAILED` с текстом про
platform-admin). Меняем на структурированный ответ, чтобы фронт **не**
парсил текст ошибки эвристикой:

```python
except EmailAlreadyExists:
    existing_company = Company.objects.filter(owner__email__iexact=email).first()
    client.provision_status = ProvisionStatus.FAILED
    client.provision_error = (
        "У этого email уже есть аккаунт NurCRM. Привяжите его вместо создания нового."
    )
    client.save(update_fields=["provision_status", "provision_error"])
    raise ValidationError({
        "detail": client.provision_error,
        "existing_company": {
            "nur_company_id": existing_company.id,
            "company_name": existing_company.name,
            "owner_email": email,
            "sector": {"id": existing_company.sector_id, "name": existing_company.sector.name}
                if existing_company.sector_id else None,
            "end_date": existing_company.end_date,
        } if existing_company else None,
    })
```

Это **запасной путь** на случай, если сотрудник всё же нажал «Создать
аккаунт» до того, как проактивный `lookup` успел отработать (или lookup
недоступен) — фронт (`ConsultingClientDetail.jsx` → `retryProvision`) уже
ловит `existing_company` в теле ошибки и рисует ту же кнопку «Привязать»,
что и от `lookup`.

---

## 4. Что уже сделано на фронте

`ConsultingClientDetail.jsx`:

1. Как только у клиента известен email и у него ещё нет своего
   `nur_company_id` — **автоматически**, без клика, дёргает
   `GET /tenant-accounts/lookup/?email=…`.
2. Если найден матч — показывает жёлтую плашку прямо в блоке «CRM-аккаунт
   NurCRM»: *«У этого email уже есть аккаунт NurCRM — <компания> (сектор
   «…»), доступ до … Новый создавать не нужно — привяжите этот»* + кнопка
   «Привязать существующий аккаунт».
3. Кнопка → `POST /clients/{id}/link-tenant/` → обновляет карточку, больше
   не показывает форму «Создать / повторить аккаунт» для этого клиента.
4. Если `lookup` ещё не существует на бэке (404/501) — тихо молчит, обычная
   кнопка «Создать / повторить аккаунт» остаётся рабочим фолбэком как
   сейчас; если бэк вернёт `existing_company` в ошибке `provision-tenant` —
   тот же UI подхватывается оттуда (см. §3).

---

## 5. Чек-лист приёмки

- [ ] `GET /tenant-accounts/lookup/?email=x@example.kg` для email с
      существующим NurCRM-аккаунтом (созданным **не** через консалтинг) →
      `{"match": {...}}`.
- [ ] Для email без аккаунта → `{"match": null}`, не `404`.
- [ ] `POST /clients/{id}/link-tenant/ {nur_company_id}` привязывает клиента
      без создания нового `User`/`Company`/кассы — пароль владельца не
      меняется, письмо с новыми данными **не** отправляется (в отличие от
      `provision_tenant_account`, где `notify_tenant_credentials` шлёт
      логин/пароль — это НЕ нужно при привязке существующего).
- [ ] Повторная привязка того же клиента к тому же `nur_company_id` —
      идемпотентна (`client.nur_company_id` уже стоит → просто возвращает
      текущее состояние, не падает).
- [ ] Привязка компании, уже привязанной к **другому** `Client` → `409`.
- [ ] `provision_tenant_account` при коллизии email возвращает
      `existing_company` в теле `400`-ошибки (не только текст).
- [ ] `extend_tenant_subscription` для клиента, привязанного через
      `link-tenant` (а не `provision-tenant`), работает так же, как для
      обычного провижна — `company.end_date` продлевается по оплате
      абонентки консалтинга.
- [ ] Права: `lookup` и `link-tenant` — только owner/admin/rop консалтинга,
      как и `provision-tenant`.

---

## 6. Сознательно не в этой итерации

- **Проверка совпадения по телефону**, только по email — как и в
  `provision_tenant_account` сейчас (`email = lead.email or client.email`,
  телефон там вообще не участвует в резолве аккаунта). Расширять дедуп на
  телефон — отдельная задача, если понадобится.
- **Автоматическая привязка без подтверждения пользователем** — сознательно
  оставили один клик («Привязать»), а не молча слили аккаунты: слишком
  чувствительная операция (это не сама CRM-запись, а вход в чужой,
  потенциально с этого момента платящий, tenant), ошибочная привязка
  требует ручного отката через platform-admin.
- **Отвязка (`unlink`)** для случая `409` («уже есть привязанный аккаунт») —
  не реализована ни на фронте, ни в этом контракте; если понадобится
  исправлять ошибочную привязку — через platform-admin, как и раньше.
