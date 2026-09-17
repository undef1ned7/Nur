# 9. Контракт фронта — канон при расхождениях

**Дата:** 03.09.2026
**Статус:** фронт реализован полностью (`VITE_CONSULTING_CASH_V2=true` по умолчанию).
**Назначение:** этот файл фиксирует **точный контракт, который вызывает фронт**.
Если он расходится со спеками [00](./00-money-flow.md)–[08](./08-lead-client-conversion.md)
или с тем, что уже задеплоено на бэке, **каноничен этот файл** — бэк
подгоняется под него.

Домен: `/api/consalting/` (историческое написание). Все суммы `Decimal(12,2)`,
время — местное компании (Asia/Bishkek, UTC+6).

Источники на фронте:

| Слой | Файл |
|---|---|
| HTTP | `src/api/consultingHttp.js` (`cGet/cPost/cPatch/cPut`, ошибка → `{ ...body, status }`) |
| Касса | `src/api/consultingCashbox.js` |
| Абонентка | `src/api/consultingSubscriptions.js` |
| Продажи | `src/api/consultingSales.js` |
| Tenant | `src/api/consultingTenant.js` |
| Аналитика | `src/api/consultingAnalytics.js` |
| Лиды / регионы | `src/api/consultingLeads.js` |
| Контракт-утилиты | `src/utils/consultingMoney.js`, `src/utils/consultingFunnelAccess.js` |

---

## 9.0. Разрешение расхождений (сводка)

| # | Точка | Было в спеке / на проде | **Канон (фронт)** |
|---|---|---|---|
| 1 | Режим подтверждения кассы | `always \| cash_only \| off` (спека) / `required \| off` (прод) | **`required \| cash_only \| off`**. `always`→`required`, `auto`→`off` — только вход, наружу не отдавать |
| 1b | Дефолт режима подтверждения | `cash_only` (было) | **`off`** — см. [26](./26-cash-confirmation-default-off.md). Заявки по умолчанию выключены, компания включает сама |
| 2 | Запись `confirmation-settings` | `PUT` (спека) / `POST` (прод) | **`POST`** основной, `PUT` — принимать как алиас |
| 3 | Статус снятой заявки при отмене продажи | `rejected` (прод) | **`canceled`** (отдельный статус, без `reject_reason`) |
| 4 | Переход в «Внедрение» | `funnel.is_onboarding=true` (прод) | **`funnel.next_funnel` + `funnel.is_final`** (цепочка воронок, [03-funnel-hierarchy](../backend/03-funnel-hierarchy.md)) |
| 5 | `cancel_rate` | `cancellations/(revenue+cancellations)` (прод) | **`cancellations / revenue × 100`** |
| 6 | Направление возврата | `direction="outcome"` (прод) | **`direction="expense"`**; `outcome` фронт ещё принимает, но не канон |
| 7 | RBAC продавца | роли `admin/rop/salesperson` (прод) | **роли + булевы права + `funnel_grants`** (см. §9.8) |
| 8 | Статус планового платежа абонентки | `scheduled \| pending` (прод) | наружу — **`planned`**; `scheduled/pending` фронт мапит в `planned` |

Легаси-алиасы бэк может **принимать на вход** ради переходного периода, но
**в ответах** обязан отдавать канон.

---

## 9.1. Касса — кассы

```
GET  /consalting/cashbox/cashboxes/            ?search=&page=&page_size=
POST /consalting/cashbox/cashboxes/            { "name": "...", "department_name"?: "..." }
GET  /consalting/cashbox/cashboxes/{id}/
```

Элемент списка (фронт читает оба варианта — плоский и `analytics`):

```jsonc
{
  "id": "uuid",
  "name": "Касса №1",
  "department_name": "Консалтинг",
  "income_total": 120000, "expense_total": 15000, "balance": 105000,
  "pending_amount": 45000,
  "analytics": { "income": { "total": 120000 }, "expense": { "total": 15000 } }
}
```

