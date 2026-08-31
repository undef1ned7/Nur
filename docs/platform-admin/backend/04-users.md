# 4. Пользователи компаний

**Фронт:** `CompanyUsersTab.jsx`, `UserEditModal.jsx`.  
Паттерн полей совместим с `/users/employees/` (Masters), но scope — **любая** компания по `company_id` в URL.

## 4.1. Список

### `GET /platform-admin/companies/:company_id/users/`

**Query:** `page`, `page_size`, опционально `search` (email, ФИО).

**Response item:**

```json
{
  "id": 1001,
  "email": "owner@romashka.kg",
  "first_name": "Айгуль",
  "last_name": "Асанова",
  "phone_number": "+996700000000",
  "role": "owner",
  "custom_role": null,
  "role_display": "Владелец",
  "custom_role_name": null,
  "is_active": true,
  "branches": [1, 2],
  "can_view_cashbox": true,
  "can_view_employees": true,
  "can_view_settings": true
}
```

Все известные `can_view_*` флаги пользователя отдавайте в том же объекте — фронт собирает их для формы доступов.

## 4.2. Создание

### `POST /platform-admin/companies/:company_id/users/`

**Body:**

```json
{
  "email": "cashier@romashka.kg",
  "first_name": "Иван",
  "last_name": "Иванов",
  "phone_number": "+996…",
  "role": "admin",
  "custom_role": null,
  "branches": [1],
  "is_active": true,
  "can_view_cashbox": true,
  "can_view_sale": true
}
```

**Правила:**

- Пользователь создаётся **в указанной компании** (`company_id` из URL), не в компании админа.
- Роль: либо системная `role` (`owner` \| `admin` \| …), либо `custom_role` (FK). Как в employees: взаимоисключающе.
- Email уникален глобально (как сейчас в системе). Конфликт → `400` `{ "email": ["Пользователь с таким email уже существует"] }`.
- Пароль генерируется на бэке (тот же механизм, что `POST /users/employees/create/`).

**Response 201:**

```json
{
  "id": 1002,
  "email": "cashier@romashka.kg",
  "first_name": "Иван",
  "last_name": "Иванов",
  "role": "admin",
  "generated_password": "Ab12Cd34!",
  "can_view_cashbox": true
}
```

`generated_password` показывается **один раз** на фронте.

Аудит: `user.create`.

## 4.3. Карточка / правка / удаление

### `GET /platform-admin/users/:id/`

Полный объект пользователя + `company_id` / краткая `company: { id, name }`.

### `PATCH /platform-admin/users/:id/`

Те же поля, что при создании (без обязательного email-уникального конфликта с самим собой). Можно менять `can_view_*`, `branches`, `role` / `custom_role`, `is_active`, ФИО, телефон, email.

**Ограничения (рекомендуемые):**

- Нельзя снять последнего `owner` у компании без назначения другого — `400` с понятным `detail`.
- Нельзя через этот API выставить себе или другому `is_platform_admin` — поле игнорируется или `403`.

Аудит: `user.patch`.

### `DELETE /platform-admin/users/:id/`

Мягкое или жёсткое удаление — как в текущем `/users/employees/:id/`. Фронт предупреждает, если `role === owner`.

Аудит: `user.delete`.

**404** если пользователя нет.

## 4.4. Связь с существующим API

Не ломайте `/users/employees/*` — он остаётся для tenant-админов внутри своей компании.  
`/platform-admin/users/*` — обход tenant-фильтра + расширенный доступ для NUR.
