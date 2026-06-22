# Канбан воронки (consalting) — Real-time на WebSocket. Документация для фронтенда

Канбан-доска воронки работает в реальном времени. Изменения (создание лида, взятие
в работу, перемещение по стадиям, возврат в пул, удаление) приходят всем подключённым
сотрудникам по WebSocket — без перезагрузки и поллинга.

## Модель видимости (важно!)

- **Новый лид создаётся без владельца** (`owner = null`) и попадает в **общий пул** —
  его видят **все** сотрудники компании/филиала.
- Когда сотрудник **«берёт»** лид (claim) или руководитель **назначает** его —
  у лида появляется `owner`, и карточка **остаётся только у владельца и
  руководителей**, у остальных она **пропадает с доски**.
- **Руководитель** (владелец компании / `admin` / `owner` / superuser) видит **все**
  лиды независимо от владельца.

Эта логика применяется и на сервере (REST отдаёт только видимые лиды), и в WebSocket
(событие о «взятом» чужом лиде приходит остальным как `lead.removed`).

---

## 1. Подключение к WebSocket

```
wss://<host>/ws/consalting/funnel/?token=<ACCESS_JWT>
```

- Аутентификация — тем же access-JWT, что и для REST.
- Токен можно передать в query (`?token=...`) **или** заголовком
  `Authorization: Bearer <token>` (query удобнее для браузера).
- На локалке без HTTPS — схема `ws://`, на проде — `wss://`.

### Сразу после connect сервер пришлёт:

```json
{
  "type": "connection_established",
  "company_id": "uuid",
  "branch_id": "uuid|null",
  "user_id": "uuid",
  "is_manager": true
}
```

- `user_id` — id текущего сотрудника (нужен, чтобы отличать «мои» карточки).
- `is_manager` — `true`, если пользователь руководитель (видит все лиды).

### Heartbeat (keep-alive)

Отправляйте раз в ~25–30 сек:

```json
{ "action": "ping" }
```

В ответ придёт `{ "type": "pong" }`.

### Коды закрытия

| Код | Причина |
|----|---------|
| `4401` | Не авторизован (нет/невалидный токен) |
| `4403` | Нет компании у пользователя |
| `401` / `429` | Отклонено на этапе хендшейка JWT (429 — слишком много неудачных попыток, ретрайте позже) |

При `4401` — обновите access-токен и переподключитесь. При прочих обрывах —
переподключение с экспоненциальной задержкой (1с, 2с, 4с… до ~30с).

---

## 2. Формат входящих событий

Все «карточные» события имеют единый вид:

```json
{ "type": "<имя события>", "data": { ...карточка лида... } }
```

Объект `data` (карточка лида):

```json
{
  "id": "uuid",
  "company": "uuid",
  "branch": "uuid|null",
  "funnel": "uuid",
  "stage": "uuid|null",
  "owner": "uuid|null",
  "owner_display": "Имя Фамилия|email|null",
  "title": "Название лида",
  "status": "new|in_work|won|lost",
  "score_grade": "A|B|C",
  "score_value": 0,
  "estimated_value": "120000.00",
  "is_at_risk": false,
  "next_action_type": "call|message|meeting|follow_up|null",
  "next_action_date": "2026-06-20T10:00:00Z|null",
  "created_at": "...",
  "updated_at": "..."
}
```

### Таблица событий

| `type` | Когда | Что делать на доске |
|--------|-------|---------------------|
| `lead.created` | Создан новый лид (пул) | Добавить карточку в колонку `data.stage` (или «без стадии») |
| `lead.claimed` | Лид взят/назначен | **Upsert** карточки. Если `data.owner !== myUserId` и я не руководитель — событие придёт как `lead.removed` (см. ниже) |
| `lead.released` | Лид вернули в пул (`owner=null`) | Upsert карточки (снова видна всем) |
| `lead.stage_changed` | Лид перемещён между стадиями | Переместить карточку в колонку `data.stage` |
| `lead.updated` | Поля лида изменены | Обновить карточку |
| `lead.deleted` | Лид удалён | Удалить карточку по `data.id` |
| `lead.removed` | Лид взял **другой** сотрудник — у меня его быть не должно | Удалить карточку по `data.id` (`data` = `{id, funnel}`) |
| `lead.won` / `lead.lost` | Лид закрыт (выигран/проигран) | Переместить/обновить (обычно прилетает вместе с `lead.stage_changed`) |
| `lead.assigned` | **Персонально вам** назначили лид | Показать тост/уведомление; карточка придёт отдельно через `lead.claimed` |

