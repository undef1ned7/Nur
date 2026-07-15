# Фильтры GET /api/construction/cashflows/

Контракт бэкенда (июль 2026). Используется всеми кассами (общий модуль `construction`).

| Параметр | Значения | Что делает |
|---|---|---|
| `type` / `types` | `income`, `expense` | Приход / расход; CSV: `?types=income,expense` |
| `status` / `statuses` | `pending`, `approved`, `rejected` | `pending` — заявки, ждущие подтверждения |
| `search` | текст | По названию операции и названию категории |
| `amount_min`, `amount_max` | число | Диапазон суммы |
| `cashbox` / `cashboxes` | uuid | Одна касса / несколько через запятую |
| `shift`, `cashier`, `category` | uuid | Были и раньше |
| `date_from`, `date_to` | YYYY-MM-DD | Период по `created_at`, включительно |
| `ordering` | `created_at`, `amount`, `type`, `category_title`, `cashbox_name` (с `-`) | Сортировка |
| `page`, `page_size` | int | Пагинация, `page_size` до 200 |

## Важно

- Неизвестное значение `type`/`status` → **400** с detail («Допустимые значения: income, expense»). Раньше опечатка молча давала пустой список.
- Регистр не важен (`?type=EXPENSE` работает). Пустые значения игнорируются.
- `amount_min=-5` → 400.

## Типовые запросы вкладок кассы (`/crm/kassa/{id}`, KassaWorkerDet)

```
# Расходы:  ?cashbox=<uuid>&type=expense&status=approved
# Приходы:  ?cashbox=<uuid>&type=income&status=approved
# Заявки:   ?cashbox=<uuid>&status=pending          (Pending.jsx)
# Отчёты:   ?cashbox=<uuid>&status=approved&date_from=…&date_to=…&page_size=200
```
