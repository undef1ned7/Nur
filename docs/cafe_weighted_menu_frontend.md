# Кафе: весовые блюда — API для фронтенда

Бэкенд поддерживает продажу блюд **на вес** (кг / г) и **поштучно**. Поля и правила ниже согласованы с экранами:

| Файл (фронт) | Назначение |
|--------------|------------|
| `cafeMenuWeight.js` | Утилиты веса, формат, минимумы |
| `Menu/CafeMenuItemPage.jsx` | Форма блюда |
| `Orders/cafeOrderItemPayload.js` | Payload строк заказа |
| `Orders/Orders.jsx` | Заказ, ввод веса |
| `Orders/components/OrdersParts.jsx` | Панель меню |
| `Orders/CafeOrdersHistory.jsx` | История, возвраты |
| `Orders/OrdersPrintService.js` | Печать чека |

**Базовый URL:** `https://<host>/api/cafe/`

**Авторизация:** JWT, как у остальных эндпоинтов кафе. Филиал: query `?branch=<uuid>` или заголовок контекста филиала (как принято в проекте).

---

## 1. Словарь полей

### Позиция меню (`MenuItem`)

| Поле | Тип в API | По умолчанию | Описание |
|------|-----------|--------------|----------|
| `is_sold_by_weight` | `boolean` | `false` | Блюдо продаётся на вес |
| `sale_unit` | `"kg"` \| `"g"` | `"kg"` | Единица продажи (имеет смысл при `is_sold_by_weight=true`) |
| `price` | string (decimal) | — | Штучное: цена **за 1 порцию**. Весовое: цена **за 1 `sale_unit`** (например 1200 сом **за 1 кг**) |

### Строка заказа (`Order.items[]`, `order-items`)

| Поле | Тип в API | Описание |
|------|-----------|----------|
| `quantity` | string `"1.500"` или number при записи | Штучное: целое ≥ 1. Весовое: decimal до **3** знаков |
| `unit_price` | string | Цена за единицу на момент заказа (рекомендуется передавать с фронта) |
| `menu_item_is_sold_by_weight` | `boolean` | **Read-only**, снимок с меню на момент строки |
| `menu_item_sale_unit` | `"kg"` \| `"g"` | **Read-only**, снимок единицы |
| `is_sold_by_weight` | `boolean` | Алиас `menu_item_is_sold_by_weight` |
| `sale_unit` | `"kg"` \| `"g"` | Алиас `menu_item_sale_unit` |
| `refunded_quantity` | string decimal | Уже возвращённый объём |
| `refundable_quantity` | string decimal | `quantity - refunded_quantity` |

Сумма строки (и итог заказа):

```text
line_total = quantity × unit_price   // если unit_price нет — берётся menu_item.price
```

Пример: 1.5 кг × 1200 = **1800** сом.

---

## 2. Меню — CRUD

### Список / одна позиция

```http
GET /api/cafe/menu-items/
GET /api/cafe/menu-items/<uuid>/
```

**Пример ответа:**

```json
{
  "id": "12f8e2a0-…",
  "title": "Рыба на гриле",
  "price": "1200.000",
  "category": "…",
  "kitchen": "…",
  "is_active": true,
  "is_sold_by_weight": true,
  "sale_unit": "kg",
  "image_url": "https://…",
  "cost_price": "450.00"
}
```

### Создание / изменение

```http
POST /api/cafe/menu-items/
PUT|PATCH /api/cafe/menu-items/<uuid>/
```

Тело (JSON или `multipart` с полем `image`):

```json
{
  "title": "Рыба на гриле",
  "category": "<uuid>",
  "kitchen": "<uuid|null>",
  "price": "1200.00",
  "is_active": true,
  "is_sold_by_weight": true,
  "sale_unit": "kg"
}
```

**Правила UI / валидация:**

