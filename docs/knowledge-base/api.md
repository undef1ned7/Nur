# Превью уроков базы знаний — API для фронта

Поле `thumbnail` реализовано на бэкенде: приходит в GET, принимается и в JSON, и в multipart,
переживает PATCH без файла. Контракт совпадает с тем, что фронт отправляет через
`src/api/knowledgeBase.js`.

**Базовый URL:** `/api/main/public/knowledge-base/`

> ⚠️ **Нужен деплой с миграцией.** До `python manage.py makemigrations main && python manage.py migrate`
> на сервере колонок в базе нет и эндпоинт упадёт. После деплоя проверьте `OPTIONS` — `thumbnail`
> должен появиться в схеме.

**Фронт:** `src/api/knowledgeBase.js`, `VideoLessonsAdmin.jsx`, `LessonThumbnailField.jsx`, `utils.js` (`getLessonThumbnail`, `resolveMediaUrl`).

---

## 1. Чтение

В каждом уроке появилось поле `thumbnail`. Это **всегда строка** — `null` не приходит никогда.

```json
{
  "id": "079f1579-ac00-4400-a593-8fe402fa35b5",
  "title": "Маркет",
  "lessons": [
    {
      "id": "fb66a248-0d6b-4b31-bfee-ead07d856c0e",
      "title": "Интерфейс кассира",
      "description": "работа с интерфейсом кассира",
      "url": "https://youtu.be/ikRpCGdyisU",
      "thumbnail": "https://app.nurcrm.kg/media/knowledge-base/thumbnails/2026/08/preview.jpg",
      "order": 0,
      "created_at": "2026-08-29T18:18:48.052516+06:00"
    },
    {
      "title": "Настройки",
      "thumbnail": "",
      "url": "https://youtu.be/zuKxCEnehx0"
    }
  ]
}
```

| Значение | Что это | Что делает фронт |
|---|---|---|
| `"https://app.nurcrm.kg/media/…"` | Админ загрузил файл | Показывает как есть — URL уже абсолютный |
| `"https://cdn.example.com/p.jpg"` | Админ указал ссылку | Показывает как есть |
| `""` | Кастомного превью нет | Fallback на YouTube / Vimeo из `lesson.url` |

Файловые превью отдаются абсолютным URL — `resolveMediaUrl` на них сработает вхолостую.
Порядок уроков в `lessons` уже отсортирован по `order`.

---

## 2. Запись

Одно поле `thumbnail` принимает четыре разных вещи. Разница между «пусто» и «не прислали» —
принципиальная.

| Что отправили | Что произойдёт |
|---|---|
| `<File>` | Файл сохраняется, ранее указанная ссылка очищается |
| `"https://…"` | Ссылка сохраняется, ранее загруженный файл удаляется со storage |
| `""` или `null` | **Явная очистка:** файл удаляется, ссылка обнуляется. Урок вернётся к YouTube-превью |
| поле не отправлено | **Старое превью сохраняется.** Именно так редактируют урок, не трогая картинку |

> ⚠️ **Не отправляйте `thumbnail: ""` «на всякий случай`.** Пустая строка — это команда «удалить
> превью», а не «оставить как было». Если пользователь не трогал картинку, ключа в теле быть не должно.

**Поведение фронта (реализовано в `buildLessonWritePayload`):**

- Превью не трогали → ключ `thumbnail` **не отправляется**
- Нажали «Убрать превью» или стёрли ссылку → `thumbnail: ""`
- Ввели новую ссылку или выбрали файл → отправляется ссылка или multipart-файл
- При редактировании в payload передаётся `id` урока

### Ограничения файла

| Правило | Значение |
|---|---|
| Форматы | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| Максимальный размер | 5 МБ |
| Проверка содержимого | Файл открывается как изображение — переименованный `.pdf` не пройдёт |
| Длина ссылки | до 500 символов |

Валидацию размера и MIME фронт дублирует в `validateThumbnailFile` (`utils.js`).

---

## 3. JSON

Когда файлов нет — обычный `application/json`.

### POST — создание курса

```json
{
  "title": "Маркет",
  "lessons": [
    {
      "title": "Интерфейс кассира",
      "description": "работа с интерфейсом кассира",
      "url": "https://youtu.be/ikRpCGdyisU",
      "thumbnail": "https://cdn.example.com/custom-preview.jpg"
    },
    {
      "title": "Настройки",
      "url": "https://youtu.be/zuKxCEnehx0"
    }
  ]
}
```

### PATCH — только название

```json
{ "title": "Новое название курса" }
```

Уроки при таком PATCH не трогаются — ни порядок, ни превью.

---

## 4. Multipart

Bracket-notation — формат, который собирает `knowledgeBase.js`:

```
title                         = "Маркет"
lessons[0][id]                = "fb66a248-..."        // при редактировании
lessons[0][title]             = "Интерфейс кассира"
lessons[0][description]       = "работа с интерфейсом"
lessons[0][url]               = "https://youtu.be/ikRpCGdyisU"
lessons[0][thumbnail]         = <File>

lessons[1][title]             = "Настройки"
lessons[1][url]               = "https://youtu.be/zuKxCEnehx0"
                              // thumbnail не отправлен — старое превью сохранится
```

`order` read-only, присваивается по индексу в массиве (с 0).

---

## 5. Замена списка уроков

PATCH/PUT с полем `lessons` заменяет весь список:

```
урок из тела запроса
    │
    ├─ прислан id и такой урок есть ──────────► обновляем его на месте
    │
    ├─ id нет, но url совпал с существующим ──► обновляем его на месте
    │
    └─ ничего не совпало ─────────────────────► создаём новый урок

уроки, которых не оказалось в теле ───────────► удаляются вместе с файлами превью
```

**Фронт при сохранении передаёт `id` существующих уроков** — так превью не теряется при переименовании.

Курс должен содержать минимум один урок: `lessons: []` → `400`.

---

## 6. Ошибки

```json
{
  "lessons": [
    {},
    { "thumbnail": ["Файл превью больше 5 МБ."] },
    { "url": ["Введите правильный URL."] }
  ]
}
```

Фронт форматирует через `formatKnowledgeBaseErrors` → `Урок 2, thumbnail: …`

---

## 7. Что не сделано на бэке

- **Авторизация** write-методов — пока открыты; админка ходит без Bearer
- **Хранилище** — локальный `media/`; при деплое без persistent volume файлы могут пропасть

---

## 8. Проверка после деплоя

```bash
curl -s "https://app.nurcrm.kg/api/main/public/knowledge-base/" \
  | jq '.results[0].lessons[0].thumbnail'

curl -s -X OPTIONS "https://app.nurcrm.kg/api/main/public/knowledge-base/" \
  | jq '.actions.POST.lessons.child.children.thumbnail'
```

См. также [backend.md](./backend.md) — исходная спецификация для реализации на Django.
