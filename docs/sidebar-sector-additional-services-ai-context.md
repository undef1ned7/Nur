# Сферы, доп. услуги и сайдбар: единый контекст для AI

Этот документ описывает, как в проекте взаимосвязаны:

- разделение на сферы (отрасли),
- блок дополнительных услуг,
- финальная сборка и фильтрация сайдбара.

Цель: дать AI полную картину "почему пользователь видит или не видит конкретные пункты меню".

## 1) Ключевые файлы

- Сайдбар: `src/Components/Sidebar/Sidebar.jsx`
- Сборка меню: `src/Components/Sidebar/hooks/useMenuItems.js`
- Базовый/секторный конфиг меню: `src/Components/Sidebar/config/menuConfig.js`
- Правила скрытия: `src/Components/Sidebar/config/hideRules.js`
- Права/доступы: `src/Components/Sidebar/hooks/useMenuPermissions.js`
- Динамические доп. услуги: `src/Components/Sidebar/config/additionalServicesConfig.jsx`
- Страница доп. услуг: `src/Components/pages/AdditionalServices/AdditionalServices.jsx`
- Модалка заявки: `src/Components/pages/AdditionalServices/SocialModal.jsx`
- API доп. услуг: `src/api/additionalServices.js`
- Роуты: `src/config/routes.jsx`
- Данные пользователя/компании: `src/store/slices/userSlice.js`
- Проверка тарифа "Старт": `src/utils/subscriptionPlan.js`

## 2) Источник данных (source of truth)

Основной источник для меню и ограничений:

- `state.user.company`
- `state.user.profile`
- `state.user.sector` (заполняется из `company.sector.name`)
- `state.user.tariff` (заполняется из `company.subscription_plan.name`)

В `Sidebar.jsx`:

- `currentTariff = tariff || company?.subscription_plan?.name || "Старт"`
- `currentSector = sector || company?.sector?.name`
- далее вызывается `useMenuItems(company, currentSector, currentTariff, profile)`.

Именно результат `useMenuItems` определяет, что реально отрисуется в сайдбаре.

## 3) Как работает разделение на сферы

Логика в `useMenuItems -> getSectorMenuItems()`.

### 3.1 Нормализация и mapping

1. Берется текущая сфера: `sector || company?.sector?.name`.
2. Приводится к lower-case.
3. Пробелы заменяются на `_`.
4. Через `sectorMapping` вычисляется `configKey` (например `магазин -> market`, `консалтинг -> consulting`).
5. Берется конфиг: `MENU_CONFIG.sector[configKey]`.

### 3.2 Фильтрация пунктов сферы по правам

Для большинства случаев пункт показывается, если:

- `hasPermission(item.permission) === true`.

Есть special-case для `production`:

- владельцу (`profile.role === "owner"`) отдельно разрешен `can_view_catalog`.

### 3.3 Ограничения тарифа "Старт"

Через `isStartPlan(tariff)`:

- `cafe`: скрывается только `"/crm/cafe/cook"` (кухня/KDS);
- `production`: скрываются `agents/catalog/request`;
- `warehouse`: скрывается `"/crm/warehouse/agents"`;
- для остальных секторов остается только `"/crm/market/analytics"` (при наличии permission).

## 4) Как формируются доп. услуги

Доп. услуги собираются в `useMenuItems -> getAdditionalServices()`.

### 4.1 Базовые доп. услуги

Берутся из `MENU_CONFIG.additional`:

- WhatsApp, Instagram, Telegram, Документы,
- Печать штрих-кодов,
- Интеграция с весами.

### 4.2 Разные модели проверки доступа

Используются разные правила для разных услуг:

- `can_view_market_label`, `can_view_market_scales` -> только права пользователя (`hasPermission`);
- `can_view_whatsapp`, `can_view_instagram`, `can_view_telegram`, `can_view_documents` -> только флаги компании;
- остальные -> комбинированно (user/company).

Групповое право блока: `can_view_additional_services`.

### 4.3 Динамические услуги из конфига

Из `additionalServicesConfig.jsx` добавляются услуги по `conditions`:

- `tariff`
- `sector`
- `permission`
- `customCheck`

Селекторы:

- `getAdditionalServicesForMenu()` -> пункты в сайдбар;
- `getAdditionalServicesForPage()` -> карточки на страницу `/crm/additional-services`.

После получения динамических услуг выполняется merge без дублей (по `to` или `label`).

### 4.4 Когда блок "Доп услуги" скрывается полностью

Если одновременно:

- нет группового доступа `can_view_additional_services`,
- и нет ни одного доступного дочернего пункта,

тогда группа "Доп услуги" не добавляется в итоговое меню.

## 5) Финальная сборка сайдбара

`useMenuItems` собирает меню по шагам:

1. `basic` пункты (`MENU_CONFIG.basic`) фильтруются по permission.
2. Добавляются `sectorItems`:
   - после "Обзор", если он есть;
   - иначе в начало.
3. Добавляется группа "Доп услуги" перед "Настройки" (если доступна).
4. Применяются `HIDE_RULES` (гибкое скрытие):
   - по `label`
   - по `toIncludes` (substring в `item.to`)
5. Отдельно скрывается "Филиалы", если у профиля есть `branch_ids`.
6. Удаляются `implemented: false`.

Итоговый массив отдается в `Sidebar.jsx` и рендерится через `MenuItem`.

## 6) Роуты vs видимость меню (важный нюанс)

- В `routes.jsx` зарегистрировано много роутов разных сфер.
- Но фактическая видимость пунктов в навигации определяется `useMenuItems`.
- Поэтому возможна ситуация:
  - роут существует,
  - но в сайдбаре пункта нет (из-за permission/tariff/hideRules).

## 7) Страница дополнительных услуг и заявки

### 7.1 Страница `/crm/additional-services`

`AdditionalServices.jsx` собирает карточки из:

- локального базового массива,
- динамических услуг (`getAdditionalServicesForPage`),
- и отдельных "Старт + Маркет" карточек (ручной блок).

Клик по карточке открывает `SocialModal` с `selectedSocial`.

### 7.2 Отправка заявки

`SocialModal` -> `submitAdditionalServicesRequest`:

- `POST https://app.nurcrm.kg/api/main/socialapplications/`
- с `Bearer accessToken`,
- payload содержит `company`, `service`, `text`, `status`.

Услуга `warehouse` в модалке имеет дополнительное ограничение `requiresConsulting`.

## 8) Почему пункт может не отображаться (единый чеклист)

Если пользователь не видит нужный пункт:

1. Проверить `company`, `profile`, `sector`, `tariff` в `state.user`.
2. Проверить mapping сферы в `getSectorMenuItems`.
3. Проверить наличие пункта в `MENU_CONFIG.basic/sector/additional`.
4. Проверить permission:
   - user-only,
   - company-only,
   - mixed.
5. Проверить ограничения "Старт" (`isStartPlan`).
6. Проверить `HIDE_RULES` (label + toIncludes).
7. Для "Доп услуги" проверить групповое право и наличие доступных children.
8. Проверить `implemented`.
9. Если роут есть, но пункта нет в меню — это ожидаемо при фильтрах навигации.

## 9) Связанные документы

- Детально по доп. услугам: `docs/additional-services-ai-context.md`
- Детально по сферам: `docs/sector-segmentation-ai-context.md`

