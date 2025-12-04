# API для получения данных о столах и заказах (Orders)

## Обзор

Для отображения списка заказов с информацией о столах нужно выполнить несколько API запросов и связать данные между собой.

---

## 1. Получение списка столов

**Endpoint:** `GET /cafe/tables/`

**Описание:** Получает список всех столов в кафе.

**Ответ:**

```json
{
  "results": [
    {
      "id": 1,
      "number": 5,
      "places": 4,
      "status": "free", // или "busy"
      "zone": {
        "id": 1,
        "name": "Зал 1"
      }
    },
    {
      "id": 2,
      "number": 6,
      "places": 2,
      "status": "busy",
      "zone": null
    }
  ]
}
```

**Или может быть просто массив:**

```json
[
  {
    "id": 1,
    "number": 5,
    "places": 4,
    "status": "free",
    "zone": {...}
  }
]
```

**Важно:** Сохраните таблицу `id → стол` для быстрого поиска.

---

## 2. Получение списка заказов

**Endpoint:** `GET /cafe/orders/`

**Описание:** Получает список всех заказов.

**Ответ:**

```json
{
  "results": [
    {
      "id": 10,
      "table": 1, // ← ID стола (связь)
      "waiter": 5,
      "client": 3,
      "guests": 2,
      "status": "payment", // или "paid", "оплачен", "canceled" и т.д.
      "created_at": "2024-01-15T10:30:00Z",
      "items": [
        // ← Может быть пустым или отсутствовать
        {
          "id": 101,
          "menu_item": 20, // ID позиции меню
          "menu_item_title": "Борщ",
          "quantity": 2,
          "price": 150.0,
          "menu_item_price": 150.0
        },
        {
          "id": 102,
          "menu_item": 21,
          "menu_item_title": "Салат",
          "quantity": 1,
          "price": 80.0,
          "menu_item_price": 80.0
        }
      ]
    },
    {
      "id": 11,
      "table": 2,
      "status": "paid",
      "items": [] // ← Пустой массив
    }
  ]
}
```

**Важно:**

- Поле `table` содержит **ID стола** из первого запроса
- Поле `items` может быть пустым массивом или отсутствовать
- Если `items` пустой или отсутствует, нужно догрузить детали заказа

---

## 3. Догрузка деталей заказа (если items пустые)

**Endpoint:** `GET /cafe/orders/{order_id}/`

**Описание:** Получает полную информацию о конкретном заказе, включая позиции.

**Когда использовать:** Если в списке заказов поле `items` пустое или отсутствует.

**Пример:**

```javascript
// Если заказ без items
const order = { id: 11, table: 2, items: [] };

// Делаем запрос
GET /
  cafe /
  orders /
  11 /
  // Получаем полные данные
  {
    id: 11,
    table: 2,
    status: "paid",
    items: [
      {
        id: 103,
        menu_item: 22,
        menu_item_title: "Кофе",
        quantity: 1,
        price: 50.0,
      },
    ],
  };
```

---

## 4. Последовательность запросов

### Шаг 1: Загрузить справочники (можно параллельно)

```javascript
// Параллельно загружаем:
const [tables, employees, menuItems] = await Promise.all([
  GET /cafe/tables/,
  GET /users/employees/,
  GET /cafe/menu-items/
]);
```

### Шаг 2: Загрузить заказы

```javascript
const orders = await GET /cafe/orders/;
```

### Шаг 3: Догрузить детали заказов без items

```javascript
// Найти заказы без позиций
const ordersWithoutItems = orders.filter(
  o => !o.items || o.items.length === 0
);

// Догрузить детали для каждого
const details = await Promise.all(
  ordersWithoutItems.map(id => GET /cafe/orders/{id}/)
);

// Объединить данные
const fullOrders = orders.map(order => {
  const detail = details.find(d => d.id === order.id);
  return detail ? { ...order, ...detail } : order;
});
```

---

## 5. Связывание данных для отображения

### Создать Map для быстрого поиска столов:

```javascript
// JavaScript/TypeScript
const tablesMap = new Map();
tables.forEach(table => {
  tablesMap.set(table.id, table);
});

// Swift (пример)
var tablesMap: [Int: Table] = [:]
tables.forEach { table in
  tablesMap[table.id] = table
}

// Kotlin (пример)
val tablesMap = tables.associateBy { it.id }
```

### При отображении заказа:

