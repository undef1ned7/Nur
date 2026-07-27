# WhatsApp / Wazzup в NurCRM (Консалтинг) — полный обзор

Дата: 2026-07-27.  
Сектор: **Консалтинг** (`consulting`). Backend-префикс: `/api/consalting/`  
(в URL осознанно «consalting» — историческое написание бэка).

Этот документ — **единая точка входа**: как устроена интеграция WhatsApp
(и соседних каналов Instagram / Telegram через тот же Wazzup), какие экраны
есть на фронте, какие REST/WS-контракты используются и как сообщение
проходит путь «клиент → CRM → ответ менеджера».

Детальные спеки (контракты, payload’ы, чек-листы):

| Тема | Файл |
|---|---|
| Входящие лиды + авто-распределение | [leads-whatsapp.md](./leads-whatsapp.md) |
| Wazzup API v3, аккаунты, webhook, send-message | [wazzup-integration.md](./wazzup-integration.md) |
| Чат 100% через WebSocket | [wazzup-frontend.md](./wazzup-frontend.md) |
| Медиа, ошибки доставки, `in_work`, перформанс | [media-and-error-handling.md](./media-and-error-handling.md) |
| Персональные уведомления / SLA | [realtime-notifications.md](./realtime-notifications.md) |

---

## 1. Зачем это нужно

Клиенты пишут в **WhatsApp** (также Instagram / Telegram). Сообщения приходят
через провайдера **Wazzup24** (API v3). NurCRM:

1. Создаёт **входящий лид** и карточку на **воронке**.
2. **Назначает** ответственного менеджера (round-robin / least-loaded / вручную).
3. Показывает диалог в **Чатах** и во вкладке «Чат» карточки лида на воронке.
4. Даёт менеджеру **отвечать** в реальном времени (текст + медиа).
5. Шлёт **персональные** уведомления владельцу лида (колокольчик + пуш).

На фронте ключи Wazzup **не вводятся** пользователем CRM: каналы настраивает
админ в Django Admin. UI только показывает статус подключения.

### Роли поверхностей

| Поверхность | Меню | Задача |
|---|---|---|
| **Лиды** | Лиды | Очередь inbound, назначение, распределение, статус каналов |
| **Воронка** | Воронка продаж | Сделка / стадии; чат — контекстная вкладка карточки |
| **Чаты** | Чаты | Ответы клиентам, unread-inbox |

Deep links: Лиды ↔ Чаты ↔ Воронка (`?lead=` на воронке, `/chats/:channel/:leadId`).
Права на отправку в чате единые с воронкой (`canEditLead`); пул — claim CTA.

---

## 2. Большая картина

```text
┌──────────────┐     ┌─────────────┐     ┌──────────────────────────────┐
│  WhatsApp /  │     │  Wazzup24   │     │  NurCRM Backend (Django)     │
│  IG / TG     │────▶│  API v3     │────▶│  POST …/wazzup/webhook/      │
└──────────────┘     └─────────────┘     │  → InboundLead + Lead        │
                                         │  → авто-assign               │
                                         │  → WS new_message / notif    │
                                         └──────────────┬───────────────┘
                                                        │
              ┌─────────────────────────────────────────┼─────────────────┐
              ▼                                         ▼                 ▼
     /ws/wazzup/                              /ws/notifications/   /ws/consalting/funnel/
     (чат: new_message,                       (колокольчик:         (канбан: lead.updated)
      message_status,                          lead_message, assign,
      send_message)                            SLA)
              │
              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  React SPA                                                              │
│  • /crm/consulting/chats/whatsapp[/:leadId]  — inbox + чат              │
│  • /crm/consulting/funnel                    — карточка → вкладка Чат   │
│  • /crm/consulting/leads                     — входящие / распределение │
│                                              / статус каналов           │
└─────────────────────────────────────────────────────────────────────────┘
```

**Важно:** модуль консалтинга ходит только в `/api/consalting/…`.  
Параллельный общий CRM (`/api/crm/wazzup-…`) — отдельный контур, фронт
консалтинга его не использует.

---

## 3. Экраны и маршруты

