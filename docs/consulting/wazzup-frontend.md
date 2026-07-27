# Консалтинг · Wazzup/WhatsApp чат (фронт)

Краткий указатель. **Актуальный контракт async-модели** (обязательные
`message_status` + пузырь из ack/REST, upsert по `id`):

→ **[wazzup-chat-async.md](./wazzup-chat-async.md)**

Смежные:

- [whatsapp-overview.md](./whatsapp-overview.md) — архитектура и экраны
- [wazzup-integration.md](./wazzup-integration.md) — аккаунты / webhook
- [media-and-error-handling.md](./media-and-error-handling.md) — медиа и `failed`

Реализация: `LeadMessengerPanel.jsx`, `chatMessageState.js`,
`wazzupSocketManager.js`, `consultingWazzup.js`, `ChatsInbox.jsx`.
