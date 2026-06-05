# Кафе — требования к API (единая документация для бэкенда)

Документ по задачам с фронта CRM (`/crm/cafe/...`).  
**Базовый префикс:** `/api/cafe/` (прод: `https://app.nurcrm.kg/api/cafe/...`).

**Сверка с репозиторием nur_crm (фронт):** 2026-06-01.  
**Сверка с репозиторием nurCRM (бэкенд):** 2026-06-05.  
Чеклисты **[x] / [ ]** — фактическая готовность; у каждого раздела отдельно **бэкенд** и **фронт**.

---

## Общее

- Фильтрация: `CompanyBranchQuerysetMixin`, `?branch=<uuid>`.
- Даты: `YYYY-MM-DD`, интервал включительно (timezone компании, `Asia/Bishkek`).
- Деньги: decimal/string с 2 знаками.
- Расходы «Закупки»: `tools/cafePurchaseExpense.js` → `POST /api/cafe/expenses/`, категория `zakupki`.

| Раздел | Маршрут CRM | Компонент (фронт) |
|--------|-------------|-------------------|
| Аналитика | `/crm/cafe/analytics` | `CafeAnalytics.jsx`, `Reports.jsx` |
| Склад | `/crm/cafe/stock` | `Stock.jsx` |
| Инвентаризация | `/crm/cafe/inventory` | `CafeInventory.jsx`, `HouseholdInventoryTab.jsx` |
| Заказы | `/crm/cafe/orders` | `Orders.jsx`, `CafeOrdersHistory.jsx` |
| Сотрудники | `/crm/employ` | `Masters.jsx`, `AccessList.jsx` |

---

## 1. Динамика продаж

### Эндпоинт

```http
GET /api/cafe/analytics/sales/dynamics/?date_from=...&date_to=...&period=day|week|month&branch=...
```

**Бэкенд:** `apps/cafe/analytics.py` → `SalesDynamicsView`.

### Ответ

`date_from`, `date_to`, `period`, `basis: "paid_at"`, `totals` (`orders_count`, `items_qty`, `revenue`), `series[]`.

### Правила

- `is_paid=true`, дата `paid_at`, строки `is_rejected=false`.
- Авто `period`: ≤62 дней → `day`, иначе `week`; при >366 дней фронт шлёт `month`.
- `period=day` и диапазон >366 дней → **400**.
- Кэш ~30–60 с.

### Фронт

| Файл | Что делает |
|------|------------|
| `tools/cafeAnalyticsDynamics.js` | `GET dynamics/`; при **404/501** — fallback N× `sales/summary/` |
| `CafeAnalytics.jsx`, `Reports.jsx` | График — один запрос |

### Чеклист

| | Бэкенд | Фронт |
|---|--------|-------|
| `GET analytics/sales/dynamics/` | [x] | [x] |
| Fallback при 404 | — | [x] |

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

Ответ: товар + `expense_id`, `expense_amount`, `movement_id`.

### Фронт

| Действие | Реализация |
|----------|------------|
| Создание товара | `POST /cafe/warehouse/` — **без** `construction/cashflows` |
| Оприходование | `POST .../receive/`; при **404** — fallback `PUT` |
| Касса | `tools/cafeCashflowCategory.js` — «Закупки» не редактируется в UI |

**Вариант A:** расход только `CafeExpense` на бэке; фронт **не дублирует** cashflow.

### Чеклист

| | Бэкенд | Фронт |
|---|--------|-------|
| Авто-расход, `receive/`, `expense_id` | [x] | [x] |
| Cashflow на бэке (вариант A) | [ ] | — |

---

## 3. Инвентаризация `/crm/cafe/inventory`

Страница объединяет вкладки: **оборудование**, **акты по оборудованию**, **посуда и расходники**, **сверка склада**.  
Все закупки → **`CafeExpense`**, категория **«Закупки»** (`zakupki`).

---

### 3.1. Посуда и расходники (household)

| Ресурс | Путь |
|--------|------|
| Номенклатура | `/api/cafe/household-items/` |
| Движения | `.../receive/`, `.../write-off/` |
| Инвентаризация | `/api/cafe/household-inventory/sessions/` + `.../confirm/` |

