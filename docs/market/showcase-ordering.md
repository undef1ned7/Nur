# Публичная витрина — сортировка списка товаров

**Страница:** `/catalog/:slug` (фронт: `src/Components/Sectors/Market/Catalog/Catalog.jsx`)  
**Эндпоинт:** `GET /main/public/companies/{slug}/showcase/`  
**Статус:** ⚠️ Требуется реализация/проверка на бэкенде — фронт передаёт `ordering`, локальная пересортировка отключена.

---

## 1. Контекст

Пользователь на публичной витрине выбирает сортировку в `<select>`. Значение сохраняется в URL (`?sort=price_desc`) и при каждой загрузке списка уходит на API как query-параметр `ordering`.

**До изменения:** фронт дублировал сортировку локально (fallback на случай, если бэкенд игнорирует `ordering`).  
**После изменения:** порядок товаров полностью определяет бэкенд. Фронт отображает массив `results` как пришёл из API.

---

## 2. Запрос с фронта

### Пример

```
GET /main/public/companies/my-shop/showcase/
  ?page=1
  &page_size=100
  &search=iphone
  &category=3f2a1b0c-...-uuid
  &ordering=-final_price
```

### Параметры (релевантные для сортировки)

| Параметр | Тип | Обязательный | Описание |
|---|---|---|---|
| `page` | int | нет (default `1`) | Номер страницы |
| `page_size` | int | нет (фронт шлёт `100`) | Размер страницы |
| `search` | string | нет | Поиск по названию (если поддерживается) |
| `category` | uuid/string | нет | Фильтр по категории |
| `ordering` | string | нет | Поле сортировки (см. §3) |

Параметр `sort` в URL — **только фронтовый**; на API не передаётся.

---

## 3. Маппинг UI → `ordering`

Фронт преобразует `sort` из URL в `ordering` для API:

| UI (`?sort=`) | `ordering` в API | Подпись в интерфейсе |
|---|---|---|
| *(пусто)* | параметр не отправляется | По умолчанию |
| `name_asc` | `name` | Название: А–Я |
| `name_desc` | `-name` | Название: Я–А |
| `price_asc` | `final_price` | Цена: дешевле сначала |
| `price_desc` | `-final_price` | Цена: дороже сначала |
| `discount_asc` | `discount_percent` | Скидка: меньше сначала |
| `discount_desc` | `-discount_percent` | Скидка: больше сначала |

Префикс `-` — сортировка по убыванию (стандарт DRF `OrderingFilter`).

---

## 4. Требуемое поведение бэкенда

### 4.1. Поддерживаемые поля `ordering`

| Значение | Смысл | Рекомендуемая логика |
|---|---|---|
| `name` / `-name` | Название | `Coalesce(name, title)` или аналог; locale-aware сортировка (`ru_RU`) |
| `final_price` / `-final_price` | Цена для покупателя | `final_price`, fallback на `price` если `final_price` NULL |
| `discount_percent` / `-discount_percent` | Скидка, % | числовое поле; NULL трактовать как `0` |

### 4.2. Сортировка по умолчанию

Если `ordering` **не передан** — вернуть стабильный порядок по умолчанию, например:

```
-ordering_priority, -created_at, name
```

или текущий порядок витрины в CRM (если есть поле `showcase_order` / `position`).

Главное: порядок должен быть **детерминированным** (одинаковый при повторных запросах).

### 4.3. Совместно с фильтрами и пагинацией

1. Сначала фильтрация (`search`, `category`, только товары витрины компании).
2. Затем сортировка по `ordering` **на полном наборе**, до `LIMIT/OFFSET`.
3. Пагинация (`page`, `page_size`) применяется **после** сортировки.

Иначе при `page_size=100` пользователь увидит «локально отсортированную» только текущую страницу, а не весь каталог.

### 4.4. Невалидный `ordering`

При неизвестном значении:

- **Вариант A (рекомендуется):** `400 Bad Request` с `{"detail": "Недопустимое значение ordering: ..."}`.
- **Вариант B:** игнорировать и вернуть порядок по умолчанию (хуже для отладки).

Фронт сейчас шлёт только значения из таблицы §3.

### 4.5. Формат ответа

Без изменений — paginated list:

```json
{
  "count": 245,
  "next": "...",
  "previous": null,
  "results": [
    {
      "id": "...",
      "name": "...",
      "title": "...",
      "price": "1500.00",
      "final_price": "1200.00",
      "discount_percent": 20,
      "category": "...",
      "category_title": "...",
      "image_url": "...",
      "is_new": false
    }
  ]
}
```

Поля элемента списка — как в текущем сериализаторе витрины; для сортировки критичны `name`/`title`, `final_price`/`price`, `discount_percent`.

---

## 5. Чек-лист для бэкенда

- [ ] `OrderingFilter` (или эквивалент) на view `.../showcase/`
- [ ] Whitelist полей: `name`, `final_price`, `discount_percent` (+ `-` для desc)
- [ ] `final_price`: fallback на `price` при NULL
- [ ] `discount_percent`: NULL → 0
- [ ] `name`: учёт `title` если `name` пустой
- [ ] Сортировка до пагинации
- [ ] Стабильный default ordering без параметра
- [ ] (опционально) тесты: каждый `ordering`, комбинация с `search` + `category`

---

## 6. Примеры для ручной проверки

```bash
# По умолчанию (без ordering)
curl "/main/public/companies/{slug}/showcase/?page_size=100"

# Дешевле сначала
curl "/main/public/companies/{slug}/showcase/?page_size=100&ordering=final_price"

# Дороже сначала
curl "/main/public/companies/{slug}/showcase/?page_size=100&ordering=-final_price"

# Название А–Я
curl "/main/public/companies/{slug}/showcase/?page_size=100&ordering=name"

# Скидка больше сначала + категория
curl "/main/public/companies/{slug}/showcase/?page_size=100&category={uuid}&ordering=-discount_percent"
```

**Ожидание:** порядок `results` на странице 1 соответствует выбранному полю; при переходе на страницу 2 порядок глобально продолжается (не «пересортировка внутри страницы»).

---

## 7. Связанные эндпоинты

| Метод | Путь | Сортировка |
|---|---|---|
| `GET` | `/main/public/companies/{slug}/showcase/` | **этот документ** |
| `GET` | `/main/public/companies/{slug}/showcase/{id}/` | не применимо (один товар) |

Аналогичная витрина production (`/production/:slug`, `ProductionShowcase.jsx`) пока **не** отправляет `ordering`; при добавлении сортировки там — использовать тот же контракт API.
