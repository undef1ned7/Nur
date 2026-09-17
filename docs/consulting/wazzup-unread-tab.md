# Консалтинг · Чаты — вкладка «Непрочитанные»

**Сферы:** Консалтинг (Wazzup/WhatsApp inbox).
**Страница:** `/crm/consulting/chats/:channel[/:leadId]`.
**Фронт:** `src/Components/Sectors/Consulting/Chats/ChatsInbox.jsx`,
`src/Components/Sectors/Consulting/Chats/chats.scss`,
`src/api/consultingWazzup.js`.
**Статус:** ✅ Фронт готово (клиентская фильтрация по уже отдаваемому
`unread_count`/`has_unread`). Бэку нужны правки для корректности при большом
числе диалогов и при нескольких сотрудниках на одной компании — см. §3.

---

## 1. Задача

В инбоксе чатов (список диалогов слева) нужна вкладка-фильтр **«Непрочитанные»**
рядом с «Все», как в WhatsApp/Telegram:

- «Все» — текущий список диалогов без изменений;
- «Непрочитанные» — только диалоги с `unread_count > 0`, с бейджем-счётчиком
  на самой вкладке;
- поиск (`q`) продолжает работать поверх выбранной вкладки;
- при переключении канала (WhatsApp/Telegram/Instagram) вкладка сбрасывается
  на «Все».

## 2. Что уже сделано на фронте

`ChatsInbox.jsx` уже получал `unread_count` / `has_unread` по каждому диалогу
из `GET /consalting/chats/` (см. `normalizeChatThread` в
`consultingWazzup.js`) и обнулял его локально при открытии диалога
(`mergeChatThreads`) и через `POST /consalting/leads/{id}/mark-read/`
(`markLeadChatRead`, используется в `LeadMessengerPanel.jsx` при открытии
чата — fire-and-forget). Вкладка «Непрочитанные» — чисто клиентский фильтр
поверх уже загрученного списка:

```javascript
// ChatsInbox.jsx
const unreadCount = threads.reduce((n, t) => n + (t.unread_count > 0 ? 1 : 0), 0);

const filtered = useMemo(() => {
  let rows = threads;
  if (tab === "unread") rows = rows.filter((t) => t.unread_count > 0);
  // + поиск по q поверх rows
}, [threads, q, tab]);
```

Бэкенд-изменения **не обязательны** для первой итерации — список чатов и так
приходит целиком (`page_size: 200`) и уже содержит `unread_count`. Ниже —
что желательно доработать, чтобы поведение было корректным для реальных
объёмов и всех ролей.

## 3. Что желательно доработать на бэке

### 3.1. `unread_count` должен быть per-user, не per-lead

Сейчас неясно, на каком уровне бэк считает `unread_count` в
`GET /consalting/chats/` (`/wazzup-chats/`): на уровне лида (общий счётчик
для всех сотрудников компании) или на уровне пары «лид + сотрудник».

**Ожидаемое поведение:** «непрочитано» должно быть привязано к
`(lead, employee)`, а не только к `lead`. Иначе, если сотрудник А открыл чат
и он «прочитан», у сотрудника Б чат в его инбоксе будет ошибочно тоже
непрочитанным = 0, хотя он его не видел, — либо наоборот, `mark-read` от
одного сотрудника молча сбросит бейдж всем.

Рекомендуемая модель:

```python
class ChatReadState(models.Model):
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="chat_read_states")
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE)
    last_read_message_id = models.CharField(max_length=64, null=True, blank=True)
    last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("lead", "employee")
```

`unread_count` в `GET /consalting/chats/` = число входящих (`direction=in`)
сообщений лида с `created_at > last_read_at` (или `id` позже
`last_read_message_id`) для **текущего** `request.user`.

> Если такая модель уже используется под капотом (просто не задокументирована)
> — этот пункт можно закрыть без изменений, просто подтвердить контракт.

### 3.2. `POST /consalting/leads/{id}/mark-read/` — учитывать текущего пользователя

Эндпоинт уже существует и вызывается с фронта. Убедиться, что он:

- пишет/обновляет `ChatReadState` (§3.1) для `request.user`, а не глобально
  для лида;
- отвечает `< 1s` (сейчас так и есть, PATCH в Wazzup уходит в фон — не
  трогать эту часть);
- идемпотентен при повторном вызове.

### 3.3. (Опционально) серверная фильтрация списка

Для компаний с большим числом диалогов клиентская фильтрация по уже
загруженным 200 записям может не отражать реальное состояние (если диалогов
больше `page_size`). Опционально добавить параметр:

```http
GET /consalting/chats/?integration_type=whatsapp&unread=true
```

`unread=true` — вернуть только диалоги с `unread_count > 0` для текущего
пользователя. Не обязательно для v1: фронт пока не постранично грузит список
(`page_size: 200` покрывает подавляющее большинство компаний), но параметр
стоит поддержать заранее, чтобы не пришлось менять контракт при масштабировании.

### 3.4. Realtime: событие о смене unread

`new_message` по WebSocket уже обрабатывается фронтом для инкремента
`unread_count` локально (см. `docs/consulting/wazzup-chat-async.md`).
Дополнительных событий не требуется — только не забыть, что `new_message`
должен приходить **всем** сотрудникам компании с доступом к лиду (не только
тому, кто открыл чат), иначе их локальный счётчик не увеличится.

---

## 4. Чек-лист приёмки

- [ ] `GET /consalting/chats/` отдаёт `unread_count`/`has_unread` в разрезе
  текущего пользователя (`request.user`), а не общий на лида.
- [ ] `POST /consalting/leads/{id}/mark-read/` сбрасывает непрочитанное только
  для вызвавшего пользователя.
- [ ] (опционально) `GET /consalting/chats/?unread=true` — только непрочитанные
  диалоги текущего пользователя.
- [ ] Два сотрудника с доступом к одному пулу лидов видят независимые счётчики
  непрочитанного.

---

## 5. Связанные файлы/документы

| Слой | Путь |
|---|---|
| Список чатов + вкладка «Непрочитанные» | `src/Components/Sectors/Consulting/Chats/ChatsInbox.jsx` |
| Стили вкладок/бейджей | `src/Components/Sectors/Consulting/Chats/chats.scss` |
| Нормализация тредов, `mark-read` | `src/api/consultingWazzup.js` |
| Realtime-контракт чата | `docs/consulting/wazzup-chat-async.md` |