| Ситуация | Поведение |
|----------|-----------|
| `is_sold_by_weight = false` | `sale_unit` можно не отправлять — бэкенд хранит `"kg"` |
| `is_sold_by_weight = true` | `sale_unit` обязателен: только `"kg"` или `"g"` |
| Неверный `sale_unit` | `400`: `{"sale_unit": ["Допустимые значения: kg, g."]}` |

**Подписи в форме блюда:**

- Чекбокс «Продажа на вес» → `is_sold_by_weight`
- Селект единицы → `sale_unit` (показывать только если весовое)
- Поле цены: «Цена за 1 кг» / «Цена за 1 г» / «Цена за порцию»

---

## 3. Заказ — строки

### Чтение заказа

```http
GET /api/cafe/orders/<uuid>/
GET /api/cafe/orders/closed/
GET /api/cafe/orders/history/
```

**Пример строки в `items`:**

```json
{
  "id": "…",
  "line_kind": "menu",
  "menu_item": "12f8e2a0-…",
  "menu_item_title": "Рыба на гриле",
  "menu_item_price": "1200.000",
  "unit_price": "1200.00",
  "quantity": "1.500",
  "menu_item_is_sold_by_weight": true,
  "menu_item_sale_unit": "kg",
  "is_sold_by_weight": true,
  "sale_unit": "kg",
  "comment": "",
  "is_rejected": false,
  "refunded_quantity": "0.000",
  "refundable_quantity": "1.500"
}
```

В ответе `quantity`, `refunded_quantity`, `refundable_quantity` приходят **строками** с точностью до 3 знаков (`"1.500"`).

### Создание / изменение заказа (inline `items`)

```http
POST /api/cafe/orders/
PATCH /api/cafe/orders/<uuid>/
```

Фрагмент тела (см. `cafeOrderItemPayload.js`):

```json
{
  "table": "<uuid>",
  "guests": 2,
  "items": [
    {
      "line_kind": "menu",
      "menu_item": "<uuid>",
      "unit_price": "1200.00",
      "quantity": 1.5,
      "comment": ""
    }
  ]
}
```

**Правила:**

| Тип блюда | `quantity` при отправке | Минимум |
|-----------|-------------------------|---------|
| Штучное | целое число (`1`, `3`) | `1` |
| Весовое, `sale_unit=kg` | дробь (`1.5`, `0.25`) | `0.001` |
| Весовое, `sale_unit=g` | число (`150`, `250.5`) | `1` (грамм) |

- Для весовых **не округлять** до целого на клиенте перед отправкой.
- Уникальность `(order, menu_item)`: **одна строка на блюдо**; изменение веса — через `quantity` в PATCH, не дублировать `menu_item`.
- При добавлении того же блюда повторным POST item (legacy upsert) количества **суммируются** — в UI лучше всегда PATCH одной строки с актуальным `quantity`.

**Ошибки:**

```json
{
  "quantity": ["Для весового блюда укажите количество не меньше 0.001."]
}
```

```json
{
  "quantity": ["Для штучного блюда укажите целое количество не меньше 1."]
}
```

### Отдельные эндпоинты строк

```http
POST /api/cafe/order-items/
PATCH /api/cafe/order-items/<uuid>/
```

Те же поля и валидация, что и в `items[]` заказа.

---

## 4. Оплата

```http
POST /api/cafe/orders/<uuid>/pay/
```

Логика суммы не меняется: `order.recalc_total()` учитывает дробный `quantity`. Списание склада при оплате: `норма_техкарты × quantity` (для 1.5 кг списание × 1.5).

**Рекомендация по техкарте в UI:** для весовых блюд с `sale_unit=kg` нормы ингредиентов указывать **на 1 кг** готового продукта.

---

## 5. Возврат по строке

```http
POST /api/cafe/orders/<uuid>/refund-item/
```

```json
{
  "order_item_id": "<uuid>",
  "quantity": 0.5,
  "payment_method": "cash",
  "idempotency_key": "<uuid>",
  "note": ""
}
```

