# Консалтинг — Лиды из WhatsApp + авто-распределение по ролям

**Страница:** `/crm/consulting/leads` (фронт:
`src/Components/Sectors/Consulting/leads/Leads.jsx`, API-слой
`src/api/consultingLeads.js`).
**Статус:** ⚠️ Бэкенд не реализован. Фронт готов и работает с заглушкой
(`404/501` → «Интеграция с WhatsApp ещё не подключена»).

Реалтайм-уведомления о новом лиде — см.
[realtime-notifications.md](./realtime-notifications.md) (персонально получателю).

## 1. Задача

1. Входящие сообщения из WhatsApp автоматически создают **лид** и попадают в
   список на странице «Лиды».
2. Лид **сразу распределяется** сотруднику по правилам компании: только
   сотрудники с выбранными ролями получают лиды, распределение — **поровну**
   (round-robin) либо по наименьшей загрузке; можно выключить (раздача вручную).
3. Получивший лид сотрудник получает **персональное** уведомление (WS + пуш),
   остальные — нет.

## 2. Модель данных

```python
class InboundLead(models.Model):
    class Status(models.TextChoices):
        NEW = "new"; ASSIGNED = "assigned"; IN_WORK = "in_work"
        CONVERTED = "converted"; REJECTED = "rejected"

    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    full_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    source = models.CharField(max_length=32, default="whatsapp")  # whatsapp|manual|…
    external_id = models.CharField(max_length=128, blank=True)    # id сообщения провайдера (идемпотентность)
    message = models.TextField(blank=True)                        # текст первого сообщения
    owner = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW)
    lead = models.ForeignKey("Lead", null=True, blank=True, on_delete=models.SET_NULL)  # связь с карточкой воронки
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(
            fields=["company", "source", "external_id"],
            condition=~models.Q(external_id=""),
            name="uniq_inbound_external")]   # защита от дублей webhook


class LeadDistributionSettings(models.Model):
    company = models.OneToOneField(Company, on_delete=models.CASCADE,
                                   related_name="lead_distribution")
    enabled = models.BooleanField(default=True)
    strategy = models.CharField(max_length=16, default="round_robin")  # round_robin|least_loaded|manual
    roles = models.ManyToManyField(Role, blank=True)   # роли-получатели
    _rr_cursor = models.IntegerField(default=0)        # указатель round-robin
```

## 3. Эндпоинты

### 3.1. Входящие лиды

| Метод | URL | Назначение |
|---|---|---|
| `GET` | `/consalting/inbound-leads/` | список; params: `status, owner, source, search, page, page_size`; сотрудник видит **только свои** (`owner=me`), owner/admin — все |
| `POST` | `/consalting/inbound-leads/` | ручное создание `{ full_name, phone, source, message }` (тоже проходит авто-распределение) |
| `PATCH` | `/consalting/inbound-leads/{id}/` | смена статуса/полей |
| `POST` | `/consalting/inbound-leads/{id}/assign/` | ручное назначение `{ owner }` (переопределяет авто) |

Элемент списка:

```jsonc
{
  "id": "…", "full_name": "Иван", "phone": "+996700…",
  "source": "whatsapp", "message": "Здравствуйте…",
  "owner": "user-uuid|null", "owner_display": "Менеджер А",
  "status": "assigned", "created_at": "2026-07-23T10:12:00"
}
```

### 3.2. Настройки распределения

| Метод | URL | Назначение |
|---|---|---|
| `GET` | `/consalting/lead-distribution/` | текущие настройки |
| `PUT` | `/consalting/lead-distribution/` | сохранить `{ enabled, strategy, role_ids }` (owner/admin) |

```jsonc
// GET ответ
{
  "enabled": true,
  "strategy": "round_robin",
  "role_ids": ["role-manager-uuid", "role-partner-uuid"],
  "recipients": [   // вычисляется бэком: сотрудники с этими ролями (для сверки)
    { "id": "user-a", "name": "Менеджер А" },
    { "id": "user-b", "name": "Менеджер Б" }
  ]
}
```

## 4. WhatsApp webhook (приём)

```
POST /consalting/integrations/whatsapp/webhook/
```

- Аутентификация webhook — по секрету провайдера (заголовок/подпись), **не** по
  Bearer-токену пользователя.
- Тело зависит от провайдера (Wazzup/Green-API/360dialog). Маппинг → `InboundLead`:
  `external_id` = id сообщения (идемпотентность!), `phone`, `full_name` (имя
  контакта, если есть), `message` = текст, `source="whatsapp"`.
- Повторный webhook с тем же `external_id` в рамках компании — **не** создаёт
  дубль (см. constraint), возвращает `200`.
- После создания — сразу выполнить **авто-распределение** (§5) и разослать
  реалтайм-события (см. realtime-notifications.md).

## 5. Алгоритм авто-распределения

При создании лида (webhook или ручной POST), если `settings.enabled` и
`strategy != "manual"`:

1. **Пул получателей** = активные сотрудники компании, у которых `custom_role`
   входит в `settings.roles`. Если пул пуст — лид остаётся `new`, `owner=null`.
2. Выбор владельца:
   - `round_robin`: сотрудники отсортированы стабильно (по `id`); берём
     `pool[_rr_cursor % len(pool)]`, затем `_rr_cursor += 1` (атомарно, под
     блокировкой строки настроек — чтобы параллельные webhook не дали перекос).
   - `least_loaded`: сотрудник с минимумом **активных** лидов
     (`status in (new, assigned, in_work)`); ничьи → round-robin как tiebreaker.
3. Проставить `owner`, `status="assigned"`.
4. Отправить получателю персональное событие (`lead.assigned`) и пуш.

«Поровну» = равномерность round-robin по времени: за N лидов каждый из K
получателей получит ≈ N/K. Ручное `assign` не сдвигает `_rr_cursor`.

## 6. Права

- Отдельного права `can_view_leads` пока нет — фронт гейтит пункт меню вместе с
  воронкой (`can_view_funnel`). При желании можно ввести `can_view_leads`;
  тогда добавить его в профиль и заменить `permission` в
  `src/Components/Sidebar/config/sectors/consultingMenu.js`.
- Настройки распределения меняют только owner/admin.
