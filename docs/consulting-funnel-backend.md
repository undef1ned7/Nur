# Консалтинг: воронки продаж — документация для бэкенда

Единый контракт для бэкенда по воронкам консалтинга: роли, доступы, мульти-воронка на
одной странице, drag-and-drop и передача лида между воронками.

Фронтенд уже реализует описанный контракт (с fallback, если эндпоинты ещё не задеплоены).

**Базовый префикс API:** `/api/consalting/`  
**Авторизация:** `Authorization: Bearer <token>`  
**WebSocket:** `/ws/consalting/funnel/?token=...` (см. также `docs/message.txt`)

---

## 1. Бизнес-логика

### 1.1. Воронка на кастомную роль

При создании **кастомной роли** сотрудника (`POST /users/roles/custom/`) для компании
сектора **Консалтинг** должна автоматически создаваться **отдельная воронка продаж**,
привязанная к этой роли.

- Один `CustomRole` → одна воронка (`Funnel.custom_role` FK, unique per company).
- Название по умолчанию: `{имя роли}` (без префикса «Воронка:»).
- При удалении роли — политика на выбор: soft-delete воронки или запрет удаления,
  пока есть лиды (рекомендуется soft-delete + `is_active=false`).

**Рекомендуемый способ (серверный):** сигнал/post_save на `CustomRole` вызывает
сервис `provision_funnel_for_role(role)`.

**Альтернатива (явный API):** фронт вызывает `POST /api/consalting/funnels/for-role/`
сразу после создания роли (см. раздел 3.1).

### 1.2. Системные стадии (обязательные, неизменяемые)

Каждая воронка роли при создании получает **ровно 3 системные стадии**.
Их **нельзя удалять, переименовывать, менять порядок или тип** через обычный API
(только суперюзер / миграции).

| `system_key`   | Название (RU)   | `order` | `stage_type` | `is_final` | `is_success` | Цвет    |
|----------------|-----------------|---------|--------------|------------|--------------|---------|
| `intake`       | Новые заявки    | 0       | `new_lead`   | false      | false        | #3b82f6 |
| `in_progress`  | В работе        | 1       | `nurture`    | false      | false        | #f59e0b |
| `completed`    | Завершено       | 2       | `won`        | true       | true         | #16a34a |

Поля стадии:

```json
{
  "is_system": true,
  "system_key": "intake|in_progress|completed",
  "name": "Новые заявки",
  "order": 0,
  "color": "#3b82f6",
  "stage_type": "new_lead",
  "is_final": false,
  "is_success": false
}
```

Дополнительные стадии между системными может добавлять **только** владелец/админ
(`role in (owner, admin)`). Системные стадии остаются на местах 0 и 2 (начало и конец),
новые — с `order` между 0 и 2 или после `in_progress`.

**Валидация API:**

- `PATCH/DELETE /consalting/funnel-stages/{id}/` → `403`, если `stage.is_system=true`.
- `PATCH/DELETE /consalting/funnels/{id}/` → `403`, если воронка **защищённая** (см. 1.3).

### 1.3. Типы воронок и что можно менять

| Тип | Поля | Создание | PATCH метаданных | DELETE |
|-----|------|----------|------------------|--------|
| **Основная** | `is_main=true` или `funnel_kind=main` | При онбординге компании (одна на компанию) | **Запрещено** | **Запрещено** |
| **Роль** | `custom_role != null` | Авто при создании роли | **Запрещено** | **Запрещено** |
| **Пользовательская** | `custom_role=null`, `is_main=false` | Owner/admin через UI | Owner/admin | Owner/admin |

Имя основной воронки по умолчанию: **«Основная воронка»**.

Owner/admin **могут**:
- создавать пользовательские воронки (`POST /funnels/` без `custom_role`, `is_main=false`);
- добавлять несистемные стадии в любую воронку (включая основную и ролевые);
- редактировать/удалять **только пользовательские** воронки.

Owner/admin **не могут**:
- удалить или переименовать основную воронку;
- удалить или переименовать воронку роли;
- удалить/изменить системные стадии (`is_system=true`).

### 1.4. Кто видит какие воронки

| Пользователь | Воронки на доске |
|--------------|------------------|
| `owner`, `admin` | **Все** воронки компании |
| Сотрудник с `custom_role = R` | Воронка роли `R` + воронки из `funnel_grants` |
| Сотрудник без `custom_role` | Основная воронка + `funnel_grants` |

