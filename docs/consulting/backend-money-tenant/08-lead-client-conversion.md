# 8. Конверсия лид → клиент и дедупликация

**ТЗ:** «Доработка логики и автоматизация CRM», блок 3 (День 2).  
**Фронт:** `LeadCreateClientModal.jsx`, `LeadPaymentModal.jsx`, `funnelThunk.js`

Связано: [../funnel-crm-logic.md](../funnel-crm-logic.md), [01-subscription.md](./01-subscription.md),
[04-tenant-lifecycle.md](./04-tenant-lifecycle.md).

## 8.1. Задача

1. При «Оплачено» / передаче во «Внедрение» — **автоматически** создать или
   найти карточку **Client** (consalting) и привязать к лиду.
2. **Дедупликация** по телефону и email: не создавать дубль, обновить существующую
   карточку и слить историю.
3. История лида (чат, суммы, owner) остаётся доступна через `lead.client`.

---

## 8.2. Триггеры конверсии

| Событие | Когда создаётся/находит Client |
|---|---|
| `POST …/leads/{id}/register-payment/` | **Обязательно** до `create_sale_side_effects` |
| `POST …/leads/{id}/win/` на `is_final=true` | Если client ещё нет |
| `move_lead_to_next_funnel` после payment | Client уже есть; только перенос лида |
| Ручной «Создать клиента» в UI | `POST …/leads/{id}/create-client/` (существующий) |

`register-payment` **без client** → `400`:

```json
{ "detail": "Сначала создайте клиента из лида или укажите email для автосоздания." }
```

---

## 8.3. Сервис `resolve_client_from_lead`

```python
@transaction.atomic
def resolve_client_from_lead(lead, *, user, force_create=False) -> Client:
    """
    Находит или создаёт Client. Идемпотентен для одного lead.id.
    """
    if lead.client_id:
        return lead.client

    phone = normalize_phone(lead.phone)
    email = (lead.email or "").strip().lower()

    existing = None
    if phone:
        existing = Client.objects.filter(company=lead.company, phone=phone).first()
    if not existing and email:
        existing = Client.objects.filter(company=lead.company, email__iexact=email).first()

    if existing:
        client = merge_lead_into_client(existing, lead, user=user)
    else:
        if not phone and not email and not force_create:
            raise ValidationError({"detail": "…"})
        client = Client.objects.create(
            company=lead.company,
            full_name=lead.full_name or lead.title or "Клиент",
            phone=phone or "",
            email=email or "",
            source=lead.source,
            created_by=user,
        )

    lead.client = client
    lead.save(update_fields=["client"])
    return client
```

### Нормализация телефона

- E.164 для KG: убрать пробелы, `8`/`0` → `+996…`.
- Сравнение по последним 9 цифрам как fallback (опционально, логировать коллизии).

### `merge_lead_into_client`

Обновляет пустые поля клиента из лида (не затирает заполненные):

- `full_name` — если у client пусто или короче
- `email`, `phone` — дополнить
- `notes` — append блок «Из лида #{id}»
- Wazzup chat / messages — **не переносить** (остаются на lead; в UI карточки
  клиента — ссылка на lead)

---

## 8.4. Цепочка register-payment

```python
@transaction.atomic
def register_lead_payment(lead, payload, *, user):
    client = resolve_client_from_lead(lead, user=user)
    sale = create_sale_side_effects(
        client=client,
        lead=lead,
        user=user,
        payment_mode=payload.payment_mode,
        amount=payload.amount,
        ...
    )
    on_register_payment_move_funnel(lead, user=user)  # см. 06-regional-funnels-routing.md
    return {"sale": sale, "lead": lead, "client_id": client.id}
```

Идемпотентность: повторный `register-payment` с тем же `Idempotency-Key` или
`lead.payment_registered=True` → `409` или возврат существующего sale.

---

## 8.5. API

### Автосоздание при оплате (неявное)

Поля лида, обязательные для tenant ([04-tenant-lifecycle.md](./04-tenant-lifecycle.md)):

- `email` — если тариф `provisions_crm_account=True`
- `phone` — рекомендуется

### Явное создание

```
POST /consalting/leads/{id}/create-client/
{ "full_name"?, "phone"?, "email"?, "force_merge"?: false }
```

Ответ:

```jsonc
{
  "client_id": "uuid",
  "merged": false,
  "client_display": "Иванов Иван",
  "duplicate_warning": null
}
```

При merge с существующим: `"merged": true`, `duplicate_warning` с id найденного.

### Поиск дублей (опционально для UI)

```
GET /consalting/clients/lookup/?phone=+996…&email=
```

```jsonc
{ "matches": [{ "id", "full_name", "phone", "email", "last_sale_at" }] }
```

---

## 8.6. Webhook эквайринга (опционально, блок 4 ТЗ)

Если оплата через внешний эквайринг:

```
POST /consalting/payments/webhook/{provider}/
```

- Верификация подписи провайдера.
- Найти lead/sale по `external_payment_id`.
- Создать `CashRequest` или сразу `CashOperation` (если `mode=off`).
- Идемпотентность по `provider + transaction_id`.

До внедрения webhook — только ручной `register-payment` / касса.

---

## 8.7. Чек-лист приёмки

- [ ] Оплата с новым телефоном → новый Client + привязка lead.client.
- [ ] Оплата с существующим телефоном → тот же Client, без дубля.
- [ ] Email-match при другом формате телефона → merge.
- [ ] Повторный register-payment → одна Sale.
- [ ] Client виден в `/crm/consulting/client` с абоненткой ([01-subscription.md](./01-subscription.md)).
- [ ] Tenant provision после confirm кассы ([04-tenant-lifecycle.md](./04-tenant-lifecycle.md)).
