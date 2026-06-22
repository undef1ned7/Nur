# Консалтинг: воронки, роли, доступы, лиды — документация для фронтенда

Полный контракт реализованного бэкенда: воронки по ролям, системные стадии, доступы
сотрудников, мульти-воронка, drag-and-drop, передача лида, участники, услуги/тарифы,
завершение, архив, клиент из лида, оплата и абонентка.

**База API:** `/api/consalting/` · **Авторизация:** `Authorization: Bearer <token>`
**WebSocket:** `wss://<host>/ws/consalting/funnel/?token=<JWT>`

---

## 0. Роли и видимость (как читать права)

- **owner / admin** (`is_manager=true`): видят и управляют **всеми** воронками компании.
- **Сотрудник с `custom_role=R`**: воронка своей роли `R` + воронки из `funnel_grants`.
- **Сотрудник без `custom_role`**: основная воронка (`is_main`) + `funnel_grants`.

Формулы (так считает бэкенд, фронт дублирует для UI):
```
visible(F)      = owner/admin
                  OR funnel.custom_role == user.custom_role
                  OR F.id ∈ funnel_grants
                  OR (нет custom_role AND F.is_main)
manage_leads(F) = owner/admin
                  OR (can_manage_funnel_leads AND F.custom_role == user.custom_role)
                  OR grant(F).can_manage_leads
manage_stages(F)= owner/admin
                  OR (can_manage_funnel_stages AND F.custom_role == user.custom_role)
                  OR grant(F).can_manage_stages
```
Главная воронка флагами роли **не** управляется — только через `funnel_grants`.

---

## 1. Воронки

### Объект воронки
```json
{
  "id": "uuid",
  "name": "Менеджер",
  "description": "...",
  "is_active": true,
  "funnel_kind": "main|role|custom",
  "is_main": false,
  "is_static": true,
  "is_protected": true,
  "custom_role": "role-uuid|null",
  "custom_role_name": "Менеджер|null",
  "stages": [ /* см. §2 */ ],
  "leads_count": 0,
  "created_at": "...", "updated_at": "..."
}
```
`is_protected = is_main || custom_role || is_static` — такую воронку нельзя изменять/удалять.

### Эндпоинты
```
GET    /api/consalting/funnels/                 # список видимых воронок
POST   /api/consalting/funnels/                 # создать (только owner/admin)
GET    /api/consalting/funnels/{id}/
PATCH  /api/consalting/funnels/{id}/            # 403 если is_protected / не owner-admin
DELETE /api/consalting/funnels/{id}/            # 403 если is_protected / не owner-admin
POST   /api/consalting/funnels/for-role/        # воронка роли (идемпотентно)
```

**Создать воронку роли** — `POST /funnels/for-role/`:
```json
{ "custom_role": "role-uuid", "name": "Менеджер" }
```
- `201` — создана; `200` — уже существовала (возвращает существующую).
- `400` роль не из компании · `403` не owner/admin.
- Воронка роли создаётся также **автоматически** при `POST /users/roles/custom/` (бэкенд-сигнал) — отдельный вызов не обязателен, но безопасен (идемпотентен).

**Fallback создания** (если `/for-role/` недоступен): `POST /funnels/` с `custom_role` — тоже идемпотентен (вернёт существующую воронку роли). Создание пользовательской воронки: `POST /funnels/` без `custom_role`.

> При `PATCH/DELETE` защищённой воронки приходит:
> `403 { "detail": "Эту воронку нельзя изменить или удалить." }`

---

## 2. Стадии

### Объект стадии
```json
{
  "id": "uuid", "funnel": "funnel-uuid",
  "name": "В работе", "order": 1, "color": "#f59e0b",
  "stage_type": "nurture",
  "is_system": true, "system_key": "intake|in_progress|completed",
  "is_final": false, "is_success": false,
  "allowed_next": [], "required_fields": [], "sla_hours": null, "allow_skip": false,
  "leads_count": 0
}
```
Системные стадии воронки роли (создаются автоматически):

