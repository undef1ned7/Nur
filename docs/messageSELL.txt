# Услуги, тарифы и продажи (consalting) — документация для фронтенда

Услуга содержит **несколько тарифов** на выбор и **стоимость установки**. При продаже
выбираются услуга и тариф, можно добавить **доп. товары** (название + цена), указать
**скидку** (сумма) и **наценку сверху** (сумма). Итог `total` сервер считает сам.

Все запросы — с заголовком `Authorization: Bearer <access_token>`.
`company`/`branch` проставляются сервером из пользователя (read-only).

---

## 1. Услуги + тарифы

### Эндпоинты

```
GET    /api/consalting/services/
POST   /api/consalting/services/
GET    /api/consalting/services/<id>/
PATCH  /api/consalting/services/<id>/
PUT    /api/consalting/services/<id>/
DELETE /api/consalting/services/<id>/
```

### Поля услуги

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | read-only |
| `name` | string | Название услуги |
| `price` | decimal | Базовая цена (используется, если тариф не выбран) |
| `installation_price` | decimal | Стоимость установки (одна на услугу) |
| `description` | string | Описание (необязательно) |
| `tariffs` | array | Список тарифов `[{ id?, name, price }]` |
| `company`, `branch` | uuid | read-only, ставит сервер |
| `created_at`, `updated_at` | datetime | read-only |

### Создание услуги с тарифами

```http
POST /api/consalting/services/
```
```json
{
  "name": "Монтаж кондиционера",
  "price": 0,
  "installation_price": 3000,
  "description": "Установка под ключ",
  "tariffs": [
    { "name": "Базовый",  "price": 12000 },
    { "name": "Премиум",  "price": 18000 }
  ]
}
```

Ответ — услуга с проставленными `id` тарифов:

```json
{
  "id": "uuid",
  "company": "uuid",
  "branch": null,
  "name": "Монтаж кондиционера",
  "price": "0.00",
  "installation_price": "3000.00",
  "description": "Установка под ключ",
  "tariffs": [
    { "id": "uuid", "name": "Базовый", "price": "12000.00" },
    { "id": "uuid", "name": "Премиум", "price": "18000.00" }
  ],
  "created_at": "...",
  "updated_at": "..."
}
```

### Обновление тарифов

> **Важно:** `tariffs` работает по принципу **полной замены**. Если в `PATCH`
> передать `tariffs`, старый набор удаляется и создаётся заново из присланного списка
> (передавать `id` не обязательно — он переназначается). Чтобы **не трогать** тарифы,
> просто **не присылайте** поле `tariffs`.

```json
// PATCH — заменить весь набор тарифов
{ "tariffs": [ { "name": "Базовый", "price": 13000 }, { "name": "VIP", "price": 25000 } ] }

// PATCH — изменить только цену услуги, тарифы не трогаем
{ "installation_price": 3500 }
```

---

## 2. Продажи

### Эндпоинты

```
GET    /api/consalting/sales/
POST   /api/consalting/sales/
GET    /api/consalting/sales/<id>/
PATCH  /api/consalting/sales/<id>/
PUT    /api/consalting/sales/<id>/
DELETE /api/consalting/sales/<id>/
```

### Поля продажи

| Поле | Тип | Доступ | Описание |
|------|-----|--------|----------|
| `id` | uuid | read | — |
| `services` | uuid | write | Услуга |
| `tariff` | uuid \| null | write | Тариф выбранной услуги |
| `client` | uuid \| null | write | Клиент |
| `items` | array | write | Доп. товары `[{ id?, name, price }]` |
| `discount` | decimal | write | Скидка (сумма), по умолчанию 0 |
| `markup` | decimal | write | Наценка сверху (сумма), по умолчанию 0 |
| `description` | string | write | Заметка |
| `total` | decimal | **read-only** | Итог, считает сервер |
| `service_display` | string | read | Название услуги |
| `service_price` | decimal | read | Базовая цена услуги |
| `installation_price` | decimal | read | Стоимость установки услуги |
| `tariff_display` | string | read | Название тарифа |
| `tariff_price` | decimal | read | Цена тарифа |
| `user`, `user_display` | uuid/string | read | Оператор (текущий пользователь) |
| `client_display` | string | read | Имя/телефон клиента |
| `company`, `branch` | uuid | read | ставит сервер |
| `created_at`, `updated_at` | datetime | read | — |