- `balance` = только подтверждённые `CashOperation` (`income − expense`).
- `pending_amount` — сумма `CashRequest(pending)` по этой кассе (баннер «не в остатке»).
- Пустой список допустим; фронт сам подставит «Основная касса» с `id=""`.
  `id=""` в запросах операций трактовать как «касса по умолчанию компании».

---

## 9.2. Касса — заявки на подтверждение

```
GET  /consalting/cashbox/requests/            ?status=&kind=&user=&cashbox=&date_from=&date_to=&search=&page=&page_size=
GET  /consalting/cashbox/requests/counters/   ?<те же фильтры>
POST /consalting/cashbox/requests/{id}/confirm/   { "cashbox"?: "uuid", "comment"?: "" }
POST /consalting/cashbox/requests/{id}/reject/    { "reason": "...", "comment"?: "" }
POST /consalting/cashbox/handovers/               { "amount": 12000, "comment"?: "", "cashbox"?: null }
```

### Enums (строго)

```
status : pending | confirmed | rejected | canceled
kind   : sale | subscription | handover | refund
reject_reason : no_money | amount_mismatch | other_method | duplicate | other
```

- `canceled` — заявка снята автоматически при отмене продажи до подтверждения
  (**не** `rejected`; `reject_reason` пустой). Канон §9.0 п.3.
- `reject` без `reason` → `400`. `reason="other"` без `comment` → `400`.

### Элемент списка

```jsonc
{
  "id": "uuid",
  "kind": "sale", "kind_display": "Продажа",
  "created_at": "2026-07-29T12:00:00+06:00",
  "source_display": "Внедрение CRM / Стандарт",
  "client_display": "Иванов Иван",
  "user_display": "Менеджер А",
  "amount": 45000,
  "payment_method": "cash", "payment_method_display": "Наличными",
  "status": "pending", "status_display": "Ожидает подтверждения",
  "reject_reason_display": null,
  "is_overdue": false
}
```

### Counters

```jsonc
{ "pending": 7, "confirmed": 120, "rejected": 3, "canceled": 2,
  "all": 132, "pending_amount": 315000 }
```

Фронт (`normalizeCashRequestCounters`) принимает и `*_count`-алиасы
(`pending_count` и т.п.), и `total` вместо `all`. Канон — короткие имена выше.

### confirm — эффекты (сервер, одна транзакция)

1. `CashOperation` (`type = direction` заявки: `income|expense`; `user` = **автор
   заявки/продажи**, не подтверждающий; `confirmed_by` = подтверждающий).
2. `kind=sale`   → `Sale.status = completed`; начисление зарплаты;
   `provision_tenant_account` если `tariff.provisions_crm_account`.
3. `kind=subscription` → `SubscriptionPayment.status = paid`, `paid_at`,
   `cash_operation`; `extend_tenant_subscription`.
4. Повторный `confirm` → `400 {"detail": "Заявка уже обработана."}`.

**Остаток кассы = сумма только `CashOperation`.** `CashRequest` в остаток не
суммировать никогда.

---

## 9.3. Касса — операции, сверка, настройки

```
GET  /consalting/cashbox/operations/          ?cashbox=&type=&user=&kind=&date_from=&date_to=&search=&page=&page_size=
GET  /consalting/cashbox/reconciliation/      ?date_from=&date_to=&user=&page=&page_size=
GET  /consalting/cashbox/confirmation-settings/
POST /consalting/cashbox/confirmation-settings/   { "mode", "skip_for_cashier", "overdue_hours" }
```

Операция: фронт читает направление из `direction` **или** `type`
(`income | expense`; `outcome/out` принимаются, но не канон), сумму — из
`amount`, дату — `created_at ?? confirmed_at`.

### confirmation-settings

```jsonc
// GET / POST-ответ
{ "mode": "cash_only", "skip_for_cashier": true, "overdue_hours": 24 }
```

