# Консалтинг — Лиды (Wazzup) + авто-распределение по ролям

**Страница:** `/crm/consulting/leads`  
Фронт: `src/Components/Sectors/Consulting/leads/Leads.jsx`,  
API: `src/api/consultingLeads.js`, `src/api/consultingWazzup.js`.

**Вкладки:**
- **Входящие** — inbox inbound-лидов (WhatsApp / Instagram / Telegram / вручную)
- **Распределение** — round-robin / least-loaded / manual + роли-получатели
- **Интеграция** — аккаунты Wazzup, setup-webhook

Полный контракт провайдера: [wazzup-integration.md](./wazzup-integration.md).  
Реалтайм: [realtime-notifications.md](./realtime-notifications.md).

**Статус фронта:** UI готов. При `404/501` — заглушка «ещё не подключено»,
интерфейс не падает. После деплоя бэка заглушки снимаются сами.

## 1. Задача

1. Входящие сообщения из мессенджеров (Wazzup webhook) создают **InboundLead**
   и попадают во вкладку «Входящие»; параллельно бэкенд создаёт карточку в
   канбане воронки.
2. Лид **сразу распределяется** сотруднику: только роли из настроек;
   стратегия — round-robin / least-loaded / manual.
3. Получатель получает **персональное** уведомление (`lead.assigned` /
   `consulting.lead.assigned`), остальные — нет.
4. Из карточки лида воронки менеджер может **ответить** клиенту
   (`send-message` через выбранный Wazzup-аккаунт).

## 2. Модель данных (ориентир)

```python
class InboundLead(models.Model):
    class Status(models.TextChoices):
        NEW = "new"; ASSIGNED = "assigned"; IN_WORK = "in_work"
        CONVERTED = "converted"; REJECTED = "rejected"

    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    full_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    source = models.CharField(max_length=32, default="whatsapp")
    # whatsapp | instagram | telegram | manual
    external_id = models.CharField(max_length=128, blank=True)  # идемпотентность
    message = models.TextField(blank=True)
    owner = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW)
    lead = models.ForeignKey("Lead", null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)


class LeadDistributionSettings(models.Model):
    company = models.OneToOneField(Company, on_delete=models.CASCADE,
                                   related_name="lead_distribution")
    enabled = models.BooleanField(default=True)
    strategy = models.CharField(max_length=16, default="round_robin")
    # round_robin | least_loaded | manual
    roles = models.ManyToManyField(Role, blank=True)
    _rr_cursor = models.IntegerField(default=0)
```

## 3. Эндпоинты входящих лидов и распределения

| Метод | URL | Назначение |
|---|---|---|
| `GET` | `/consalting/inbound-leads/` | список; params: `status, owner, source, search, page, page_size` |
| `POST` | `/consalting/inbound-leads/` | ручное создание `{ full_name, phone, source, message }` |
| `PATCH` | `/consalting/inbound-leads/{id}/` | смена статуса/полей |
| `POST` | `/consalting/inbound-leads/{id}/assign/` | ручное назначение `{ owner }` |
| `GET` | `/consalting/lead-distribution/` | настройки |
| `PUT` | `/consalting/lead-distribution/` | `{ enabled, strategy, role_ids }` |

Элемент списка:

```jsonc
{
  "id": "…", "full_name": "Иван", "phone": "+996700…",
  "source": "whatsapp", "message": "Здравствуйте…",
  "owner": "user-uuid|null", "owner_display": "Менеджер А",
  "status": "assigned", "created_at": "2026-07-23T10:12:00",
  "lead": "funnel-lead-uuid|null"
}
```

## 4. Webhook (приём) — актуальный путь Wazzup

```
POST /consalting/wazzup/webhook/
```

Публичный endpoint для Wazzup (не Bearer пользователя).  
Регистрация URL: `POST /consalting/wazzup-accounts/{id}/setup-webhook/`.

Идемпотентность по `messageId` / `external_id`. Повтор → `200`, без дубля.
После создания — авто-распределение и персональный WS `lead.assigned`.

> Исторический черновик `/consalting/integrations/whatsapp/webhook/`
> устарел — ориентир только на `/consalting/wazzup/webhook/`.

## 5. Алгоритм авто-распределения

Если `settings.enabled` и `strategy != "manual"`:

1. Пул = активные сотрудники с `custom_role ∈ settings.roles`. Пусто →
   `status=new`, `owner=null`.
2. Выбор:
   - `round_robin` — по кругу с `_rr_cursor` под `select_for_update`
   - `least_loaded` — минимум активных (`new|assigned|in_work`), ничья → RR
3. `owner`, `status=assigned` → персональное событие получателю.

Ручной `assign` курсор round-robin не двигает.

## 6. Права

- Отдельного `can_view_leads` пока нет — пункт меню гейтится
  `can_view_funnel` (`consultingMenu.js`).
- Настройки распределения и подключение Wazzup — owner/admin (бэкенд).