| UI | Маршрут | Компонент | Что делает |
|---|---|---|---|
| Хаб каналов | `/crm/consulting/chats` | `Chats/ChatsHub.jsx` | Fallback: выбор WA / TG / IG |
| Inbox + чат | `/crm/consulting/chats/:channel[/:leadId]` | `Chats/ChatsInbox.jsx` + `LeadMessengerPanel` | Список диалогов, открытие чата |
| Воронка → Чат | `/crm/consulting/funnel?lead=&tab=` | `Funnel.jsx` → `LeadMessengerPanel` | Карточка по URL + вкладка Чат |
| Лиды | `/crm/consulting/leads?tab=` | `leads/Leads.jsx` | Входящие / Распределение / Интеграция |
| Статус каналов | `?tab=integration` | `leads/WazzupAccountsTab.jsx` | Только чтение; вход также из Чатов |

Меню (`consultingMenu.js`): **Лиды → Воронка → Чаты** (Чаты → `/chats/whatsapp`).  
Права на лиды пока гейтятся вместе с воронкой (`can_view_funnel`).

Уведомления (`resolveConsultingNotificationUrl`): сообщение / SLA → чаты;
назначение / передача / стадия → `/funnel?lead=`.

Роуты: `src/config/routes/consultingRoutes.jsx`.

---

## 4. Ключевые файлы фронта

| Слой | Путь | Роль |
|---|---|---|
| API | `src/api/consultingWazzup.js` | Аккаунты, история, чаты, upload, нормализация сообщений/медиа |
| API | `src/api/consultingLeads.js` | Inbound-лиды, assign, настройки распределения |
| WS manager | `src/services/wazzupSocketManager.js` | Одно соединение `/ws/wazzup/` на вкладку (ref-count) |
| Hook | `src/hooks/useWazzupChatSocket.js` | Подписка React-компонентов на сокет |
| Bridge | `ConsultingWazzupNotifyBridge.jsx` | Держит WS открытым на всём `/crm/consulting` |
| Чат UI | `Funnel/LeadMessengerPanel.jsx` | Композер, пузыри, статусы, медиа |
| Медиа UI | `Funnel/ChatMessageMedia.jsx` | Рендер image / video / voice / файл |
| Inbox | `Chats/ChatsInbox.jsx` | Список тредов + live-обновление preview |
| Утилиты | `src/utils/consultingLeadSources.js` | Источники, deep-link из уведомлений |
| Тесты | `src/api/consultingWazzup.media.test.js` | Нормализация медиа/статусов |

---

## 5. Подключение канала (операционка)

### 5.1. Что делает админ (бэк / Django Admin)

1. В Wazzup24 создаётся канал WhatsApp (QR «Связанные устройства»).
2. Берутся **API Key** и **Channel ID** (`GET https://api.wazzup24.com/v3/channels`).
3. В Django Admin создаётся аккаунт
   (`/admin/consalting/wazzupaccountconsalting/` или аналог).
4. Регистрируется webhook на публичный URL компании:

```text
POST /api/consalting/wazzup/webhook/
```

На стороне Wazzup webhook задаётся через **`PATCH /v3/webhooks`**
(`webhooksUri` + `subscriptions.messagesAndStatuses`). У Wazzup **нет**
`POST /v3/webhooks` — ответ был бы `404`.

После успеха у аккаунта `is_connected = true`.

### 5.2. Что видит пользователь CRM

Вкладка **Лиды → Интеграция** вызывает:

1. `GET /consalting/wazzup/credentials/` (или `/wazzup-credentials/`)
2. fallback: `GET /consalting/wazzup-accounts/`

Показывает тип канала, `is_active` / `is_connected`.  
Создание аккаунта / setup-webhook с UI **deprecated** (функции в API ещё есть
для совместимости, но таб их не вызывает).

Стандартный webhook URL, который подставляет фронт при редких legacy-вызовах:

```text
{VITE_API_URL}/consalting/wazzup/webhook/
```

хелпер: `getDefaultWazzupWebhookUrl()` в `consultingWazzup.js`.

---

## 6. Жизненный цикл входящего сообщения