- `mode` (канон §9.0 п.1 и п.1b): **`required | cash_only | off`**.
  - `off` — сразу `CashOperation` + сайд-эффекты, без кассира (**default**,
    см. [26-cash-confirmation-default-off.md](./26-cash-confirmation-default-off.md)).
  - `cash_only` — заявка только если `payment_method="cash"`.
  - `required` — заявка на любую продажу и любой абонентский платёж.
- `skip_for_cashier` (default `true`) — если продажу оформил сам кассир, заявка
  не создаётся.
- `overdue_hours` (default `24`) — заявка старше попадает в напоминание
  руководителю; в списке `is_overdue=true`.
- Запись: фронт шлёт **`POST`**, при `404/405` повторяет `PUT` — принимать оба.
- Пока эндпоинта нет (`404/501`) — фронт показывает заглушку и работает в
  режиме `off` (заявки не создаются). UI: вкладка **Касса → Настройки**
  (`Kassa/KassaSettings.jsx`). Вкладка **Касса → Запросы** скрыта, пока
  `mode="off"` и нет ни одной заявки в `pending` (см. [26](./26-cash-confirmation-default-off.md)).

---

## 9.4. Абонентка

```
GET  /consalting/subscription-matrix/            ?month_from=YYYY-MM&month_to=YYYY-MM&search=&page=&page_size=
GET  /consalting/clients/{id}/subscriptions/
POST /consalting/subscription-payments/{id}/pay/   { "cashbox"?: "uuid|null", "payment_method": "cash|transfer", "amount": 5000, "note"?: "" }
```

### Матрица

```jsonc
{
  "months": ["2026-02", "...", "2026-07"],
  "rows": [
    {
      "client_id": "cli-1", "client_name": "Иванов Иван",
      "service_id": "svc-1", "service_name": "Внедрение CRM",
      "subscription_amount": 5000, "subscription_period": "month",
      "cells": {
        "2026-02": { "amount": 5000, "status": "paid" },
        "2026-04": { "amount": 5000, "status": "overdue" }
        // отсутствующий месяц = нет платежа
      }
    }
  ],
  "count": 128   // при пагинации; иначе можно опустить
}
```

- Строка = «клиент × услуга». Один клиент с 2 услугами = 2 строки.
- `status` ячейки: `paid | planned | overdue`. Допускается `{ "paid": true }`
  вместо `status` — фронт поймёт.
- Годовой тариф (`subscription_period="year"`): платёж показывается **только в
  месяце списания**, остальные месяцы года пустые.
- «Итого оплачено» по месяцам фронт считает сам.

### График клиента

```jsonc
{
  "results": [
    {
      "id": "sub-1",
      "service_display": "Внедрение CRM", "tariff_display": "Стандарт",
      "amount": 5000, "period": "month", "period_display": "Ежемесячно",
      "status": "active", "start_date": "2026-03-01",
      "next_payment": { "id": "p-9", "due_date": "2026-08-01", "amount": 5000, "status": "planned" },
      "payments": [
        { "id": "p-1", "period_month": "2026-03", "due_date": "2026-03-01",
          "amount": 5000, "status": "paid", "paid_at": "2026-03-02T11:00:00+06:00" }
      ]
    }
  ]
}
```

### Статусы платежа (канон §9.0 п.8)

Наружу: **`planned | paid | overdue | canceled`**.
`scheduled` и `pending` фронт (`normalizeSubscriptionPaymentStatus`) мапит в
`planned`, но бэк в ответах должен отдавать `planned`.
«Оплатить» доступно при `planned` и `overdue`.

### pay — поведение

- Создаёт `CashRequest(kind="subscription")`; платёж → `paid` только после
  `confirm` (или сразу при `mode=off`).
- Повторная оплата уже оплаченного/ожидающего периода →
  `400 {"detail": "Этот платёж уже оплачен или ожидает подтверждения в кассе."}`.
- Частичная оплата (`amount < payment.amount`): запрещать с понятным `detail`
  (фронт остаток не строит).

---

## 9.5. Продажи — отмена и возврат

