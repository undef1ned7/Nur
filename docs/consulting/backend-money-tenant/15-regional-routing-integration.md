# 15. Региональная маршрутизация: стыковка бэка и фронта

**Приоритет:** P1 — без этого региональный UI (чип «Регион», распределение,
руководители) не работает end-to-end.
**Дата:** 10.09.2026
**Основано на:** описании текущей реализации `apps/consalting/regional_routing.py`
(prefix-match → wazzup → source_channels → `balance_strategy`
round_robin/least_loaded → региональная воронка + первая стадия → назначение
сейлза по `assign_role_ids`/`assign_strategy`; ручной redistribute).
**Дополняет:** [06-regional-funnels-routing.md](./06-regional-funnels-routing.md),
[12-regional-supervisor-rbac.md](./12-regional-supervisor-rbac.md),
[13-unify-leads-single-model.md](./13-unify-leads-single-model.md).

**Фронт:** `api/consultingRegions.js`, `common/useConsultingRegions.js`,
`common/RegionFilter.jsx`, `leads/LeadsDistribution.jsx`, `leads/LeadsInbox.jsx`,
`Funnel/Funnel.jsx`, `Teachers/Teachers.jsx`, `utils/consultingFunnelAccess.js`.

---

## 0. Проверка на проде — 10.09.2026 (компания `89d081ca…`)

**Работает ✅**

- `GET /consalting/regions/` → `[{code,label,funnel_id,is_active,open_leads,employees_count}]` (Бишкек/Ош/Джалал-Абад).
- `POST /consalting/regional-funnel-routing/redistribute/` `{scope:"main_unassigned",dry_run:true}` → `{"planned":{…},"total":3}`.
- `GET /consalting/leads/` + `?queue=new` + `?region=osh` (лиды несут `region_code`/`region_label`), `/leads/counters/`, `/leads/analytics/`.
- `Lead` и `InboundLead` сериализаторы: `queue_status(_display)`, `channel`, `region_code`, `region_label`, `defer_*`, `reject_*`, `first_reply_at`, `converted_at`, `closed_at`, `inbound_external_id`; `InboundLead.lead` всегда заполнен.
- Все воронки (вкл. «Ош»/«Бишкек»/«Джалал-Абад») имеют стадии, у каждой есть WON — **P0-6 закрыт**.
- `GET /funnels/{id}/board/` → `{funnel, scope_counts, totals, columns, unassigned}` — колонка `unassigned` присутствует.
- `POST /consalting/leads/{id}/register-payment/` создаёт сделку/`Sale`, **переносит лид в `next_funnel`** (Msg-16 баг закрыт), принимает `items[]` (создаются `SaleItem`) и `subscription_autorenew` без ошибки.
- `POST /consalting/sales/` — сериализатор знает `items`, `kind`, `source`, `idempotency_key`, `paid_months`; продажа c `items` **без** `services`/`tariff` не отсекается на валидации.
- `defer` (требует `remind_at`), `resume`, `win`, `lose`, `assign`, `claim`, `transfer` — эндпоинты есть.
- `POST /users/employees/create/`: `role` choices содержат `supervisor` → «Руководитель региона»; поля `consulting_region_codes` (list) и `region_code` (string) приняты.
- В компании уже есть сотрудник `role="supervisor"`, `consulting_region_codes=["osh"]`.
- `GET /users/profile/` отдаёт `role`, `consulting_region_codes`, `consulting_regions`.

**Не так / не хватает 🔴**

- `POST /consalting/funnels/routing/redistribute/` → **404** (см. §2.1 — использовать `regional-funnel-routing/`).
- **`Funnel.region_code` / `region_label` = `""` у ВСЕХ воронок**, вкл. региональные — **повторно подтверждено 11.09.2026** на `GET /consalting/funnels/{id}/board/` для «Бишкек» (`region_code: ""`, `funnel_kind: "custom"`, `parent_funnel: null`), при этом у лидов внутри неё `region_code: "bishkek"` заполнен верно. Связь регион↔воронка есть только через `regional-funnel-routing.rules[].funnel_id`. Нужно: отдавать `region_code`/`region_label`/`funnel_kind:"region"` на самой воронке.
  **Фронтовый воркэраунд применён 11.09.2026** (пока бэк не пофикшен): `resolveFunnelRegionCode(funnel, fallbackMap)` в `utils/consultingFunnelAccess.js` принимает опциональный `fallbackMap` (funnel_id → region_code), собранный в `Funnel.jsx`/`CreateLeadModal.jsx` из `regionCtl.regions` (которые сами приходят из фолбэка `regional-funnel-routing.rules` в `api/consultingRegions.js`). Прокинут через `filterFunnelsForUser`, `canManageLeadsInFunnel`, `parentOptions` в `FunnelForm`. Снять после того, как бэк начнёт отдавать `region_code` на самой воронке — фолбэк безвреден и продолжит работать как no-op, но лишний слой стоит убрать.
