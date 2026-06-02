# Кафе — требования к API (документация для бэкенда)

Документ по задачам с фронта CRM (`/crm/cafe/...`).  
**Базовый префикс:** `/api/cafe/` (прод: `https://app.nurcrm.kg/api/cafe/...`).

**Сверка с репозиторием nur_crm (фронт):** 2026-06-01.  
Чеклисты **[x] / [ ]** — фактическая готовность; у каждого раздела отдельно **бэкенд** и **фронт**.

---

## Общее

- Фильтрация: `CompanyBranchQuerysetMixin`, `?branch=<uuid>`.
- Даты: `YYYY-MM-DD`, интервал включительно (timezone компании, `Asia/Bishkek`).
- Деньги: decimal/string с 2 знаками.

| Раздел | Маршрут CRM | Компонент (фронт) |
|--------|-------------|-------------------|
| Аналитика | `/crm/cafe/analytics` | `CafeAnalytics.jsx`, `Reports.jsx` |
| Склад | `/crm/cafe/stock` | `Stock.jsx` |
| Инвентаризация | `/crm/cafe/inventory` | `CafeInventory.jsx`, `HouseholdInventoryTab.jsx` |
| Заказы | `/crm/cafe/orders` | `Orders.jsx` |

---

## 1. Динамика продаж

### Эндпоинт

```http
GET /api/cafe/analytics/sales/dynamics/?date_from=...&date_to=...&period=day|week|month&branch=...
```

**Бэкенд (по отчёту команды):** `apps/cafe/analytics.py` → `SalesDynamicsView`, URL в `apps/cafe/urls.py`.

### Ответ

`date_from`, `date_to`, `period`, `basis: "paid_at"`, `totals` (`orders_count`, `items_qty`, `revenue`), `series[]` (`label`, `date_from`, `date_to`, …).

### Правила

- `is_paid=true`, дата `paid_at`, строки `is_rejected=false`.
- Авто `period`: ≤62 дней → `day`, иначе `week` (фронт дублирует в `resolveCafeSalesDynamicsPeriod`; при >366 дней шлёт `month`).
- `period=day` и диапазон >366 дней → **400** (бэкенд).
- Кэш ~30–60 с (бэкенд).

### Фронт

| Файл | Что делает |
|------|------------|
| `tools/cafeAnalyticsDynamics.js` | `GET /cafe/analytics/sales/dynamics/`; при **404/501** — fallback N× `sales/summary/` |
| `CafeAnalytics.jsx`, `Reports.jsx` | График «Динамика продаж» — один запрос; KPI — по-прежнему один `sales/summary/` в `fetchAll` |

### Чеклист бэкенда

- [x] `GET analytics/sales/dynamics/`
- [x] `date_from`, `date_to`, `period`
- [x] `totals` + `series`
- [x] Та же база, что `sales/summary/`

### Чеклист фронта

- [x] Один запрос на график
- [x] Fallback при отсутствии эндпоинта
- [x] KPI не дублируют N× `summary`

**Статус:** при деплое бэка с `dynamics/` на проде fallback не нужен; 429 на графике должны исчезнуть.

---

## 2. Склад: авто-расход «Закупки»

### Категория

`CafeExpenseCategory`: `slug=zakupki`, `is_system=true`.  
`ensure_zakupki_category()` в `apps/cafe/services/warehouse_expense.py`.

### API категорий

| Метод | Путь |
|--------|------|
| GET, POST | `/api/cafe/expense-categories/` |
| GET, PATCH, DELETE | `/api/cafe/expense-categories/{id}/` |

PATCH/DELETE системной → **403**.

### Авто `CafeExpense`

| Триггер | `source` |
|---------|----------|
| `POST /warehouse/` с `remainder > 0` | `warehouse_create` |
| `POST /warehouse/{id}/receive/` | `warehouse_receipt` |
| `PUT /warehouse/{id}/` (рост `remainder`) | `warehouse_receipt` |

Идемпотентность: `(company, source, source_id)`.

### Оприходование

```http
POST /api/cafe/warehouse/{id}/receive/
```

Ответ: товар + `expense_id`, `expense_amount`, `movement_id` (ожидается бэкендом).

### Фронт

| Действие | Реализация |
|----------|------------|
| Создание товара | `POST /cafe/warehouse/` — **без** `construction/cashflows` |
| Оприходование | `POST .../receive/`; при **404** — fallback `PUT` (старый бэк) |
| Касса | `tools/cafeCashflowCategory.js` + `KassaModals.jsx` — категория «Закупки» / `zakupki` **не редактируется и не удаляется** в UI |

**Вариант A (согласовано):** операционный расход только `CafeExpense` на бэке; фронт **не дублирует** cashflow при складе.

### Чеклист бэкенда

- [x] Системная категория «Закупки»
- [x] Запрет PATCH/DELETE категории
- [x] Авто-расход на создание и приход
- [x] `source`, `source_id`
- [x] `POST .../receive/` + `expense_id` в ответе
- [ ] Cashflow на бэке (вариант A: только `CafeExpense`; дубль cashflow не требуется)

### Чеклист фронта

- [x] Убраны ручные `POST /construction/cashflows/` на складе
- [x] `POST .../receive/` (+ fallback `PUT`)
- [x] Защита категории «Закупки» в кассе
- [ ] Явный вызов `GET /expense-categories/` на странице склада (не нужен — расход создаёт бэк)

**Статус:** интеграция готова; на проде проверить, что `receive/` отвечает не 404 и в аналитике расходов видны «Закупки».

