# Роли и сотрудники — документация

Документ описывает, как в NUR CRM устроены **сотрудники**, **роли** и **права
доступа** (`can_view_*`), как права влияют на меню и маршруты, где всё это
редактируется в интерфейсе и какие эндпоинты бэкенда за это отвечают.

Связанные документы:

- [PROJECT_DOCUMENTATION.md](../PROJECT_DOCUMENTATION.md) — разделы 7 (Роутинг),
  8 (Аутентификация и авторизация), 13 (UI, Layout и меню).
- [docs/platform-admin/backend/04-users.md](./platform-admin/backend/04-users.md) —
  управление пользователями любой компании из платформенной админки.
- [docs/consulting/seller-access-isolation.md](./consulting/seller-access-isolation.md),
  [docs/consulting/regional-funnels-distribution.md](./consulting/regional-funnels-distribution.md) —
  расширенная ролевая модель консалтинга (воронки, изоляция продавца).

---

## 1. Общая модель

```
Компания (tenant)
├── Владелец (role = "owner")            ← создаётся при регистрации компании
├── Сотрудники (users/employees)
│   ├── role         — системная роль:  "owner" | "admin" | "agent" | null
│   ├── custom_role   — FK на кастомную роль компании (взаимоисключающе с role)
│   ├── role_display  — человекочитаемая подпись роли с бэка
│   ├── branches[]    — филиалы, к которым привязан сотрудник
│   └── can_view_*    — булевы флаги прав (десятки штук, см. §5)
├── Роли (users/roles) — справочник: системные + кастомные роли компании
├── Отделы (construction/departments) — группировка сотрудников (стройка)
└── Филиалы (users/branches)
```

Ключевые принципы:

1. **`role` и `custom_role` взаимоисключающи.** У сотрудника либо системная роль
   (`sys:owner` / `sys:admin`), либо кастомная (`cus:<uuid>`), либо ничего
   («Без роли»).
2. **Владелец и админ — суперпользователи внутри компании.** Почти во всех
   проверках `role === "owner" || role === "admin"` открывает полный доступ вне
   зависимости от флагов `can_view_*`.
3. **Права — это плоский набор булевых флагов на объекте пользователя.** Роль
   сама по себе (кроме owner/admin) прав не несёт — права выдаются
   индивидуально через модалку «Управление доступами». Кастомная роль — это,
   по сути, ярлык + (в консалтинге) привязка к воронке.
4. **Фронт не заменяет серверную фильтрацию.** Скрытие пунктов меню и редиректы
   на фронте — UX, а не безопасность; бэкенд обязан фильтровать данные по
   тому же принципу.

---

## 2. Системные роли

| Код (`role`) | `role_display` | Где задаётся | Смысл |
|---|---|---|---|
| `owner` | «Владелец» | Автоматически при регистрации компании | Полный доступ. Один на компанию (бэкенд не даёт снять последнего владельца). |
| `admin` | «Администратор» | Владельцем/админом в карточке сотрудника | Полный доступ, как у владельца, кроме «владелец-специфичных» вещей (последний owner, `is_platform_admin`). |
| `agent` | — | Через секторный флоу «Агент склада» / «Агент производства» | Ограниченный внешний участник: работает со своими продажами/передачами. Влияет на маршруты склада и производства. |
| `null` | значение с бэка или «Без роли» | — | Обычный сотрудник, доступ только по индивидуальным `can_view_*`. |

Резолвинг подписи роли — [`resolveEmployeeRoleLabel.js`](../src/Components/Sectors/Barber/Masters/resolveEmployeeRoleLabel.js):
приоритет `role` → `custom_role` (если задан id и найдено имя) → `role_display`
с API → «Без роли».

Зарезервированные имена: `owner/владелец`, `admin/administrator/админ/администратор`
(см. `sysCodeFromName` в [`Masters.jsx`](../src/Components/Sectors/Barber/Masters/Masters.jsx)) —
кастомную роль с таким именем создать нельзя.

### 2.1. Роли только для конкретных секторов

