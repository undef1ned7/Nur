# Маркет — Добавление товара на склад: поля и API

**Экраны фронта:**
- Склад: `/crm/sklad` (`src/Components/Sectors/Market/Warehouse/Warehouse.jsx`)
- Карточка добавления/редактирования: `/crm/sklad/add-product`, `/crm/sklad/add-product/:id`
  (`src/Components/Deposits/Sklad/AddProductPage.jsx`, payload собирается в
  `src/Components/Deposits/Sklad/AddProductPage/utils/productUtils.js` → `buildProductPayload`)
- Вкладка «Сканирование» в той же карточке: `src/Components/Deposits/Sklad/AddProductBarcode.jsx`
- Приход от поставщика: `/crm/market/procurement/receipt`
  (`src/Components/Sectors/Market/Warehouse/SupplierReceiptPage.jsx`)

**Статус:** описание текущего фактического контракта (то, что фронт отправляет и ожидает получить).

---

## 1. Четыре способа положить товар на склад

| # | Сценарий | Эндпоинт | Что делает |
|---|---|---|---|
| 1 | Ручное создание карточки товара | `POST /main/products/create-manual/` | Создаёт новый товар сразу с остатком `quantity` |
| 2 | Скан штрихкода (вкладка «Сканирование») | `GET /main/products/global-barcode/{code}/` → `POST /main/products/create-by-barcode/` | Подтягивает товар из глобального каталога и заводит его в компанию с остатком |
| 3 | Приход от поставщика (накладная) | `POST /main/suppliers/{supplier_id}/receipt/` | Увеличивает остаток **существующих** товаров пачкой + пишет закупку/долг |
| 4 | Догрузка остатка по существующему товару | `POST /main/products/add-to-warehouse/` | Эндпоинт есть в API-слое (`addProductToWarehouseApi`), но из UI Маркета сейчас **не вызывается** |

Редактирование той же карточки — `PATCH /main/products/{id}/` c тем же payload.

---

## 2. Основной запрос: `POST /main/products/create-manual/`

`Content-Type: application/json`. Заголовок `Authorization: Bearer <accessToken>`, компания берётся из токена.

### 2.1. Общие поля (отправляются всегда, для любого `kind`)

| Поле | Тип | Обяз. | Значение по умолчанию | Описание |
|---|---|---|---|---|
| `name` | string | ✅ | — | Наименование товара. Фронт не пускает пустое |
| `barcode` | string \| null | ✅ | `null` | Основной штрихкод. Фронт требует заполнения; в API допускается `null` |
| `alternate_barcodes` | string[] | — | `[]` | Доп. штрихкоды. Разбор из текстового поля: разделители `\n`, `,`, `;`; пробелы убираются, дубли и совпадение с `barcode` отбрасываются (`parseAlternateBarcodesForApi`). См. [alternate-barcodes.md](./alternate-barcodes.md) |
| `brand_name` | string | — | `""` | **Название** бренда, не UUID. Бэкенд создаёт бренд, если такого нет |
| `category_name` | string | — | `""` | **Название** категории, не UUID. Создаётся при отсутствии |
| `article` | string | — | `""` | Артикул |
| `unit` | string | — | `"шт"` | Единица измерения. Свободный ввод (не enum): `шт`, `кг`, `л`, `м`… Все цены — за 1 `unit` |
| `is_weight` | bool | — | `false` | Весовой товар (для `kind=service` — «дробная услуга»). Влияет на выгрузку на весы |
| `price` | string (decimal) | ✅ | `"0"` | Цена продажи за 1 `unit`. До 3 знаков после запятой |
| `wholesale_price` | string (decimal) | — | `"0"` | Оптовая цена за 1 `unit` |
| `discount_percent` | string (decimal) | — | `"0"` | Постоянная скидка на товар, % |
| `country` | string | — | `""` | Страна производства |
| `expiration_date` | string (`YYYY-MM-DD`) \| null | — | `null` | Срок годности |
| `client` | UUID \| null | — | `null` | **Поставщик** товара (запись из `/main/clients/?type=suppliers`) |
| `plu` | number \| null | — | `null` | PLU для весов. Заполняется только при `is_weight=true`; если пользователь не ввёл — фронт подставляет `<кол-во весовых товаров> + 1` |
| `hotkey_group` | string \| null | — | `null` | Группа горячих клавиш кассы (одна буква, приводится к UPPERCASE); пустая строка → `null` |
| `description` | string | — | `""` | Описание (дублируется в `characteristics.description`) |
| `characteristics` | object \| null | — | `null` | Габариты и описание, см. 2.3. Если все поля пустые — отправляется `null` |
| `kind` | enum | ✅ | `"product"` | `product` — товар, `service` — услуга, `bundle` — комплект |