`GET /consalting/funnels/` и `GET .../board/` фильтруют список на сервере.

### 1.5. Дополнительный доступ сотрудника к другим воронкам

На модели сотрудника — массив **`funnel_grants`** (M2M через through или JSONField):

```json
"funnel_grants": [
  {
    "funnel_id": "uuid-воронки",
    "can_manage_leads": true,
    "can_manage_stages": false
  }
]
```

- Запись в массиве = **право просмотра** воронки.
- `can_manage_leads: true` = создание/редактирование лидов и перемещение по стадиям **в этой** воронке.
- `can_manage_stages: true` = создание, изменение и удаление **несистемных** стадий **в этой** воронке.
- Воронка роли сотрудника **не дублируется** в grants — доступ к ней определяется `custom_role` + флагами `can_view_funnel`, `can_manage_funnel_leads`, `can_manage_funnel_stages`.

**PATCH** `/api/users/employees/{id}/`:

```json
{
  "can_view_funnel": true,
  "can_manage_funnel_leads": true,
  "can_manage_funnel_stages": true,
  "funnel_grants": [
    {
      "funnel_id": "uuid-основной-воронки",
      "can_manage_leads": false,
      "can_manage_stages": true
    },
    {
      "funnel_id": "uuid-другой-роли",
      "can_manage_leads": true,
      "can_manage_stages": false
    }
  ]
}
```

Проверка доступа к воронке `F`:

```
visible(F) =
  user is owner/admin
  OR (user.custom_role AND funnel.custom_role == user.custom_role)
  OR funnel.id IN funnel_grants[].funnel_id
  OR (NOT user.custom_role AND funnel.is_main)

manage_leads(F) =
  user is owner/admin
  OR (can_manage_funnel_leads AND funnel.custom_role == user.custom_role)
  OR EXISTS grant FOR funnel.id WITH can_manage_leads=true

manage_stages(F) =
  user is owner/admin
  OR (can_manage_funnel_stages AND funnel.custom_role == user.custom_role)
  OR EXISTS grant FOR funnel.id WITH can_manage_stages=true
```

### 1.6. Права на лиды и стадии (глобальные флаги)

| Поле | Описание |
|------|----------|
| `can_view_funnel` | Пункт меню и страница воронки (минимум read). |
| `can_manage_funnel_leads` | Управление лидами в **воронке своей роли** (без отдельного grant). |
| `can_manage_funnel_stages` | Управление несистемными стадиями в **воронке своей роли** (без отдельного grant). |

**Обратная совместимость:** если `can_view_funnel` нет в profile → фронт использует `can_view_sale`.

Проверки на бэкенде для сотрудника:

| Действие | Условие |
|----------|---------|
| `POST /leads/` | `manage_leads(funnel)` |
| `POST /leads/{id}/move-stage/` | `manage_leads(funnel)` + allowed transitions |
| `PATCH /leads/{id}/` | `manage_leads(funnel)` + visibility rules (pool/owner) |
| `POST /leads/{id}/claim/` | `manage_leads(funnel)` |
| `POST /leads/{id}/assign/` | только owner/admin |
| `POST /leads/{id}/transfer/` | `manage_leads` на исходной **и** целевой воронке |
| `POST /funnel-stages/` | `manage_stages(funnel)` |
| `PATCH /funnel-stages/{id}/` | `manage_stages(funnel)` + `stage.is_system=false` |
| `DELETE /funnel-stages/{id}/` | `manage_stages(funnel)` + `stage.is_system=false` |

### 1.7. Мульти-воронка на одной странице

Страница `/crm/consulting/funnel` показывает **все доступные воронки** списком:
каждая строка — отдельный канбан.

**Предпочтительно (один запрос):**

```
GET /api/consalting/funnels/boards/
```

Сервер возвращает доски **только тех воронок**, которые пользователю видны
(`visible(F)` из §1.5). Фронт не обязан передавать id — фильтрация на бэкенде.

**Fallback (пока нет bulk-эндпоинта):** фронт при `404` / `501` делает
`GET /api/consalting/funnels/{funnel_id}/board/` по каждой воронке отдельно.

Список метаданных воронок (без лидов):

