# Аналитика склада: закупочная стоимость остатков по складам

## Задача
В таблице «Склады» на `/crm/warehouse/analytics` показать стоимость остатка в двух ценах: «Продажная цена» (`on_hand_amount`) и «Закупочная цена» (`on_hand_purchase_amount`).

## Контракт API
В каждом элементе `details.warehouses[]` добавить поле:
- `on_hand_purchase_amount` — сумма `on_hand_qty × purchase_price` по складу (число/строка-decimal).

## Чек-лист приёмки
- [ ] Поле приходит для каждого склада (0, если остатков нет)
- [ ] Сумма считается по закупочной цене товара, а не по розничной (`on_hand_amount`)

## Фронт
- [OwnerAnalyticsContent.jsx](../../src/Components/Sectors/Warehouse/Analytics/OwnerAnalyticsContent.jsx)
