# Услуги — повторяющиеся названия в разных категориях

**Сферы:** Барбершоп, Услуги, Стоматология — общий backend-домен `barbershop`.  
**Страницы:** `/crm/barber/services`, `/crm/services/services`, `/crm/dentistry/services`.  
**Фронт:** `src/Components/Sectors/Barber/Services/Services.jsx`, модалка
`src/Components/Sectors/Barber/Services/components/ServiceModal.jsx`.  
**Эндпоинты:** `/barbershop/services/`, `/barbershop/service-categories/`.  
**Статус:** ⚠️ Требуются правки модели и валидации на бэкенде. На фронте —
готово.

---

## 1. Задача

Пользователь должен иметь возможность создавать **услуги с одинаковым
названием**, если они относятся к **разным категориям**.

Пример: «Стрижка» в категории «Мужские» и «Стрижка» в «Детские» — две
разные услуги с разной ценой, длительностью и привязкой к мастерам.

При этом в **одной** категории (включая «Общее» — без категории) дубликат
названия по-прежнему **запрещён**.

---

## 2. Текущее поведение (проблема)

Сейчас уникальность названия, вероятно, проверяется **глобально в рамках
компании** — `(company, name)` или аналог в сериализаторе / `UniqueConstraint`.

Из-за этого:

- `POST /barbershop/services/` с уже существующим `name`, но другим `category`
  возвращает `400`;
- пользователь не может завести одно и то же наименование в разных категориях.

На фронте раньше была такая же глобальная проверка — она **исправлена**:
дубликат ищется только среди услуг **той же категории** (см. §6).

---

## 3. Правила уникальности (целевое поведение)

### 3.1. Ключ уникальности

Уникальность названия услуги определяется тройкой:

| Компонент | Поле API | Примечание |
|---|---|---|
| Компания | из JWT / `company` в payload | как сейчас |
| Категория | `category` (`UUID \| null`) | `null` = «Общее», без категории |
| Название | `name` | после нормализации (§3.2) |

**Разрешено:** две записи с одинаковым `name`, если `category` различается
(включая случай «одна с категорией, другая без»).

**Запрещено:** две записи с одинаковым `(company, category, name)`.

### 3.2. Нормализация названия

Сравнение на бэкенде должно совпадать с фронтом:

```python
def normalize_service_name(value: str) -> str:
    return " ".join(str(value or "").split()).casefold()
```

- обрезка пробелов по краям;
- сжатие повторяющихся пробелов;
- сравнение **без учёта регистра** (`casefold`, не только `lower`).

Примеры эквивалентных названий: `"Стрижка"`, `"  стрижка  "`, `"СТРИЖКА"`.

### 3.3. Категория «Общее»

- В API: `category: null` (фронт отправляет `null`, если категория не выбрана).
- Все услуги без категории образуют **одну** группу: два «Стрижка» с
  `category=null` в одной компании — **дубликат**.

Категория должна принадлежать той же компании, что и услуга; иначе `400`.

---

## 4. Модель данных

### 4.1. Ожидаемая схема

```python
class Service(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    category = models.ForeignKey(
        ServiceCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="services",
    )
    name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    # … остальные поля без изменений
```

### 4.2. Ограничение уникальности

**Было (типичный вариант — убрать):**

```python
constraints = [
    models.UniqueConstraint(
        fields=["company", "name"],
        name="uniq_barbershop_service_name_per_company",
    )
]
```

**Нужно:**

```python
constraints = [
    models.UniqueConstraint(
        fields=["company", "category", "name"],
        name="uniq_barbershop_service_name_per_category",
    )
]
```

> **PostgreSQL:** `NULL` в `category` участвует в unique так, что несколько
> строк с `category=NULL` и одинаковым `name` **не** считаются дубликатами на
> уровне БД. Если нужна строгая уникальность для «Общее», используйте
> `UniqueConstraint(..., condition=Q(category__isnull=False))` **плюс** отдельное
> ограничение или partial unique для `category IS NULL`, **либо** валидацию в
> сериализаторе для `category is None`.

Рекомендуемый подход для PostgreSQL:

```python
class Meta:
    constraints = [
        models.UniqueConstraint(
            fields=["company", "category", "name"],
            name="uniq_service_name_with_category",
            condition=models.Q(category__isnull=False),
        ),
    ]
```

И явная проверка в `validate()` для `category is None` (см. §5.2).

### 4.3. Миграция

1. Снять старый `UniqueConstraint(company, name)`.
2. Добавить новый по §4.2.
3. Перед применением constraint проверить, что в данных **нет** конфликтов
   внутри одной категории (глобальные дубликаты в **разных** категориях —
   наоборот, **допустимы** и не требуют слияния).

---

## 5. API

Базовый префикс: `/api/barbershop/`.

### 5.1. Создание — `POST /barbershop/services/`

Тело (фронт):

```json
{
  "name": "Стрижка",
  "price": 500,
  "is_active": true,
  "time": "30",
  "category": "uuid-категории-или-null",
  "barbers": ["uuid-мастера"],
  "company": "uuid-компании"
}
```

| Поле | Обязательное | Правила |
|---|---|---|
| `name` | да | 1–255 символов после trim; уникально в `(company, category)` |
| `price` | да | `>= 0` |
| `category` | нет | `null` или UUID категории компании |
| `is_active` | нет | boolean, default `true` |
| `time` | нет | строка/число минут |
| `barbers` | нет | список UUID сотрудников |

**Успех:** `201` + объект услуги.