```
GET /api/consalting/funnels/
```

Фильтрация на бэкенде в queryset (роль, grants, owner/admin)
и дублируется на фронте (`filterFunnelsForUser`).

### 1.8. Передача лида в другую воронку

1. Пользователь выбирает **целевую воронку** (и опционально **стадию** в ней).
2. Сервер создаёт **новый лид** в целевой воронке, копируя ключевые поля из исходного.
3. Исходный лид **остаётся** в своей воронке без изменений.
4. В ответе — полный объект **созданного** лида (как при `POST /leads/`).
5. В WebSocket рассылается событие `lead.created` для целевой воронки.

Связь между лидами:

```json
{ "source_lead": "<uuid исходного лида>" }
```

Рекомендуется обратная связь на исходном лиде (опционально):

```json
{ "derived_leads": ["<uuid нового лида>"] }
```

**Права передачи:**

| Условие | Проверка |
|---------|----------|
| Исходная воронка | `manage_leads` на воронке исходного лида |
| Целевая воронка | `manage_leads` на **целевой** воронке |
| Лид не закрыт (опционально) | `status not in (won, lost)` — фронт скрывает кнопку для закрытых |

**Стадия в целевой воронке:**

- `target_stage` передан → лид на этой стадии (должна принадлежать `target_funnel`).
- `target_stage` = `null` → первая системная стадия (`system_key=intake`) или `unassigned`.
- `target_stage` из другой воронки → `400`.
- `target_funnel == lead.funnel` → `400`.

**Копируемые поля** (минимум для fallback через `POST /leads/`):

| Поле | Копировать |
|------|------------|
| `title`, `full_name`, `phone`, `email`, `source`, `description` | да |
| `estimated_value`, `probability`, `urgency` | да |
| `source_lead` | да → id исходного |
| `owner` | **нет** (новый лид в пуле) |
| `status` | `new` |
| `funnel` / `stage` | `target_funnel` / `target_stage` или intake |

Задачи, ленту, скоринг — **не** копировать.

**Аудит (рекомендуется):**

```json
{
  "type": "lead_transferred",
  "payload": {
    "from_funnel": "<uuid>",
    "to_funnel": "<uuid>",
    "source_lead_id": "<uuid>",
    "new_lead_id": "<uuid>",
    "actor_id": "<user_id>"
  }
}
```

---

## 2. Изменения моделей (Django, набросок)

### 2.1. `Funnel`

```python
class FunnelKind(models.TextChoices):
    MAIN = "main", "Основная"
    ROLE = "role", "Роль"
    CUSTOM = "custom", "Пользовательская"

class Funnel(models.Model):
    company = models.ForeignKey(Company, ...)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    is_main = models.BooleanField(default=False)
    is_static = models.BooleanField(default=False)  # True для main и role
    funnel_kind = models.CharField(max_length=16, choices=FunnelKind.choices, default=FunnelKind.CUSTOM)
    custom_role = models.ForeignKey(
        "users.CustomRole",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="funnels",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["company", "custom_role"],
                condition=models.Q(custom_role__isnull=False),
                name="uniq_funnel_per_role_per_company",
            ),
            models.UniqueConstraint(
                fields=["company"],
                condition=models.Q(is_main=True),
                name="uniq_main_funnel_per_company",
            ),
        ]

    @property
    def is_protected(self):
        return self.is_main or self.custom_role_id is not None or self.is_static
```

### 2.2. `FunnelStage`

```python
class FunnelStage(models.Model):
    funnel = models.ForeignKey(Funnel, ...)
    name = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)
    color = models.CharField(max_length=7, default="#cbd5e1")
    is_system = models.BooleanField(default=False)
    system_key = models.CharField(
        max_length=32,
        blank=True,
        choices=[("intake", "intake"), ("in_progress", "in_progress"), ("completed", "completed")],
    )
    stage_type = models.CharField(max_length=32, ...)
    is_final = models.BooleanField(default=False)
    is_success = models.BooleanField(default=False)
```

### 2.3. `Lead` — поле передачи

```python
source_lead = models.ForeignKey(
    "self",
    null=True,
    blank=True,
    on_delete=models.SET_NULL,
    related_name="derived_leads",
)
```

### 2.4. Employee permissions и funnel_grants

