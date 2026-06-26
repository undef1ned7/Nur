# 07 — Журнал движения склада + вкладки «Инвентаризация» и «Перемещение»

> Статус фронтенда: **готов к подключению**. На странице
> `/crm/production/warehouse` добавлены две вкладки. «Инвентаризация»
> переиспользует API из `05-inventory.md`. «Перемещение» читает **новый**
> журнал движений (этот документ). При отсутствии API — загрузка/пусто/ошибка
> отображаются корректно, существующий склад не ломается.

---

## 1. Бизнес-процесс

Нужен **единый журнал движения склада** — неизменяемая лента всех операций,
влияющих на остатки. Любое изменение остатка порождает запись в журнале.

**Типы операций (`type`):**
| Код | Название |
|-----|----------|
| `income` | Приход |
| `expense` | Расход |
| `transfer` | Перемещение (между складами) |
| `return` | Возврат |
| `writeoff` | Списание |
| `inventory` | Инвентаризация (корректировка по сверке) |
| `adjustment` | Корректировка остатков (ручная) |
| `agent_transfer` | Передача агенту |
| `agent_return` | Возврат от агента |
| `staff_transfer` | Передача между сотрудниками |
| `staff_return` | Возврат между сотрудниками |

Журнал **только на чтение** для UI (записи создаёт бэкенд при выполнении
операций). Фронт показывает историю с фильтрами, пагинацией и деталями.

---

## 2. Сущность журнала

```
StockMovement (журнал движения склада)        [/main/stock-movements/]  (НОВАЯ)
   ├── id
   ├── type                 enum (см. п.1)
   ├── product (FK) → Product | ItemMake
   ├── qty_before           остаток ДО
   ├── change               изменение (+/−)
   ├── qty_after            остаток ПОСЛЕ
   ├── source (FK/text)     откуда (склад/сотрудник/агент)
   ├── target (FK/text)     куда
   ├── sender (FK) → User/Agent     отправитель
   ├── receiver (FK) → User/Agent   получатель
   ├── created_by (FK) → User       автор операции
   ├── comment
   ├── created_at
   └── ref_type / ref_id    ссылка на породившую операцию (subreal, return,
                            inventory, cashflow, finished_to_raw_transfer …)
```

`ref_type` + `ref_id` связывают запись журнала с конкретной бизнес-операцией
(передача/возврат/инвентаризация/перемещение в сырьё и т.д.) — для трассировки.

---

## 3. Изменения в БД — таблица `stock_movement`

| Поле | Тип | Null | Описание |
|------|-----|------|----------|
| `id` | uuid | no | PK |
| `type` | varchar(24) | no | тип операции (enum, п.1) |
| `product_id` | uuid | no | товар (product/item_make) |
| `warehouse` | varchar(20) | yes | `finished_goods` / `raw_materials` / `agent` |
| `qty_before` | decimal(14,3) | no | остаток до |
| `change` | decimal(14,3) | no | изменение (+/−) |
| `qty_after` | decimal(14,3) | no | остаток после |
| `source_type` | varchar(20) | yes | `warehouse`/`staff`/`agent` |
| `source_id` | uuid | yes | id источника |
| `target_type` | varchar(20) | yes | — |
| `target_id` | uuid | yes | — |
| `sender_id` | uuid | yes | отправитель (user/agent) |
| `receiver_id` | uuid | yes | получатель |
| `created_by_id` | FK → user | no | автор |
| `comment` | text | yes | комментарий |
| `ref_type` | varchar(40) | yes | сущность-источник |
| `ref_id` | uuid | yes | id сущности-источника |
| `created_at` | timestamp | no | дата/время |

**Индексы:**
```sql
CREATE INDEX idx_sm_created_at ON stock_movement (created_at DESC);
CREATE INDEX idx_sm_type       ON stock_movement (type);
CREATE INDEX idx_sm_product    ON stock_movement (product_id);
CREATE INDEX idx_sm_warehouse  ON stock_movement (warehouse);
CREATE INDEX idx_sm_sender     ON stock_movement (sender_id);
CREATE INDEX idx_sm_receiver   ON stock_movement (receiver_id);
```

> **Источник записей:** журнал заполняется на бэкенде **внутри тех же
> транзакций**, что и операции (приход/расход/передача/приёмка/возврат/брак/
> инвентаризация/перемещение в сырьё/корректировка). Это центральный аудит —
> существующие эндпоинты не меняют контракт, лишь дополнительно пишут в журнал.

---

## 4. API — журнал движений

### 4.1. `GET /main/stock-movements/`

**Query params:**
| Параметр | Тип | Описание |
|----------|-----|----------|
| `type` | string | фильтр по типу операции (п.1) |
| `warehouse` | string | `finished_goods` / `raw_materials` / `agent` |
| `date_from`, `date_to` | date | период по `created_at` |
| `search` | string | поиск по товару / сотруднику / агенту (имена) |
| `product` | uuid | фильтр по товару (опц.) |
| `employee` | uuid | фильтр по сотруднику (опц.) |
| `agent` | uuid | фильтр по агенту (опц.) |
| `limit`, `offset` | int | пагинация (фронт шлёт `limit=25`) |

