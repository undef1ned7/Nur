# 5. Сброс пароля и impersonate

**Фронт:** `CompanyUsersTab.jsx`, `impersonation.js`, баннер `ImpersonationBanner.jsx`.

## 5.1. Сброс пароля

### `POST /platform-admin/users/:id/reset-password/`

Тело пустое.

**Response 200:**

```json
{
  "generated_password": "Xy9!kLm2Pq"
}
```

**Поведение:**

1. Сгенерировать новый пароль (та же политика сложности, что при создании сотрудника).
2. Установить hash пользователю.
3. Инвалидировать существующие refresh-токены пользователя (рекомендуется).
4. Вернуть пароль **один раз** в ответе (не логировать в audit payload целиком — достаточно факта сброса).
5. Аудит: `user.reset_password`.

**Ошибки:** `404`, `403`.

## 5.2. Impersonate (вход от имени)

### `POST /platform-admin/users/:id/impersonate/`

Тело пустое.

**Response 200:**

```json
{
  "access": "<jwt>",
  "refresh": "<jwt>",
  "user_id": 1001
}
```

Фронт также принимает алиасы `accessToken` / `refreshToken`.

**Поведение на бэке:**

1. Проверить `is_platform_admin` у **текущего** (актора).
2. Найти целевого пользователя.
3. **Запретить** impersonate другого `is_platform_admin` / суперпользователя NUR → `403` `{ "detail": "Нельзя войти от имени платформенного администратора" }`.
4. Выдать обычную пару JWT **как будто** целевой пользователь залогинился (те же claims: user id, company, permissions).
5. В JWT или отдельном claim желательно пометить `impersonated_by: <actor_id>` для аудита на бэке (фронт это не читает).
6. Аудит: `user.impersonate` с `actor` и `target`.

**TTL:** access — как обычно; можно укоротить access для impersonate (например 1–2 часа).

## 5.3. Что делает фронт

1. Сохраняет текущие токены админа в `localStorage.platformAdminSession`.
2. Пишет метаданные цели в `platformAdminImpersonating` (`userId`, `email`, `name`).
3. Подставляет `access` / `refresh` цели, редирект на `/crm`.
4. Показывает баннер «Вы вошли от имени …» с кнопкой выхода.
5. Выход: восстанавливает токены из `platformAdminSession`, чистит ключи, возвращает на `/platform-admin/companies/:id`.

Бэкенду **не** нужен отдельный «stop impersonate» — это клиентская смена токенов. Refresh цели не должен уметь «вернуться» к админу сам по себе.

## 5.4. Безопасность

| Правило | Зачем |
|---|---|
| Только `is_platform_admin` | Клиенты не получают API |
| Нельзя impersonate другого platform admin | Эскалация |
| Аудит каждого входа | Расследования |
| Не класть пароли/токены в логи | Утечки |
| Rate-limit на reset-password / impersonate | Злоупотребления |
| Опционально: IP allowlist для `/platform-admin/` | Внутренний контур |

## 5.5. Logout

При `logout` фронт чистит и обычные токены, и `platformAdminSession` / `platformAdminImpersonating`. Дополнительных эндпоинтов не требуется.
