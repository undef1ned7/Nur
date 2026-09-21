# Тарифы NUR CRM — гайд для Flutter

Полное описание того, как веб-SPA определяет тариф компании и урезает по нему функциональность, чтобы мобильный клиент вёл себя идентично. Дополняет раздел «Тариф «Старт»» в [flutter-authentication.md](./flutter-authentication.md#8-права-доступа-permissions).

## 0. Важно: в проекте три разных «тарифа» — не перепутайте

| Что | Где живёт | Относится к этому документу? |
|---|---|---|
| **Тариф компании-клиента CRM** (Старт / Стандарт / Прайм / Индивидуальный) | `company.subscription_plan`, `company.end_date` | ✅ Да, это документ про него |
| «Абонентка» модуля Консалтинг — подписка **клиента консалтинговой компании** на её услуги | `src/api/consultingSubscriptions.js`, `docs/consulting/backend-money-tenant/01-subscription.md` | ❌ Нет |
| Тарифный план услуги, которую консалтинг-компания продаёт своим клиентам | `src/utils/consultingSalePricing.js`, `docs/consulting/services-role-pricing.md` | ❌ Нет |

Везде ниже «тариф» = тариф компании на саму CRM.

---

## 1. Модель данных

### 1.1. Компания (`GET /users/company/`)

```jsonc
{
  "id": 123,
  "name": "ОсОО Пример",
  "slug": "primer",
  "sector": { "id": 1, "name": "Магазин" },
  "subscription_plan": { "id": 2, "name": "Старт" },   // или null
  "end_date": "2026-12-31",                             // YYYY-MM-DD, дата окончания доступа
  "is_active": true,                                    // блокировка компании платформ-админом
  "can_view_whatsapp": true,                             // company-level фиче-флаги, см. §5
  "can_view_telegram": false,
  "can_view_instagram": false,
  "can_view_documents": false,
  "can_view_showcase": false
  // ...другие "can_view_*" читаются динамически (hasOwnProperty), список не фиксирован
}
```

Источник истины на фронте: `GET /users/company/` → thunk `getCompany` (`src/store/creators/userCreators.js:98-112`).

### 1.2. Redux-состояние веба (эталон для дизайна стейта во Flutter)

`src/store/slices/userSlice.js:18-35`, обновляется в `getCompany.fulfilled` (`userSlice.js:142-147`):

```js
state.user = {
  tariff: "",              // = company.subscription_plan?.name (СТРОКА, не id!)
  sector: "",               // = company.sector?.name
  company: null,             // полный объект компании
  profile: null,              // профиль текущего юзера — роль + can_view_*
  subscriptionPlans: [],       // список ВСЕХ тарифов (для формы регистрации)
  companyLoading: true,
};
```

**Ключевой момент:** и в UI-логике (`hideRules.js`, `additionalServicesConfig.jsx`), и в утилитах (`isStartPlan`) тариф всегда сравнивается **по строке названия** (`"Старт"`, `"старт"`, `"start"`), не по `id`. У тарифного плана нет стабильного `slug`/`code` — это архитектурная хрупкость веба (см. §9), но Flutter должен повторить то же сравнение по строке, чтобы поведение совпадало.

### 1.3. localStorage

Тариф **не** кешируется в localStorage — только `accessToken`, `refreshToken`, `userId`, `userData` (сырой ответ логина) и `selectedSector` (slug сектора, `src/store/slices/sectorSlice.js:5-8`). Компания (и тариф) перезапрашиваются через API при каждом старте приложения. Flutter должен делать так же — не полагаться на закешированный тариф дольше одной сессии/запуска.

---

## 2. API-эндпоинты

| Метод | Путь | Назначение | Файл-источник |
|---|---|---|---|
| `GET` | `/users/subscription-plans/` | Список всех тарифных планов (`{ results: [{ id, name, ... }] }`) — для формы регистрации | `src/api/auth.js:12-19` |
| `GET` | `/users/industries/` | Сферы деятельности → список секторов внутри каждой (`industry.sectors[]`) | `src/api/auth.js:3-10` |
| `GET` | `/users/company/` | Текущая компания: тариф, сектор, `end_date`, company-флаги | `src/store/creators/userCreators.js:98-112` |
| `GET` | `/users/profile/` | Профиль юзера: роль + `can_view_*` права (не тариф, но нужен вместе) | `userSlice.js:37-47` |
| `GET` | `/users/company/check-slug/?slug=...` | Проверка занятости slug компании при регистрации | `src/api/auth.js:23-32` |

**Важно: во фронтенде НЕТ эндпоинта для самостоятельной смены/оплаты тарифа клиентом.** Единственный способ сменить тариф компании — обратиться в поддержку, которая делает это через платформ-админку:

```
PATCH /platform-admin/companies/:id/subscription/
Body: { "subscription_plan_id": 2, "end_date": "2027-01-31", "support_note": "..." }
```

(`src/api/platformAdmin.js`, полный контракт — `docs/platform-admin/backend/03-subscription.md`). Этот эндпоинт доступен только роли платформ-админа, Flutter-клиенту он не нужен, если только вы не делаете отдельное админ-приложение.

**Вывод: нет онлайн-оплаты тарифа ни на вебе, ни в API.** Оплата происходит вне приложения; апгрейд тарифа — вручную саппортом. Если Flutter-клиенту нужна кнопка «сменить тариф» — она должна вести на внешнюю форму заявки/связь с поддержкой, а не на реальный API вызов.

---

## 3. Активность подписки: `end_date`

Единственный критерий «подписка активна» — **дата**, тариф здесь не участвует:

```dart
// Эталон: src/utils/companySubscription.js
enum SubscriptionReason { active, missing, expired, unknown }

class SubscriptionStatus {
  final bool ok;
  final SubscriptionReason reason;
  final String? message;
  SubscriptionStatus(this.ok, this.reason, this.message);
}

SubscriptionStatus getCompanySubscriptionStatus(Map<String, dynamic>? company) {
  if (company == null) {
    return SubscriptionStatus(false, SubscriptionReason.unknown, null);
  }
  final endDateStr = company['end_date'] as String?;
  final endDate = endDateStr != null ? DateTime.tryParse(endDateStr) : null;
  if (endDateStr == null || endDateStr.isEmpty || endDate == null) {
    return SubscriptionStatus(false, SubscriptionReason.missing, 'Срок действия компании не установлен');
  }
  final today = DateTime.now();
  final endDay = DateTime(endDate.year, endDate.month, endDate.day);
  final todayDay = DateTime(today.year, today.month, today.day);
  if (endDay.isBefore(todayDay)) {
    return SubscriptionStatus(false, SubscriptionReason.expired, 'Срок действия компании истек');
  }
  return SubscriptionStatus(true, SubscriptionReason.active, null);
}
```

Правила:
- Сравнение **по календарным датам** (00:00), без часовых поясов.
- `end_date` отсутствует/невалидна → `missing` (НЕ активна), а не «доступ по умолчанию».
- Нет отдельного бэкенд-поля `is_trial`/`subscription_status` — весь стейт подписки сводится к этим 4 reason.
- Триал (упоминается на лендинге как «10 дней бесплатно», `public/locales/ru/newLanding.json` → `rate.trialNote`) **не имеет отдельной фронтенд-логики** — предположительно реализован бэкендом как обычный `end_date` = дата регистрации + 10 дней. Flutter не должен пытаться отдельно детектировать «это триал» — просто использовать `end_date` как для любого другого периода.

### Где это применяется (guard-логика)

Два независимых гварда на вебе, оба нужно повторить:

1. **`src/Components/Auth/AuthGuard/AuthGuard.jsx:116-149`** — срабатывает при старте приложения/логине, до захода в `/crm*`. Если подписка не `ok` (и `reason !== 'unknown'`) — жёсткий редирект на лендинг (`/`).
2. **`src/ProtectedRoute.jsx:9-46`** — обёртка над каждым CRM-маршрутом. Если `company` ещё не загружена — пропускает (не блокирует), если загружена и `!subscription.ok` — редирект на `/`. Дополнительно показывает **одноразовый** алерт с `subscription.message` (дедупликация по `reason`, чтобы не спамить при каждом ререндере).

Для Flutter: на экране логина / сплэше после получения `company` сразу проверяйте `end_date`. Если не активна — показывайте экран «подписка истекла / не активна» с текстом из `SUBSCRIPTION_MESSAGES` и НЕ пускайте во внутренние экраны (аналог редиректа на `/`). Никакого «мягкого» read-only режима после истечения нет — доступ либо есть, либо нет.

---

## 4. Видимость модулей и пунктов меню по тарифу

Это самая объёмная часть — веб использует декларативные правила (`hideRules.js`) поверх готового «полного» меню сектора.

### 4.1. Порядок применения (псевдокод сборки меню, `useMenuItems.js:244-346`)

1. Взять базовые пункты меню (`MENU_CONFIG.basic`), отфильтровать по `hasMenuAccess` (роль/права юзера/компании — см. §6).
2. Взять секторные пункты через `getSectorMenuItems()` — **если тариф "Старт"**, для секторов применяется жёсткое урезание в коде (см. §4.3), иначе — полный список пунктов сектора, отфильтрованный по правам.
3. Взять дополнительные услуги (§5).
4. Собрать всё вместе, вставить секторные пункты после «Обзор».
5. **Применить `HIDE_RULES`** — финальный фильтр по `label`/`to` в зависимости от `{ sector, tariff }` (см. §4.2).
6. Отдельно всегда скрыть «Филиалы», если у юзера есть `profile.branch_ids` (это филиальный сотрудник, а не сама компания).

### 4.2. Полная таблица `HIDE_RULES` (`src/Components/Sidebar/config/hideRules.js`)

Условие сопоставляется по **точному названию сектора** (`company.sector.name`, по-русски) и **точному названию тарифа** (`company.subscription_plan.name`, по-русски). Правило может задавать `sector`/`sectorIn`/`sectorNotIn` и `tariff`/`tariffIn`/`tariffNotIn` — все заданные условия должны совпасть одновременно (AND).

| # | Условие (`when`) | Скрывает (`hide.labels` / `hide.toIncludes`) |
|---|---|---|
| 1 | всегда | labels: `Отделы`, `Обзор` |
| 2 | `tariff: "Старт"`, sector ∈ {Магазин, Цветочный магазин} | labels: `Обзор, Закупки, Поставщики, Бронирование, Клиенты, Отделы, Аналитика Отделов, Филиалы` |
| 3 | `tariff: "Старт"`, sector ∉ {Кафе, Магазин, Цветочный магазин} | labels: `Обзор, Закупки, Сотрудники, Бронирование, Клиенты, Отделы, Аналитика Отделов, Филиалы` |
| 4 | `tariff: "Старт"`, `sector: "Кафе"` | labels: `Обзор, Бронирование, Клиенты, Отделы, Аналитика Отделов, Филиалы`; пути: `/crm/debts, /crm/cafe/reports, /crm/cafe/payroll, /crm/cafe/purchasing, /crm/zakaz, /crm/cafe/reservations, /crm/sklad, /crm/analytics, /crm/kassa, /crm/sell` |
| 5 | `sector: "Кафе"` (любой тариф) | пути: `/crm/brand-category, /crm/clients` |
| 6 | `tariff: "Прайм"` | путь: `/crm/debts` |
| 7 | `tariff: "Стандарт"` | путь: `/crm/debts` |
| 8 | `sector: "Кафе"`, `tariffNotIn: ["Старт"]` | пути: `/crm/zakaz, /crm/kassa, /crm/cafe/reports, /crm/sell, /crm/cafe/payroll, /crm/obzor, /crm/raspisanie, /crm/sklad, /crm/cafe/reservation, /crm/cafe/purchasing, /crm/analytics, /crm/debts` (но `show: /crm/sklad` — склад **возвращается**) |
| 9 | `sector: "Гостиница"` | пути: `/crm/analytics, /crm/hostel/clients, /crm/hostel/bar, /crm/zakaz, /crm/hostel/obzor, /crm/kassa, /crm/sell, /crm/obzor, /crm/raspisanie, /crm/hostel/analytics, /crm/debts` |
| 10 | `sector: "Барбершоп"` | пути: `/crm/employ, /crm/clients, /crm/analytics, /crm/brand-category, /crm/obzor, /crm/zakaz, /crm/raspisanie, /crm/debts` |
| 11 | `sector: "Услуги"` | те же пути, что #10 |
| 12 | `sector: "Стоматология"` | те же пути, что #10 |
| 13 | `sector: "Школа"` | пути: `/crm/zakaz, /crm/obzor, /crm/clients, /crm/analytics, /crm/employ, /crm/kassa, /crm/raspisanie, /crm/debts` |
| 14 | `sector: "Магазин"` | пути: `/crm/obzor, /crm/zakaz, /crm/market/bar, /crm/market/history, /crm/raspisanie, /crm/analytics` |
| 15 | `tariff: "Старт"`, `sector: "Магазин"` | labels: `Поставщики, Закупки`; пути: `/crm/market/suppliers, /crm/market/procurement` |
| 16 | `tariff: "Старт"`, `sector: "Цветочный магазин"` | то же, что #15 |
| 17 | `sector: "Строительная компания"` | пути: `/crm/zakaz, /crm/kassa, /crm/cafe/reports, /crm/sell, /crm/cafe/payroll, /crm/obzor, /crm/raspisanie, /crm/sklad, /crm/cafe/reservation, /crm/cafe/purchasing, /crm/analytics, /crm/debts, /crm/brand-category, /crm/branch, /crm/clients, /crm/employ` |
| 18 | `sector: "Консалтинг"` | пути: `/crm/debts, /crm/obzor, /crm/brand-category, /crm/clients, /crm/sell, /crm/employ, /crm/sklad, /crm/zakaz, /crm/analytics, /crm/kassa, /crm/raspisanie, /crm/consulting/sale, /crm/consulting/salary` |
| 19 | `sector: "Склад"` | пути: `/crm/debts, /crm/obzor, /crm/brand-category, /crm/sell, /crm/sklad, /crm/zakaz, /crm/analytics, /crm/raspisanie, /crm/clients, /crm/kassa` |
| 20 | `sector: "Производство"` | пути: `/crm/debts, /crm/obzor, /crm/zakaz, /crm/sklad, /crm/raspisanie, /crm/analytics, /crm/sell` |
| 21 | `sector: "Пилорама"` | пути: `/crm/debts, /crm/obzor, /crm/zakaz, /crm/sklad, /crm/sell, /crm/raspisanie, /crm/brand-category` |
| 22 | `sector: "Логистика"` | пути: `/crm/debts, /crm/obzor, /crm/zakaz, /crm/sell, /crm/sklad, /crm/brand-category, /crm/analytics, /crm/raspisanie` |

`toIncludes` — это **подстрока** пути (`item.to.includes(p)`), не точное совпадение — учитывайте это при портировании (например, правило со `/crm/sklad` скроет и `/crm/sklad/anything`).

Правила из этой таблицы — про **видимость пунктов**, а не про физическую блокировку API. Бэкенд не проверяет тариф на большинстве эндпоинтов (см. §9) — это чисто UX-урезание. Для Flutter это означает: реализуйте те же скрытия в навигации/меню, но не полагайтесь на то, что API сам откажет в доступе к «скрытому» разделу.

### 4.3. Жёсткое урезание секторного меню на тарифе «Старт» (`useMenuItems.js:109-144`, в коде, не в `HIDE_RULES`)

Проверка: `isStartPlan(tariff ?? company.subscription_plan?.name)`, где `isStartPlan` — регистронезависимое сравнение с `"старт"`/`"start"` (`src/utils/subscriptionPlan.js:4-9`).

| Сектор (`configKey`) | На тарифе «Старт» доступно |
|---|---|
| `cafe` | Все пункты сектора, **кроме** `/crm/cafe/cook` (кухня/KDS) |
| `production` | Все пункты, **кроме** `/crm/production/agents`, `/crm/production/catalog`, `/crm/production/request` (агентская сеть). Исключение: пункт с `permission: "can_view_market_supplier"` доступен владельцу (`profile.role === "owner"`) даже без права |
| `warehouse` | Все пункты, **кроме** `/crm/warehouse/agents` |
| любой другой сектор | **Только** пункт `/crm/market/analytics` (если есть право `can_view_market_analytics` и т.п.) — весь остальной секторный функционал скрыт |

Плюс два **route-level** гварда (не просто скрытие в меню — реальный редирект при прямом заходе по URL):

- `src/Components/Sectors/Production/ProductionStartAgentGate.jsx` — при `isStartPlan` редиректит с любого маршрута под гейтом на `/crm/production/warehouse`.
- `src/Components/Sectors/Warehouse/WarehouseStartAgentGate.jsx` — редиректит на `/crm/warehouse/warehouses`.

Для Flutter: этим маршрутам-«агентам» должны соответствовать экраны, которые при тарифе Старт вообще не открываются (или сразу переключают на экран склада), а не просто прячутся из таб-бара.

### 4.4. Маппинг названия сектора → slug конфигурации

Тариф режет функциональность **внутри** сектора; сам сектор компании не зависит от тарифа и не меняется (выбирается один раз при регистрации). Каноническая таблица (`src/utils/sectorMapping.js:10-29`, продублирована в `useMenuItems.js:85-104`):

```
строительная_компания, ремонтные_и_отделочные_работы, архитектура_и_дизайн → building
барбершоп                                                                   → barber
услуги / services                                                            → services
стоматология / dentistry                                                     → dentistry
гостиница                                                                    → hostel
школа                                                                        → school
магазин, цветочный_магазин                                                   → market
кафе                                                                         → cafe
производство                                                                 → production
консалтинг                                                                   → consulting
склад                                                                        → warehouse
пилорама                                                                     → pilorama
логистика                                                                    → logistics
```

Ключ строится из `sector.name.toLowerCase().replace(/\s+/g, "_")`; если совпадения нет — используется сам ключ как slug (fallback).

---

## 5. Дополнительные услуги (`ADDITIONAL_SERVICES_CONFIG`)

Файл: `src/Components/Sidebar/config/additionalServicesConfig.jsx`. Два принципиально разных типа записей — важно не путать их логику:

### 5.1. `type: "navigational"` — реальные подключаемые разделы

Управляются company/user-level `can_view_*` флагами (не тарифом напрямую), ведут на реальный маршрут:

| id | Раздел | `permission` | `permissionModel` |
|---|---|---|---|
| `WHATSAPP` | WhatsApp | `can_view_whatsapp` | `company` |
| `TELEGRAM` | Telegram | `can_view_telegram` | `company` |
| `INSTAGRAM` | Instagram (`/crm/instagram`) | `can_view_instagram` | `company` |
| `DOCUMENTS` | Документы (`/crm/documents`) | `can_view_documents` | `company` |
| `BARCODE_PRINT` | Печать штрих-кодов (`/crm/barcodes`) | `can_view_market_label` | `user` |
| `SCALES` | Интеграция с весами (`/crm/scales`) | `can_view_market_scales` | `user` |
| `CASHIER` | Интерфейс кассира | `can_view_cashier` | `user` (скрыт в Маркете — там касса встроена в основное меню) |
| `WAREHOUSE` | Склад для Консалтинга (`/crm/sklad`) | `can_view_products` | `mixed`, только `sector: "Консалтинг"` |

`permissionModel` определяет проверку (см. §6): `"company"` → только флаг компании, `"user"` → только флаг профиля, `"mixed"` → любой из двух (если компания явно `false` — блок).

### 5.2. `type: "extension"` — платные расширения тарифа «Старт» (карточки-заглушки)

**У них `to: null` и `permission: null`** — это не переход на экран, а информационная карточка на странице `/crm/additional-services`. Клик открывает модалку заявки (`SocialModal.jsx`) — **онлайн-оплаты нет**, это форма «свяжитесь с нами». Все — условие `conditions.tariff: "Старт"`:

| id | Название | Сектор(а) | Текст цены (как в UI) |
|---|---|---|---|
| `EXTRA_EMPLOYEES` | Сотрудники (больше 3) | Магазин, Цветочный магазин | установка 2000 + абонплата 200 |
| `DOUBLE_WAREHOUSE` | Двойной склад | Магазин, Цветочный магазин | установка 5000 + абонплата 500 |
| `ONLINE_SHOWCASE` | Онлайн витрина | Магазин, Цветочный магазин | установка 3000 + абонплата 300 |
| `WAITER` | Официант | Кафе | установка 2000 + абонплата 200 |
| `KITCHEN` | Кухня | Кафе | установка 2000 + абонплата 200 |
| `EXTRA_RECEIPT_PRINTER` | Чековый аппарат (больше двух) | Кафе | установка 1000 + абонплата 100 |
| `COSTING` | Калькуляция | Кафе | установка 2000 + абонплата 200 |
| `ONLINE_MENU` | Онлайн меню | Кафе | установка 3000 + абонплата 300 |

Для Flutter: эти 8 пунктов — просто маркетинговый список «докупи функцию», без API-бэкенда. Если делать экран «доп. услуги» в мобильном приложении, он должен открывать форму обратной связи/заявку (звонок, сообщение в поддержку), а не пытаться вызвать несуществующий API оплаты.

Отдельно: `Печать штрих-кодов` и `Интеграция с весами` из §5.1 тоже платные (в описании указана цена установки/абонплаты), но они реализованы как обычные `navigational`-разделы с `can_view_*`-правом — то есть подключение делает бэкенд/саппорт вручную, выставляя это право профилю, а UI просто открывается когда право есть.

---

## 6. Модели проверки прав (`useMenuPermissions.js`)

Три модели, используются везде через `item.permissionModel`:

```dart
// permissionModel === "user"
bool hasPermission(Map profile, String perm) => profile?[perm] == true;

// permissionModel === "company"
// undefined, если поля вообще нет в объекте компании (hasOwnProperty!)
bool? companyAllows(Map? company, String perm) {
  if (company == null || !company.containsKey(perm)) return null;
  return company[perm] == true;
}

// permissionModel === "mixed" (default)
bool isAllowed(Map? company, Map? profile, String perm) {
  final userOk = hasPermission(profile, perm);
  final companyOk = companyAllows(company, perm);
  if (companyOk == false) return false; // компания явно запретила — блок независимо от юзера
  return userOk || companyOk == true;
}
```

Это **не про тариф напрямую** — про права юзера/компании — но `additionalServicesConfig` и `hideRules` работают поверх результата этой проверки, поэтому без неё таблицы §4-5 не воспроизвести корректно.

---

## 7. Количественные лимиты

Единственный реально проверяемый на фронте числовой лимит:

```dart
// Эталон: src/utils/subscriptionPlan.js:22-40
const int marketStartEmployeeLimit = 3;
const String marketStartEmployeeLimitMessage =
    'На тарифе Старт для Маркета можно иметь максимум 3 сотрудников, включая владельца.';

bool canAddEmployeeOnMarketStart({
  required String? tariffName,
  required String? sectorName,
  required List<Map<String, dynamic>> employees,
}) {
  if (!isStartPlan(tariffName) || !isMarketSectorName(sectorName)) return true;
  final hasOwnerInList = employees.any((e) => e['role'] == 'owner');
  final totalWithOwner = employees.length + (hasOwnerInList ? 0 : 1);
  return totalWithOwner < marketStartEmployeeLimit; // строго < 3, т.е. максимум 3 включая владельца
}
```

`isMarketSectorName` — сектор содержит подстроку «магазин» (регистронезависимо), т.е. покрывает и «Магазин», и «Цветочный магазин» (`src/utils/subscriptionPlan.js:11-20`).

⚠️ **Enforcement только на фронте.** В коде не найдено серверной проверки этого лимита — значит это чисто UX-ограничение (показывается alert и блокируется кнопка добавления). **Перед релизом Flutter-приложения уточните у бэкенд-команды, проверяется ли лимит на API** — если нет, мобильный клиент должен дублировать эту же проверку клиентски, иначе через мобильное приложение лимит будет легко обойти.

Других явных числовых лимитов (склады, точки продаж, кассы и т.д.) в коде не найдено — только маркетинговые фразы на лендинге («До 2 сотрудников» на Старте, «До 10 сотрудников» на Стандарте, `public/locales/ru/newLanding.json` → `rate`), которые **расходятся** с реальным enforcement (3, не 2) — известная нестыковка текста и кода, уточняйте у продукта актуальные цифры перед показом их в UI.

Также связанная фича — онлайн-витрина на Старте в Магазине доступна только «по заявке»:

```js
// src/utils/subscriptionPlan.js:42-57
function isMarketStartShowcaseRequestOnly(tariffName, sectorName) {
  return isStartPlan(tariffName) && isMarketSectorName(sectorName);
}
function canAccessOnlineShowcase({ tariffName, sectorName, isOwner, canViewShowcase }) {
  if (isMarketStartShowcaseRequestOnly(tariffName, sectorName)) {
    return Boolean(canViewShowcase); // на Старте — строго по явному праву, даже владельцу
  }
  return Boolean(isOwner || canViewShowcase); // на других тарифах — владельцу доступно по умолчанию
}
```

---

## 8. Выбор тарифа (только при регистрации)

Единственное место в приложении, где пользователь **выбирает** тариф — форма регистрации (`src/Components/Auth/Register/Register.jsx`):

1. При монтировании грузятся `getIndustriesAsync()` и `getSubscriptionPlansAsync()`.
2. Селект `subscription_plan_id` заполняется из `subscriptionPlans` (`{ id, name }`).
3. Оба поля — `company_sector_id` и `subscription_plan_id` — обязательны для отправки формы.
4. Отправка: `POST /users/auth/register/`. После успешной регистрации, если у созданного юзера `role_display === "Владелец"`, фронт **дополнительно** сам проставляет секторные `can_view_*` права владельцу через `PATCH /users/profile/` (маппинг see `getSectorPermissions()` в `src/api/auth.js:35-91`) — это не связано с тарифом, но обязательный шаг флоу регистрации, если Flutter тоже реализует регистрацию.

После регистрации **самостоятельная смена тарифа пользователем не реализована нигде** — ни в вебе, ни в API (см. §2). Для Flutter это значит: экран регистрации может/должен повторить выбор тарифа, но экрана «сменить тариф» внутри приложения быть не должно (или он должен вести на форму связи с поддержкой).

---

## 9. Тариф vs роль — две независимые оси

- **Тариф** (`company.subscription_plan.name`) — свойство **компании**. Определяет: какие целые разделы видны (§4), какие доп.услуги предлагаются (§5), лимит сотрудников (§7).
- **Роль** (`profile.role`, значения `"owner"`, `"admin"`, и др.) + `profile.can_view_*` — свойства **пользователя** внутри компании. Определяют доступность конкретных действий/разделов для конкретного сотрудника, независимо от тарифа.
- Они пересекаются точечно: на тарифе Старт владельцу (`role === "owner"`) показываются некоторые пункты даже без явного `can_view_*` (`useMenuItems.js:146-176`); лимит сотрудников считает владельца как одного из 3, даже если его нет в списке `employees` явно (§7).

**Рекомендация для архитектуры Flutter-приложения:** реализуйте это как два отдельных, независимо тестируемых слоя:
1. `TariffGate` — что вообще видно в этом секторе на этом тарифе (входы: `sector`, `tariff`).
2. `PermissionGate` — что доступно конкретному пользователю из видимого (входы: `profile.role`, `profile.can_view_*`, `company.can_view_*`).

Не смешивайте их в одну функцию — на вебе это уже приводит к путанице (см. исключения для owner внутри тарифных фильтров в `useMenuItems.js`).

---

## 10. Открытые вопросы к бэкенду/продукту перед реализацией на Flutter

1. **Стабильный идентификатор тарифа.** Сейчас весь фронт сравнивает тариф по русской строке названия (`"Старт"`, `"Прайм"`, `"Стандарт"`) — хрупко при переименовании тарифа в админке. Уточните, есть ли (или можно ли добавить) `subscription_plan.slug`/`code`, и использовать его во Flutter вместо строки, если бэкенд его отдаёт.
2. **Backend enforcement лимита сотрудников.** Проверяется ли лимит 3 сотрудников (Магазин, Старт) на API, или это только фронтовый UX-лимит? Если только фронт — Flutter обязан продублировать эту же проверку клиентски.
3. **Триал-период.** Есть ли на бэкенде отдельная сущность/статус триала, или это просто обычный `end_date` = регистрация + 10 дней? Нужно ли Flutter отдельно показывать «осталось N дней триала»?
4. **Актуальные лимиты по тарифам.** Тексты лендинга («До 2 / До 10 сотрудников») расходятся с реальным кодом (лимит 3) — какие цифры показывать пользователю как официальные.
5. **Реальный список тарифов и их прав** — `GET /users/subscription-plans/` отдаёт только `{ id, name }`; полная бизнес-логика «что доступно на каком тарифе» зашита во фронте (`hideRules.js`), а не приходит с бэка. Если появится потребность отдавать права тарифа через API (а не хардкодить их отдельно во Flutter) — это отдельная бэкенд-задача.

---

## 11. Чек-лист реализации для Flutter

- [ ] После логина запросить `GET /users/company/` и `GET /users/profile/`, сохранить в стейт (не в persistent storage дольше сессии).
- [ ] Проверить `getCompanySubscriptionStatus(company)` (§3) сразу после получения компании; если `!ok` — показать экран блокировки, не пускать дальше.
- [ ] Реализовать `TariffGate` по таблицам §4.2 (HIDE_RULES) и §4.3 (жёсткое урезание Старта для cafe/production/warehouse/прочих) — как минимум для тех разделов, которые есть в мобильном приложении.
- [ ] Route-level гварды для «агентских» разделов Production/Warehouse на тарифе Старт (§4.3) — не просто прятать таб, а не давать открыть экран напрямую.
- [ ] Реализовать `PermissionGate` по трём моделям (§6), независимо от `TariffGate`.
- [ ] Лимит сотрудников Магазин+Старт = 3, включая владельца (§7) — продублировать клиентски, уточнить про backend enforcement (§10.2).
- [ ] Экран регистрации (если есть на Flutter): подтянуть `subscription-plans` и `industries`, оба поля обязательны (§8).
- [ ] НЕ реализовывать экран онлайн-оплаты/смены тарифа — такого API нет; для доп.услуг и смены тарифа — только форма заявки/связь с поддержкой.
- [ ] Сверить финальный список тарифов/лимитов с бэкенд-командой перед релизом (§10).

---

## Файлы-источники (эталон для сверки при расхождениях)

```
src/store/slices/userSlice.js               — state.user: tariff, sector, company, profile
src/store/creators/userCreators.js           — getCompany, getSubscriptionPlansAsync, getIndustriesAsync
src/store/slices/sectorSlice.js              — persist slug сектора
src/api/auth.js                              — getSubscriptionPlans, getIndustries, checkSlug, registerUser
src/api/platformAdmin.js                     — управление тарифом компании (только саппорт)
src/utils/companySubscription.js             — статус подписки по end_date
src/utils/subscriptionPlan.js                — isStartPlan, лимит сотрудников, гейт витрины
src/utils/sectorMapping.js                   — маппинг названия сектора → slug
src/ProtectedRoute.jsx                       — route-level guard по подписке
src/Components/Auth/AuthGuard/AuthGuard.jsx  — app-level guard по подписке
src/Components/Sectors/Production/ProductionStartAgentGate.jsx
src/Components/Sectors/Warehouse/WarehouseStartAgentGate.jsx
src/Components/Sidebar/hooks/useMenuItems.js       — сборка меню, жёсткое урезание Старта
src/Components/Sidebar/hooks/useMenuPermissions.js — hasPermission/companyAllows/isAllowed
src/Components/Sidebar/config/hideRules.js          — декларативные правила скрытия
src/Components/Sidebar/config/additionalServicesConfig.jsx — доп. услуги
src/Components/Auth/Register/Register.jsx     — выбор тарифа при регистрации
docs/platform-admin/backend/03-subscription.md — контракт смены тарифа саппортом
```