**Бэкенд:** `apps/cafe/household_views.py`.

#### POST сессии

```json
{
  "comment": "...",
  "items": [{ "item": "uuid", "qty_counted": "118" }]
}
```

Фронт шлёт **`items`** (бэк может принимать и `lines`).

#### Авто `CafeExpense`

| Триггер | `source` |
|---------|----------|
| `POST` с `remainder > 0` + `unit_price` | `household_create` |
| `POST .../receive/` | `household_receipt` |

Бэкенд создаёт расход на `receive/`; фронт дублирует `POST /cafe/expenses/`, если нет `expense_id` в ответе.

#### Фронт (`HouseholdInventoryTab.jsx`)

- CRUD, оприходование / списание, акты инвентаризации
- Цена обязательна при приходе и при начальном остатке

#### Чеклист

| | Бэкенд | Фронт |
|---|--------|-------|
| CRUD, receive, write-off, сессии | [x] | [x] |
| Расход «Закупки» | [x] | [x] |
| PATCH черновика акта в UI | [x] бэк | [ ] фронт |

---

### 3.2. Оборудование (`/api/cafe/equipment/`)

#### Поля

| Поле | Комментарий |
|------|-------------|
| `title` | Обязательно |
| `price` | Сумма закупки **одной** единицы |
| `purchase_date` | → `expense_date` |
| `condition` | `good` / `repair` / `broken` |

#### Авто `CafeExpense` (целевое на бэке)

| Триггер | `source` | Сумма |
|---------|----------|--------|
| `POST` с `price >= 0.01` | `equipment_create` | `price` |
| `PATCH` — цена задана впервые | `equipment_price_set` | `price` |
| `PATCH` — рост цены (опц.) | `equipment_receipt` | дельта |

Ответ (как на складе):

```json
{
  "id": "uuid",
  "title": "Холодильник",
  "price": "45000.00",
  "expense_id": "uuid",
  "expense_amount": "45000.00"
}
```

Фронт: `pickExpenseIdFromResponse` — также `expense.id`, `movement.expense_id`.

#### Опционально: приход

```http
POST /api/cafe/equipment/{id}/receive/
```

```json
{ "quantity": "1", "unit_price": "12000.00", "note": "Докупка" }
```

`source`: `equipment_receipt`. При **404** фронт использует только `POST/PATCH` с `price`.

**Бэкенд:** `apps/cafe/services/warehouse_expense.py` → `equipment_on_create`, `equipment_on_price_update`, `equipment_receive`.

#### Фронт (`CafeInventory.jsx`)

- [x] `recordCafePurchaseExpense` при создании и при первом указании цены
- [x] Подсказка у поля «Цена закупки»

#### Чеклист бэкенда

- [x] `POST/PATCH` + `price` → `CafeExpense`, `expense_id` в ответе
- [x] Идемпотентность `(company, source, source_id)`

---

### 3.3. Сверка продуктов склада

`POST /api/cafe/inventory/sessions/` + `.../confirm/` по товарам `/cafe/warehouse/`.

При `confirm/`, если факт > учётного:

- оприходование на складе;
- `CafeExpense` с `source`: `inventory_confirm`.

Фронт **не** шлёт расход при confirm — только бэкенд.

**Бэкенд:** `apply_inventory_session_confirm()` в `apps/cafe/services/warehouse_expense.py`.

#### Чеклист

- [x] Confirm → оприходование + расход при излишке (бэкенд)

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

- Смешанная оплата (`validateSplitAmounts`)
- Предоплата только при `debt`
- Кнопки оплаты — по доступу `can_view_cafe_order_pay` (§7)

### Чеклист

| | Бэкенд | Фронт |
|---|--------|-------|
| split, debt, idempotency | [x] | [x] |
| 403 без права на pay | [x] | [x] UI |

---

## 5. Аналитика: наличные и безналичные (смешанная оплата)

**Проблема:** при `payment_method: split` нельзя отдавать одну строку «Смешанная» на всю сумму — нужна разбивка по `payments[]`.

### 5.1. Каналы

| Канал | `method` | UI |
|-------|----------|-----|
| Наличные | `cash` | «Наличные» |
| Безналичные | `card`, `transfer` | «Безналичные» |

