# Кафе — требования к API (документация для бэкенда)

Документ собран по задачам с фронта CRM (`/crm/cafe/...`).  
**Базовый префикс:** `/api/cafe/` (в проде: `https://app.nurcrm.kg/api/cafe/...`).

Общее для всех эндпоинтов (если не указано иное):

- Фильтрация по компании/филиалу: `CompanyBranchQuerysetMixin`, query `?branch=<uuid>`.
- Даты: `YYYY-MM-DD`, интервал **включительно** по календарным дням в timezone компании (рекомендация: `Asia/Bishkek`).
- Деньги: decimal/string с 2 знаками (`"1234.56"`).

**Фронт (ориентир):**

| Раздел | Маршрут | Компонент |
|--------|---------|-----------|
| Аналитика | `/crm/cafe/analytics` | `CafeAnalytics.jsx`, `Reports.jsx` |
| Склад | `/crm/cafe/stock` | `Stock.jsx` |
| Инвентаризация | `/crm/cafe/inventory` | `CafeInventory.jsx` |
| Заказы / оплата | `/crm/cafe/orders` | `Orders.jsx` |

---

## Содержание

1. [Динамика продаж — отдельный эндпоинт (429)](#1-динамика-продаж--отдельный-эндпоинт)
2. [Склад: авто-расход «Закупки»](#2-склад-авто-расход-закупки)
3. [Инвентаризация: посуда и расходники](#3-инвентаризация-посуда-и-расходники)
4. [Оплата заказа (checkout)](#4-оплата-заказа-checkout)

---

## 1. Динамика продаж — отдельный эндпоинт

### 1.1 Проблема

**Сейчас на фронте** блок «Динамика продаж» строит график так:

1. По выбранным `date_from` / `date_to` вычисляется список **бакетов** (дней или недель).
2. На **каждый бакет** уходит отдельный запрос:

```http
GET /api/cafe/analytics/sales/summary/?date_from=2025-08-01&date_to=2025-08-01
```

Пример: период **7 дней** → **7 запросов**; до **62 дней** → до **62 запросов** (пачками по 8 в `Promise.all`).  
Параллельно на странице аналитики идут ещё ~10 запросов (`items`, `categories`, `finance`, `debts`, …).

**Симптом:** `429 Too Many Requests` на `sales/summary/` (пример из продa: `date_from=2025-08-01&date_to=2025-08-07`).

**Вывод:** `sales/summary/` должен остаться **агрегатом за весь период** (KPI-карточки). Для графика нужен **один** лёгкий эндпоинт с рядом точек.

### 1.2 Новый эндпоинт (обязательно)

```http
GET /api/cafe/analytics/sales/dynamics/
```

#### Query-параметры

| Параметр | Обязательный | Описание |
|----------|--------------|----------|
| `date_from` | да | Начало периода |
| `date_to` | да | Конец периода |
| `period` | нет | Гранулярность ряда. По умолчанию — авто (см. ниже) |
| `branch` | нет | UUID филиала |

#### Значения `period`

| Значение | Смысл | Когда использовать на фронте |
|----------|--------|------------------------------|
| `day` | Одна точка = один календарный день | Период ≤ ~62 дней |
| `week` | Одна точка = неделя (пн–вс или скользящие 7 дней — зафиксировать в коде) | Длинный период |
| `month` | Одна точка = календарный месяц | Отчёты за квартал/год |

**Авто-режим** (если `period` не передан): как на фронте сейчас в `buildBuckets` — если `(date_to - date_from + 1) ≤ 62` → `day`, иначе → `week`. Бэкенд может дублировать эту логику или требовать явный `period` (тогда фронт всегда шлёт `period`).

#### Правила расчёта (как у `sales/summary/`)

- Выручка только по **оплаченным** заказам: `is_paid=true`.
- Дата отнесения: **`paid_at`** (не `created_at`).
- Позиции: `is_rejected=false`.
- Сумма строки: `quantity * Coalesce(unit_price, menu_item.price)` (как в `docs/cafe_ops_analytics_ru.md`).

#### Ответ `200 OK`

```json
{
  "date_from": "2025-08-01",
  "date_to": "2025-08-07",
  "period": "day",
  "basis": "paid_at",
  "totals": {
    "orders_count": 42,
    "items_qty": 156,
    "revenue": "125430.50"
  },
  "series": [
    {
      "label": "2025-08-01",
      "date_from": "2025-08-01",
      "date_to": "2025-08-01",
      "orders_count": 6,
      "items_qty": 22,
      "revenue": "18450.00"
    },
    {
      "label": "2025-08-02",
      "date_from": "2025-08-02",
      "date_to": "2025-08-02",
      "orders_count": 5,
      "items_qty": 18,
      "revenue": "15200.00"
    }
  ]
}
```

| Поле | Описание |
|------|----------|
| `totals` | Агрегат за весь запрошенный интервал (должен совпадать с `GET sales/summary/` за те же даты) |
| `series[]` | Точки для графика «Динамика продаж» |
| `series[].label` | Подпись оси X (для `week` допустимо `"2025-08-01—2025-08-07"`) |
| `series[].revenue` | Выручка за бакет |

Пустой период → `"series": []`, `totals` с нулями.

#### Ошибки

| Код | Условие |
|-----|---------|
| 400 | Нет дат, `date_from` > `date_to`, неверный `period` |
| 429 | Не должен возникать при нормальном использовании (1 запрос на график) |

#### Производительность

- Один SQL с `GROUP BY` по дате `paid_at::date` (или по неделе/месяцу).
- Опционально кэш на 30–60 с для одинаковых query.
- Лимит диапазона: рекомендуется **max 366 дней** для `period=day`, иначе 400 с текстом «Укажите period=week».

### 1.3 Фронт (сделано)

`tools/cafeAnalyticsDynamics.js` — `fetchCafeSalesDynamicsSeries()` (основной URL + fallback на N× `summary` при 404).

`CafeAnalytics.jsx` / `Reports.jsx` — график «Динамика продаж» через один запрос; KPI по-прежнему `GET sales/summary/` один раз в `fetchAll`.

### 1.4 Чеклист бэкенда

- [ ] `GET /api/cafe/analytics/sales/dynamics/`
- [ ] Параметры `date_from`, `date_to`, `period` (`day` | `week` | `month`)
- [ ] `totals` + `series` в одном ответе
- [ ] Та же база расчёта, что у `sales/summary/`
- [ ] Документировать в `urls.py` / OpenAPI

---

## 2. Склад: авто-расход «Закупки»

### 2.1 Контекст

**Страница:** `/crm/cafe/stock` (`Stock.jsx`).

**Сейчас на фронте** при операциях со складом продуктов (`/api/cafe/warehouse/`):

| Действие | API | Что делает фронт |
|----------|-----|------------------|
| Создание товара с остатком | `POST /cafe/warehouse/` | `POST /construction/cashflows/` — расход «Новый товар на склад» |
| Оприходование | `PUT /cafe/warehouse/{id}/` (увеличение `remainder`) | `POST /construction/cashflows/` — «Приход на склад: …» |
| Редактирование остатка/цены | `PUT` | cashflow на **разницу** стоимости остатка |

**Записей в `CafeExpense` (`/api/cafe/expenses/`) при этом нет** — в аналитике расходов закупки не видны.

**Требование:** при **оприходовании** и при **добавлении товара** (начальный остаток) бэкенд **сам** создаёт операционный расход с категорией **«Закупки»**. Категория **системная** — нельзя удалить или переименовать через API.

### 2.2 Модель категории расходов

Рекомендуется отдельная сущность (если сейчас `CafeExpense.category` — свободная строка):

**`CafeExpenseCategory`**

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | |
| `company` | FK | |
| `branch` | FK, null | null = на всю компанию |
| `title` | string | «Закупки» |
| `slug` | string | `zakupki` (уникально в company) |
| `is_system` | bool | `true` — защищённая категория |
| `sort_order` | int | опционально |

**Сид при создании компании/филиала:** одна запись `title=Закупки`, `slug=zakupki`, `is_system=true`.

**Ограничения API:**

| Метод | Путь | Поведение для `is_system=true` |
|--------|------|--------------------------------|
| PATCH | `.../expense-categories/{id}/` | **403** — «Системную категорию нельзя изменить» |
| DELETE | `.../expense-categories/{id}/` | **403** — «Системную категорию нельзя удалить» |

Список категорий для кассы/расходов должен отдавать эту категорию с флагом `is_system: true` (фронт скроет кнопки редактирования).

Если категории пока нет в API — минимум: в `CafeExpense` поле `category` = строка `"Закупки"` + `category_slug: "zakupki"` + валидация при ручном PATCH расхода не менять slug у авто-записей (см. `source` ниже).

### 2.3 Автоматическое создание `CafeExpense`

**Триггеры** (бэкенд, в транзакции с движением склада):

1. **`POST /api/cafe/warehouse/`** — если в теле `remainder > 0` и `unit_price >= 0`:
   - `amount = remainder * unit_price`
2. **Увеличение остатка** (оприходование):
   - Рекомендуется явный эндпоинт (см. §2.4), либо `PUT` с ростом `remainder`:
   - `delta_qty = new_remainder - old_remainder`
   - если `delta_qty > 0`: `amount = delta_qty * unit_price` (цена из тела запроса или текущая на складе)

**Не создавать** расход при:

- уменьшении остатка (списание, продажа, инвентаризация);
- `amount < 0.01`;
- повторной обработке того же запроса (идемпотентность по `warehouse_movement_id`).

**Поля создаваемого `CafeExpense`:**

| Поле | Значение |
|------|----------|
| `title` | `Закупка: {warehouse_item.title}` |
| `amount` | см. выше |
| `category` / `category_id` | «Закупки» / system category |
| `expense_date` | `today` (дата операции) |
| `note` | `Склад: приход {qty} {unit}` или `Создание позиции` |
| `branch` | из склада/запроса |
| `source` | `warehouse_receipt` (новое поле, enum) |
| `source_id` | UUID движения/позиции склада |
| `created_by` | текущий пользователь |

**`source`** (рекомендуемые значения): `manual` | `warehouse_receipt` | `warehouse_create` — чтобы в UI не путать с ручными расходами из кассы.

**Связь с кассой (`construction/cashflows`):**

- Сейчас фронт **дублирует** расход в cashflow. После внедрения бэка возможны варианты:
  - **A)** Бэкенд создаёт только `CafeExpense`; фронт убирает cashflow для склада.
  - **B)** Бэкенд создаёт `CafeExpense` + опционально cashflow по флагу компании.
  - **C)** Оставить cashflow на фронте, но `CafeExpense` обязателен для аналитики.

Зафиксировать в ответе `warehouse` при приходе: `expense_id` (UUID созданного расхода).

### 2.4 Рекомендуемый эндпоинт оприходования (опционально, но лучше)

Чтобы не парсить `PUT` и не ловить лишние расходы при смене цены без изменения количества:

```http
POST /api/cafe/warehouse/{id}/receive/
```

**Тело:**

```json
{
  "quantity": "10.000",
  "unit_price": "85.50",
  "supplier": "uuid-or-null",
  "note": "Поставка от …"
}
```

**Действия сервера:**

1. Увеличить `remainder` на `quantity`.
2. При необходимости обновить `unit_price`.
3. Создать `CafeExpense` (категория «Закупки»).
4. Записать `WarehouseMovement` (журнал, опционально).
5. Вернуть обновлённый товар + `{ "expense_id": "…", "expense_amount": "855.00" }`.

Фронт позже переведёт кнопку «Оприходовать» с `PUT` на этот POST.

### 2.5 Аналитика

`GET /api/cafe/analytics/expenses/summary/` — закупки должны попадать в группировку по категории **«Закупки»** и в `expenses_by_day`.

### 2.6 Фронт (сделано)

`Stock.jsx` — убраны ручные `POST /construction/cashflows/` при создании/оприходовании; оприходование через `POST /cafe/warehouse/{id}/receive/` (fallback `PUT` при 404).

`tools/cafeCashflowCategory.js` + `KassaModals.jsx` — категория «Закупки» (`is_system` / slug `zakupki`) без редактирования и удаления в UI.

### 2.7 Чеклист бэкенда

- [ ] Системная категория «Закупки» (`is_system`, slug `zakupki`)
- [ ] Запрет PATCH/DELETE категории
- [ ] Авто-`CafeExpense` на `POST /warehouse/` с начальным остатком
- [ ] Авто-`CafeExpense` на оприходование (PUT или `POST .../receive/`)
- [ ] Поля `source`, `source_id` у расхода
- [ ] Ответ с `expense_id` при приходе
- [ ] Согласовать с фронтом судьбу `construction/cashflows`

---

## 3. Инвентаризация: посуда и расходники

### 3.1 Контекст

**Страница:** `/crm/cafe/inventory` (`CafeInventory.jsx`).

**Сейчас три вкладки:**

| Вкладка | API | Назначение |
|---------|-----|------------|
| Оборудование | `/cafe/equipment/` | Кофемашины, мебель и т.д. |
| Акты инвентаризации | `/cafe/equipment/inventory/sessions/` | Инвентаризация оборудования |
| Сверка продуктов | `/cafe/inventory/sessions/` + `/cafe/warehouse/` | Сверка **продуктов** склада кухни |

**Не хватает:** учёт **посуды, приборов, расходников** (ложки, тарелки, салфетки, контейнеры) — отдельно от продуктов `warehouse` и от `equipment`.

**Требование:** новый таб на фронте + **отдельный REST-модуль** на бэке: номенклатура, оприходование, списание, инвентаризация.

### 3.2 Термины

| Термин | Описание |
|--------|----------|
| **Номенклатура** | Справочник позиций (название, ед. изм., остаток, мин. остаток) |
| **Оприходование** | Увеличение остатка (приход) |
| **Списание** | Уменьшение остатка (бой, потери) |
| **Инвентаризация** | Сессия: фактические остатки → проведение → корректировка учётного остатка |

### 3.3 Модели (предложение)

#### `CafeHouseholdItem` (номенклатура)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | |
| `company`, `branch` | FK | |
| `title` | string | «Ложка столовая» |
| `sku` | string, null | Артикул / код |
| `unit` | string | `шт`, `уп`, `компл` |
| `remainder` | decimal | Текущий остаток |
| `minimum` | decimal | Порог для алерта |
| `is_active` | bool | |
| `created_at`, `updated_at` | datetime | |

#### `CafeHouseholdMovement` (журнал движений)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | |
| `item` | FK → HouseholdItem | |
| `movement_type` | enum | `in` \| `out` \| `adjust` |
| `quantity` | decimal | Всегда > 0 |
| `unit_price` | decimal, null | Для прихода — для связи с расходом «Закупки» |
| `remainder_before`, `remainder_after` | decimal | Снапшот |
| `note` | string | |
| `created_by` | FK User | |
| `created_at` | datetime | |

При `movement_type=in` с `unit_price` — опционально создавать `CafeExpense` (категория «Закупки»), по тем же правилам §2.

#### `CafeHouseholdInventorySession` (акт инвентаризации)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | |
| `status` | enum | `draft` \| `confirmed` |
| `comment` | string | |
| `branch` | FK | |
| `created_by` | FK | |
| `created_at`, `confirmed_at` | datetime | |

#### `CafeHouseholdInventoryLine`

| Поле | Тип | Описание |
|------|-----|----------|
| `session` | FK | |
| `item` | FK | |
| `qty_book` | decimal | Учётный остаток на момент создания строки |
| `qty_counted` | decimal | Факт |
| `difference` | decimal | `qty_counted - qty_book` (read-only) |

### 3.4 API — номенклатура

**Префикс (рекомендация):** `/api/cafe/household-items/`  
(альтернатива: `/api/cafe/inventory/household/` — главное, не смешивать с `equipment` и `warehouse`).

| Метод | Путь | Описание |
|--------|------|----------|
| GET | `/household-items/` | Список + фильтры `?search=`, `?is_active=`, пагинация DRF |
| POST | `/household-items/` | Создание |
| GET | `/household-items/{id}/` | Деталь |
| PATCH, PUT | `/household-items/{id}/` | Редактирование (не менять `remainder` напрямую — только через движения) |
| DELETE | `/household-items/{id}/` | Мягкое удаление (`is_active=false`) или hard delete если нет движений |

**POST создание:**

```json
{
  "title": "Тарелка глубокая",
  "unit": "шт",
  "sku": "PLT-01",
  "minimum": "20",
  "remainder": "0"
}
```

### 3.5 API — движения (оприходование / списание)

| Метод | Путь | Описание |
|--------|------|----------|
| GET | `/household-items/{id}/movements/` | Журнал по позиции |
| POST | `/household-items/{id}/receive/` | **Оприходование** |
| POST | `/household-items/{id}/write-off/` | **Списание** |

**Оприходование** `POST .../receive/`:

```json
{
  "quantity": "50",
  "unit_price": "35.00",
  "note": "Закупка"
}
```

Ответ: `{ "item": { ...обновлённый остаток... }, "movement": { ... }, "expense_id": "uuid|null" }`

**Списание** `POST .../write-off/`:

```json
{
  "quantity": "3",
  "note": "Бой"
}
```

Валидация: `quantity <= item.remainder`, иначе 400.

### 3.6 API — инвентаризация

| Метод | Путь | Описание |
|--------|------|----------|
| GET | `/household-inventory/sessions/` | Список актов |
| POST | `/household-inventory/sessions/` | Создать черновик |
| GET | `/household-inventory/sessions/{id}/` | Деталь + строки |
| PATCH | `/household-inventory/sessions/{id}/` | Комментарий, строки (только `draft`) |
| POST | `/household-inventory/sessions/{id}/confirm/` | Провести |

**Создание акта** `POST /household-inventory/sessions/`:

```json
{
  "comment": "Инвентаризация зала, август",
  "items": [
    { "item": "uuid-ложки", "qty_counted": "118" },
    { "item": "uuid-тарелки", "qty_counted": "42" }
  ]
}
```

Сервер для каждой строки сохраняет `qty_book` = текущий `remainder` позиции.

**Проведение** `POST .../confirm/`:

1. Проверить `status == draft`.
2. Для каждой строки: `delta = qty_counted - qty_book`.
3. Если `delta != 0` — создать `HouseholdMovement` типа `adjust` и обновить `remainder`.
4. `status = confirmed`, `confirmed_at = now()`.

Ответ: полный акт + сводка `{ "lines_total": 12, "adjusted_count": 3 }`.

**Запрет:** редактировать/удалять подтверждённый акт (только просмотр).

### 3.7 Отличия от существующих модулей

| Модуль | Не путать с |
|--------|-------------|
| `household-items` | `/cafe/warehouse/` — **продукты** (ингредиенты) |
| `household-items` | `/cafe/equipment/` — **оборудование** с серийниками |
| `household-inventory/sessions` | `/cafe/inventory/sessions/` — сверка **warehouse** |
| | `/cafe/equipment/inventory/sessions/` — инвентаризация **equipment** |

### 3.8 Фронт (сделано)

`CafeInventory.jsx` — вкладка **«Посуда и расходники»**.

`HouseholdInventoryTab.jsx` — номенклатура (`/cafe/household-items/`), оприходование/списание (`receive` / `write-off`), акты (`/cafe/household-inventory/sessions/` + `confirm`).

### 3.9 Чеклист бэкенда

- [ ] Модели `HouseholdItem`, `HouseholdMovement`, `HouseholdInventorySession`, `HouseholdInventoryLine`
- [ ] CRUD номенклатуры
- [ ] `POST receive`, `POST write-off`
- [ ] Сессии инвентаризации + `confirm`
- [ ] Опционально: `CafeExpense` «Закупки» на приход с ценой
- [ ] Права доступа как у `warehouse` / `equipment`
- [ ] Миграции + админка

---

## 4. Оплата заказа (checkout)

Документация по **`POST /api/cafe/orders/<uuid>/pay/`** (смешанная оплата, долг, предоплата) — без изменений по смыслу относительно предыдущей версии.

### 4.1 Кратко

| `payment_method` | Описание |
|------------------|----------|
| `cash`, `card`, `transfer` | Полная или частичная (`pay_now` + долг на остаток) |
| `split` | `payments: [{ method, amount }, …]` — сумма = due |
| `debt` | В долг; опционально `prepaid_amount` + `prepaid_payment_method` |

### 4.2 Смешанная оплата

```json
{
  "payment_method": "split",
  "payments": [
    { "method": "card", "amount": "800.00" },
    { "method": "cash", "amount": "200.00" }
  ],
  "discount_amount": "0.00",
  "close_order": true,
  "idempotency_key": "…"
}
```

### 4.3 Чеклист

- [ ] `split` + `payments[]`
- [ ] `debt` + предоплата
- [ ] `pay_now` + `client_id`
- [ ] Идемпотентность `idempotency_key`

---

## Сводный приоритет для бэкенда

| № | Задача | Критичность |
|---|--------|-------------|
| 1 | `GET analytics/sales/dynamics/` | Высокая (429, график не работает стабильно) |
| 2 | Авто-расход «Закупки» на складе | Средняя (финансовая аналитика) |
| 3 | Модуль household + инвентаризация | Новая функциональность |

| 1 | `sales/dynamics/` | Фронт готов; нужен бэкенд (сейчас fallback на старый N× summary) |
| 2 | Авто `CafeExpense` «Закупки» | Фронт не дублирует cashflow; нужен бэкенд на `warehouse` / `receive` |
| 3 | Household API | Фронт готов; нужны эндпоинты из §3 |
