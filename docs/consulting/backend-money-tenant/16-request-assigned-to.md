# 16. Ответственный по заявке клиента + уведомление сотруднику

**Приоритет:** P2 — распределение работы между продажниками.
**Дата:** 10.09.2026
**Фронт:** `src/Components/Sectors/Consulting/client-requests/client-requests.jsx`
(форма создания/редактирования заявки, карточка, окно просмотра).
**Связано:** [12-regional-supervisor-rbac.md](./12-regional-supervisor-rbac.md)
(supervisor раздаёт лиды/заявки своим сотрудникам),
[07-seller-access-isolation.md](./07-seller-access-isolation.md)
(продажник видит только своё).

> **Референс уже в проде.** Бэк 10.09.2026 выкатил ровно этот механизм для
> `InboundLeadConsalting` (`/consalting/inbound-leads/`): поле `assigned_to`
> + `assigned_to_display`, приём в POST/PATCH, WS-уведомление
> `inbound_lead.assigned` только при смене исполнителя, миграция `0039`.
> Здесь — тот же код, но для другой сущности: **заявки клиента**
> `ConsultingRequest` на эндпоинте `/consalting/requests/` (меню
> «Запросы клиентов», НЕ «Лиды»). Эндпоинт `/consalting/requests/` бэк пока
> не трогал.

---

## 1. Задача

На странице `/crm/consulting/client-requests` в форме заявки появился селект
**«Сотрудник»**. Менеджер/руководитель выбирает ответственного, сохраняет
заявку — выбранный сотрудник получает **WS-уведомление** «Вам назначена
заявка …». Имя ответственного видно на карточке заявки и в окне просмотра.

Поле назначается **вручную** и не связано с авто-распределением лидов.

## 2. Контракт API

```
POST  /consalting/requests/                 — создание заявки
PATCH /consalting/requests/{id}/            — редактирование
GET   /consalting/requests/                 — список
GET   /consalting/requests/{id}/            — деталь
POST  /consalting/requests/{id}/accept/     — НОВОЕ: сотрудник принимает заявку
POST  /consalting/requests/{id}/decline/    — НОВОЕ: сотрудник отказывается (нужна причина)
```

### 2.1. Новое поле в теле запроса (POST/PATCH)

```jsonc
{
  "client": "<uuid клиента>",
  "name": "Консультация по визе",
  "status": "new",
  "description": "…",
  "assigned_to": "<uuid сотрудника>"   // НОВОЕ. null | отсутствует — снять/не трогать
}
```

- `assigned_to` — необязательное, `allow_null=true`.
- Пустую строку фронт не шлёт: либо `uuid`, либо `null`.
- Валидация: сотрудник должен принадлежать **той же компании**. Для роли
  `supervisor` — дополнительно быть в его регионе
  (`consulting_region_codes`), см. [12](./12-regional-supervisor-rbac.md).
  Иначе `400 {"assigned_to": ["Сотрудник недоступен для назначения."]}`.

### 2.2. Новые поля в ответе (list + detail)

```jsonc
{
  "id": "<uuid заявки>",
  "name": "Консультация по визе",
  "status": "new",
  "client": "<uuid>",
  "client_display": "Алия Жумалиева",
  "assigned_to": "<uuid сотрудника> | null",          // НОВОЕ (read+write)
  "assigned_to_display": "Нурбек Асанов | null",       // НОВОЕ (read-only, ФИО или email)
  "acceptance": "pending | accepted | declined | null",// НОВОЕ (read-only)
  "decline_reason": "занят другими заявками | null",   // НОВОЕ (read-only, последний отказ)
  "created_at": "…",
  "updated_at": "…"
}
```

`assigned_to` / `assigned_to_display` обязаны присутствовать **и в списочном**
сериализаторе, не только в detail — карточка списка показывает ответственного.

### 2.3. Фильтр списка

```
GET /consalting/requests/?assigned_to=<uuid>
GET /consalting/requests/?assigned_to=none        — без ответственного
```

Нужен для будущего «Мои заявки» и для выборки по сотруднику у руководителя.