```text
1. Клиент пишет в WhatsApp
2. Wazzup шлёт webhook → POST /consalting/wazzup/webhook/
3. Бэкенд (идемпотентность по messageId / external_id):
   • создаёт/обновляет InboundLead
   • создаёт/находит карточку Lead на воронке
   • авто-распределяет owner (если strategy ≠ manual)
4. Realtime:
   • /ws/wazzup/          → type: new_message   (пузырь в чате, preview inbox)
   • /ws/notifications/   → lead_message / …    (колокольчик только владельцу)
   • /ws/consalting/funnel/ → обновление канбана при необходимости
5. Фронт:
   • LeadMessengerPanel добавляет сообщение, если оно принадлежит открытому лиду
   • ChatsInbox обновляет last_message / unread без полного refetch на каждое событие
```

### Источники лида

| `source` | Откуда |
|---|---|
| `whatsapp` | Wazzup transport WhatsApp |
| `instagram` | Wazzup Instagram |
| `telegram` | Wazzup Telegram |
| `manual` | Ручное создание на вкладке «Входящие» |

Константы: `LEAD_SOURCES` / `WAZZUP_INTEGRATION_TYPES` в
`consultingLeadSources.js`.

### Авто-распределение (кратко)

Настройки: `GET/PUT /consalting/lead-distribution/`  
`{ enabled, strategy, role_ids }`, где `strategy`:

- `round_robin` — по кругу среди сотрудников с выбранными ролями  
- `least_loaded` — минимум активных лидов  
- `manual` — без авто-assign  

После назначения — персональное событие `lead.assigned` /
`consulting.lead.assigned` только получателю.  
Подробности: [leads-whatsapp.md](./leads-whatsapp.md).

---

## 7. Чат: отправка и приём

### 7.1. WebSocket — основной путь сообщений

Один сокет на вкладку браузера:

```text
wss://…/ws/wazzup/?token=<JWT_ACCESS>
```

Менеджер: `wazzupSocketManager.js`.

- **Ref-count:** `acquireWazzupSocket` / release — пока есть подписчики
  (`LeadMessengerPanel`, `ChatsInbox`, `ConsultingWazzupNotifyBridge`),
  соединение живо.
- **Ping** каждые 25 с (`{ action: "ping" }`).
- **Reconnect** с backoff до 30 с; при close `4401` — refresh JWT и переподключение.
- Debug: `window.__wazzupSocketDebug()` в консоли.

События:

| Направление | Поле | Смысл |
|---|---|---|
| Клиент → CRM | `type: "new_message"` | Новое сообщение (вх. или исходящее от другого менеджера) |
| CRM → клиент | `action: "send_message"` | Отправка из UI |
| Сервер → UI | `action: "send_message_ack"` | Подтверждение / ошибка отправки |
| Статусы | `type: "message_status"` | `sent` → `delivered` → `read` (или `failed`) |

Фрейм отправки:

```json
{
  "action": "send_message",
  "lead_id": "<uuid карточки воронки>",
  "text": "Текст ответа",
  "media_url": "https://…",
  "content_uri": "https://…"
}
```

`lead_id` — id **Lead** воронки (LeadConsalting), не inbound-lead.

### 7.2. REST — история и вспомогательные операции

| Метод | URL | Назначение |
|---|---|---|
| `GET` | `/consalting/wazzup-messages/?lead={id}` | История (есть алиасы) |
| `GET` | `/consalting/wazzup-chats/?integration_type=whatsapp` | Список диалогов (быстрый путь) |
| `POST` | `/consalting/leads/{id}/mark-read/` | Сброс unread (fire-and-forget в UI) |
| `POST` | `/consalting/wazzup-accounts/{id}/upload/` | Upload файла → публичный URL |
| `POST` | `/consalting/wazzup-accounts/{id}/send-message/` | Fallback REST-отправка / multipart с файлом |

История: `listLeadMessages` пробует несколько путей
(`wazzup-messages` → `whatsapp-messages` → `messages` → `leads/{id}/messages/…`).  
При сплошных `404/501` UI работает на realtime + локальных исходящих
(`notReady`).

Список чатов: `listWazzupChats` сначала бьёт в `/wazzup-chats/` (оптимизированный
эндпоинт ~20–50 мс), иначе `/chats/`, `/leads/`, `/inbound-leads/`.

