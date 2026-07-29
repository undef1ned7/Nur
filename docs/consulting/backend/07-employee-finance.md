# 7. Финансы сотрудника: продажи и оприходование денег

**Фронт:** `Teachers/EmployeeCard.jsx` → вкладки «Финансы», «Продажи», «Долги
клиентов»; API-слой `src/api/consultingEmployees.js`, `consultingCashbox.js`.

## 7.1. Задача

В кассе есть приход и расход, но **без привязки к сотруднику**: нет ни колонки
«кто внёс», ни разреза по людям. Наличные живут «на доверии», расхождения
вскрываются в конце месяца, при увольнении невозможно свести расчёты.

Нужно: история продаж сотрудника, сколько наличных он принял, сколько сдал,
сколько осталось на руках (подотчёт) и механизм сдачи с подтверждением.

## 7.2. Изменения модели

```python
class CashOperation(models.Model):
    # --- НОВЫЕ ПОЛЯ ---
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL,
                             related_name="cash_operations", db_index=True)
    # ЧЬИ это деньги: автор продажи / сотрудник, сдавший наличные.
    confirmed_by = models.ForeignKey(User, null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name="+")
    # кто провёл операцию в кассе (кассир)
    kind = models.CharField(max_length=16, blank=True)   # sale|handover|refund|subscription
```

Миграция для существующих записей: `user` = автор связанной продажи, если её
можно определить, иначе `NULL`.

Модель `CashRequest` (заявка на подтверждение) описана в
[09-cash-confirmation.md](./09-cash-confirmation.md) — сдача наличных использует
её же с `kind="handover"`.

## 7.3. Расчёт «на руках»

```python
def employee_finance(user, date_from, date_to):
    sales = Sale.objects.filter(user=user, created_at__date__range=(date_from, date_to))
    completed = sales.exclude(status="canceled")

    cash_received = completed.filter(payment_method="cash").aggregate(
        s=Sum("total"))["s"] or 0
    transfer_received = completed.exclude(payment_method="cash").aggregate(
        s=Sum("total"))["s"] or 0

    handed = CashOperation.objects.filter(
        user=user, kind="handover", created_at__date__range=(date_from, date_to)
    ).aggregate(s=Sum("amount"))["s"] or 0

    pending = CashRequest.objects.filter(
        user=user, kind="handover", status="pending"
    ).aggregate(s=Sum("amount"))["s"] or 0

    return {
        "sold": completed.aggregate(s=Sum("total"))["s"] or 0,
        "cash_received": cash_received,
        "transfer_received": transfer_received,
        "handed_over": handed,
        "on_hands": cash_received - handed - pending,
        "pending_handover": pending,
        "overdue_amount": overdue_on_hands(user),   # на руках дольше суток
        "debts": client_debts_summary(user),
    }
```

Важные оговорки:

- **`on_hands` считается нарастающим итогом**, а не за период: деньги, принятые
  в июне и не сданные, обязаны оставаться на руках в июле. Для карточки
  отдавайте `on_hands` за всё время, остальные показатели — за период. Это
  сознательное отступление от «всё за период»: подотчёт не обнуляется сменой
  месяца.
- Отменённые продажи из `cash_received` исключаются; если деньги уже были
  приняты и возвращены клиенту — возврат уменьшает `on_hands` через расходную
  операцию.
- `overdue_amount` — сумма, лежащая на руках дольше `CashConfirmationSettings.
  overdue_hours` (по умолчанию сутки).

## 7.4. Эндпоинты

```
GET /consalting/employees/{id}/finance/?date_from=&date_to=
GET /consalting/employees/{id}/sales/?date_from=&date_to=&status=&search=&page=&page_size=
GET /consalting/employees/{id}/handovers/?status=&date_from=&date_to=&page=
GET /consalting/employees/{id}/debts/?overdue=true&search=&page=
POST /consalting/cashbox/handovers/   { "amount": 12000, "comment": "", "cashbox": null }
GET /consalting/cashbox/reconciliation/?date_from=&date_to=&user=&page=
```

