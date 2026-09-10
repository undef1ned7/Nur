# 10. Что не так на бэке — список дефектов и вопросов

**Дата:** 03.09.2026
**Основание:** ревизия ТЗ [00](./00-money-flow.md)–[09](./09-frontend-contract.md) +
живой прогон прод-API `https://app.nurcrm.kg/api/consalting/` (компания
`consulting@gmail.com`, роль `owner`).

Каждый пункт: **где** · **как воспроизвести / доказательство** · **ожидание** ·
**фикс**. Метки: `[LIVE]` — подтверждено на проде, `[ТЗ]` — из спецификации,
`[?]` — требует проверки на данных, которых в тест-компании нет.

Приоритеты: **P0** — ломает прод сейчас · **P1** — неверные деньги/данные ·
**P2** — логическое противоречие, нужно решение · **P3** — долг/документация.

---

## Статус проверки (обновлено 03.09.2026, вечер)

Легенда: **✅ verified** — перепроверено вживую на `app.nurcrm.kg` мной ·
**🟡 claimed** — бэк отчитался об исправлении + свой live-check, моя независимая
перепроверка ещё не сделана (последний мой прогон показывал дефект) ·
**⚠️ unverifiable** — нет данных на проде · **❌ open** — не адресовано.

| ID | Статус | Комментарий |
|---|---|---|
| P0-1 | ✅ verified | `POST /funnels/` c `next_assign:null` → 201 |
| P0-2 | ✅ verified | `POST /sales/ {}` → 400 «Клиент обязателен». **Вперёд-only** — 4 исторические продажи `client=None` на 44 744 c остались |
| P0-3 | 🟡 partial | `client` теперь обязателен; полный запуск `create_sale_side_effects` из `POST /sales/` независимо не проверен |
| P0-4 | ✅ verified | `POST /inbound-leads/` без `external_id` → 201, сохранён `external_id=""`. Прим.: `DELETE /inbound-leads/{id}/` → 405 (лиды не удаляются, только `lost`/`rejected`) |
| P0-5 | ❌ open | Провижн CRM-аккаунта падает: `null value in column "is_active" of relation "construction_cashbox"` + сектор по умолчанию не «Маркет». ТЗ: [11-provision-market-sector.md](./11-provision-market-sector.md) |
| P0-6 | ❌ open | Региональные воронки «Ош»/«Бишкек» без стадий → лиды не видны на доске, `win/` → `400 «нет WON-стадии»`, `register-payment` не переносит лид. ТЗ: [06-regional-funnels-routing.md §6.5a](./06-regional-funnels-routing.md) |
| P1-1 | ✅ verified | `subscription_mrr` = 0.0 (было 2200) при `matrix rows=0` — согласовано. MRR теперь по активным `SubscriptionConsalting` |
| P1-2 | ⚠️ unverifiable | на проде 0 кассовых сумм |
| P1-3 | ⚠️ unverifiable | `pending_cash=0`, `counters=0` |
| P1-4 | ❌ open | accrual vs cash в разных месяцах при отмене — не адресовано |
| P1-5 | ⚠️ unverifiable | нет `confirmed` продажи с оплатой, чтобы спровоцировать `IntegrityError` на refund |
| P1-6 | 🟡 claimed | бэк: «отдельный RR-счётчик на каждое правило». API-проверке не поддаётся (внутримодельное) |
| P1-7 | ❌ open | `initial_access_days` + первый платёж графика = лишний период |
| P1-8 | ❌ open | extend прощает просрочку в доступе, но не в матрице |
| P2-1…4 | ❌ open | продуктовые развилки — нужен ответ продукта |
| P3-1 | ✅ verified | маршрут `subscription-payments/{id}/pay/` открыт (404 «No … matches», не «страница не найдена») |
| P3-2 | ✅ verified | `POST` **и** `PUT` `/confirmation-settings/` → 200; `mode:"cash_only"` (канон) |
| P3-3 | ⚠️ unverifiable | нет `pending`-заявки, чтобы проверить `canceled` vs `rejected` при отмене продажи |
| P3-4 | ✅ verified | воронки используют `next_funnel`/`is_final` (роль-воронки → «Установщик», `is_final=True`). Поля `is_onboarding` в API нет вообще — канон подтверждён |
| P3-5 | ⚠️ unverifiable | нет отмен, `cancel_rate=0/0` |
| P3-6 | ❌ open | переписанная зависимость миграции `consalting.0032` — рассинхрон графа `users` |
| P3-7 | ❌ open | касса на `construction.Cashbox` (только `getattr`-заплатка на `role`) |
| P3-8 | ❌ open | `cashboxes/` отдаёт голый массив, остальные списки — `{results}` |
| P3-9 | ❌ open | тест-сьют гоняется на боевой БД |
| P3-10 | ❌ open | `installment` vs `SubscriptionPayment` в [subscription-matrix.md](../subscription-matrix.md) |
| P3-11 | ❌ open | дедуп-fallback «9 цифр» ≈ основной E.164-матч |
| DB-junk | ⚠️ needs cleanup | 4 продажи `client=None`, июнь–июль 2026, 44 744 c (`68049f3a`, `b798fde1`, `ff2ee02f`, `debdc7ff`) — перевести в `canceled` скриптом |