| system_key | name | order | stage_type | финальная |
|---|---|---|---|---|
| `intake` | Новые заявки | 0 | new_lead | нет |
| `in_progress` | В работе | 1 | nurture | нет |
| `completed` | Завершено | 2 | won | да |

### Эндпоинты
```
GET    /api/consalting/funnel-stages/?funnel={id}
POST   /api/consalting/funnel-stages/            # manage_stages(funnel)
PATCH  /api/consalting/funnel-stages/{id}/       # manage_stages + 403 если is_system
DELETE /api/consalting/funnel-stages/{id}/       # manage_stages + 403 если is_system
```
> Системная стадия на запись → `403 { "detail": "Системную стадию нельзя изменить или удалить." }`
> Создание системной стадии идемпотентно (если `system_key` уже есть в воронке — вернёт `200` существующую).

---

## 3. Доски (канбан)

### Все доски одним запросом (для страницы воронок)
```
GET /api/consalting/funnels/boards/
```
Ответ — доски только видимых воронок (архивные лиды исключены):
```json
{
  "boards": {
    "<funnel_id>": {
      "funnel": { /* объект воронки */ },
      "columns": [
        { "stage": { /* стадия */ }, "leads": [ /* карточки лидов */ ] }
      ],
      "unassigned": [ /* лиды без стадии */ ]
    }
  }
}
```
Пустой доступ → `{ "boards": {} }` (не ошибка).

### Доска одной воронки (точечное обновление / fallback)
```
GET /api/consalting/funnels/{id}/board/
```
`403` если воронка не видна. Формат: `{ "funnel", "columns", "unassigned" }`.

---

## 4. Лиды

### Объект лида (ключевые поля)
```json
{
  "id": "uuid", "funnel": "uuid", "funnel_name": "...",
  "stage": "uuid|null", "stage_name": "...", "stage_color": "...", "stage_type": "...",
  "title": "...", "description": "...",
  "full_name": "...", "phone": "...", "email": "...",
  "source": "...", "estimated_value": "0.00", "probability": 0, "urgency": "low|medium|high",
  "status": "new|in_work|won|lost",
  "owner": "uuid|null", "owner_display": "Имя|null",
  "client": "uuid|null", "client_display": "...",
  "service": "service-uuid|null",
  "tariff": "tariff-uuid|null",
  "participants": [ { "id": "uuid", "display": "Имя" } ],
  "source_lead": "uuid|null",
  "is_archived": false, "archived_at": null,
  "payment_registered": false, "payment_mode": "",
  "score_grade": "A|B|C", "is_at_risk": false,
  "next_action_type": "...", "next_action_date": "...",
  "created_at": "...", "updated_at": "..."
}
```

### CRUD
```
GET    /api/consalting/leads/?funnel=&stage=&owner=&status=&is_archived=&service=&tariff=
POST   /api/consalting/leads/                 # manage_leads(funnel)
GET    /api/consalting/leads/{id}/
PATCH  /api/consalting/leads/{id}/            # manage_leads; завершённый — только owner/admin
DELETE /api/consalting/leads/{id}/
```
**Создание** (`participant_ids`, `service`, `tariff`, `source_lead` — опционально):
```json
{
  "funnel": "uuid",
  "title": "Заявка с сайта",
  "full_name": "Иван", "phone": "+996700000000",
  "service": "service-uuid", "tariff": "tariff-uuid",
  "participant_ids": ["user-uuid-1", "user-uuid-2"],
  "estimated_value": 50000
}
```
> Новый лид создаётся **без владельца** (`owner=null`) — попадает в общий пул и виден всем, у кого `manage_leads`. `owner` назначается через claim/assign.

### Пул и владелец
```
POST /api/consalting/leads/{id}/claim/     # «взять себе» (manage_leads). 409 если уже взят другим
POST /api/consalting/leads/{id}/release/   # вернуть в пул
POST /api/consalting/leads/{id}/assign/    # назначить { "owner": "uuid" } — только owner/admin
```
После claim/assign карточка пропадает у остальных сотрудников (видна владельцу + руководителям).

