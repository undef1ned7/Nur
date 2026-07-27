# Консалтинг · Wazzup/WhatsApp чат — гайд для фронтенда

Как правильно работать с realtime-чатом воронки консалтинга после перевода на
асинхронную модель. Соблюдение контракта дедупликации ниже — обязательно, иначе
вернутся дубликаты и «прыгающие» сообщения.

Реализация: `LeadMessengerPanel.jsx`, `chatMessageState.js`,
`wazzupSocketManager.js`, `consultingWazzup.js`, `ChatsInbox.jsx`.

> ### Два обязательных пункта (иначе видны текущие баги)
> 1. **Обрабатывайте событие `message_status`** и обновляйте статус по `data.id`.
>    Отправка асинхронная: ответ приходит со статусом `pending`, а `sent` /
>    `failed` / `delivered` / `read` догоняет отдельным событием `message_status`.
>    **Если его не обрабатывать — сообщение навсегда останется «pending» в UI**
>    (жалоба «pending висит на сокете»). Статус в БД при этом уже правильный —
>    переоткрытие чата (REST) покажет верный статус.
> 2. **Своё сообщение рисуйте из ответа отправки (ack/REST), а не из сокета.**
>    Отправителю его же сообщение по сокету НЕ приходит (чтобы не было дубля).
>
> Дедуп/апдейт всего — строго по `data.id` (upsert, не append).

---

## 1. Модель в двух словах

- Каждое сообщение приходит по WebSocket **ровно один раз**.
- **Своё исходящее сообщение отправитель по сокету НЕ получает.** У отправителя
  уже есть локальный ответ (ack сокета или HTTP-ответ REST) — по нему и рисуем
  пузырь. Другие сотрудники компании получат это сообщение обычным `new_message`.
- Отправка не блокирует: сервер сразу отвечает `pending`, реальная доставка в
  Wazzup идёт в фоне, финальный статус прилетает событием `message_status`.

**Главное правило:** state сообщений — `Map<string, message>`, ключ — только
`data.id`. История, ack, `new_message` и `message_status` проходят через один
**upsert** (не `push` / append). Тогда пузырь, статусы и любые повторы
схлопнутся в одну запись.

---

## 2. Подключение по WebSocket

Аутентификация — JWT access-токен, через query `?token=`.

| Назначение | URL |
|---|---|
| **Чат** (приём + отправка) | `wss://…/ws/wazzup/` или `…/ws/wazzup/chat/<chat_id>/` |
| **Доска воронки** | `wss://…/ws/consalting/funnel/?token=<JWT>` |

- Для чат-экрана — `ws/wazzup/` (`wazzupSocketManager`). Вариант
  `ws/wazzup/chat/<chat_id>/` (только цифры) тоже работает, но **фильтрации по
  чату на сервере нет**: клиент всё равно получает события компании. Маршрутизация
  по `lead_id` / нормализованному `chat_id` — на клиенте.
- Оба консьюмера доставляют `new_message` / `message_status` в одном формате
  (канбан может обновлять unread по `new_message`).
- Доставка на сервере — одна копия на событие; клиентский дедуп по `id` всё равно
  нужен (пересечение сокета и REST при реконнекте).

Пинг раз в ~25–30 сек: `{"action":"ping"}` → `{"action":"pong"}`.

---

## 3. Входящие события

### `new_message` — входящее или чужое исходящее

Действие: **upsert по `data.id`** (матч чата по `lead_id`, иначе нормализованный
`chat_id`: `replace(/\D/g,'')`).

Ключевые поля `data`: `id`, `message_id`, `lead_id`, `chat_id`, `text`,
`content_uri` / `contentUri`, `media_type`, `direction` (`inbound`|`outbound`),
`status`, `timestamp`, `contact_name`.

### `message_status` — смена статуса исходящего

Тот же `data.id`, что вернул ack/REST. Тот же **upsert** по `id` (псевдокод §7):
если статус обогнал ack, временная запись по `id` допустима — ack позднее
дополнит текстом, не откатив более новый статус. Цепочка:
`pending → sent → delivered → read`, либо `failed` (UI: `error`).

Если через 25 секунд после ack финальный статус не пришёл — REST-история; если
всё ещё `pending` → UI «Доставка не подтверждена» (`unconfirmed`). Поздний
`message_status` заменит предохранитель на финал.

### `send_message_ack` — только отправителю

`status: "success"` → пузырь из `data` (`id`, обычно `pending`).  
Ошибка → toast / ошибка отправки.

### Funnel-only

`connection_established` и `lead.*` — на `ws/consalting/funnel/`, к пузырям чата
не относятся.

---

## 4. Отправка

### WebSocket (предпочтительно)

```json
{ "action": "send_message", "lead_id": "…", "text": "…", "content_uri": null, "account_id": null }
```

### REST (fallback, в т.ч. offline WS)

`POST /api/consalting/wazzup-accounts/<id>/send-message/` → `201` с тем же `id` /
`pending`, дальше `message_status`. Тело: `message`|`text`, медиа
`content_uri`|`media_url`; multipart с `file` — сервер сам заливает.

Медиа по WS: сначала `POST …/upload/` → `content_uri`, затем send.

---

## 5. REST чата

| Метод | URL | Назначение |
|---|---|---|
| `GET` | `/consalting/chats/` (алиас `/wazzup-chats/`) | список диалогов |
| `GET` | `/consalting/wazzup-messages/?lead=` | история (без пагинации) |
| `POST` | `/consalting/wazzup-accounts/<id>/upload/` | медиа → `content_uri` |

Историю грузим при открытии диалога, дальше живём на сокете; при реконнекте —
тихий merge по `id`.

---

## 6. Обязательные нюансы

1. Единый `Map` и upsert по `id`, не append.
2. Своё сообщение — optimistic UI сразу, затем confirm из ack/REST по `id`
   (не ждать `new_message`).
3. Нормализовать `chat_id` (цифры); надёжнее матчить по `lead_id`.
4. Реконнект → догрузить историю REST, слить upsert по `id`.
5. Сортировать по `timestamp` / `created_at`, не по порядку WS-кадров.
6. Realtime-уведомление о сообщении — резервный сигнал тихой REST-сверки
   (inbox и вкладка «Чат» на воронке): Map не очищать, только merge по `id`.
7. Предохранитель 20–30 с после ack без `message_status` → REST +
   «Доставка не подтверждена».

---

## 7. Мини-псевдокод

```js
const byId = new Map(); // id -> message

function upsert(m) {
  const prev = byId.get(m.id) || {};
  byId.set(m.id, { ...prev, ...m });
  render();
}

ws.onmessage = (e) => {
  const ev = JSON.parse(e.data);
  if (ev.action === "pong") return;
  if (ev.action === "send_message_ack") {
    if (ev.status === "success") upsert({ ...ev.data, mine: true });
    else toastError(ev.detail);
    return;
  }
  switch (ev.type) {
    case "new_message":     upsert(ev.data); break; // чужие/входящие
    case "message_status":  upsert(ev.data); break; // status по id
  }
};

async function send(leadId, text) {
  ws.send(JSON.stringify({ action: "send_message", lead_id: leadId, text }));
  // пузырь из ack (pending); статус догонит message_status
}
```