```
GET  /consalting/sales/                        ?search=&status=&user=&client=&service=&date_from=&date_to=&page=&page_size=&ordering=
POST /consalting/sales/                        { client, services, tariff, payment_mode, amount?, ... }
GET  /consalting/sales/{id}/
POST /consalting/sales/{id}/cancel/            { "reason", "comment"?, "refund_mode": "cash|transfer|none", "lead_action"?: "return_to_work|reject" }
POST /consalting/sales/{id}/refund/            { "amount"?, "items"?: ["uuid"], "reason", "comment"?, "refund_mode": "cash|transfer|none" }
GET  /consalting/sales/cancellations/          ?date_from=&date_to=&user=&reason=&page=&page_size=
DELETE /consalting/sales/{id}/                 — только owner и только без последствий; иначе 403
```

### Enums

```
status        : completed | pending_confirmation | canceled | refunded
cancel_reason : client_refused | input_error | warranty | duplicate | other
refund_mode   : cash | transfer | none
lead_action   : return_to_work | reject   (или отсутствует)
```

- `canceled` — полная отмена. `refunded` — частичный возврат (продажа жива).
- `POST /consalting/sales/` **обязан** вызывать `create_sale_side_effects`
  (абонентка + касса + зарплата), как и `register-payment` и win в финальной
  воронке — это тот же путь ([01](./01-subscription.md) §5.3).
- `reason` обязателен; `reason="other"` без `comment` → `400`.
- `refund`: `0 < amount ≤ total − refunded_amount`, иначе
  `400 {"detail": "Сумма возврата больше остатка по продаже."}`.
- Редактирование продажи со `status="canceled"` → `403 {"detail": "Нельзя редактировать отменённую сделку."}`.

### Откат отмены (сервер, одна транзакция) — [02](./02-sale-cancel.md) §8.4

Абонентка: `planned/overdue → canceled`, `Subscription.status = canceled`
(оплаченные периоды не трогать). Долг/рассрочка: `planned → canceled`.
Зарплата: начисление → `canceled`; если уже выплачено — **`SalaryAdjustment(kind="deduction")`** на след. период (не просто снять флаг). Частичный возврат — зарплата уменьшается пропорционально, абонентка не снимается.
Касса: `pending` заявка → `canceled`; при `refund_mode∈{cash,transfer}` — новая
расходная заявка `kind="refund"`, `direction="expense"`.
Лид: `lead_action` применяется только при полной отмене.

### Отчёт cancellations

Поля строки: дата, продажа, клиент, сумма, кто оформил, кто отменил, причина.
Отмена уменьшает выручку **месяца продажи**, не месяца нажатия кнопки.

---

## 9.6. Tenant (CRM-аккаунт клиента)

```
GET  /consalting/clients/{id}/tenant-account/
POST /consalting/clients/{id}/provision-tenant/   {}   — owner/admin, ручной retry
```

```jsonc
// GET / POST-ответ
{
  "provision_status": "created",
  "provision_status_display": "Аккаунт создан",
  "provision_error": null,
  "provisioned_at": "2026-03-02T11:00:00+06:00",
  "nur_company_id": 42,
  "company_name": "ОсОО Ромашка",
  "owner_email": "owner@example.kg",
  "end_date": "2026-04-01",
  "subscription_plan": { "id": 1, "name": "Старт" },
  "sector": { "id": 3, "name": "Маркет" }
}
// при успешном provision с новым паролем — плюс:
{ "generated_password": "Ab12Cd34!" }
```

- `provision_status`: `none | pending | created | failed`
  (фронт-константы `TENANT_PROVISION_STATUS`).
- Provision — только для `NUR_CONSULTING_COMPANY_ID`, только тариф
  `provisions_crm_account=true`, **после `confirm` заявки `kind=sale`** (не при
  создании Sale). Идемпотентность по `client.nur_company_id`.
- Email занят → `provision_status="failed"`, `provision_error` с текстом; фронт
  показывает его как есть.
- Extend `end_date` — при `confirm` заявки `kind=subscription`, на `period`
  (`month|year`), от `max(end_date, today)`. Идемпотентно по
  `subscription_payment` (повторный confirm → `400`).