### Перемещение по стадиям (drag-and-drop)
```
POST /api/consalting/leads/{id}/move-stage/   { "stage": "stage-uuid" }
```
- `manage_leads(funnel)` + правила переходов. Завершённый лид двигает только owner/admin.
- При переходе на `system_key=completed` бэкенд автоматически: `status=won`, `closed_at`, создаёт продажу-аналитику (и фиксирует абонентку из тарифа).
- Доступные переходы для подсветки: `GET /api/consalting/leads/{id}/allowed-transitions/`.

### Участники
```
GET  /api/consalting/funnels/{id}/employees/        # кого можно назначить участником
POST /api/consalting/leads/{id}/participants/        { "participant_ids": ["uuid"] }   # полная замена
```
`/employees/` отдаёт `[{ id, display, email, role, can_manage_leads }]`.

### Передача лида в другую воронку
```
POST /api/consalting/leads/{id}/transfer/
{ "target_funnel": "uuid", "target_stage": "uuid|null" }
```
- Создаёт **новый** лид в целевой воронке (копирует `title/full_name/phone/email/source/description/estimated_value/probability/urgency`, `owner=null`, `status=new`, `source_lead=исходный`). Исходный лид не меняется.
- `target_stage=null` → стадия `intake`. Нужны права `manage_leads` на **обеих** воронках.
- Ошибки: `400` та же воронка / стадия чужой воронки · `403` нет прав · `404` не найдено.
- Ответ `201` — объект созданного лида. В WS летит `lead.created` для целевой воронки.
- **Fallback** (если `/transfer/` 404): `GET /leads/{id}/` → `POST /leads/` с `source_lead`, `funnel`, `stage`.

### Завершение и архив
```
POST /api/consalting/leads/{id}/archive/     # только для лида на стадии completed (manage_leads)
GET  /api/consalting/leads/archived/         # архив (видимость по воронкам/владельцу)
```
- archive → `is_archived=true`, `archived_at`; карточка уходит с досок (в WS — `lead.deleted`).
- Архивный список также доступен фильтром: `GET /leads/?is_archived=true`.

---

## 5. Клиент из лида, оплата, абонентка

### Создать клиента из лида
```
POST /api/consalting/leads/{id}/create-client/
{ "full_name": "...", "phone": "...", "email": "...", "service": "service-uuid?" }
```
Ответ:
```json
{ "client": { "id": "uuid", "full_name": "..." }, "lead": { /* лид с client */ } }
```
Создаёт `main.Client` (копирует услугу, `salesperson = текущий`), привязывает к лиду.
Если у лида уже есть клиент — вернёт его. **Fallback:** `POST /main/clients/` + `PATCH /leads/{id}/ { client }`.

### Оплата по лиду
```
POST /api/consalting/leads/{id}/register-payment/
{ "payment_mode": "cash|transfer|debt|installment",
  "amount": "50000.00", "debt_months": 6, "prepayment": "10000.00", "note": "" }
```
- Нужен привязанный клиент (`create-client` заранее).
- Создаёт сделку в `main`: `cash/transfer → kind=sale`; `debt/installment → kind=debt` с графиком (`prepayment` — первый платёж).
- Ответ `201`: `{ "deal_id": "uuid", "lead": { ...payment_registered=true, payment_mode } }`.
- Ошибки валидации сделки → `400` (например, для рассрочки нужен `debt_months`).
- **Fallback:** напрямую `POST /main/clients/{client_id}/deals/`.

### Абонентская плата (в тарифах услуги)
В тарифе услуги (см. §6) поля `subscription_amount`, `subscription_period` (`month|year`).
При завершении лида с таким тарифом бэкенд фиксирует абонентку в продаже.

### График абонентки клиента
```
GET /api/main/clients/{id}/subscription-schedule/
```
```json
{ "items": [
  { "period": "2026-06", "period_label": "Июн 2026", "amount": "5000.00",
    "status": "planned", "paid": false, "active": true }
] }
```
Считается из consalting-продаж клиента с абонеткой (12 периодов вперёд).

---

## 6. Услуги и тарифы (нужно для лида/оплаты)