### 7.3. Как UI отправляет сообщение

`LeadMessengerPanel` (контракт: [wazzup-chat-async.md](./wazzup-chat-async.md)):

1. Optimistic-пузырь `local-*` со статусом `pending`.
2. **WS** `send_message` (`content_uri`, опционально `account_id`).
3. Свой пузырь **подтверждается из `send_message_ack`** (серверный `id`, обычно
   ещё `pending`). **Своё исходящее по `new_message` отправителю не приходит.**
4. Медиа: `upload` → `content_uri` → WS; fallback — multipart `send-message`.
5. `message_status` по тому же `id`: `pending → sent|delivered|read|failed`.
6. Все события — **upsert по `id`**, не append. После реконнекта — догрузка REST.

Привязка WS-сообщения к открытому лиду: `messageBelongsToLead` —
по `lead_id` или по совпадению последних 10 цифр телефона (`chat_id` ↔
`lead.phone`).

---

## 8. Медиа и статусы доставки

### Статусы UI

`pending` → `sent` → `delivered` → `read`, либо `error`  
(бэкенд `FAILED` / `failed` нормализуется в `error`).

Галочки в UI как в WhatsApp: одна / две / синие / восклицание.

### Типы медиа

| Wazzup / API | UI `media_type` | Превью без текста |
|---|---|---|
| image, photo | `image` | `📷 [Фотография]` |
| video | `video` | `🎥 [Видеозапись]` |
| audio, voice, ptt | `voice` | `🎙 [Голосовое сообщение]` |
| document | `document` | `📄 [Документ]` |
| file / прочее | `file` | `📎 [Вложение]` |

Клиентский лимит вложения: **25 МБ** (`CHAT_MEDIA_MAX_BYTES`).  
Подробности: [media-and-error-handling.md](./media-and-error-handling.md).

### Сайд-эффект «В работу»

Первое **исходящее** сообщение менеджера: бэкенд переводит лид
`new` → `in_work` и шлёт `lead.updated` в funnel-WS / уведомления.
Канбан мержит карточку без полного рефетча.

---

## 9. Уведомления (колокольчик ≠ чат-сокет)

| Канал | URL | Задача |
|---|---|---|
| Чат | `/ws/wazzup/` | Сообщения и статусы в UI чата |
| Колокольчик | `/ws/notifications/?token=` | Персональные алерты владельцу |
| Канбан | `/ws/consalting/funnel/` | Движение карточек / `lead.updated` |

`ConsultingWazzupNotifyBridge` **намеренно** не дублирует звук в колокольчик —
только держит чат-сокет. Колокольчик обслуживает `useNotificationsSocket` в
`Header.jsx`.

Типичные события: назначение, новое сообщение от лида, SLA
(`no_activity` / `sla_breach` / `task_overdue`).

Клик по уведомлению: бэкенд часто отдаёт `/consalting/leads/{id}` — фронт
мапит это в SPA-маршрут:

```text
/crm/consulting/chats/{whatsapp|telegram|instagram}/{leadId}
```

хелперы: `resolveConsultingNotificationUrl`, `consultingNotificationChatPath`.

Если чат уже открыт на видимой вкладке — звук уведомления не дублируется
(`consultingActiveChat`).

---

## 10. Нормализация данных (зачем столько алиасов)

Бэкенд и Wazzup отдают поля под разными именами. Фронт приводит всё к
канону в `normalizeChatMessage` / `normalizeChatThread` /
`normalizeWazzupAccount`:

```text
Сообщение UI:
  id, message_id, text, media_url, media_type,
  direction: "in"|"out", status, created_at, author_name, chat_id, lead_id

Тред inbox:
  id, lead_id, chat_id, full_name, phone, source,
  last_message, last_message_at, unread_count, has_unread
```

Graceful fallback: при `404` / `501` экраны показывают «раздел ещё не
подключён», CRM не падает. После появления эндпоинтов заглушки снимаются сами.

---

## 11. REST-справочник (консалтинг / WhatsApp)

### Аккаунты и webhook