> **Фильтруйте события по `data.funnel`** — клиент получает события всей компании,
> а на экране открыта одна воронка. Игнорируйте события чужих воронок.

> Несколько событий на одно действие — норма (например, закрытие лида = `lead.stage_changed`
> + `lead.won`). Делайте обработку **идемпотентной** (upsert по `id`, а не push).

---

## 3. REST API (первичная загрузка и действия)

База: `/api/consalting/` (уточните префикс по `core/urls.py`). Везде нужен заголовок
`Authorization: Bearer <token>`.

### Загрузка доски

```
GET /api/consalting/funnels/<funnel_id>/board/
```

Ответ:

```json
{
  "funnel": { ... },
  "columns": [
    { "stage": { "id", "name", "color", "stage_type", "order" }, "leads": [ { ...карточка... } ] }
  ],
  "unassigned": [ { ...лиды без стадии... } ]
}
```

Отдаёт только **видимые текущему пользователю** лиды (пул + свои; руководителю — все).
Загружайте доску этим запросом при входе, дальше живите на WebSocket-событиях.

### Создать лид (попадёт в пул)

```
POST /api/consalting/leads/
{ "funnel": "<uuid>", "stage": "<uuid|null>", "title": "...", "estimated_value": 0, ... }
```

`owner` не передавайте — лид создастся без владельца (общий пул).
Сервер разошлёт `lead.created`.

### Взять лид себе (claim)

```
POST /api/consalting/leads/<id>/claim/
```

- Доступно для лидов из пула (или уже своих).
- `409 Conflict` — если лид уже взят другим (и вы не руководитель).
- Сервер разошлёт `lead.claimed` → у остальных карточка исчезнет.

### Вернуть лид в пул (release)

```
POST /api/consalting/leads/<id>/release/
```

- Свой лид может вернуть владелец; любой — руководитель (`403`, если чужой и не рук-ль).
- Сервер разошлёт `lead.released`.

### Назначить ответственного (только руководитель)

```
POST /api/consalting/leads/<id>/assign/
{ "owner": "<user_uuid>" }
```

- `403` — если вызывает не руководитель.
- Сервер разошлёт `lead.claimed` всем + персональное `lead.assigned` назначенному.

### Переместить по стадии (drag-and-drop между колонками)

```
POST /api/consalting/leads/<id>/move-stage/
{ "stage": "<stage_uuid>" }
```

- Сотрудник может двигать только лиды из пула/свои; руководитель — любые.
- Сервер разошлёт `lead.stage_changed`.
- Какие стадии доступны прямо сейчас (для подсветки колонок):
  `GET /api/consalting/leads/<id>/allowed-transitions/`

### Закрыть лид

```
POST /api/consalting/leads/<id>/win/    { "stage": "<won_stage|optional>" }
POST /api/consalting/leads/<id>/lose/   { "loss_reason": "<uuid>", "loss_comment": "", "stage": "<lost_stage|optional>" }
```

---

## 4. Рекомендуемый поток на фронте

1. Открыли доску → `GET .../board/` → отрисовали колонки и карточки.
2. Открыли WebSocket `ws/consalting/funnel/?token=...` → запомнили `user_id`, `is_manager`.
3. На каждое событие:
   - игнор, если `data.funnel !== openFunnelId`;
   - `lead.created|claimed|released|updated|stage_changed|won|lost` → **upsert** карточки
     (если у карточки поменялась `stage` — перенести в нужную колонку);
   - `lead.removed|lead.deleted` → удалить карточку по `data.id`.