```javascript
// Для каждого заказа:
const order = { id: 10, table: 1, items: [...] };

// Найти стол по ID
const table = tablesMap.get(order.table);  // или tablesMap[order.table]

// Отобразить номер стола
const tableNumber = table?.number || "—";  // "5" или "—"

// Отобразить позиции заказа
order.items.forEach(item => {
  const title = item.menu_item_title || item.title;
  const quantity = item.quantity;
  const price = item.price || item.menu_item_price;
});
```

---

## 6. Определение занятости столов

**Логика:** Стол считается занятым, если на нём есть **неоплаченный** заказ.

**Статусы неоплаченных заказов:**

- `"payment"`
- `"new"`
- `"pending"`
- Любой другой, кроме: `"paid"`, `"оплачен"`, `"оплачено"`, `"canceled"`, `"cancelled"`, `"отменён"`, `"отменен"`, `"closed"`, `"done"`, `"completed"`

**Код:**

```javascript
// Найти занятые столы
const busyTableIds = new Set();

orders.forEach((order) => {
  const status = (order.status || "").toLowerCase();
  const isUnpaid = ![
    "paid",
    "оплачен",
    "оплачено",
    "canceled",
    "cancelled",
    "отменён",
    "отменен",
    "closed",
    "done",
    "completed",
  ].includes(status);

  if (isUnpaid) {
    busyTableIds.add(order.table);
  }
});

// Теперь busyTableIds содержит ID всех занятых столов
```

---

## 7. Структура данных для отображения

### Заказ (Order):

```typescript
interface Order {
  id: number;
  table: number; // ID стола
  waiter?: number;
  client?: number;
  guests?: number;
  status: string;
  created_at?: string;
  items: OrderItem[];
}

interface OrderItem {
  id: number;
  menu_item: number; // ID позиции меню
  menu_item_title?: string;
  title?: string;
  quantity: number;
  price?: number;
  menu_item_price?: number;
}
```

### Стол (Table):

```typescript
interface Table {
  id: number;
  number: number; // Номер стола для отображения
  places?: number;
  status: "free" | "busy";
  zone?: {
    id: number;
    name: string;
  };
}
```

---

## 8. Пример полного потока (псевдокод)

```javascript
// 1. Загрузить справочники
const tables = await GET("/cafe/tables/");
const menuItems = await GET("/cafe/menu-items/");

// 2. Создать Map столов
const tablesMap = new Map(tables.map((t) => [t.id, t]));

// 3. Загрузить заказы
let orders = await GET("/cafe/orders/");

// 4. Догрузить детали для заказов без items
const ordersToFetch = orders.filter((o) => !o.items || o.items.length === 0);
const details = await Promise.all(
  ordersToFetch.map((id) => GET(`/cafe/orders/${id}/`))
);

// 5. Объединить данные
orders = orders.map((order) => {
  const detail = details.find((d) => d.id === order.id);
  return detail ? { ...order, ...detail } : order;
});

// 6. Отобразить заказы
orders.forEach((order) => {
  const table = tablesMap.get(order.table);
  const tableNumber = table?.number || "—";

  console.log(`СТОЛ ${tableNumber}`);
  order.items.forEach((item) => {
    console.log(`  ${item.menu_item_title} x${item.quantity} = ${item.price}`);
  });
});
```

---

## 9. Важные моменты

1. **Формат ответа может отличаться:**

   - Может быть `{ results: [...] }` или просто `[...]`
   - Проверяйте оба варианта

2. **Поле items может отсутствовать:**

   - Всегда проверяйте наличие `items` перед использованием
   - Если пустое, догружайте детали заказа

3. **Цена позиции:**

   - Может быть в `item.price` или `item.menu_item_price`
   - Если нет, ищите в справочнике меню по `item.menu_item`

4. **Название позиции:**

   - Может быть в `item.menu_item_title` или `item.title`

5. **Обновление данных:**
   - После создания/редактирования/оплаты заказа нужно обновить список
   - Можно использовать polling или WebSocket для real-time обновлений

---

## 10. Endpoints для операций с заказами

- `POST /cafe/orders/` - Создать заказ
- `GET /cafe/orders/{id}/` - Получить детали заказа
- `PATCH /cafe/orders/{id}/` - Редактировать заказ
- `POST /cafe/orders/{id}/pay/` - Оплатить заказ (или `PATCH` с `status: "paid"`)