| Поле | Описание |
|------|----------|
| `quantity` | Необязательно; по умолчанию — весь `refundable_quantity` |
| Весовое (кг) | дробь, мин. `0.001`, шаг как при заказе |
| Весовое (г) | мин. `1` |
| Штучное | целое ≥ 1 |

Сумма возврата: `quantity × unit_price` (из строки).

В истории заказов показывать `refunded_quantity` / `refundable_quantity` **в тех же единицах**, что и заказ (кг/г/шт.), используя снимки `menu_item_sale_unit` / `is_sold_by_weight` со строки, а не текущее меню.

---

## 6. Кухня

```http
GET /api/cafe/kitchen/tasks/
```

В задаче:

| Поле | Описание |
|------|----------|
| `quantity` | Объём: для весовых — вес строки (`1.500`); для штучных — обычно `1` на задачу |
| `unit_index` | Номер порции (штучное: 1, 2, 3…; весовое: всегда `1`) |
| `menu_item_is_sold_by_weight` | из меню |
| `menu_item_sale_unit` | `kg` / `g` |

**Отображение:** для весовых — одна задача `unit_index=1`, подпись «1.5 кг». Для штучных — как раньше, несколько задач по `unit_index` (2 порции → две задачи). Старые дубликаты в БД **не удаляются** миграцией.

WebSocket `kitchen_task_ready` в payload дополнительно: `quantity`, `menu_item_is_sold_by_weight`, `menu_item_sale_unit`.

---

## 7. Аналитика

```http
GET /api/cafe/analytics/sales/items/?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&limit=10
```

**Пример строки ответа:**

```json
{
  "menu_item_id": "…",
  "title": "Рыба на гриле",
  "qty": "12.500",
  "revenue": "15000.00",
  "is_sold_by_weight": true,
  "sale_unit": "kg"
}
```

| Поле | Как использовать на UI |
|------|------------------------|
| `qty` | Строка decimal; для весовых — подпись «кг» / «г» из `sale_unit` |
| `is_sold_by_weight` | Не смешивать с «порциями» в одной метрике без единицы |
| `revenue` | Выручка за период |

Сводные эндпоинты (`sales/summary`, `sales/dynamics`) по-прежнему отдают `items_qty` как агрегат; для весовых позиций детальный разрез — только `sales/items` с единицами.

---

## 8. Чеклист интеграции фронта

- [x] Форма блюда: `is_sold_by_weight`, `sale_unit`, подпись цены за кг/г/порцию
- [x] Меню / заказ: определение весового блюда по `is_sold_by_weight` (из меню или снимка строки)
- [x] Ввод `quantity`: step 0.1 (кг) / 50 (г), без принудительного `parseInt`
- [x] Отображение суммы: `quantity * unit_price`
- [x] PATCH заказа: одна строка на `menu_item`, обновление `quantity`
- [x] История / печать: единицы из `menu_item_sale_unit` / снимка строки
- [x] Возврат: дробный `quantity`, лимит `refundable_quantity`
- [ ] Кухня: формат «{quantity} {sale_unit}» (при доработке Cook.jsx)
- [ ] Аналитика: `qty` + `sale_unit`, не показывать вес как «шт.»

---

## 9. Сквозной сценарий для QA

1. Создать блюдо: `is_sold_by_weight=true`, `price=1200`, `sale_unit=kg`.
2. Открыть заказ, добавить блюдо с `quantity: 1.5`, `unit_price: 1200`.
3. Проверить `GET /orders/<id>/`: `quantity: "1.500"`, `total_amount` с учётом скидки = **1800** (без скидки).
4. Оплатить заказ — списание склада пропорционально 1.5.
5. Частичный возврат `0.5` кг — `refundable_quantity: "1.000"`.
6. В `analytics/sales/items/` — `qty: "1.500"` (или нетто после возврата по периоду), `sale_unit: "kg"`.

---

## 10. Миграция бэкенда

Перед использованием на стенде:

```bash
python manage.py makemigrations cafe
python manage.py migrate cafe
```

Если после деплоя приходят старые ответы без новых полей — миграция не применена.
