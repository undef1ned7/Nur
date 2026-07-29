# 5. Абонентская плата при закрытии сделки (главный блокер)

**Фронт:** `Funnel/LeadPaymentModal.jsx` (блок «Абонентская плата»),
`client/ConsultingClientDetail.jsx`, `client/SubscriptionMatrix.jsx`.
**Смежные:** [08-sale-cancel.md](./08-sale-cancel.md) (откат),
[09-cash-confirmation.md](./09-cash-confirmation.md) (приём платежа).

## 5.1. Что сейчас сломано

1. У тарифа задаётся `subscription_amount` + `subscription_period` — работает.
2. Лид/продажа несут `service` и `tariff` — работает, фронт их отправляет.
3. **При закрытии сделки график абонентских платежей не создаётся** — данных
   нет ни в карточке клиента, ни в матрице, ни в планах поступлений.

Компания уже продаёт абонентские услуги и не видит их в системе. Это не новая
функция, а недоделанная логика — поэтому пункт первый по приоритету.

## 5.2. Модель

```python
class Subscription(models.Model):
    """Подключённая клиенту абонентская услуга."""
    class Period(models.TextChoices):
        MONTH = "month", "Ежемесячно"
        YEAR = "year", "Ежегодно"

    class Status(models.TextChoices):
        ACTIVE = "active", "Активна"
        PAUSED = "paused", "Приостановлена"
        CANCELED = "canceled", "Отменена"
        FINISHED = "finished", "Завершена"

    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="subscriptions")
    service = models.ForeignKey(Service, on_delete=models.PROTECT)
    tariff = models.ForeignKey(Tariff, null=True, blank=True, on_delete=models.PROTECT)
    sale = models.ForeignKey("Sale", null=True, blank=True,
                             on_delete=models.SET_NULL, related_name="subscriptions")
    lead = models.ForeignKey("Lead", null=True, blank=True, on_delete=models.SET_NULL)

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    period = models.CharField(max_length=8, choices=Period.choices, default=Period.MONTH)
    start_date = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    canceled_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)


class SubscriptionPayment(models.Model):
    """Одна строка графика: период → сумма → статус."""
    class Status(models.TextChoices):
        PLANNED = "planned", "Запланирован"
        PAID = "paid", "Оплачен"
        OVERDUE = "overdue", "Просрочен"
        CANCELED = "canceled", "Отменён"

    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE,
                                     related_name="payments")
    period_month = models.CharField(max_length=7)      # "2026-07" — ключ ячейки матрицы
    due_date = models.DateField(db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PLANNED)
    paid_at = models.DateTimeField(null=True, blank=True)
    cash_operation = models.ForeignKey("CashOperation", null=True, blank=True,
                                       on_delete=models.SET_NULL)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["subscription", "period_month"],
                                    name="uniq_subscription_period")
        ]
        indexes = [models.Index(fields=["due_date", "status"])]
```

`period_month` дублирует `due_date` намеренно: матрица группируется строго по
месяцам, а искать по строке дешевле, чем по `TruncMonth` на каждый запрос.

## 5.3. Когда создаётся график

**Единая точка** — функция `create_sale_side_effects(sale)`, вызываемая внутри
одной транзакции при:

- `POST /consalting/sales/` — оформление продажи;
- `POST /consalting/leads/{id}/register-payment/` — оплата по лиду;
- переход лида в выигрыш **в финальной воронке** (см.
  [03-funnel-hierarchy.md](./03-funnel-hierarchy.md), `is_final=True`).

```python
@transaction.atomic
def create_sale_side_effects(sale, *, subscription_enabled=True,
                             subscription_start=None, subscription_amount=None,
                             subscription_period=None):
    # 1. клиент (создаётся/находится выше по стеку)
    # 2. сама продажа уже создана
    # 3. абонентка
    tariff = sale.tariff
    amount = subscription_amount if subscription_amount is not None else (
        tariff.subscription_amount if tariff else 0)
    if subscription_enabled and amount and amount > 0:
        sub, created = Subscription.objects.get_or_create(
            sale=sale, service=sale.service,      # ключ идемпотентности
            defaults=dict(
                company=sale.company, client=sale.client, tariff=tariff,
                lead=sale.lead, amount=amount,
                period=subscription_period or (tariff.subscription_period if tariff else "month"),
                start_date=subscription_start or timezone.localdate(),
                created_by=sale.user,
            ),
        )
        if created:
            generate_schedule(sub, horizon_months=12)
    # 4. зарплата → 02-salary.md
    # 5. заявка в кассу → 09-cash-confirmation.md
```

