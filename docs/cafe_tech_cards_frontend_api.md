# Техкарты блюд (Кафе) — API для фронта

База: `/api/cafe/`

Авторизация: как у остальных эндпоинтов кафе (`Authorization: Bearer …`).

Филиал: при необходимости передавайте `?branch=<uuid>` (или заголовок/механизм, который уже используете в проекте для `CompanyBranchQuerysetMixin`). Scope блюд совпадает с `menu-items/`: видны позиции текущего филиала и «глобальные» (`branch = null`).

Связанный документ по калькуляции (редактирование состава, `dishes/.../ingredients/`): [cafe_costing_frontend_api.md](./cafe_costing_frontend_api.md).

---

## Сценарии на фронте

| Экран / действие | Эндпоинт |
|------------------|----------|
| Таблица «Технические карты», список блюд, пагинация, поиск | `GET /menu-items/` |
| Модалка «Скачать техкарты» — карточки с фильтром | `GET /menu-items/` (`search`, `category`) |
| PDF выбранных / всех с фильтром | `POST /tech-cards/export/` |
| Открытие техкарты одного блюда (нет кэша) | `POST /tech-cards/export/` с `dish_ids: [id]` |
| Обновление после изменения состава | `POST /tech-cards/export/` с `dish_ids: [id]` |

**Не вызывайте** для PDF/детали цепочку `GET menu-items/{id}` + `GET dishes/{id}/cost/` на каждое блюдо — полные данные отдаёт один запрос `tech-cards/export/`.

---

## 1) Список блюд

### `GET /api/cafe/menu-items/`

Пример: `https://app.nurcrm.kg/api/cafe/menu-items/?page=1&search=бургер&category=<uuid>`

#### Query

| Параметр | Описание |
|----------|----------|
| `page` | Страница (DRF pagination, обычно с `1`) |
| `search` | Поиск по `title` и `category__title` |
| `category` | UUID категории (опционально) |
| `kitchen` | UUID кухни (опционально) |
| `is_active` | `true` / `false` (опционально) |
| `ordering` | Например `title`, `-price`, `is_active` |
| `branch` | UUID филиала (если у вас так принято в API) |

#### Ответ

Стандартная пагинация DRF:

```json
{
  "count": 120,
  "next": "…",
  "previous": null,
  "results": [ … ]
}
```

#### Поля элемента `results[]` (основные для техкарт)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | ID блюда — передаётся в `dish_ids` экспорта |
| `title` | string | Название |
| `price` | string (Decimal) | Цена продажи |
| `category` | UUID \| null | Категория |
| `image_url` | string \| null | Абсолютный URL картинки |
| `is_active` | boolean | Активно в меню |
| `cost_price` | string | Себестоимость (может быть устаревшей до экспорта) |
| `margin_amount` | string | Маржа в сомах |
| `margin_percent_value` | string | Маржа % (поле модели) |
| `ingredients` | array | Состав: новая схема **или** legacy (см. ниже) |

Для таблицы техкарт и модалки скачивания достаточно `id`, `title`, `price`, `category`, `image_url`, `is_active`. Полный состав и актуальная себестоимость — из **экспорта**.

#### Маппинг фильтров UI → API

| UI (пример) | `GET menu-items/` |
|-------------|-------------------|
| `techcard_q` | `search` |
| `techcard_category` | `category` |

---

## 2) Экспорт полных техкарт

### `POST /api/cafe/tech-cards/export/`

Один запрос возвращает для каждого блюда: карточку, **актуальный** `cost` (после пересчёта на бэке) и `ingredients`.

#### Тело запроса

```json
{
  "dish_ids": ["12f8e2a0-…", "45a1b3c0-…"],
  "is_all": false,
  "search": "",
  "category_id": null
}
```

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `dish_ids` | UUID[] | Да*, если `is_all=false` | Выбранные ID из `menu-items` |
| `is_all` | boolean | Нет (default `false`) | Все блюда компании/филиала с учётом `search` и `category_id` |
| `search` | string | Нет | Фильтр по названию (`icontains`) |
| `category_id` | UUID \| null | Нет | Фильтр по категории |

\* Нужно **либо** непустой `dish_ids`, **либо** `is_all: true`. Иначе `400`:

```json
{
  "dish_ids": ["Укажите dish_ids или передайте is_all=true."]
}
```

#### Примеры сценариев

**Выбранные блюда (PDF / просмотр):**

```json
{
  "dish_ids": ["uuid-1", "uuid-2"],
  "is_all": false
}
```

**Все блюда с фильтрами модалки:**

```json
{
  "dish_ids": [],
  "is_all": true,
  "search": "суп",
  "category_id": "category-uuid"
}
```

**Одно блюдо после сохранения состава:**

```json
{
  "dish_ids": ["uuid-1"],
  "is_all": false
}
```

#### Ответ `200`

```json
{
  "count": 2,
  "items": [
    {
      "id": "12f8e2a0-…",
      "title": "Чизбургер",
      "image_url": "https://app.nurcrm.kg/media/…",
      "category_title": "Бургеры",
      "cost": {
        "cost_price": "142.50",
        "sale_price": "350.000",
        "margin_amount": "207.50",
        "margin_percent": "59.29"
      },
      "ingredients": [ … ]
    }
  ]
}
```