**Дубликат в категории:** `400`

```json
{
  "name": ["Услуга с таким названием уже есть в этой категории."]
}
```

или

```json
{
  "detail": "Услуга с таким названием уже есть в этой категории."
}
```

Фронт показывает первое сообщение из ответа.

### 5.2. Обновление — `PATCH /barbershop/services/{id}/`

Те же правила уникальности при изменении `name` и/или `category`:

- перенос услуги в категорию, где уже есть услуга с таким `name` → `400`;
- смена только цены при том же `(name, category)` → `200`.

Проверка в сериализаторе (псевдокод):

```python
def validate_unique_name_in_category(self, attrs):
    company = self.instance.company if self.instance else attrs["company"]
    category = attrs.get("category", getattr(self.instance, "category_id", None))
    name = normalize_service_name(
        attrs.get("name", getattr(self.instance, "name", ""))
    )
    qs = Service.objects.filter(company=company, category=category)
    if self.instance:
        qs = qs.exclude(pk=self.instance.pk)
    for row in qs.only("name"):
        if normalize_service_name(row.name) == name:
            raise ValidationError(
                {"name": "Услуга с таким названием уже есть в этой категории."}
            )
```

### 5.3. Список — `GET /barbershop/services/`

Без изменений контракта. Фронт использует:

| Query | Назначение |
|---|---|
| `page` | пагинация |
| `search` | поиск по названию |
| `category` | фильтр по UUID категории |
| `ordering` | `name`, `-name`, `price`, `-price`, `created_at`, `-created_at` |

Ответ (элемент):

```json
{
  "id": "uuid",
  "name": "Стрижка",
  "price": "500.00",
  "is_active": true,
  "time": "30",
  "category": "uuid-категории",
  "category_name": "Мужские",
  "barbers": ["uuid"],
  "barbers_detail": [{ "id": "uuid", "full_name": "Иван И." }],
  "created_at": "2026-09-01T10:00:00Z",
  "updated_at": "2026-09-01T10:00:00Z"
}
```

### 5.4. Категории — без изменений

`GET/POST/PATCH/DELETE /barbershop/service-categories/` — названия категорий
по-прежнему **уникальны глобально в компании** (это отдельное правило, фронт
не менял).

---

## 6. Что уже сделано на фронте

В `ServiceModal.jsx` клиентская валидация:

- дубликат ищется только среди услуг **той же категории** (`categoryId`);
- пустая категория и `null` трактуются как «Общее»;
- сообщение: «Такая услуга уже есть в этой категории.»

**Ограничение фронта:** проверка идёт по услугам **текущей страницы** списка
(server-side pagination). Полная гарантия — только на бэкенде.

После правок бэка дополнительных изменений на фронте **не требуется**, если
формат ошибки `400` сохраняется читаемым (§5.1).

---

## 7. Влияние на другие модули

| Модуль | Эндпоинт / место | Действие |
|---|---|---|
| Запись (Recorda) | `/barbershop/appointments/` | Без изменений — услуги идентифицируются по `id` |
| Онлайн-запись | `/barbershop/bookings/` | Без изменений |
| Зарплата | `/barbershop/salary/rates/` | Ставки привязаны к `service_id`, не к `name` |
| Аналитика | `/barbershop/analytics/dashboard/` | В рейтингах услуг различать одноимённые по `service_id` / категории в UI при необходимости |
| POS / продажи | через UUID услуги | Без изменений |

Переименование или перенос категории не должно ломать исторические записи —
связи через FK `service_id`.

---

## 8. Примеры сценариев

| # | Действие | Категория A | Категория B | Результат |
|---|---|---|---|---|
| 1 | Создать «Стрижка» | Мужские | — | `201` |
| 2 | Создать «Стрижка» | Детские | — | `201` (другая категория) |
| 3 | Создать «Стрижка» | Мужские | — | `400` (дубликат в той же категории) |
| 4 | Создать «Стрижка» | null (Общее) | — | `201` |
| 5 | Создать вторую «Стрижка» | null (Общее) | — | `400` |
| 6 | Создать «Стрижка» | Мужские | при уже есть в Общее | `201` (разные категории) |
| 7 | PATCH: перенести услугу в категорию с тем же именем | → Детские | там уже «Стрижка» | `400` |

---

## 9. Чек-лист приёмки

- [ ] `POST` с одинаковым `name` и **разным** `category` → `201`.
- [ ] `POST` с одинаковым `name` и **тем же** `category` → `400` с понятным текстом.
- [ ] Два «Стрижка» с `category=null` в одной компании → второй `POST` → `400`.
- [ ] `PATCH` смены `category` на конфликтующую → `400`.
- [ ] `PATCH` только `price` без смены `(name, category)` → `200`.
- [ ] Сравнение имён без учёта регистра и лишних пробелов.
- [ ] Категория другой компании → `400`.
- [ ] Старый global unique `(company, name)` снят; миграция проходит на prod-данных.
- [ ] Существующие appointments / salary rates / bookings продолжают ссылаться на те же `service_id`.

---

## 10. Связанные файлы

| Слой | Путь |
|---|---|
| UI списка и CRUD | `src/Components/Sectors/Barber/Services/Services.jsx` |
| Модалка услуги | `src/Components/Sectors/Barber/Services/components/ServiceModal.jsx` |
| Маппинг API → UI | `src/Components/Sectors/Barber/Services/BarberServicesUtils.js` |
| Маршруты CRM | `src/config/crmRoutes.jsx` (barber / services / dentistry) |