### 2.4. Приёмка / отказ назначенной заявки

Сценарий: менеджер/владелец назначил заявку сотруднику → сотрудник у себя на
`/crm/consulting/client-requests` видит на этой заявке кнопки **«Принять»** и
**«Отказать»** (больше их не видит никто).

**Жизненный цикл `acceptance`:**

| Действие | `acceptance` | `status` | `assigned_to` | Уведомление |
|---|---|---|---|---|
| Назначили сотрудника (POST/PATCH `assigned_to`) | `pending` | как есть (обычно `new`) | сотрудник | сотруднику: `request.assigned` |
| Сотрудник нажал **«Принять»** | `accepted` | → `in_work` | без изменений | владельцу *(SHOULD)*: `request.accepted` |
| Сотрудник нажал **«Отказать»** | `declined` | → `new` | → `null` | владельцу *(MUST)*: `request.declined` c причиной |
| Владелец переназначил после отказа | `pending` | `new` | новый сотрудник | новому: `request.assigned` |

```
POST /consalting/requests/{id}/accept/     тело: {}          → 200 обновлённая заявка
POST /consalting/requests/{id}/decline/    тело: { "reason": "…" }  → 200
```

- Оба доступны **только текущему `assigned_to`** (иначе `403`).
- Доступны только при `acceptance == "pending"` (иначе `409 / 400`).
- `decline` без непустого `reason` → `400 {"reason": ["Обязательное поле."]}`.
- `decline` сбрасывает `assigned_to = null`, пишет `decline_reason`, `status = "new"`.
- Фронт при `404/501` на этих роутах откатывается на `PATCH`
  (`{acceptance, status}` для accept; `{assigned_to:null, acceptance:"declined",
  status:"new", decline_reason}` для decline) — но правильный путь именно
  отдельные экшены, чтобы отработали проверки прав и ушли уведомления.

## 3. Модель

`apps/consalting/models.py` — `ConsultingRequest` (или как называется модель
заявок за `/consalting/requests/`):

```python
assigned_to = models.ForeignKey(
    "users.User",
    null=True, blank=True,
    on_delete=models.SET_NULL,
    related_name="consalting_requests_assigned",
    verbose_name="Ответственный сотрудник",
)
ACCEPTANCE = [("pending", "Ожидает"), ("accepted", "Принята"), ("declined", "Отклонена")]
acceptance = models.CharField(max_length=16, choices=ACCEPTANCE, null=True, blank=True)
decline_reason = models.TextField(blank=True, default="")
```

При установке/смене `assigned_to` в сериализаторе/вьюсете → `acceptance = "pending"`,
`decline_reason = ""`. При `assigned_to = null` → `acceptance = None`.

Миграция — `AddField` × 3 (все nullable / с default, без данных).

## 4. Уведомление

Точно как у `inbound_lead.assigned`, но свой `type`.

```python
def _notify_request_assigned(request_obj):
    user = request_obj.assigned_to
    if not user:
        return
    client_name = getattr(request_obj, "client_display", "") or "клиента"
    payload = {
        "id": str(request_obj.id),
        "title": f"Вам назначена заявка от {client_name}",
        "message": request_obj.name or "Заявка клиента",
        "request_id": str(request_obj.id),
        "client_id": str(request_obj.client_id) if request_obj.client_id else None,
        "url": "/crm/consulting/client-requests",
    }
    notify_user(str(user.id), "request.assigned", payload)
```

Срабатывание:

```python
def perform_create(self, serializer):
    obj = serializer.save(company=self.request.user.company)
    if obj.assigned_to_id:
        _notify_request_assigned(obj)

def perform_update(self, serializer):
    old_assigned = serializer.instance.assigned_to_id
    obj = serializer.save()
    if obj.assigned_to_id and obj.assigned_to_id != old_assigned:
        _notify_request_assigned(obj)   # только при СМЕНЕ — без дублей на каждый PATCH
```

WS-конверт (как у остальных консалтинг-уведомлений):