| Роль | Сектор | Файл | Назначение |
|---|---|---|---|
| `rop` | Консалтинг | [`consultingFunnelAccess.js`](../src/utils/consultingFunnelAccess.js) | Руководитель отдела продаж — приравнен к owner/admin в правах на воронки/лиды (`isConsultingFunnelManager`). |
| `supervisor` | Консалтинг | `consultingFunnelAccess.js` | Руководитель региона: видит лиды/воронки только своих регионов (`consulting_region_codes`), внутри региона — все лиды; сам заводит сотрудников региона (роль форсится в `salesperson`) и распределяет им лиды. Хелперы: `isConsultingRegionalSupervisor`, `getUserRegionCodes`, `filterFunnelsForUser`. Спека: [docs/consulting/backend-money-tenant/12-regional-supervisor-rbac.md](./consulting/backend-money-tenant/12-regional-supervisor-rbac.md). Фронт реализован; ждёт полей `role:"supervisor"` + `consulting_region_codes` и эндпоинтов `/consalting/regions/`, `redistribute` от бэка. |
| `salesperson` | Консалтинг | `consultingFunnelAccess.js` | Продавец: жёсткая изоляция «только свои лиды/сделки» (`shouldIsolateConsultingByOwner`). |
| `agent`, `manager`, `customer` | Логистика | [`Logistics.jsx`](../src/Components/pages/logistics/Logistics.jsx) и `components/*` | Роли участников логистического процесса (агент/менеджер/клиент). В текущем коде — на локальных/мок-данных модуля логистики. |
| `customer`, `counterparty` | Склад | `Warehouse/Analytics/AgentAnalytics.jsx` и др. | Тип контрагента в аналитике долгов, не роль сотрудника CRM. |

---

## 3. Кастомные роли компании

Справочник ролей компании: **`GET /users/roles/`** — возвращает системные +
кастомные роли (`{ id, name }`).

CRUD кастомных ролей (только владелец/админ, UI — вкладка «Роли» на странице
«Сотрудники»):

| Действие | Эндпоинт | Примечание |
|---|---|---|
| Создать | `POST /users/roles/custom/` `{ name }` | Имя не должно совпадать с системным и не должно дублировать существующую роль (проверка на фронте). |
| Переименовать | `PUT /users/roles/custom/:id/` `{ name }` | |
| Удалить | `DELETE /users/roles/custom/:id/` | Если роль используется — бэкенд может вернуть ошибку, фронт покажет `pageNotice`. |

UI: [`RoleCreateModal.jsx`](../src/Components/Sectors/Barber/Masters/modals/RoleCreateModal.jsx),
[`RoleEditModal.jsx`](../src/Components/Sectors/Barber/Masters/modals/RoleEditModal.jsx),
[`DeleteRoleModal.jsx`](../src/Components/Sectors/Barber/Masters/modals/DeleteRoleModal.jsx).

В консалтинге кастомная роль дополнительно **привязывается к воронке продаж**
(`funnel.custom_role`) — сотрудник с этой ролью видит «свою» воронку. См.
[docs/consulting/backend/03-funnel-hierarchy.md](./consulting/backend/03-funnel-hierarchy.md).

---

## 4. Сущность «Сотрудник»

### 4.1. API

Общий модуль — [`src/api/employees.js`](../src/api/employees.js),
thunks — [`src/store/creators/employeeCreators.js`](../src/store/creators/employeeCreators.js),
slice — [`src/store/slices/employeeSlice.js`](../src/store/slices/employeeSlice.js).

| Действие | Эндпоинт | Комментарий |
|---|---|---|
| Список | `GET /users/employees/` | Поддерживает пагинацию `{count,next,previous,results}`. Фильтрация/сортировка сейчас на клиенте (есть TODO на server-side). |
| Карточка | `GET /users/users/:id/` (и `GET /users/employees/:id/`) | Полный объект со всеми `can_view_*`. `openAccessModal` берёт данные именно отсюда, без `normalizeEmployee`, чтобы не потерять флаги. |
| Создать | `POST /users/employees/create/` | Пароль генерируется на бэке и показывается **один раз** ([`NewEmployeeCredentialsModal.jsx`](../src/Components/Sectors/Barber/Masters/modals/NewEmployeeCredentialsModal.jsx)). |
| Обновить | `PUT /users/employees/:id/` или `PATCH /users/employees/:id/` | Права сохраняются PATCH-ом того же ресурса (плоский объект `{can_view_*: bool}`). |
| Удалить | `DELETE /users/employees/:id/` | Фронт предупреждает, если удаляется `owner`. |
| Профиль текущего | `GET /users/profile/` | Кладётся в `state.user.profile`, из него читаются все права в рантайме. |
| Смена пароля | `PATCH /users/settings/change-password/` | Своя учётка. |

