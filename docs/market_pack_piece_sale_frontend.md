# Маркет: поштучная продажа из упаковки — API для фронтенда

Документ для фронта: товары, у которых **остаток на складе ведётся в упаковках** (пачка, блок и т.п.), а на **кассе** нужно продавать **отдельные штуки** (типичный кейс — сигареты).

**Бэкенд:** `ProductPackage`, `CartItem.sale_package`, `SaleItem.sale_package`.  
**Подробности бэкенда:** [pos_pack_piece_sale.md](./pos_pack_piece_sale.md).  
**Корзина POS (общее):** [MARKET_POS_CART_FRONTEND_API.md](./MARKET_POS_CART_FRONTEND_API.md).

**Базовый URL:** `/api/main/`  
**Авторизация:** `Authorization: Bearer <token>`.

---

## 1. Когда нужна эта логика

| Сценарий | Как продавать | Поле в корзине |
|----------|---------------|----------------|
| Обычный товар, `unit = "шт."` | Штуки как обычно | `sale_package = null` |
| Остаток в **пачках**, продажа **целой пачки** | Как обычный товар | `sale_package = null`, `quantity` в пачках |
| Остаток в **пачках**, продажа **штук из пачки** | Через упаковку | `sale_package = <uuid>`, `quantity` в **штуках** |

**Признак товара с поштучной продажей из упаковки:**

```javascript
const supportsPieceFromPack = (product) =>
  Array.isArray(product.packages) && product.packages.length > 0;
```

Если `packages` пустой — поштучная продажа из упаковки **не настроена** (скан/добавление работает только в учётных единицах `product.unit`).

---

## 2. Поля товара (`ProductSerializer`)

Источники: `GET /api/main/products/list/`, `GET /api/main/products/{id}/`, barcode-lookup.

### Основные поля

| Поле | Смысл для поштучной продажи |
|------|----------------------------|
| `unit` | Учётная единица склада (например `"упак."`, `"пачка"`) |
| `quantity` | Остаток **в учётных единицах** (число пачек) |
| `price` | Розница **за одну учётную единицу** (за пачку) |
| `purchase_price` | Закупка **за одну учётную единицу** (за пачку) |
| `packages` | Массив упаковок (read-only) |

### Упаковка (`packages[]`)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Передаётся на кассе как `sale_package_id` |
| `name` | string | Подпись («Пачка», «Блок») |
| `quantity_in_package` | string decimal | Сколько **штук** в одной учётной единице (например `"20.000"`) |
| `unit` | string | Единица штуки (часто `"шт."`); если пусто — как у товара |
| `piece_unit_price` | string decimal \| null | Розничная цена **одной штуки** на кассе |

**Пример ответа:**

```json
{
  "id": "a1b2c3d4-…",
  "name": "Сигареты Example",
  "unit": "упак.",
  "quantity": "12.000",
  "price": "300.00",
  "purchase_price": "240.00",
  "packages": [
    {
      "id": "pkg-uuid-…",
      "name": "Пачка",
      "quantity_in_package": "20.000",
      "unit": "шт.",
      "piece_unit_price": "15.00"
    }
  ]
}
```

### Цена за штуку (для UI)

```javascript
function pieceUnitPrice(product, pkg) {
  if (pkg.piece_unit_price != null && pkg.piece_unit_price !== '') {
    return Number(pkg.piece_unit_price);
  }
  const ipp = Number(pkg.quantity_in_package);
  if (ipp > 0) return Number(product.price) / ipp;
  return Number(product.price);
}

function piecePurchasePrice(product, pkg) {
  const ipp = Number(pkg.quantity_in_package);
  if (ipp <= 0) return Number(product.purchase_price);
  return Number(product.purchase_price) / ipp;
}
```

Если `piece_unit_price = null` (старые записи) — бэкенд на кассе считает `price / quantity_in_package`.

---

## 3. CRM / склад — создание и редактирование

### Эндпоинты

```http
POST /api/main/products/create-manual/
POST /api/main/products/create-by-barcode/
PATCH /api/main/products/{id}/
```

### Запись упаковок

Поле **`packages_input`** (write-only). При чтении приходит **`packages`**.

Если передаётся хотя бы одна упаковка — у **каждой** строки обязателен **`piece_unit_price`** (≥ 0).