```python
can_view_funnel = models.BooleanField(default=False)
can_manage_funnel_leads = models.BooleanField(default=False)
can_manage_funnel_stages = models.BooleanField(default=False)

class EmployeeFunnelGrant(models.Model):
    employee = models.ForeignKey(Employee, related_name="funnel_grants")
    funnel = models.ForeignKey(Funnel, on_delete=models.CASCADE)
    can_manage_leads = models.BooleanField(default=False)
    can_manage_stages = models.BooleanField(default=False)

    class Meta:
        unique_together = [("employee", "funnel")]
```

---

## 3. API

### 3.1. Создать воронку для роли (предпочтительно)

```
POST /api/consalting/funnels/for-role/
```

**Тело:**

```json
{
  "custom_role": "uuid-роли",
  "name": "Менеджер",
  "role_name": "Менеджер"
}
```

**Ответ `201`:** объект воронки + вложенные `system_stages` (или сразу готовая доска).

**Логика `provision_funnel_for_role`:**

1. Если воронка для `(company, custom_role)` уже есть — вернуть `200` существующую.
2. Создать `Funnel`.
3. Создать 3 стадии из таблицы (раздел 1.2) с `is_system=True`.
4. Вернуть воронку.

| Код | Когда |
|-----|-------|
| `400` | Роль не из компании пользователя |
| `403` | Нет прав |
| `409` | Воронка для роли уже существует |

### 3.2. Fallback создания воронки (уже используется фронтом при `404/501`)

```
POST /api/consalting/funnels/
{ "name", "description", "is_active", "custom_role": "uuid" }

POST /api/consalting/funnel-stages/  × 3
{ "funnel", "name", "order", "color", "is_system", "system_key", ... }
```

### 3.3. Список воронок и доски

```
GET /api/consalting/funnels/
GET /api/consalting/funnels/boards/          ← предпочтительно для страницы воронки
GET /api/consalting/funnels/{id}/board/      ← одна воронка / fallback
```

- Owner/admin: все воронки компании.
- Сотрудник: только `visible(F)` по правилам из раздела 1.5.

#### 3.3.1. Все доски одним запросом (нужно добавить на бэке)

```
GET /api/consalting/funnels/boards/
```

**Назначение:** отдать канбан **всех доступных** пользователю воронок за один round-trip.
Используется на `/crm/consulting/funnel` при первой загрузке и при полном обновлении.

**Логика:**

1. Определить queryset воронок `visible(F)` для текущего пользователя (та же формула, что для `GET /funnels/`).
2. Для каждой воронки собрать payload **идентичный** `GET /funnels/{id}/board/`.
3. Вернуть словарь `boards` keyed by `funnel_id`.

**Ответ `200 OK` (рекомендуемый формат):**

```json
{
  "boards": {
    "550e8400-e29b-41d4-a716-446655440000": {
      "funnel": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Основная воронка",
        "leads_count": 12
      },
      "columns": [
        {
          "stage": {
            "id": "...",
            "name": "Новые заявки",
            "color": "#3b82f6",
            "order": 0,
            "is_system": true,
            "system_key": "intake"
          },
          "leads": []
        }
      ],
      "unassigned": []
    }
  }
}
```

**Альтернативный формат (тоже поддерживается фронтом):**

```json
{
  "results": [
    {
      "funnel_id": "550e8400-e29b-41d4-a716-446655440000",
      "funnel": { "id": "550e8400-...", "name": "Основная воронка" },
      "columns": [],
      "unassigned": []
    }
  ]
}
```

**Пустой доступ:** `{ "boards": {} }` — не ошибка.

**Производительность:** один queryset воронок + prefetch стадий и лидов (без N+1).

**Fallback на фронте:** при `404` / `501` — параллельные `GET /funnels/{id}/board/` по каждой видимой воронке.

#### 3.3.2. Доска одной воронки

```
GET /api/consalting/funnels/{id}/board/
```

Точечное обновление после действия пользователя и fallback до bulk-эндпоинта.

### 3.4. Изменение и удаление воронки (только пользовательские)

```
PATCH /api/consalting/funnels/{id}/
DELETE /api/consalting/funnels/{id}/
```

Если `funnel.is_protected`:

```json
HTTP 403
{ "detail": "Эту воронку нельзя изменить или удалить." }
```

