# Маркет — Аналитика: спецификация фильтрации по периоду (дата + время)

**Страница:** `/crm/market/analytics` (фронт: `src/Components/Sectors/Market/Analytics/Analytics.jsx`)
**Эндпоинт:** `GET /main/analytics/market/`
**Статус:** ⚠️ Требуются правки на бэкенде — фильтрация по времени не работает, по дате работает неточно.

---

## 1. Проблема

Фронт даёт пользователю выбрать период **с точностью до минуты** (`datetime-local`) и отправляет в API:

```
GET /main/analytics/market/?tab=sales&period_start=2026-07-09T09:30:00&period_end=2026-07-09T18:00:59
```

Сейчас наблюдается:

1. **Время игнорируется.** При периоде `09.07 09:30 — 09.07 18:00` в выручку/транзакции попадают продажи, сделанные в 08:00 и в 20:00 того же дня. Ожидание: только продажи в интервале `09:30:00 — 18:00:59` включительно.
2. **По дате есть смещение.** Продажи возле границ суток (рано утром / поздно вечером) попадают не в тот день. Типичная причина — интерпретация периода в UTC вместо местного времени компании (Бишкек, UTC+6): продажа в `09.07 23:30` местного = `09.07 17:30 UTC`, а продажа в `10.07 02:00` местного = `09.07 20:00 UTC` и ошибочно засчитывается за 09.07. Вторая типичная причина — сравнение `created_at::date <= period_end` при том, что `period_end` парсится как `00:00:00`, из-за чего последний день периода выпадает целиком или наоборот захватывается лишний.

## 2. Требуемое поведение (обязательные правила)

1. `period_start` и `period_end` приходят в формате **ISO `YYYY-MM-DDTHH:MM:SS` без таймзоны** и означают **местное время компании (Asia/Bishkek, UTC+6)**. Никаких конвертаций «как будто это UTC».
   - Бэкенд обязан принимать и старый формат `YYYY-MM-DD` (дата без времени): в этом случае `period_start` = `00:00:00`, `period_end` = `23:59:59` этого дня. Это нужно для обратной совместимости с другими экранами.
2. Границы **включительные**: `period_start <= t <= period_end`.
3. Фильтр по времени применяется **везде единообразно**: к карточкам (`cards`), графикам (`charts`) и таблицам (`tables`) одной вкладки. Недопустимо, чтобы карточка «Выручка» считалась за полный день, а график — за интервал.
4. Все агрегации по дням/часам/дням недели (`sales_dynamics`, `sales_by_hours`, `transactions_by_weekday`, `peak_hours`) группируются по **местному** времени компании, не по UTC.
5. Если запись не имеет времени (только дата) — считать её `00:00:00` местного времени.
6. При невалидном значении периода возвращать `400` с текстом в `detail`, а не молча игнорировать параметр.

### По какому полю фильтровать каждую сущность

| Сущность | Поле времени |
|---|---|
| Продажа (POS-чек) | момент оплаты/создания чека (`paid_at`, fallback `created_at`) |
| Строка продажи (для top_products, COGS) | время родительского чека |
| Закупка / приход | дата-время документа закупки |
| Смена | пересечение смены с периодом: `opened_at <= period_end AND (closed_at >= period_start OR closed_at IS NULL)` |
| Операция ДДС (finance) | дата-время операции |
| Зарплаты (tab=salary) | период начисления/выплаты |
| Склад (tab=stock) | остатки — **на текущий момент**, но `movement` (движение) — за период |

## 3. Параметры запроса

### Общие (все вкладки)

| Параметр | Тип | Описание |
|---|---|---|
| `tab` | string | `sales \| stock \| purchases \| cashboxes \| shifts \| products \| suppliers \| users \| finance \| salary` |
| `period_start` | datetime | Начало периода, `YYYY-MM-DDTHH:MM:SS`, местное время, включительно |
| `period_end` | datetime | Конец периода, `YYYY-MM-DDTHH:MM:SS`, местное время, включительно |
| `branch` | uuid | Фильтр по филиалу (передаётся только owner/admin) |
| `include_global` | `"1"` | Вместе с `branch`: включить также «общие» (не привязанные к филиалу) записи |
| `limit` | int | Ограничение размеров таблиц |

### Дополнительные по вкладкам

| Вкладки | Параметры |
|---|---|
| `sales`, `cashboxes`, `suppliers`, `purchases` | `cashbox` (uuid), `shift` (uuid), `cashier` (uuid), `payment_method` (`cash`/`transfer`), `min_total`, `max_total` |
| `suppliers`, `purchases` | дополнительно `purchase_date_from`, `purchase_date_to` (формат `YYYY-MM-DD`) |
| `stock` | `product`, `category`, `kind`, `low_only=1` |
| `shifts` | `status`, `cashbox`, `cashier` |

Маппинг вкладок фронта на API: `warehouse → stock`, `cashiers → cashboxes`, остальные 1:1. Для вкладки «Финансы» фронт делает **два** запроса: `tab=finance` и `tab=salary` (из ответа salary читается только `rows`).