### 2.2. Поля, зависящие от `kind`

| Поле | Тип | `product` | `service` | `bundle` (комплект) |
|---|---|---|---|---|
| `purchase_price` | string (decimal) | ✅ обяз., цена закупки за 1 `unit` | всегда `"0"` | всегда `"0"` |
| `markup_percent` | string (decimal) | наценка, % (пусто → `"0"`) | наценка, % | наценка, % |
| `quantity` | number | остаток, который кладём на склад (пусто → `0`) | всегда `0` | количество комплектов |
| `stock` | bool | **акционный товар** (см. 2.5), не «есть на складе» | всегда `false` | всегда `false` |
| `promotion_rules_input` | array | ступени акции при `stock=true`, иначе `[]` | не отправляется | не отправляется |
| `packages_input` | array | упаковки для поштучной продажи (если включён тумблер), иначе `[]` | не отправляется | состав комплекта + упаковки |
| `is_weight` | bool | «весовой товар» | «дробная услуга» | всегда `false` |

Связь цен (считается на фронте, `useProductPriceCalculation`):
`price = purchase_price × (1 + markup_percent / 100)`, округление до 2 знаков.
Если пользователь правит `price` руками, а наценку не трогал — пересчитывается `markup_percent`.

### 2.3. `characteristics` (объект или `null`)

| Поле | Тип | Описание |
|---|---|---|
| `height_cm` | string \| null | Высота, см. `"0"`/пусто → `null` |
| `width_cm` | string \| null | Ширина, см |
| `depth_cm` | string \| null | Глубина, см |
| `factual_weight_kg` | string \| null | Фактический вес, кг |
| `description` | string | Описание товара |

Весь объект отправляется как `null`, если нет ни одного габарита и описание пустое.

### 2.4. `packages_input[]` — упаковки / состав комплекта

| Поле | Тип | Описание |
|---|---|---|
| `name` | string | Название упаковки («Блок», «Ящик») или название товара в комплекте |
| `quantity_in_package` | number | Количество единиц в упаковке, > 0 (по умолчанию `1`) |
| `unit` | string | Единица измерения (берётся из `unit` товара) |
| `piece_unit_price` | string (decimal) | Цена за 1 штуку внутри упаковки; для позиций комплекта — `"0"` |

Для `kind=product` массив отправляется, только когда включён тумблер «Поштучная продажа»; иначе `[]`.
Для `kind=bundle` в массив попадают сначала товары комплекта, затем упаковки.

### 2.5. `promotion_rules_input[]` — ступени акции

Отправляются только при `kind=product` и `stock=true`. Максимум **30** ступеней.

| Поле | Тип | Ограничения |
|---|---|---|
| `position` | int | Порядковый номер ступени, с `0`, без дыр (фронт пересобирает) |
| `min_amount` | string (decimal) | Сумма/количество «от», ≥ 0 |
| `discount_percent` | string (decimal) | Скидка, `0.01`–`100` |
| `promo_quantity` | int, опционально | Лимит штук по акции, целое ≥ 1. Поле не отправляется, если пусто |

