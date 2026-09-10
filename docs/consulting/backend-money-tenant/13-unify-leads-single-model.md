# 13. Единая база лидов: «Лиды» = вид поверх Lead воронки

**Приоритет:** P1 — расхождение списков `/crm/consulting/leads` и
`/crm/consulting/funnel`.
**Дата:** 09.09.2026
**Решение продукта:** страница **«Лиды»** перестаёт быть отдельным хранилищем
(`InboundLead`) и становится **представлением над теми же `Lead`**, что показывает
воронка. Один источник правды — `Lead`.
**Фронт:** `leads/{Leads,LeadsInbox,LeadsAnalytics}.jsx`,
`leads/modals/*`, `api/consultingLeads.js`, `Funnel/Funnel.jsx`.
**Связано:** [backend-main-funnel-inbound.md](../backend-main-funnel-inbound.md)
§3.4 (там было «две сущности статусов — не сливать»; **это решение отменяет
разделение на уровне UI**), [backend/01-leads.md](../backend/01-leads.md),
[06-regional-funnels-routing.md](./06-regional-funnels-routing.md),
[12-regional-supervisor-rbac.md](./12-regional-supervisor-rbac.md).

---

## 1. Как сейчас и почему расходится

| Страница | Модель | Создание |
|---|---|---|
| `/crm/consulting/leads` (`LeadsInbox`) | `InboundLead` (`/consalting/inbound-leads/`) | окно «Новый лид» на странице; webhook мессенджеров |
| `/crm/consulting/funnel` (`LeadCreateForm`) | `Lead` (`/consalting/leads/`) | «+ Добавить лид» в колонке |

Связь `InboundLead.lead_id → Lead.id` — односторонняя и необязательная.
Лид, созданный в воронке, **не создаёт** `InboundLead` → его нет на «Лидах».
Лид, созданный на «Лидах», создаёт `InboundLead`, а `Lead` — только если
отработал фолбэк/бэк.

## 2. Целевая модель

- **`Lead`** — единственная сущность лида/сделки. Всё, что показывают обе
  страницы, — это `Lead`.
- **`InboundLead`** — понижается до **журнала приёма из мессенджеров**:
  идемпотентность webhook по `external_id`/`messageId`, сырой первый текст,
  канал, аккаунт Wazzup. Всегда несёт `lead_id` (создаётся вместе с `Lead`).
  В UId «Лиды» **не используется** как источник списка. Ручного создания
  `InboundLead` больше нет.

### 2.1. Новые поля `Lead`

```python
class Lead(models.Model):
    # ...существующее: funnel, stage, title, full_name, phone, email,
    #    source, description, estimated_value, probability, owner,
    #    status ("new"|"in_progress"|"won"|"lost"), region_code (см. 12) ...

    # --- очередь обработки (перенос из InboundLead) ---
    queue_status = models.CharField(max_length=16, default="new", db_index=True)
    # new | assigned | in_work | deferred | converted | rejected
    # Инвариант связи со сделкой:
    #   queue_status=converted  ⇔  status=won
    #   queue_status=rejected   ⇔  status=lost
    #   new/assigned/in_work/deferred  ⇔  status in (new, in_progress)

    channel = models.CharField(max_length=32, blank=True)
    # whatsapp | instagram | telegram | manual | site | call | referral
    # (то, что раньше InboundLead.source; поле `source` на Lead — маркетинговый
    #  источник/UTM, если уже используется иначе — храните канал в `channel`)

    remind_at        = models.DateTimeField(null=True, blank=True, db_index=True)
    defer_reason     = models.CharField(max_length=32, blank=True)
    defer_comment    = models.TextField(blank=True)
    defer_count      = models.PositiveIntegerField(default=0)
    deferred_at      = models.DateTimeField(null=True, blank=True)
    reminded_at      = models.DateTimeField(null=True, blank=True)
    reject_reason    = models.CharField(max_length=32, blank=True)
    reject_comment   = models.TextField(blank=True)
    first_reply_at   = models.DateTimeField(null=True, blank=True)
    converted_at     = models.DateTimeField(null=True, blank=True)
    closed_at        = models.DateTimeField(null=True, blank=True)

    inbound_external_id = models.CharField(max_length=128, blank=True, db_index=True)
    # дедуп ручного/повторного создания (было InboundLead.external_id)
```

`queue_status` можно не хранить отдельно, а **вычислять** из `status` + системной
стадии + `remind_at`, но отдельное индексируемое поле проще для фильтров и
счётчиков. Выбор реализации за бэком; контракт API ниже — обязателен.

