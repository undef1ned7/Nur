# База знаний (видеоуроки) — спецификация API для бэкенда

**Страницы фронта:**
- `/video-lessons` — публичный каталог
- `/video-lessons/:lessonId` — просмотр урока
- `/video-lessons/admin` — админка (создание/редактирование курсов)

**Фронт:**
- `src/api/knowledgeBase.js` — HTTP-клиент
- `src/Components/pages/Landing/NewLanding/VideoLessons/` — UI
- `src/Components/pages/Landing/NewLanding/VideoLessons/utils.js` — превью и парсинг YouTube/Vimeo

**Базовый URL:** `/api/main/public/knowledge-base/`

**Статус:** ✅ Реализовано на бэкенде (поле `thumbnail`, multipart, replace-стратегия с `id`).
Актуальный контракт для фронта: [api.md](./api.md). Требуется деплой с миграцией.

---

## 1. Контекст

Публичная «База знаний» — список **курсов**, каждый содержит упорядоченный список **уроков** со ссылкой на видео (YouTube, Vimeo или прямой URL).

### Превью урока

На карточках (`/video-lessons`) показывается thumbnail. Логика на фронте:

| Приоритет | Источник | Когда |
|---|---|---|
| 1 | `lesson.thumbnail` из API | Загруженный файл или URL, сохранённые на бэке |
| 2 | YouTube / Vimeo | Если `thumbnail` пустой — фронт сам строит URL из `lesson.url` |

Примеры автопревью (делает фронт, бэку не нужно):

- YouTube: `https://img.youtube.com/vi/{videoId}/mqdefault.jpg`
- Vimeo: `https://vumbnail.com/{videoId}.jpg`

**Задача бэкенда:** хранить и отдавать кастомное превью (`thumbnail`), если админ загрузил файл или указал ссылку.

---

## 2. Модели (Django)

Рекомендуемая структура (имена могут совпадать с уже существующими):

```python
class KnowledgeBaseCourse(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField("Название курса", max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class KnowledgeBaseLesson(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(
        KnowledgeBaseCourse,
        related_name="lessons",
        on_delete=models.CASCADE,
    )
    title = models.CharField("Название урока", max_length=255)
    description = models.TextField("Описание", blank=True, default="")
    url = models.URLField("Ссылка на урок", max_length=500)
    thumbnail = models.ImageField(
        "Превью",
        upload_to="knowledge-base/thumbnails/%Y/%m/",
        blank=True,
        null=True,
    )
    order = models.PositiveIntegerField("Порядок", default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "created_at"]
```

### Вариант с URL вместо файла

Если не нужно хранить файлы на сервере, можно использовать `URLField`:

```python
thumbnail = models.URLField(max_length=500, blank=True, default="")
```

Но фронт **уже поддерживает загрузку файла** через `multipart/form-data`, поэтому предпочтительнее `ImageField`.

### Миграция

```bash
python manage.py makemigrations
python manage.py migrate
```

---

## 3. Сериализатор

```python
class KnowledgeBaseLessonSerializer(serializers.ModelSerializer):
    thumbnail = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = KnowledgeBaseLesson
        fields = (
            "id",
            "title",
            "description",
            "url",
            "thumbnail",
            "order",
            "created_at",
        )
        read_only_fields = ("id", "order", "created_at")


class KnowledgeBaseCourseSerializer(serializers.ModelSerializer):
    lessons = KnowledgeBaseLessonSerializer(many=True)

    class Meta:
        model = KnowledgeBaseCourse
        fields = ("id", "title", "lessons", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")
```

### Формат `thumbnail` в JSON-ответе

Фронт принимает **оба** варианта:

| Формат | Пример | Поддержка |
|---|---|---|
| Абсолютный URL | `"https://app.nurcrm.kg/media/knowledge-base/thumbnails/2026/08/abc.jpg"` | ✅ предпочтительно |
| Относительный путь | `"/media/knowledge-base/thumbnails/2026/08/abc.jpg"` | ✅ фронт дополняет origin |

Реализация в сериализаторе:

```python
def get_thumbnail(self, obj):
    if not obj.thumbnail:
        return ""
    request = self.context.get("request")
    if request:
        return request.build_absolute_uri(obj.thumbnail.url)
    return obj.thumbnail.url
```

Или стандартный `ImageField` DRF с `request` в context — вернёт абсолютный URL.

Пустое превью: `""` или `null` (фронт трактует оба как «нет кастомного превью»).

---

## 4. Эндпоинты

