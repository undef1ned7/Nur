# 8. Отмена и возврат продажи: полный откат

**Фронт:** `sale/sale.jsx` (список со статусами), `sale/SaleCancelModal.jsx`,
API-слой `src/api/consultingSales.js`.

## 8.1. Что сейчас не так

Продажа **удаляется** (`DELETE /consalting/sales/{id}/`). Запись исчезает, а всё,
что она породила, продолжает жить: абонентский график у клиента, начисление
зарплаты продавцу, приход в кассе, цифры в аналитике. Плюс не остаётся следа —
кто и зачем удалил.

Заменяем на **отмену со статусом** и атомарный откат последствий.

## 8.2. Модель

```python
class Sale(models.Model):
    class Status(models.TextChoices):
        COMPLETED = "completed", "Проведена"
        PENDING_CONFIRMATION = "pending_confirmation", "Ждёт подтверждения"
        CANCELED = "canceled", "Отменена"
        REFUNDED = "refunded", "Частичный возврат"

    class CancelReason(models.TextChoices):
        CLIENT_REFUSED = "client_refused", "Клиент отказался"
        INPUT_ERROR = "input_error", "Ошибка оформления"
        WARRANTY = "warranty", "Возврат по гарантии"
        DUPLICATE = "duplicate", "Дубль"
        OTHER = "other", "Другое"

    # --- НОВЫЕ ПОЛЯ ---
    status = models.CharField(max_length=24, choices=Status.choices,
                              default=Status.COMPLETED, db_index=True)
    canceled_at = models.DateTimeField(null=True, blank=True)
    canceled_by = models.ForeignKey(User, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="canceled_sales")
    cancel_reason = models.CharField(max_length=32, choices=CancelReason.choices, blank=True)
    cancel_comment = models.TextField(blank=True)
    refunded_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)


class SaleRefund(models.Model):
    """Частичный возврат: продажа остаётся, часть суммы возвращается."""
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="refunds")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.CharField(max_length=32, choices=Sale.CancelReason.choices)
    comment = models.TextField(blank=True)
    refund_mode = models.CharField(max_length=16)     # cash | transfer | none
    created_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
```

## 8.3. Эндпоинты

### Полная отмена

```
POST /consalting/sales/{id}/cancel/
{
  "reason": "client_refused",
  "comment": "",
  "refund_mode": "cash|transfer|none",
  "lead_action": "return_to_work|reject|null"
}
```

### Частичный возврат

```
POST /consalting/sales/{id}/refund/
{ "amount": 15000, "reason": "warranty", "comment": "", "refund_mode": "cash" }
```

Валидация: `0 < amount <= total - refunded_amount`, иначе `400` с текстом
«Сумма возврата больше остатка по продаже».

### Список и отчёт

```
GET /consalting/sales/            # + status, user, client, service, date_from/to, search, page
GET /consalting/sales/cancellations/?date_from=&date_to=&user=&reason=&page=
```

Отчёт «Отмены и возвраты» отдаёт: дата, продажа, клиент, сумма, кто оформил, кто
отменил, причина.

## 8.4. Алгоритм отката (ядро задачи)

Всё — в **одной транзакции**. Не должно быть состояния «абонентку убрали, а
зарплату забыли».