### 3.5. Защита системных стадий

```
PATCH /api/consalting/funnel-stages/{id}/
DELETE /api/consalting/funnel-stages/{id}/
```

Если `stage.is_system` → `403`.

### 3.6. Создание роли (интеграция)

```
POST /api/users/roles/custom/
{ "name": "Менеджер по сделкам" }
```

**Рекомендация:** в том же transaction/on_commit вызвать `provision_funnel_for_role`.

### 3.7. Доступы сотрудника

```
PATCH /api/users/employees/{id}/
{
  "can_view_funnel": true,
  "can_manage_funnel_leads": true,
  "can_manage_funnel_stages": true,
  "funnel_grants": [
    {
      "funnel_id": "uuid",
      "can_manage_leads": false,
      "can_manage_stages": true
    }
  ]
}
```

### 3.8. Передача лида (предпочтительный эндпоинт)

```
POST /api/consalting/leads/{id}/transfer/
```

**Тело:**

```json
{
  "target_funnel": "550e8400-e29b-41d4-a716-446655440000",
  "target_stage": "660e8400-e29b-41d4-a716-446655440001"
}
```

`target_stage` — опционально (`null` допустим).

**Успех `201 Created`:** полный объект созданного лида с `source_lead`.

| Код | Когда |
|-----|-------|
| `400` | Невалидная воронка/стадия, та же воронка, закрытый лид |
| `403` | Нет `manage_leads` на исходной или целевой воронке |
| `404` | Лид или воронка не найдены |

### 3.9. Fallback передачи (пока нет `/transfer/`)

Фронт при `404` / `501` на `/transfer/`:

1. `GET /api/consalting/leads/{id}/`
2. `POST /api/consalting/leads/` с `source_lead`, `funnel`, `stage` и копируемыми полями.

---

## 4. WebSocket

Подключение **без привязки к одной воронке**. События фильтруются на клиенте
по `data.funnel` ∈ множеству видимых воронок пользователя.

При фильтрации на сервере:

- Сотрудник с `custom_role=R` — события по воронке роли `R` + `funnel_grants`.
- Owner/admin — по всем воронкам компании.
- `is_manager=true` в `connection_established` — для `owner`/`admin`.

После передачи лида:

```json
{
  "type": "lead.created",
  "data": {
    "id": "<new_lead_id>",
    "funnel": "<target_funnel>",
    "stage": "<target_stage>",
    "title": "...",
    "source_lead": "<source_lead_id>"
  }
}
```

Исходный лид **не** удаляется — `lead.removed` для исходной воронки нет.

---

## 5. `can_manage_funnel_leads` и drag-and-drop

### Симптомы

1. Владелец включает **«Управление лидами воронки»**, PATCH уходит с `"can_manage_funnel_leads": true`, но после повторного открытия модалки галочка снята.
2. Сотрудник видит воронку, но **не перетаскивает** карточки (`move-stage` → `403`).

### Корневая причина (типичная)

Фронт проверяет права по **`GET /api/users/profile/`**, а не по employee detail.  
Если поле сохраняется на Employee, но **не попадает в profile** — drag отключён.

### Обязательно на бэкенде

#### 5.1. `PATCH /api/users/employees/{id}/`

Writable: `can_view_funnel`, `can_manage_funnel_leads`, `can_manage_funnel_stages`, `funnel_grants`.  
Partial PATCH не должен обнулять другие `can_*`, если они не переданы.

#### 5.2. `GET /api/users/employees/{id}/`

Возвращать сохранённые `can_view_funnel`, `can_manage_funnel_leads`, `can_manage_funnel_stages`, `funnel_grants`, `custom_role`.

#### 5.3. `GET /api/users/profile/` (критично)

```json
{
  "custom_role": "uuid-роли",
  "can_view_funnel": true,
  "can_manage_funnel_leads": true,
  "can_manage_funnel_stages": true,
  "funnel_grants": [
    {
      "funnel_id": "uuid",
      "can_manage_leads": true,
      "can_manage_stages": false
    }
  ]
}
```

#### 5.4. `POST/PATCH/DELETE /api/consalting/funnel-stages/`

Проверка `manage_stages(funnel)` — формула из §1.5. Системные стадии (`is_system=true`) → `403`.

#### 5.5. `POST /api/consalting/leads/{id}/move-stage/`

