# Маркет — склад `/crm/sklad`: сканирование штрихкода

Документ для бэкенда и фронта.  
**Страница:** `/crm/sklad` (`MarketWarehouse`).

## 2. Новый эндпоинт (нужен на бэке)

### `GET /api/main/products/warehouse-barcode/{barcode}/`

**Назначение:** только **поиск товара по штрихкоду** для склада маркета (без продажи, без корзины).

#### Параметры пути

| Параметр | Описание |
|----------|----------|
| `barcode` | Штрих-код как строка; **ведущие нули сохранять** (как в POS: `0693123456789`). URL-кодирование обязательно. |

#### Query (опционально)

| Параметр | Описание |
|----------|----------|
| `branch` | UUID филиала, если список склада фильтруется по филиалу |

#### Логика поиска (рекомендация)

Та же, что у `POST .../pos/sales/{id}/scan/` для резолва товара:

1. Основной `product.barcode`  
2. `alternate_barcodes` / дополнительные штрихкоды  
3. Scope компании (`CompanyBranchQuerysetMixin`), активные товары  

**Не делать:** создание `Sale`, `SaleItem`, изменение корзины.

#### Ответ `200 OK`

Объект товара в том же формате, что элемент `GET /api/main/products/list/` (чтобы фронт мог сразу открыть `/crm/sklad/{id}` и показывать данные):

```json
{
  "id": "uuid",
  "name": "Сабиз",
  "code": "001",
  "article": "ART-1",
  "barcode": "0693123456789",
  "alternate_barcodes": [],
  "unit": "кг",
  "quantity": "100.000",
  "price": "85.00",
  "purchase_price": "70.00",
  "discount_percent": "0",
  "kind": "product",
  "scale_type": "weight",
  "images": [],
  "category": "uuid-or-null",
  "brand": "uuid-or-null"
}
```

Допустимо обёртка:

```json
{
  "product": { "...": "..." },
  "matched_barcode": "0693123456789"
}
```

Фронт поддерживает оба варианта.

#### Ошибки

| Код | Условие |
|-----|---------|
| 404 | Товар с таким штрихкодом не найден |
| 400 | Пустой barcode |

---

## 3. Связь с существующими API

| API | Назначение | Использовать на складе? |
|-----|------------|-------------------------|
| `POST /main/pos/sales/{id}/scan/` | Добавить строку в корзину кассы | **Нет** (убрать с `/crm/sklad`) |
| `GET /main/products/global-barcode/{barcode}/` | Глобальный поиск (касса, добавление товара) | Fallback на фронте, пока нет `warehouse-barcode` |
| `GET /main/products/list/?search=` | Текстовый поиск | Не замена точному скану |

---

## 4. Фронт (реализовано)

| Файл | Роль |
|------|------|
| `tools/marketWarehouseBarcodeScan.js` | `lookupMarketWarehouseProductByBarcode()` |
| `src/api/products.js` | `lookupWarehouseProductByBarcodeApi()` |
| `src/Components/Sectors/Market/Warehouse/Warehouse.jsx` | Скан → lookup → `navigate(/crm/sklad/{id})` |

**Порядок запросов:**

1. `GET /main/products/warehouse-barcode/{barcode}/` — основной (после реализации на бэке)  
2. При **404** — `GET /main/products/global-barcode/{barcode}/` — временный fallback  

Временные `start` / `scan` / `delete` POS **больше не вызываются**.

---

## 5. Чеклист бэкенда

- [ ] `GET /main/products/warehouse-barcode/{barcode}/`
- [ ] Поиск по основному и дополнительным штрихкодам (как POS scan)
- [ ] Ответ с `id` и полями как в `products/list`
- [ ] Без побочных эффектов (корзина, продажа)
- [ ] 404 при отсутствии товара
- [ ] Зарегистрировать в OpenAPI / `urls.py`

---

## 6. Smoke-тест

1. Открыть `/crm/sklad`, отсканировать известный штрихкод.  
2. В Network: один `GET .../warehouse-barcode/...` (или fallback `global-barcode`).  
3. Нет запросов `pos/sales/start`, `scan`, `delete`.  
4. Переход на карточку товара `/crm/sklad/{uuid}`.
