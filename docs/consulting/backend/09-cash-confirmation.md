# 9. Подтверждение поступления в кассе

**Фронт:** `Kassa/CashRequests.jsx` (вкладка «Подтверждения» со счётчиком),
API-слой `src/api/consultingCashbox.js`.

## 9.1. Задача

Продажа и приход денег разделяются: менеджер оформляет продажу, **кассир
подтверждает поступление**. Пока заявка не подтверждена, деньги **не входят в
остаток кассы** — иначе касса никогда не сойдётся.

Сейчас касса о продаже вообще не знает: расхождение вскрывается в конце месяца,
и отвечать за факт поступления некому.

## 9.2. Модель

```python
class CashRequest(models.Model):
    """Заявка на кассовую операцию, ожидающая подтверждения."""
    class Kind(models.TextChoices):
        SALE = "sale", "Продажа"
        HANDOVER = "handover", "Сдача наличных"
        REFUND = "refund", "Возврат клиенту"
        SUBSCRIPTION = "subscription", "Абонентский платёж"

    class Status(models.TextChoices):
        PENDING = "pending", "Ожидает подтверждения"
        CONFIRMED = "confirmed", "Подтверждено"
        REJECTED = "rejected", "Отклонено"
        CANCELED = "canceled", "Снято"        # продажа отменена до подтверждения

    class RejectReason(models.TextChoices):
        NO_MONEY = "no_money", "Деньги не поступили"
        AMOUNT_MISMATCH = "amount_mismatch", "Сумма не совпадает"
        OTHER_METHOD = "other_method", "Оплата прошла другим способом"
        DUPLICATE = "duplicate", "Дубль операции"
        OTHER = "other", "Другое"

    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    cashbox = models.ForeignKey(CashBox, null=True, blank=True, on_delete=models.SET_NULL)
    kind = models.CharField(max_length=16, choices=Kind.choices)
    direction = models.CharField(max_length=8, default="income")   # income | expense

    sale = models.ForeignKey("Sale", null=True, blank=True, on_delete=models.CASCADE)
    subscription_payment = models.ForeignKey("SubscriptionPayment", null=True, blank=True,
                                             on_delete=models.CASCADE)
    client = models.ForeignKey(Client, null=True, blank=True, on_delete=models.SET_NULL)

    user = models.ForeignKey(User, on_delete=models.PROTECT,
                             related_name="cash_requests")        # кто оформил / сдаёт
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=16, blank=True)   # cash | transfer | card
    comment = models.TextField(blank=True)

    status = models.CharField(max_length=16, choices=Status.choices,
                              default=Status.PENDING, db_index=True)
    confirmed_by = models.ForeignKey(User, null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name="confirmed_requests")
    confirmed_at = models.DateTimeField(null=True, blank=True)
    reject_reason = models.CharField(max_length=32, choices=RejectReason.choices, blank=True)
    reject_comment = models.TextField(blank=True)
    cash_operation = models.ForeignKey("CashOperation", null=True, blank=True,
                                       on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        constraints = [
            # одна продажа — одна активная заявка
            models.UniqueConstraint(fields=["sale"],
                condition=~Q(status__in=["rejected", "canceled"]),
                name="uniq_active_request_per_sale"),
        ]
        indexes = [models.Index(fields=["company", "status", "created_at"])]


class CashConfirmationSettings(models.Model):
    class Mode(models.TextChoices):
        ALWAYS = "always", "Всегда"
        CASH_ONLY = "cash_only", "Только для наличных"
        OFF = "off", "Выключено"

    company = models.OneToOneField(Company, on_delete=models.CASCADE,
                                   related_name="cash_confirmation")
    mode = models.CharField(max_length=16, choices=Mode.choices, default=Mode.CASH_ONLY)
    skip_for_cashier = models.BooleanField(default=True)   # кассир не подтверждает сам себя
    overdue_hours = models.PositiveIntegerField(default=24)
```

**Важно:** к кассовой операции (`CashOperation`) добавляется обязательная привязка
к сотруднику — `user = FK(User)` — см. [07-employee-finance.md](./07-employee-finance.md).
Без неё невозможен разрез «кто внёс».

## 9.3. Когда создаётся заявка

Внутри `create_sale_side_effects` (см. [05-subscription.md](./05-subscription.md)),
после создания продажи:

```python
def needs_confirmation(company, payment_method, author):
    s = company.cash_confirmation
    if s.mode == "off":
        return False
    if s.mode == "cash_only" and payment_method != "cash":
        return False
    if s.skip_for_cashier and author.has_perm_cashbox:   # оформил сам кассир
        return False
    return True
```

- Нужна → создаём `CashRequest(status=pending)`, продажа получает
  `status="pending_confirmation"`, деньги **в остаток не идут**.
- Не нужна → сразу создаём `CashOperation` (приход), продажа `completed`.

## 9.4. Эндпоинты

