# 05 — ИНВЕНТАРИЗАЦИЯ (сверка остатков)

> Статус фронтенда: **готов к подключению**. Экран сверки, история и
> подтверждение уже вызывают эндпоинты ниже; при их отсутствии — безопасная
> ошибка через `validateResErrors`, склад не ломается.

---

## 1. Бизнес-процесс

Во время производства возможны расхождения между **учётным** и **фактическим**
остатком. Инвентаризация — это сверка:

```
Учётный остаток (qty_system)   vs   Фактический (qty_fact)

qty_fact > qty_system  →  ИЗЛИШЕК   (surplus,  diff = +N)
qty_fact < qty_system  →  НЕДОСТАЧА (shortage, diff = −N)
qty_fact = qty_system  →  совпадает
```

**Поток:**
1. Сотрудник создаёт инвентаризацию по складу (готовая продукция / сырьё).
2. Вводит **фактические** остатки по позициям (можно частично).
3. Система фиксирует расхождения (излишек/недостача), комментарий.
4. Инвентаризация сохраняется как **черновик** или сразу **подтверждается**.
5. **Подтверждение** приводит учётные остатки к фактическим (корректирует склад).
6. Всё попадает в **историю** с ответственным, датой и расхождениями.

В аналитике отображаются: **излишки**, **недостачи**, **история**, **ответственные**.

---

## 2. Сущности и связи

```
Inventory (сессия инвентаризации)              [/main/inventories/]   (НОВАЯ)
   ├── warehouse: finished_goods | raw_materials
   ├── status: draft | confirmed | canceled
   ├── comment
   ├── user (FK) → User        (ответственный)
   ├── created_at, confirmed_at
   └──< InventoryItem >                         (НОВАЯ, строки сверки)
          ├── inventory (FK)
          ├── product (FK)   → Product | ItemMake (по warehouse)
          ├── qty_system     (учётный на момент сверки)
          ├── qty_fact       (фактический)
          └── diff           (= qty_fact − qty_system; >0 излишек, <0 недостача)
```

Связи:
- `Inventory.user → User` (кто проводил).
- `InventoryItem.inventory → Inventory`.
- `InventoryItem.product → Product` (для `finished_goods`) или `ItemMake`
  (для `raw_materials`) — разрешается по полю `Inventory.warehouse`.

---

## 3. Изменения в БД — новые таблицы

### `inventory`
| Поле | Тип | Null | Default | Описание |
|------|-----|------|---------|----------|
| `id` | uuid | no | — | PK |
| `warehouse` | varchar(20) | no | — | `finished_goods` / `raw_materials` |
| `status` | varchar(16) | no | `draft` | `draft` / `confirmed` / `canceled` |
| `comment` | text | yes | `''` | комментарий |
| `user_id` | FK → user | no | — | ответственный |
| `created_at` | timestamp | no | now() | дата создания |
| `confirmed_at` | timestamp | yes | — | дата подтверждения |
| `surplus_qty` | decimal(14,3) | no | 0 | суммарный излишек (кэш для аналитики) |
| `shortage_qty` | decimal(14,3) | no | 0 | суммарная недостача (положит. число) |

### `inventory_item`
| Поле | Тип | Null | Описание |
|------|-----|------|----------|
| `id` | uuid | no | PK |
| `inventory_id` | FK → inventory | no | сессия |
| `product_id` | uuid/FK | no | товар (product или item_make по warehouse) |
| `qty_system` | decimal(14,3) | no | учётный остаток на момент сверки |
| `qty_fact` | decimal(14,3) | no | фактический остаток |
| `diff` | decimal(14,3) | no | `qty_fact − qty_system` (вычисляется на БЭ) |

**Индексы:** `inventory(warehouse, status)`, `inventory(created_at)`,
`inventory_item(inventory_id)`, `inventory_item(product_id)`.

---

## 4. API

### 4.1. Создать инвентаризацию

`POST /main/inventories/`

**Request body:**
```jsonc
{
  "warehouse": "finished_goods",        // finished_goods | raw_materials
  "comment": "Плановая инвентаризация",
  "status": "draft",                    // draft | confirmed
  "items": [
    { "product": "uuid", "qty_system": 100, "qty_fact": 120 },  // излишек +20
    { "product": "uuid", "qty_system": 50,  "qty_fact": 45 }    // недостача −5
  ]
}
```

**Логика:**
1. Создать `Inventory(status, user=request.user)`.
2. Для каждого item: создать `InventoryItem`, посчитать `diff = qty_fact − qty_system`.
3. Посчитать `surplus_qty = Σ diff>0`, `shortage_qty = Σ |diff<0|`.
4. Если `status == confirmed` → сразу применить корректировку (раздел 4.4).

**Response `201 Created`:** объект инвентаризации с `items` и `diff`-ами:
```jsonc
{
  "id": "uuid",
  "warehouse": "finished_goods",
  "status": "draft",
  "comment": "Плановая инвентаризация",
  "user_name": "Иванов И.",
  "created_at": "2026-06-24T19:10:00Z",
  "surplus_qty": 20,
  "shortage_qty": 5,
  "items": [
    { "product_name": "Стол", "qty_system": 100, "qty_fact": 120, "diff": 20 },
    { "product_name": "Стул", "qty_system": 50,  "qty_fact": 45,  "diff": -5 }
  ]
}
```

### 4.2. История инвентаризаций

`GET /main/inventories/?warehouse=finished_goods`

**Query (опц.):** `warehouse`, `status`, `date_from`, `date_to`, `limit`, `offset`.