```
GET/POST /api/consalting/services/
GET/PATCH/DELETE /api/consalting/services/{id}/
```
Услуга с вложенными тарифами (полная замена при PATCH `tariffs`):
```json
{
  "name": "Монтаж", "price": 0, "installation_price": 3000, "description": "",
  "tariffs": [
    { "name": "Базовый", "price": 12000, "subscription_amount": 0, "subscription_period": "" },
    { "name": "Премиум", "price": 18000, "subscription_amount": 5000, "subscription_period": "month" }
  ]
}
```
Подробный контракт услуг/продаж — в `SERVICES_SALES_FRONTEND.md`.

---

## 7. Доступы сотрудника (выдаёт owner/admin)

```
GET   /api/users/employees/{id}/
PATCH /api/users/employees/{id}/
```
Тело PATCH (partial — не переданные `can_*` не обнуляются):
```json
{
  "can_view_funnel": true,
  "can_manage_funnel_leads": true,
  "can_manage_funnel_stages": true,
  "funnel_grants": [
    { "funnel_id": "uuid", "can_manage_leads": true, "can_manage_stages": false }
  ]
}
```
- `funnel_grants` — **полная замена** набора (присылать весь список). Воронки только своей компании.
- Эти же поля возвращает `GET /api/users/profile/` (критично для проверки прав на фронте — drag-and-drop включается по profile).

`GET /profile/` (фрагмент):
```json
{
  "custom_role": "role-uuid|null",
  "can_view_funnel": true,
  "can_manage_funnel_leads": true,
  "can_manage_funnel_stages": true,
  "funnel_grants": [ { "funnel_id": "uuid", "can_manage_leads": true, "can_manage_stages": false } ]
}
```
> Обратная совместимость: если `can_view_funnel` отсутствует — фронт может опираться на `can_view_sale`.

---

## 8. WebSocket (real-time доски)

```
wss://<host>/ws/consalting/funnel/?token=<JWT>
```
После подключения:
```json
{ "type": "connection_established", "company_id": "...", "user_id": "...", "is_manager": true }
```
Heartbeat: `{ "action": "ping" }` → `{ "type": "pong" }`.

### События `{ "type": <event>, "data": <карточка лида> }`
| event | действие на доске |
|---|---|
| `lead.created` | добавить карточку (по `data.funnel`/`data.stage`) |
| `lead.claimed` | апсерт (взят владельцем) |
| `lead.released` | апсерт (вернулся в пул) |
| `lead.updated` | обновить карточку |
| `lead.stage_changed` | переместить между колонками |
| `lead.deleted` | удалить (в т.ч. при архивации) |
| `lead.removed` | убрать карточку с МОЕЙ доски (взял другой / не видна мне) |
| `lead.assigned` | персональное уведомление «лид назначен вам» |

Особенности:
- События приходят по всем воронкам компании — **фильтруйте по `data.funnel`** ∈ видимым воронкам.
- Сервер сам скрывает чужие/невидимые воронки и взятые чужими лиды (шлёт `lead.removed`).
- Делайте **upsert по `id`** (на одно действие может прийти несколько событий).
- После reconnect перезагрузите доски через `GET /funnels/boards/`.

---

## 9. Сводка кодов ответов

| Код | Когда |
|---|---|
| `403` | нет прав (`manage_leads`/`manage_stages`/owner-admin), защищённая воронка, системная стадия, завершённый лид не для owner/admin |
| `409` | claim лида, который уже взят другим |
| `400` | невалидная стадия/воронка, та же воронка при transfer, нет клиента при оплате, нет `debt_months` для рассрочки |
| `404` | лид/воронка не найдены |

---

## 10. Не реализовано на бэке (нужны правила/решения)

- **Автоначисление зарплаты** при завершении лида — нет формализованных правил сектора (процент/база/деление между owner и participants). Фронту полагаться на это пока нельзя.
- **Факт оплаты периодов абонентки** — в графике все периоды `status=planned`, `paid=false` (отдельный трекинг оплат не ведётся).

Если по этим пунктам появятся правила — бэкенд дополнит без изменения контракта остальных эндпоинтов.