**Перепроверено 03.09 вечером:** P0-4, P1-1, P3-4 → все **✅ verified fixed**.

**Ещё не закрыто (❌ open):** P1-4, P1-7, P1-8, P2-1…4, P3-6…11 + чистка DB-junk
(4 продажи `client=None` на 44 744 c всё ещё в базе).

---

## P0 — ломает прод сейчас

### P0-1. `POST /consalting/funnels/` не принимает `next_assign: null` `[LIVE]`

**Где:** `FunnelConsaltingSerializer.next_assign`.

**Доказательство:**

```
POST /consalting/funnels/
{ "name":"Бишкек", "is_main":true, "funnel_kind":"main",
  "next_funnel":null, "next_assign":null, "is_final":true, ... }
→ 400 {"next_assign":["Это поле не может быть пустым."]}

# то же тело с "next_assign":"keep" → 201 Created
```

**Причина:** модельное поле `next_assign = CharField(choices, default="keep")`
без `null=True` → DRF ставит `allow_null=False`, явный `null` в теле отклоняется.
Фронт для воронки без цепочки слал `null` (исправлено на `"keep"` в
`Funnel.jsx`, но старая сборка ещё на проде).

**Ожидание:** создание воронки без `next_funnel` не должно требовать от клиента
знания дефолта.

**Фикс (бэк, любой из):**
- `next_assign = CharField(..., null=True, blank=True)` + в `validate()`
  `attrs.setdefault("next_assign", "keep")`;
- либо в сериализаторе `next_assign = ChoiceField(required=False, allow_null=True)`
  и нормализация `None → "keep"` в `create`/`update`.

Аналогично проверить `next_stage`, `next_assign_user` — они в модели `null=True`,
на проде `null` проходит, но зафиксировать это в тесте.

---

### P0-2. `POST /consalting/sales/` принимает пустое тело `[LIVE]`

**Где:** `SaleConsaltingSerializer` / `SaleConsaltingListCreateView.perform_create`.

**Доказательство:**

```
POST /consalting/sales/  { }
→ 201 { "id":"…", "client":null, "services":null, "tariff":null,
        "total":"0.00", "status":"completed", "items":[] }
```

Создалась «проведённая» продажа без клиента, услуги и суммы. Побочек у `total=0`
не было (нет `CashRequest`, нет начисления), но при ненулевой сумме без клиента
это заведёт мусор в кассу и аналитику.

**Ожидание:** `400` с указанием обязательных полей.

**Фикс:** обязательные на уровне сериализатора — `client`; ровно одно из
`services` / `tariff` / непустой `items`; при `payment_mode` — `amount > 0`.
`status` не принимать от клиента — только сервер выставляет
`completed | pending_confirmation`.