| Метод | URL | Кто |
|---|---|---|
| `GET` | `/consalting/wazzup/credentials/` | UI статуса |
| `GET` | `/consalting/wazzup-accounts/` | fallback списка |
| `GET` | `/consalting/wazzup-accounts/{id}/` | деталь |
| `POST` | `/consalting/wazzup-accounts/` | admin / legacy |
| `DELETE` | `/consalting/wazzup-accounts/{id}/` | admin / legacy |
| `POST` | `/consalting/wazzup-accounts/{id}/setup-webhook/` | admin / legacy |
| `POST` | `/consalting/wazzup/webhook/` | **Wazzup** (public) |

### Чат и медиа

| Метод | URL | Назначение |
|---|---|---|
| `GET` | `/consalting/wazzup-messages/?lead=` | история |
| `GET` | `/consalting/wazzup-chats/` | список диалогов |
| `POST` | `/consalting/leads/{id}/mark-read/` | прочитано |
| `POST` | `/consalting/wazzup-accounts/{id}/upload/` | upload файла |
| `POST` | `/consalting/wazzup/upload/` | алиас upload |
| `POST` | `/consalting/wazzup-accounts/{id}/send-message/` | REST / multipart send |

### Входящие лиды

| Метод | URL | Назначение |
|---|---|---|
| `GET/POST` | `/consalting/inbound-leads/` | список / ручное создание |
| `PATCH` | `/consalting/inbound-leads/{id}/` | поля / статус |
| `POST` | `/consalting/inbound-leads/{id}/assign/` | ручное назначение |
| `GET/PUT` | `/consalting/lead-distribution/` | настройки RR / роли |

---

## 12. Чек-лист «WhatsApp заработает»

1. Wazzup24: канал WhatsApp активен (QR на телефоне).
2. Django Admin: API Key + Channel ID, webhook на
   `https://<host>/api/consalting/wazzup/webhook/`.
3. В CRM: **Лиды → Интеграция** (или **Чаты → Настройки каналов**) — канал «Подключён».
4. Написать тестовое сообщение на номер канала → появляется лид / карточка /
   уведомление ответственному.
5. Открыть **Чаты → WhatsApp** или карточку на воронке → вкладка **Чат**.
6. Ответить текстом; проверить галочки `sent` / `delivered` / `read`.
7. (Опционально) вложить фото/голос — upload или multipart.

Отладка сокета в браузере:

```js
window.__wazzupSocketDebug?.()
// { refCount, readyState, listeners, urlHint: "/ws/wazzup/" }
```

Тесты нормализации медиа:

```bash
npx vitest run src/api/consultingWazzup.media.test.js
```

---

## 13. Типичные проблемы

| Симптом | Куда смотреть |
|---|---|
| Нет входящих | Webhook URL, `is_connected`, логи Wazzup / бэка |
| Есть лид, нет пузыря в чате | `/ws/wazzup/` открыт? JWT? `messageBelongsToLead` (телефон) |
| Не уходит ответ | Сокет `OPEN`? Есть активный Wazzup-аккаунт? Ack / `error` |
| Медиа не грузится | Есть ли `POST …/upload/`? Лимит 25 МБ? CORS/публичность URL |
| Дубли лидов | Идемпотентность webhook по `messageId` |
| Уведомление всей компании | Событие должно идти в personal group владельца |
| Клик по колокольчику ведёт в никуда | `resolveConsultingNotificationUrl` / `meta.lead_id` |

---

## 14. Связь с воронкой и продуктом

- Входящий WhatsApp-лид сразу попадает на канбан (`Funnel.jsx` +
  `useFunnelBoardWebSocket`).
- Дальше — стандартный CRM-цикл: квалификация, услуги, закрытие сделки,
  зарплата % и т.д. (см. [funnel-crm-logic.md](./funnel-crm-logic.md),
  [salary-auto-accrual.md](./salary-auto-accrual.md)).
- WhatsApp-модуль **независим** от матрицы абоненток и аналитики услуг —
  его можно внедрять/отлаживать параллельно.

---

*Документ отражает состояние фронта NurFront на 2026-07-27. При расхождении
с бэкендом приоритет у фактических ответов API; детали payload’ов — в
связанных спеках выше.*
