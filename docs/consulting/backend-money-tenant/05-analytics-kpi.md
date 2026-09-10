# 5. Аналитика — KPI денежного контура

**Фронт:** `src/api/consultingAnalytics.js`, `Analytics/Analytics.jsx`.  
**Контракт списков:** [../analytics.md](../analytics.md).

## 5.1. Задача

Разделить метрики, которые раньше смешивались в одну «выручку»:

| KPI | Источник данных | Смысл |
|-----|-----------------|-------|
| `revenue` | `Sale` (`completed`, `pending_confirmation`) | Оформленные продажи за период |
| `net_revenue` | `revenue − cancellations − refunded_amount` | Чистая выручка |
| `cancellations` | `Sale` (`canceled`) + `refunded_amount` | Отмены и возвраты |
| `cancel_rate` | `cancellations / revenue × 100` | Доля отмен |
| `paid_income` | `CashOperation` (income, confirmed) | **Факт** в кассе |
| `pending_cash` | `CashRequest` (`pending`, sum amount) | Ждёт confirm кассира |
| `subscription_mrr` | `SubscriptionPayment` (active, month-equivalent) | Регулярная выручка |

Отмена корректирует **период продажи**, не месяц нажатия кнопки — см.
[02-sale-cancel.md](./02-sale-cancel.md) §8.5.

## 5.2. Dashboard

`GET /consalting/analytics/dashboard/`

Каждый KPI — объект с динамикой:

```jsonc
{
  "kpis": {
    "revenue":              { "current": 62200, "previous": 33244, "diff": 28956, "percent": 87.1 },
    "net_revenue":          { "current": 58000, "previous": 31000, "diff": 27000, "percent": 87.1 },
    "cancellations":        { "current": 4200, "previous": 2244, "diff": 1956, "percent": 87.1 },
    "cancel_rate":          { "current": 6.8, "previous": 6.2, "diff": 0.6, "percent": 9.7 },
    "paid_income":          { "current": 55000, "previous": 28000, "diff": 27000, "percent": 96.4 },
    "pending_cash":         { "current": 315000, "previous": 120000, "diff": 195000, "percent": 162.5 },
    "subscription_mrr":     { "current": 45000, "previous": 42000, "diff": 3000, "percent": 7.1 },
    "sales_count":          {},
    "avg_check":            {}
  }
}
```

`pending_cash` — **не** входит в `paid_income` до confirm.

## 5.3. Чек-лист приёмки

- [ ] `revenue` ≠ `paid_income` при неподтверждённых заявках — это норма.
- [ ] `pending_cash` совпадает с `GET /cashbox/requests/counters/` → `pending_amount`.
- [ ] После confirm `paid_income` растёт, `pending_cash` падает.
- [ ] `net_revenue` уменьшается в месяце **продажи** при отмене, не в месяце отмены.
- [ ] `subscription_mrr` сходится с суммой активных `Subscription.amount` (month).
