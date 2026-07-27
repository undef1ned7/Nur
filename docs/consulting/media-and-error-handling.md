# Медиа, ошибки доставки, статус «В работу» и перформанс (Консалтинг / Wazzup)

Фронт: `LeadMessengerPanel`, `ChatMessageMedia`, `consultingWazzup.js`,
канбан — `useFunnelBoardWebSocket` + `Funnel.jsx`, inbox — `ChatsInbox`.

Связано: [wazzup-frontend.md](./wazzup-frontend.md),
[wazzup-integration.md](./wazzup-integration.md).

## 1. Медиа в чате

Бэкенд кладёт `content_uri` / `media_url` и `media_type`. Нормализация
(`normalizeChatMessage` / `normalizeChatThread`):

| Wazzup `type` | UI `media_type` | Плейсхолдер (если нет текста) |
|---|---|---|
| `image`, `photo` | `image` | `📷 [Фотография]` |
| `video` | `video` | `🎥 [Видеозапись]` |
| `audio`, `voice`, `ptt` | `voice` | `🎙 [Голосовое сообщение]` |
| `document`, `file` | `document` / `file` | `📄` / `📎` |

Если `media_type` нет — эвристика по расширению URL (`.ogg`/`.mp3` → voice,
`.jpg` → image, `.mp4` → video, `.pdf` → document).

**Рендер в бабле:**
- `image` → `<img>`
- `video` → `<video controls>`
- `voice` → `<audio controls>`
- иначе → ссылка на файл

Отправка фото/файла с устройства:

1. `POST /consalting/wazzup-accounts/{id}/upload/` (или алиасы
   `/wazzup/upload/`, `/wazzup-accounts/upload/`) — multipart `file`
2. Ответ с публичным URL (`url` / `content_uri` / `media_url`)
3. WS `send_message` с `media_url` + `content_uri`

Ссылка (🔗) по-прежнему работает без upload.

## 2. Ошибки доставки

Статусы UI: `pending → sent → delivered → read`, либо `error`.

- Бэкенд `FAILED` / WS `status: "failed"` → UI `error` (красный `!`).
- Ошибка `send_message_ack` → optimistic-бабл в `error`.

## 3. Авто-статус «В работу»

При первом исходящем сообщении менеджера бэкенд переводит лид
`new` → `in_work` и шлёт `lead.updated` / `lead_updated` в
`/ws/consalting/funnel/`. Канбан мержит карточку (в т.ч. без поля `funnel` —
ищет доску по `id`). Входящие лиды обновляются через персональные уведомления
(`lead.updated` в `isConsultingLeadUpdatedEvent`).

## 4. Производительность (цель: отклик < 2 с)

Оптимизации на бэке (ориентир для фронта):

| Эндпоинт | Было | Стало |
|---|---|---|
| `GET /wazzup-chats/` | 5–9 с (N+1) | ~20–50 мс (3 SQL) |
| `POST …/mark-read/` | 1.5–3 с (sync Wazzup) | < 0.5–1 с (Wazzup PATCH в фоне) |
| `GET /wazzup-messages/?lead=` | — | ~15–30 мс |
| `POST …/send-message/` | — | ~0.4–1.2 с |

**Фронт:**
1. `listWazzupChats` сначала бьёт в `/wazzup-chats/` (быстрый путь).
2. `markLeadChatRead` — fire-and-forget: не блокирует открытие чата и загрузку истории.
3. Inbox: live через `/ws/wazzup/`; полный refetch списка — только silent и не на каждое сообщение.
4. Плейсхолдеры медиа в preview списка — без лишних запросов за телом сообщения.

## 5. Тесты

```bash
npx vitest run src/api/consultingWazzup.media.test.js
```