### 4.2. Поля объекта сотрудника

```jsonc
{
  "id": "uuid",
  "email": "user@mail.com",          // уникален глобально
  "first_name": "Иван",
  "last_name": "Иванов",
  "phone_number": "+996…",           // обязателен для сектора «Пилорама»
  "track_number": "01KG123",         // «номер машины», только «Пилорама»
  "role": "admin",                   // системная роль | null
  "custom_role": null,               // FK кастомной роли | null (взаимоисключимо с role)
  "role_display": "Администратор",
  "branches": [1, 2],                // филиалы; на «Старт» выбор филиала скрыт
  "branch_ids": [...],               // если непусто → пользователь-«филиал» (скрывается пункт «Филиалы»)
  "is_active": true,
  "is_platform_admin": false,        // сотрудник NUR (см. §11)
  "funnel_grants": [ … ],            // консалтинг: доступ к доп. воронкам
  "can_view_cashbox": true,
  "can_view_employees": false,
  "…": "остальные can_view_* флаги"
}
```

### 4.3. Форма создания/редактирования

[`EmployeeCreateModal.jsx`](../src/Components/Sectors/Barber/Masters/modals/EmployeeCreateModal.jsx) /
[`EmployeeEditModal.jsx`](../src/Components/Sectors/Barber/Masters/modals/EmployeeEditModal.jsx):

- Обязательные поля: `email`, `first_name`, `last_name`, **роль** (`roleChoice`).
- `roleChoice` кодируется строкой: `sys:owner` / `sys:admin` / `cus:<roleId>`.
  При отправке разворачивается в `role` **или** `custom_role`, второе поле → `null`.
- Филиал (`branches: [id]`) — только если тариф не «Старт» (`showBranchSelect`).
- «Пилорама» добавляет обязательные `track_number` и `phone_number`.
- Ограничение по тарифу «Старт» для Маркета — `canAddEmployeeOnMarketStart`
  (лимит числа сотрудников, сообщение `MARKET_START_EMPLOYEE_LIMIT_MESSAGE`).

### 4.4. Дефолтные права при создании

[`getNewEmployeeAccessDefaults(sectorName)`](../src/utils/newEmployeeDefaultAccess.js):

- `can_view_settings: true` — доступ к настройкам выдаётся сразу.
- Все права доп. услуг выключены: `can_view_whatsapp`, `can_view_instagram`,
  `can_view_telegram`, `can_view_documents`, `can_view_market_label`,
  `can_view_market_scales` → `false`.
- Для barber-like секторов («Барбершоп», «Услуги», «Стоматология») —
  `can_view_barber_services: false`.

После `POST` фронт делает `PATCH /users/employees/:id/` теми же дефолтами (бэк не
всегда применяет их при создании); при ошибке показывает подсказку «откройте
Доступы и сохраните вручную».

---

## 5. Права доступа (`can_view_*`)

### 5.1. Базовые (общие для всех секторов)

Источник — `BASIC_ACCESS_TYPES` в [`AccessList.jsx`](../src/Components/DepartmentDetails/AccessList.jsx)
и [`employeeAccessLabels.js`](../src/Components/Sectors/Barber/Masters/employeeAccessLabels.js):