- **Старые лиды не забэкфилены:** ~11 лидов на «Основной воронке» с `region_code=""`, `channel=""`/`"manual"` (веб-форма «Сайт»); маршрутизация на них не отработала. `redistribute {scope:"main_unassigned"}` их видит (`total:3` из них) — нужно прогнать; плюс бэкфилл `region_code` по [12 §9](./12-regional-supervisor-rbac.md).
- **Текст обращения пуст** у веб-формы: `Lead.description=""`, `InboundLead.message=""`, `source:"Сайт"` — [13 §3.1](./13-unify-leads-single-model.md).
- **`register-payment` не обновляет `region_code`** при переносе в воронку другого региона (лид Ош→Бишкек остался `region_code:"osh"`) — [12 §2.3](./12-regional-supervisor-rbac.md).
- **`next_funnel` региональных воронок замкнут между регионами** (Ош→Бишкек, Джалал-Абад→Ош) — вероятно ошибка конфигурации: `next_funnel` должен вести в воронку внедрения/следующий этап, а не в соседний регион.
- `Lead.status` = `"in_work"`, в спеке [13 §2.1](./13-unify-leads-single-model.md) — `"in_progress"`. У части стадий региональных воронок `is_system=false`, `system_key=""` (Ош «Новая заявка»), у «Джалал-Абад» три стадии типа `new_lead` — рассинхрон системных ключей.
- Изоляция роли `supervisor` (403 на чужой регион) — не проверялась (нужен токен supervisor-аккаунта).

---

## 1. Что уже совпадает (не трогать)

Алгоритм из описания реализации соответствует спеке:

| Механизм | Спека |
|---|---|
| Longest Prefix Match по нормализованному телефону → `wazzup_account_id` → `source_channels` | [06 §6.3](./06-regional-funnels-routing.md), [12 §3](./12-regional-supervisor-rbac.md) |
| Регион не определён → `balance_strategy`: `round_robin` (`_rr_cursor`) / `least_loaded` | [12 §4.1](./12-regional-supervisor-rbac.md) |
| Лид → региональная воронка `FunnelConsalting` → первая стадия (`NEW_LEAD`) | [06 §6.3](./06-regional-funnels-routing.md) |
| Назначение сейлза внутри региона: `assign_role_ids` + `assign_strategy` (`ROUND_ROBIN`/`LEAST_LOADED`) | [06 §6](./06-regional-funnels-routing.md), [12 §3](./12-regional-supervisor-rbac.md) |
| Ручной redistribute для `owner`/`admin`/`rop` | [12 §5](./12-regional-supervisor-rbac.md) |

---

## 2. Расхождения контракта — привести к одному

### 2.1. Путь эндпоинта redistribute — ПРОВЕРЕНО НА ПРОДЕ 10.09.2026

| Путь | Прод |
|---|---|
| `POST /api/consalting/regional-funnel-routing/redistribute/` | **200 ✅** (`dry_run:true` → `{"planned":{"bishkek":1,"osh":1,"jalal_abad":1},"total":3}`) |
| `POST /api/consalting/funnels/routing/redistribute/` | **404** — не существует |

Т.е. рабочий путь = спека и исходный фронт. Описание реализации с
`funnels/routing/` было неточным. Фронт (`api/consultingRegions.js` →
`REDISTRIBUTE_PATHS`) теперь бьёт **сначала** в `regional-funnel-routing/`,
`funnels/routing/` оставлен запасным. Дополнительных действий бэка не нужно.

### 2.2. `GET /consalting/regions/` — обязателен

Весь региональный UI берёт справочник отсюда. Формат элемента:

```jsonc
{
  "code": "osh",                 // латиница, lowercase; ключ региона
  "label": "Ош",                 // человекочитаемо
  "funnel_id": "uuid",           // региональная воронка
  "is_active": true,
  "open_leads": 42,              // открытых лидов в регионе (для превью нагрузки)
  "employees_count": 5           // сейлзов, привязанных к региону
}
```

- Права: `owner`/`admin`/`rop` — все регионы; `supervisor` — все (фронт сам
  урежет по `consulting_region_codes`), либо только свои.
- Пока эндпоинта нет — фронт **фолбэчится**: собирает регионы из
  `GET /consalting/funnels/` по полю `region_code`/`region`
  (`resolveConsultingRegions`). Тогда `open_leads`/`employees_count` = 0.
  Полноценные счётчики и превью распределения требуют настоящий `/regions/`.

### 2.3. `redistribute`: параметры и форма ответа

Фронт (`leads/LeadsDistribution.jsx`) шлёт и ожидает:

```jsonc
// POST body
{
  "scope": "main_unassigned" | "inbound_new" | "all_open",  // обяз.
  "dry_run": true,                                          // обяз.
  "regions": ["osh","bishkek"]                              // опц.: подмножество
}

// dry_run: true  → план без изменений
{ "planned": { "bishkek": 34, "osh": 33, "jalal_abad": 33 }, "total": 100 }

// dry_run: false → фактическое перераспределение
{ "planned": { "bishkek": 34, "osh": 33, "jalal_abad": 33 }, "moved": 100 }
```

- `scope`:
  - `main_unassigned` — открытые лиды на главной воронке без региона/владельца;
  - `inbound_new` — только `queue_status=new`;
  - `all_open` — все открытые (`status ∉ converted/rejected`), кроме уже
    назначенных владельцу.
- Делить нацело: `Σ planned == total`, разброс ≤ 1.
- `owner` при перемещении не трогать (`null`) — назначит руководитель.
- Идемпотентно: повтор с `main_unassigned` на разложенной базе → `moved: 0`.
- Одна транзакция или чанки по 500 с `select_for_update`.
- Алгоритм плана — [12 §4.2](./12-regional-supervisor-rbac.md).

### 2.4. `least_loaded` — что считать «нагрузкой»

Описание: считаются лиды в статусах `NEW` + `IN_WORK`.
Спека [12 §4.1](./12-regional-supervisor-rbac.md): «открытые» = `status ∉
(converted, rejected)`.

**Уточнить:** входят ли в счётчик `DEFERRED` (отложенные) лиды.
Рекомендация — **включать** (`status ∉ converted/rejected`), иначе регион с
большим числом отложенных выглядит незагруженным и получает весь новый поток.
Зафиксировать выбранное поведение здесь и в `open_leads` из `/regions/`
(должны считаться одинаково).

### 2.5. Гонки

Два одновременных inbound без региона не должны попасть оба в один регион
из-за неатомарного чтения `_rr_cursor` / счётчиков: `select_for_update` на
курсоре маршрутизации и на счётчике при `least_loaded`.
([12 §10](./12-regional-supervisor-rbac.md))

### 2.6. Повторное сообщение того же чата

Не меняет `region_code` / `funnel` уже созданного лида
([12 §3](./12-regional-supervisor-rbac.md)).

---

## 3. Чего в описании нет, но нужно фронту

### 3.1. Поля региона в сериализаторах

| Объект | Поля (нужны фронту) | Где читается |
|---|---|---|
| `Lead` (`/consalting/leads/`, `/inbound-leads/`, board) | `region_code`, `region_label` | `leads/LeadsInbox.jsx` (`l.region_code \|\| l.region`, `l.region_label`), бейдж региона на карточке |
| `Funnel` (`/consalting/funnels/`) | `region_code` (или `region`), `region_label` | `utils/consultingFunnelAccess.js` → `resolveFunnelRegionCode` → `filterFunnelsForUser`; фолбэк `/regions/` |
| Профиль (`/users/profile/`, employee-list) | `role: "supervisor"`, `consulting_region_codes: ["osh"]`, опц. `consulting_regions: [{code,label,funnel_id}]` | `isConsultingRegionalSupervisor`, `getUserRegionCodes` |

Плюс фильтр `GET /consalting/leads/?region=osh` (и на inbound). Для
`supervisor` параметр не должен расширять выдачу за пределы его регионов.

