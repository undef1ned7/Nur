# 2. Компании

**Фронт:** `CompaniesList.jsx`, `CompanyDetail.jsx` (вкладка «Реквизиты»).

## 2.1. Список

### `GET /platform-admin/companies/`

**Query:**

| Параметр | Описание |
|---|---|
| `search` | icontains по `name`, `slug`, `inn`, email владельца |
| `sector` | id или slug сектора |
| `plan` | id тарифа или имя |
| `status` | `active` \| `expired` \| `blocked` \| `missing_date` |
| `page`, `page_size` | пагинация |
| `ordering` | опционально: `name`, `-end_date`, `created_at` |

Логика `status`:

| Значение | Условие |
|---|---|
| `blocked` | `is_active === false` |
| `expired` | `is_active` и `end_date < today` (календарная дата, Asia/Bishkek) |
| `missing_date` | `is_active` и `end_date` пустой/невалидный |
| `active` | `is_active` и `end_date >= today` |

**Response item:**

```json
{
  "id": 42,
  "name": "Кафе Ромашка",
  "slug": "romashka",
  "inn": "12345678901234",
  "is_active": true,
  "end_date": "2026-12-31",
  "sector": { "id": 3, "name": "Кафе" },
  "subscription_plan": { "id": 1, "name": "Старт" },
  "created_at": "2025-01-10T12:00:00Z"
}
```

Допустимы плоские алиасы `sector_name`, `subscription_plan_name` — фронт их тоже читает.

## 2.2. Деталь

### `GET /platform-admin/companies/:id/`

**Response 200** — расширенный объект:

```json
{
  "id": 42,
  "name": "Кафе Ромашка",
  "slug": "romashka",
  "llc": "ОсОО Ромашка",
  "inn": "12345678901234",
  "okpo": "",
  "score": "",
  "bik": "",
  "address": "Бишкек, …",
  "phones_howcase": "+996…",
  "is_active": true,
  "end_date": "2026-12-31",
  "support_note": "Оплатили до декабря",
  "sector": { "id": 3, "name": "Кафе" },
  "sector_id": 3,
  "subscription_plan": { "id": 1, "name": "Старт" },
  "subscription_plan_id": 1,
  "branches": [
    { "id": 1, "name": "Центр" }
  ],
  "custom_roles": [
    { "id": 10, "name": "Официант" }
  ]
}
```

| Поле | Обязательно для UI |
|---|---|
| реквизиты (`name`, `llc`, `inn`, …) | да |
| `slug`, `sector` / `sector_id` | да |
| `is_active` | да (блокировка) |
| `end_date`, `subscription_plan` | да (вкладка подписки) |
| `branches` | желательно (назначение филиалов пользователям) |
| `custom_roles` | желательно (роли компании) |
| `support_note` | опционально |

**404** если компании нет.

## 2.3. Правка

### `PATCH /platform-admin/companies/:id/`

**Body (все поля опциональны):**

```json
{
  "name": "Кафе Ромашка",
  "llc": "ОсОО Ромашка",
  "inn": "12345678901234",
  "okpo": null,
  "score": null,
  "bik": null,
  "address": "…",
  "phones_howcase": "…",
  "slug": "romashka",
  "sector_id": 3,
  "is_active": true
}
```

**Поведение:**

- `is_active: false` — блокирует вход **всем** пользователям компании (логин → понятная ошибка «компания заблокирована»).
- Смена `slug` — проверить уникальность; при конфликте `400` `{ "slug": ["Такой slug уже занят"] }`.
- Смена `sector_id` — валидный FK; фронт не мигрирует данные сектора сам — на бэке либо разрешить с осторожностью, либо вернуть `400` с пояснением, если сектор «жёстко» привязан к данным.
- Ответ — полный объект как в GET detail.
- Аудит: `company.patch`.

## 2.4. Блокировка и логин

При `Company.is_active === false` эндпоинты `/users/auth/login/` и refresh должны отказывать с `403`:

```json
{ "detail": "Компания заблокирована. Обратитесь в поддержку NUR." }
```

Платформенный админ при impersonate в заблокированную компанию — на усмотрение (рекомендуется **разрешить** для диагностики, с записью в аудит).