- Опционально в `GET /consalting/leads/{id}/`: `tenant_provision_status`,
  `tenant_provision_status_display` (бейдж на карточке лида).
- UI: блок «CRM-аккаунт» в `client/ConsultingClientDetail.jsx`.

---

## 9.7. Аналитика — дашборд

```
GET /consalting/analytics/dashboard/   ?date_from=&date_to=&branch=&owner=
```

Фронт дублирует период в алиасы `period_start/period_end` — принимать любые.

```jsonc
{
  "kpis": {
    "revenue":          { "current": 62200, "previous": 33244, "diff": 28956, "percent": 87.1 },
    "net_revenue":      { "current": 58000, "previous": 31000, "diff": 27000, "percent": 87.1 },
    "cancellations":    { "current": 4200,  "previous": 2244,  "diff": 1956,  "percent": 87.1 },
    "cancel_rate":      { "current": 6.8,   "previous": 6.2,   "diff": 0.6,   "percent": 9.7 },
    "paid_income":      { "current": 55000, "previous": 28000, "diff": 27000, "percent": 96.4 },
    "pending_cash":     { "current": 315000,"previous": 120000,"diff": 195000,"percent": 162.5 },
    "subscription_mrr": { "current": 45000, "previous": 42000, "diff": 3000,  "percent": 7.1 },
    "sales_count":      { "current": 0, "previous": 0, "diff": 0, "percent": 0 },
    "avg_check":        { "current": 0, "previous": 0, "diff": 0, "percent": 0 }
  }
}
```

Источники (канон):

| KPI | Формула |
|---|---|
| `revenue` | `Σ Sale.total` где `status ∈ {completed, pending_confirmation}` |
| `net_revenue` | `revenue − cancellations − Σ refunded_amount` |
| `cancellations` | `Σ Sale.total` где `status=canceled` + `Σ refunded_amount` |
| `cancel_rate` | **`cancellations / revenue × 100`** (§9.0 п.5) |
| `paid_income` | `Σ CashOperation` income (confirmed) |
| `pending_cash` | `Σ CashRequest(pending).amount` — **не** входит в `paid_income` |
| `subscription_mrr` | месячный эквивалент активных `Subscription.amount` |

`pending_cash` обязан совпадать с `cashbox/requests/counters/ → pending_amount`.
`net_revenue` уменьшается в месяце **продажи** при отмене.

Смежные списки аналитики (не в этом блоке, контракт — [../analytics.md](../analytics.md)):
`GET /consalting/analytics/messenger|sources|managers/`.

---

## 9.8. RBAC продавца

Фронт (`consultingFunnelAccess.js`) принимает **и роли, и булевы права, и
`funnel_grants`** — бэк должен поддержать все три, серверная фильтрация
обязательна (фронт её не заменяет).

### Роли-менеджеры (полный доступ)

`role ∈ { owner, admin, rop }` — видят всё.

### Булевы права профиля

```
can_view_funnel            — доступ к странице воронки (фолбэк: can_view_sale)
can_manage_funnel_leads    — двигать/назначать лиды
can_view_all_funnel_leads  — снять изоляцию «только свои» без смены роли
can_view_leads_inbox       — доступ к /consalting/inbound-leads/
can_view_all_sales         — все продажи компании
can_view_analytics         — доступ к /consalting/analytics/*
can_view_sale              — легаси-фолбэк для can_view_funnel
```

`role="salesperson"` (или любой не-менеджер без `can_view_all_funnel_leads`) →
режим изоляции «только свои».

### funnel_grants (по-вороночная видимость — для регионов)

```jsonc
"funnel_grants": [
  { "funnel_id": "uuid", "can_manage_leads": true, "can_manage_stages": false }
]
```

Продавцу региона выдаётся grant только на его воронку → он не видит чужие
регионы даже как владелец лида в другой воронке.

### Серверная фильтрация (обязательно)

