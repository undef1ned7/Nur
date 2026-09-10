# Консалтинг — жизненный цикл CRM-аккаунта клиента (tenant)

**Сфера:** Консалтинг (только компания NUR).  
**Страницы:** `/crm/consulting/funnel`, `/crm/consulting/client/:id`, `/platform-admin`.  
**Фронт:** `ConsultingClientDetail.jsx`, `LeadPaymentModal.jsx`, `Funnel.jsx`, `src/api/consultingTenant.js`.  
**Статус:** спека бэка — [scenario-tenant.md](./scenario-tenant.md),
[04-tenant-lifecycle.md](./04-tenant-lifecycle.md). Фронт готов (`VITE_CONSULTING_CASH_V2`).

---

## 1. Задача

Консалтинг — **внутренний** канал продаж NurCRM. После оплаты установки клиент
получает **tenant-аккаунт** (`users.Company` + owner `User`). Каждая
подтверждённая **абонентская плата** продлевает `Company.end_date`.

Без этого менеджеры вручную создают аккаунты через регистрацию или platform-admin.

---

## 2. Триггеры

| Событие | Когда | Действие |
|---------|-------|----------|
| **Provision** | `CashRequest(kind=sale)` → `confirmed` | Создать Company + User, связать с `Client` |
| **Extend** | `CashRequest(kind=subscription)` → `confirmed` | Продлить `Company.end_date` на период |

Side-effects **не** выполняются при оформлении продажи — только после confirm кассы
(см. [backend-money-tenant/03-cash-confirmation.md](../backend-money-tenant/03-cash-confirmation.md)).

Исключение: `CashConfirmationSettings.mode=off` — confirm выполняется сразу при
создании заявки.

---

## 3. Модель данных

### 3.1. Client (consalting)

```python
class ProvisionStatus(models.TextChoices):
    NONE = "none", "Не требуется"
    PENDING = "pending", "Ожидает оплаты"
    CREATED = "created", "Аккаунт создан"
    FAILED = "failed", "Ошибка создания"

# apps/consalting/models.py — Client
nur_company = models.ForeignKey(
    "users.Company", null=True, blank=True,
    on_delete=models.SET_NULL, related_name="consalting_clients",
)
provision_status = models.CharField(
    max_length=16, choices=ProvisionStatus.choices, default=ProvisionStatus.NONE,
)
provision_error = models.TextField(blank=True)
provisioned_at = models.DateTimeField(null=True, blank=True)
```

### 3.2. Tariff

```python
crm_sector_id = models.PositiveIntegerField(null=True, blank=True)
crm_subscription_plan_id = models.PositiveIntegerField(null=True, blank=True)
provisions_crm_account = models.BooleanField(default=False)
initial_access_days = models.PositiveIntegerField(default=30)  # первый период доступа
```

### 3.3. TenantSubscriptionExtension

```python
class TenantSubscriptionExtension(models.Model):
    company = models.ForeignKey("users.Company", on_delete=models.CASCADE)
    consalting_client = models.ForeignKey("Client", on_delete=models.CASCADE)
    subscription_payment = models.ForeignKey(
        "SubscriptionPayment", null=True, on_delete=models.SET_NULL,
    )
    old_end_date = models.DateField(null=True)
    new_end_date = models.DateField()
    period = models.CharField(max_length=8)  # month | year
    extended_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
```

---

## 4. Бизнес-правила (зафиксированные)

| Вопрос | Решение |
|--------|---------|
| Начальный `end_date` | `today + initial_access_days` из тарифа (по умолчанию 30) |
| Email занят | `provision_status=failed`, `provision_error` с текстом; ручной retry или link в platform-admin |
| Продление при активной подписке | `end_date + 1 month/year` |
| Продление при просрочке | `today + 1 period` |
| Рассрочка | Provision после confirm **предоплаты** (первая CashRequest sale) |
| Отмена продажи до provision | `provision_status=pending` → `none` |
| Отмена после provision | Company **не удаляется**; `end_date` не откатывается автоматически (ручная блокировка в platform-admin) |

