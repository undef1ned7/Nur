# Исправление расчета суммы в документах продажи

## Проблема
Сумма товаров в документе не совпадала с итоговой суммой. Например, должно быть 1190, но получалось 1226.

## Причина
При формировании данных для PDF в `CreateSaleDocument.jsx`:
1. Каждый товар считался только с учетом его собственной скидки (`itemDiscount`)
2. Скидка по документу (`documentDiscount`) не применялась к каждому товару
3. В результате сумма всех `itemTotal` не совпадала с `totals.total`

## Решение

### 1. Исправлен расчет итогов в `CreateSaleDocument.jsx`
- Скидка по документу теперь применяется к сумме ПОСЛЕ скидок по позициям
- `documentDiscountAmount = (subtotalAfterItemsDiscount * discountPercent) / 100`
- `total = subtotalAfterItemsDiscount - documentDiscountAmount`

### 2. Исправлено формирование данных для PDF
- При формировании `items` для PDF, скидка по документу теперь применяется к каждому товару:
  - Сначала применяется скидка по позиции
  - Затем к результату применяется скидка по документу
- Теперь сумма всех `itemTotal` совпадает с `totals.total`

### 3. Добавлена передача `price_before_discount`
- Для каждого товара передается исходная цена без скидок
- Это позволяет корректно отображать цену без скидки в PDF

## Изменения в коде

### `CreateSaleDocument.jsx`
- Исправлен расчет `totals` (строки 150-191)
- Исправлено формирование `items` для PDF (строки 312-340)
- Добавлена передача `discount_percent` в `document` (строка 360)

### Логика расчета
1. **Subtotal** = сумма всех товаров без скидок
2. **ItemsDiscount** = сумма скидок по позициям
3. **SubtotalAfterItemsDiscount** = Subtotal - ItemsDiscount
4. **DocumentDiscountAmount** = SubtotalAfterItemsDiscount × discountPercent / 100
5. **Total** = SubtotalAfterItemsDiscount - DocumentDiscountAmount

Для каждого товара:
1. **ItemSubtotal** = ItemPrice × ItemQty
2. **ItemDiscountAmount** = ItemSubtotal × ItemDiscount / 100
3. **ItemSubtotalAfterItemDiscount** = ItemSubtotal - ItemDiscountAmount
4. **DocumentDiscountAmount** = ItemSubtotalAfterItemDiscount × discountPercent / 100
5. **ItemTotal** = ItemSubtotalAfterItemDiscount - DocumentDiscountAmount

Теперь сумма всех `ItemTotal` = `Total`