```
Лиды :  role∈{owner,admin,rop} | can_view_all_funnel_leads
          → qs.filter(funnel__in=allowed_funnels(user))
        иначе → qs.filter(owner=user, funnel__in=allowed_funnels(user))
        allowed_funnels = funnel_grants ∪ ролевая воронка
Продажи: менеджер | can_view_all_sales → все; иначе qs.filter(user=user);
         ?user= от не-менеджера игнорировать, подставлять request.user
Inbox :  без can_view_leads_inbox → 403 на /inbound-leads/
Касса :  confirm/reject — owner/admin или роль кассира
Аналитика/настройки: без права → 403
claim гонка → 409; PATCH/assign/claim на чужой лид → 403
```

---

## 9.9. Региональные воронки и распределение

```
GET /consalting/lead-distribution/
PUT /consalting/lead-distribution/            { "enabled", "strategy", "role_ids": ["uuid"] }

GET /consalting/regional-funnel-routing/
PUT /consalting/regional-funnel-routing/      <тело ниже>
```

`lead-distribution` (глобальный фолбэк-owner): GET отдаёт
`{ enabled, strategy, role_ids, recipients }`; `strategy ∈ { round_robin, least_loaded, manual }`.

### regional-funnel-routing — тело PUT (ровно то, что шлёт фронт)

```jsonc
{
  "enabled": true,
  "fallback_strategy": "round_robin",        // round_robin | default_funnel
  "default_funnel_id": "uuid | null",        // только при fallback_strategy=default_funnel
  "rules": [
    {
      "region_code": "bishkek",              // bishkek | osh | jalal_abad
      "funnel_id": "uuid",
      "phone_prefixes": ["+996312", "+996555"],
      "assign_role_ids": ["role-uuid"],
      "assign_strategy": "round_robin"
    }
  ]
}
```

GET дополнительно отдаёт `funnel_display`, `region_label` для UI.
`wazzup_account_ids` / `source_channels` в правиле — **опциональны**, текущий UI
их не редактирует (можно принимать и хранить, но не требовать).

### Дефолтные префиксы (фронт-константа `CONSULTING_REGIONS`)

| region_code | Город | Префиксы (дефолт, редактируются в UI) |
|---|---|---|
| `bishkek` | Бишкек | `+996312`, `+996313`, `+996555`, `+996700` |
| `osh` | Ош | `+996322`, `+996323` |
| `jalal_abad` | Джалал-Абад | `+996772`, `+996882` |

### Inbound routing (сервер)

1. `enabled=false` → поведение главной воронки ([../backend-main-funnel-inbound.md](../backend-main-funnel-inbound.md)).
2. `funnel = resolve_by(phone_prefix → longest wins; затем wazzup_account_id; затем source)`.
3. `None` → `fallback_strategy`: `default_funnel` или RR между `rules[].funnel`.
4. `owner = assign_owner_within_region(rule)` — RR/least-loaded по
   `assign_role_ids`; параллельный inbound под `select_for_update`.
5. Повторное сообщение того же чата **не меняет** `funnel`.

### «Оплачено» → «Внедрение» (канон §9.0 п.4)

После `POST /consalting/leads/{id}/register-payment/`:

```python
create_sale_side_effects(...)
lead.payment_registered = True
if lead.funnel.next_funnel_id and not lead.funnel.is_final:
    move_lead_to_next_funnel(lead, lead.funnel, transition="payment")
```

- Механизм — **`Funnel.next_funnel` / `next_stage` / `is_final`**
  ([../backend/03-funnel-hierarchy.md](../backend/03-funnel-hierarchy.md)),
  не флаг `is_onboarding`. Фронт (`Funnel.jsx` `FunnelForm`) редактирует
  `next_funnel`, `next_stage`, `is_final`.
- Ответ `register-payment` возвращает обновлённый `lead` с новыми `funnel` и
  `stage` (фронт `paymentMovedFunnelId` читает `funnel_id`/`funnel` на корне
  или в `lead`) — доска перерисуется без второго `win`.