```python
@transaction.atomic
def cancel_sale(sale, *, user, reason, comment, refund_mode, lead_action=None,
                partial_amount=None):
    if sale.status == Sale.Status.CANCELED:
        raise ValidationError({"detail": "Продажа уже отменена."})

    partial = partial_amount is not None
    ratio = (partial_amount / sale.total) if partial else Decimal("1")

    # 1. АБОНЕНТКА: будущие неоплаченные платежи аннулируем, оплаченные не трогаем
    for sub in sale.subscriptions.all():
        if partial:
            continue                      # частичный возврат абонентку не снимает
        sub.payments.filter(status=SubscriptionPayment.Status.PLANNED).update(
            status=SubscriptionPayment.Status.CANCELED)
        sub.payments.filter(status=SubscriptionPayment.Status.OVERDUE).update(
            status=SubscriptionPayment.Status.CANCELED)
        sub.status = Subscription.Status.CANCELED
        sub.canceled_at = timezone.now()
        sub.save(update_fields=["status", "canceled_at"])

    # 2. ДОЛГ / РАССРОЧКА: неоплаченные строки графика аннулируем
    if not partial:
        Installment.objects.filter(sale=sale, status="planned").update(status="canceled")

    # 3. ЗАРПЛАТА: отменяем начисление; если уже выплачено — создаём удержание
    for accrual in SalaryAccrual.objects.filter(sale=sale).exclude(status="canceled"):
        if accrual.status == "paid":
            SalaryAdjustment.objects.create(
                company=sale.company, user=accrual.user, kind="deduction",
                amount=(accrual.amount * ratio).quantize(Decimal("0.01")),
                reason="sale_canceled", date=timezone.localdate(),
                comment=f"Отмена продажи №{sale.number or sale.id}",
                source_sale=sale,
            )
        elif partial:
            accrual.amount = (accrual.amount * (1 - ratio)).quantize(Decimal("0.01"))
            accrual.base_amount = (accrual.base_amount * (1 - ratio)).quantize(Decimal("0.01"))
            accrual.save(update_fields=["amount", "base_amount"])
        else:
            accrual.status = "canceled"
            accrual.save(update_fields=["status"])

    # 4. КАССА
    pending = CashRequest.objects.filter(sale=sale, status="pending").first()
    if pending and not partial:
        pending.status = "canceled"       # деньги ещё не поступали — просто снимаем заявку
        pending.save(update_fields=["status"])
    elif refund_mode in ("cash", "transfer"):
        CashRequest.objects.create(       # возврат тоже подтверждает кассир
            company=sale.company, kind="refund", sale=sale, client=sale.client,
            user=user, amount=partial_amount or sale.total,
            payment_method=refund_mode, direction="expense", status="pending",
        )

    # 5. ЛИД
    if sale.lead_id and not partial:
        lead = sale.lead
        if lead_action == "return_to_work":
            lead.status = "in_work"; lead.converted_at = None; lead.sale = None
        elif lead_action == "reject":
            lead.status = "rejected"; lead.reject_reason = "other"
            lead.reject_comment = "Продажа отменена"; lead.closed_at = timezone.now()
        lead.save()

    # 6. САМА ПРОДАЖА
    if partial:
        sale.refunded_amount += partial_amount
        sale.status = Sale.Status.REFUNDED
    else:
        sale.status = Sale.Status.CANCELED
        sale.canceled_at = timezone.now()
        sale.canceled_by = user
        sale.cancel_reason = reason
        sale.cancel_comment = comment
    sale.save()
```

## 8.5. Аналитика после отмены

**Ключевое правило: отмена корректирует тот период, в котором была продажа**, а
не месяц, когда нажали кнопку. Иначе июль выглядит отличным, а август —
провальным на ровном месте.

Практически это значит: в отчётах не «сторнируем» задним числом отдельной
проводкой, а **исключаем отменённые суммы из выборки по дате продажи**:

```python
completed = Q(status__in=["completed", "pending_confirmation"])
revenue   = Sum("total", filter=completed)
returns   = Sum("refunded_amount") + Sum("total", filter=Q(status="canceled"))
net       = revenue - returns
```

Во все отчёты сектора («Аналитика», «Лиды», карточка сотрудника, зарплата)
добавляются три величины вместо одной:

```jsonc
{ "sales": 1250000, "cancellations": 85000, "net_revenue": 1165000,
  "cancel_rate": 6.8 }   // доля отмен в % от продаж
```

Разрезы `cancel_rate` — по компании, по сотрудникам и по услугам: всплеск отмен
у одного менеджера виден сразу.

Конверсия лидов ([01-leads.md](./01-leads.md)) пересчитывается по тому же
принципу: отменённая продажа не считается покупкой.

## 8.6. Права и ограничения

- Отменять может `owner`/`admin`.
- Сотруднику разрешаем отменить **свою** продажу в течение окна
  `SALE_SELF_CANCEL_MINUTES` (настройка компании, по умолчанию 30 минут) — на
  случай ошибки ввода. Позже — `403` с текстом «Отмену подтверждает
  руководитель».
- Причина обязательна всегда; при `reason="other"` обязателен комментарий.
- `DELETE /consalting/sales/{id}/` оставить **только для owner** и только для
  продаж без последствий (нет оплат, нет абонентки) — либо убрать совсем.
- Отменённую продажу нельзя редактировать.

## 8.7. Чек-лист приёмки

- [ ] Отмена не удаляет запись; в списке видно «Отменена», кто и когда.
- [ ] Абонентский график клиента переходит в `canceled`, будущие месяцы в
      матрице пустеют, оплаченные периоды остаются в истории.
- [ ] Начисление зарплаты отменено; если было выплачено — появилось удержание
      в расчётном листе следующего периода.
- [ ] Неподтверждённая заявка в кассе снимается; при возврате денег создаётся
      расходная заявка на подтверждение.
- [ ] Лид не остаётся «выигранным».
- [ ] Повторная отмена → `400`, ничего не задваивается.
- [ ] Выручка июля уменьшилась именно в июле; появились «отмены и возвраты» и
      «чистая выручка».
- [ ] Частичный возврат уменьшает начисление пропорционально и не трогает
      абонентку.