| Флаг | Пункт меню / смысл |
|---|---|
| `can_view_dashboard` | Обзор |
| `can_view_orders` | Закупки / Заказы |
| `can_view_sale` | Продажа |
| `can_view_analytics` | Аналитика |
| `can_view_products` | Склад / Товары |
| `can_view_cashbox` | Касса (в Барбершопе используется как «Аналитика») |
| `can_view_employees` | Сотрудники |
| `can_view_booking` | Бронирование |
| `can_view_clients` | Клиенты / Контрагенты |
| `can_view_brand_category` | Бренд, Категория |
| `can_view_departments` | Отделы (пункт всегда скрыт `HIDE_RULES`) |
| `can_view_department_analytics` | Аналитика отделов |
| `can_view_branch` | Филиалы (только если у компании активна доп. услуга) |
| `can_view_debts` | Долги |
| `can_view_settings` | Настройки |
| `can_view_shifts` | Смены |
| `can_view_document` / `can_view_documents` | Документы |
| `can_view_market_procurement` | Закупки (маркет) |
| `can_view_market_supplier` | Поставщики (маркет) |

### 5.2. Секторные

`SECTOR_ACCESS_TYPES` (тот же файл). Кратко по секторам:

- **Барбершоп / Услуги / Стоматология**: `can_view_barber_clients`,
  `can_view_barber_services`, `can_view_barber_history`,
  `can_view_barber_records`, `can_view_document`, `can_view_salary`,
  `can_view_cashbox` (= «Аналитика»).
- **Магазин / Маркет**: `can_view_cashier` (интерфейс кассира),
  `can_view_market_discount`, `can_view_market_edit_price`,
  `can_view_market_delete_cart_item`, `can_view_market_employee_return`,
  `can_view_shifts`, `can_view_document`, `can_view_market_procurement`,
  `can_view_market_supplier`. Права кассира (скидка/цена/удаление/возврат)
  выделены в отдельную группу `MARKET_CASHIER_SPECIAL_KEYS`.
- **Кафе**: `can_view_cafe_menu`, `can_view_cafe_calculation`,
  `can_view_cafe_orders`, `can_view_cafe_purchasing`, `can_view_cafe_booking`,
  `can_view_cafe_clients`, `can_view_cafe_tables`, `can_view_cafe_cook`,
  `can_view_cafe_inventory`, `can_view_cafe_order_pay`,
  `can_view_cafe_order_return`. Права официанта (оплата/возврат заказа) —
  группа `CAFE_WAITER_ORDER_SPECIAL_KEYS`.
- **Гостиница**: `can_view_hostel_rooms`, `can_view_hostel_booking`,
  `can_view_hostel_clients`, `can_view_hostel_analytics`.
- **Школа**: `can_view_school_students`, `can_view_school_groups`,
  `can_view_school_lessons`, `can_view_school_teachers`,
  `can_view_school_leads`, `can_view_school_invoices`.
- **Строительная компания** (+ «Ремонтные и отделочные работы»,
  «Архитектура и дизайн»): `can_view_building_*` —
  `analytics`, `cash_register`, `clients`, `department`, `employess`,
  `notification`, `procurement`, `projects`, `salary`, `sell`, `stock`,
  `treaty`, `work_process`, `objects`. Для двух узких секторов оставлены
  только `can_view_building_work_process` и `can_view_building_objects`.
- **Консалтинг**: `can_view_clients`, `can_view_client_requests`,
  `can_view_cashbox`, `can_view_employees`, `can_view_salary`,
  `can_view_sale`, `can_view_services`, `can_view_funnel`,
  `can_manage_funnel_leads`, `can_manage_funnel_stages`,
  `can_view_leads_inbox`, `can_view_all_funnel_leads`, `can_view_all_sales`.
- **Склад**: `can_view_clients` (контрагенты), `can_view_analytics`,
  `can_view_products`, `can_view_document`, `can_view_agent`,
  `can_view_salary`.
- **Производство**: `can_view_agent` (передача), `can_view_catalog`,
  `can_view_request`.
- **Логистика**: `can_view_logistics`.

### 5.3. Доп. услуги (активируются на уровне компании)

`can_view_whatsapp`, `can_view_instagram`, `can_view_telegram`,
`can_view_documents`, `can_view_market_label` (печать штрих-кодов),
`can_view_market_scales` (интеграция с весами). Отдельная категория
«Доп услуги» в `AccessList`; сотруднику по умолчанию выключены (§4.4).