Невалидные строки молча выбрасываются на фронте; если после фильтрации массив пуст — форма не отправляется (ошибка `promotion_rules`).

### 2.6. Полный пример: товар

```json
{
  "name": "Кока-Кола 1.5л",
  "barcode": "4870204012345",
  "alternate_barcodes": ["4870204099999"],
  "brand_name": "Coca-Cola",
  "category_name": "Напитки",
  "article": "CC-15",
  "unit": "шт",
  "is_weight": false,
  "price": "120.000",
  "wholesale_price": "110.000",
  "discount_percent": "0",
  "country": "Кыргызстан",
  "expiration_date": "2027-01-31",
  "client": "0f2b8f1e-1c9a-4a1a-9d0e-2f6c1a5b7d33",
  "plu": null,
  "hotkey_group": "A",
  "description": "Газированный напиток",
  "characteristics": {
    "height_cm": "32",
    "width_cm": "9",
    "depth_cm": "9",
    "factual_weight_kg": "1.55",
    "description": "Газированный напиток"
  },
  "kind": "product",
  "purchase_price": "100.000",
  "markup_percent": "20",
  "quantity": 48,
  "stock": true,
  "promotion_rules_input": [
    { "position": 0, "min_amount": "1000", "discount_percent": "5" },
    { "position": 1, "min_amount": "3000", "discount_percent": "10", "promo_quantity": 20 }
  ],
  "packages_input": [
    { "name": "Блок", "quantity_in_package": 6, "unit": "шт", "piece_unit_price": "118.000" }
  ]
}
```

### 2.7. Пример: весовой товар

```json
{
  "name": "Яблоки Семеренко",
  "barcode": "2200000000019",
  "unit": "кг",
  "is_weight": true,
  "plu": 17,
  "price": "150.000",
  "purchase_price": "110.000",
  "markup_percent": "36.36",
  "quantity": 25.5,
  "kind": "product",
  "stock": false,
  "promotion_rules_input": [],
  "packages_input": []
}
```

### 2.8. Пример: услуга и комплект

```json
{ "name": "Упаковка подарка", "kind": "service", "price": "50.000",
  "purchase_price": "0", "markup_percent": "0", "quantity": 0, "stock": false, "is_weight": false }
```

```json
{ "name": "Новогодний набор", "kind": "bundle", "price": "990.000",
  "purchase_price": "0", "markup_percent": "0", "quantity": 10, "stock": false,
  "packages_input": [
    { "name": "Кока-Кола 1.5л", "quantity_in_package": 2, "unit": "шт", "piece_unit_price": "0" },
    { "name": "Конфеты 300г",  "quantity_in_package": 1, "unit": "шт", "piece_unit_price": "0" }
  ] }
```

---

## 3. Валидация на фронте (`validateProductData`)

| Условие | Ошибка на поле |
|---|---|
| Пустое `name` | `name` — «Обязательное поле» |
| Пустой `barcode` | `barcode` — «Обязательное поле» |
| `kind=product` и пустая `purchase_price` | `purchase_price` |
| Пустая `price` (для всех типов) | `price` |
| `kind=bundle` без выбранных товаров | `kitProducts` |
| `stock=true` без валидных ступеней | `promotion_rules` |
| Включена поштучная продажа, но у упаковки `quantity ≤ 0` или пустая/отрицательная цена за штуку | `packagings` |

Отдельно валидируются долговые поля (поставщик обязателен при `debt`), см. §6.

Ошибки бэкенда фронт разбирает через `tools/validateResErrors.js` — ожидается либо `{"detail": "..."}`,
либо `{"<field>": ["сообщение"]}`, либо `{"error": "..."}`.

---

## 4. Ответ и последующие запросы

`201 Created` → тело товара; фронту нужен как минимум `id` (читается как `product.id` или `product.data.id`).

### 4.1. Изображения — после создания товара