---

### P0-3. `create_sale_side_effects` не вызывается из `POST /consalting/sales/` `[LIVE, ТЗ]`

**Где:** `SaleConsaltingListCreateView`.

**Доказательство:** тестовая продажа (P0-2) не создала ни `CashRequest`, ни
`SubscriptionPayment`, ни `SalaryAccrual`. Тело было пустым, но и корректная
продажа через этот эндпоинт side-effects не запускает — [01 §5.3](./01-subscription.md#L79)
требует единой точки для `POST /sales/`, `register-payment` и win в финальной
воронке.

**Ожидание:** прямое оформление продажи = тот же контур: `Subscription` + график,
`SalaryAccrual`, `CashRequest`/`CashOperation` по `confirmation-settings`.

**Фикс:** в `perform_create` после сохранения `Sale` вызвать
`create_sale_side_effects(sale, subscription_*=...)` в той же транзакции.

---

### P0-4. `POST /consalting/inbound-leads/` требует `external_id` при ручном создании `[LIVE]`

**Где:** `InboundLeadConsaltingSerializer.external_id`.

**Доказательство:**

```
POST /consalting/inbound-leads/
{ "full_name":"Иван", "phone":"+996...", "source":"manual", "message":"" }
→ 400 {"external_id":["Обязательное поле."]}
```

У существующих лидов на проде `external_id` бывает `""` → колонка `blank=True`,
обязательность только в сериализаторе.

**Причина:** `external_id` — id чата во внешнем мессенджере (Wazzup), нужен для
дедупликации входящих ([06 §6.3](./06-regional-funnels-routing.md#L52)). Webhook
его ставит. Окно «Новый лид» (`CreateLeadModal.jsx`, обращение не из
мессенджера — звонок/визит) внешнего чата не имеет.

**Ожидание:** ручной лид создаётся без `external_id`.

**Фикс:** `external_id = CharField(required=False, allow_blank=True, default="")`
в сериализаторе; дедуп по `external_id` применять только при непустом значении.
Фронт-обход: `CreateLeadModal` шлёт синтетический `external_id="manual:<uuid>"`.

---

## P1 — неверные деньги и метрики

### P1-1. `subscription_mrr` и `Subscription` создаются до подтверждения кассы `[ТЗ]`

**Где:** `create_sale_side_effects` ([01](./01-subscription.md#L79)),
`analytics.subscription_mrr` ([05](./05-analytics-kpi.md#L18)).

**Проблема:** `Subscription(active)` + график `planned` создаются в транзакции
продажи, **до** `confirm`. Если кассир заявку **отклонил** ([03](./03-cash-confirmation.md#L156)) —
продажа остаётся `pending_confirmation`, а `Subscription` живёт: капает в MRR,
висит в абонентской матрице, генерит `planned → overdue`. Пути очистки при
`reject` нет ([03](./03-cash-confirmation.md) чистит только при *отмене продажи*).

**Ожидание:** абонентка не считается активной, пока продажа не `completed`.

**Фикс (выбрать):**
- `Subscription` создавать в `confirm_request` (`kind=sale`), не в
  `create_sale_side_effects`; **либо**
- создавать со `status="pending"` и активировать в `confirm`; в MRR и матрицу
  брать только `Subscription` с `sale.status="completed"`;
- `reject_request` при третьем повторном отклонении → авто-отмена продажи со
  сбросом side-effects.

---

### P1-2. `paid_income` двойной счёт по `handover` `[ТЗ]`

**Где:** `analytics.paid_income = Σ CashOperation(income)` ([05](./05-analytics-kpi.md#L18)),
`handover` → `CashOperation(income)` ([03 §9.5](./03-cash-confirmation.md#L156)).

**Проблема:** наличная продажа: `confirm` → `CashOperation income` (деньги учтены).
Продавец физически несёт нал в кассу → `handover` → `confirm` → **ещё один**
`CashOperation income`. Те же деньги в выручке дважды.

**Ожидание:** `handover` — внутреннее перемещение (сотрудник → касса), не выручка.

**Фикс:** `handover`-операция получает отдельный `type` (напр. `transfer_in`) либо
`is_internal=True`; `paid_income` = `Σ CashOperation(type="income") исключая
kind="handover"`. Сверка «на руках» в [07-employee-finance](../backend/07-employee-finance.md)
считается по `handover` отдельно и не трогается.

---

### P1-3. `pending_cash` смешивает новую выручку с уже учтёнными деньгами и расходом `[ТЗ]`

**Где:** `analytics.pending_cash = Σ CashRequest(pending).amount` ([05](./05-analytics-kpi.md#L18)).

**Проблема:** в сумму попадают `kind="handover"` (нал, который уже был выручкой)
и `kind="refund"` (`direction=expense`). Баннер «эти деньги ещё не в остатке»
показывает не то.

**Фикс:** `pending_cash = Σ CashRequest(status="pending", kind__in=["sale","subscription"], direction="income").amount`.
Проверка приёмки: `pending_cash` дашборда == `pending_amount` из
`cashbox/requests/counters/`.

---

### P1-4. Отмена: accrual-выручка и cash-выручка падают в разных месяцах `[ТЗ]`

**Где:** [02 §8.5](./02-sale-cancel.md#L173) (revenue минусуется в месяце продажи)
vs [02 §8.4](./02-sale-cancel.md#L143) (refund → новый `CashOperation(expense)` в
месяце кнопки).

**Проблема:** одна отмена → `net_revenue` падает в июле (месяц продажи),
`paid_income` падает в сентябре (месяц возврата). Для месячного P&L выглядит как
ошибка в данных.

**Решение (зафиксировать в ТЗ, кода может не требовать):** это разные базы учёта
(accrual vs cash). Либо явно задокументировать в [05](./05-analytics-kpi.md), либо
ввести `paid_income_adjusted`, относящий возврат к периоду исходной операции.

---

### P1-5. `UniqueConstraint(sale)` блокирует создание refund-заявки `[ТЗ]`

**Где:** [03 §9.2](./03-cash-confirmation.md#L66):

```python
UniqueConstraint(fields=["sale"],
    condition=~Q(status__in=["rejected", "canceled"]),
    name="uniq_active_request_per_sale")
```

**Проблема:** `confirmed` в условие **не входит** → считается активной. При
возврате ([02 §8.4](./02-sale-cancel.md#L143)) создаётся
`CashRequest(kind="refund", sale=sale)` при уже `confirmed` sale-заявке → две
неконечные заявки на один `sale` → `IntegrityError`.

**Фикс:** либо `condition=~Q(status__in=["rejected","canceled","confirmed"])`
(уникальна только среди `pending`), либо refund выделить в отдельную модель
`SaleRefundRequest`, либо составной ключ `(sale, kind)`.

---

### P1-6. Один RR-курсор на три региона `[ТЗ]`

**Где:** [06 §6.2](./06-regional-funnels-routing.md#L21):
`RegionalFunnelRouting._rr_cursor` — одно поле на OneToOne-модели.

**Проблема:** правил три (Бишкек/Ош/Джалал-Абад), у каждого свой
`assign_strategy="round_robin"`, но курсор общий. Назначение в Бишкеке двигает
курсор, которым пользуется Ош → распределение неравномерное, это не round-robin
по региону.

**Фикс:** курсор на `RegionalFunnelRule` (`_rr_cursor` / `last_assigned_user`),
инкремент под `select_for_update` на строке правила.

---

### P1-7. `initial_access_days` и первый платёж графика дают клиенту лишний период `[ТЗ]`

**Где:** [04 §10.3](./04-tenant-lifecycle.md#L45) (`end_date = today + initial_access_days`,
деф. 30) vs [01 §5.3](./01-subscription.md#L119) (`generate_schedule`: первая
строка `due = start_date`, `subscription_start` по умолчанию сегодня, статус
`planned`).

**Проблема:** клиент получает 30 дней доступа **и** обязан оплатить месяц 1;
оплата месяца 1 → `end_date += 1 месяц` → 60 дней за один платёж. Плюс карточка
клиента сразу показывает `planned/overdue` за текущий месяц в день покупки.

**Решение (зафиксировать):**
- либо первая строка графика создаётся `paid` (входит в установочный платёж) и
  стартует со `start_date + 1 период`, `initial_access_days` = длине периода;
- либо `initial_access_days = 0` и доступ открывает только первый подтверждённый
  платёж.
Дополнительно определить: покрывает ли установочный `amount` первый абонентский
период (сейчас в [01 §5.6](./01-subscription.md#L196) это разные поля, связь не
описана).

---

### P1-8. Extend прощает просрочку в доступе, но не в биллинге `[ТЗ]`

**Где:** [04 §10.4](./04-tenant-lifecycle.md#L91): при `end_date < today` база =
`today`, `new = today + period`.

**Проблема:** клиент, просрочивший 3 месяца, платит **один** период → доступ с
сегодня на месяц, 3 месяца неоплаты «прощены» по доступу, но в матрице остаются
3 `overdue`, которые никто не закроет. Логика доступа и биллинга расходятся.

**Решение:** зафиксировать правило. Вариант: extend всегда от `max(end_date, due_date оплачиваемого периода)`, чтобы оплата закрывала конкретный `overdue`, а
не «месяц с сегодня». Тогда доступ и матрица сходятся.

---

## P2 — логические противоречия, нужно решение продукта

### P2-1. Когда клиент платит — два разных ответа в ТЗ `[ТЗ]`

**Где:** [03-funnel-hierarchy §3.3](../backend/03-funnel-hierarchy.md#L79)
(`on_lead_won` в не-финальной воронке → `move_lead_to_next_funnel` **без
продажи**) vs [06 §6.5](./06-regional-funnels-routing.md#L118) (`register-payment`
двигает лид во «Внедрение» **с продажей**).

**Следствие:** win в региональной воронке уводит лид во «Внедрение» без денег,
продажу создаст win уже там (`is_final=True`) — деньги в конце внедрения.
`register-payment` — деньги на входе. Оба описаны как штатный путь. Момент оплаты
в процессе не определён.

**Нужно:** решить и описать один сценарий. Если оба допустимы — явно, с разными
правилами для `win` и `register-payment` в промежуточной воронке.

---

### P2-2. Продавец теряет лид при переходе во «Внедрение», но сохраняет продажу `[ТЗ]`

**Где:** [07 §7.2](./07-seller-access-isolation.md#L26) (`funnel_grants` только на
свою воронку) + [03-funnel-hierarchy §3.4](../backend/03-funnel-hierarchy.md#L98)
(`next_assign="keep"` оставляет owner).

**Следствие:** после оплаты лид уезжает во «Внедрение», грантов на которую у
регионального продавца нет → лид пропадает с его доски. При этом
`sale.user = продавец` и `can_view_sale` → продажу он видит. Плюс `next_assign=keep`
делает его owner лида в невидимой ему воронке.

**Нужно:** правило видимости для «переданных дальше» лидов. Варианты:
`next_assign="pool"` по умолчанию для регионалок; либо read-only доступ owner'а к
своему лиду в любой воронке; либо grant на «Внедрение» всем регионалам.

---

### P2-3. Авто-конверсия невозможна для консалтингового тарифа `[ТЗ]`

**Где:** [08 §8.2](./08-lead-client-conversion.md#L26): `register-payment` без
клиента и без email при `provisions_crm_account=true` → `400`.
[06 §6.3](./06-regional-funnels-routing.md#L52): региональный роутинг создаёт лид
из WhatsApp по **одному телефону**, без email.

**Следствие:** любой WA-лид на тариф с CRM-аккаунтом (основной сценарий
консалтинга) упрётся в `400`, пока менеджер вручную не впишет email. Сквозной
happy-path в [scenario-crm-automation](./scenario-crm-automation.md#L22) этот шаг
пропускает.

**Нужно:** либо на этапе перевода во «Внедрение» / перед `register-payment`
обязательный шаг «укажите email», отражённый в UI и в диаграмме; либо
`provision` откладывается до появления email с уведомлением менеджеру.

---

### P2-4. `pending_confirmation`-продажу можно редактировать `[ТЗ]`

**Где:** [02 §8.6](./02-sale-cancel.md#L204) запрещает править только `canceled`.

**Следствие:** правка суммы/тарифа на продаже, по которой уже висит `pending`
`CashRequest`, рассинхронит `Sale.total` и `CashRequest.amount` — кассир
подтвердит одну сумму, в аналитике другая.

**Фикс:** запретить редактирование при `status != "completed"` без последствий;
либо при правке суммы `pending`-продажи пересоздавать `CashRequest`.

---

## P3 — требует проверки (нет данных в тест-компании)

### P3-1. `POST /consalting/subscription-payments/{id}/pay/` не проверен `[?]`

`GET /consalting/subscription-payments/` → `404`; в компании 0 подписок, экшн
`/pay/` не на чем протестировать. **Нужно:** подтвердить, что маршрут
зарегистрирован (router action или явный path), и что он возвращает канон из
[09 §9.4](./09-frontend-contract.md#L200) (400 на повторную оплату, создание
`CashRequest(kind="subscription")`).

### P3-2. Метод записи `confirmation-settings` `[?]`

`GET` работает, отдаёт `{ "mode":"cash_only", "skip_for_cashier":true, "overdue_hours":24 }`.
Метод записи не тестировался (чтобы не менять настройку прод-компании). Фронт шлёт
`POST`, при `405/404` повторяет `PUT` ([09 §9.3](./09-frontend-contract.md#L128)).
**Нужно:** подтвердить, что `POST` (или `PUT`) возвращает `200` и что
`mode` принимает `required | cash_only | off` (не только `required`).

### P3-3. Статус снятой заявки при отмене продажи `[?]`

`cashbox/requests/counters/` уже отдаёт ключ `canceled` — значит статус в модели
есть. Но не проверено, что `cancel_sale` ставит именно `canceled`, а не
`rejected` ([09 §9.0 п.3](./09-frontend-contract.md#L23)). **Нужно:** прогнать
отмену продажи с `pending`-заявкой и убедиться: `status="canceled"`,
`reject_reason` пустой.

### P3-4. Перенос во «Внедрение» — `next_funnel` или `is_onboarding` `[?]`

Воронки на проде имеют поле `next_funnel` (в ответе `POST /funnels/` оно есть).
Отчёт бэка (§3.7 прошлой сверки) упоминал хардкод `funnel.is_onboarding=True`.
**Нужно:** подтвердить, что `on_register_payment` двигает лид по
`funnel.next_funnel` / `next_stage` / `is_final`
([09 §9.0 п.4](./09-frontend-contract.md#L23)), а не по флагу.

### P3-5. `cancel_rate` — формула `[?]`

На проде `0.0` (нет отмен). **Нужно:** подтвердить формулу
`cancellations / revenue × 100` ([09 §9.7](./09-frontend-contract.md#L340)), не
`cancellations / (revenue + cancellations)`.

---

## P3 — инженерный долг

### P3-6. Миграция `consalting.0032` с переписанной зависимостью

Из отчёта: зависимость `consalting.0032` перенацелена с
`users.0052_alter_company_debt_schedule_version` на
`users.0051_company_appointment_work_start_and_end`, потому что на проде `users`
отставал. Миграция уже применена. Когда `users.0052` доедет до прода — граф
миграций рассинхронизируется между окружениями, `migrate --check` / CI на чистой
БД пойдёт другим порядком.

**Фикс:** догнать `users`-миграции на проде и вернуть корректную зависимость
`0032`; либо ввести явную «выравнивающую» миграцию, фиксирующую фактический граф.

### P3-7. Касса консалтинга сидит на `construction.Cashbox`

`GET /consalting/cashbox/cashboxes/` отдаёт объекты с полями `role`,
`is_consumption` — это модель `construction.Cashbox`. Из отчёта: на проде у неё
не было поля `role`, лечили `getattr(cb, "role", None)`. Это противоречит цели
[00-money-flow](./00-money-flow.md) — изолировать кассу консалтинга от
construction.

**Фикс:** собственная модель `CashBoxConsalting` (или явное решение
переиспользовать `construction.Cashbox` с обязательным `role`, задокументировав
это).

### P3-8. `POST /consalting/sales/` возвращает голый массив vs пагинацию

`GET /consalting/cashbox/cashboxes/` → **голый массив**, а `sales/`, `requests/`,
`operations/` → `{count, results}`. Фронт (`asList`) оба варианта переваривает, но
разнобой стоит убрать — все списки в `{count, next, previous, results}`.

### P3-9. Тесты гоняются на боевом сервере

Из отчёта: «Лог выполнения тестов на боевом сервере: Found 46 test(s)». Даже с
тестовой БД — конкуренция за ресурсы, риск задеть prod-`DATABASES`, мусор после
падения. Тесты — в CI/staging; на проде только смоук на реальных ручках.

### P3-10. Документация: `installment` vs `SubscriptionPayment`

[subscription-matrix.md §3](../subscription-matrix.md#L72) описывает источник
данных как строки `installment`, [01](./01-subscription.md) — как модель
`SubscriptionPayment`. Один набор доков, два имени одной сущности. Привести к
`SubscriptionPayment`.

### P3-11. Дедуп-fallback «последние 9 цифр» ≈ основной E.164-матч

[08 §8.3](./08-lead-client-conversion.md#L74): для KG национальный номер после
`+996` — ровно 9 цифр, fallback по 9 цифрам почти эквивалентен точному
совпадению нормализованного номера. Либо расширить (7 цифр + лог коллизий), либо
убрать как мнимую подстраховку.

---

## Сводная таблица

| ID | P | Тема | Статус |
|---|---|---|---|
| P0-1 | 0 | `funnels/` не принимает `next_assign:null` | LIVE, фронт-фикс есть, нужен бэк-фикс или деплой |
| P0-2 | 0 | `POST /sales/` принимает `{}` | LIVE |
| P0-3 | 0 | `POST /sales/` не запускает side-effects | LIVE + ТЗ |
| P0-4 | 0 | `inbound-leads/` требует `external_id` при ручном создании | LIVE, фронт-обход есть |
| P1-1 | 1 | `Subscription`/MRR до `confirm` | ТЗ |
| P1-2 | 1 | двойной счёт `handover` в `paid_income` | ТЗ |
| P1-3 | 1 | `pending_cash` мешает выручку/расход/учтённое | ТЗ |
| P1-4 | 1 | accrual vs cash в разных месяцах при отмене | ТЗ |
| P1-5 | 1 | `UniqueConstraint(sale)` блокирует refund | ТЗ |
| P1-6 | 1 | один RR-курсор на 3 региона | ТЗ |
| P1-7 | 1 | `initial_access_days` + первый платёж = лишний период | ТЗ |
| P1-8 | 1 | extend прощает просрочку в доступе | ТЗ |
| P2-1 | 2 | момент оплаты в процессе не определён | ТЗ |
| P2-2 | 2 | продавец теряет лид, сохраняет продажу | ТЗ |
| P2-3 | 2 | email обязателен, но WA-лид его не несёт | ТЗ |
| P2-4 | 2 | `pending_confirmation`-продажа редактируема | ТЗ |
| P3-1…5 | 3 | не проверено (нет данных): `pay/`, запись settings, статус снятой заявки, `next_funnel`, `cancel_rate` | ? |
| P3-6…11 | 3 | миграция, `construction.Cashbox`, формат списков, тесты на проде, доки | долг |
