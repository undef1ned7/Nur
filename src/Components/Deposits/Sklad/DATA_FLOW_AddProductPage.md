# Документация: Отправка данных в AddProductPage.jsx

## Общий процесс отправки данных

### 1. Точка входа

Функция `handleSubmit()` в компоненте `AddProductPage.jsx` (строка 247)

### 2. Валидация данных

Перед отправкой выполняется валидация:

- Для маркета: проверка наименования, штрих-кода, цен (в зависимости от типа товара)
- Для других секторов: проверка всех обязательных полей
- Валидация долговых операций (если выбраны)

### 3. Формирование payload

#### Для сектора "Маркет" (isMarketSector === true):

**Базовый payload для всех типов:**

```javascript
{
  name: string,                    // Наименование товара
  barcode: string | null,          // Штрих-код
  brand_name: string,              // Название бренда
  category_name: string,           // Название категории
  article: string,                 // Артикул
  unit: string,                     // Единица измерения (по умолчанию "шт")
  is_weight: boolean,              // Весовой товар (только для товара)
  price: string,                   // Цена продажи
  discount_percent: string,        // Процент скидки
  country: string,                 // Страна производства
  expiration_date: string | null,  // Дата истечения срока годности
  client: string | null,          // ID поставщика
  plu: number | null,              // PLU код для весов
  characteristics: {               // Характеристики товара
    height_cm: string | null,      // Высота в см
    width_cm: string | null,       // Ширина в см
    depth_cm: string | null,       // Глубина в см
    factual_weight_kg: string | null, // Фактический вес в кг
    description: string             // Описание
  }
}
```

**Дополнительные поля для типа "Товар" (itemType === "product"):**

```javascript
{
  purchase_price: string,          // Цена закупки
  markup_percent: string,         // Процент наценки
  quantity: number,               // Количество на складе
  stock: true                     // Товар есть на складе
}
```

**Дополнительные поля для типа "Услуга" (itemType === "service"):**

```javascript
{
  purchase_price: "0",
  markup_percent: "0",
  quantity: 0,
  stock: false,                    // Услуги не имеют остатка
  is_weight: boolean               // Дробная услуга (isFractionalService)
}
```

**Дополнительные поля для типа "Комплект" (itemType === "kit"):**

```javascript
{
  item_make_ids: string[],         // Массив UUID товаров в составе комплекта
  packages: [                      // Массив упаковок
    {
      name: string,                // Название упаковки
      quantity_in_package: number, // Количество в упаковке
      unit: string                 // Единица измерения
    }
  ],
  purchase_price: "0",
  markup_percent: "0",
  quantity: 0,
  stock: false
}
```

#### Для других секторов (isMarketSector === false):

```javascript
{
  name: string,
  barcode: string | null,
  brand_name: string,
  category_name: string,
  price: string,
  client: string | null,
  plu: number | null,
  quantity: number,
  purchase_price: string,
  scale_type: "piece" | "weight"  // Тип товара: штучный или весовой
}
```

### 4. Отправка данных

**Основной запрос:**

```javascript
dispatch(createProductAsync(payload));
```

**Цепочка вызовов:**

1. `createProductAsync` (Redux Thunk) → `src/store/creators/productCreators.js:42`
2. `createProductApi` → `src/api/products.js:43`
3. `api.post("main/products/create-manual/", productData)` → **POST запрос на сервер**

**API Endpoint:**

```
POST /main/products/create-manual/
```

### 5. Загрузка изображений (после создания товара)

После успешного создания товара, если есть изображения:

**Endpoint для каждого изображения:**

```
POST /main/products/{productId}/images/
```

**Формат данных (FormData):**

```javascript
FormData {
  image: File,                    // Файл изображения
  alt: string,                    // Альтернативный текст (название товара)
  is_primary: string              // "true" или "false" (главное изображение)
}
```

**Headers:**

```
Content-Type: multipart/form-data
```

### 6. Дополнительные операции после создания

#### Создание долга (если выбран тип долга):

- **Endpoint:** `POST /main/debts/` (для тарифа "Старт")
- **Создание сделки:** `dispatch(createDeal({...}))`

#### Создание денежного потока:

- Если не долговая операция, создается денежный поток через `dispatch(addCashFlows({...}))`

#### Создание сделки:

- Если выбран поставщик и не долг, создается сделка со статусом "Продажа"

### 7. Обработка результата

**Успех:**

- Показывается AlertModal с типом "success"
- Через 1.5 секунды происходит редирект на `/crm/sklad`

**Ошибка:**

- Показывается AlertModal с типом "error" и сообщением об ошибке

## Пример полного payload для товара в маркете:

```javascript
{
  name: "Монитор Dell 24 дюйма",
  barcode: "1234567890123",
  brand_name: "Dell",
  category_name: "Мониторы",
  article: "DELL-24-001",
  unit: "шт",
  is_weight: false,
  price: "15000.00",
  discount_percent: "0",
  country: "Россия",
  expiration_date: null,
  client: "uuid-поставщика",
  plu: null,
  characteristics: {
    height_cm: "35.5",
    width_cm: "55.2",
    depth_cm: "5.8",
    factual_weight_kg: "3.2",
    description: "Монитор с диагональю 24 дюйма"
  },
  purchase_price: "12000.00",
  markup_percent: "25",
  quantity: 10,
  stock: true
}
```

## Файлы, участвующие в процессе:

1. **Компонент:** `src/Components/Deposits/Sklad/AddProductPage.jsx`
2. **Redux Thunk:** `src/store/creators/productCreators.js`
3. **API функция:** `src/api/products.js`
4. **API клиент:** `src/api/index.js` (базовый axios instance)