### 5.4. Нормализация значений

Флаг считается включённым, если значение `true`, `1` или `"true"`
(`isAccessFlagOn` / `isPermissionEnabled`). Есть алиасы старых подписей →
новый `backendKey` (`ACCESS_LABEL_ALIASES` в `AccessList.jsx`), напр.
«Аналитика» / «Касса» → `can_view_cashbox`.

---

## 6. Как права влияют на меню

Слой: [`useMenuPermissions.js`](../src/Components/Sidebar/hooks/useMenuPermissions.js) →
[`useMenuItems.js`](../src/Components/Sidebar/hooks/useMenuItems.js) →
конфиг [`menuConfig.js`](../src/Components/Sidebar/config/menuConfig.js) +
[`hideRules.js`](../src/Components/Sidebar/config/hideRules.js).

### 6.1. `useMenuPermissions`

- `hasPermission(perm)` — `profile[perm] === true`. Спецслучаи:
  - `can_view_funnel` → true также если `can_view_sale === true`;
  - `can_view_leads_inbox` → true также для `isConsultingFunnelManager(profile)`.
- `companyAllows(company, perm)` — `true` / `false` / `undefined` (нет политики).
- `isAllowed(company, perm)` — комбинированно: явный `false` компании
  запрещает; иначе достаточно права у пользователя или `true` у компании.

### 6.2. `permissionModel` пункта меню

`hasMenuAccess` в `useMenuItems`:

| `permissionModel` | Проверка |
|---|---|
| `"user"` (по умолчанию) | `hasPermission(perm)` |
| `"company"` | `companyAllows(company, perm) === true` |
| `"mixed"` | `isAllowed(company, perm)` |
| — + `requirePlatformAdmin` | `isPlatformAdmin(profile)` |

### 6.3. Привилегии owner/admin в меню

`getSectorMenuItems` даёт владельцу пункты **без наличия флага**:

- «Зарплата» в Услугах/Барбершопе/Стоматологии (`can_view_salary`);
- «Каталог» и «Поставщики» в Производстве (`can_view_catalog`,
  `can_view_market_supplier`);
- пункты с `item.ownerAdminOnly` показываются только owner/admin.

### 6.4. `HIDE_RULES`

Скрывают пункты по `sector` / `tariff` независимо от прав (напр. «Отделы» и
«Обзор» скрыты всегда; на тарифе «Старт» скрыты «Закупки», «Клиенты»,
«Филиалы» и т.д.). Пользователь-«филиал» (`profile.branch_ids` непусто) не
видит пункт «Филиалы».

### 6.5. Модалка «Управление доступами»

[`AccessList.jsx`](../src/Components/DepartmentDetails/AccessList.jsx) строит
список доступов **из тех же пунктов, что реально показываются в сайдбаре**
(с учётом сектора, тарифа, доп. услуг компании и профиля владельца), поэтому
владельцу нельзя выдать сотруднику право на то, чего нет в его собственном меню.
Категории: «Базовые», «Секторные», «Заказы кафе — официанты»,
«Касса маркета — специальные», «Доп услуги». Сохранение —
`onSaveAccesses(payload)` → `PATCH /users/employees/:id/`.

---

## 7. Как права влияют на маршруты

[`src/config/routes/helpers.jsx`](../src/config/routes/helpers.jsx):

- `createProtectedRoute` — оборачивает в `ProtectedRoute` (проверка подписки
  компании, [`ProtectedRoute.jsx`](../src/ProtectedRoute.jsx)) + `Suspense`.
- `createPermissionProtectedRoute(path, Component, permissionKey, profile)` —
  доступ, если `owner`/`admin` (в т.ч. русские подписи «владелец», «админ»,
  «администратор») **или** `profile[permissionKey] === true`; иначе `Navigate`
  на дефолтный маршрут сектора (напр. `/crm/cafe/menu`).
- `createProductionAgentProtectedRoute` / `createWarehouseAgentProtectedRoute` —
  гейт «маршруты агента недоступны на тарифе Старт» (`*StartAgentGate`).