Проверка `manage_leads(funnel)` — формула из §1.5. При отказе — `403` с `detail`.

#### 5.6. Сопоставление ролей

`user.custom_role` и `funnel.custom_role` — один uuid (строка).

### Логика прав

| Сценарий | Что нужно |
|----------|-----------|
| Своя воронка роли | `can_manage_funnel_leads: true` + совпадение `custom_role` |
| Другая воронка (лиды) | `funnel_grants` с `can_manage_leads: true` |
| Своя воронка роли (стадии) | `can_manage_funnel_stages: true` + совпадение `custom_role` |
| Другая воронка (стадии) | `funnel_grants` с `can_manage_stages: true` |
| Основная воронка | только `funnel_grants` (флаги роли **не** дают прав на main) |

### Чеклист curl

1. PATCH employee → GET employee → `can_manage_funnel_leads: true`.
2. Login сотрудником → GET profile → те же поля.
3. POST move-stage → `200`.
4. Без прав → `403`.

---

## 6. Фронтенд (уже реализовано)

| Файл | Назначение |
|------|------------|
| `src/utils/consultingFunnelDefaults.js` | Стадии, `isProtectedFunnel`, `getFunnelDisplayName` |
| `src/utils/consultingFunnelAccess.js` | `funnel_grants`, `canManageLeadsInFunnel` |
| `src/utils/funnelBoardUtils.js` | Локальное обновление досок (upsert/move/remove) |
| `src/utils/funnelBoardFetch.js` | `GET /funnels/boards/` + fallback на отдельные доски |
| `src/Components/.../EmployeeFunnelGrantsEditor.jsx` | UI выдачи доступов к воронкам |
| `src/Components/Sectors/Consulting/Funnel/Funnel.jsx` | Мульти-воронка, модалки |
| `src/Components/Sectors/Consulting/Funnel/FunnelBoardRow.jsx` | Одна строка = одна воронка |
| `src/Components/Sectors/Consulting/Funnel/LeadTransferModal.jsx` | Передача лида |
| `src/store/creators/funnelThunk.js` | `transferLeadToFunnel`, CRUD воронок/лидов |
| `src/hooks/useFunnelBoardWebSocket.js` | WS по массиву `funnelIds` |

**Поток UI:**

1. **Сотрудники → Создать роль** → воронка роли (статичная).
2. **Сотрудники → Доступы → «Воронки»** — выдача доступа к другим воронкам.
3. **Воронка продаж** — все доступные воронки списком; edit/delete только пользовательских.
4. На карточке и в деталях лида — **⇄ Передать в другую воронку**.

---

## 7. Примеры ответов

### Воронка роли

```json
{
  "id": "f1b2c3d4-....",
  "name": "Менеджер",
  "description": "Воронка продаж для роли «Менеджер»",
  "is_active": true,
  "is_main": false,
  "is_static": true,
  "funnel_kind": "role",
  "custom_role": "a1b2c3d4-....",
  "custom_role_name": "Менеджер",
  "leads_count": 0
}
```

### Доска (фрагмент колонки)

```json
{
  "stage": {
    "id": "...",
    "name": "В работе",
    "color": "#f59e0b",
    "order": 1,
    "is_system": true,
    "system_key": "in_progress",
    "stage_type": "nurture"
  },
  "leads": []
}
```