### Генерация графика

```python
def generate_schedule(sub, horizon_months=12):
    """Плановые платежи вперёд на горизонт. Продлевается ежемесячной задачей."""
    step = relativedelta(months=1) if sub.period == "month" else relativedelta(years=1)
    count = horizon_months if sub.period == "month" else 3   # для года — 3 периода
    due = sub.start_date
    rows = []
    for _ in range(count):
        rows.append(SubscriptionPayment(
            subscription=sub, due_date=due,
            period_month=due.strftime("%Y-%m"), amount=sub.amount,
        ))
        due += step
    SubscriptionPayment.objects.bulk_create(rows, ignore_conflicts=True)
```

Ежедневная задача:

- продлевает график, если до конца горизонта осталось меньше 3 периодов;
- переводит `planned → overdue`, если `due_date < today` и оплаты нет;
- шлёт уведомление ответственному за клиента о просрочке (опционально).

**Годовой тариф**: платёж раз в год, в матрице показывается только в месяце
списания, остальные месяцы года пустые.

## 5.4. Приём оплаты

```
POST /consalting/subscription-payments/{id}/pay/
{ "cashbox": "uuid|null", "payment_method": "cash|transfer", "amount": 5000 }
```

- Создаёт **заявку в кассу** `kind="subscription"`
  ([09-cash-confirmation.md](./09-cash-confirmation.md)); платёж переходит в
  `paid` только после подтверждения (либо сразу, если подтверждение выключено).
- Частичная оплата: если `amount < payment.amount`, допускается создание
  «остатка» — либо запретите (проще) с понятным `detail`.
- Повторная оплата уже оплаченного периода → `400`.

## 5.5. Что читает фронт

### Карточка клиента

```
GET /consalting/clients/{id}/subscriptions/
```

```jsonc
{
  "results": [
    {
      "id": "sub-1", "service_display": "Внедрение CRM", "tariff_display": "Стандарт",
      "amount": 5000, "period": "month", "period_display": "Ежемесячно",
      "status": "active", "start_date": "2026-03-01",
      "next_payment": { "id": "p-9", "due_date": "2026-08-01", "amount": 5000, "status": "planned" },
      "payments": [
        { "id": "p-1", "period_month": "2026-03", "due_date": "2026-03-01",
          "amount": 5000, "status": "paid", "paid_at": "2026-03-02T11:00:00+06:00" }
      ]
    }
  ]
}
```

### Абонентская матрица

Контракт уже описан в [../subscription-matrix.md](../subscription-matrix.md) —
он не меняется:

```
GET /consalting/subscription-matrix/?month_from=YYYY-MM&month_to=YYYY-MM&search=&page=&page_size=
```

Строка = «клиент × услуга», ячейка = `{ amount, status }` по `period_month`.
Источник данных — те же `SubscriptionPayment`. Добавьте пагинацию строк
(`count`, `results` в поле `rows`) — фронт к ней готов.

## 5.6. Что приходит с фронта дополнительно

`POST /consalting/leads/{id}/register-payment/` теперь получает четыре поля
(фронт уже их шлёт, см. `funnelThunk.registerLeadPayment`):

```jsonc
{
  "payment_mode": "cash|transfer|debt|installment",
  "amount": 45000, "debt_months": 6, "prepayment": 10000, "note": "",

  "subscription_enabled": true,          // менеджер подтвердил подключение
  "subscription_amount": 5000,
  "subscription_period": "month",
  "subscription_start": "2026-08-01"     // дата первого списания
}
```

Если полей нет (старый клиент) — берите абонплату из тарифа, старт = сегодня.

## 5.7. Чек-лист приёмки

- [ ] Продажа с абонентским тарифом создаёт `Subscription` + график платежей.
- [ ] Повторное закрытие того же лида/продажи не создаёт второй график
      (`get_or_create` по `sale+service`).
- [ ] Годовой тариф даёт один платёж в год, а не 12.
- [ ] Просроченный платёж сам переходит в `overdue`.
- [ ] Оплата периода проходит через кассу и меняет статус на `paid`.
- [ ] Карточка клиента и матрица показывают одни и те же суммы.
- [ ] Отмена продажи аннулирует будущие платежи (см. 08).