```json
{
  "name": "Сигареты Example",
  "unit": "упак.",
  "quantity": "10",
  "price": "300.00",
  "purchase_price": "240.00",
  "packages_input": [
    {
      "name": "Пачка",
      "quantity_in_package": "20",
      "unit": "шт.",
      "piece_unit_price": "15.00"
    }
  ]
}
```

**PATCH:** при передаче `packages_input` старые упаковки **полностью заменяются**. Чтобы убрать поштучную продажу — передайте `"packages_input": []` (если нет активных поштучных строк в корзинах).

### Ошибки CRM

| Код | Поле | Текст (пример) |
|-----|------|----------------|
| 400 | `packages_input` | «Для каждой упаковки укажите piece_unit_price…» |
| 400 | `packages_input` | «piece_unit_price не может быть отрицательной.» |
| 400 | `packages_input` | Нельзя удалить упаковку, если есть корзины с поштучными строками |

---

## 4. Касса (POS) — добавление в корзину

### POST `/api/main/pos/sales/{cart_id}/add-item/`

```json
{
  "product_id": "a1b2c3d4-…",
  "quantity": "7.000",
  "sale_package_id": "pkg-uuid-…"
}
```

| Поле | Обязательное | Описание |
|------|--------------|----------|
| `product_id` | да | UUID товара |
| `quantity` | нет | По умолчанию `1.000`. При `sale_package_id` — **штуки** |
| `sale_package_id` | нет | UUID из `product.packages[].id` |
| `unit_price` | нет | Цена за **штуку** (переопределяет `piece_unit_price`) |
| `discount_total` | нет | Скидка на строку (сумма) |
| `allow_minus` | нет | Продажа в минус (только owner/admin) |

**Без `sale_package_id`** — обычная продажа: `quantity` в единицах склада (`unit`, пачки).

**С `sale_package_id`** — поштучно: `quantity` = число штук, цена за штуку по умолчанию из `piece_unit_price`.

### Ответ корзины — позиция

```json
{
  "id": "item-uuid",
  "product": "a1b2c3d4-…",
  "product_name": "Сигареты Example",
  "quantity": "7.000",
  "unit_price": "15.00",
  "line_discount": "0.00",
  "sale_package": "pkg-uuid-…",
  "display_name": "Сигареты Example",
  "line_total": "105.00"
}
```

| Поле | Описание |
|------|----------|
| `sale_package` | `null` — пачки; uuid — поштучная строка |
| `unit_price` | За **штуку** (если `sale_package` задан) или за учётную единицу |
| `display_name` | Только имя товара; **единица не дописывается** — подпись «шт / пачка» делает фронт |

### Расчёт суммы строки

```text
line_total = unit_price × quantity - line_discount
```

Для поштучной строки: 7 шт × 15 = 105.

### PATCH позиции

`PATCH /api/main/pos/carts/{cart_id}/items/{item_id}/`

Меняются `quantity`, `unit_price`, `discount_total`. **`sale_package` изменить нельзя** — для смены режима удалите строку и добавьте заново.

---

## 5. Скан штрихкода на кассе

`POST /api/main/pos/sales/{cart_id}/scan/`

Скан **всегда** добавляет товар **без** `sale_package` — то есть в **учётных единицах** (целые пачки).

```javascript
// После scan для товара с packages — НЕ ждать поштучную строку автоматически.
// Нужен отдельный UI: «Продать поштучно» → add-item с sale_package_id.
```

Рекомендуемый UX:

1. Скан → если `product.packages.length > 0`, показать выбор: **«Пачка»** / **«Поштучно»**.
2. «Пачка» → можно оставить результат scan или `add-item` без `sale_package_id`.
3. «Поштучно» → модалка количества штук → `add-item` с `sale_package_id`.

---

## 6. Две строки одного товара в корзине

Допустимо одновременно:

| Строка | `sale_package` | `quantity` | Списание со склада |
|--------|----------------|------------|-------------------|
| 1 | `null` | `2` | −2 пачки |
| 2 | `pkg-uuid` | `5` | −5/20 = −0.25 пачки |

Объединение строк: одинаковые `(product, sale_package)` **склеиваются** при повторном `add-item`.

**Уникальность на фронте:** не показывать одну строку «2 пачки + 5 шт» — это две разные позиции в API.

---

## 7. Остаток и валидация (для UI)

Склад хранит **пачки** (`product.quantity`). В корзине учитываются **все** строки этого товара.

