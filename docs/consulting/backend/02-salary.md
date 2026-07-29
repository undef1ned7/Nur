# 2. Зарплата: схемы оплаты, премии, штрафы, расчётный лист

**Фронт:** `salary/salary.jsx` (вкладки), `SalarySchemes.jsx`,
`SalaryBonusRules.jsx`, `SalaryAdjustments.jsx`, `SalaryPayslip.jsx`,
API-слой `src/api/consultingSalary.js`.
**Предыдущая версия спецификации:** [../salary-auto-accrual.md](../salary-auto-accrual.md)
(только процент с услуги) — расширяется, не отменяется.

## 2.1. Задача

Сейчас работает одна схема: процент с услуги, одинаковый для всех. Нужны:
оклад, процент, фикс за сделку, любые комбинации, премии по правилам, штрафы и
расчётный лист.

## 2.2. Модели

```python
class SalaryScheme(models.Model):
    """Схема оплаты конкретного сотрудника. Части складываются."""
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="salary_scheme")

    base_salary_enabled = models.BooleanField(default=False)
    base_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    base_salary_period = models.CharField(max_length=8, default="month")  # month|week|quarter

    percent_enabled = models.BooleanField(default=False)
    percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    fixed_enabled = models.BooleanField(default=False)
    fixed_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    updated_at = models.DateTimeField(auto_now=True)


class SalarySchemeServiceOverride(models.Model):
    """Особая ставка сотрудника по конкретной услуге."""
    scheme = models.ForeignKey(SalaryScheme, on_delete=models.CASCADE,
                              related_name="service_overrides")
    service = models.ForeignKey(Service, on_delete=models.CASCADE)
    percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    fixed_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["scheme", "service"],
                                               name="uniq_scheme_service")]


class SalaryDefaults(models.Model):
    """Ставки компании по умолчанию — нижний уровень приоритета."""
    company = models.OneToOneField(Company, on_delete=models.CASCADE,
                                   related_name="salary_defaults")
    percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    fixed_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    base_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    base_salary_period = models.CharField(max_length=8, default="month")


class ServiceSalaryRate(models.Model):
    """Ставка на уровне услуги (средний приоритет). Уже существует — добавить fixed_amount."""
    service = models.OneToOneField(Service, on_delete=models.CASCADE,
                                   related_name="consulting_salary_rate")
    percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    fixed_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)   # НОВОЕ


class BonusRule(models.Model):
    class Condition(models.TextChoices):
        SERVICE_COUNT = "service_count", "За количество продаж услуги"
        REVENUE_AMOUNT = "revenue_amount", "За объём выручки"
        DEALS_COUNT = "deals_count", "За количество сделок"
        REVENUE_LADDER = "revenue_ladder", "Прогрессивная шкала"

    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    condition = models.CharField(max_length=24, choices=Condition.choices)
    service = models.ForeignKey(Service, null=True, blank=True, on_delete=models.CASCADE)
    threshold = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    reward_type = models.CharField(max_length=8, default="fixed")   # fixed | percent
    reward_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    period = models.CharField(max_length=8, default="month")        # week | month | quarter
    applies_to = models.CharField(max_length=8, default="all")      # all | role | user
    role = models.ForeignKey(Role, null=True, blank=True, on_delete=models.CASCADE)
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE)

    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)


class BonusTier(models.Model):
    """Ступень прогрессивной шкалы."""
    rule = models.ForeignKey(BonusRule, on_delete=models.CASCADE, related_name="tiers")
    from_amount = models.DecimalField(max_digits=12, decimal_places=2)
    to_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    percent = models.DecimalField(max_digits=5, decimal_places=2)


class SalaryAdjustment(models.Model):
    """Ручные штрафы, разовые премии и удержания."""
    class Kind(models.TextChoices):
        FINE = "fine", "Штраф"
        MANUAL_BONUS = "manual_bonus", "Премия"
        DEDUCTION = "deduction", "Удержание"

    class Reason(models.TextChoices):
        LATE = "late", "Опоздание"
        CLIENT_COMPLAINT = "client_complaint", "Жалоба клиента"
        LOST_LEAD = "lost_lead", "Потеря лида"
        RULES_VIOLATION = "rules_violation", "Нарушение регламента"
        SHORTAGE = "shortage", "Недостача по подотчёту"
        SALE_CANCELED = "sale_canceled", "Отмена продажи"
        BONUS = "bonus", "Премия"
        OTHER = "other", "Другое"

    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    kind = models.CharField(max_length=16, choices=Kind.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.CharField(max_length=32, choices=Reason.choices)
    comment = models.TextField(blank=True)
    date = models.DateField(db_index=True)
    status = models.CharField(max_length=16, default="active")   # active | canceled
    source_sale = models.ForeignKey("Sale", null=True, blank=True, on_delete=models.SET_NULL)
    created_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL,
                                   related_name="created_adjustments")
    created_at = models.DateTimeField(auto_now_add=True)
```