- Склад: часть маршрутов включается только при `profile.role === "agent"`
  (`warehouseRoutes.jsx`).

Маршруты собираются функцией `crmRoutes(profile, sector)` в
[`src/config/routes/index.js`](../src/config/routes/index.js) из секторных
файлов `src/config/routes/*Routes.jsx` — то есть **набор доступных страниц
строится от `profile` и активного сектора**.

---

## 8. Где всё редактируется в UI

| Экран | Файл | Что делает |
|---|---|---|
| «Сотрудники» (основной, используется большинством секторов) | [`Sectors/Barber/Masters/Masters.jsx`](../src/Components/Sectors/Barber/Masters/Masters.jsx) | Список сотрудников + вкладка ролей; создание/редактирование/удаление сотрудников и кастомных ролей; модалка доступов; назначение агента склада; переходы в карточки зарплаты. |
| Карточка сотрудника (кафе) | `Sectors/Barber/Masters/CafeEmployEmployeeDetail.jsx` | Детали + профиль оплаты официанта. |
| Карточка сотрудника (маркет/продажи) | `Sectors/Barber/Masters/MarketEmployEmployeeDetail.jsx` | Детали + профиль оплаты продавца. |
| Модалка доступов | [`modals/EmployeeAccessModal.jsx`](../src/Components/Sectors/Barber/Masters/modals/EmployeeAccessModal.jsx) → `AccessList` | Чекбоксы прав; для склада — тумблер «оптовые продажи» агента. |
| Отделы (стройка) | [`Department/Department.jsx`](../src/Components/Department/Department.jsx), [`DepartmentDetails/DepartmentDetails.jsx`](../src/Components/DepartmentDetails/DepartmentDetails.jsx) | Создание отделов, привязка сотрудников (владельца исключают из выбора), доступы по отделу через `AccessList`. Кнопка «Добавить отдел» — только `role === "owner" | "admin"`. |
| Building-сотрудники | `pages/Building/Employess/` | Свои модалки создания/редактирования сотрудника для стройки. |
| Платформенная админка | `pages/PlatformAdmin/CompanyUsersTab.jsx`, `UserEditModal.jsx` | Пользователи любой компании (см. §11). |
| Заглушка «Пользователи/Права/Отделы» | `pages/Info/pages/Users/Users.jsx`, `Departments/Departments.jsx` | Статичный макет (хардкод-данные), не подключён к API. Не использовать как источник правды. |
| Консалтинг — доступ к воронкам | `Sectors/Consulting/**` + [`utils/consultingFunnelAccess.js`](../src/utils/consultingFunnelAccess.js) | `funnel_grants`, изоляция продавца (см. §10). |

---

## 9. Регистрация владельца и секторные права

[`src/api/auth.js`](../src/api/auth.js):

1. `POST /users/auth/register/` создаёт компанию и владельца.
2. После регистрации, **только если `role_display === "Владелец"`**, фронт
   выставляет владельцу базовый набор секторных прав через
   `PATCH /users/profile/` (маппинг `getSectorPermissions(sectorName)` —
   напр. Барбершоп → `can_view_barber_clients/services/history/records` + …).
3. `migrateUserPermissions()` при каждом логине до-выдаёт владельцу секторные
   права, если их не хватает (миграция для старых аккаунтов).

Поток логина (`userCreators.js`): `POST /users/auth/login/` → токены в
`localStorage` → миграция прав → синхронизация slug сектора в Redux. Профиль
подтягивается `getProfile` (`GET /users/profile/`) и хранится в
`state.user.profile` — из него читаются все `can_view_*` в рантайме.

---

## 10. Консалтинг — расширенная ролевая модель

Единый источник правил — [`consultingFunnelAccess.js`](../src/utils/consultingFunnelAccess.js).