## 3. Контракт API (то, на что фронт переключится)

### 3.1. Список — `GET /consalting/leads/`

Добавить параметры (в дополнение к текущим воронки):

| Параметр | Поведение |
|---|---|
| `queue` | `new` (⇒ `queue_status in (new,assigned)`), `in_work`, `deferred`, `converted`, `rejected`, `all` |
| `status` | как раньше на inbound: список через запятую → `queue_status__in` |
| `owner` | uuid \| `none` (`owner__isnull=True`) |
| `channel` | whatsapp / instagram / telegram / manual / … |
| `region` | код региона (см. [12](./12-regional-supervisor-rbac.md)); скоуп supervisor — принудительный |
| `search` | icontains по `title`, `full_name`, `phone`, `description` |
| `date_from` / `date_to` | по `created_at`, включительно, TZ компании |
| `overdue` | `true` → `queue_status=deferred AND remind_at <= now()` |
| `funnel` | как сейчас; на странице «Лиды» **не передаётся** (все воронки в скоупе прав) |
| `page`, `page_size`, `ordering` | по умолчанию `-created_at` |

Элемент — обычный сериализатор `Lead` + поля из §2.1 (`queue_status`,
`queue_status_display`, `channel`, `remind_at`, `defer_reason(_display)`,
`defer_count`, `is_overdue`, `region_code`, `region_label`, `funnel`, `stage`).

**Текст обращения / комментарий.** Элемент списка обязан нести текст первого
обращения или комментарий менеджера — в поле **`message`** (совместимость с
текущим фронтом) **или** `description`. Сейчас лиды из веб-формы («Сайт») и
части интеграций приходят с пустым `message`, и в списке
(`leads/LeadsInbox.jsx`) показывается «Нет текста сообщения», хотя текст был.
Требуется:

- webhook мессенджера / веб-формы кладёт первый текст в `message`
  (и/или `description`);
- окно «Новый лид» уже шлёт `message` — сохранять как есть;
- в сериализаторе списка отдавать `message` **и** `description` (фронт читает
  `message → comment → description → text → note → last_message`).

**Права** (см. [07](./07-seller-access-isolation.md), [12](./12-regional-supervisor-rbac.md)):
owner/admin/rop — все; supervisor — `region_code ∈ me`; salesperson — `owner=self`.

### 3.2. Счётчики — `GET /consalting/leads/counters/`

Те же фильтры, кроме `queue`/`status`. Ответ:

```jsonc
{ "all": 128, "new": 14, "in_work": 31, "deferred": 22,
  "converted": 47, "rejected": 14, "overdue": 5 }
```

### 3.3. Аналитика — `GET /consalting/leads/analytics/`

Перенести контракт из `inbound-leads/analytics/`
([backend/01-leads.md](../backend/01-leads.md) §1.5) на `leads/analytics/`
(когорта по `Lead.created_at`, `by_channel`, `by_user`, `by_day`,
`defer_reasons`, `reject_reasons`, время до первого ответа).

### 3.4. Действия очереди на `Lead`

| Действие | Эндпоинт | Эффект |
|---|---|---|
| Назначить | `POST /consalting/leads/{id}/assign/ { owner }` (уже есть) | `owner`, `queue_status=assigned` |
| Отложить | `POST /consalting/leads/{id}/defer/ { remind_at, reason, comment? }` **(новое)** | `queue_status=deferred`, `deferred_at`, `defer_count+=1` |
| Вернуть | `POST /consalting/leads/{id}/resume/` **(новое)** | `queue_status=in_work`, `remind_at=null` |
| Купил | `POST /consalting/leads/{id}/win/` (есть) | `status=won`, `queue_status=converted`, `converted_at`, `closed_at` |
| Отказ | `POST /consalting/leads/{id}/lose/ { reason, comment? }` (есть, добавить reason) | `status=lost`, `queue_status=rejected`, `closed_at` |

Первый исходящий ответ менеджера → `first_reply_at` (один раз) и
`queue_status: new/assigned → in_work`.

### 3.5. Создание

Единственный путь — `POST /consalting/leads/` (и окно «Новый лид» на «Лидах»,
и «+ Добавить лид» в воронке шлют сюда). Поля: как сейчас + `channel` (дефолт
`manual`), `queue_status` (дефолт `new`), опц. `inbound_external_id`.
Webhook мессенджера создаёт `Lead` (1A/региональная маршрутизация) **и**
`InboundLead(lead_id=…)` как журнал.