`SalaryAccrual` дополняется полем `kind` (`salary|percent|fixed|bonus|
manual_bonus|fine|deduction`) и `rule = FK(BonusRule, null=True)` — чтобы
расчётный лист строился одним запросом.

## 2.3. Приоритет ставок

```python
def resolve_rate(user, service):
    """Чем конкретнее настройка, тем выше приоритет."""
    scheme = getattr(user, "salary_scheme", None)
    if scheme:
        override = scheme.service_overrides.filter(service=service).first()
        if override:
            return override.percent, override.fixed_amount
        if scheme.percent_enabled or scheme.fixed_enabled:
            return (scheme.percent if scheme.percent_enabled else 0,
                    scheme.fixed_amount if scheme.fixed_enabled else 0)
    rate = getattr(service, "consulting_salary_rate", None)
    if rate and (rate.percent or rate.fixed_amount):
        return rate.percent, rate.fixed_amount
    d = user.company.salary_defaults
    return d.percent, d.fixed_amount
```

Порядок: **сотрудник+услуга → сотрудник → услуга → компания**.

## 2.4. Начисление при закрытии сделки

Внутри `create_sale_side_effects` (см. 05), после создания продажи:

```python
percent, fixed = resolve_rate(sale.user, sale.service)
base = sale.total                       # с учётом цены роли, без установки
if percent:
    SalaryAccrual.objects.create(
        company=sale.company, user=sale.user, service=sale.service, sale=sale,
        kind="percent", base_amount=base,
        percent=percent,                                   # СНИМОК ставки
        amount=(base * percent / 100).quantize(Decimal("0.01")),
        status="accrued",
    )
if fixed:
    SalaryAccrual.objects.create(..., kind="fixed", amount=fixed, percent=0)
```

**Снимок обязателен**: изменение схемы завтра не должно переписывать зарплату за
прошлый месяц. Идемпотентность — `UniqueConstraint(fields=["sale", "kind"],
condition=~Q(status="canceled"))`.

Отмена/возврат продажи → см. [08-sale-cancel.md](./08-sale-cancel.md) §8.4 п.3.

## 2.5. Оклад

Ежемесячная задача в первый день месяца (или в конце периода):

```python
for scheme in SalaryScheme.objects.filter(base_salary_enabled=True, base_salary__gt=0):
    SalaryAccrual.objects.get_or_create(
        user=scheme.user, kind="salary", period_month=prev_month,   # ключ идемпотентности
        defaults=dict(company=scheme.company, amount=scheme.base_salary, status="accrued"),
    )
```

Если сотрудник отработал неполный месяц — по решению компании: либо полная
сумма, либо пропорционально дням (заложите поле `worked_days` на будущее, но по
умолчанию начисляйте полностью).

## 2.6. Премии

Считаются по закрытию периода (задача) **и** пересчитываются на лету для
прогресс-бара:

```python
def eval_bonus(rule, user, period_from, period_to):
    sales = Sale.objects.filter(
        user=user, created_at__date__range=(period_from, period_to),
    ).exclude(status__in=["canceled"])            # отменённые не считаются

    if rule.condition == "service_count":
        value = sales.filter(service=rule.service).count()
    elif rule.condition == "deals_count":
        value = sales.count()
    else:  # revenue_amount / revenue_ladder
        value = sales.aggregate(s=Sum("total") - Sum("refunded_amount"))["s"] or 0

    if rule.condition == "revenue_ladder":
        tier = rule.tiers.filter(from_amount__lte=value).order_by("-from_amount").first()
        if not tier:
            return None
        return value * tier.percent / 100          # процент по достигнутой ступени

    if value < rule.threshold:
        return None
    return (rule.reward_value if rule.reward_type == "fixed"
            else value * rule.reward_value / 100)
```

- Прогрессивная шкала **не суммируется** со ступенями ниже: берётся процент
  достигнутой ступени на весь объём (простая, понятная менеджеру модель).
- Начисление премии — `SalaryAccrual(kind="bonus", rule=rule)`, идемпотентность
  по `(user, rule, period_month)`.
- Правило применяется, если `applies_to` совпадает и период попадает в
  `valid_from..valid_to`.

