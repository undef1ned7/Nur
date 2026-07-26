# 📘 Фронтенд-документация: Интеграция Wazzup & WhatsApp чата в NurCRM (WebSocket & REST API)

Данное руководство описывает полную архитектуру, REST API эндпоинты и протокол отправки/приёма сообщений через **WebSockets** без использования POST-запросов.

---

## 🏛 1. Архитектура работы чата (100% WebSockets)

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        ФРОНТЕНД (React App)                             │
└──────────────┬──────────────────────────────────────────▲──────────────┘
               │                                          │
    1. WS send_message                             2. WS new_message
   (Отправка через сокет)                         (Приём в реальном времени)
               │                                          │
               ▼                                          │
┌─────────────────────────────────────────────────────────┴──────────────┐
│                        БЭКЕНД NurCRM (Django)                          │
└──────────────┬─────────────────────────────────────────────────────────┘
               │
    3. Wazzup API v3 (HTTP Webhooks & REST)
               │
               ▼
📱 WhatsApp / Instagram / Telegram (Клиент)
```

---

## 🔑 2. Авторизация (JWT Tokens)

Все соединения требуют передачи JWT-токена авторизации:

1. **WebSocket Соединение:**
   URL: `wss://app.nurcrm.kg/ws/wazzup/?token=<JWT_ACCESS_TOKEN>`
2. **HTTP REST API:**
   Заголовок: `Authorization: Bearer <JWT_ACCESS_TOKEN>`

---

## ⚡ 3. Отправка и Приём сообщений через WebSocket

### Подключение:
`wss://app.nurcrm.kg/ws/wazzup/?token=<JWT_ACCESS_TOKEN>`

---

### 📤 А) Отправка сообщения клиенту через WebSocket (без POST запросов)

Фронтенд отправляет фрейм через открытый WebSocket:

```json
{
  "action": "send_message",
  "lead_id": "ea88bcfa-afc2-4acb-85ea-16...",
  "text": "Здравствуйте! Мы получили вашу заявку.",
  "media_url": "https://example.com/document.pdf"
}
```

#### Ответ подтверждения от сервера (`send_message_ack`):
```json
{
  "action": "send_message_ack",
  "status": "success",
  "data": {
    "id": "c7a8b9d0-1234-4567-89ab-cdef01234567",
    "message_id": "wz_out_987654321",
    "status": "sent",
    "text": "Здравствуйте! Мы получили вашу заявку.",
    "lead_id": "ea88bcfa-afc2-4acb-85ea-16..."
  }
}
```

---

### 📥 Б) Входящие события от сервера по WebSocket

#### 1. Новое сообщение (входящее от клиента или исходящее от другого менеджера):
```json
{
  "type": "new_message",
  "data": {
    "id": "c7a8b9d0-1234-4567-89ab-cdef01234567",
    "message_id": "wz_msg_998877",
    "chat_id": "+77011234567",
    "text": "Подскажите стоимость услуг",
    "media_url": null,
    "is_incoming": true,
    "status": "read",
    "timestamp": "2026-07-26T23:50:00.000000Z",
    "contact_name": "Айбек Иманалиев"
  }
}
```

#### 2. Обновление статуса сообщения (доставлено / прочитано):
```json
{
  "type": "message_status",
  "data": {
    "id": "c7a8b9d0-1234-4567-89ab-cdef01234567",
    "message_id": "wz_out_abc123",
    "chat_id": "+77011234567",
    "status": "read"
  }
}
```

---

## 📋 4. REST API Справочник (Для загрузки первичной истории)

| Метод | URL Эндпоинта | Назначение |
| :--- | :--- | :--- |
| `GET` | `/api/consalting/wazzup-messages/?lead={lead_id}` | История сообщений по лиду |
| `GET` | `/api/consalting/wazzup-accounts/` | Список аккаунтов Wazzup компании |
| `POST` | `/api/consalting/wazzup-accounts/` | Подключение нового аккаунта Wazzup |
| `POST` | `/api/consalting/wazzup-accounts/{id}/setup-webhook/` | Авто-привязка Webhook (PATCH) |

---

## 💻 5. Готовый пример компонента React (100% WebSocket Chat)

```javascript
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';

const WazzupSocketChat = ({ leadId, token }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const wsRef = useRef(null);

  // 1. Первичная загрузка истории через REST API
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`https://app.nurcrm.kg/api/consalting/wazzup-messages/?lead=${leadId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessages(res.data);
      } catch (err) {
        console.error("Ошибка загрузки истории:", err);
      }
    };
    if (leadId) fetchHistory();
  }, [leadId, token]);

  // 2. Подключение к WebSocket (И приём, и отправка)
  useEffect(() => {
    const socket = new WebSocket(`wss://app.nurcrm.kg/ws/wazzup/?token=${token}`);
    wsRef.current = socket;

    socket.onmessage = (event) => {
      const response = JSON.parse(event.data);

      // Входящее сообщение
      if (response.type === "new_message") {
        setMessages(prev => [...prev, response.data]);
      }

      // Подтверждение отправки собственного сообщения через сокет
      if (response.action === "send_message_ack" && response.status === "success") {
        console.log("Сообщение успешно отправлено через сокет:", response.data);
      }

      // Обновление статуса
      if (response.type === "message_status") {
        setMessages(prev => prev.map(msg => 
          msg.message_id === response.data.message_id 
            ? { ...msg, status: response.data.status } 
            : msg
        ));
      }
    };

    return () => socket.close();
  }, [token]);

  // 3. Отправка сообщения НАПРЯМУЮ через WebSocket (Без POST запроса!)
  const handleSendViaSocket = () => {
    if (!text.trim() || !wsRef.current) return;

    const payload = {
      action: "send_message",
      lead_id: leadId,
      text: text
    };

    wsRef.current.send(JSON.stringify(payload));
    setText('');
  };

  return (
    <div className="chat-container">
      <div className="messages-list">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.direction || (msg.is_incoming ? 'inbound' : 'outbound')}`}>
            <p>{msg.text}</p>
            <span className="status">{msg.status}</span>
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input 
          value={text} 
          onChange={e => setText(e.target.value)} 
          placeholder="Введите сообщение..."
        />
        <button onClick={handleSendViaSocket}>Отправить через Сокет</button>
      </div>
    </div>
  );
};

export default WazzupSocketChat;
```
