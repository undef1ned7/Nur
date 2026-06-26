# 03 — Перемещение ГОТОВОЙ ПРОДУКЦИИ в СЫРЬЁ (частичное)

> Статус фронтенда: **готов к подключению**. Экран перемещения, история и отмена
> уже вызывают эндпоинты ниже; при их отсутствии — безопасная ошибка через
> `validateResErrors`, склад не ломается.

---

## 1. Бизнес-процесс

Иногда готовую продукцию нужно **частично** вернуть в сырьё (переработка,
разборка, исправление). Товар **не должен исчезать целиком** — перемещается
только указанное количество.

**Сценарий:**
```
Готовая продукция:  100 шт
Переместить:         20 шт
─────────────────────────────
Готовая продукция:   80 шт   (product.quantity -= 20)
Склад сырья:        +20 шт   (items-make += 20, или создаётся запись сырья)
```

Каждое перемещение фиксируется записью истории с:
- товаром (готовая продукция);
- количеством;
- **причиной** (комментарий);
- **пользователем**, выполнившим операцию;
- **датой и временем**.

Любое перемещение можно **отменить** (возврат количества в готовую продукцию и
списание из сырья).

---

## 2. Сущности и связи

```
Product (готовая продукция)            [/main/products/]
   │  quantity
   │
   ├──< FinishedToRawTransfer >──┐     [/main/finished-to-raw-transfers/]  (НОВАЯ)
   │      product (FK)           │
   │      raw_item (FK)──────────┘──→ ItemMake (сырьё)  [/main/items-make/]
   │      quantity
   │      reason
   │      user (FK) → User
   │      status: done | canceled
   │      created_at, canceled_at
```

Связи:
- `FinishedToRawTransfer.product → Product` (откуда списали).
- `FinishedToRawTransfer.raw_item → ItemMake` (куда добавили в сырьё).
- `FinishedToRawTransfer.user → User` (кто выполнил).

---

## 3. Изменения в БД — новая таблица `finished_to_raw_transfer`

| Поле | Тип | Null | Default | Описание |
|------|-----|------|---------|----------|
| `id` | uuid | no | — | PK |
| `product_id` | FK → product | no | — | готовая продукция-источник |
| `raw_item_id` | FK → item_make | yes | — | созданное/обновлённое сырьё (заполняется при выполнении) |
| `quantity` | decimal(14,3) | no | — | перемещённое количество (> 0) |
| `reason` | text | yes | `''` | причина перемещения |
| `status` | varchar(16) | no | `done` | `done` / `canceled` |
| `user_id` | FK → user | no | — | кто выполнил |
| `created_at` | timestamp | no | now() | дата/время операции |
| `canceled_at` | timestamp | yes | — | дата/время отмены |
| `canceled_by_id` | FK → user | yes | — | кто отменил |

**Индексы:**
```sql
CREATE INDEX idx_f2r_product    ON finished_to_raw_transfer (product_id);
CREATE INDEX idx_f2r_status     ON finished_to_raw_transfer (status);
CREATE INDEX idx_f2r_created_at ON finished_to_raw_transfer (created_at);
```

> **Сопоставление с сырьём:** при перемещении бэкенд должен найти/создать запись
> `ItemMake` (сырьё), соответствующую продукту (по имени/связи `product↔item_make`
> или явной мапе). Рекомендуется хранить ссылку `Product.raw_item_id` или
> правило мэппинга, чтобы повторные перемещения одного товара суммировались в
> одну запись сырья.

---

## 4. API

### 4.1. Выполнить перемещение

`POST /main/products/{product_id}/move-to-raw/`

**Request body:**
```jsonc
{
  "quantity": 20,            // > 0 и ≤ product.quantity
  "reason": "Переработка"    // опционально
}
```

**Логика (транзакционно):**
1. Проверить `0 < quantity ≤ product.quantity`.
2. `product.quantity -= quantity`.
3. Найти/создать `ItemMake` для этого продукта, `item_make.quantity += quantity`.
4. Создать `FinishedToRawTransfer(status=done, user=request.user, created_at=now)`.
5. Вернуть созданную запись.

**Response `201 Created`:**
```jsonc
{
  "id": "uuid",
  "product": "uuid",
  "product_name": "Стол дубовый",
  "raw_item": "uuid",
  "quantity": 20,
  "reason": "Переработка",
  "status": "done",
  "user_name": "Иванов И.",
  "created_at": "2026-06-24T18:40:00Z",
  "product_remaining": 80,     // остаток в готовой (для UX)
  "raw_total": 120             // итог в сырье (опц.)
}
```

### 4.2. История перемещений