### Прогресс к премии

```
GET /consalting/salary/bonus-progress/?user=&date_from=&date_to=
```

```jsonc
{ "results": [
  { "rule": "uuid", "name": "План 300 тыс.", "current": 255000, "target": 300000,
    "left": 45000, "unit": "money", "reward": 15000, "achieved": false }
] }
```

## 2.7. Эндпоинты

| Метод | URL | Назначение |
|---|---|---|
| `GET` | `/consalting/salary/schemes/` | список сотрудников со схемами; `search`, `is_active`, `page` |
| `GET`/`PUT` | `/consalting/salary/schemes/{user_id}/` | схема сотрудника (upsert) |
| `GET`/`PUT` | `/consalting/salary/defaults/` | ставки компании |
| `GET` | `/consalting/salary/rates/` | ставки услуг; `search`, `page` |
| `PUT` | `/consalting/salary/rates/{service_id}/` | `{percent, fixed_amount}` |
| `GET`/`POST` | `/consalting/salary/bonus-rules/` | правила премий |
| `PATCH`/`DELETE` | `/consalting/salary/bonus-rules/{id}/` | правка / удаление |
| `GET` | `/consalting/salary/bonus-progress/` | прогресс к премиям |
| `GET`/`POST` | `/consalting/salary/adjustments/` | штрафы и разовые премии |
| `POST` | `/consalting/salary/adjustments/{id}/cancel/` | отмена корректировки |
| `GET` | `/consalting/salary/accruals/` | начисления; + фильтр `kind` |
| `GET` | `/consalting/salary/summary/` | сводка за период |
| `GET` | `/consalting/salary/payslip/` | расчётный лист |
| `GET`/`POST` | `/consalting/salary/payouts/` | выплаты (FIFO по `accrued`) |

### Схема сотрудника (`PUT /schemes/{user_id}/`)

```jsonc
{
  "base_salary_enabled": true, "base_salary": 40000, "base_salary_period": "month",
  "percent_enabled": true, "percent": 10,
  "fixed_enabled": false, "fixed_amount": 0,
  "service_overrides": [ { "service": "svc-uuid", "percent": 12, "fixed_amount": 0 } ]
}
```

`service_overrides` заменяется целиком (фронт шлёт полный список). Валидация:
`0 <= percent <= 100`, нет дублей услуг, услуга принадлежит компании.

### Расчётный лист

```
GET /consalting/salary/payslip/?user=<uuid>&month=YYYY-MM
```

```jsonc
{
  "user": "uuid", "user_display": "Менеджер А", "period": "2026-07",
  "lines": [
    { "kind": "salary",       "label": "Оклад",                       "amount": 40000, "count": 0 },
    { "kind": "percent",      "label": "Процент со сделок",           "amount": 38500, "count": 12 },
    { "kind": "fixed",        "label": "Фикс за сделки",              "amount": 6000,  "count": 12 },
    { "kind": "bonus",        "label": "Премия: план 300 тыс.",       "amount": 15000, "count": 1 },
    { "kind": "fine",         "label": "Штрафы",                      "amount": 1000,  "count": 1 },
    { "kind": "deduction",    "label": "Удержания (отмены продаж)",   "amount": 0,     "count": 0 }
  ],
  "accrued": 98500,     // сумма положительных минус отрицательных
  "paid": 50000,
  "to_pay": 48500
}
```

`fine` и `deduction` приходят **положительными числами** — фронт сам рисует
минус (см. `NEGATIVE_KINDS`). `accrued` уже учитывает вычеты.

## 2.8. Права

- Схемы, ставки, правила премий, создание штрафов и выплат — `owner`/`admin`.
- Сотрудник видит **только свой** расчётный лист, свои начисления, свои штрафы;
  параметр `user` для него игнорируется.
- Отменить штраф может только `owner`/`admin`; запись остаётся со
  `status="canceled"`.

## 2.9. Чек-лист приёмки

- [ ] Ставка выбирается по приоритету сотрудник+услуга → сотрудник → услуга →
      компания.
- [ ] Изменение схемы не меняет прошлые начисления (снимок `percent`).
- [ ] Одна продажа даёт не больше одного начисления каждого вида.
- [ ] Отмена продажи отменяет начисление, а при выплаченном — создаёт
      удержание.
- [ ] Прогрессивная шкала берёт процент достигнутой ступени.
- [ ] Отменённые продажи не учитываются в условиях премий.
- [ ] Расчётный лист сходится: `accrued - paid = to_pay`.
- [ ] Сотрудник не видит чужие суммы ни в одном эндпоинте.