**Response `200 OK`** (массив или `{results:[]}`):
```jsonc
[
  {
    "id": "uuid",
    "warehouse": "finished_goods",
    "status": "confirmed",
    "comment": "Плановая",
    "user_name": "Иванов И.",
    "created_at": "2026-06-24T19:10:00Z",
    "surplus_qty": 20,
    "shortage_qty": 5
  }
]
```
Фронт-колонки: Дата, Ответственный, Излишки, Недостачи, Комментарий, Статус.

### 4.3. Детали инвентаризации

`GET /main/inventories/{id}/` → объект с `items[]` (как в 4.1 response).

### 4.4. Подтверждение

`POST /main/inventories/{id}/confirm/`

**Логика (транзакционно):**
1. Если `status != draft` → `400` («Уже подтверждено/отменено»).
2. Для каждого `InventoryItem`: установить остаток товара = `qty_fact`
   (`product.quantity = qty_fact` или `+= diff`). Для `raw_materials` —
   аналогично по `ItemMake`.
3. `status = confirmed`, `confirmed_at = now`.
4. (Рекомендуется) записать движение/лог корректировки на каждую позицию для
   аудита (особенно недостачи — это потеря).

**Response `200 OK`:**
```jsonc
{ "id": "uuid", "status": "confirmed", "confirmed_at": "2026-06-24T19:20:00Z" }
```

---

## 5. Аналитика (раздельно: излишки / недостачи)

Эндпоинт `GET /main/owners/analytics/` расширяется полями (фронт уже читает):

```jsonc
{
  "summary": {
    "inventory_surplus_qty": 20,    // суммарный излишек за период (confirmed)
    "inventory_shortage_qty": 5     // суммарная недостача за период (confirmed)
  }
}
```

Drill-down карточек (`GET /main/analytics/cards/details/`):
- `card=inventory_surplus` → строки с `diff > 0`.
- `card=inventory_shortage` → строки с `diff < 0`.

**Строка детализации** (колонки на фронте уже настроены):
```jsonc
{
  "product_name": "Стол",
  "qty_system": 100,
  "qty_fact": 120,
  "diff": 20,
  "user_name": "Иванов И.",          // ответственный
  "created_at": "2026-06-24T19:10:00Z",
  "comment": "Плановая"
}
```

> «Историю инвентаризаций» и «ответственных» фронт также показывает прямо в
> модалке истории (раздел 7) — аналитические карточки дают агрегаты за период.

---

## 6. Обработка ошибок

```jsonc
{ "items": ["Добавьте хотя бы одну позицию."] }                         // 400
{ "detail": "Инвентаризация уже подтверждена." }                        // 400
{ "qty_fact": ["Количество не может быть отрицательным."] }             // 400
{ "detail": "Товар не найден." }                                        // 404
{ "detail": "Недостаточно прав." }                                      // 403
```

| Код | Когда |
|-----|-------|
| `200/201` | Успех |
| `400` | пустой список, повторное подтверждение, отрицательные значения |
| `403` | Нет прав |
| `404` | Инвентаризация/товар не найдены |
| `500` | Внутренняя ошибка |

Все сообщения — на русском; фронт показывает их в баннере формы.

---

## 7. Права доступа

- Создание/подтверждение инвентаризации — владелец и роли с правом управления
  складом Производства (как «Добавить товар» / «Перемещение»). Новых прав не
  вводить.
- История — read для тех же ролей.
- `user` инвентаризации = `request.user` (ответственный фиксируется автоматически).

---

## 8. Последовательность действий (backend)

1. Создать таблицы `inventory`, `inventory_item` (раздел 3) + индексы.
2. `POST /main/inventories/` — создание (draft/confirmed), расчёт `diff`,
   `surplus_qty`, `shortage_qty` (раздел 4.1).
3. `GET /main/inventories/` и `GET /main/inventories/{id}/` (4.2, 4.3).
4. `POST /main/inventories/{id}/confirm/` — корректировка остатков (4.4).
5. Расширить `GET /main/owners/analytics/` полями `inventory_surplus_qty`,
   `inventory_shortage_qty` и drill-down `inventory_surplus`/`inventory_shortage`.
6. Тесты-инварианты:
   - после `confirm`: остаток товара == `qty_fact`;
   - `surplus_qty == Σ diff>0`, `shortage_qty == Σ|diff<0|`;
   - повторный `confirm` запрещён.

---

## 9. Связь с фронтендом (что уже сделано)

| Фронт | Деталь |
|-------|--------|
| Экран сверки | `Inventory/InventoryModals.jsx → InventoryModal` (таблица: Товар, Учётный, Фактически, Расхождение; излишек/недостача-бейджи; сводка) |
| Создать | `POST /main/inventories/ { warehouse, comment, status, items[] }` (draft / confirmed) |
| История | `InventoryHistoryModal` (Дата, Ответственный, Излишки, Недостачи, Комментарий, Статус) |
| Запрос истории | `GET /main/inventories/?warehouse=...` |
| Подтверждение | `POST /main/inventories/{id}/confirm/` (с подтверждением) |
| Точка входа | кнопки «Инвентаризация» и «История инвент.» в шапке «Склад готовой продукции» |
| Аналитика | карточки «Излишки»/«Недостачи» (`summary.inventory_surplus_qty`/`shortage_qty`) + drill-down `inventory_surplus`/`inventory_shortage` |
| Склад сырья | тот же компонент с `warehouse="raw_materials"` (готов к подключению) |

Клиентская валидация: хотя бы одна посчитанная позиция; расхождение считается на
лету; ошибки бэка — через `validateResErrors`.