### Финансовая сводка

```jsonc
{
  "sold": 450000,
  "cash_received": 180000,
  "transfer_received": 270000,
  "handed_over": 150000,
  "on_hands": 30000,
  "pending_handover": 0,
  "overdue_amount": 0,
  "debts": { "total": 85000, "overdue": 20000 }
}
```

### Продажи сотрудника

```jsonc
{ "count": 42, "results": [
  { "id": "…", "created_at": "2026-07-12T…", "client_display": "Иванов Иван",
    "service_display": "Внедрение CRM", "tariff_display": "Стандарт",
    "total": 45000, "payment_mode": "cash", "payment_display": "Наличные",
    "status": "completed", "status_display": "Проведена",
    "accrual_amount": 4500 }        // сколько начислено ЕМУ по этой продаже
] }
```

`accrual_amount` — сумма `SalaryAccrual` по этой продаже для этого пользователя
(percent + fixed). Возвраты показывайте отдельной строкой со знаком минус или
полем `refunded_amount` — фронт учитывает `status`.

### Долги клиентов, оформленные сотрудником

```jsonc
{ "count": 5, "results": [
  { "id": "…", "client_display": "ОсОО «Ромашка»", "service_display": "Сопровождение",
    "total": 30000, "remaining": 20000, "next_payment_date": "2026-08-05",
    "is_overdue": false }
] }
```

Источник — графики рассрочки/долга (`Installment`) по продажам, где
`sale.user = сотрудник`.

### Сдача наличных

`POST /consalting/cashbox/handovers/` создаёт `CashRequest(kind="handover",
direction="income", user=request.user, status="pending")`.

Валидация: `0 < amount <= on_hands`. Иначе `400` «Сумма больше, чем числится на
руках». Подтверждает ответственный за кассу — только тогда создаётся
`CashOperation` и растёт `handed_over`.

### История сдачи

```jsonc
{ "count": 12, "results": [
  { "id": "…", "created_at": "2026-07-20T18:10:00+06:00", "amount": 50000,
    "status": "confirmed", "status_display": "Подтверждено",
    "confirmed_by_display": "Кассир Б", "comment": "выручка за день" }
] }
```

### Сверка по сотрудникам

```
GET /consalting/cashbox/reconciliation/?date_from=&date_to=
```

```jsonc
{ "count": 6, "results": [
  { "user": "uuid", "user_display": "Менеджер А",
    "sold": 450000, "cash_received": 180000, "handed_over": 150000,
    "on_hands": 30000, "discrepancy": 0 }
] }
```

`discrepancy` = `cash_received - handed_over - on_hands`. В норме ноль; ненулевое
значение означает ошибку учёта (например, операция без `user`) — фронт
подсвечивает такую строку.

## 7.5. Удержание недостачи

Кнопка «удержать из зарплаты» создаёт
`SalaryAdjustment(kind="deduction", reason="shortage")` на сумму остатка
(см. [02-salary.md](./02-salary.md)). Только `owner`/`admin`.

## 7.6. Права

- Сотрудник видит **только свои** финансы: `GET /employees/{id}/finance/` при
  `id != self` → `403`.
- Руководитель видит всех, подтверждает внесения, делает удержания.
- Суммы зарплаты других сотрудников рядовому сотруднику не отдаются ни в одном
  ответе.

## 7.7. Чек-лист приёмки

- [ ] У каждой кассовой операции проставлен `user`.
- [ ] Оплата наличными автоматически увеличивает «на руках» без ручного ввода.
- [ ] Сдача создаёт заявку; до подтверждения `handed_over` не растёт, сумма
      висит в `pending_handover`.
- [ ] `on_hands` не обнуляется при смене месяца.
- [ ] Отменённая продажа уменьшает `cash_received` и «на руках».
- [ ] Сверка по сотрудникам сходится: `discrepancy = 0` на чистых данных.
- [ ] Сотрудник не может открыть чужую карточку финансов.
