# 10. Tenant lifecycle — CRM-аккаунт клиента

**Фронт:** `src/api/consultingTenant.js`, `ConsultingClientDetail.jsx`,  
`LeadPaymentModal.jsx`, `Funnel.jsx`.  
**Бизнес-док:** [scenario-tenant.md](./scenario-tenant.md).

## 10.1. Scope

- Только компания NUR (`settings.NUR_CONSULTING_COMPANY_ID`).
- Тариф с `provisions_crm_account=True` запускает provision.
- Side-effects **после** `confirm_cash_request`, не при создании Sale.

## 10.2. Hook в confirm

```python
# apps/consalting/services/cash_confirmation.py — внутри confirm_request

if req.kind == CashRequest.Kind.SALE and req.sale:
    req.sale.status = Sale.Status.COMPLETED
    req.sale.save(update_fields=["status"])
    if req.sale.tariff and req.sale.tariff.provisions_crm_account:
        provision_tenant_account(
            client=req.client or req.sale.client,
            sale=req.sale,
            lead=req.sale.lead,
            tariff=req.sale.tariff,
            actor=user,
        )

if req.kind == CashRequest.Kind.SUBSCRIPTION and req.subscription_payment:
    p = req.subscription_payment
    p.status = SubscriptionPayment.Status.PAID
    p.paid_at = timezone.now()
    p.cash_operation = op
    p.save()
    extend_tenant_subscription(
        client=p.subscription.client,
        subscription_payment=p,
        actor=user,
    )
```

## 10.3. provision_tenant_account

```python
@transaction.atomic
def provision_tenant_account(*, client, sale, lead, tariff, actor):
    if client.nur_company_id:
        client.provision_status = ProvisionStatus.CREATED
        client.save(update_fields=["provision_status"])
        return ProvisionResult(skipped=True, company_id=client.nur_company_id)

    email = (lead.email if lead else None) or client.email
    if not email:
        client.provision_status = ProvisionStatus.FAILED
        client.provision_error = "Укажите email клиента для создания аккаунта."
        client.save(update_fields=["provision_status", "provision_error"])
        raise ValidationError({"detail": client.provision_error})

    try:
        company, user, password = create_company_with_owner(
            email=email,
            first_name=lead.first_name if lead else client.first_name or "",
            last_name=lead.last_name if lead else client.last_name or "",
            company_name=client.full_name or client.company_name or "Компания клиента",
            sector_id=tariff.crm_sector_id,
            subscription_plan_id=tariff.crm_subscription_plan_id,
            company_region=lead.company_region if lead else None,
            end_date=timezone.localdate() + timedelta(days=tariff.initial_access_days or 30),
        )
    except EmailAlreadyExists:
        client.provision_status = ProvisionStatus.FAILED
        client.provision_error = "Email уже зарегистрирован. Привяжите вручную в platform-admin."
        client.save(update_fields=["provision_status", "provision_error"])
        raise ValidationError({"detail": client.provision_error})

    client.nur_company = company
    client.provision_status = ProvisionStatus.CREATED
    client.provisioned_at = timezone.now()
    client.provision_error = ""
    client.save()

    notify_tenant_credentials(client, user, password)
    audit_log("tenant.provision", actor=actor, client=client, company=company)
    return ProvisionResult(company_id=company.id, generated_password=password)
```

## 10.4. extend_tenant_subscription

```python
def resolve_new_end_date(company, period: str, reference_date=None) -> date:
    step = relativedelta(months=1) if period == "month" else relativedelta(years=1)
    today = timezone.localdate()
    base = company.end_date if company.end_date and company.end_date >= today else today
    return base + step

@transaction.atomic
def extend_tenant_subscription(*, client, subscription_payment, actor):
    company = client.nur_company
    if not company:
        return ExtensionResult(skipped=True, reason="no_nur_company")

    period = subscription_payment.subscription.period  # month | year
    old = company.end_date
    new = resolve_new_end_date(company, period)
    company.end_date = new
    company.save(update_fields=["end_date"])

    TenantSubscriptionExtension.objects.create(
        company=company,
        consalting_client=client,
        subscription_payment=subscription_payment,
        old_end_date=old,
        new_end_date=new,
        period=period,
        extended_by=actor,
    )
    audit_log("tenant.extend", actor=actor, company=company, old=old, new=new)
    return ExtensionResult(old_end_date=old, new_end_date=new)
```

## 10.5. Эндпоинты

```
GET  /consalting/clients/{id}/tenant-account/
POST /consalting/clients/{id}/provision-tenant/
```

### GET tenant-account — Response 200

```json
{
  "provision_status": "created",
  "provision_status_display": "Аккаунт создан",
  "provision_error": null,
  "provisioned_at": "2026-03-02T11:00:00+06:00",
  "nur_company_id": 42,
  "company_name": "ОсОО Ромашка",
  "owner_email": "owner@example.kg",
  "end_date": "2026-04-01",
  "subscription_plan": { "id": 1, "name": "Старт" },
  "sector": { "id": 3, "name": "Маркет" }
}
```

### POST provision-tenant — Response 200

Тот же объект. При успехе с новым паролем:

```json
{ "...": "...", "generated_password": "Ab12Cd34!" }
```

**403** — не owner/admin. **400** — нет подтверждённой продажи / уже created без retry.

## 10.6. Lead serializer (опционально)

Добавить read-only поля:

- `tenant_provision_status`
- `tenant_provision_status_display`

## 10.7. Чек-лист

- [ ] Provision только для `NUR_CONSULTING_COMPANY_ID`.
- [ ] Идемпотентность provision по `client.nur_company_id`.
- [ ] Extend идемпотентен по `subscription_payment` (повтор confirm → 400).
- [ ] Аудит provision и extend.
- [ ] Фронт: `consultingTenant.js` + блок в карточке клиента.
