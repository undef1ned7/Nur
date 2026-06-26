# Warehouse Sales Summary API (Сводки продаж)

Спецификация REST/JSON-контракта для раздела **«Сводка»** на странице
`/crm/warehouse/documents/sale`. PDF **не** генерируется бэкендом — бэкенд возвращает только
JSON, PDF строится на фронтенде (`@react-pdf/renderer`). Один и тот же контракт используется
Web и Mobile.

- Базовый URL: `https://app.nurcrm.kg/api`
- Авторизация: `Authorization: Bearer <accessToken>` (как у остального warehouse API)
- Мультиарендность: все запросы неявно ограничены компанией пользователя (`company`)
- Тип ответа списков: DRF-пагинация (`count`, `next`, `previous`, `results`)

---

## Сущность Summary

Сводка — это **снапшот** накладных продаж за конкретную дату (опционально по выбранным
агентам). Снапшот фиксируется при создании, чтобы документ был воспроизводим и не «плыл» при
изменении накладных. Пересобрать снапшот можно через `regenerate`.

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | Идентификатор |
| `number` | string | Человекочитаемый номер (`СВ-000123`), генерируется бэком |
| `name` | string | Название («Общая сводка», «Утренняя», «Вечерняя», «Сводка агентов») |
| `comment` | string | Комментарий (хранится и выводится в PDF) |
| `date` | date (`YYYY-MM-DD`) | Дата сводки (день, за который собраны накладные) |
| `type` | enum | `general` \| `by_agents` |
| `warehouse` | object | `{ id, name }` |
| `created_by` | object | `{ id, full_name }` — автор |
| `created_at` | datetime | Время создания |
| `updated_at` | datetime | Время изменения |
| `agents` | array | Выбранные агенты (только для `by_agents`): `{ id, full_name, code }` |
| `documents` | array | Накладные, вошедшие в сводку (см. ниже) |
| `products` | array | Готовая агрегированная таблица товаров (см. ниже) |
| `totals` | object | Итоги (см. ниже) |

### document (накладная в сводке)
```jsonc
{ "id", "number", "date", "agent", "client", "address",
  "quantity", "weight", "amount" }
```

### product (строка агрегированной товарной таблицы — уже готова для PDF)
```jsonc
{ "name", "unit", "packages", "per_package",
  "quantity", "price", "amount", "weight" }
```
Агрегация: одинаковые товары из всех накладных суммируются (`GROUP BY` по
номенклатуре + единице + цене). `packages` — кол-во упаковок, `per_package` — единиц в упаковке.

### totals
```jsonc
{ "documents_count", "products_count",
  "total_quantity", "total_weight", "total_amount" }
```

---

## Полный пример GET /warehouse/summaries/{id}/

```jsonc
{
  "id": "9b1c…",
  "number": "СВ-000042",
  "name": "Общая сводка",
  "comment": "Доставка по городу",
  "date": "2026-06-26",
  "type": "by_agents",
  "warehouse": { "id": "…", "name": "Основной склад" },
  "created_by": { "id": "…", "full_name": "Иванов И.И." },
  "created_at": "2026-06-26T07:40:11Z",
  "updated_at": "2026-06-26T07:40:11Z",
  "agents": [
    { "id": "…", "full_name": "Петров П.", "code": "A-01" },
    { "id": "…", "full_name": "Сидоров С.", "code": "A-07" }
  ],
  "documents": [
    { "id": "…", "number": "НАКЛ-001", "date": "2026-06-26",
      "agent": "Петров П.", "client": "ООО Ромашка",
      "address": "ул. Ленина 1", "quantity": 120, "weight": 240.5, "amount": 35000 }
  ],
  "products": [
    { "name": "Мука в/с", "unit": "кг", "packages": 10, "per_package": 50,
      "quantity": 500, "price": 60, "amount": 30000, "weight": 500 }
  ],
  "totals": {
    "documents_count": 12, "products_count": 34,
    "total_quantity": 1840, "total_weight": 3120.4, "total_amount": 415000
  }
}
```