```
POST /main/products/{product_id}/images/
Content-Type: multipart/form-data
```

| Поле FormData | Тип | Описание |
|---|---|---|
| `image` | File | Файл изображения |
| `alt` | string | Альт-текст (по умолчанию — имя товара); отправляется только если заполнен |
| `is_primary` | `"true"` \| `"false"` | Главное изображение |

Удаление (в режиме редактирования): `DELETE /main/products/{product_id}/images/{image_id}/`.
Загрузка идёт через `Promise.allSettled` и **не блокирует** основной флоу — ошибка только пишется в консоль.

### 4.2. Модель чтения — `GET /main/products/{id}/` и `GET /main/products/list/`

Карточка редактирования ожидает такие поля в ответе:

| Поле | Тип | Комментарий |
|---|---|---|
| `id` | UUID | |
| `name`, `barcode`, `article`, `code`, `country`, `unit` | string | `code` показывается в UI, но обратно **не отправляется** |
| `alternate_barcodes` | string[] | |
| `brand_name`, `category_name` | string | Названия (а не только `brand`/`category` id) |
| `price`, `wholesale_price`, `purchase_price` | string/number | Форматируются до 3 знаков |
| `markup_percent`, `discount_percent` | string/number | |
| `quantity` | number | Текущий остаток |
| `is_weight`, `stock` | bool | |
| `scale_type` | `"piece"` \| `"weight"` \| null | Используется при скане и в других сферах |
| `plu` | number \| null | |
| `hotkey_group` | string \| null | |
| `kind` | `product`/`service`/`bundle` | По нему восстанавливается тип в форме |
| `expiration_date` | date \| null | |
| `client` | UUID \| null | Поставщик |
| `characteristics` | object \| null | `height_cm`, `width_cm`, `depth_cm`, `factual_weight_kg`, `description` |
| `packages` | array | `name`, `quantity_in_package`, `piece_unit_price` |
| `promotion_rules` | array | `position`, `min_amount`, `discount_percent`, `promo_quantity` |
| `images` | array | `id`, `image_url`/`image`, `alt`, `is_primary` |

Список — пагинированный DRF-формат: `{ count, next, previous, results: [...] }`, размер страницы 100
(`PAGE_SIZE` в `src/Components/Sectors/Market/Warehouse/constants.js`).
Параметры списка на складе: `page`, `search`, плюс фильтры из `FilterModal` (`brand`, `category`, `client`, диапазоны цены/остатка/срока годности, `is_weight`).

---

## 5. Добавление по штрихкоду (вкладка «Сканирование»)

1. `GET /main/products/global-barcode/{barcode}/` — поиск товара в глобальном каталоге.
   404 → предлагаем завести вручную.
2. `POST /main/products/create-by-barcode/` — заводим товар в компанию:

```json
{
  "barcode": "4870204012345",
  "name": "Кока-Кола 1.5л",
  "brand_name": "Coca-Cola",
  "category_name": "Напитки",
  "quantity": 12,
  "purchase_price": "100",
  "price": "120",
  "wholesale_price": "110",
  "markup_percent": "20",
  "client": "0f2b8f1e-...",
  "alternate_barcodes": [],
  "plu": null,
  "scale_type": null,
  "stock": false,
  "promotion_rules_input": []
}
```

Отличия от `create-manual`: обязательно приходит `barcode` найденного товара, дополнительно
передаётся `scale_type` (`"piece"` / `"weight"` / `null`), нет `characteristics` и `kind`.

Для сферы «Склад» (не Маркет) тот же экран шлёт `POST /warehouse/{warehouse_uuid}/products/scan/`
с дополнительными полями `warehouse` (UUID) и `category` (обязательно).

Поиск товара по штрихкоду на складе Маркета без кассы:
`GET /main/products/warehouse-barcode/{code}/`.

---

## 6. Приход от поставщика (массовое пополнение остатков)

Экран `/crm/market/procurement/receipt`.