---

## 3. Посуда и расходники (household)

### Префиксы

| Ресурс | Путь |
|--------|------|
| Номенклатура | `/api/cafe/household-items/` |
| Движения | `.../receive/`, `.../write-off/` |
| Инвентаризация | `/api/cafe/household-inventory/sessions/` + `.../confirm/` |

**Бэкенд:** `apps/cafe/household_views.py`, модели в `apps/cafe/models.py`.

### POST сессии инвентаризации

```json
{
  "comment": "...",
  "items": [
    { "item": "uuid", "qty_counted": "118" }
  ]
}
```

Альтернатива на бэке: ключ `lines` с тем же форматом. Фронт шлёт **`items`**.

### Фронт

Вкладка **«Посуда и расходники»** в `CafeInventory.jsx` → `HouseholdInventoryTab.jsx`:

- CRUD `household-items/`
- `POST .../receive/`, `POST .../write-off/`
- `POST household-inventory/sessions/` (тело с `items`)
- `GET sessions/{id}/`, `POST .../confirm/`
- **Нет** `PATCH` черновика акта в UI (только создание + просмотр + проведение)

### Чеклист бэкенда

- [x] Модели `Household*`
- [x] CRUD номенклатуры
- [x] `receive` / `write-off`
- [x] Сессии + `confirm` + summary
- [x] `CafeExpense` «Закупки» на приход с `unit_price`
- [x] PATCH черновика: `comment` + пересоздание строк (`items` / `lines`)
- [x] Сериализатор: `items` в `Meta.fields` (POST без AssertionError)

### Чеклист фронта

- [x] Вкладка и номенклатура
- [x] Оприходование / списание
- [x] Создание и проведение актов
- [x] Расход «Закупки» при создании (начальный остаток + цена) и оприходовании — `tools/cafePurchaseExpense.js` → `POST /cafe/expenses/` (если бэк не вернул `expense_id`)
- [ ] Редактирование черновика акта (`PATCH`) — при необходимости отдельная задача
- [ ] Поддержка ключа `lines` в POST (сейчас только `items`; бэк принимает оба)

**Статус:** основной сценарий закрыт; PATCH черновика — только на бэке.

---

## 4. Оплата заказа

```http
POST /api/cafe/orders/{id}/pay/
```

| Сценарий | Тело (кратко) |
|----------|----------------|
| `cash` / `card` / `transfer` | `payment_method`, опционально `pay_now` + `client_id` |
| `split` | `payments: [{ method, amount }, …]` |
| `debt` | `prepaid_amount`, `prepaid_payment_method` |
| Все | `idempotency_key`, `discount_amount`, `close_order` |

### Фронт (`Orders.jsx`)

- Карточки способов оплаты, смешанная оплата (`validateSplitAmounts` из `tools/marketCashierSplitPayment.js`)
- Предоплата только при `debt`
- Быстрое создание гостя в модалке оплаты

### Чеклист бэкенда

- [x] `split` + `payments[]`
- [x] `debt` + предоплата
- [x] `pay_now` + `client_id`
- [x] Идемпотентность `idempotency_key`

### Чеклист фронта

- [x] Все сценарии из таблицы
- [x] UI смешанной оплаты и долга

**Статус:** готово с обеих сторон.

---

## 5. Аналитика: финансы (дополнение, вне исходного ТЗ)

Фронт уже использует `GET /cafe/analytics/finance/` (`income_breakdown`, `income_items`) в `CafeAnalytics.jsx` для модалки «Финансы» и разбивки оплат в «Выручка». Отдельный чеклист бэка — по `docs/cafe_ops_analytics_ru.md`, если нужна детализация split/debt в `income_breakdown`.

---

## Сводный статус

| № | Задача | Бэкенд | Фронт | Примечание |
|---|--------|--------|-------|------------|
| 1 | `sales/dynamics/` | [x] | [x] | На проде убедиться, что нет 404 → fallback |
| 2 | Авто «Закупки» | [x]* | [x] | *Cashflow на бэке [ ] — по варианту A не блокер |
| 3 | Household | [x] | [x]† | †PATCH черновика акта на фронте [ ] |
| 4 | Оплата `pay/` | [x] | [x] | — |

### После деплоя на прод

1. Перезапуск воркеров / применение миграций `cafe` (если не применены).
2. Smoke-тесты:
   - аналитика: график без 429, один запрос `dynamics/`;
   - склад: оприходование → расход «Закупки» в `CafeExpense`, без дубля cashflow;
   - inventory → household: приход, акт, confirm;
   - заказ: split + debt с предоплатой.

### Расхождения / долги

| Тема | Деталь |
|------|--------|
| Cashflow | Бэкенд [ ] — фронт уже не шлёт дубль при складе |
| Household PATCH | Бэкенд [x], фронт не вызывает — редактирование черновика только через новый акт |
| `receive/` 404 | Старый бэк: фронт откатится на `PUT` без `expense_id` в ответе |

---

## Ссылки на код (фронт)

| Файл |
|------|
| `tools/cafeAnalyticsDynamics.js` |
| `src/Components/Sectors/cafe/Stock/Stock.jsx` |
| `tools/cafeCashflowCategory.js` |
| `src/Components/Sectors/cafe/kassaCafe/components/KassaModals.jsx` |
| `src/Components/Sectors/cafe/Inventory/HouseholdInventoryTab.jsx` |
| `src/Components/Sectors/cafe/Orders/Orders.jsx` |