---

## Эндпоинты

### 1. Список — `GET /warehouse/summaries/`
Возвращает облегчённые карточки (без `documents`/`products`).

**Query-параметры (комбинируются логическим И):**

| Параметр | Описание |
|----------|----------|
| `date` | Точная дата `YYYY-MM-DD` |
| `date_from`, `date_to` | Период |
| `agent` | id агента; повторяемый (`?agent=a&agent=b`) или CSV |
| `author` | id автора |
| `type` | `general` \| `by_agents` |
| `search` | Поиск по названию (`name`) |
| `ordering` | `date`, `-date`, `created_at`, `-created_at`, `name` |
| `page`, `page_size` | Пагинация (по умолчанию 20, максимум 100) |

**Ответ:**
```jsonc
{
  "count": 57, "next": "…?page=2", "previous": null,
  "results": [
    { "id", "number", "name", "type", "date",
      "created_by": { "id", "full_name" },
      "agents_count", "documents_count", "total_amount", "created_at" }
  ]
}
```

### 2. Календарь — `GET /warehouse/summaries/calendar/?month=YYYY-MM`
Агрегат количества сводок по дням месяца (для индикаторов в календаре).
```jsonc
{ "month": "2026-06",
  "days": [ { "date": "2026-06-26", "count": 4 }, { "date": "2026-06-25", "count": 1 } ] }
```

### 3. Создание — `POST /warehouse/summaries/`
```jsonc
// Request
{ "name": "Утренняя", "comment": "…", "type": "by_agents",
  "date": "2026-06-26", "warehouse": "…",
  "agents": ["agentId1", "agentId2"] }   // agents игнорируется при type=general
```
- `type=general` → в снапшот попадают **все** накладные продаж за `date`.
- `type=by_agents` → только накладные выбранных агентов за `date`.
- Бэкенд формирует снапшот (`documents`, `products`, `totals`), присваивает `number`, `created_by`.
- **Response:** `201` + полный объект Summary (как в GET by id).

### 4. Одна сводка — `GET /warehouse/summaries/{id}/`
Полный объект (структура выше).

### 5. Обновление — `PATCH /warehouse/summaries/{id}/`
Изменяемые поля: `name`, `comment`, `type`, `agents`.
При изменении `type`/`agents` снапшот пересобирается автоматически (или явно через `regenerate`).
**Response:** `200` + полный объект.

### 6. Удаление — `DELETE /warehouse/summaries/{id}/`
**Response:** `204`.

### 7. Пересборка снапшота — `POST /warehouse/summaries/{id}/regenerate/`
Пересобирает `documents`/`products`/`totals` по текущим накладным даты и фильтру агентов.
**Response:** `200` + полный объект.

---

## Производительность

Система может содержать десятки тысяч накладных, тысячи клиентов, сотни агентов.

- **Снапшот при создании**, а не live-агрегация на каждый просмотр → быстрый `GET by id`.
- Агрегация товаров одним запросом `GROUP BY (product, unit, price)` с `SUM(quantity)`,
  `SUM(amount)`, `SUM(weight)` — без N+1.
- Накладные и агенты грузятся через `select_related`/`prefetch_related`.
- **Индексы:**
  - `summary(company, date)` — список/календарь по дате,
  - `summary(company, type)`, `summary(company, created_by)` — фильтры,
  - `summary(company, name)` (или trigram) — поиск,
  - M2M `summary_agents(summary_id, agent_id)`,
  - снапшот-таблицы `summary_document(summary_id)`, `summary_product(summary_id)`.
- Календарь — единый агрегирующий запрос `GROUP BY date` за месяц.
- Пагинация обязательна (`page_size` ≤ 100). Тяжёлые `documents`/`products` отдаются только в `GET by id`.

---

## Права доступа

- Доступ к разделу — как к sale-документам склада (владелец/админ/менеджер склада).
- Роль `agent` не создаёт/не удаляет сводки (read-only или скрытие вкладки) — согласовать с
  текущей моделью прав.
- Все операции ограничены компанией пользователя.
