# Консалтинг · Wazzup/WhatsApp чат (фронт)

Краткий указатель. **Актуальный контракт async-модели** (upsert по `id`, пузырь
из ack, `message_status`):

→ **[wazzup-chat-async.md](./wazzup-chat-async.md)**

Смежные:

- [whatsapp-overview.md](./whatsapp-overview.md) — архитектура и экраны
- [wazzup-integration.md](./wazzup-integration.md) — аккаунты / webhook
- [media-and-error-handling.md](./media-and-error-handling.md) — медиа и `failed`

Реализация: `LeadMessengerPanel.jsx`, `wazzupSocketManager.js`, `consultingWazzup.js`.
