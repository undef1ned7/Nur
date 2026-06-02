# Маркет — склад `/crm/sklad`: фильтры списка товаров

Документ для бэкенда по query-параметрам модалки **«Фильтры»** на странице склада сферы **Магазин**.

**Эндпоинт:** `GET /api/main/products/list/`  
**Фронт:** `src/Components/Sectors/Market/Warehouse/Warehouse.jsx` → `fetchProductsAsync` → `fetchProductsApi` (`src/api/products.js`).

Служебные поля Redux **не уходят** в API: `_cacheKey`, `_skipLoadingIfCached`, `warehouse`.

---

## 1. Базовые параметры (всегда)

| Параметр | Тип | Описание |
|----------|-----|----------|
| `page` | number | Номер страницы (из URL `?page=`). |
| `search` | string | Поиск по строке в шапке (debounce), если не пусто. |

---

## 2. Тип товара — `kind`

Чекбоксы в UI: **Товар**, **Услуга**, **Комплект**.

| Значение `kind` | Смысл |
|-----------------|--------|
| `product` | Обычный товар |
| `service` | Услуга |
| `bundle` | Комплект (в UI «Комплект») |

**Поведение фронта:**

- Если отмечены **все три** типа — параметр `kind` **не передаётся** (показать все типы).
- Если отмечен **один или два** типа — в query уходит **массив** (axios сериализует как повторяющийся ключ или `kind[]=…` в зависимости от настроек клиента), например: `kind=product` или `kind=product&kind=service`.

**Рекомендация для бэка:** принимать и одно значение `?kind=product`, и несколько `?kind=product&kind=service`, и строку через запятую `?kind=product,service` — для совместимости.

Если **ни один** тип не выбран — фронт не отправляет запрос и показывает ошибку «Выберите хотя бы один тип товара».

Поле `kind` в ответе карточки товара уже используется при редактировании (`AddProductPage`: `product.kind`).

---

## 3. Пресеты — `preset`

Один параметр, **английский код** (не русский текст).

| `preset` | UI (русский) |
|----------|----------------|
| `discounted` | Товары со скидкой |
| `shelf_life_expires_7d` | Срок годности истекает в течение 7 дней |
| `zero_cost` | Нулевая себестоимость |
| `shelf_life_expired` | Истёк срок годности |
| `out_of_stock` | Нет в наличии |
| `not_sold_90d` | Не продаются 3 месяца (90 дней) |
| `negative_stock` | Отрицательный остаток |
| `stock_below_min` | Общий остаток меньше минимального |

Пресет **взаимоисключающий** с ручными полями того же смысла, где это возможно (бэкенд может приоритизировать `preset`).

**Миграция:** ранее фронт слал кириллические slug (`товары_со_скидкой`, …). Сейчас только коды из таблицы. Старые значения на бэке можно маппить один раз или игнорировать.

---

## 4. Справочники

| Параметр | Тип | Описание |
|----------|-----|----------|
| `category` | uuid/string | ID категории из `GET /main/categories/` |
| `brand` | uuid/string | ID бренда из `GET /main/brands/` |
| `supplier` | uuid/string | ID клиента-поставщика из `GET /main/clients/?type=suppliers` |

---

## 5. Цена

Передаётся только если `price_value` ≠ `0` и не пусто.

| Параметр | Значения |
|----------|----------|
| `price_type` | `base` — базовая; `purchase` — закупка; `cost` — себестоимость; `discount` — скидка |
| `price_condition` | `gt` — больше; `lt` — меньше; `eq` — равно |
| `price_value` | number/string, порог |

---

## 6. Остатки (блок в UI может быть скрыт)

| Параметр | Значения |
|----------|----------|
| `stock_type` | `total` — общие остатки |
| `stock_condition` | `gt` \| `lt` \| `eq` |
| `stock_value` | number/string |

---

## 7. Срок годности

| Параметр | Значения |
|----------|----------|
| `shelf_life_condition` | `expires_within` — истекает в течение N дней; `expired` — уже истёк |
| `shelf_life_value` | number, дней (для `expires_within`) |

---

## 8. Изменения товара (блок в UI может быть скрыт)

| Параметр | Значения |
|----------|----------|
| `changes_condition` | `gt` \| `lt` \| `eq` (фронт для «изменялся в течение» пока отдаёт как условие сравнения дней — уточнить контракт при реализации) |
| `changes_value` | number, дней |

---

## 9. Продаваемость

| Параметр | Значения |
|----------|----------|
| `sellability_condition` | `sold_within` — продавался в течение N дней; `not_sold_within` — не продавался в течение N дней |
| `sellability_value` | number, дней |

---

## 10. Пример запросов

**Только товары, со скидкой, страница 1:**

```http
GET /api/main/products/list/?page=1&kind=product&preset=discounted
```

**Услуги и комплекты, категория, цена закупки > 1000:**

```http
GET /api/main/products/list/?page=1&kind=service&kind=bundle&category=<uuid>&price_type=purchase&price_condition=gt&price_value=1000
```

**Поиск + поставщик:**

```http
GET /api/main/products/list/?page=1&search=молоко&supplier=<uuid>
```

---

## 11. Ответ списка

Без изменений относительно текущего `GET /main/products/list/`:

- пагинация: `count`, `next`, `previous`, `results[]`;
- элемент: как минимум `id`, `name`, `kind`, `quantity`, `price`, `code`, `article`, `unit`, изображения и т.д.

Фильтрация выполняется **на сервере**; фронт не дублирует фильтр по `kind` на клиенте.

---

## 12. Фронт (ориентир для ревью)

| Файл | Назначение |
|------|------------|
| `src/tools/marketWarehouseFilters.js` | Маппинг UI → query, пресеты, `kind` |
| `src/Components/Sectors/Market/Warehouse/components/FilterModal.jsx` | Модалка |
| `src/Components/Sectors/Market/Warehouse/Warehouse.jsx` | `requestParams` = `{ page, ...filters, search? }` |
| `src/api/products.js` | `fetchProductsApi` — вызов API |

**Статус:** фронт отправляет коды из этого документа; бэкенд должен реализовать/подтвердить обработку всех параметров (особенно `preset`, `kind` как массив, блоки цены/срока/продаваемости).
