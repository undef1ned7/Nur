# Консалтинг — бэкенд: главная воронка, inbound, владение (1A / 2A)

**Аудитория:** backend (`apps/consalting`, `/api/consalting/`).  
**Дата решения продукта:** 2026-07-27.  
**Связанный фронт:** IA Лиды / Воронка / Чаты; чекбокс `is_main` в форме воронки.

Это **отдельная спека для бэка**. Обзор для фронта — [whatsapp-overview.md](./whatsapp-overview.md);  
жизненный цикл карточки — [funnel-crm-logic.md](./funnel-crm-logic.md);  
inbound API — [leads-whatsapp.md](./leads-whatsapp.md).

---

## 0. Зафиксированные продуктовые решения

| ID | Решение | Смысл для бэка |
|---|---|---|
| **1A** | WhatsApp / IG / TG inbound → **только главная воронка** | Webhook **не** кладёт карточку на ролевую (SMM и т.п.) |
| **2A** | **Assign / авто-распределение** — основной путь владельца | `owner` ставится сразу; пул (`owner=null`) + `claim` — только если нет владельца или `strategy=manual` |

```text
WhatsApp → webhook
  → InboundLead
  → Lead на Funnel(is_main=True), первая стадия intake
  → auto-assign owner (если strategy ≠ manual)
  → НЕ менять funnel на воронку роли владельца
  → WS: new_message + lead.assigned (персонально) + funnel board update
```

**Отклонённые варианты (не делать):**

- Класть inbound на воронку роли получателя (SMM → воронка SMM).
- Авто-`transfer` на ролевую после assign.
- Делать claim/pool основным путём при включённом RR / least-loaded.

---

## 1. Модель воронок: главная vs ролевая

### 1.1. Поля (обязательный контракт API)

На `Funnel` / сериализаторе списка и детали:

| Поле | Тип | Назначение |
|---|---|---|
| `is_main` | `bool` | Ровно **одна** воронка компании с `true` |
| `funnel_kind` | `str` optional | `"main"` \| `"role"` \| `"custom"` — дубль семантики для фронта |
| `custom_role` | FK Role \| null | Заполнен ⇒ **ролевая** воронка (SMM, …) |
| `is_static` | `bool` optional | Защита от delete/rename (main и role — static) |

Фронт считает главной (`isMainFunnel`):

```text
is_main === true  OR  funnel_kind === "main"  OR  name === "Основная воронка"
```

Ролевой:

```text
custom_role != null
```

### 1.2. Инварианты (компания)

1. **Не больше одной** воронки с `is_main=True` на `company`.
2. Ролевая воронка (`custom_role` задан) **никогда** не бывает `is_main=True`.
3. При создании компании / первой инициализации консалтинга — создать главную
   (имя по умолчанию «Основная воронка», `is_main=True`, системные стадии).
4. Удаление главной — запрещено (`400`/`403`), пока нет другой main
   (или вообще запретить delete main).

### 1.3. API: создать / обновить воронку

`POST /consalting/funnels/`  
`PATCH /consalting/funnels/{id}/`

Тело (релевантное):

```jsonc
{
  "name": "Основная воронка",
  "description": "",
  "is_active": true,
  "is_main": true
  // funnel_kind: "main" — опционально, можно выставлять сервером
}
```

**Серверная логика при `is_main: true`:**

1. В одной транзакции: у всех **других** воронок этой компании
   `UPDATE … SET is_main=False` (и сбросить `funnel_kind` с `"main"`, если используется).
2. Текущей: `is_main=True`, `funnel_kind="main"`.
3. Если у воронки есть `custom_role` — отклонить: `400`
   `{"is_main": ["Ролевая воронка не может быть главной."]}`.

При `is_main: false` на единственной main — либо запретить (`400`:
«Должна остаться одна главная»), либо разрешить только если одновременно
другая воронка становится main в том же запросе (проще — запретить снятие
флага без назначения новой).

`POST /consalting/funnels/for-role/` — только ролевые; **игнорировать** /
отклонять `is_main`.

---

## 2. Webhook inbound → размещение карточки (1A) — критично

Эндпоинт: `POST /consalting/wazzup/webhook/`  
(см. [wazzup-integration.md](./wazzup-integration.md)).

### 2.1. Алгоритм создания карточки Lead

После идемпотентной обработки сообщения:

```text
1. Resolve company from Wazzup account / channel_id
2. main = Funnel.objects.filter(company=…, is_main=True, is_active=True).first()
3. IF main is None:
     - НЕ брать «первую воронку» / «первую ролевую» / SMM
     - Логировать ERROR
     - Ответ: 200 с ack для Wazzup (чтобы не ретраил бесконечно) +
       внутренний алерт / InboundLead без lead  ИЛИ  503 с метрикой
     - Предпочтение продукта: создать InboundLead (status=new, lead=null),
       НЕ создавать Lead на чужой воронке
4. stage = первая стадия main (system_key=intake / order=0 / new_lead)
5. Lead.objects.create(
       funnel=main,
       stage=stage,
       source=whatsapp|instagram|telegram,
       phone=…, full_name=…, status=new,
       owner=null  # пока не отработало распределение
   )
6. InboundLead.lead = Lead
7. Run distribution (см. §3)
```

**Запрещено:**

```text
funnel = company.funnels.order_by("created_at").first()   # ← так лиды уезжали в SMM
funnel = Funnel.objects.filter(custom_role=assignee.role) # ← отклонено (не 1A)
```

### 2.2. Повторные сообщения того же чата

Идемпотентность по `messageId` / `external_id`.  
Если Lead уже есть — **не** менять `funnel` (остаётся на main, даже если
владельца потом перевели на другую воронку вручную — отдельный `transfer`).

### 2.3. Ручное создание inbound

`POST /consalting/inbound-leads/` — та же политика: карточка на `is_main`,
если создаётся параллельный Lead.

---

## 3. Владение: assign primary (2A)

### 3.1. Авто-распределение

Настройки: `GET/PUT /consalting/lead-distribution/`  
`{ enabled, strategy, role_ids }` — `round_robin` | `least_loaded` | `manual`.

| strategy | Поведение после создания Lead на main |
|---|---|
| `round_robin` / `least_loaded` | Выбрать сотрудника из ролей → `Lead.owner` + `InboundLead.owner` + `status=assigned`. **`Lead.funnel` не менять.** |
| `manual` | `owner=null`, `status=new` → виден в **пуле** на main; сотрудники `claim` |

Пул кандидатов: активные сотрудники с `custom_role ∈ role_ids`.  
Пустой пул → оставить без owner (как manual), залогировать warning.

### 3.2. Ручной assign

`POST /consalting/inbound-leads/{id}/assign/` `{ "owner": "<user_id>" }`  
и/или `POST /consalting/leads/{id}/assign/` (воронка):

- Ставит `owner`.
- **Не** переносит на воронку роли владельца.
- Синхронизирует `InboundLead.owner` / `status=assigned`, если связан.
- Персональное уведомление только получателю
  (`lead.assigned` / `consulting.lead.assigned`).
- URL в уведомлении: фронт резолвит в чаты или `/funnel?lead=` —
  в payload обязателен `lead_id` (= id карточки воронки) + `source`.

### 3.3. Claim / release (вторично)

| Действие | Когда допустимо |
|---|---|
| `POST …/leads/{id}/claim/` | Только `owner is null`. Иначе `409`. |
| `POST …/leads/{id}/release/` | Owner или manager → `owner=null` |

При `strategy ∈ {round_robin, least_loaded}` и работающем assign большинство
карточек **сразу с owner** — claim на UI почти не нужен; бэк всё равно
принимает claim для orphan-лидов.

### 3.4. Две сущности статусов (не сливать)

| Сущность | Статусы | Кто источник правды |
|---|---|---|
| `InboundLead` | `new` / `assigned` / `in_work` / `converted` / `rejected` | Очередь «Лиды» |
| `Lead` (воронка) | `new` / `in_work` / `won` / `lost` (+ стадии) | Сделка / канбан |

Связь: `InboundLead.lead_id → Lead.id`.  
Первый исходящий менеджера → `Lead.status=in_work` и желательно
`InboundLead.status=in_work` (см. [media-and-error-handling.md](./media-and-error-handling.md)).

Использовать **`in_work`**, не `in_progress`.

---

## 4. Видимость для assignee с ролью (SMM)

Проблема: сотрудник SMM по умолчанию смотрит **ролевую** доску; карточка на
**main** — «невидима», хотя `owner=он`.

### 4.1. Что обязан бэк

1. Карточка остаётся на main (`funnel_id` = main).
2. В board/list для пользователя с `owner=me` лиды на main **доступны**
   (не фильтровать board API так, чтобы чужие main-лиды чужих owner
   скрывались — ок; **свои** на main — отдавать).