| Функция | Смысл |
|---|---|
| `isConsultingFunnelManager(profile)` | `owner` / `admin` / `rop` — полный доступ ко всем воронкам, лидам, настройкам. |
| `shouldIsolateConsultingByOwner(profile)` | Режим «только свои» лиды/сделки. Включён для `salesperson` и для всех, у кого нет `can_view_all_funnel_leads`. |
| `canAccessConsultingLeadInbox(profile)` | Общий inbox `/crm/consulting/leads` — руководство или `can_view_leads_inbox`. |
| `canViewAllConsultingSales(profile)` | Все продажи компании или `can_view_all_sales`; иначе список фильтруется `?user=<id>`. |
| `filterFunnelsForUser(funnels, profile)` | Видимые воронки: ролевая (`funnel.custom_role === profile.custom_role`) + `funnel_grants` + (вне изоляции) главная. |
| `canManageLeadsInFunnel` / `canManageStagesInFunnel` | Управление лидами/стадиями конкретной воронки: менеджер, либо grant на воронку, либо `can_manage_funnel_*` + совпадение роли с ролью воронки. |

`funnel_grants` (`normalizeFunnelGrants`): массив
`{ funnel_id, can_manage_leads, can_manage_stages }` — точечная выдача доступа
к дополнительным воронкам поверх роли. Редактируется в карточке сотрудника
консалтинга.

Рекомендованный набор прав для «Продавец <город>» — см.
[docs/consulting/seller-access-isolation.md](./consulting/seller-access-isolation.md) §1.

---

## 11. Платформенная админка (сотрудники NUR)

- Признак — `profile.is_platform_admin === true`
  ([`platformAdminAccess.js`](../src/Components/pages/PlatformAdmin/platformAdminAccess.js)).
  Через обычный API компании это поле **не выставляется**.
- Пункты меню с `requirePlatformAdmin: true` видны только таким пользователям.
- Управление пользователями любой компании:
  `GET/POST /platform-admin/companies/:company_id/users/`,
  `GET/PATCH/DELETE /platform-admin/users/:id/` — контракт в
  [docs/platform-admin/backend/04-users.md](./platform-admin/backend/04-users.md).
  Набор полей совместим с `/users/employees/`, но scope — произвольная компания.
- Импersonation: `platformAdminSession` / `platformAdminImpersonating` в
  `localStorage`; при `logoutUser` очищаются.

---

## 12. Отделы и филиалы

- **Отделы** — `GET/POST/PUT /construction/departments/` (домен стройки, но
  переиспользуются). Отдел содержит `employees[]` и опциональную `cashbox`.
  Владельца из списка выбираемых сотрудников исключают (`isOwner`).
  В `DepartmentDetails` для сотрудника отдела можно править доступы тем же
  `AccessList` (сохранение — `updateEmployees` из
  [`store/creators/departmentCreators.js`](../src/store/creators/departmentCreators.js)).
- **Филиалы** — `GET /users/branches/`. Привязка сотрудника: `branches: [id]`
  (скрыто на тарифе «Старт»). Если у профиля непустой `branch_ids` — это
  учётка-«филиал», для неё скрывается пункт меню «Филиалы».

---

## 13. Известные нюансы и TODO

- **Дублирование справочников прав.** `BASIC_ACCESS_TYPES` /
  `SECTOR_ACCESS_TYPES` заданы отдельно в `AccessList.jsx`,
  `employeeAccessLabels.js` и (частично) `DepartmentDetails.jsx` — при
  добавлении права нужно править все копии.
- **Фильтрация сотрудников и ролей — на клиенте.** В `Masters.jsx` стоят TODO
  на server-side режим (`?search=&role=&custom_role=&page=`, дебаунс поиска).
- **`can_view_cashbox` двусмысленный** — в базовом наборе это «Касса», в
  Барбершопе подписан как «Аналитика».
- **Страница `pages/Info/pages/Users/*`** — нерабочий макет с хардкодом
  (`users = [{ name: 'Иван Иванов', role: 'Администратор' … }]`),
  реальная работа с сотрудниками идёт через `Masters.jsx`.
- **Права выдаются двумя запросами** при создании (`POST` + `PATCH`
  дефолтами) — если второй упал, доступ к «Настройкам» надо сохранить руками.
- **owner/admin обходят почти все проверки** на фронте — не полагаться на UI
  как на защиту, дублировать ограничения на бэкенде.
