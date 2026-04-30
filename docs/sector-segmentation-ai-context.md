# Разделение на сферы: контекст для AI

Этот документ объясняет, как в проекте устроено разделение CRM по сферам (отраслям), какие данные являются источником истины, как из сферы строится меню, и где действуют ограничения по тарифу/правам.

## 1) Ключевая идея

Разделение на сферы в текущей реализации работает прежде всего через **динамическую сборку сайдбара**:

- берется текущая сфера компании;
- выбирается соответствующий блок из `MENU_CONFIG.sector`;
- пункты фильтруются по permission и дополнительным правилам;
- затем накладываются правила скрытия (`HIDE_RULES`).

Итоговая видимость разделов определяется не только сферой, а комбинацией:

- `sector`
- `tariff`
- `profile` permissions
- флаги компании
- `HIDE_RULES`

## 2) Где находится логика

- Сборка меню: `src/Components/Sidebar/hooks/useMenuItems.js`
- Конфиг базовых/секторных пунктов: `src/Components/Sidebar/config/menuConfig.js`
- Гибкие правила скрытия: `src/Components/Sidebar/config/hideRules.js`
- Источник `company/sector/tariff/profile`: `src/store/slices/userSlice.js`
- Подключение меню: `src/Components/Sidebar/Sidebar.jsx`
- Утилита тарифа "Старт": `src/utils/subscriptionPlan.js`
- Защита маршрутов (без тонкой фильтрации по сфере): `src/ProtectedRoute.jsx`
- Страница выбора сферы (локальная/ограниченная): `src/Components/Sectors/SectorSelect.jsx`

## 3) Источник истины по сфере и тарифу

Основной источник: `userSlice`, после `getCompany.fulfilled`:

- `state.user.sector = payload?.sector?.name`
- `state.user.tariff = payload?.subscription_plan?.name`

В `Sidebar` используются:

- `currentTariff = tariff || company?.subscription_plan?.name || "Старт"`
- `currentSector = sector || company?.sector?.name`

Именно эти значения передаются в `useMenuItems(company, currentSector, currentTariff, profile)`.

## 4) Нормализация названия сферы и mapping к ключам конфига

В `useMenuItems`:

1. `currentSector` приводится к lower-case.
2. Пробелы заменяются на `_`.
3. Применяется `sectorMapping`:

- `строительная_компания` -> `building`
- `ремонтные_и_отделочные_работы` -> `building`
- `архитектура_и_дизайн` -> `building`
- `барбершоп` -> `barber`
- `гостиница` -> `hostel`
- `школа` -> `school`
- `магазин` -> `market`
- `кафе` -> `cafe`
- `производство` -> `production`
- `консалтинг` -> `consulting`
- `склад` -> `warehouse`
- `пилорама` -> `pilorama`
- `логистика` -> `logistics`

Если в mapping значения нет, используется исходный `sectorKey`.

Важно: в коде есть потенциальная неконсистентность для "Цветочный магазин" (ключ в mapping записан не в lower-case, при этом вход предварительно приводится к lower-case).

## 5) Откуда берутся разделы каждой сферы

`MENU_CONFIG.sector` содержит отдельные наборы пунктов для ключей:

- `building`
- `barber`
- `hostel`
- `school`
- `market`
- `cafe`
- `consulting`
- `warehouse`
- `production`
- `pilorama`
- `logistics`

Каждый пункт имеет:

- `label`
- `to`
- `icon`
- `permission`
- `implemented`
- опционально `children` (например, "Документы" в `warehouse`)

## 6) Фильтрация пунктов сферы по тарифу и правам

### 6.1 Общий случай (не "Старт")

Пункты выбранной сферы показываются, если:

- `hasPermission(item.permission) === true`

Отдельный special-case:

- для `production` и permission `can_view_catalog` владельцу (`profile.role === "owner"`) разрешено показать пункт.

### 6.2 Тариф "Старт"

Проверка через `isStartPlan(tariff)` (`"старт"` или `"start"`).

Ограничения:

- `cafe`: скрывается только `/crm/cafe/cook` (кухня/KDS), остальные по permission.
- `production`: скрываются
  - `/crm/production/agents`
  - `/crm/production/catalog`
  - `/crm/production/request`
- `warehouse`: скрывается `/crm/warehouse/agents`.
- для остальных секторов на "Старт" остается только `/crm/market/analytics` (если есть permission).

## 7) Как сфера встраивается в итоговое меню

Порядок сборки в `useMenuItems`:

1. `basic` пункты (`MENU_CONFIG.basic`) фильтруются по permission.
2. `sectorItems` добавляются:
   - после пункта "Обзор", если он есть;
   - иначе в начало.
3. Добавляется блок "Доп услуги" (если доступен).
4. Поверх применяется `HIDE_RULES`:
   - скрытие по `label`
   - скрытие по `toIncludes` (substring match по `item.to`)
5. Доп. правило: "Филиалы" скрываются у branch-пользователей (`profile.branch_ids.length > 0`).

Итог: даже если пункт есть в `MENU_CONFIG.sector`, он может не попасть в меню после фильтров.

## 8) Роуты и сферы: важный нюанс

В `src/config/routes.jsx` объявлено много CRM-роутов сразу (для разных сфер), но фактическая навигация пользователя обычно ограничивается меню.

`ProtectedRoute` сейчас проверяет в основном:

- загрузку компании
- наличие `company.end_date`
- срок действия компании

Тонкой проверки "роут принадлежит текущей сфере" в активном коде нет (часть такой логики закомментирована).

## 9) Роль страницы SectorSelect

`SectorSelect.jsx`:

- хранит выбор в `localStorage.selectedSector`;
- диспатчит `setSector` в `sectorSlice`;
- ведет на `/crm/${sector}`;
- список опций ограничен (`barber`, `hostel`, `school`).

Для текущей архитектуры это выглядит как локальный/дополнительный механизм. Основной рабочий источник сферы для меню сейчас идет из `state.user` (company/user slice).

## 10) Быстрый чеклист для AI: "почему не видно раздел сферы"

1. Проверить `state.user.sector` и `company.sector.name`.
2. Прогнать нормализацию сектора и mapping к `configKey`.
3. Проверить наличие ключа в `MENU_CONFIG.sector[configKey]`.
4. Проверить permission каждого пункта (`profile`).
5. Проверить ограничения тарифа `isStartPlan(...)`.
6. Проверить `HIDE_RULES` по `label` и `toIncludes`.
7. Проверить branch-ограничение для пункта "Филиалы".
8. Если роут существует, но пункта нет в меню, помнить: роуты и видимость меню управляются разными слоями.