- Идемпотентность: повторный вызов с тем же `Idempotency-Key` или при
  `lead.payment_registered=true` → `409` либо возврат существующего `sale`.
  **`Sale` не дублировать**, повторно во «Внедрение» не переносить.

---

## 9.10. Лид → клиент, дедуп

```
POST /consalting/leads/{id}/register-payment/   <тело ниже>
POST /consalting/leads/{id}/create-client/      { "full_name"?, "phone"?, "email"?, "force_merge"?: false }
GET  /consalting/clients/lookup/                ?phone=+996...&email=
```

### register-payment — тело (фронт `funnelThunk.registerLeadPayment`)

```jsonc
{
  "payment_mode": "cash|transfer|debt|installment",
  "amount": 45000,
  "debt_months": 6,
  "prepayment": 10000,
  "note": "",

  "subscription_enabled": true,
  "subscription_amount": 5000,
  "subscription_period": "month",       // month | year
  "subscription_start": "2026-08-01"
}
```

- Порядок на сервере: `resolve_client_from_lead` → `create_sale_side_effects` →
  `move_lead_to_next_funnel`.
- Нет клиента и нет email при `provisions_crm_account=true` →
  `400 {"detail": "Сначала создайте клиента из лида или укажите email для автосоздания."}`.
- Если `subscription_*` не переданы (старый клиент) — абонплату брать из тарифа,
  старт = сегодня.

### create-client — ответ

```jsonc
{ "client_id": "uuid", "merged": false, "client_display": "Иванов Иван", "duplicate_warning": null }
```

Фронт (`normalizeCreatedClient`) также принимает `client` объектом и `id`.
При merge: `"merged": true`, `duplicate_warning` = `{ "id": "..." }` найденного.

### lookup — ответ

```jsonc
{ "matches": [ { "id", "full_name", "phone", "email", "last_sale_at" } ] }
```

### Дедуп (сервер) — [08](./08-lead-client-conversion.md)

Телефон → E.164 KG (`8`/`0` → `+996`), сравнение по последним 9 цифрам как
фолбэк. Поиск: точный телефон → email (`iexact`). Найден → `merge_lead_into_client`
(заполняет только пустые поля клиента, чат/сообщения оставляет на лиде).
Идемпотентно по `lead.id`.

---

## 9.11. Флаг переходного периода

```env
VITE_CONSULTING_CASH_V2=true   # default; false — legacy fallback-пути (не для prod)
```

`src/utils/consultingMoney.js` → `isConsultingCashV2()`. При `false` фронт
откатывается на `/construction/*` и `/main/*` — бэк это не поддерживает как
целевой режим, только на время миграции данных.

---

## 9.12. Чек-лист приёмки (сквозной)

- [ ] Все enum-значения из §9.2 / §9.4 / §9.5 отдаются в каноничной форме (не `scheduled`, не `outcome`, не `rejected` для снятых заявок).
- [ ] `POST /consalting/cashbox/confirmation-settings/` возвращает `200` (не `405`); `mode ∈ {required,cash_only,off}`.
- [ ] Новая компания без сохранённых настроек кассы получает `mode="off"` (см. [26](./26-cash-confirmation-default-off.md)), а не `cash_only`.
- [ ] `POST /consalting/sales/` создаёт `Subscription` + `CashRequest` + начисление (не только запись `Sale`).
- [ ] Годовой тариф: 1 платёж в год в графике и матрице, не 12.
- [ ] Отмена продажи с выплаченной зарплатой → `SalaryAdjustment(deduction)`, не молчаливый флаг.
- [ ] `cancel_rate = cancellations / revenue × 100` во всех разрезах.
- [ ] `register-payment` двигает лид по `next_funnel`; `is_onboarding` не используется.
- [ ] Продавец с `funnel_grants` на «Бишкек» не получает лиды/доски других регионов даже как owner.
- [ ] `pending_cash` (dashboard) == `pending_amount` (counters).
- [ ] Provision/extend идемпотентны; повторный confirm → `400`, ничего не задваивается.
```