```
наличные + безналичные = оплаченная выручка за период
```

### 5.2. Тела `pay/` (фронт уже шлёт)

**Split:**

```json
{
  "payment_method": "split",
  "payments": [
    { "method": "cash", "amount": "500.00" },
    { "method": "card", "amount": "300.00" }
  ],
  "close_order": true,
  "idempotency_key": "..."
}
```

**Долг с предоплатой:**

```json
{
  "payment_method": "debt",
  "prepaid_amount": "200.00",
  "prepaid_payment_method": "cash",
  "client_id": "uuid"
}
```

Предоплата → аналитика по `prepaid_payment_method`; остаток — долг, не выручка.

### 5.3. Агрегация

1. Приоритет: таблица **фактических платежей** (`payments[]`, prepaid).
2. Legacy: `order.payment_method` + `paid_amount`.
3. База: `paid_at`, `is_paid=true`.

При split 500 cash + 300 card → наличные 500, безналичные 300. **Не** `mixed: 800`.

### 5.4. Эндпоинты

**`GET /api/cafe/analytics/revenue-inflow/`** — рекомендуемый ответ:

```json
{
  "by_channel": {
    "cash": { "total": "125000.00", "orders_count": 42 },
    "non_cash": { "total": "98000.50", "orders_count": 38 }
  },
  "by_method": [
    { "payment_method": "cash", "amount": "125000.00", "orders_count": 42 },
    { "payment_method": "card", "amount": "75000.00", "orders_count": 30 }
  ]
}
```

Без строки `split`/`mixed`, если есть дочерние платежи.

**`GET /api/cafe/analytics/finance/`** — `income_breakdown[]`:

```json
{
  "method": "cash",
  "payment_channel": "cash",
  "total": "125000.00",
  "count": 42
}
```

```json
{
  "method": "card",
  "payment_channel": "non_cash",
  "total": "75000.00",
  "count": 30
}
```

### 5.5. Модель

**`OrderCheckoutPayment`:** `order`, `method` (`cash`|`card`|`transfer`), `amount`, `paid_at`, `kind` (`checkout`|`prepaid`|`debt_repayment`).

При `split` — N записей по `payments[]`; `order.payment_method = split` только для UI списка.

### 5.6. Фронт

| Файл | Поведение |
|------|-----------|
| `Orders.jsx` | `payments[]` при split |
| `CafeAnalytics.jsx` | `normalizeIncomeBreakdownToInflowRows` |
| `CafeAnalyticsModals.jsx` | Таблицы по способам |

### 5.7. Чеклист бэкенда

- [x] Сохранять каждую строку `payments[]` при split
- [x] Агрегация по платежам, не по `split` целиком
- [x] `cash` / `card`+`transfer` → каналы
- [x] Предоплата по `prepaid_payment_method` (через `OrderDebtPayment`)
- [x] `by_channel` в ответе

### 5.8. Smoke-тест

1. Заказ 1000: split 600 cash + 400 card.  
2. `GET finance/` — ≈600 нал, ≈400 карта, нет строки 1000 «Смешанная».  
3. Только `transfer` 500 — всё в безналичных.

---

## 6. Доступы официанта: оплата и возврат

Фронт: `/crm/cafe/orders`, история заказов, сотрудники.  
UI: группа **«Заказы кафе — официанты»** в «Управление доступами».

### 6.1. Поля сотрудника

По умолчанию `false`:

| Поле | UI | Назначение |
|------|-----|------------|
| `can_view_cafe_order_pay` | Проведение оплаты заказов | «Оплатить» / «Провести оплату» |
| `can_view_cafe_order_return` | Возврат по заказам | «Позиции и возвраты» в чеке истории |

**Всегда с правами:** `owner`, `admin` (и рус. синонимы) — без флагов.

**Официант:** только если включён чекбокс (`PATCH /users/employees/{id}/`).

Флаги в `GET /users/employees/{id}/` и профиле текущего пользователя.

### 6.2. Проверки API

