# 1. Доступ и аудит

**Фронт:** `platformAdminAccess.js`, `PlatformAdminGuard.jsx`, пункт меню «Админка» (`requirePlatformAdmin`), поле профиля `is_platform_admin`.

## 1.1. Флаг на пользователе

Добавьте (или прокиньте из существующего `User.is_staff` / отдельной группы) булево поле, которое отдаётся в `GET /users/profile/`:

```json
{
  "id": 1,
  "email": "support@nurcrm.kg",
  "role": "admin",
  "is_platform_admin": true
}
```

| Поле | Тип | Описание |
|---|---|---|
| `is_platform_admin` | `bool` | `true` только у сотрудников NUR. Клиентам никогда не выставлять. |

**Рекомендация:** отдельное поле / permission, не путать с `role === "admin"` внутри компании клиента. Владелец любой компании не должен автоматически становиться платформенным админом.

Выдача флага — только через Django Admin / management command / суперпользователя NUR. Самообслуживания нет.

## 1.2. Permission class

Все viewsets `/platform-admin/`:

```python
class IsPlatformAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "is_platform_admin", False) is True
        )
```

Ответы:

| Код | Когда |
|---|---|
| `401` | Нет / битый JWT |
| `403` | JWT ок, но `is_platform_admin` не true |

## 1.3. Профиль

`GET /users/profile/` **обязан** включать `is_platform_admin` (default `false`). Без этого фронт не покажет меню и не пустит на `/platform-admin`.

## 1.4. Аудит

Модель (пример):

```python
class PlatformAdminAuditLog(models.Model):
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=64)  # company.patch, user.create, ...
    object_type = models.CharField(max_length=64)  # company | user
    object_id = models.CharField(max_length=64)
    company_id = models.IntegerField(null=True, blank=True)
    payload = models.JSONField(default=dict, blank=True)  # diff / безопасный срез
    ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

Обязательные `action`:

- `company.patch`
- `company.subscription`
- `user.create`
- `user.patch`
- `user.delete`
- `user.reset_password`
- `user.impersonate`

В `payload` **не** сохраняйте пароли и refresh-токены. Для impersonate достаточно `target_user_id` + `email`.

## 1.5. Meta

### `GET /platform-admin/meta/`

Справочники для фильтров и форм.

**Response 200:**

```json
{
  "sectors": [
    { "id": 1, "name": "Кафе", "slug": "cafe" }
  ],
  "plans": [
    { "id": 1, "name": "Старт" },
    { "id": 2, "name": "Бизнес" }
  ],
  "roles": [
    { "id": 10, "name": "Кассир", "company_id": null }
  ]
}
```

| Поле | Описание |
|---|---|
| `sectors` | Все отрасли / industries (как в `/users/industries/`) |
| `plans` | Тарифные планы (`/users/subscription-plans/`) |
| `roles` | Опционально: глобальные/системные роли для подсказок. Кастомные роли компании фронт также может взять из карточки компании (`custom_roles`) |

Фронт принимает алиасы `industries` / `subscription_plans`, но предпочтительны `sectors` / `plans`.