3. Уведомление `lead.assigned` содержит `lead_id` карточки воронки (не только
   inbound id) и `meta.source`.

### 4.2. Что делает фронт (для контекста, не задача бэка)

`filterFunnelsForUser` всегда включает главную воронку для сотрудников с
доступом к воронке — рядом с ролевой. Deep link `/funnel?lead=` открывает
карточку.

Бэку **не** нужно автоматически выдавать полный `funnel_grants` на всю main,
если board уже отдаёт «мои» лиды на main при запросе этой воронки. Если
доступ к board main закрыт на уровне permission — либо разрешить
`GET …/funnels/{main_id}/board/` всем с `can_view_funnel`, либо выдать
implicit view-grant на main при assign (на выбор реализации; предпочтение:
доступ к board main при `can_view_funnel`).

---

## 5. Transfer на другую воронку (явный)

`transfer` / «В другую воронку» — **ручной** продуктовый шаг (например main →
SMM после квалификации).

- Меняет `Lead.funnel` (+ стадия целевой воронки).
- `owner` сохраняется или задаётся явно в payload.
- Inbound `lead` FK тот же.
- Не вызывается из webhook / auto-assign.

---

## 6. Реалтайм после webhook / assign

| Канал | Событие | Кому |
|---|---|---|
| `/ws/wazzup/` | `new_message` | Подписчики компании / чата |
| `/ws/notifications/` | `lead.assigned` / message / SLA | Только целевой user |
| `/ws/consalting/funnel/` | `lead.created` / `lead.updated` | Канбан; payload с `funnel` = **main id** |

Payload карточки обязан содержать `funnel` / `funnel_id`, иначе фронт не
поймёт, на какую доску мержить.

---

## 7. Чек-лист приёмки (бэк)

- [ ] В компании с main + SMM новое WA-сообщение создаёт Lead с `funnel=main`.
- [ ] При выключенной/отсутствующей main **не** создаётся Lead на SMM.
- [ ] Auto-assign ставит `owner`, `funnel` остаётся main.
- [ ] `POST funnels` с `is_main:true` снимает флаг с предыдущей main (одна транзакция).
- [ ] `is_main:true` на ролевой воронке → `400`.
- [ ] `claim` при уже назначенном owner → `409`.
- [ ] `strategy=manual` → `owner=null`, карточка в пуле main.
- [ ] Уведомление assign содержит uuid карточки воронки (`lead_id`).
- [ ] Повтор webhook того же messageId не дублирует Lead и не меняет funnel.
- [ ] Статус в API — `in_work`, не `in_progress`.

---

## 8. Примеры ошибок

```jsonc
// Ролевую сделали главной
{ "is_main": ["Ролевая воронка не может быть главной."] }

// Снимают единственную main без замены
{ "is_main": ["В компании должна остаться одна главная воронка."] }

// Claim уже назначенного
{ "detail": "Лид уже назначен. Используйте assign/transfer." }

// Win без клиента (если так задумано)
{ "detail": "Сначала привяжите или создайте клиента." }
```

---

## 9. Миграция существующих данных

Если в проде WA-лиды уже сидят на SMM:

1. Найти/назначить main (`is_main=True`).
2. Опциональный management-команда: перенести **открытые** мессенджер-лиды
   (`source in whatsapp|instagram|telegram`, status not won/lost) на main,
   сохранив `owner` и стадию-аналог (intake / in_progress).
3. Не трогать закрытые / уже перенесённые вручную (флаг или дата cut-off).

---

## 10. Связь с другими спеками

| Тема | Файл |
|---|---|
| Webhook / Wazzup accounts | [wazzup-integration.md](./wazzup-integration.md) |
| Inbound REST + distribution API | [leads-whatsapp.md](./leads-whatsapp.md) |
| Claim / win / сайд-эффекты сделки | [funnel-crm-logic.md](./funnel-crm-logic.md) |
| Цены по роли воронки | [services-role-pricing.md](./services-role-pricing.md) |
| Персональные уведомления | [realtime-notifications.md](./realtime-notifications.md) |
| Обзор для фронта | [whatsapp-overview.md](./whatsapp-overview.md) |

---

*Документ — источник истины для бэкенд-задач по размещению inbound и владению.
При расхождении с краткими обзорами приоритет у этого файла (раздел 0–3).*