### Созданный лид при передаче

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "funnel": "550e8400-e29b-41d4-a716-446655440000",
  "stage": "660e8400-e29b-41d4-a716-446655440001",
  "source_lead": "880e8400-e29b-41d4-a716-446655440003",
  "title": "Заявка с сайта",
  "full_name": "Иван Иванов",
  "phone": "+996700000000",
  "status": "new",
  "owner": null,
  "created_at": "2026-06-16T12:00:00Z"
}
```

---

## 8. Чеклист для бэкенда

### Воронки и доступы

- [ ] `Funnel.is_main`, `is_static`, `funnel_kind`
- [ ] `EmployeeFunnelGrant` / `funnel_grants` на employee API
- [ ] `403` на PATCH/DELETE защищённых воронок (main + role)
- [ ] Фильтр `GET /funnels/` по `visible(F)` + grants
- [ ] **`GET /funnels/boards/`** — все доски доступных воронок одним запросом (§3.3.1)
- [ ] `manage_leads(F)` в lead/move-stage endpoints
- [ ] `can_manage_funnel_leads` и `can_manage_funnel_stages` в `GET /profile/` и `GET/PATCH /employees/{id}/`
- [ ] `manage_stages(F)` в funnel-stages endpoints
- [ ] Основная воронка при создании компании (`provision_main_funnel`)
- [ ] WS: события по всем visible воронкам сотрудника

### Передача лида

- [ ] `POST /leads/{id}/transfer/` с валидацией прав и стадии
- [ ] Поле `source_lead` на модели Lead (FK, nullable)
- [ ] `POST /leads/` принимает `source_lead` (fallback)
- [ ] WS `lead.created` с `funnel` и `source_lead`
- [ ] Timeline / audit при передаче (желательно)
- [ ] Запрет `target_funnel == lead.funnel`

### Тесты

- [ ] Нельзя удалить main/role funnel
- [ ] Grant открывает чужую воронку
- [ ] move-stage с `can_manage_funnel_leads` на своей роли
- [ ] transfer создаёт новый лид, исходный не меняется

---

## 9. Участники лида, завершение, архив, услуги

### 9.1. Сотрудники воронки для лида

```
GET /api/consalting/funnels/{funnel_id}/employees/
```

Сотрудники с доступом к воронке `visible(F)` + `manage_leads` или участники роли воронки.

**Создание лида** `POST /api/consalting/leads/`:

```json
{
  "funnel": "uuid",
  "title": "Заявка",
  "participant_ids": ["employee-uuid-1", "employee-uuid-2"],
  "service": "service-uuid",
  "tariff": "tariff-uuid"
}
```

`participant_ids`, `service`, `tariff` — опционально.

**Fallback (уже на фронте):**

```
POST /api/consalting/leads/{id}/participants/
{ "participant_ids": ["uuid"] }
```

Участники могут: просматривать лид, комментировать, перемещать по стадиям (если `manage_leads`).

### 9.2. Услуга и тариф на лиде

Поля на модели `Lead`:

| Поле | Тип | Описание |
|------|-----|----------|
| `service` | FK → Service | опционально |
| `tariff` | FK → ServiceTariff | опционально |

При выборе услуги/тарифа фронт подставляет `estimated_value` по формуле продаж (см. `consultingSalePricing.js`).

### 9.3. Стадия «Завершено» — блокировка и side-effects

При `POST /leads/{id}/move-stage/` на стадию `system_key=completed`:

1. **Права:** сотрудник с `manage_leads` может завершить; после попадания на стадию лид **заблокирован** для PATCH/move (кроме owner/admin).
2. **Автоматически на сервере (обязательно):**
   - запись в **аналитику** сотрудника (ответственный `owner` + `participant_ids`) с суммой `estimated_value`;
   - начисление в **зарплату** по правилам сектора консалтинга;
   - `lead.status = won`, `closed_at = now`.
3. **Ответ move-stage:** обновлённый лид с `status: won`.

**PATCH /leads/{id}/** и **move-stage** для лида на `completed`:

- owner/admin — разрешено;
- остальные — `403`.

### 9.4. Архив

```
POST /api/consalting/leads/{id}/archive/
```

- Доступно для лида на стадии «Завершено» с `manage_leads`.
- Устанавливает `is_archived=true`, `archived_at=now`.
- Лид **исчезает** с канбан-доски (`GET /boards/` не включает архивные).

**Список архива:**

```
GET /api/consalting/leads/archived/
```

Fallback: `GET /api/consalting/leads/?is_archived=true`

**Фильтрация:**

- owner/admin — все архивные лиды компании, **сгруппированные по воронке/роли** на фронте;
- сотрудник — только лиды воронок из `visible(F)`.

**Ответ (фрагмент):**

```json
{
  "results": [
    {
      "id": "uuid",
      "funnel": "funnel-uuid",
      "funnel_name": "Менеджер",
      "title": "Заявка",
      "estimated_value": 50000,
      "owner_display": "Иван И.",
      "archived_at": "2026-06-16T12:00:00Z",
      "is_archived": true
    }
  ]
}
```

### 9.5. Чеклист для бэкенда

- [ ] `GET /funnels/{id}/employees/`
- [ ] `participant_ids` в `POST /leads/` и `POST /leads/{id}/participants/`
- [ ] `service`, `tariff` на Lead
- [ ] Side-effects при move на `completed`: аналитика + зарплата
- [ ] Блокировка PATCH/move для завершённых (кроме owner/admin)
- [ ] `POST /leads/{id}/archive/`, `GET /leads/archived/`
- [ ] `is_archived` исключается из `/boards/`

---

## 10. Абонентка, клиент из лида, оплаты, карточка клиента

### 10.1. Абонентская плата в тарифах услуги

В `tariffs[]` услуги консалтинга (опционально):

```json
{
  "name": "Стандарт",
  "price": "50000.00",
  "subscription_amount": "5000.00",
  "subscription_period": "month"
}
```

`subscription_period`: `"month"` | `"year"`. Если `subscription_amount` не задан или `0` — абонентки нет.

Фронт отправляет эти поля через `normalizeTariffsForApi` при создании/редактировании услуги.

### 10.2. Клиент из лида

```
POST /api/consalting/leads/{id}/create-client/
```

**Тело:**

```json
{
  "full_name": "Иван И.",
  "phone": "+996700000000",
  "email": "ivan@example.com",
  "service": "service-uuid",
  "note": "Из воронки менеджера"
}
```

**Ответ:**

```json
{
  "client": { "id": "uuid", "full_name": "..." },
  "lead": { "id": "uuid", "client": "uuid" }
}
```

Side-effects:
- создаётся запись в `/main/clients/` с `source_lead = lead.id`;
- на лиде `client` / `client_id` заполняется;
- услуга/тариф лида копируются в карточку клиента (если заданы).

Фронт fallback (если endpoint 404): `POST /main/clients/` + `PATCH /leads/{id}/` с `client`.

После создания лида фронт предлагает модалку «Создать клиента»; из карточки лида — кнопка «+ Клиент».

### 10.3. Оплата по лиду

```
POST /api/consalting/leads/{id}/register-payment/
```

**Тело:**

```json
{
  "payment_mode": "cash",
  "amount": "50000.00",
  "debt_months": 6,
  "prepayment": "10000.00",
  "note": "Комментарий"
}
```

`payment_mode`:
- `cash` — наличные (полная оплата, сделка kind=sale);
- `transfer` — перевод (полная оплата, sale + payment_method=transfer);
- `debt` — в долг (kind=debt, auto_schedule);
- `installment` — рассрочка (kind=prepayment + график, `prepayment` — первый платёж).

Требуется привязанный клиент (`lead.client`). Создаётся deal через `/main/clients/{id}/deals/`, на лиде `payment_registered=true`, `payment_mode`.

### 10.4. Завершение лида → аналитика и история клиента

При `move-stage` на системную стадию **completed** (если у лида есть `client`):

1. Создать deal/запись продажи в аналитике консалтинга с `client_id`, `lead_id`, суммой `estimated_value`, услугой/тарифом.
2. Если у тарифа задана `subscription_amount` — создать график абонентских платежей на клиента (`subscription-schedule`).
3. Запись попадает в историю клиента (`GET /clients/{id}/deals/`) и в общую аналитику сектора.

Если оплата уже оформлена через `register-payment` — не дублировать sale-deal, только абонентку (если ещё не создана).

### 10.5. Карточка клиента и график абонентки

```
GET /api/main/clients/{id}/subscription-schedule/
```

**Ответ:**

```json
{
  "items": [
    {
      "period": "2026-06",
      "period_label": "Июн 2026",
      "amount": "5000.00",
      "status": "planned",
      "paid": false,
      "active": true
    }
  ]
}
```

Фронт: маршрут `/crm/consulting/client/:id`, график (recharts BarChart) + таблица периодов + история deals.

Fallback: фильтрация deals с `kind=subscription` или `subscription_amount`.

### 10.6. Чеклист для бэкенда (§10)

- [ ] `subscription_amount`, `subscription_period` в Tariff модели услуги
- [ ] `POST /leads/{id}/create-client/`
- [ ] `client`, `client_id`, `payment_registered`, `payment_mode` на Lead
- [ ] `POST /leads/{id}/register-payment/`
- [ ] Side-effect completed → deal + subscription schedule
- [ ] `GET /clients/{id}/subscription-schedule/`
