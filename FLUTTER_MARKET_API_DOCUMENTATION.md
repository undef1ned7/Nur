# Документация API для Flutter разработчика - Маркет

## Содержание

1. [Аналитика](#аналитика)
2. [Склад](#склад)
3. [Интерфейс кассира](#интерфейс-кассира)

---

## Аналитика

### Базовый URL

```
GET /main/analytics/market/
```

### Параметры запроса

#### Обязательные параметры

- `tab` (string) - Тип аналитики: `sales`, `stock`, `cashboxes`, `shifts`
- `date_from` (string) - Дата начала периода в формате `YYYY-MM-DD`
- `date_to` (string) - Дата окончания периода в формате `YYYY-MM-DD`

#### Опциональные параметры (зависят от вкладки)

**Для вкладок `sales` и `cashboxes`:**

- `branch` (string, UUID) - ID филиала
- `include_global` (string) - Включить глобальные записи: `"1"` или `"0"`
- `cashbox` (string, UUID) - ID кассы
- `shift` (string, UUID) - ID смены
- `cashier` (string, UUID) - ID кассира
- `payment_method` (string) - Способ оплаты: `cash`, `transfer`, `card`, `deferred`
- `min_total` (number) - Минимальная сумма
- `max_total` (number) - Максимальная сумма

**Для вкладки `stock` (склад):**

- `branch` (string, UUID) - ID филиала
- `include_global` (string) - Включить глобальные записи: `"1"` или `"0"`
- `product` (string, UUID) - ID товара
- `category` (string, UUID) - ID категории
- `kind` (string) - Тип товара: `product`, `service`, `bundle`
- `low_only` (string) - Только товары с низким остатком: `"1"` или `"0"`

**Для вкладки `shifts`:**

- `branch` (string, UUID) - ID филиала
- `include_global` (string) - Включить глобальные записи: `"1"` или `"0"`
- `status` (string) - Статус смены: `open`, `closed`
- `cashbox` (string, UUID) - ID кассы
- `cashier` (string, UUID) - ID кассира

### Пример запроса (Продажи)

```dart
final response = await http.get(
  Uri.parse('$baseUrl/main/analytics/market/').replace(
    queryParameters: {
      'tab': 'sales',
      'date_from': '2024-01-01',
      'date_to': '2024-01-31',
      'payment_method': 'cash',
    },
  ),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
);
```

### Структура ответа

#### Вкладка "Продажи" (sales)

```dart
{
  "cards": {
    "revenue": "150000.00",        // Выручка (строка)
    "transactions": 1250,           // Количество транзакций
    "avg_check": "120.00",         // Средний чек (строка)
    "clients": 850                 // Количество клиентов
  },
  "charts": {
    "sales_dynamics": [
      {
        "date": "2024-01-01",
        "value": "50000.00"
      },
      // ...
    ]
  },
  "tables": {
    "top_products": [
      {
        "name": "Товар 1",
        "sold": 150,
        "revenue": "18000.00"
      },
      // ...
    ],
    "documents": [
      {
        "name": "Приход",
        "count": 25,
        "sum": "50000.00",
        "stock": "30000.00"  // Опционально
      },
      // ...
    ]
  }
}
```

#### Вкладка "Склад" (stock)

```dart
{
  "cards": {
    "total_products": 1250,         // Всего товаров
    "categories": 45,               // Количество категорий
    "inventory_value": "2500000.00", // Стоимость склада
    "low_stock_count": 25,          // Товаров с низким остатком
    "turnover_days": 30             // Оборачиваемость в днях
  },
  "charts": {
    "category_distribution": [
      {
        "name": "Категория 1",
        "percent": 25.5
      },
      // ...
    ],
    "movement_units": [
      {
        "date": "2024-01-01",
        "units": 150
      },
      // ...
    ]
  },
  "tables": {
    "low_stock": [
      {
        "name": "Товар 1",
        "qty": 5,
        "min": 10,
        "status": "low"  // или "critical"
      },
      // ...
    ]
  }
}
```

#### Вкладка "Кассы" (cashboxes)

```dart
{
  "cards": {
    "revenue": "50000.00",
    "transactions": 450,
    "avg_check": "111.11",
    "cash_in_box": "30000.00",
    "cash_share_percent": 60
  },
  "charts": {
    "sales_by_hours": [
      {
        "hour": 9,
        "revenue": "5000.00"
      },
      // ...
    ],
    "payment_methods": [
      {
        "name": "cash",
        "percent": 60.0
      },
      // ...
    ],
    "transactions_by_weekday": [
      {
        "weekday": 0,  // 0 = воскресенье, 6 = суббота
        "transactions": 50
      },
      // ...
    ]
  },
  "tables": {
    "payment_detail": [
      {
        "method": "cash",
        "transactions": 270,
        "sum": "30000.00",
        "share": 60.0
      },
      // ...
    ],
    "peak_hours": [
      {
        "hour": 12,
        "transactions": 45,
        "revenue": "5000.00",
        "avg_check": "111.11"
      },
      // ...
    ]
  }
}
```

#### Вкладка "Смены" (shifts)

```dart
{
  "cards": {
    "active_shifts": 3,
    "shifts_today": 5,
    "avg_duration_hours": 8,
    "avg_revenue_per_shift": "10000.00"
  },
  "charts": {
    "sales_by_shift_bucket": [
      {
        "name": "Утро",
        "revenue": "15000.00"
      },
      // ...
    ]
  },
  "tables": {
    "active_shifts": [
      {
        "cashier": "Иван Иванов",
        "cashbox": "Касса 1",
        "opened_at": "2024-01-15T09:00:00Z",
        "sales": "5000.00",
        "status": "open"
      },
      // ...
    ],
    "best_cashiers": [
      {
        "place": 1,
        "cashier": "Иван Иванов",
        "shifts": 20,
        "sales": "200000.00",
        "avg_check": "100.00"
      },
      // ...
    ]
  }
}
```

### Обработка ошибок

```dart
try {
  final response = await http.get(/* ... */);
  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    // Обработка данных
  } else if (response.statusCode == 403) {
    // Доступ запрещен. Требуются права owner/admin
  } else if (response.statusCode == 400) {
    // Ошибка запроса
    final error = jsonDecode(response.body);
    print(error['detail']);
  }
} catch (e) {
  // Обработка ошибки сети
}
```

---

## Склад

### Получение списка товаров

#### Базовый URL

```
GET /main/products/list/
```

#### Параметры запроса

- `page` (int) - Номер страницы (по умолчанию 1)
- `search` (string) - Поиск по названию или штрих-коду
- `brand` (string, UUID) - Фильтр по бренду
- `category` (string, UUID) - Фильтр по категории
- `kind` (string) - Тип товара: `product`, `service`, `bundle`
- `min_price` (number) - Минимальная цена
- `max_price` (number) - Максимальная цена
- `min_quantity` (number) - Минимальное количество
- `max_quantity` (number) - Максимальное количество

#### Пример запроса

```dart
final response = await http.get(
  Uri.parse('$baseUrl/main/products/list/').replace(
    queryParameters: {
      'page': '1',
      'search': 'товар',
      'category': 'category-uuid',
    },
  ),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
);
```

#### Структура ответа

```dart
{
  "count": 1250,           // Общее количество товаров
  "next": "http://...",    // URL следующей страницы (или null)
  "previous": null,        // URL предыдущей страницы (или null)
  "results": [
    {
      "id": "product-uuid",
      "name": "Название товара",
      "code": "CODE123",
      "article": "ART123",
      "barcode": "1234567890123",
      "price": "150.00",
      "discount_percent": "10.00",
      "quantity": 25,
      "unit": "шт",
      "kind": "product",   // product, service, bundle
      "images": [
        {
          "id": "image-uuid",
          "image_url": "https://...",
          "is_primary": true
        }
      ],
      "brand": {
        "id": "brand-uuid",
        "name": "Бренд"
      },
      "category": {
        "id": "category-uuid",
        "name": "Категория"
      }
    },
    // ...
  ]
}
```

### Получение товара по штрих-коду

#### Базовый URL

```
GET /main/products/global-barcode/{barcode}/
```

#### Пример запроса

```dart
final barcode = '1234567890123';
final response = await http.get(
  Uri.parse('$baseUrl/main/products/global-barcode/$barcode/'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
);
```

### Создание товара

#### Базовый URL

```
POST /main/products/create-manual/
```

#### Тело запроса

```dart
{
  "name": "Название товара",
  "code": "CODE123",
  "article": "ART123",
  "barcode": "1234567890123",
  "price": "150.00",
  "discount_percent": "10.00",
  "quantity": 25,
  "unit": "шт",
  "kind": "product",
  "brand": "brand-uuid",      // Опционально
  "category": "category-uuid" // Опционально
}
```

#### Пример запроса

```dart
final response = await http.post(
  Uri.parse('$baseUrl/main/products/create-manual/'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'name': 'Название товара',
    'price': '150.00',
    'quantity': 25,
    'unit': 'шт',
    'kind': 'product',
  }),
);
```

### Обновление товара

#### Базовый URL

```
PATCH /main/products/{product_id}/
```

#### Пример запроса

```dart
final productId = 'product-uuid';
final response = await http.patch(
  Uri.parse('$baseUrl/main/products/$productId/'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'price': '160.00',
    'quantity': 30,
  }),
);
```

### Удаление товара

#### Базовый URL

```
DELETE /main/products/{product_id}/
```

#### Пример запроса

```dart
final productId = 'product-uuid';
final response = await http.delete(
  Uri.parse('$baseUrl/main/products/$productId/'),
  headers: {
    'Authorization': 'Bearer $token',
  },
);
```

### Массовое удаление товаров

#### Базовый URL

```
POST /main/products/bulk-delete/
```

#### Тело запроса

```dart
{
  "ids": ["product-uuid-1", "product-uuid-2"],
  "soft": true,        // Мягкое удаление
  "require_all": false // Требовать наличие всех товаров
}
```

### Получение брендов

#### Базовый URL

```
GET /main/brands/
```

### Получение категорий

#### Базовый URL

```
GET /main/categories/
```

---

## Интерфейс кассира

### Начало продажи

#### Базовый URL

```
POST /main/pos/sales/start/
```

#### Тело запроса

```dart
{
  "order_discount_total": "0.00",  // Общая скидка на заказ
  "shift": "shift-uuid"             // ID открытой смены (обязательно)
}
```

#### Пример запроса

```dart
final response = await http.post(
  Uri.parse('$baseUrl/main/pos/sales/start/'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'order_discount_total': '0.00',
    'shift': shiftId,
  }),
);
```

#### Структура ответа

```dart
{
  "id": "sale-uuid",
  "subtotal": "0.00",
  "order_discount_total": "0.00",
  "total": "0.00",
  "items": [],  // Массив товаров в корзине
  "shift": "shift-uuid",
  "created_at": "2024-01-15T10:00:00Z"
}
```

### Добавление товара по штрих-коду

#### Базовый URL

```
POST /main/pos/sales/{sale_id}/add-barcode/
```

#### Тело запроса

```dart
{
  "barcode": "1234567890123"
}
```

#### Пример запроса

```dart
final saleId = 'sale-uuid';
final response = await http.post(
  Uri.parse('$baseUrl/main/pos/sales/$saleId/add-barcode/'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'barcode': '1234567890123',
  }),
);
```

#### Структура ответа

```dart
{
  "success": true,
  "item": {
    "id": "item-uuid",
    "product": "product-uuid",
    "product_name": "Название товара",
    "quantity": 1,
    "unit_price": "150.00",
    "total": "150.00"
  }
}
```

### Добавление товара вручную

#### Базовый URL

```
POST /main/pos/sales/{sale_id}/add-manual/
```

#### Тело запроса

```dart
{
  "product_id": "product-uuid",
  "quantity": 2
}
```

#### Пример запроса

```dart
final saleId = 'sale-uuid';
final response = await http.post(
  Uri.parse('$baseUrl/main/pos/sales/$saleId/add-manual/'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'product_id': productId,
    'quantity': 2,
  }),
);
```

### Обновление количества товара

#### Базовый URL

```
PATCH /main/pos/sales/{sale_id}/update-item/
```

#### Тело запроса

```dart
{
  "product_id": "product-uuid",
  "quantity": 3,
  "discount_total": "0.00"  // Общая скидка на заказ
}
```

#### Пример запроса

```dart
final saleId = 'sale-uuid';
final response = await http.patch(
  Uri.parse('$baseUrl/main/pos/sales/$saleId/update-item/'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'product_id': productId,
    'quantity': 3,
    'discount_total': '0.00',
  }),
);
```

### Удаление товара из корзины

#### Базовый URL

```
DELETE /main/pos/sales/{sale_id}/remove-item/
```

#### Тело запроса

```dart
{
  "product_id": "product-uuid"
}
```

#### Пример запроса

```dart
final saleId = 'sale-uuid';
final response = await http.delete(
  Uri.parse('$baseUrl/main/pos/sales/$saleId/remove-item/'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'product_id': productId,
  }),
);
```

### Добавление дополнительной услуги

#### Базовый URL

```
POST /main/pos/sales/{sale_id}/add-custom-item/
```

#### Тело запроса

```dart
{
  "name": "Дополнительная услуга",
  "price": "50.00",
  "quantity": 1
}
```

#### Пример запроса

```dart
final saleId = 'sale-uuid';
final response = await http.post(
  Uri.parse('$baseUrl/main/pos/sales/$saleId/add-custom-item/'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'name': 'Дополнительная услуга',
    'price': '50.00',
    'quantity': 1,
  }),
);
```

### Обновление скидки на заказ

#### Базовый URL

```
PATCH /main/pos/sales/{sale_id}/
```

#### Тело запроса

```dart
{
  "order_discount_total": "50.00"
}
```

### Завершение продажи (Checkout)

#### Базовый URL

```
POST /main/pos/sales/{sale_id}/checkout/
```

#### Тело запроса

```dart
{
  "print_receipt": true,           // Печатать чек
  "client_id": "client-uuid",      // Опционально: ID клиента
  "payment_method": "cash",         // cash, transfer, card, deferred
  "cash_received": "150.00"        // Опционально: полученная сумма (для cash и deferred)
}
```

#### Пример запроса

```dart
final saleId = 'sale-uuid';
final response = await http.post(
  Uri.parse('$baseUrl/main/pos/sales/$saleId/checkout/'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'print_receipt': true,
    'client_id': clientId,
    'payment_method': 'cash',
    'cash_received': '150.00',
  }),
);
```

#### Структура ответа

```dart
{
  "id": "sale-uuid",
  "sale_id": "sale-uuid",  // ID завершенной продажи
  "total": "150.00",
  "payment_method": "cash",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Получение текущей продажи

#### Базовый URL

```
GET /main/pos/sales/{sale_id}/
```

#### Структура ответа

```dart
{
  "id": "sale-uuid",
  "subtotal": "150.00",
  "order_discount_total": "0.00",
  "total": "150.00",
  "items": [
    {
      "id": "item-uuid",
      "product": "product-uuid",
      "product_name": "Название товара",
      "quantity": 1,
      "unit_price": "150.00",
      "total": "150.00",
      "unit": "шт",
      "primary_image_url": "https://...",
      "images": [
        {
          "image_url": "https://...",
          "is_primary": true
        }
      ]
    }
  ],
  "shift": "shift-uuid",
  "created_at": "2024-01-15T10:00:00Z"
}
```

### Работа со сменами

#### Получение открытой смены

```
GET /main/shifts/?status=open
```

#### Открытие смены

```
POST /main/shifts/
```

#### Тело запроса

```dart
{
  "cashbox": "cashbox-uuid",
  "opening_balance": "1000.00"  // Опционально
}
```

#### Закрытие смены

```
PATCH /main/shifts/{shift_id}/close/
```

#### Тело запроса

```dart
{
  "closing_balance": "5000.00"  // Опционально
}
```

### Получение клиентов

#### Базовый URL

```
GET /main/clients/
```

#### Параметры запроса

- `search` (string) - Поиск по имени или телефону
- `page` (int) - Номер страницы

### Получение касс

#### Базовый URL

```
GET /main/cashboxes/
```

---

## Общие замечания

### Аутентификация

Все запросы требуют заголовок авторизации:

```dart
'Authorization': 'Bearer $accessToken'
```

### Базовый URL

```dart
const String baseUrl = 'https://app.nurcrm.kg/api';
```

### Формат дат

- Для запросов: `YYYY-MM-DD` (например, `2024-01-15`)
- Для ответов: ISO 8601 (например, `2024-01-15T10:00:00Z`)

### Формат денежных значений

- Все денежные значения передаются как строки с двумя знаками после запятой
- Пример: `"150.00"`, `"0.00"`

### Обработка ошибок

Все ошибки возвращаются в формате:

```dart
{
  "detail": "Описание ошибки"
}
```

### Пагинация

- Размер страницы: 100 элементов
- Используйте параметры `next` и `previous` для навигации
- Параметр `count` содержит общее количество элементов

### Важные моменты

1. **Смены**: Перед началом продажи необходимо открыть смену. Продажи без открытой смены невозможны.

2. **Штрих-коды**: При сканировании штрих-кода товар автоматически добавляется в корзину. Если товара нет в наличии, вернется ошибка.

3. **Количество товара**: При добавлении товара проверяется наличие на складе. Нельзя добавить больше товара, чем есть в наличии.

4. **Скидки**: Можно установить общую скидку на весь заказ через `order_discount_total`.

5. **Дополнительные услуги**: Можно добавлять услуги, которых нет в каталоге товаров, через `add-custom-item`.

6. **Способы оплаты**:

   - `cash` - Наличные
   - `transfer` - Безналичный перевод
   - `card` - Карта
   - `deferred` - Отсрочка (требует `client_id`)

7. **Печать чека**: Параметр `print_receipt` определяет, нужно ли печатать чек после завершения продажи.

---

## Примеры использования

### Полный цикл продажи

```dart
// 1. Получить открытую смену
final shiftResponse = await http.get(
  Uri.parse('$baseUrl/main/shifts/?status=open'),
  headers: {'Authorization': 'Bearer $token'},
);
final shifts = jsonDecode(shiftResponse.body)['results'];
final shiftId = shifts[0]['id'];

// 2. Начать продажу
final saleResponse = await http.post(
  Uri.parse('$baseUrl/main/pos/sales/start/'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'order_discount_total': '0.00',
    'shift': shiftId,
  }),
);
final sale = jsonDecode(saleResponse.body);
final saleId = sale['id'];

// 3. Добавить товар по штрих-коду
await http.post(
  Uri.parse('$baseUrl/main/pos/sales/$saleId/add-barcode/'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({'barcode': '1234567890123'}),
);

// 4. Обновить продажу для получения актуальных данных
final updatedSaleResponse = await http.get(
  Uri.parse('$baseUrl/main/pos/sales/$saleId/'),
  headers: {'Authorization': 'Bearer $token'},
);
final updatedSale = jsonDecode(updatedSaleResponse.body);

// 5. Завершить продажу
await http.post(
  Uri.parse('$baseUrl/main/pos/sales/$saleId/checkout/'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'print_receipt': true,
    'payment_method': 'cash',
    'cash_received': updatedSale['total'],
  }),
);
```

### Получение аналитики за месяц

```dart
final now = DateTime.now();
final firstDay = DateTime(now.year, now.month, 1);
final lastDay = DateTime(now.year, now.month + 1, 0);

final response = await http.get(
  Uri.parse('$baseUrl/main/analytics/market/').replace(
    queryParameters: {
      'tab': 'sales',
      'date_from': '${firstDay.year}-${firstDay.month.toString().padLeft(2, '0')}-${firstDay.day.toString().padLeft(2, '0')}',
      'date_to': '${lastDay.year}-${lastDay.month.toString().padLeft(2, '0')}-${lastDay.day.toString().padLeft(2, '0')}',
    },
  ),
  headers: {'Authorization': 'Bearer $token'},
);

final analytics = jsonDecode(response.body);
print('Выручка: ${analytics['cards']['revenue']}');
print('Транзакций: ${analytics['cards']['transactions']}');
```

### Поиск товаров на складе

```dart
final response = await http.get(
  Uri.parse('$baseUrl/main/products/list/').replace(
    queryParameters: {
      'page': '1',
      'search': 'товар',
    },
  ),
  headers: {'Authorization': 'Bearer $token'},
);

final data = jsonDecode(response.body);
final products = data['results'];
final totalCount = data['count'];
```

---

## Коды ошибок

- `400` - Неверный запрос (проверьте параметры)
- `401` - Не авторизован (обновите токен)
- `403` - Доступ запрещен (недостаточно прав)
- `404` - Ресурс не найден
- `500` - Внутренняя ошибка сервера

---

## Дополнительные ресурсы

- Базовый URL API: `https://app.nurcrm.kg/api`
- Формат токена: JWT Bearer Token
- Таймаут запросов: 20 секунд
- Максимальный размер страницы: 100 элементов
