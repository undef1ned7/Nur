# Company Slug API — документация для фронта

Редактируемый **slug компании** (вкладка «Онлайн», `/crm/set`). Используется в публичных
путях: `app.nurcrm.kg/{slug}` (`/service/{slug}/booking`, `/catalog/{slug}`).

- Базовый URL: `https://app.nurcrm.kg/api`
- Авторизация: `Authorization: Bearer <accessToken>`
- Доступ: владелец/админ компании.

---

## Формат slug

- Разрешено: строчные латинские `a-z`, цифры `0-9`, дефис `-`.
- Запрещено: пробелы, кириллица, спецсимволы, точки, `_`, двойной дефис `--`, дефис по краям.
- Длина: **3..50**.
- Регэксп: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- Сервер сам нормализует вход (lowercase + trim) перед проверкой — фронт-валидация дублирует, но не заменяет бэкенд.

---

## 1. Проверка доступности (без сохранения)

`GET /users/company/check-slug/?slug=<value>`

Для живой проверки с дебаунсом при вводе. Текущий slug своей компании считается доступным.

**200 — свободен:**
```json
{ "available": true }
```

**200 — занят или невалиден:**
```json
{ "available": false, "message": "Slug already exists" }
```
```json
{ "available": false, "message": "Slug должен быть от 3 до 50 символов." }
```

Поле `message` присутствует только при `available: false`.

---

## 2. Сохранение slug

`PATCH /users/settings/company/`

```json
{ "slug": "my-company" }
```

**Ответы:**

| Код | Когда | Тело |
|-----|-------|------|
| `200` | сохранено (или no-op, если slug не изменился) | обновлённый объект компании с новым `slug` |
| `400` | неверный формат/длина | `{ "slug": ["<сообщение>"] }` |
| `409` | slug занят другой компанией | `{ "slug": ["Slug already exists"] }` |

Сохранение идёт в транзакции с уникальным индексом по `lower(slug)` — гонки двух запросов
тоже отдадут `409`.

---

## Пример (axios)

```js
// debounce-проверка
const { data } = await api.get("/users/company/check-slug/", { params: { slug } });
if (!data.available) showError(data.message);

// сохранение
try {
  const { data: company } = await api.patch("/users/settings/company/", { slug });
  // company.slug — новое значение
} catch (e) {
  const status = e.response?.status;       // 400 | 409
  const msg = e.response?.data?.slug?.[0]; // текст ошибки для поля slug
  showError(msg);
}
```

> Примечание: уникальность проверяется без учёта регистра — `My-Company` и `my-company`
> считаются одним slug. Отправляйте как есть, нормализацию сделает сервер.