```
GET  /consalting/cashbox/requests/            # status, kind, user, cashbox, date_from/to, search, page
GET  /consalting/cashbox/requests/counters/
POST /consalting/cashbox/requests/{id}/confirm/   { "cashbox": "uuid|null", "comment": "" }
POST /consalting/cashbox/requests/{id}/reject/    { "reason": "no_money", "comment": "" }
POST /consalting/cashbox/handovers/               { "amount": 12000, "comment": "", "cashbox": null }
GET  /consalting/cashbox/operations/          # подтверждённые операции + фильтр user
GET  /consalting/cashbox/reconciliation/      # сверка по сотрудникам → 07
GET  /consalting/cashbox/confirmation-settings/
PUT  /consalting/cashbox/confirmation-settings/   { "mode", "skip_for_cashier", "overdue_hours" }
```

Элемент списка заявок:

```jsonc
{
  "id": "…", "kind": "sale", "kind_display": "Продажа",
  "created_at": "2026-07-29T12:00:00+06:00",
  "source_display": "Внедрение CRM / Стандарт",
  "client_display": "Иванов Иван",
  "user_display": "Менеджер А",
  "amount": 45000,
  "payment_method": "cash", "payment_method_display": "Наличными",
  "status": "pending", "status_display": "Ожидает подтверждения",
  "reject_reason_display": null,
  "is_overdue": false        // висит дольше overdue_hours
}
```

Счётчики:

```jsonc
{ "pending": 7, "confirmed": 120, "rejected": 3, "all": 130, "pending_amount": 315000 }
```

`pending_amount` фронт показывает баннером «эти деньги не входят в остаток».

## 9.5. Подтверждение и отклонение

```python
@transaction.atomic
def confirm_request(req, *, user, cashbox=None, comment=""):
    if req.status != CashRequest.Status.PENDING:
        raise ValidationError({"detail": "Заявка уже обработана."})

    op = CashOperation.objects.create(
        company=req.company,
        cashbox=cashbox or req.cashbox or default_cashbox(req.company),
        type=req.direction,                     # income | expense
        amount=req.amount,
        user=req.user,                          # ЧЬИ деньги (не тот, кто подтвердил)
        confirmed_by=user,
        name=req.client.full_name if req.client else req.get_kind_display(),
        source_business_operation_id=str(req.id),
    )
    req.status = CashRequest.Status.CONFIRMED
    req.confirmed_by = user
    req.confirmed_at = timezone.now()
    req.cash_operation = op
    req.comment = comment or req.comment
    req.save()

    if req.kind == CashRequest.Kind.SALE and req.sale:
        req.sale.status = Sale.Status.COMPLETED
        req.sale.save(update_fields=["status"])
    if req.kind == CashRequest.Kind.SUBSCRIPTION and req.subscription_payment:
        p = req.subscription_payment
        p.status = "paid"; p.paid_at = timezone.now(); p.cash_operation = op
        p.save()
    notify_user(req.user, "consulting.cash.confirmed", {...})
```

Отклонение: `reason` обязателен (при `other` — комментарий), `CashOperation`
не создаётся, продажа остаётся `pending_confirmation`, менеджеру уходит
`consulting.cash.rejected`. Отклонённую заявку можно пересоздать вручную.

**Остаток кассы** считается только по `CashOperation`, то есть только по
подтверждённым заявкам. Нигде не суммируйте `CashRequest` в остаток.

## 9.6. Права

| Действие | Кто |
|---|---|
| Видеть все заявки | `owner`, `admin`, ответственный за кассу |
| Видеть свои заявки | любой сотрудник (`user=self`) |
| Подтверждать / отклонять | `owner`, `admin`, ответственный за кассу; **не сам автор**, если `skip_for_cashier=false` |
| Менять настройки | `owner`, `admin` |
| Создавать `handover` | любой сотрудник — только на себя |

## 9.7. Просрочка

Задача раз в час: заявки `pending` старше `overdue_hours` помечаются
`is_overdue=true` (вычисляемое поле) и попадают в напоминание руководителю —
одно сводное сообщение, не по каждой заявке.

## 9.8. События реалтайма

| Событие | Кому |
|---|---|
| `consulting.cash.request_created` | ответственным за кассу |
| `consulting.cash.confirmed` | автору заявки |
| `consulting.cash.rejected` | автору заявки |

## 9.9. Чек-лист приёмки

- [ ] Продажа наличными создаёт заявку; продажа переводом при `mode=cash_only` —
      сразу приход.
- [ ] До подтверждения остаток кассы не меняется, сумма видна в
      `pending_amount`.
- [ ] Подтверждение создаёт ровно одну `CashOperation` с `user` = автор продажи.
- [ ] Повторное подтверждение → `400`.
- [ ] Отклонение без причины → `400`.
- [ ] Отмена продажи снимает неподтверждённую заявку (см. 08).
- [ ] Возврат клиенту создаёт расходную заявку, а не «тихий» расход.
- [ ] Кассир, оформивший продажу сам, не обязан себя подтверждать (при
      `skip_for_cashier=true`).
