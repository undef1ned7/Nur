# Wazzup — голосовые сообщения (voice notes) не доходят до WhatsApp

**Фронт:** `LeadMessengerPanel.jsx` (запись + отправка), `ChatMessageMedia.jsx`
/ `VoiceMessagePlayer.jsx` (плеер во входящих/исходящих).  
**API-слой:** `src/api/consultingWazzup.js`
(`sendWazzupMessage`, `sendWazzupMessageWithFile`, `uploadConsultingChatMedia`),
`src/services/wazzupSocketManager.js` (`sendWazzupChatMessage`).  
**Статус:** ⚠️ Фронт готов и теперь передаёт тип вложения явно (см. §2). Для
надёжной доставки **на бэке нужна транскодировка в OGG/Opus** (см. §3) —
без неё часть голосовых по-прежнему не будет доходить.

Связано: [wazzup-integration.md](./wazzup-integration.md),
[media-and-error-handling.md](./media-and-error-handling.md).

---

## 1. Проблема

Пользователь записывает голосовое в чате лида (кнопка микрофона в
композере). Сообщение уходит, в CRM показывается статус «отправлено»
(галочка), но **клиент в WhatsApp его не получает** (ни как voice note, ни
как обычный файл).

### Причина

1. Браузер записывает голосовое через `MediaRecorder`. Chrome/Edge умеют
   писать только в контейнер **WebM** (`audio/webm;codecs=opus`) — писать
   сразу в OGG браузер не может (Firefox — может, но это меньшинство
   пользователей).
2. WhatsApp Business API принимает как **voice note** (плеер с волной,
   `ptt: true`) **только OGG/Opus**. WebM для голосовых WhatsApp не
   поддерживает — сообщение либо отклоняется Wazzup/WhatsApp, либо теряется
   молча (ack от Wazzup означает только «принято на приём», не «доставлено
   в WhatsApp»).
3. До этого изменения фронт вообще не передавал тип вложения на
   `send-message` — ни REST, ни WS. Бэкенд был вынужден угадывать тип по
   расширению URL, а `.webm` в такой эвристике обычно читается как **video**,
   а не voice — то есть на стороне Wazzup letters терялся сам факт, что это
   голосовое.

---

## 2. Что уже сделано на фронте

С этого изменения все пути отправки передают явный тип вложения:

**REST** `POST /consalting/wazzup-accounts/{id}/send-message/`

```json
{
  "lead_id": "uuid",
  "message": "",
  "media_url": "https://.../voice-1699999999.webm",
  "content_uri": "https://.../voice-1699999999.webm",
  "media_type": "voice",
  "type": "voice",
  "content_type": "audio/webm",
  "mimetype": "audio/webm"
}
```

**Multipart-фоллбэк** (`sendWazzupMessageWithFile`, тот же эндпоинт,
`multipart/form-data`): дополнительные поля `media_type` / `type` /
`content_type` / `mimetype` рядом с `file`.

**WS** `/ws/wazzup/` (`action: "send_message"`): те же поля `media_type` /
`type` / `content_type` / `mimetype` в кадре.

Поля дублируются под двумя именами (`media_type`+`type`,
`content_type`+`mimetype`), чтобы бэкенду не нужно было согласовывать
конкретное имя — можно читать любое из пары.

**Важно:** сам файл при записи голосового остаётся в контейнере WebM
(`audio/webm;codecs=opus`) — переименование в `.ogg` на фронте ничего не
даёт (реальный формат не меняется, а имя файла ни на что не влияет за
пределами UI). Транскодировать в OGG/Opus может только бэкенд.

---

## 3. Что нужно на бэке

### 3.1. Принять новые поля

`POST …/send-message/` (REST и multipart) и `send_message` во
`/ws/wazzup/` теперь могут содержать `media_type` (или `type`) и
`content_type` (или `mimetype`). Раньше их не было — обрабатывать как
опциональные, без них ничего не должно ломаться (обратная совместимость).

### 3.2. Транскодировать голосовые в OGG/Opus перед отправкой в Wazzup

Когда `media_type == "voice"` (или входящий файл — `audio/webm`,
`audio/ogg`, `audio/mp4` и т.п., но **не** уже `audio/ogg;codecs=opus`),
перед вызовом Wazzup API нужно перекодировать файл:

```bash
ffmpeg -i input.webm -c:a libopus -b:a 32k -ar 16000 -ac 1 -f ogg output.ogg
```

- Результат отдавать с `Content-Type: audio/ogg` (WhatsApp может сверять
  заголовок ответа по URL, а не только расширение).
- Сохранить/отдавать `content_uri` уже на транскодированный `.ogg`, а не на
  исходный `.webm`.

### 3.3. Указать Wazzup, что это voice note

При вызове Wazzup `POST /v3/message` (или что уже используется в
`send-message`) передавать тип контента как `audio`/`voice note`/`ptt`,
согласно текущей версии Wazzup API v3 (см. их доку по полю `contentType` /
`type` для голосовых). Без этого даже корректный OGG/Opus может прийти
клиенту как обычный аудио-файл, а не как нативный voice note с волной.

### 3.4. Fallback без транскодирования (если ffmpeg пока не подключить)

Временный вариант — отправлять голосовое в Wazzup как обычный **документ/
файл** (`document`), а не как `voice`. Это доставится клиенту (просто без
проигрывателя-волны, файл для скачивания), что лучше, чем полная потеря
сообщения. Явно решить и зафиксировать, какой вариант используется, пока
транскодирование не готово.

---

## 4. Чек-лист приёмки

- [ ] `send-message` (REST/WS/multipart) принимает `media_type`/`type` и
      `content_type`/`mimetype`, не ломается без них.
- [ ] Голосовое, записанное в CRM (WebM/Opus), транскодируется в OGG/Opus
      перед отправкой в Wazzup **или** явно уходит как `document` (fallback
      §3.4) — зафиксировать выбранный вариант.
- [ ] Голосовое реально приходит в WhatsApp на телефон получателя и
      проигрывается.
- [ ] Плейсхолдер/ack в CRM не показывает «отправлено», если Wazzup вернул
      ошибку — ошибка должна долетать до фронта (`send_message_ack` с
      `status != success` уже обрабатывается, см.
      [media-and-error-handling.md](./media-and-error-handling.md) §2).

---

## 5. Связанные файлы

| Слой | Путь |
|---|---|
| Композер + запись голосового | `src/Components/Sectors/Consulting/Funnel/LeadMessengerPanel.jsx` |
| Плеер голосового в чате | `src/Components/Sectors/Consulting/Funnel/VoiceMessagePlayer.jsx`, `ChatMessageMedia.jsx` |
| REST/upload | `src/api/consultingWazzup.js` |
| WS-отправка | `src/services/wazzupSocketManager.js` |
| Общий контракт send-message | [wazzup-integration.md](./wazzup-integration.md) §4 |
| Контракт медиа-полей чата | [media-and-error-handling.md](./media-and-error-handling.md) §1 |