| Действие | Метод | Право |
|----------|--------|-------|
| Оплата | `POST /api/cafe/orders/{id}/pay/` | `can_view_cafe_order_pay` или owner/admin |
| Возврат позиции | `POST /api/cafe/orders/{id}/refund-item/` | `can_view_cafe_order_return` или owner/admin |

Без права → **403** с текстом.

### 6.3. Миграция

- Существующие сотрудники: оба флага `false`.
- Владелец/админ: не зависят от флагов.

### 6.4. Фронт

| Файл | Роль |
|------|------|
| `src/tools/cafeEmployeePermissions.js` | `canCafeOrderPay`, `canCafeOrderReturn` |
| `AccessList.jsx`, `employeeAccessLabels.js` | Группа доступов |
| `Orders.jsx` | Кнопки оплаты |
| `CafeOrdersHistory.jsx` | Возвраты |

### 6.5. Чеклист

| | Бэкенд | Фронт |
|---|--------|-------|
| Поля в Employee | [x] | [x] UI |
| 403 на pay / refund-item | [x] | [x] UI |

---

## Сводный статус

| № | Задача | Бэкенд | Фронт |
|---|--------|--------|-------|
| 1 | `sales/dynamics/` | [x] | [x] |
| 2 | Склад «Закупки» | [x]* | [x] |
| 3 | Household | [x] | [x] |
| 3.2 | Оборудование + расход | [x] | [x] |
| 3.3 | Сверка склада confirm | [x] | — |
| 4 | Оплата `pay/` | [x] | [x] |
| 5 | Аналитика cash / non_cash | [x] | [x] |
| 6 | Доступы официанта | [x] | [x] |

\* Cashflow на бэке по варианту A — не блокер.

### После деплоя на прод

1. Миграции `cafe` и `users` (новые поля `can_view_cafe_order_*`, источники `CafeExpense`), перезапуск воркеров.
2. Smoke:
   - аналитика: `dynamics/` без 429;
   - склад / inventory: расход «Закупки»;
   - заказ: split + debt;
   - split → аналитика нал/безнал;
   - официант: оплата/возврат только с флагами.

### Расхождения

| Тема | Деталь |
|------|--------|
| Cashflow | Бэкенд [ ] — фронт не дублирует на складе |
| `receive/` 404 | Фронт fallback `PUT` без `expense_id` |
| Equipment | Бэкенд отдаёт `expense_id` — фронт может убрать дублирование расхода |

---

## Ссылки на код (фронт)

| Файл |
|------|
| `tools/cafeAnalyticsDynamics.js` |
| `tools/cafePurchaseExpense.js` |
| `tools/cafeCashflowCategory.js` |
| `tools/marketCashierSplitPayment.js` |
| `src/tools/cafeEmployeePermissions.js` |
| `src/Components/Sectors/cafe/Stock/Stock.jsx` |
| `src/Components/Sectors/cafe/Inventory/CafeInventory.jsx` |
| `src/Components/Sectors/cafe/Inventory/HouseholdInventoryTab.jsx` |
| `src/Components/Sectors/cafe/Orders/Orders.jsx` |
| `src/Components/Sectors/cafe/Orders/CafeOrdersHistory.jsx` |
| `src/Components/Sectors/cafe/CafeAnalytics/CafeAnalytics.jsx` |
| `src/Components/DepartmentDetails/AccessList.jsx` |

## Ссылки на код (бэкенд)

| Файл | Назначение |
|------|------------|
| `apps/cafe/services/warehouse_expense.py` | Авто-расходы склада, посуды, оборудования, инвентаризация |
| `apps/cafe/views.py` | Оборудование, оплата, права pay/refund |
| `apps/cafe/analytics.py` | `RevenueInflowView`, `CafeFinanceAnalyticsView`, агрегация по платежам |
| `apps/users/models.py` | `can_view_cafe_order_pay`, `can_view_cafe_order_return` |

### Прочие документы кафе (не входят в этот файл)

- `docs/cafe_ops_analytics_ru.md` — обзор аналитики
- `docs/cafe_menu_weight_backend_api.md`, `docs/cafe_weighted_menu_frontend.md`
- `docs/CAFE_WEBSOCKETS.md`, `docs/CAFE_RECEIPT_PRINTER_SETTINGS_API.md`
