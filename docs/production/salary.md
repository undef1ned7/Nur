# Производство — Зарплата: почасовой оклад и сдельная оплата

**Сектор:** Производство. Новая страница `/crm/production/salary` (пункт меню «Зарплата»).
**Статус:** спецификация для бэкенда; фронт-страница будет собрана поверх этого контракта (по схеме `docs/warehouse/salary.md`: фронт готовится параллельно, при 404 показывает заглушку).
**Дата:** 2026-07-14.

---

## 1. Задача (жалоба клиента)

1. **Почасовой оклад:** «сотрудник отработал столько-то часов» — нужен учёт часов и начисление по ставке сом/час.
2. **Сдельная оплата:** начисление за каждую произведённую единицу продукции.

У сотрудника может быть и то и другое одновременно (например, база по часам + сдельно за выработку). Владелец видит всех, фиксирует выплаты; сотрудник видит только своё.

## 2. Модель данных

Все модели мультитенантны (company), деньги — `Decimal(12, 2)`, часы — `Decimal(6, 2)`, количества — `Decimal(12, 3)`.

### 2.1. `ProductionEmployeeRate` — ставки сотрудника

```python
class ProductionEmployeeRate(models.Model):
    company = FK(Company)
    employee = OneToOneField(User, related_name="production_rate")
    hourly_rate = Decimal(10, 2, default=0)      # сом за час
    updated_at = DateTimeField(auto_now=True)
    updated_by = FK(User, null=True)
```

### 2.2. `ProductionPieceRate` — сдельная ставка за товар

```python
class ProductionPieceRate(models.Model):
    company = FK(Company)
    product = FK(Product)          # товар (ГП с рецептом)
    amount_per_unit = Decimal(10, 2)  # сом за 1 единицу
    unique_together = (company, product)
```

Ставка `0` / отсутствие записи = сдельно не начисляется.

### 2.3. `ProductionWorkSession` — смена/часы сотрудника

```python
class ProductionWorkSession(models.Model):
    company = FK(Company)
    employee = FK(User)
    date = DateField()                  # рабочий день
    hours = Decimal(6, 2)               # отработано часов
    comment = CharField(blank=True)
    created_by = FK(User)               # кто внёс (owner/admin)
    unique_together = (company, employee, date)
```

Часы вносит владелец/админ вручную (интеграция со сменами кассы — потом). `0 < hours <= 24`, иначе 400.

### 2.4. `ProductionSalaryAccrual` — начисление

```python
class ProductionSalaryAccrual(models.Model):
    class Kind(TextChoices):
        HOURLY = "hourly"     # за часы
        PIECE = "piece"       # сдельное за производство

    class Status(TextChoices):
        ACCRUED = "accrued"
        PAID = "paid"
        CANCELED = "canceled"

    company = FK(Company)
    employee = FK(User)
    kind = CharField(choices=Kind.choices)
    # для hourly:
    work_session = FK(ProductionWorkSession, null=True)
    hours = Decimal(6, 2, null=True)
    rate = Decimal(10, 2, null=True)          # СНИМОК ставки сом/час
    # для piece:
    production_record = FK(<запись производства>, null=True)  # см. docs/production/production-report.md
    product = FK(Product, null=True)
    quantity = Decimal(12, 3, null=True)
    amount_per_unit = Decimal(10, 2, null=True)  # СНИМОК сдельной ставки
    # общее:
    amount = Decimal(12, 2)                    # hours*rate или quantity*amount_per_unit
    status = CharField(choices=Status.choices, default=ACCRUED)
    payout = FK("ProductionSalaryPayout", null=True, related_name="accruals")
    created_at = DateTimeField(auto_now_add=True)
```

Правила:

- **Ставки — снимок в момент начисления.** Изменение ставки не пересчитывает прошлое.
- `hourly`-начисление создаётся/обновляется автоматически при сохранении `ProductionWorkSession` (upsert по сессии, пока не оплачено).
- `piece`-начисление создаётся автоматически при записи производства (см. `production-report.md`): сотрудник = кто произвёл; если сдельная ставка товара не задана — начисление не создаётся.
- Отмена/удаление производства → связанное начисление `canceled` (если не оплачено; оплаченное не трогать, вернуть 409 при попытке удалить производство).
- Оплаченные начисления неизменяемы.

### 2.5. `ProductionSalaryPayout` — выплата

```python
class ProductionSalaryPayout(models.Model):
    company = FK(Company)
    employee = FK(User)
    amount = Decimal(12, 2)
    cashbox = FK(Cashbox)          # выплата создаёт расход кассы
    comment = CharField(blank=True)
    created_by = FK(User)
    created_at = DateTimeField(auto_now_add=True)
```

При создании выплаты: закрывает начисления `accrued` (FIFO по дате) на сумму выплаты, помечая их `paid`; создаёт **одну** расходную операцию кассы «Зарплата: <сотрудник>». Эта операция — «прочий расход» для аналитики (см. `analytics-other-expenses.md`). Выплата больше суммы `accrued` — HTTP 400.

## 3. API

Базовый префикс: `/main/production/salary/`.

| Метод и путь | Описание |
|---|---|
| `GET /rates/` | Ставки всех сотрудников: `[{employee, employee_name, hourly_rate}]` |
| `PUT /rates/{employee_id}/` | Установить `hourly_rate` |
| `GET /piece-rates/` | Сдельные ставки по товарам: `[{product, product_name, amount_per_unit}]` |
| `PUT /piece-rates/{product_id}/` | Установить `amount_per_unit` |
| `GET /work-sessions/?employee=&date_from=&date_to=` | Табель часов |
| `POST /work-sessions/` | `{employee, date, hours, comment}` (upsert по сотруднику+дате) |
| `DELETE /work-sessions/{id}/` | Удалить (если начисление не оплачено) |
| `GET /accruals/?employee=&kind=&status=&date_from=&date_to=` | Начисления, с `summary: {accrued_total, paid_total}` по фильтру |
| `GET /summary/?date_from=&date_to=` | Сводка по сотрудникам: `[{employee, employee_name, hours_total, hourly_amount, piece_quantity, piece_amount, total, accrued, paid}]` |
| `POST /payouts/` | `{employee, amount, cashbox, comment}` |
| `GET /payouts/?employee=&date_from=&date_to=` | История выплат |

Общие правила: DRF-пагинация как в остальных API; суммы Decimal-строками; даты — местное время компании (правила `docs/market/analytics.md`); owner/admin видят всех, обычный сотрудник — только свои `work-sessions`, `accruals`, `payouts` (403 на чужие и на изменение ставок).

## 4. Чек-лист приёмки

Ставки: Айбек — 100 сом/час; товар «Хлеб» — 5 сом/шт; товар «Батон» — без ставки.

| # | Действие | Ожидание |
|---|---|---|
| 1 | Внести табель: Айбек, 10 часов | начисление `hourly` 1000 сом, статус `accrued` |
| 2 | Исправить табель на 8 часов | то же начисление стало 800 (не оплачено — можно) |
| 3 | Производство: Айбек произвёл 200 шт «Хлеб» | начисление `piece` 1000 сом |
| 4 | Производство: 50 шт «Батон» | начислений нет (ставка не задана) |
| 5 | Поднять ставку «Хлеба» до 6 сом | старое начисление осталось 1000 (снимок) |
| 6 | `GET /summary/` за период | Айбек: hours=8, hourly=800, piece=1000, total=1800, accrued=1800, paid=0 |
| 7 | Выплата 1800 через кассу К1 | оба начисления `paid`; в кассе один расход 1800 «Зарплата: Айбек» |
| 8 | Выплата ещё 100 | HTTP 400 (нечего выплачивать) |
| 9 | Сотрудник запрашивает чужие начисления | HTTP 403 |
| 10 | Расход «Зарплата: Айбек» в аналитике | попадает в `other_expenses_total` |