### 3.2. RBAC руководителей регионов — [12](./12-regional-supervisor-rbac.md)

Маршрутизация ≠ изоляция. Отдельно нужно (фронт уже готов, ждёт бэк):

- `supervisor` видит `/funnels/`, `/board/`, `/leads/`, `/sales/`,
  `/employees/` **только своих регионов** (403 на чужой);
- внутри региона — лиды **всех** владельцев;
- `POST /users/employees/create/` от `supervisor` → сервер форсит
  `role=salesperson` + регион создателя, гасит `can_view_all_*`;
- назначение самой роли: `PUT /users/employees/{id}/` c `role:"supervisor"` +
  `consulting_region_codes` (только `owner`/`admin`);
- `redistribute` — `403` для `supervisor` (или только по своему региону — не в
  этой итерации).

Полная матрица доступа — [12 §5](./12-regional-supervisor-rbac.md).

### 3.3. Обязательные стадии у КАЖДОЙ региональной воронки — [06 §6.5a](./06-regional-funnels-routing.md), P0-6

Описание: «лид помещается на первую стадию `NEW_LEAD`». По факту «Ош»/«Бишкек»
создавались с `stages: []`, из-за чего:

- доска без колонок → лид с `stage=null` не виден («лид пропадает»);
- `POST /consalting/leads/{id}/win/` → `400 «В воронке нет WON-стадии»`;
- `register-payment` не переносит лид в `next_funnel`.

Гарантировать: при создании региональной воронки авто-создаются 3 системные
стадии (`intake`/`in_progress`/`completed`, у `completed` — `stage_type: won`),
плюс миграция-бэкфилл для уже созданных воронок и привязка их лидов к `intake`.
`board/` возвращает лиды с `stage=null` в `unassigned`.

---

## 4. Согласовать с фронтом при выкатке авто-роутинга

Если ручное создание (`POST /consalting/leads/` и `POST
/consalting/inbound-leads/`) теперь **само** маршрутизирует лид (регион →
региональная воронка → owner), то интеримные «зеркала» на фронте начнут
**дублировать** лид на `is_main`:

- `leads/modals/CreateLeadModal.jsx` → `ensureFunnelLeadForInbound`
- `Funnel/Funnel.jsx` → `LeadCreateForm` → `ensureInboundLeadForFunnelLead`

По [13 §7](./13-unify-leads-single-model.md) их нужно снять. Момент: как только
бэк подтверждает, что `POST /consalting/leads/` возвращает лид уже с
`region_code` + `funnel` (региональной, не главной) + `owner`. До этого зеркала
остаются.

---

## 5. Чек-лист приёмки

### Контракт
- [ ] `redistribute` отвечает хотя бы по одному из двух путей (§2.1).
- [ ] `GET /consalting/regions/` отдаёт `code/label/funnel_id/is_active/open_leads/employees_count` (§2.2).
- [ ] `redistribute` принимает `scope` + `dry_run` + `regions`; `dry_run:true` → `{planned,total}`, `dry_run:false` → `{planned,moved}` (§2.3).
- [ ] `least_loaded` и `open_leads` считают нагрузку одинаково; поведение по `DEFERRED` зафиксировано (§2.4).
- [ ] Два одновременных inbound без региона не идут оба в один регион (§2.5).
- [ ] Повторное сообщение чата не меняет регион/воронку лида (§2.6).

### Поля
- [ ] `Lead.region_code` + `region_label` в списках/board; фильтр `?region=`.
- [ ] `Funnel.region_code`/`region_label`.
- [ ] Профиль: `role:"supervisor"` + `consulting_region_codes`.

### Процесс
- [ ] Изоляция `supervisor` по региону на всех выборках (§3.2).
- [ ] Все региональные воронки имеют 3 системные стадии; «Ош»/«Бишкек» забэкфилены (§3.3).
- [ ] `win/` в промежуточной воронке без WON-стадии не даёт `400`.
- [ ] `redistribute {scope:"main_unassigned", dry_run:true}` при 100 лидах / 3 региона → `{34,33,33}`, `Σ=100`; повтор без dry_run → `moved:0` на второй раз.

### Регрессия
- [ ] Компании без региональных правил (`routing.enabled=false`) работают по 1A (главная воронка).
- [ ] `owner`/`admin`/`rop` видят всё, как раньше.