```jsonc
{
  "type": "consulting.request.assigned",
  "data": {
    "id": "<notif-uuid>",
    "title": "Вам назначена заявка от Алия Жумалиева",
    "message": "Консультация по визе",
    "is_read": false,
    "created_at": "2026-09-10T17:40:00Z",
    "meta": {
      "request_id": "<uuid заявки>",
      "client_id": "<uuid клиента>",
      "url": "/crm/consulting/client-requests"
    }
  }
}
```

Группы рассылки — те же, что для лидов: `consalting_user_<id>` и `user_<id>`.

### 4.1. Уведомления по приёмке / отказу

`accept` → владельцу (`request_obj` до сброса — берём `created_by` / автора
заявки; если поля нет — `company` owner):

```jsonc
{
  "type": "consulting.request.accepted",
  "data": {
    "title": "Нурбек Асанов принял заявку",
    "message": "Консультация по визе",
    "meta": { "request_id": "<uuid>", "url": "/crm/consulting/client-requests" }
  }
}
```

`decline` → владельцу, **причина в `message`**:

```jsonc
{
  "type": "consulting.request.declined",
  "data": {
    "title": "Нурбек Асанов отказался от заявки",
    "message": "Причина: занят другими заявками",
    "meta": {
      "request_id": "<uuid>",
      "decline_reason": "занят другими заявками",
      "url": "/crm/consulting/client-requests"
    }
  }
}
```

## 5. Фронт — что уже сделано

Реализовано в `client-requests.jsx` + `src/api/consultingCatalog.js`
(`acceptConsultingRequest`, `declineConsultingRequest` с PATCH-фолбэком).
Деградирует мягко: пока бэка нет, неизвестные поля DRF игнорирует,
`assigned_to_display` / `acceptance` — `undefined`.

- селект **«Сотрудник»** в форме заявки, список из `GET /users/employees/`;
- `assigned_to` уходит в POST/PATCH (`""` → `null`);
- карточка заявки и окно просмотра показывают `assigned_to_display`
  (фолбэк — имя по `/users/employees/`, иначе «Не назначен»);
- `assigned_to` подставляется в форму при редактировании;
- **если заявка назначена текущему пользователю и `acceptance == "pending"`**
  (или, пока поля нет, `assigned_to == me && status == "new"`) — на карточке
  вместо «Изм./Удалить» показываются **«Принять»** и **«Отказать»**;
  «Принять» → `accept/`; «Отказать» → модалка с обязательной причиной →
  `decline/`;
- метки на карточке: «Вам назначена» (исполнителю) и «Ждёт ответа сотрудника»
  (остальным).

## 6. Осталось на фронте (после бэка)

- Приём WS `consulting.request.assigned` / `.accepted` / `.declined` → тост +
  refresh списка (матчер рядом с `isConsultingLeadAssignEvent`,
  `useConsultingRealtime` на странице заявок).
- Фильтр «Мои заявки» через `?assigned_to=<myId>`.

## 7. Чек-лист приёмки

- [ ] `POST /consalting/requests/` с `assigned_to` — заявка создаётся с
      `acceptance="pending"`, сотрудник получает `consulting.request.assigned`.
- [ ] `PATCH` со сменой `assigned_to` — уведомление новому, старому нет,
      `acceptance` сброшен в `pending`.
- [ ] `PATCH` без смены `assigned_to` — уведомление **не** дублируется.
- [ ] `assigned_to: null` — назначение снимается, `acceptance=null`.
- [ ] `assigned_to` чужой компании / чужого региона (supervisor) → `400`.
- [ ] `GET /consalting/requests/` (list) отдаёт `assigned_to`,
      `assigned_to_display`, `acceptance`, `decline_reason`.
- [ ] `?assigned_to=<uuid>` фильтрует; `?assigned_to=none` — без ответственного.
- [ ] `POST /{id}/accept/` — только текущий `assigned_to`; `acceptance→accepted`,
      `status→in_work`; чужой → `403`; повторный вызов → `409/400`.
- [ ] `POST /{id}/decline/` без `reason` → `400`; с `reason` →
      `assigned_to=null`, `acceptance=declined`, `decline_reason` сохранён,
      `status→new`, владельцу `consulting.request.declined` с причиной.