```javascript
function consumePacks(qty, salePackageId, packages) {
  const q = Number(qty);
  if (!salePackageId) return q;
  const pkg = packages.find((p) => p.id === salePackageId);
  const ipp = Number(pkg?.quantity_in_package ?? 0);
  if (ipp <= 0) throw new Error('quantity_in_package must be > 0');
  return Math.round((q / ipp) * 1000) / 1000;
}

function maxPiecesAvailable(stockPacks, otherConsumePacks, pkg) {
  const ipp = Number(pkg.quantity_in_package);
  const freePacks = Math.max(0, Number(stockPacks) - otherConsumePacks);
  return Math.floor(freePacks * ipp);
}
```

При нехватке остатка `add-item` вернёт **400**:

```json
{
  "detail": "Недостаточно остатка (учёт в пачках). Доступно не более X.XXX условных пачек с учётом корзины."
}
```

Цена ниже закупки (без скидки):

```json
{
  "unit_price": "Цена продажи не может быть ниже закупочной (12.00)."
}
```

Минимальная цена без скидки = `purchase_price / quantity_in_package`.

---

## 8. Отображение в чеке / истории

После чекаута в `SaleItem` сохраняется `sale_package`. Для отображения:

- `sale_package != null` → количество в **штуках**, подпись «шт.» (или `packages[].unit`).
- `sale_package == null` → количество в `product.unit`.

Подпись строки (пример):

```text
Сигареты Example — 7 шт. × 15.00 = 105.00
Сигареты Example — 2 упак. × 300.00 = 600.00
```

---

## 9. Ограничения

| Контекст | Поштучно из упаковки |
|----------|----------------------|
| Обычная касса POS (`/api/main/pos/…`) | **Да** |
| Агентская корзина (`/api/main/agents/me/carts/…`) | **Нет** — `sale_package_id` → 400 |
| Чекаут агента с `sale_package` в корзине | **ValidationError** |

---

## 10. Чеклист фронта

### CRM / карточка товара (`/crm/sklad/{id}`)

- [ ] Блок «Упаковки для поштучной продажи»: `name`, `quantity_in_package`, `piece_unit_price`.
- [ ] При сохранении отправлять `packages_input`; показывать `packages` после загрузки.
- [ ] Подсказка: `price` / `purchase_price` — **за пачку**, `piece_unit_price` — **за штуку на кассе**.

### Касса

- [ ] Определять `supportsPieceFromPack(product)` по `packages.length`.
- [ ] После scan — выбор «пачка / поштучно» для таких товаров.
- [ ] `add-item` с `sale_package_id` и количеством в штуках.
- [ ] В списке корзины различать строки по `sale_package` (подпись «шт» vs `product.unit`).
- [ ] Не вызывать `sale_package_id` в агентском потоке.

### Утилиты (рекомендуется)

```javascript
// tools/marketPackPieceSale.js

export function getDefaultPackage(product) {
  const pkgs = product?.packages;
  if (!Array.isArray(pkgs) || !pkgs.length) return null;
  return pkgs[0];
}

export function cartItemUnitLabel(item, product) {
  if (item.sale_package) {
    const pkg = product?.packages?.find((p) => p.id === item.sale_package);
    return pkg?.unit || 'шт.';
  }
  return product?.unit || 'шт.';
}

export function formatCartItemSubtitle(item, product) {
  const unit = cartItemUnitLabel(item, product);
  return `${item.quantity} ${unit} × ${item.unit_price}`;
}
```

---

## 11. Smoke-тест

1. Создать товар: `unit = упак.`, `packages_input` с `quantity_in_package: 20`, `piece_unit_price: 15`.
2. `GET products/{id}/` — в ответе непустой `packages`.
3. POS: `add-item` без `sale_package_id`, `quantity: 1` → минус 1 пачка, цена 300.
4. POS: `add-item` с `sale_package_id`, `quantity: 5` → в корзине две строки; остаток −1.25 пачки суммарно.
5. Scan того же товара → добавляется строка **без** `sale_package` (пачка).
6. Чекаут → в продаже обе строки с корректными `sale_package` и суммами.

---

## 12. Связанные документы

| Документ | Содержание |
|----------|------------|
| [pos_pack_piece_sale.md](./pos_pack_piece_sale.md) | Полная логика бэкенда |
| [MARKET_POS_CART_FRONTEND_API.md](./MARKET_POS_CART_FRONTEND_API.md) | Корзина, PATCH, скидки |
| [market_warehouse_barcode_ru.md](./market_warehouse_barcode_ru.md) | Скан на складе (без корзины) |
