# Офлайн-режим сферы «Кафе»

Документ описывает текущую реализацию офлайн-работы в модуле кафе: архитектуру, покрытие по страницам, сценарии использования, риски и возможные доработки.

---

## Содержание

1. [Архитектура](#архитектура)
2. [Локальное хранилище (IndexedDB)](#локальное-хранилище-indexeddb)
3. [Снимок данных (snapshot)](#снимок-данных-snapshot)
4. [Axios fallback](#axios-fallback)
5. [Синхронизация очереди](#синхронизация-очереди)
6. [UI индикации](#ui-индикации)
7. [Что работает офлайн](#что-работает-офлайн)
8. [Что не работает офлайн](#что-не-работает-офлайн)
9. [Типы действий в очереди](#типы-действий-в-очереди)
10. [Риски и ограничения](#риски-и-ограничения)
11. [Покрытие по страницам](#покрытие-по-страницам)
12. [Рекомендуемый сценарий использования](#рекомендуемый-сценарий-использования)
13. [Приоритетные доработки](#приоритетные-доработки)
14. [Ключевые файлы](#ключевые-файлы)

---

## Архитектура

Офлайн построен на трёх слоях:

```
┌─────────────────────────────────────────────────────────┐
│  UI: CafeLayout, OfflineStatusBar, Orders.jsx, …        │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Синхронизация: useCafeSync + useNetworkStatus           │
│  (авто-sync при переходе offline → online)                │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  IndexedDB (NurCafeOffline) + localStorage                │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Backend: GET /cafe/offline-snapshot/                   │
│           POST /cafe/offline-sync/                        │
└─────────────────────────────────────────────────────────┘
```

**Поток данных:**

1. При открытии смены (онлайн) скачивается snapshot и сохраняется в IndexedDB.
2. При обрыве сети axios-интерцептор подставляет данные из snapshot для GET-запросов кафе.
3. Критичные мутации в `Orders.jsx` явно пишутся в `offline_queue` через `addToQueue`.
4. При восстановлении сети `useCafeSync` отправляет очередь на бэкенд, маппит offline-ID → server UUID, обновляет snapshot.

---

## Локальное хранилище (IndexedDB)

**Файл:** `src/db/cafeOfflineDB.js`  
**База:** `NurCafeOffline` (Dexie)

| Таблица | Назначение |
|---------|------------|
| `menu_categories` | Категории меню |
| `menu_items` | Позиции меню |
| `cafe_tables` | Столы и их статусы |
| `open_orders` | Открытые заказы |
| `current_shift` | Текущая смена |
| `offline_queue` | Очередь действий для синхронизации |
| `id_mapping` | Соответствие `offline-*` → server UUID |

**Сервис:** `src/services/cafeOfflineService.js`

Основные функции:

- `saveSnapshot(snapshot)` — полная перезапись snapshot в IndexedDB
- `getSnapshot()` — чтение всех локальных данных
- `addToQueue(type, payload)` — добавление действия в очередь
- `getPendingQueue()` — несинхронизированные действия
- `markSynced(ids)` — пометка действий как отправленных
- `saveIdMapping(offlineId, serverId)` — маппинг ID после sync
- `resolveOrderId(id)` — подстановка server ID для offline-заказа
- `remapQueueOrderIds(offlineId, serverId)` — обновление order_id в очереди
- `pruneDeadQueueActions()` — удаление «мёртвых» действий (например, REMOVE для несуществующих offline-позиций)
- `createOrderLocally`, `updateOrderLocally`, `removeOrderLocally`, `addOrderLocally` — CRUD заказов локально
- `updateTableStatusLocally(tableId, status)` — статус стола (`busy` / `free`)

---

## Снимок данных (snapshot)

**Эндпоинт:** `GET /cafe/offline-snapshot/`

**Когда сохраняется:**

1. При **открытии смены** — `src/Components/Sectors/cafe/CafeOpenShift/CafeOpenShift.jsx`
2. После **успешной синхронизации** — `src/hooks/useCafeSync.js`

**Содержимое snapshot:**

- `menu.categories`, `menu.items`
- `tables`
- `open_orders`
- `current_shift`
- `snapshot_at` (также в `localStorage` как `cafe_snapshot_at`)

**Важно:** без предварительно сохранённого snapshot IndexedDB пустая — офлайн-режим практически неработоспособен.

---

## Axios fallback

**Файлы:**

- `src/api/index.js` — интерцептор ответа при сетевой ошибке
- `src/services/cafeOfflineFallback.js` — логика подстановки данных

**Условие срабатывания** (любое из):

- `ERR_NETWORK`
- `ECONNABORTED`
- `Network Error`
- `!navigator.onLine`

**URL, попадающие под fallback:**

- `/cafe/`
- `/orders/`
- `/tables/`
- `/menu/`

### GET-запросы — данные из snapshot

| URL-паттерн | Ответ |
|-------------|-------|
| `offline-snapshot` | Полный snapshot из IndexedDB |
| `/menu/`, `/categories/` | `{ results: categories, count }` |
| `/menu-items/` (список) | `{ results: items, count }` |
| `/menu-items/{uuid}/` | Одна позиция меню |
| `/tables/` | `{ results: tables, count }` |
| `/orders/` (список) | `{ results: open_orders, count }` |
| `/orders/{uuid}/` | Один заказ (только UUID) |
| `/shifts/` | `current_shift` |
| Прочие GET | `{ results: [], count: 0 }` |

### POST / PATCH / PUT / DELETE

Возвращается заглушка:

```json
{ "offline": true, "queued": true }
```

**Критично:** это **не** ставит действие в очередь автоматически. Реальная очередь создаётся только там, где явно вызывается `addToQueue` (в основном `Orders.jsx`).

---

## Синхронизация очереди

**Хук:** `src/hooks/useCafeSync.js`  
**Эндпоинт:** `POST /cafe/offline-sync/`

### Алгоритм

1. При переходе `offline → online` вызывается `syncQueue()`.
2. `pruneDeadQueueActions()` — очистка неактуальных действий.
3. Отправка всех pending-действий на бэкенд.
4. Обработка ответа:
   - `created_order_ids` — маппинг offline-ID → server ID
   - `failed` — частичные ошибки (индексы действий)
5. Успешные действия помечаются `synced: true`.
6. Загрузка свежего snapshot с сервера.
7. Событие `orders:refresh` для обновления UI.

### Ответ бэкенда (ожидаемый контракт)

```json
{
  "failed": [
    { "action_index": 2, "type": "CLOSE_ORDER", "error": "..." }
  ],
  "created_order_ids": ["uuid-1", "uuid-2"]
}
```

---

## UI индикации

**Компонент:** `src/Components/Sectors/cafe/common/OfflineStatusBar.jsx`  
**Подключение:** `CafeLayout.jsx` (фиксированная полоска сверху)

| Состояние | Цвет | Текст |
|-----------|------|-------|
| Офлайн | Жёлтый | «Офлайн — работаем локально · N заказов ожидают синхронизации» |
| Синхронизация | Синий | «Синхронизация...» |
| Успех | Зелёный | «Синхронизировано» (3 сек) |
| Частичный сбой | Оранжевый | «N действий не применились» + детали + кнопка «Убрать» |
| Ошибка sync | Красный | «Ошибка синхронизации» + кнопка «Повторить» |

**Сеть:** `src/hooks/useNetworkStatus.js` — слушает `online` / `offline` события браузера.

**Подавление ошибок:** `src/utils/cafeOfflineError.js` — `suppressOfflineError()` скрывает сетевые ошибки на второстепенных страницах.

---

## Что работает офлайн

### Полноценно: раздел «Заказы» (`Orders.jsx`)

| Операция | Тип в очереди | Локальные изменения |
|----------|---------------|---------------------|
| Создание заказа | `CREATE_ORDER` | Запись в `open_orders`, стол → `busy` |
| Редактирование (добавить позиции) | `ADD_ITEM_TO_ORDER` | `updateOrderLocally` |
| Редактирование (убрать позиции) | `REMOVE_ITEM_FROM_ORDER` | `updateOrderLocally` |
| Оплата / закрытие | `CLOSE_ORDER` | Удаление из `open_orders`, стол → `free` |
| Отмена заказа | `CANCEL_ORDER` | Удаление из `open_orders` |

**Чтение данных офлайн:**

- Заказы — `getOpenOrdersLocally()`
- Столы — `getSnapshot().tables`
- Меню — `getSnapshot().items`
- Смена — snapshot + Redux `shifts`

**Offline ID заказов:**

```
offline-{timestamp}-{random}
offline-item-{timestamp}-{index}
```

**Оплата офлайн:**

1. Попытка фискализации через локальный коннектор (`fiscalDriverService`, `localhost:8080`).
2. Payload для чека запрашивается с бэкенда — для `offline-*` ID без интернета **не работает**.
3. Заказ закрывается локально, `CLOSE_ORDER` ставится в очередь.

### Частично: раздел «Столы» (`Tables.jsx`)

- Столы и активные заказы подтягиваются через axios fallback из snapshot.
- **Зоны** (`/cafe/zones/`) в fallback **не покрыты** → пустой список.
- Локальные изменения статуса стола из `Orders.jsx` видны (IndexedDB).
- CRUD зон/столов офлайн **не ставится в очередь**.

### Частично: меню в форме заказа

- Первая загрузка меню офлайн — весь snapshot (`fetchMenu` при `!isOnline`).
- Пагинация и поиск меню (`handleMenuPageChange`) — всегда через API, офлайн не поддержаны.

### Только «не падать с ошибкой»

На страницах с `suppressOfflineError` сетевые ошибки подавляются, но локальной логики нет:

- Menu, Stock, Costing, Inventory, Analytics, Clients, Cook, CafeOrdersHistory и др.

---

## Что не работает офлайн

| Раздел | Причина |
|--------|---------|
| **Кухня (Cook)** | Kitchen tasks только через API + WebSocket |
| **Касса** | Нет snapshot/очереди |
| **Аналитика, склад, закупки, payroll, отчёты** | Нет offline-логики |
| **Редактирование меню / столов / зон** | POST/PATCH дают заглушку без реальной очереди |
| **WebSocket** (столы, заказы, кухня) | Требует интернет |
| **Автопечать** (`CafeLayout`) | Зависит от API (детали заказа, кухни, menu-items) |
| **Открытие смены** | `openShiftAsync` — сетевой вызов; snapshot скачивается только после успешного открытия |
| **Сотрудники, клиенты, кассы** | Не кэшируются в snapshot |
| **Бронирования, документы** | Нет offline-поддержки |

---

## Типы действий в очереди

Поддерживаются на фронте:

| Тип | Описание |
|-----|----------|
| `CREATE_ORDER` | Создание заказа |
| `ADD_ITEM_TO_ORDER` | Добавление позиции |
| `REMOVE_ITEM_FROM_ORDER` | Удаление позиции |
| `CLOSE_ORDER` | Оплата / закрытие |
| `CANCEL_ORDER` | Отмена заказа |

**Очистка очереди:** `pruneDeadQueueActions()` удаляет `REMOVE_ITEM_FROM_ORDER` для offline-заказов/позиций, которые ещё не синхронизированы с сервером.

---

## Риски и ограничения

### 1. Snapshot обязателен до обрыва связи

Если смена была открыта давно и snapshot не обновлялся — меню, столы и заказы могут быть устаревшими. Единственные точки обновления: открытие смены и успешный sync.

### 2. Заглушка мутаций в axios

Любой POST/PATCH/PUT/DELETE вне явной обработки в `Orders.jsx` возвращает `{ offline: true, queued: true }`, но **ничего не синхронизируется**. UI может считать операцию успешной.

### 3. Offline ID не попадают в fallback деталей заказа

В `cafeOfflineFallback.js` regex для детали заказа только UUID:

```js
url.match(/orders\/([0-9a-f-]{36})/i)
```

Для `/cafe/orders/offline-123-abc/` возвращается **список** `open_orders`, а не один заказ. Это ломает:

- `hydrateOrdersDetails`
- фискализацию (`runFiscalReceipt`)
- автопечать в `CafeLayout`

### 4. Широкий паттерн `/orders/` в fallback

URL вида `/cafe/fiscal/orders/.../receipt-payload/` тоже попадает под ветку orders и получает некорректный ответ (список заказов вместо fiscal payload).

### 5. Фискализация offline-заказов

`runFiscalReceipt` сначала запрашивает payload с бэкенда:

```
GET /cafe/fiscal/orders/{orderId}/receipt-payload/
```

Для `offline-*` ID без интернета чек не пробивается. Оплата всё равно проходит с предупреждением «Фискальный чек не пробит».

### 6. Синхронизация только при reconnect

Auto-sync срабатывает при переходе `navigator.onLine: false → true`. Ручная кнопка «Синхронизировать» — только при ошибке sync в `OfflineStatusBar`. Если сеть «есть», но API недоступен — auto-sync может не сработать.

### 7. Меню офлайн без пагинации и поиска

`fetchMenu` offline отдаёт весь snapshot. `handleMenuPageChange` всегда обращается к API.

### 8. Конфликты при sync

Частичные ошибки показываются в UI. Failed actions можно удалить из очереди вручную. Стратегии merge / conflict resolution на фронте нет.

### 9. WebSocket недоступен офлайн

Изменения с других устройств не приходят. После sync событие `orders:refresh` частично компенсирует это.

### 10. Два источника правды для заказов

- Redux / state компонента
- IndexedDB `open_orders`

При рассинхроне возможны расхождения до следующего `fetchOrders` или sync.

---

## Покрытие по страницам

| Страница | Маршрут | Офлайн |
|----------|---------|--------|
| **Заказы** | `/cafe/orders` | ✅ Полный цикл: создание, правки, оплата, отмена + очередь |
| **История заказов** | `/cafe/orders/history` | ❌ Только подавление ошибок |
| **Столы** | `/cafe/tables` | ⚠️ Просмотр из snapshot; зоны и редактирование — нет |
| **Меню** | `/cafe/menu` | ❌ Просмотр/редактирование не работает офлайн |
| **Кухня** | `/cafe/cook` | ❌ |
| **Касса** | `/cafe/kassa` | ❌ |
| **Клиенты** | `/cafe/clients` | ❌ |
| **Склад** | `/cafe/stock` | ❌ |
| **Инвентарь** | `/cafe/inventory` | ❌ |
| **Калькуляция** | `/cafe/costing` | ❌ |
| **Аналитика** | `/cafe/analytics` | ❌ |
| **Закупки, payroll, отчёты, брони, документы** | — | ❌ |
| **Открытие смены** | внутри Orders | ❌ Требует сеть |

---

## Рекомендуемый сценарий использования

### Подготовка (онлайн)

1. Открыть смену в разделе «Заказы».
2. Убедиться, что snapshot сохранился (в консоли: «Snapshot обновлён при открытии смены»).
3. Проверить, что меню и столы загружаются.

### Работа офлайн

1. Использовать в основном раздел **«Заказы»**.
2. Создавать и редактировать заказы — изменения пишутся локально и в очередь.
3. Принимать оплату — заказ исчезает из списка, стол освобождается локально.
4. Следить за жёлтой полоской «Офлайн — работаем локально».

### После восстановления сети

1. Дождаться auto-sync (синяя → зелёная полоска).
2. Проверить оранжевую полоску на partial failures.
3. При необходимости удалить проблемные действия из очереди или повторить sync.
4. Убедиться, что заказы и столы совпадают с сервером.

### Не рассчитывать офлайн на

- Кухню и поварской экран
- Кассу и финансовые отчёты
- Редактирование справочников (меню, столы, зоны)
- Открытие новой смены без интернета
- Фискальные чеки для заказов, созданных офлайн (до sync)

---

## Приоритетные доработки

### Высокий приоритет

1. **Исправить fallback для offline-ID** — поддержка `offline-*` в GET `/cafe/orders/{id}/`.
2. **Исключить fiscal URL** из ветки orders в `cafeOfflineFallback.js`.
3. **Убрать ложный `{ queued: true }`** — не возвращать fake success для мутаций без реальной очереди.

### Средний приоритет

4. **Расширить snapshot** — zones, employees, clients, kitchens.
5. **Кнопка «Синхронизировать сейчас»** при `pendingCount > 0` (не только при ошибке).
6. **Offline fiscal payload** — локальная сборка чека из `open_orders` без запроса к бэкенду.

### Низкий приоритет

7. Очередь для критичных операций кухни или локальный режим повара.
8. Sync по таймеру при наличии pending-действий.
9. Стратегия разрешения конфликтов при partial sync.
10. Офлайн-пагинация/поиск меню из snapshot.

---

## Ключевые файлы

| Файл | Назначение |
|------|------------|
| `src/db/cafeOfflineDB.js` | Схема IndexedDB |
| `src/services/cafeOfflineService.js` | CRUD snapshot, очередь, маппинг ID |
| `src/services/cafeOfflineFallback.js` | Axios fallback для GET/заглушки мутаций |
| `src/hooks/useCafeSync.js` | Auto-sync при reconnect |
| `src/hooks/useNetworkStatus.js` | Онлайн/офлайн статус браузера |
| `src/utils/cafeOfflineError.js` | Подавление сетевых ошибок |
| `src/api/index.js` | Интерцептор axios для offline fallback |
| `src/Components/Sectors/cafe/common/OfflineStatusBar.jsx` | UI статуса офлайн/sync |
| `src/Components/Sectors/cafe/CafeLayout.jsx` | Подключение OfflineStatusBar |
| `src/Components/Sectors/cafe/Orders/Orders.jsx` | Основная offline-логика заказов |
| `src/Components/Sectors/cafe/CafeOpenShift/CafeOpenShift.jsx` | Snapshot при открытии смены |
| `src/Components/Sectors/cafe/Tables/Tables.jsx` | Частичное чтение из snapshot |
| `src/services/fiscalDriverService.js` | Локальный fiscal connector |

---

## Backend API (контракт)

Эндпоинты офлайн-режима (не менять без согласования с клиентом):

| Метод | URL | Назначение |
|-------|-----|------------|
| GET | `/api/cafe/offline-snapshot/` | Снимок данных для IndexedDB |
| POST | `/api/cafe/offline-sync/` | Применение очереди действий |

Формат действий в `offline-sync`:

```json
{
  "actions": [
    {
      "type": "CREATE_ORDER",
      "payload": { "client_id": "offline-...", "table_id": "...", "items": [] },
      "created_at": "2026-06-15T12:00:00.000Z"
    }
  ]
}
```

---

*Документ актуален на состояние кодовой базы Nur CRM, модуль кафе.*
