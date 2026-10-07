# Вкладка «Тариф и оплата» (/crm/set)

## Задача
Показать владельцу информацию о подписке: дата открытия аккаунта, тариф и цена, срок оплаты, лимиты тарифа с текущим использованием.

## Контракт API
`GET /users/company/` — поля уже отдаются бэкендом:

- `created_at` — «Аккаунт открыт»
- `subscription.status`, `started_at`, `end_date`, `days_left`, `next_payment_at`
- `subscription.plan.name`, `price`, `currency`, `period`
- `limits.{employees,warehouses,products}.{used,max}`; `max: null` = «без ограничений»

## Чек-лист приёмки
- [ ] Бэк отдаёт перечисленные поля в ответе компании
- [ ] Вкладка видна только владельцу
- [ ] Статус «Активна» при `end_date >= сегодня`, иначе «Не активна» и красный бейдж
- [ ] `null` в лимите отображается как «без ограничений»

## Фронт
- [TariffBillingSettings.jsx](../../src/Components/pages/Info/Settings/TariffBillingSettings.jsx)
- [Tabs.jsx](../../src/Components/pages/Info/Tabs/Tabs.jsx)
