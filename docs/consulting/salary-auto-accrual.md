# Консалтинг — Зарплата: авто-начисление % с продаж

**Страница:** `/crm/consulting/salary` (фронт:
`src/Components/Sectors/Consulting/salary/salary.jsx`, API-слой
`src/api/consultingSalary.js`).
**Статус:** ⚠️ Бэкенд не реализован. Фронт готов (3 вкладки: Начисления, Ставки,
Выплаты) и показывает заглушку при `404/501`.

Модель повторяет [docs/services/salary.md](../services/salary.md) («Услуги:
Зарплата мастеров»), адаптирована под консалтинг: **зарабатывает продавец**
(владелец лида / автор продажи), **основание** — закрытая продажа/выигранный лид,
**ставка** задаётся на услугу.

## 1. Что было не так

Старый экран — ручное начисление (сотрудник + сумма + `percent` как **строка**).
Нет связи с продажами, нет ставок, нет выплат, процент не валидируется как число.
Заменяем на авто-начисление.

## 2. Модель данных

```python
class ServiceSalaryRate(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    service = models.OneToOneField(Service, on_delete=models.CASCADE,
                                   related_name="consulting_salary_rate")
    percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # 0..100
    updated_at = models.DateTimeField(auto_now=True)

class SalaryAccrual(models.Model):
    class Status(models.TextChoices):
        ACCRUED = "accrued"; PAID = "paid"; CANCELED = "canceled"
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)            # продавец
    service = models.ForeignKey(Service, on_delete=models.PROTECT)
    sale = models.ForeignKey("Sale", null=True, on_delete=models.CASCADE)  # основание (или lead)
    lead = models.ForeignKey("Lead", null=True, on_delete=models.SET_NULL)
    base_amount = models.DecimalField(max_digits=12, decimal_places=2)  # сумма сделки (с учётом роли)
    percent = models.DecimalField(max_digits=5, decimal_places=2)       # СНИМОК ставки
    amount = models.DecimalField(max_digits=12, decimal_places=2)       # base_amount * percent / 100
    status = models.CharField(max_length=16, default="accrued")
    payout = models.ForeignKey("SalaryPayout", null=True, on_delete=models.SET_NULL,
                               related_name="accruals")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(
            fields=["sale"], condition=~models.Q(status="canceled"),
            name="uniq_accrual_per_sale")]   # одна продажа = одно начисление

class SalaryPayout(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    comment = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

## 3. Когда начислять

При закрытии продажи (`POST /consalting/sales/`) или выигрыше лида (`win` /
завершающая стадия — см. [funnel-crm-logic.md](./funnel-crm-logic.md)):

1. Определить услугу сделки и её ставку (`ServiceSalaryRate.percent`, по
   умолчанию 0 → начисление не создаётся).
2. `base_amount` = сумма сделки (с учётом роли продавца, **без установки**).
3. `amount = round(base_amount * percent / 100, 2)`; `percent` — снимок.
4. `user` = продавец (автор продажи / владелец лида).
5. Идемпотентно: одна продажа → одно начисление (constraint). Отмена/возврат
   продажи → `status="canceled"`.

## 4. Эндпоинты

| Метод | URL | Назначение |
|---|---|---|
| `GET` | `/consalting/salary/rates/` | ставки услуг; `search`, `page` (owner/admin) |
| `PUT` | `/consalting/salary/rates/{service_id}/` | `{ percent }` (upsert; 0..100) |
| `GET` | `/consalting/salary/accruals/` | начисления; `date_from,date_to,user,service,status,search,page`; сотрудник — только свои |
| `GET` | `/consalting/salary/summary/` | сводка за период (см. ниже) |
| `GET` | `/consalting/salary/payouts/` | выплаты; сотрудник — только свои |
| `POST`| `/consalting/salary/payouts/` | `{ user, amount, comment? }` — закрывает `accrued` FIFO |

### Формат ответов

```jsonc
// GET /rates/  → { results: [...] }
{ "service": "svc-uuid", "service_name": "Внедрение CRM", "price": 50000, "percent": "10.00", "updated_at": "…" }

// GET /accruals/ → { results, count }
{ "id": "…", "user": "…", "user_display": "Менеджер А",
  "service_name": "Внедрение CRM", "base_amount": 45000, "percent": "10.00",
  "amount": 4500, "status": "accrued", "created_at": "…" }

// GET /summary/
{ "totals": { "accrued": 45000, "paid": 30000, "remaining": 15000 },
  "by_user": [ { "user": "…", "name": "Менеджер А", "accrued": 45000, "paid": 30000, "remaining": 15000 } ] }
```

### Выплата (FIFO)

`POST /payouts/ { user, amount }` берёт начисления пользователя со статусом
`accrued` от старых к новым и закрывает (`status="paid"`, `payout=…`) на сумму
выплаты. Если выплата больше суммы `accrued` — `400`. Частичное закрытие
последнего начисления — по вашему решению (проще: не дробить, выплата ≤ суммы
целых начислений).

## 5. Права

- Вкладка «Ставки» и создание выплат — только owner/admin (фронт скрывает).
- Сотрудник видит только свои начисления/выплаты.