**Response `200 OK`** (пагинированный — фронт читает `results` и `count`):
```jsonc
{
  "count": 1240,
  "next": "...",
  "previous": null,
  "results": [
    {
      "id": "uuid",
      "type": "agent_transfer",
      "created_at": "2026-06-24T19:40:00Z",
      "product_name": "Стол дубовый",
      "warehouse": "finished_goods",
      "qty_before": 100,
      "change": -20,
      "qty_after": 80,
      "source_name": "Склад готовой продукции",
      "target_name": "Агент Иванов",
      "sender_name": "Кладовщик Пётр",
      "receiver_name": "Иванов И.",
      "created_by_name": "Кладовщик Пётр",
      "comment": "Передача партии"
    }
  ]
}
```

> Фронт-колонки: Дата/время, Тип операции, Товар, Изменение, Откуда, Куда,
> Отправитель, Получатель, Автор + детали (До / Изменение / После).
> Толерантен к именам: `source_name|source`, `target_name|target`,
> `sender_name|sender`, `receiver_name|receiver`, `created_by_name|user_name|user`,
> `change|delta`, `product_name|product`.

**Статусы:** `200`. Ошибки — раздел 6.

### 4.2. Детали (опционально)

`GET /main/stock-movements/{id}/` → одиночная запись (та же форма).
Фронт показывает детали из строки списка, отдельный запрос не обязателен.

---

## 5. Вкладка «Инвентаризация» (переиспользует `05-inventory.md`)

- `GET /main/inventories/` — история (колонки: № док., дата, кто создал, склад,
  статус, кол-во позиций, излишки, недостачи, комментарий).
- `GET /main/inventories/{id}/` — детали (позиции с расхождениями).
- `POST /main/inventories/` — «Провести инвентаризацию» (draft/confirmed).
- `POST /main/inventories/{id}/confirm/` — подтверждение.

> Дополнительно к `05-inventory.md` для истории желательны поля списка:
> `doc_no` (номер документа), `items_count` (кол-во позиций). Если их нет —
> фронт показывает `—` / считает по `items.length`.

Подтверждение инвентаризации **должно** порождать записи `StockMovement`
(`type=inventory`, `change = diff` по каждой позиции).

---

## 6. Обработка ошибок

```jsonc
{ "detail": "Учётные данные не были предоставлены." }   // 401
{ "detail": "Недостаточно прав." }                       // 403
{ "type": ["Недопустимый тип операции."] }               // 400
```

| Код | Когда |
|-----|-------|
| `200` | Успех |
| `400` | Некорректные фильтры |
| `401` | Нет авторизации |
| `403` | Нет прав |
| `500` | Внутренняя ошибка |

Фронт: состояние «Загрузка…», «Движений не найдено» (пусто), баннер ошибки
(текст из `validateResErrors`). Журнал — read-only, изменение данных невозможно.

---

## 7. Права доступа

- `GET /main/stock-movements/` и `GET /main/inventories/` — владелец и роли с
  доступом к складу Производства (как у текущих вкладок склада). Новых прав не
  вводить.
- Запись в журнал — серверная, в рамках операций; пользователь не создаёт записи
  журнала напрямую через UI.

---

## 8. Последовательность действий (backend)

1. Создать таблицу `stock_movement` (раздел 3) + индексы.
2. В каждую складскую операцию (приход/расход/передача/приёмка/возврат/брак/
   списание/инвентаризация/корректировка/перемещение в сырьё/передачи и возвраты
   между сотрудниками и агентами) добавить запись в журнал **в той же
   транзакции** с `qty_before/change/qty_after` и `ref_type/ref_id`.
3. Реализовать `GET /main/stock-movements/` с фильтрами и пагинацией (раздел 4).
4. (Опц.) `GET /main/stock-movements/{id}/`.
5. Дополнить список инвентаризаций полями `doc_no`, `items_count` (раздел 5).
6. Тесты: сумма `change` по товару из журнала == текущему остатку (инвариант
   целостности).

---

## 9. Связь с фронтендом (что уже сделано)

| Фронт | Деталь |
|-------|--------|
| Вкладка «Инвентаризация» | `Warehouse/ProductionInventoryTab.jsx` — история + «Провести инвентаризацию» (переиспользует `InventoryModal`) + детали |
| Вкладка «Перемещение» | `Warehouse/ProductionMovementsTab.jsx` — журнал + фильтры (тип, склад, период, поиск) + пагинация + детали |
| Запрос журнала | `GET /main/stock-movements/?type&warehouse&date_from&date_to&search&limit&offset` |
| Запрос инвентаризаций | `GET /main/inventories/`, `GET /main/inventories/{id}/` |
| Регистрация вкладок | `Warehouse/ProductionWarehouse.jsx` (в массив `tabs`) |
| Состояния | загрузка / пусто / ошибка (баннер) — реализованы |
| Темы и адаптив | под `.prod` (light/dark), таблицы скроллятся, тач-таргеты |

Существующие вкладки («Склад готовой продукции», «Склад сырья», «Запросы») и вся
их логика — без изменений.
