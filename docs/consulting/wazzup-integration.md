# Консалтинг — интеграция Wazzup API v3

**Источник контракта:** backend `apps/consalting` (+ параллельный `apps/crm`).  
**Фронт:** «Лиды» → **Интеграция** (`/crm/consulting/leads`),  
карточка лида → **Мессенджер**.  
**API-слой:** `src/api/consultingWazzup.js`.

Связанные спеки: [leads-whatsapp.md](./leads-whatsapp.md),
[realtime-notifications.md](./realtime-notifications.md).

## Важно: два модуля

| Модуль | Аккаунты | Webhook |
|---|---|---|
| **Консалтинг** (эта страница) | `/api/consalting/wazzup-accounts/` | `/api/consalting/wazzup/webhook/` |
| Общий CRM | `/api/crm/wazzup-accounts/` | `/api/crm/wazzup/webhook/` |

Фронт консалтинга ходит **только** в `/consalting/…`.

## 1. Откуда взять Channel ID

```bash
curl -s -H "Authorization: Bearer <API_KEY>" \
  https://api.wazzup24.com/v3/channels
```

Пример ответа:

```json
[{
  "channelId": "ae07aa7e-717f-4765-8798-c26ea4b3c7b7",
  "transport": "whatsapp",
  "state": "active",
  "plainId": "996556900556",
  "name": "996556900556"
}]
```

В NurCRM:

| Поле Wazzup | Поле CRM |
|---|---|
| `channelId` | `channel_id` |
| `transport` | `integration_type` (`whatsapp` / `instagram` / `telegram`) |
| `plainId` / `name` | только для отображения, **не** channel_id |

## 2. Подключение (2 шага)

### Шаг 1 — сохранить ключи

`POST /api/consalting/wazzup-accounts/`  
`Authorization: Bearer <JWT>`

```json
{
  "api_key": "ваш_api_ключ_из_wazzup24",
  "channel_id": "ae07aa7e-717f-4765-8798-c26ea4b3c7b7",
  "integration_type": "whatsapp"
}
```

### Шаг 2 — привязать webhook

`POST /api/consalting/wazzup-accounts/{ACCOUNT_ID}/setup-webhook/`  
`Authorization: Bearer <JWT>`

```json
{
  "webhook_url": "https://app.nurcrm.kg/api/consalting/wazzup/webhook/"
}
```

Body опционален: если не передан, бэкенд/фронт подставляют стандартный URL
консалтинга. После успеха бэкенд ставит **`is_connected = true`**.

**Важно (Wazzup API v3):** на стороне Wazzup вебхук задаётся только через
`PATCH https://api.wazzup24.com/v3/webhooks` (есть ещё GET/DELETE).  
`POST /v3/webhooks` у Wazzup **нет** → ответ `404 Not Found`. NurCRM при
`setup-webhook` обязан слать в Wazzup именно PATCH:

```http
PATCH /v3/webhooks HTTP/1.1
Host: api.wazzup24.com
Authorization: Bearer <API_KEY>
Content-Type: application/json

{
  "webhooksUri": "https://app.nurcrm.kg/api/consalting/wazzup/webhook/",
  "subscriptions": { "messagesAndStatuses": true }
}
```

Если аккаунт уже создан (`is_connected: false`), повторно POST аккаунт не
нужен — достаточно снова нажать «Зарегистрировать Webhook».

На фронте кнопка «Сохранить и зарегистрировать Webhook» делает оба шага подряд;
кнопка в списке — только шаг 2.

### Альтернатива

Django Admin → Wazzup аккаунты (`apps/consalting` или `apps/crm`).

## 3. Архитектура входящих

```text
WhatsApp/IG/TG → Wazzup → POST /api/consalting/wazzup/webhook/
  → InboundLead + карточка воронки + WS (company / user lead.assigned)
```

## 4. REST (консалтинг)

### GET — список и карточка аккаунта

`GET /api/consalting/wazzup-accounts/` — все аккаунты компании.  
`GET /api/consalting/wazzup-accounts/{id}/` — один аккаунт.

Пример элемента списка:

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
  "company": 1,
  "branch": null,
  "api_key": "ebf1234567890abcdef...",
  "api_url": "https://api.wazzup24.com",
  "channel_id": "c_1029384",
  "integration_type": "whatsapp",
  "integration_type_display": "WhatsApp",
  "is_active": true,
  "is_connected": true,
  "created_at": "2026-07-26T20:00:00.000000Z",
  "updated_at": "2026-07-26T20:05:00.000000Z"
}
```

Фронт: `listWazzupAccounts()` / `getWazzupAccount(id)` в
`src/api/consultingWazzup.js`; таблица на вкладке «Интеграция» читает
`integration_type_display`, `is_connected`, `is_active`, `api_key`, `api_url`,
`updated_at`.

| Метод | URL | UI |
|---|---|---|
| `GET` | `/consalting/wazzup-accounts/` | Интеграция (список) |
| `GET` | `/consalting/wazzup-accounts/{id}/` | API (деталь) |
| `POST` | `/consalting/wazzup/webhook/` | Wazzup (public) |
| `POST` | `/consalting/wazzup-accounts/` | Интеграция (шаг 1) |
| `DELETE` | `/consalting/wazzup-accounts/{id}/` | Интеграция |
| `POST` | `/consalting/wazzup-accounts/{id}/setup-webhook/` | Интеграция (шаг 2) |
| `POST` | `/consalting/wazzup-accounts/{id}/send-message/` | Мессенджер |
| `GET` | `/consalting/inbound-leads/` | Входящие |
| `POST` | `/consalting/inbound-leads/{id}/assign/` | Назначить |
| `GET/PUT` | `/consalting/lead-distribution/` | Распределение |

### send-message и чат

```json
{
  "lead_id": "uuid-карточки-лида-воронки",
  "message": "Здравствуйте! Мы получили вашу заявку.",
  "media_url": "https://example.com/file.pdf"
}
```

`lead_id` — id карточки воронки (LeadConsalting), не inbound-lead.

**UI чата:** вкладка «Чат» в карточке лида (`LeadMessengerPanel`).

| Направление | Поведение |
|---|---|
| Входящие | Webhook → бэкенд создаёт контакт/лид → WS → пузырь в чате |
| Исходящие | `POST …/send-message/` из композера чата |
| Статусы | `pending` → `sent` → `delivered` → `read` (галочки как в WhatsApp) |

История: `GET /consalting/leads/{id}/messages/` (и запасные пути
`wazzup-messages` / `whatsapp-messages` / `messages`). При 404 UI работает на
realtime + исходящих.

Чат: сокет **`/ws/wazzup/?token=`** — `new_message` / `message_status`.
См. [wazzup-frontend.md](./wazzup-frontend.md).

### Чек-лист «чат заработает прямо сейчас»

1. Wazzup24 → канал WhatsApp + QR («Связанные устройства»).
2. Лиды → Интеграция → API Key + Channel ID.
3. «Зарегистрировать Webhook» (`POST …/setup-webhook/`).
4. Воронка → карточка лида → **Чат**.

## 5. Реалтайм

- Чат: `/ws/wazzup/?token=` (`new_message`, `message_status`)
- Канбан: `/ws/consalting/funnel/`
- Персонально: `lead.assigned` / `consulting.lead.assigned` через
  `/ws/notifications/` (`useNotificationsSocket`)

## 6. Graceful fallback

`404/501` → заглушка в UI, CRM не падает.