### Формула итога

```
total = (цена тарифа, либо цена услуги если тариф не выбран)
        + стоимость установки услуги
        + сумма цен доп. товаров (items)
        − discount
        + markup
```

Пример: тариф `12000` + установка `3000` + товары `1500 + 800` − скидка `1000`
+ наценка `2000` = **`18300`**.

### Создание продажи

```http
POST /api/consalting/sales/
```
```json
{
  "services": "<service_uuid>",
  "tariff": "<tariff_uuid>",
  "client": "<client_uuid>",
  "discount": 1000,
  "markup": 2000,
  "items": [
    { "name": "Кронштейн",       "price": 1500 },
    { "name": "Доп. трасса 2 м", "price": 800 }
  ],
  "description": "Монтаж на балконе"
}
```

Ответ:

```json
{
  "id": "uuid",
  "company": "uuid",
  "branch": null,
  "user": "uuid",
  "user_display": "Иван Петров",
  "services": "<service_uuid>",
  "service_display": "Монтаж кондиционера",
  "service_price": "0.00",
  "installation_price": "3000.00",
  "tariff": "<tariff_uuid>",
  "tariff_display": "Базовый",
  "tariff_price": "12000.00",
  "client": "<client_uuid>",
  "client_display": "ОсОО Ромашка",
  "items": [
    { "id": "uuid", "name": "Кронштейн",       "price": "1500.00" },
    { "id": "uuid", "name": "Доп. трасса 2 м", "price": "800.00" }
  ],
  "discount": "1000.00",
  "markup": "2000.00",
  "total": "18300.00",
  "description": "Монтаж на балконе",
  "created_at": "...",
  "updated_at": "..."
}
```

### Обновление продажи

- `items` — **полная замена** (как `tariffs` у услуги): прислали список → старые
  товары удаляются, создаются новые; не прислали поле → товары не меняются.
- `total` пересчитывается автоматически после любого изменения
  (`tariff` / `services` / `items` / `discount` / `markup`).

```json
// добавить ещё один товар (нужно прислать ВЕСЬ список items)
{
  "items": [
    { "name": "Кронштейн", "price": 1500 },
    { "name": "Доп. трасса 2 м", "price": 800 },
    { "name": "Козырёк", "price": 1200 }
  ]
}

// сменить тариф (total пересчитается)
{ "tariff": "<other_tariff_uuid>" }

// убрать скидку
{ "discount": 0 }
```

---

## 3. Рекомендуемый UI-флоу

**Форма услуги:**
1. Поля: название, базовая цена, стоимость установки, описание.
2. Блок «Тарифы» — динамический список строк `{ название, цена }` (добавить/удалить).
3. Отправить всё одним `POST/PATCH` (тарифы вложены в тело).

**Форма продажи:**
1. Выбрать услугу → подгрузить её `tariffs` (из услуги или `GET /services/<id>/`).
2. Выбрать тариф из тарифов этой услуги.
3. Блок «Доп. товары» — динамический список `{ название, цена }`.
4. Поля «Скидка» и «Наценка сверху» (суммы).
5. Итог можно показывать на лету по формуле выше; «истинный» `total` придёт в ответе сервера.

---

## 4. Частые ошибки (валидация)

| Ситуация | Ответ |
|----------|-------|
| Тариф не принадлежит выбранной услуге | `400 { "tariff": "Тариф относится к другой услуге." }` |
| Тариф/услуга/клиент из другой компании | `400 { "<поле>": "... из другой компании." }` |
| Сущность из другого филиала | `400 { "<поле>": "... другого филиала." }` |
| Дубль названия тарифа в одной услуге | `400` (нарушение уникальности `service + name`) |

> `total`, `service_*`, `tariff_*`, `installation_price`, `user`, `company`, `branch` —
> read-only: присылать их в теле бессмысленно, сервер игнорирует/проставляет сам.
