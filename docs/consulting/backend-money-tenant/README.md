# Консалтинг — backend: деньги, tenant, автоматизация CRM

**Дата:** 02.09.2026  
**Домен API:** `/api/consalting/` (историческое написание — не менять).  
**Фронт:** `VITE_CONSULTING_CASH_V2=true` (по умолчанию), см. [00-money-flow.md](./00-money-flow.md).

Папка объединяет:

1. **Денежный контур** (продажа → касса → абонентка → откат).
2. **Tenant CRM-аккаунт** (provision / extend).
3. **ТЗ «Доработка логики и автоматизация CRM»** (2 дня): регионы, RBAC,
   лид→клиент.

Консалтинг — только NUR как внутренний канал продаж.

---

## Содержание

### Обзор и сценарии

| Файл | Что делаем |
|---|---|
| [00-money-flow.md](./00-money-flow.md) | Архитектура V2, deprecated paths |
| [09-frontend-contract.md](./09-frontend-contract.md) | **Точный контракт фронта — канон при расхождениях** (эндпоинты, enum, тела, разрешение конфликтов спека↔прод↔фронт) |
| [10-backend-issues.md](./10-backend-issues.md) | **Что не так на бэке:** дефекты по приоритетам (P0–P3), доказательства с прод-API, фиксы |
| [scenario-2026-09-full-cycle.md](./scenario-2026-09-full-cycle.md) | **Полный цикл (актуальный):** приём лида → регион → воронка → оплата (в т.ч. несколько месяцев) → клиент → касса → CRM-аккаунт «Маркет». Объединяет 06–13 |
| [scenario-crm-automation.md](./scenario-crm-automation.md) | ТЗ 2 дня (устарел — без `supervisor` и объединения лидов) |
| [scenario-tenant.md](./scenario-tenant.md) | Tenant: provision / extend |

### Деньги и tenant (блок 4 бизнес-ТЗ)

| # | Файл | Что делаем | Приоритет |
|---|---|---|---|
| 1 | [01-subscription.md](./01-subscription.md) | Абонентка, `create_sale_side_effects`; §5.8 — ручное продление графика + смена цены (обновлено 12.09.2026) | **1** |
| 2 | [02-sale-cancel.md](./02-sale-cancel.md) | Отмена/возврат, атомарный откат | **3** |
| 3 | [03-cash-confirmation.md](./03-cash-confirmation.md) | CashRequest → CashOperation | **4** |
| 4 | [04-tenant-lifecycle.md](./04-tenant-lifecycle.md) | CRM-аккаунт + `end_date` | **4** |
| 5 | [05-analytics-kpi.md](./05-analytics-kpi.md) | KPI dashboard | **5** |

### Процесс CRM (блоки 1–3 бизнес-ТЗ, День 1–2)