| Метод | URL | Описание |
|---|---|---|
| `GET` | `/main/public/knowledge-base/` | Список курсов (пагинация) |
| `POST` | `/main/public/knowledge-base/` | Создание курса |
| `GET` | `/main/public/knowledge-base/{course_id}/` | Деталь курса |
| `PATCH` | `/main/public/knowledge-base/{course_id}/` | Частичное обновление |
| `PUT` | `/main/public/knowledge-base/{course_id}/` | Полная замена (если используется) |

**Content-Type (parses):** `application/json`, `multipart/form-data`, `application/x-www-form-urlencoded`

> ⚠️ **Доступ:** сейчас эндпоинт публичный (`public`). Для `POST`/`PATCH`/`PUT` на проде нужна авторизация (staff / platform-admin). Фронт админки пока без Bearer — при закрытии API добавить токен в `knowledgeBase.js`.

---

## 5. Формат JSON (без файлов)

Используется, когда **ни у одного урока нет загруженного файла** превью.

### POST / PATCH — тело запроса

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
      "description": "",
      "url": "https://youtu.be/zuKxCEnehx0",
      "thumbnail": ""
    }
  ]
}
```

### PATCH — только название курса

Фронт иногда шлёт **только** `title` (кнопка «Только название»):

```json
{
  "title": "Новое название курса"
}
```

**Важно:** при таком PATCH **не затирать** существующие уроки. Поле `lessons` отсутствует в теле.

### GET — ответ (курс)

```json
{
  "id": "079f1579-ac00-4400-a593-8fe402fa35b5",
  "title": "Маркет",
  "lessons": [
    {
      "id": "fb66a248-0d6b-4b31-bfee-ead07d856c0e",
      "title": "Интерфейс кассира",
      "description": "работа с интерфейсом кассира",
      "url": "https://youtu.be/ikRpCGdyisU?list=PL...",
      "thumbnail": "https://app.nurcrm.kg/media/knowledge-base/thumbnails/2026/08/preview.jpg",
      "order": 1,
      "created_at": "2026-08-29T18:18:48.052516+06:00"
    }
  ],
  "created_at": "2026-08-29T18:13:45.150606+06:00",
  "updated_at": "2026-08-29T18:18:48.053206+06:00"
}
```

### GET — список

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [ /* массив курсов, как выше */ ]
}
```

Фронт автоматически обходит все страницы по `next`.

---

## 6. Формат multipart/form-data (с файлами)

Используется, когда хотя бы у **одного** урока админ выбрал файл превью.

Фронт (`src/api/knowledgeBase.js`) формирует поля так:

```
title                          = "Маркет"
lessons[0][title]              = "Интерфейс кассира"
lessons[0][description]        = "работа с интерфейсом"
lessons[0][url]                = "https://youtu.be/ikRpCGdyisU"
lessons[0][thumbnail]          = <File binary>   ← JPG/PNG/WebP/GIF

lessons[1][title]              = "Настройки"
lessons[1][description]        = ""
lessons[1][url]                = "https://youtu.be/zuKxCEnehx0"
                                 ← thumbnail не отправляется → YouTube fallback
```

Если файл не выбран, но указана **ссылка** на изображение, фронт шлёт строку:

```
lessons[0][thumbnail] = "https://cdn.example.com/preview.jpg"
```

### Требования к парсеру на бэке

DRF nested serializer + `MultiPartParser` должен понимать bracket-notation:

```
lessons[0][title], lessons[0][thumbnail], ...
```

Если стандартный парсер не поддерживает — добавить кастомный parser или использовать `drf-nested-multipart`.

**Альтернатива (если bracket неудобен):** принять `lessons` как JSON-строку + отдельные файлы `lessons_0_thumbnail` — но тогда нужно менять и фронт. Текущий контракт — **bracket notation**.

### Замена списка уроков

При `PATCH`/`PUT` с полем `lessons` фронт **полностью заменяет** список уроков (replace strategy). Бэкенд должен:

1. Удалить уроки, которых нет в новом списке
2. Обновить существующие (если передан `id`)
3. Создать новые (без `id`)
4. Проставить `order` по индексу в массиве (0, 1, 2…)

При обновлении урока **без** нового файла `thumbnail` — **сохранять** старое превью (не затирать в `null`).

При явной очистке (`thumbnail: ""` в JSON) — удалить файл и обнулить поле.

---

## 7. Валидация

### Урок

| Поле | Правила |
|---|---|
| `title` | обязательно, max 255 |
| `url` | обязательно, валидный URL, max 500 |
| `description` | опционально |
| `thumbnail` | опционально |

### Файл превью (если `ImageField`)

| Правило | Значение (согласовано с фронтом) |
|---|---|
| MIME | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| Макс. размер | **5 МБ** |
| Рекомендуемое соотношение | 16:10 (фронт обрезает через `object-fit: cover`) |