## 4. Структура ответа (что читает фронт)

Общий вид: `{ cards: {...}, charts: {...}, tables: {...} }`. Ниже — ключи, которые реально использует фронт. **Все значения должны считаться внутри `period_start..period_end` с учётом времени** (кроме мгновенных остатков склада).

### tab=sales
- `cards`: `revenue`, `transactions`, `avg_check`, `clients`, а также для модалки «Выручка»: `cogs`, `gross_profit`, `margin_percent`, `cogs_warning`
- `charts`: `sales_dynamics[{date, value}]`, `payment_methods[{method, total|count}]`
- `tables`: `top_products[{name, sold, revenue}]`, `documents[{name, count, sum, stock}]`

### tab=stock (фронт: «Склад»)
- `cards`: `total_products`, `categories_count|categories`, `inventory_value`, `total_stock_quantity|total_units`, `zero_stock_products_count|zero_stock_count|out_of_stock_count`
- `charts`: `category_distribution`, `movement_units|movement` — движение за период
- `tables`: `products_stock|low_stock`

### tab=cashboxes (фронт: «Кассы»)
- `cards`: `revenue`, `transactions`, `avg_check`, `cash_in_box`, `cash_share_percent`
- `charts`: `sales_by_hours[{hour, revenue}]` (час — местный!), `payment_methods[{name, percent}]`, `transactions_by_weekday[{weekday, transactions}]` (weekday 0=Пн по местному времени)
- `tables`: `payment_detail[{method, transactions, sum, share}]`, `peak_hours[{hour, transactions, revenue, avg_check}]`

### tab=shifts
- `cards`: `active_shifts`, `shifts_today`, `avg_duration_hours`, `avg_revenue_per_shift`
- `charts`: `sales_by_shift_bucket`
- `tables`: `active_shifts`, `best_cashiers`

### tab=products
- `cards`: `catalog_products_count`, `stock_value`, `low_stock_count`, `rejected_products_count`, `sales_lines_missing_product_count`
- `tables`: `top_by_revenue`, `top_by_quantity`, `categories`, `brands`, `low_stock_products`

### tab=suppliers
- `cards`: `suppliers_count`, `total_stock_value`, `total_period_qty_sold`, `total_period_revenue`
- `tables`: `suppliers`, `suppliers_by_stock`

### tab=purchases
- `cards`: `purchased_sku_count`, `purchased_units`, `purchased_value`
- `tables`: `by_supplier`

### tab=users
- `cards`: `total`, `closed`, `open`, `discrepancies_count`
- `tables`: `users_performance`, `shift_discrepancies`

### tab=finance
- `cards`: `income_total`, `expense_total`, `net_flow`, `income_count`, `expense_count`
- `tables`: `expense_breakdown`, `income_breakdown`, `expense_items`, `income_items`

### tab=salary
- `rows` — массив строк по сотрудникам за период.

## 5. Смежный эндпоинт: список продаж

Модалка «Транзакции» на странице аналитики использует:

```
GET /main/pos/sales/?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&payment_method=&cashbox=&cashier=&min_total=&max_total=
```

Сейчас фронт шлёт сюда только даты (точную отсечку по времени делает на клиенте). Желательно, чтобы `date_from`/`date_to` тоже принимали `YYYY-MM-DDTHH:MM:SS` по тем же правилам (местное время, включительно) — тогда клиентский фильтр останется просто подстраховкой. Главное — **не ломать** приём формата `YYYY-MM-DD`.

## 6. Чек-лист приёмки

Данные для проверки: три продажи 09.07 — в `08:00`, `12:00`, `20:00` местного времени, по 1000 сом каждая.

| # | Запрос | Ожидание |
|---|---|---|
| 1 | `period_start=2026-07-09T09:00:00&period_end=2026-07-09T18:00:59`, tab=sales | `revenue=1000`, `transactions=1` (только продажа в 12:00) |
| 2 | `period_start=2026-07-09T12:00:00&period_end=2026-07-09T12:00:59` | продажа ровно в 12:00 **входит** (границы включительные) |
| 3 | `period_start=2026-07-09&period_end=2026-07-09` (без времени) | все три продажи (весь день 00:00–23:59:59) |
| 4 | Продажа в `23:30` местного; период = только 09.07 | попадает в 09.07, **не** в 10.07 (проверка UTC-смещения) |
| 5 | Продажа в `02:00` 10.07 местного; период = только 09.07 | **не** попадает в 09.07 |
| 6 | tab=cashboxes, та же выборка что в №1 | `sales_by_hours` содержит только час `12`; карточки согласованы с графиком |
| 7 | tab=finance / purchases / shifts с периодом-интервалом внутри дня | карточки и таблицы считаются по тому же интервалу |
| 8 | `period_start=abc` | HTTP 400 c `detail`, не 500 и не молчаливый полный период |

Пункты 1–2 — суть задачи «фильтрация по времени», пункты 4–5 — «неправильно работает по дате».