4. Действия пользователя (взять/вернуть/перетащить) → соответствующий REST-вызов.
   UI можно обновлять оптимистично; «истина» придёт WebSocket-событием.
5. Ping каждые ~25 сек; авто-reconnect при обрыве.

---

## 5. Пример (vanilla JS)

```js
class FunnelBoardSocket {
  constructor({ token, funnelId, onEvent }) {
    this.token = token;
    this.funnelId = funnelId;
    this.onEvent = onEvent;
    this.retry = 0;
    this.connect();
  }

  connect() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    this.ws = new WebSocket(`${proto}://${location.host}/ws/consalting/funnel/?token=${this.token}`);

    this.ws.onopen = () => {
      this.retry = 0;
      this.ping = setInterval(() => this.send({ action: "ping" }), 25000);
    };

    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "connection_established") {
        this.userId = msg.user_id;
        this.isManager = msg.is_manager;
        return;
      }
      if (msg.type === "pong") return;

      const data = msg.data || {};
      // событие чужой воронки — пропускаем
      if (data.funnel && data.funnel !== this.funnelId) return;

      switch (msg.type) {
        case "lead.removed":
        case "lead.deleted":
          this.onEvent({ action: "remove", id: data.id });
          break;
        case "lead.assigned":
          this.onEvent({ action: "notify", text: `Вам назначен лид: ${data.title}` });
          break;
        default: // created / claimed / released / updated / stage_changed / won / lost
          this.onEvent({ action: "upsert", lead: data });
      }
    };

    this.ws.onclose = (ev) => {
      clearInterval(this.ping);
      if (ev.code === 4401) { /* обновить токен и пересоздать */ return; }
      const delay = Math.min(30000, 1000 * 2 ** this.retry++);
      setTimeout(() => this.connect(), delay);
    };
  }

  send(obj) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }
  close() { clearInterval(this.ping); this.ws.close(); }
}

// использование
const board = new FunnelBoardSocket({
  token: accessToken,
  funnelId: openFunnelId,
  onEvent: ({ action, lead, id, text }) => {
    if (action === "upsert") upsertCard(lead);      // добавить/обновить + перенести в колонку lead.stage
    if (action === "remove") removeCard(id);        // убрать карточку
    if (action === "notify") showToast(text);
  },
});
```

### React (набросок хука)

```jsx
function useFunnelBoard(funnelId, token) {
  const [cards, setCards] = useState({}); // { [id]: lead }

  useEffect(() => {
    // 1) начальная загрузка
    fetch(`/api/consalting/funnels/${funnelId}/board/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((b) => {
        const map = {};
        b.columns.forEach((c) => c.leads.forEach((l) => (map[l.id] = l)));
        b.unassigned.forEach((l) => (map[l.id] = l));
        setCards(map);
      });

    // 2) realtime
    const sock = new FunnelBoardSocket({
      token, funnelId,
      onEvent: ({ action, lead, id }) => {
        setCards((prev) => {
          const next = { ...prev };
          if (action === "remove") delete next[id];
          else if (action === "upsert") next[lead.id] = lead;
          return next;
        });
      },
    });
    return () => sock.close();
  }, [funnelId, token]);

  return cards; // группируйте по lead.stage для колонок
}
```

---

## 6. Частые вопросы

- **Почему карточка пропала?** Её взял другой сотрудник → пришло `lead.removed`.
  Так и задумано: взятый лид виден только владельцу и руководителям.
- **Дубли карточек.** Делайте upsert по `id`, а не append — на одно действие может
  прийти несколько событий.
- **Карточка не там, где надо.** Колонка определяется полем `lead.stage`. При
  `lead.stage_changed` перенесите карточку в колонку нового `stage`.
- **Сразу после reconnect возможна рассинхронизация.** После переподключения
  перезагрузите доску через `GET .../board/`, затем продолжайте слушать события.