`GET /main/finished-to-raw-transfers/`

**Query (опц.):** `product`, `status`, `date_from`, `date_to`, `limit`, `offset`.

**Response `200 OK`** (массив или `{results:[...]}` — фронт принимает оба):
```jsonc
[
  {
    "id": "uuid",
    "product_name": "Стол дубовый",
    "quantity": 20,
    "reason": "Переработка",
    "status": "done",                 // done | canceled
    "user_name": "Иванов И.",
    "created_at": "2026-06-24T18:40:00Z"
  }
]
```

Фронт-колонки: Товар, Кол-во, Причина, Пользователь, Дата и время, Статус.
(Толерантен к именам: `product_name|product`, `quantity|qty`,
`user_name|created_by_name|user`, `created_at|moved_at`.)

### 4.3. Отмена перемещения

`POST /main/finished-to-raw-transfers/{id}/cancel/`

**Логика (транзакционно):**
1. Если `status == canceled` → `400` («Уже отменено»).
2. `product.quantity += quantity` (вернуть в готовую).
3. `item_make.quantity -= quantity` (списать из сырья). Если в сырье уже меньше —
   `409`/`400` с понятным сообщением (нельзя отменить, сырьё израсходовано).
4. `status = canceled`, `canceled_at = now`, `canceled_by = request.user`.

**Response `200 OK`:**
```jsonc
{ "id": "uuid", "status": "canceled", "canceled_at": "2026-06-24T19:00:00Z" }
```

---

## 5. Обработка ошибок

```jsonc
{ "quantity": ["Количество должно быть больше нуля."] }                 // 400
{ "detail": "Нельзя переместить больше, чем есть. Доступно: 80." }      // 400
{ "detail": "Перемещение уже отменено." }                              // 400
{ "detail": "Невозможно отменить: сырьё уже израсходовано." }          // 409
{ "detail": "Товар не найден." }                                       // 404
{ "detail": "Недостаточно прав." }                                     // 403
```

| Код | Когда |
|-----|-------|
| `200/201` | Успех |
| `400` | quantity ≤ 0, quantity > остатка, уже отменено |
| `403` | Нет прав |
| `404` | Товар/перемещение не найдены |
| `409` | Конфликт при отмене (сырьё израсходовано) |
| `500` | Внутренняя ошибка |

Все сообщения — на русском, человекочитаемые (фронт показывает их напрямую под
полем/в баннере).

---

## 6. Права доступа

- Выполнять перемещение и отмену — владелец и роли с правом управления складом
  готовой продукции (как у «Передать товар» / «Принять возврат»). Новых прав
  вводить не нужно — переиспользовать существующую проверку склада Производства.
- История доступна тем же ролям (read).

---

## 7. Последовательность действий (backend)

1. Создать таблицу `finished_to_raw_transfer` (раздел 3) + индексы.
2. Реализовать `POST /main/products/{id}/move-to-raw/` (транзакция, раздел 4.1).
3. Реализовать `GET /main/finished-to-raw-transfers/` (раздел 4.2).
4. Реализовать `POST /main/finished-to-raw-transfers/{id}/cancel/` (раздел 4.3).
5. Определить правило сопоставления `Product → ItemMake` (ссылка или мэппинг).
6. Тесты-инварианты:
   - после перемещения: `product.quantity` уменьшилось ровно на `quantity`,
     `item_make.quantity` увеличилось на столько же;
   - после отмены: значения вернулись к исходным;
   - нельзя переместить больше остатка; нельзя отменить дважды.

---

## 8. Связь с фронтендом (что уже сделано)

| Фронт | Деталь |
|-------|--------|
| Экран перемещения | `FinishedToRawModal` — выбор товара, кол-во (≤ остатка), причина, «Останется: N» |
| Запрос на перемещение | `POST /main/products/{id}/move-to-raw/ { quantity, reason }` |
| Экран истории | `FinishedToRawHistoryModal` — таблица + кнопка «Отменить» |
| Запрос истории | `GET /main/finished-to-raw-transfers/` |
| Запрос отмены | `POST /main/finished-to-raw-transfers/{id}/cancel/` (с подтверждением) |
| Точка входа | кнопки «В сырьё» и «История перемещений» в шапке «Склад готовой продукции» |
| После операции | авто-обновление готовой продукции и сырья (`fetchProductsAsync` + `getItemsMake`) |
| Файлы | `FinishedGoods/FinishedToRawModals.jsx`, изменения в `FinishedGoods/FinishedGoods.jsx` |

Клиентская валидация: кол-во `> 0` и `≤ остатка`; выбор товара обязателен; ошибки
бэка показываются через `validateResErrors`.
