# Warehouse Sales Summary API (Сводки продаж) — для фронта

Раздел «Сводка» на странице `/crm/warehouse/documents/sale`. Сводка — **снапшот** накладных
продаж за дату по складу (опц. по агентам). PDF строится на фронте, бэкенд отдаёт только JSON.

- Базовый URL: `https://app.nurcrm.kg/api`
- Авторизация: `Authorization: Bearer <accessToken>`
- Мультиарендность: всё неявно ограничено компанией пользователя.
- Пагинация: DRF (`count/next/previous/results`), `page_size` по умолчанию 20, максимум 100.

---

## Объект Summary (полный, GET by id)

```jsonc
{
  "id": "uuid",
  "number": "СВ-000042",
  "name": "Общая сводка",
  "comment": "Доставка по городу",
  "date": "2026-06-26",
  "type": "general | by_agents",
  "warehouse": { "id": "uuid", "name": "Основной склад" },
  "created_by": { "id": "uuid", "full_name": "Иванов И.И." },
  "created_at": "2026-06-26T07:40:11Z",
  "updated_at": "2026-06-26T07:40:11Z",
  "agents":   [ { "id": "uuid", "full_name": "Петров П.", "code": "A-01" } ],
  "documents":[ { "id","number","date","agent","client","address","quantity","weight","amount" } ],
  "products": [ { "name","unit","packages","per_package","quantity","price","amount","weight" } ],
  "totals":   { "documents_count","products_count","total_quantity","total_weight","total_amount" }
}
```

`documents`/`products` отдаются **только** в GET by id (в списке их нет).

---

## Эндпоинты

### 1. Список — `GET /warehouse/summaries/`
Облегчённые карточки (без documents/products).

Query (комбинируются И): `date`, `date_from`, `date_to`, `agent` (повторяемый `?agent=a&agent=b`
или CSV), `author`, `type`, `search` (по name), `ordering` (`date|-date|created_at|-created_at|name`),
`page`, `page_size`.

```jsonc
{ "count":57, "next":"…?page=2", "previous":null,
  "results":[ { "id","number","name","type","date",
    "created_by":{"id","full_name"},
    "agents_count","documents_count","total_amount","created_at" } ] }
```

### 2. Календарь — `GET /warehouse/summaries/calendar/?month=YYYY-MM`
```jsonc
{ "month":"2026-06", "days":[ {"date":"2026-06-26","count":4} ] }
```

### 3. Создание — `POST /warehouse/summaries/`
```jsonc
{ "name":"Утренняя", "comment":"…", "type":"by_agents",
  "date":"2026-06-26", "warehouse":"uuid",
  "agents":["agentId1","agentId2"] }   // agents игнорируется при type=general
```
- `general` → все накладные продаж за `date` по складу.
- `by_agents` → только накладные выбранных агентов.
- **201** + полный объект (как GET by id). `number`/`created_by`/снапшот формирует бэк.

### 4. Деталь — `GET /warehouse/summaries/{id}/`
Полный объект.

### 5. Обновление — `PATCH /warehouse/summaries/{id}/`
Поля: `name`, `comment`, `type`, `agents`. При смене `type`/`agents` снапшот пересобирается
автоматически. **200** + полный объект. (`warehouse`/`date` менять нельзя.)

### 6. Удаление — `DELETE /warehouse/summaries/{id}/` → **204**.

### 7. Пересборка — `POST /warehouse/summaries/{id}/regenerate/`
Пересобирает снапшот по текущим накладным. **200** + полный объект.

---

## Права и поведение
- Создавать/менять/удалять/пересобирать: владелец/админ/сотрудник компании. Чистый агент — read-only (`403` на запись).
- В снапшот входят накладные `SALE` за `date` по складу сводки, кроме статуса `REJECTED`.
- `weight` товара = кол-во × фактический вес из характеристик (или кол-во для весовых, иначе 0).
- `packages` = quantity / per_package (per_package — из первой упаковки товара, иначе 1).

---

## Пример (axios)
```js
// создать
const { data } = await api.post("/warehouse/summaries/", {
  name: "Утренняя", type: "by_agents", date: "2026-06-26",
  warehouse: whId, agents: [a1, a2],
});
// список с фильтром
await api.get("/warehouse/summaries/", { params: { date_from, date_to, type, page_size: 50 } });
// пересобрать
await api.post(`/warehouse/summaries/${id}/regenerate/`);
```
