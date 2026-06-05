# Маркет — склад `/crm/sklad`: сканирование штрихкода

Документ для бэкенда и фронта.  
**Страница:** `/crm/sklad` (`MarketWarehouse`).

**Статус бэкенда:** 2026-06-05.

---

## 2. Эндпоинт

### `GET /api/main/products/warehouse-barcode/{barcode}/`

**Назначение:** только **поиск товара по штрихкоду** для склада маркета (без продажи, без корзины).

**Реализация:** `apps/main/views.py` → `ProductWarehouseBarcodeAPIView`.

#### Параметры пути

| Параметр | Описание |
|----------|----------|
| `barcode` | Штрих-код как строка; **ведущие нули сохранять** (как в POS: `0693123456789`). URL-кодирование обязательно. |

#### Query (опционально)

| Параметр | Описание |
|----------|----------|
| `branch` | UUID филиала — товары филиала + глобальные (`branch IS NULL`) |

#### Логика поиска

Та же, что у `POST .../pos/sales/{id}/scan/` (`_lookup_product_for_pos_scan`):

1. Основной `product.barcode` (с нормализацией кандидатов: ведущие нули, EAN-13)
2. `alternate_barcodes` / дополнительные штрихкоды
3. PLU / весовые штрихкоды / внутренний `code`
4. Scope компании, исключены товары со статусом `rejected`

**Не делать:** создание `Sale`, `SaleItem`, изменение корзины.

#### Ответ `200 OK`

```json
{
  "product": {
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
    "is_weight": false,
    "images": [],
    "category": "uuid-or-null",
    "brand": "uuid-or-null"
  },
  "matched_barcode": "0693123456789"
}
```

Формат `product` — `ProductSerializer` (как элемент `GET /api/main/products/list/`).  
Фронт поддерживает также плоский объект без обёртки `product`.

#### Ошибки

| Код | Условие |
|-----|---------|
| 404 | Товар с таким штрихкодом не найден |
| 400 | Пустой barcode |
| 403 | Нет компании у пользователя |

---

## 3. Связь с существующими API

| API | Назначение | Использовать на складе? |
|-----|------------|-------------------------|
| `POST /main/pos/sales/{id}/scan/` | Добавить строку в корзину кассы | **Нет** |
| `GET /main/products/warehouse-barcode/{barcode}/` | Поиск для склада | **Да** (основной) |
| `GET /main/products/global-barcode/{barcode}/` | Глобальный поиск (касса, добавление товара) | Fallback на фронте |
| `GET /main/products/list/?search=` | Текстовый поиск | Не замена точному скану |

---

## 4. Фронт (реализовано)

| Файл | Роль |
|------|------|
| `tools/marketWarehouseBarcodeScan.js` | `lookupMarketWarehouseProductByBarcode()` |
| `src/api/products.js` | `lookupWarehouseProductByBarcodeApi()` |
| `src/Components/Sectors/Market/Warehouse/Warehouse.jsx` | Скан → lookup → `navigate(/crm/sklad/{id})` |

**Порядок запросов:**

1. `GET /main/products/warehouse-barcode/{barcode}/` — основной
2. При **404** — `GET /main/products/global-barcode/{barcode}/` — fallback

---

## 5. Чеклист бэкенда

- [x] `GET /main/products/warehouse-barcode/{barcode}/`
- [x] Поиск по основному и дополнительным штрихкодам (как POS scan)
- [x] Ответ с `id` и полями как в `products/list` (`ProductSerializer`)
- [x] Без побочных эффектов (корзина, продажа)
- [x] 404 при отсутствии товара
- [x] Зарегистрирован в `apps/main/urls.py`

---

## 6. Smoke-тест

1. Открыть `/crm/sklad`, отсканировать известный штрихкод.
2. В Network: один `GET .../warehouse-barcode/...` (или fallback `global-barcode`).
3. Нет запросов `pos/sales/start`, `scan`, `delete`.
4. Переход на карточку товара `/crm/sklad/{uuid}`.
