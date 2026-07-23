# Консалтинг — Аналитика: детализация по услугам + CRM-метрики

**Страница:** `/crm/consulting/analytics` (фронт:
`src/Components/Sectors/Consulting/Analytics/Analytics.jsx`).
**Статус:** фронт считает всё на клиенте из уже существующих списков
(`/consalting/sales/`, `/consalting/requests/`, `/consalting/services/`,
`/main/clients/`). Серверный агрегирующий эндпоинт **желателен**, но не
обязателен. Ниже — что фронт уже показывает и что нужно от бэка для точности.

## 1. Что добавлено на фронте

1. **Детализация по каждой услуге отдельно** — таблица «Детализация по услугам»:
   на каждую услугу строка с `продаж`, `клиентов`, `выручка`, `средний чек`,
   `доля выручки`; строка разворачивается в **разбивку по тарифам**.
2. **CRM-метрики** (KPI-полоса):
   - Уникальных клиентов и **повторных** клиентов (доля, %);
   - **Абонентка (MRR)** — оценка регулярной выручки в месяц;
   - Конверсия заявок в продажи;
   - Количество разных услуг, проданных за период.

Всё уважает уже существующие фильтры: период, сотрудники, услуги.

## 2. Поля, которые фронт использует из `/consalting/sales/`

Чтобы детализация была точной, каждая продажа в списке должна содержать:

| Поле | Назначение |
|---|---|
| `created_at` | попадание в период |
| `service_display` | группировка по услуге |
| `tariff_display` | разбивка по тарифам внутри услуги |
| `total` (fallback `service_price`) | сумма выручки |
| `client` (uuid) или `client_display` | подсчёт уникальных/повторных клиентов |
| `user_display` | ТОП сотрудников |

**MRR** фронт оценивает, сопоставляя `service_display`+`tariff_display` продажи с
`subscription_amount`/`subscription_period` из справочника услуг. Это оценка.
Точный MRR лучше отдавать с бэка (см. §3).

## 3. (Опционально) Серверный эндпоинт агрегатов

Если появится нагрузка/потребность в точности — реализовать:

```
GET /consalting/analytics/?period_start=…&period_end=…&user=…&service=…
```

`period_start/period_end` — как в [docs/market/analytics.md](../market/analytics.md)
(ISO local, включительные границы). Ответ:

```jsonc
{
  "kpis": {
    "revenue": 0, "sales_count": 0, "requests_count": 0, "avg_check": 0,
    "unique_clients": 0, "repeat_clients": 0, "subscription_mrr": 0
  },
  "by_service": [
    { "service_id": "…", "service_name": "Внедрение CRM",
      "count": 12, "revenue": 540000, "avg_check": 45000,
      "clients": 9, "share": 42,
      "tariffs": [
        { "tariff_name": "Стандарт", "count": 7, "revenue": 210000 },
        { "tariff_name": "Про",      "count": 5, "revenue": 330000 }
      ] }
  ],
  "by_employee": [ { "user_id": "…", "name": "…", "count": 0, "revenue": 0 } ],
  "requests_by_status": { "new": 0, "in_work": 0, "done": 0, "canceled": 0 }
}
```

Требования к MRR: суммировать `subscription_amount` активных абонентских
тарифов клиентов; годовые приводить к месяцу (`amount/12`). Учитывать только
активные (не расторгнутые) абонентки.
