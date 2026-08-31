# Платформенная админка NUR

**Дата:** 27.08.2026  
**Префикс API:** `/api/platform-admin/`  
**Фронт:** уже реализован в `src/Components/pages/PlatformAdmin/`, роут `/platform-admin`.

Пока эндпоинт отвечает `404`/`501`, UI показывает заглушку «раздел подключается» и не ломается. Как только API появится — данные подхватятся без доработок интерфейса.

| # | Файл | Что делаем | Приоритет |
|---|---|---|---|
| 1 | [backend/01-auth-and-access.md](./backend/01-auth-and-access.md) | Флаг `is_platform_admin`, guard, аудит | 1 |
| 2 | [backend/02-companies.md](./backend/02-companies.md) | Список/карточка/правка компаний, блокировка | 2 |
| 3 | [backend/03-subscription.md](./backend/03-subscription.md) | Тариф и `end_date` | 3 |
| 4 | [backend/04-users.md](./backend/04-users.md) | CRUD пользователей любой компании | 4 |
| 5 | [backend/05-password-and-impersonate.md](./backend/05-password-and-impersonate.md) | Сброс пароля, вход от имени | 5 |

---

## Зачем

Сотрудники NUR должны управлять аккаунтами клиентов **без Django Admin**: искать компании, править реквизиты и подписку, создавать/редактировать пользователей, сбрасывать пароли, входить от имени клиента для диагностики.

Это **не** раздел «Сотрудники» внутри компании (`/crm/employ` → `/users/employees/`). Платформенная админка работает **кросс-тенантно**.

---

## Общие соглашения

### Права

- Доступ ко **всем** эндпоинтам `/platform-admin/*` только если у пользователя `is_platform_admin === true`.
- Обычный `owner` / `admin` компании **не** получает доступ.
- Ответ без права: `403` с `{ "detail": "Недостаточно прав" }`.
- Неаутентифицированный: `401`.

### Формат списков

DRF-пагинация:

```json
{
  "count": 123,
  "next": "...",
  "previous": null,
  "results": []
}
```

Фронт шлёт `page` и `page_size` (20 / 50 / 100). Ограничьте максимум сотней.

### Поиск и фильтры

- `search` — icontains по полям, указанным в каждом разделе.
- Фильтры — query-параметры (`sector`, `plan`, `status` и т.д.).
- `ordering` — по желанию; фронт пока не шлёт, но поддержка не помешает.

### Ошибки

```json
{
  "detail": "Понятное сообщение на русском",
  "field_name": ["ошибка по полю"]
}
```

Фронт показывает `detail` или первое полевое сообщение пользователю дословно.

### Аудит

Каждое мутирующее действие (PATCH/POST/DELETE, reset-password, impersonate) должно писаться в журнал аудита (кто, когда, какой объект, diff или payload). Подробности — в [01-auth-and-access.md](./backend/01-auth-and-access.md).

### Мультитенантность

В обычном CRM queryset фильтруется по компании текущего пользователя. В `/platform-admin/` фильтр по компании **снимается** — доступ ко всем компаниям, но только для `is_platform_admin`.

### Что уже ждёт фронт

| Метод | Path |
|---|---|
| GET | `/platform-admin/meta/` |
| GET | `/platform-admin/companies/` |
| GET/PATCH | `/platform-admin/companies/:id/` |
| PATCH | `/platform-admin/companies/:id/subscription/` |
| GET/POST | `/platform-admin/companies/:id/users/` |
| GET/PATCH/DELETE | `/platform-admin/users/:id/` |
| POST | `/platform-admin/users/:id/reset-password/` |
| POST | `/platform-admin/users/:id/impersonate/` |

Клиент: [`src/api/platformAdmin.js`](../../src/api/platformAdmin.js).
