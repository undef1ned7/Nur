# Дополнительные услуги: контекст для AI

Этот документ описывает, как в проекте работает модуль дополнительных услуг (меню, страница, модалка, отправка заявки, ограничения по тарифу/сектору/правам).

## 1) Где находится логика

- Динамический конфиг услуг: `src/Components/Sidebar/config/additionalServicesConfig.jsx`
- Правила скрытия пунктов: `src/Components/Sidebar/config/hideRules.js`
- Сборка меню (включая "Доп услуги"): `src/Components/Sidebar/hooks/useMenuItems.js`
- Базовый конфиг меню: `src/Components/Sidebar/config/menuConfig.js`
- Проверки прав: `src/Components/Sidebar/hooks/useMenuPermissions.js`
- Страница услуг: `src/Components/pages/AdditionalServices/AdditionalServices.jsx`
- Модалка заявки: `src/Components/pages/AdditionalServices/SocialModal.jsx`
- API для заявок: `src/api/additionalServices.js`
- Роут страницы: `src/config/routes.jsx`

## 2) Источник данных и доступы

Вычисления делаются на основе `state.user`:

- `company`
- `tariff` (или `company.subscription_plan.name`)
- `sector` (или `company.sector.name`)

Права:

- `hasPermission(permission)` -> только права пользователя (`profile[permission] === true`)
- `companyAllows(company, permission)` -> политика компании (`true/false/undefined`)
- `isAllowed(company, permission)` -> комбинированно:
  - если компания явно запретила (`false`) -> запрет
  - иначе разрешено, если есть право у пользователя или компания явно разрешила

## 3) Динамические услуги (единый конфиг)

`ADDITIONAL_SERVICES_CONFIG` содержит элементы вида:

- `id`, `label`, `to`, `icon`
- `permission` (опционально)
- `implemented`
- `conditions`
- `displayMeta` (для карточек на странице услуг)

Поддерживаемые условия в `conditions`:

- `tariff`: строка или массив
- `sector`: строка или массив (сравнение в lower-case)
- `permission`: проверка через `isAllowed(company, permission)`
- `customCheck(params)`: произвольная функция

### Публичные селекторы из конфига

- `getAdditionalServicesForMenu(params)` -> услуги в сайдбар
- `getAdditionalServicesForPage(params)` -> карточки на страницу `/crm/additional-services`

## 4) Как собирается меню "Доп услуги"

Логика находится в `useMenuItems.js`, функция `getAdditionalServices()`.

Шаги:

1. Берутся базовые дочерние услуги из `MENU_CONFIG.additional`:
   - WhatsApp
   - Instagram
   - Telegram
   - Документы
   - Печать штрих-кодов
   - Интеграция с весами
2. Применяются специальные правила доступа:
   - `can_view_market_label`, `can_view_market_scales` -> только `hasPermission` (только профиль пользователя)
   - `can_view_whatsapp`, `can_view_instagram`, `can_view_telegram`, `can_view_documents` -> только флаги компании
   - остальные -> комбинированная проверка (`isAllowedForPerm`)
3. Если индивидуальных дочерних нет, но есть групповое право `can_view_additional_services`, включается fallback.
4. Добавляются динамические услуги из `getAdditionalServicesForMenu(...)`.
5. Удаляются дубли по `to`/`label`.
6. Если нет группового права и нет дочерних -> блок "Доп услуги" не показывается.
7. Иначе возвращается группа:
   - `label: "Доп услуги"`
   - `to: "/crm/additional-services"`
   - `children: [...]`

## 5) Как работает страница `/crm/additional-services`

`AdditionalServices.jsx` формирует карточки из двух (фактически трех) источников:

1. Базовый локальный массив (always-visible на уровне компонента):
   - WhatsApp, Telegram, Instagram, Документы
   - Печать штрих-кодов
   - Интеграция с весами
   - Интерфейс кассира
2. Динамические карточки из `getAdditionalServicesForPage(...)`
3. Дополнительные вручную для связки:
   - тариф `Старт`
   - сектор `Магазин` или `Цветочный магазин`
   - услуги: "Сотрудники (больше 3)", "Двойной склад", "Онлайн витрина"

При клике по карточке открывается `SocialModal` с `selectedSocial = serviceId`.

## 6) Модалка и отправка заявок

`SocialModal.jsx`:

- имеет `serviceMap`, где `selectedSocial` мапится в:
  - заголовок
  - описание
  - иконку
- для `warehouse` стоит дополнительное ограничение:
  - доступно только для "Консалтинг" (`requiresConsulting`)
- `submitDisabled` зависит от:
  - состояния отправки
  - наличия `company`
  - ограничения `requiresConsulting`

Функция `handleSubmit()` отправляет:

- `company: company.name`
- `service: selectedSocial`
- `text: "Новая заявка на подключение услуги: <title>"`
- `status: "new"`

Через API:

- `POST https://app.nurcrm.kg/api/main/socialapplications/`
- `Authorization: Bearer <accessToken>`

## 7) Маршрутизация

В `routes.jsx` страница подключена как защищенный роут:

- `/crm/additional-services` -> `AdditionalServices`

## 8) Влияние HIDE_RULES

`HIDE_RULES` может скрывать пункты:

- по `label`
- по вхождению в `to` (`toIncludes`)

Важно: для некоторых секторов (например, "Строительная компания", "Консалтинг") в `toIncludes` есть `/crm/additional-services`, поэтому раздел может быть скрыт даже при наличии прав.

## 9) Известные особенности/риски (важно для AI)

1. Логика частично дублируется между:
   - `additionalServicesConfig.jsx`
   - `AdditionalServices.jsx`
2. Есть разные id для похожих услуг:
   - конфиг: `market-double-warehouse`, `market-online-showcase`
   - страница: `double-warehouse`, `online-showcase`
   Это может приводить к разным значениям поля `service` в API.
3. Для разных услуг используются разные модели проверки прав (user-only vs company-only vs mixed), это сделано намеренно.
4. Наличие роута не гарантирует видимость пункта в меню: итог зависит от `useMenuItems` + `HIDE_RULES`.

## 10) Короткий алгоритм для AI (проверка "почему не видно услугу")

Если услуга или раздел не отображается:

1. Проверить `tariff` и `sector` (с учетом fallback из `company`).
2. Проверить условия в `additionalServicesConfig.jsx` (`conditions`).
3. Проверить тип permission-проверки для конкретной услуги:
   - user-only
   - company-only
   - mixed
4. Проверить `can_view_additional_services` (групповое право).
5. Проверить `HIDE_RULES` (labels + toIncludes).
6. Если услуга есть на странице, но не в меню:
   - сравнить источник (локальная карточка vs dynamic config).
7. Если заявка не уходит:
   - проверить `accessToken` в localStorage
   - проверить payload `service`
   - проверить ограничение `requiresConsulting` для `warehouse`.