| Шаг | Запрос |
|---|---|
| Список поставщиков | `GET /main/clients/?type=suppliers&page_size=500` |
| Товары поставщика | `GET /main/suppliers/{supplier_id}/products/` |
| Добавить товар в накладную (привязать к поставщику) | `PATCH /main/products/{id}/` с `{ "client": "<supplier_id>" }` |
| Поиск товаров в модалке | `GET /main/products/list/?page=&search=` |
| Провести накладную | `POST /main/suppliers/{supplier_id}/receipt/` |
| Журнал накладных | `GET /main/suppliers/receipts/` |

Тело накладной:

```json
{
  "items": [
    { "product": "3f1c...uuid", "qty": 10, "purchase_price": 100.5 },
    { "product": "9a2e...uuid", "qty": 2.5 }
  ],
  "payment_type": "cash"
}
```

| Поле | Тип | Описание |
|---|---|---|
| `items[].product` | UUID | Существующий товар |
| `items[].qty` | number > 0 | Сколько принимаем (дробные допустимы для весовых) |
| `items[].purchase_price` | number ≥ 0, опционально | Новая цена закупки; поле опускается, если пользователь его не заполнил |
| `payment_type` | `cash` \| `debt` \| `prepayment` | `full` на фронте → `cash` |

Ответ должен содержать `id` (или `uuid`) накладной — по нему строится печать/детализация.

Дальше фронт (только при `debt`/`prepayment` и сумме > 0) создаёт:
- `POST /main/debts/` (`name`, `phone`, `due_date`, `amount`) — только на тарифе «Старт»;
- сделку через `createDeal` (`статус` «Долги»/«Предоплата», `prepayment`, `debtMonths`, `first_due_date`);
- расход по кассе через `addCashFlows`, если оплата наличными/предоплатой.

---

## 7. Сопутствующие справочники

| Что | Эндпоинт |
|---|---|
| Бренды | `GET/POST /main/brands/`, `PATCH/DELETE /main/brands/{id}/` |
| Категории | `GET/POST /main/categories/`, `PATCH/DELETE /main/categories/{id}/` |
| Поставщики/клиенты | `GET/POST /main/clients/` (`?type=suppliers`) |
| Массовое изменение бренда/категории/поставщика | `PATCH /main/products/bulk-update/` — см. [bulk_update_products.md](./bulk_update_products.md) |
| Массовое удаление | `DELETE /main/products/bulk-delete/` |

В карточке товара бренд и категория передаются **строками** (`brand_name`, `category_name`) —
отдельно создавать их перед сохранением товара не требуется.

---

## 8. Известные расхождения и подводные камни

1. **`stock` — это не остаток.** В payload карточки `stock` означает «акционный товар» (включает
   `promotion_rules_input`). Остаток передаётся полем `quantity`. В старом описании
   `src/Components/Deposits/Sklad/DATA_FLOW_AddProductPage.md` `stock` подписан как «товар есть на складе» — это устарело.
2. **`code` и `min_stock` не отправляются.** Оба поля есть в форме/состоянии (`marketData.code`,
   `marketData.minStock`), но в payload не попадают; `minStock` при загрузке товара всегда сбрасывается в `"0"` («Нет в API»).
3. **`description` дублируется** — на верхнем уровне и внутри `characteristics`. Бэкенду стоит
   считать источником истины `characteristics.description` (карточка читает именно его).
4. **Цены — строки.** Все денежные поля отправляются строками с точкой как разделителем, до 3 знаков.
5. **`quantity` — число**, может быть дробным для весовых товаров.
6. **`plu`** генерируется фронтом (`weightProductsCount + 1`), уникальность не гарантируется —
   дубли должен отсекать бэкенд.
7. **`alternate_barcodes`** сохраняются, но поиск по ним на бэкенде поддержан не везде —
   см. [alternate-barcodes.md](./alternate-barcodes.md).