`POST /consalting/inbound-leads/` — оставить только для обратной совместимости:
внутри создаёт `Lead` и возвращает его; в новом UI не вызывается.

## 4. Миграция данных

1. Для каждого `InboundLead` **без** `lead_id` — создать `Lead` на `is_main`
   (стадия `intake`), перенести поля:

   | InboundLead | Lead |
   |---|---|
   | `full_name`, `phone`, `email` | те же |
   | `source` | `channel` |
   | `message` | `description` (если пусто) |
   | `status` | `queue_status` (`converted`→ также `status=won`, `rejected`→`lost`) |
   | `owner`, `created_at` | те же |
   | `remind_at`, `defer_*`, `reject_*`, `first_reply_at`, `converted_at`, `closed_at` | те же |
   | `external_id` | `inbound_external_id` |
   | `sale` | связать со сделкой если есть |

2. Проставить `InboundLead.lead_id` у всех записей.
3. Для `Lead` без `queue_status` — вывести: `won→converted`, `lost→rejected`,
   стадия `intake`/order 0 → `new`, есть `owner` → `assigned`, иначе `new`;
   первое исходящее было → `in_work`.
4. Дедуп: если для одного `phone`+`company` оказалось несколько открытых
   `Lead` из-за прошлых фолбэков — оставить старейший, остальные закрыть
   `rejected` c пометкой `merged`.

## 5. Что делает фронт

> Фронтовый слой абстрагирован: список «Лиды» ходит в `/consalting/leads/`
> с параметрами §3.1, а при `404`/отсутствии `queue_status` в ответе —
> **фолбэк на `/consalting/inbound-leads/`** (текущее поведение). Так страница
> переключается на единую модель автоматически после деплоя бэка.

Изменения:

- `api/consultingLeads.js`: `listInboundLeads` → обёртка, которая пробует
  `GET /consalting/leads/?queue=…` и мапит ответ; действия
  (`assign/defer/resume/won/lost`) — на `/consalting/leads/{id}/…` с фолбэком
  на `inbound-leads/{id}/…`.
- `LeadsInbox.jsx`: нормализованная форма лида (уже есть маппинг
  `full_name/name`, `region_code/region`) — добавить `queue_status`→таб,
  `channel`→иконку источника, `funnel_lead_id` = сам `id`.
- Окно «Новый лид» (`CreateLeadModal`): вызывает `POST /consalting/leads/`
  напрямую (через существующий `ensureFunnelLeadForInbound`-путь оставить
  только как фолбэк для старого бэка).
- `Funnel/LeadCreateForm`: **до деплоя §3** — зеркально создаёт `InboundLead`
  (см. §7), чтобы списки совпадали уже сейчас. После §3 зеркало снять.
- Аналитика лидов: `getLeadsAnalytics` → `leads/analytics/` с фолбэком.

## 6. Чек-лист приёмки

- [ ] Лид, созданный в воронке, **сразу** виден на `/crm/consulting/leads`.
- [ ] Лид, созданный на «Лидах», виден в воронке (на `is_main`/регионе).
- [ ] Счётчики табов «Лиды» и число карточек в воронке по тем же фильтрам
      совпадают.
- [ ] `defer` / `resume` работают на `Lead`; `queue_status` и стадия
      согласованы (`converted⇔won`, `rejected⇔lost`).
- [ ] `GET /consalting/leads/?queue=new&region=osh` уважает права supervisor.
- [ ] Аналитика лидов считает когорту по `Lead.created_at`.
- [ ] Webhook создаёт один `Lead` + `InboundLead(lead_id)`; повтор `messageId`
      не плодит.
- [ ] Миграция: у всех `InboundLead` проставлен `lead_id`; нет «осиротевших»
      `InboundLead` в выдаче «Лидов».
- [ ] Старый `POST /inbound-leads/` возвращает созданный `Lead` (совместимость).

## 7. Промежуточный фикс (до §3, на текущем бэке)

`Funnel/LeadCreateForm` после `createLead` дополнительно создаёт связанный
`InboundLead` (`POST /consalting/inbound-leads/` с `full_name/phone/source` и
`external_id = "funnel:<lead_id>"`), затем `PATCH inbound-leads/{id} { lead }`.
Симметрично тому, что `CreateLeadModal` уже делает в обратную сторону
(`ensureFunnelLeadForInbound`). Ошибки не пробрасываются. После §3 обе
«зеркалки» удаляются — остаётся один `POST /consalting/leads/`.