---

## 5. Сервисы (backend)

```python
# apps/consalting/services/tenant_lifecycle.py

@transaction.atomic
def provision_tenant_account(*, client, sale, lead, tariff, actor) -> ProvisionResult:
    """Идемпотентно. Вызывается из confirm_cash_request при kind=sale."""
    ...

@transaction.atomic
def extend_tenant_subscription(*, client, subscription_payment, actor) -> ExtensionResult:
    """Вызывается из confirm_cash_request при kind=subscription."""
    ...

def resolve_new_end_date(company, period: Literal["month", "year"]) -> date:
    ...
```

`provision_tenant_account` переиспользует внутреннюю функцию регистрации из
`users` (аналог `POST /users/auth/register/`), **не** публичный HTTP.

---

## 6. API

### 6.1. Карточка клиента

```
GET /consalting/clients/{id}/tenant-account/
```

**Response 200:**

```json
{
  "provision_status": "created",
  "provision_status_display": "Аккаунт создан",
  "provision_error": null,
  "provisioned_at": "2026-03-02T11:00:00+06:00",
  "nur_company_id": 42,
  "company_name": "ОсОО Ромашка",
  "owner_email": "owner@example.com",
  "end_date": "2026-04-01",
  "subscription_plan": { "id": 1, "name": "Старт" },
  "sector": { "id": 3, "name": "Маркет" }
}
```

### 6.2. Ручной retry

```
POST /consalting/clients/{id}/provision-tenant/
```

Только `owner`/`admin`. Повторяет provision если `failed` или `pending` + есть
подтверждённая продажа.

### 6.3. Поля в Lead (опционально)

При `GET /consalting/leads/{id}/` добавить:

```json
{
  "tenant_provision_status": "pending",
  "tenant_provision_status_display": "Ожидает подтверждения кассы"
}
```

---

## 7. Фронт

| Компонент | Изменение |
|-----------|-----------|
| `ConsultingClientDetail.jsx` | Блок «CRM-аккаунт», оплата через `subscription-payments/pay` |
| `LeadPaymentModal.jsx` | Email обязателен если тариф `provisions_crm_account` |
| `Funnel.jsx` | Бейдж provision status на карточке лида |
| `src/api/consultingTenant.js` | API-клиент |

---

## 8. Уведомление клиенту

После успешного provision отправить (на выбор, настраивается):

- Email с логином и временным паролем
- SMS / WhatsApp (если есть интеграция)

Пароль показывается **один раз** менеджеру в UI при retry (как `generated_password`
в platform-admin).

---

## 9. Чек-лист приёмки

- [ ] Confirm продажи с тарифом `provisions_crm_account=true` создаёт Company + User.
- [ ] Повторный confirm не создаёт вторую Company.
- [ ] Email занят → `failed`, понятный `detail` менеджеру.
- [ ] Confirm абонплаты продлевает `end_date` на month/year.
- [ ] Просроченный tenant: extend от `today`.
- [ ] Карточка клиента показывает статус и `end_date`.
- [ ] Клиент может войти в CRM после provision.
- [ ] `ProtectedRoute` блокирует при истёкшем `end_date`.
- [ ] E2E: лид → оплата → касса → login → абонплата → касса → доступ OK.

---

## 10. Связанные документы

- [00-money-flow.md](./00-money-flow.md) — единый денежный контур
- [01-subscription.md](./01-subscription.md) — график абонентки
- [03-cash-confirmation.md](./03-cash-confirmation.md) — confirm кассы
- [04-tenant-lifecycle.md](./04-tenant-lifecycle.md) — детали для backend
- [../platform-admin/backend/03-subscription.md](../platform-admin/backend/03-subscription.md) — `end_date`