| Поле `items[]` | Описание |
|----------------|----------|
| `id` | UUID блюда |
| `title` | Название |
| `image_url` | Абсолютный URL или `null` |
| `category_title` | Название категории или `""` |
| `cost` | Себестоимость и маржа **после пересчёта** |
| `ingredients` | Состав (формат зависит от схемы, см. §3) |

Порядок `items` — по `title` (А→Я).

#### Ошибки

| Код | Когда |
|-----|--------|
| `400` | Нет `dish_ids` и `is_all=false`; невалидное тело; ошибка пересчёта (`detail`) |
| `400` | `{ "dish_ids": "Не найдены блюда: …" }` — ID не в scope компании/филиала |
| `403` | `{ "detail": "Компания не найдена." }` |

Числа в JSON — **строки** (Decimal), как в остальном Cafe API.

---

## 3) Формат `ingredients[]`

Бэкенд отдаёт **одну из двух** схем (у блюда не смешиваются в одном ответе экспорта).

### 3.1) Новая схема (`DishIngredient`)

Если у блюда есть хотя бы один `dish_ingredients`.

```json
{
  "id": "uuid",
  "dish": "uuid",
  "ingredient_type": "product",
  "product": "uuid",
  "product_title": "Соль",
  "preparation": null,
  "preparation_name": null,
  "quantity": "50.000000",
  "unit": "g",
  "unit_cost": "50.0000",
  "ingredient_cost": "2.50",
  "processing_cost": "0.00",
  "total_cost": "2.50",
  "processings": [
    {
      "id": "uuid",
      "ingredient": "uuid",
      "processing_type": "uuid",
      "processing_type_name": "Жарка",
      "preparation_processing": null,
      "preparation_processing_name": null,
      "charge_type": "fixed",
      "rate": "10.00",
      "cost": "10.00"
    }
  ],
  "created_at": "…",
  "updated_at": "…"
}
```

`ingredient_type`: `product` | `preparation`.

Для `preparation` заполнены `preparation`, `preparation_name`; в `processings` может быть `preparation_processing` вместо `processing_type`.

### 3.2) Legacy (`Ingredient` — старое меню)

Если `dish_ingredients` пусто — состав из связи меню → склад.

```json
{
  "id": "uuid",
  "product": "uuid",
  "product_title": "Картофель",
  "product_unit": "kg",
  "product_unit_price": "100.00",
  "amount": "0.500",
  "ingredient_cost": "50.00",
  "unit": "kg",
  "quantity_in_package": "1.000",
  "gross_unit": "…",
  "gross_kg": "…",
  "cold_loss_percent": "0.00",
  "net_kg": "…",
  "hot_loss_percent": "0.00",
  "output_ready_kg": "…",
  "cost_price_rub": "50.00",
  "cost_per_unit_rub": "…",
  "cost_per_unit_weight_rub": "…"
}
```

На фронте для PDF удобно ветвление: есть `ingredient_type` → новая карточка, иначе legacy-поля.

---

## 4) Поля `cost`

| Поле | Описание |
|------|----------|
| `cost_price` | Себестоимость блюда (ингредиенты + `other_expenses`) |
| `sale_price` | Цена продажи (`MenuItem.price`) |
| `margin_amount` | `sale_price - cost_price` |
| `margin_percent` | `(margin_amount / sale_price) * 100` |

Перед ответом бэкенд вызывает пересчёт (`recalculate_dish`) — значения в экспорте актуальнее, чем `cost_price` в списке `menu-items/`.

---

## 5) Рекомендации для фронта

1. **Список / чекбоксы** — только `GET menu-items/` (лёгкий ответ, пагинация).
2. **PDF и деталь** — один `POST tech-cards/export/`; кэшируйте `items` по `id` в store/памяти.
3. После `POST/PATCH/DELETE` на `dishes/.../ingredients/` или `dish-ingredients/...` — инвалидируйте кэш и снова `export` с `dish_ids: [id]`.
4. Не дублируйте запросы: `GET dishes/{id}/cost/` для массового PDF не нужен (остаётся для других экранов калькуляции, если уже используете).
5. При `is_all: true` учитывайте объём ответа; при очень большом меню можно предупредить пользователя или сузить `search` / `category_id`.

---

## 6) TypeScript (черновик типов)

```ts
type TechCardsExportRequest = {
  dish_ids?: string[];
  is_all?: boolean;
  search?: string;
  category_id?: string | null;
};

type TechCardCost = {
  cost_price: string;
  sale_price: string;
  margin_amount: string;
  margin_percent: string;
};

type TechCardExportItem = {
  id: string;
  title: string;
  image_url: string | null;
  category_title: string;
  cost: TechCardCost;
  ingredients: Record<string, unknown>[]; // union new | legacy
};

type TechCardsExportResponse = {
  count: number;
  items: TechCardExportItem[];
};
```

---

## 7) Чеклист интеграции

- [ ] Таблица техкарт: `GET /api/cafe/menu-items/?page=&search=&category=`
- [ ] Модалка скачивания: те же query + выбор `id` → `dish_ids` или `is_all` + те же `search` / `category_id` в POST
- [ ] PDF / просмотр: `POST /api/cafe/tech-cards/export/`
- [ ] Рендер состава: ветка по `ingredient_type` (новая) vs legacy
- [ ] После правки состава: повторный export одного `dish_ids`