### Курс

| Поле | Правила |
|---|---|
| `title` | обязательно, max 255 |
| `lessons` | минимум 1 урок с `title` + `url` при создании |

### Ошибки

Фронт показывает текст из `detail` или построчно из вложенных ошибок `lessons`:

```json
{
  "lessons": [
    {
      "thumbnail": ["Загрузите корректное изображение."]
    }
  ]
}
```

Фронт форматирует как: `Урок 1, thumbnail: Загрузите корректное изображение.`

---

## 8. Поведение фронта после ответа API

```
GET lesson
    │
    ├─ lesson.thumbnail есть? ──► resolveMediaUrl(thumbnail) ──► <img>
    │
    └─ нет ──► parseVideoUrl(lesson.url)
                  │
                  ├─ YouTube ──► img.youtube.com/vi/{id}/mqdefault.jpg
                  ├─ Vimeo   ──► vumbnail.com/{id}.jpg
                  └─ иначе   ──► серый placeholder
```

Если кастомное превью не загрузилось (404) — фронт **автоматически** пробует YouTube-превью.

---

## 9. Пример ViewSet (DRF)

```python
class KnowledgeBaseCourseViewSet(viewsets.ModelViewSet):
    queryset = KnowledgeBaseCourse.objects.prefetch_related("lessons")
    serializer_class = KnowledgeBaseCourseSerializer
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    pagination_class = PageNumberPagination
    http_method_names = ["get", "post", "patch", "put", "head", "options"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAdminUser()]  # или IsPlatformAdmin
```

Nested create/update — через `drf-writable-nested` или кастомный `create`/`update`:

```python
def perform_update(self, serializer):
    # replace lessons: delete missing, upsert by id, set order by index
    ...
```

---

## 10. Чеклист для бэкенда

- [ ] Добавить поле `thumbnail` (`ImageField`) в модель урока
- [ ] Миграция + `MEDIA_URL` / storage (S3 или локальный `media/`)
- [ ] Поле `thumbnail` в сериализаторе (read + write)
- [ ] Абсолютный URL в GET-ответе
- [ ] Поддержка `multipart/form-data` с `lessons[N][thumbnail]`
- [ ] При PATCH только `{ "title": "..." }` — уроки не трогать
- [ ] При PATCH с `lessons` — replace-стратегия, сохранять старый thumbnail если файл не передан
- [ ] Валидация: image, max 5 MB
- [ ] (Рекомендуется) Закрыть POST/PATCH/PUT авторизацией
- [ ] Обновить `OPTIONS` — поле `thumbnail` должно появиться в schema

---

## 11. Проверка после деплоя

```bash
# Список курсов — в уроках должно быть поле thumbnail
curl -s "https://app.nurcrm.kg/api/main/public/knowledge-base/" | jq '.results[0].lessons[0].thumbnail'

# Schema
curl -s -X OPTIONS "https://app.nurcrm.kg/api/main/public/knowledge-base/" | jq '.actions.POST.lessons.child.children.thumbnail'

# Создание с URL превью (JSON)
curl -s -X POST "https://app.nurcrm.kg/api/main/public/knowledge-base/" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Тест",
    "lessons": [{
      "title": "Урок 1",
      "url": "https://youtu.be/dQw4w9WgXcQ",
      "thumbnail": ""
    }]
  }'

# Загрузка файла (multipart) — пример
curl -s -X POST "https://app.nurcrm.kg/api/main/public/knowledge-base/" \
  -F 'title=Тест' \
  -F 'lessons[0][title]=Урок 1' \
  -F 'lessons[0][url]=https://youtu.be/dQw4w9WgXcQ' \
  -F 'lessons[0][description]=' \
  -F 'lessons[0][thumbnail]=@/path/to/preview.jpg'
```

---

## 12. Связанные файлы фронта

| Файл | Назначение |
|---|---|
| `src/api/knowledgeBase.js` | JSON + multipart submit |
| `src/Components/pages/Landing/NewLanding/VideoLessons/VideoLessonsAdmin.jsx` | Админка, выбор файла/URL |
| `src/Components/pages/Landing/NewLanding/VideoLessons/components/LessonThumbnailField.jsx` | UI загрузки превью |
| `src/Components/pages/Landing/NewLanding/VideoLessons/components/LessonCard.jsx` | Карточка с превью |
| `src/Components/pages/Landing/NewLanding/VideoLessons/utils.js` | `getLessonThumbnail`, `resolveMediaUrl` |
| `src/Components/pages/Landing/NewLanding/VideoLessons/utils.test.js` | Тесты превью |