| # | Файл | Что делаем | Приоритет |
|---|---|---|---|
| 6 | [06-regional-funnels-routing.md](./06-regional-funnels-routing.md) | Регионы, RR, «Внедрение» | **6** |
| 7 | [07-seller-access-isolation.md](./07-seller-access-isolation.md) | Изоляция продавцов | **6** |
| 8 | [08-lead-client-conversion.md](./08-lead-client-conversion.md) | Лид→клиент, дедуп | **7** |
| 12 | [12-regional-supervisor-rbac.md](./12-regional-supervisor-rbac.md) | Роль `supervisor` (руководитель региона), изоляция по региону, равномерное деление лидов | **6** |
| 14 | [14-client-upsell-sale.md](./14-client-upsell-sale.md) | Доп. продажа свободными позициями: из карточки клиента (`POST /consalting/sales/` `items[]`+`kind=addon`) и при оплате лида в воронке (`register-payment` `items[]`) | **7** |
| 15 | [15-regional-routing-integration.md](./15-regional-routing-integration.md) | Стыковка реализованной региональной маршрутизации с фронтом: пути redistribute, `GET /regions/`, `scope`/`dry_run`, поля `region_code`, RBAC supervisor, стадии воронок | **6** |
| 16 | [16-request-assigned-to.md](./16-request-assigned-to.md) | `ConsultingRequest.assigned_to`/`assigned_to_display`/`acceptance`, фильтр `?assigned_to=`, экшены `accept/` `decline/` (принять/отказаться от заявки), WS `consulting.request.assigned`/`.accepted`/`.declined` | **7** |
| 17 | [17-employee-region-subfunnels.md](./17-employee-region-subfunnels.md) | Право `can_create_funnel`; `Funnel.parent_funnel`/`owner_user`/`funnel_kind="employee"`; воронка сотрудника автопривязывается к региональной воронке его региона; руководитель видит подворонки сотрудников во вкладке региона | **7** |
| 18 | [18-analytics-debts.md](./18-analytics-debts.md) | Вкладка «Долги» в аналитике: просроченная абонплата (`SubscriptionPayment.status=overdue`) + абонплата, оформленная в долг/рассрочку (`Sale.payment_mode in (debt, installment)`); плюс анализ пробелов аналитики на будущее | **5** |
| 19 | [19-assign-owner-region-scope.md](./19-assign-owner-region-scope.md) | Баг на проде: `assign_owner_within_region` назначает сейлза по общей роли без фильтра `consulting_region_codes` → входящие WhatsApp-лиды одного региона уходят сотруднику другого региона | **P0** |
| 20 | [20-funnel-leads-count-stale.md](./20-funnel-leads-count-stale.md) | Баг на проде: `Funnel.leads_count` не пересчитывается — в одном ответе `board/` расходится с `totals.count` (3 vs 43 на «Основной воронке») | **P2** |
| 21 | [21-funnel-delete.md](./21-funnel-delete.md) | `DELETE /consalting/funnels/{id}/`: право сотрудника удалять СВОЮ подворонку, право owner/admin/rop удалять ролевые воронки (§7), контракт `409` при незакрытых лидах | **P2** |
| 22 | [22-bulk-lead-transfer.md](./22-bulk-lead-transfer.md) | Массовые действия с выбранными лидами с доски (чекбоксы + панель): передать сотруднику, §7.1 на стадию, §7.2 в другую воронку — переиспользует существующие `transfer`/`assign`/`move-stage`, новых эндпоинтов не требует | **P1** |
| 23 | [23-tenant-account-auto-link.md](./23-tenant-account-auto-link.md) | Автоопределение существующего NurCRM-аккаунта по email клиента вместо ручной привязки в platform-admin — новые `GET /tenant-accounts/lookup/`, `POST /clients/{id}/link-tenant/` | **P1** |
| 24 | [24-lead-address-field.md](./24-lead-address-field.md) | Новое поле `Lead.address` — добавлено в обе формы «Новый лид» (доска воронки и страница «Лиды») | **P2** |
| 25 | [25-lead-archive-restore.md](./25-lead-archive-restore.md) | Восстановление лида из архива — новый `POST /leads/{id}/restore/`: снимает `is_archived`, сбрасывает статус, возвращает на активную стадию воронки | **P2** |
| 26 | [26-cash-confirmation-default-off.md](./26-cash-confirmation-default-off.md) | Дефолт `CashConfirmationSettings.mode` меняется с `cash_only` на `off` — заявки на подтверждение по умолчанию выключены, компания включает сама; существующие строки не трогаем | **P1** |
| 27 | [27-lead-sale-cancel-from-queue.md](./27-lead-sale-cancel-from-queue.md) | Кнопка «Отменить продажу» прямо на карточке лида в очереди `/crm/consulting/leads`: `InboundLead.sale` в ответе списка, синхронизация `register-payment` → `InboundLead.sale`/`status`, откат при отмене продажи | **P2** |

**Смежные (вне папки):**

- [../subscription-matrix.md](../subscription-matrix.md)
- [../funnel-crm-logic.md](../funnel-crm-logic.md)
- [../backend/03-funnel-hierarchy.md](../backend/03-funnel-hierarchy.md)
- [../backend/07-employee-finance.md](../backend/07-employee-finance.md)

---

## Порядок реализации

```
День 1 (процесс):
  06 regional routing + 07 seller isolation

День 2 (конверсия + деньги):
  08 lead→client
    → 01 subscription + register-payment
    → 03 cash confirmation
    → 04 tenant (hooks в confirm)
  02 sale cancel + 05 analytics — параллельно после стабилизации
```

Критический путь денег: **01 → 03 → 04** (см. [00-money-flow.md](./00-money-flow.md)).

---

## Сервисный слой (backend)

```
apps/consalting/services/
  regional_routing.py       # resolve_funnel_by_rules, assign_owner
  lead_client.py            # resolve_client_from_lead, merge, dedup
  sale_side_effects.py      # create_sale_side_effects
  cash_confirmation.py      # confirm, reject
  subscription_schedule.py
  tenant_lifecycle.py
```

---

## Definition of Done (полный контур)

- [ ] Inbound → региональная воронка ([06](./06-regional-funnels-routing.md))
- [ ] Продавец видит только свои записи ([07](./07-seller-access-isolation.md))
- [ ] Оплата → Client без дублей ([08](./08-lead-client-conversion.md))
- [ ] Sale → CashRequest → confirm → CashOperation ([03](./03-cash-confirmation.md))
- [ ] Confirm → tenant; абонплата → extend ([04](./04-tenant-lifecycle.md))
- [ ] Отмена атомарно откатывает контур ([02](./02-sale-cancel.md))
- [ ] Нет legacy `/main/deals/`, `/construction/cashflows/` из консалтинга
- [ ] Ответы соответствуют [09-frontend-contract.md](./09-frontend-contract.md) §9.12 (enum, методы, идемпотентность)

---

## Фронт

| Модуль | Путь |
|---|---|
| Регионы | `leads/LeadsDistribution.jsx`, `api/consultingLeads.js` |
| RBAC | `utils/consultingFunnelAccess.js` |
| Касса | `Kassa/`, `api/consultingCashbox.js` |
| Tenant | `api/consultingTenant.js` |
| Флаг V2 | `utils/consultingMoney.js` |
