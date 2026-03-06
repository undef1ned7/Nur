# Building: Клиенты, Договора, Процесс работ — Frontend API

Базовый URL:

```http
/api/building/
```

Авторизация:
- Все запросы требуют `Authorization: Bearer <token>`.
- Доступ ограничен компанией пользователя.

Права (функциональные роли):
- Клиенты: `can_view_building_clients`
- Договора: `can_view_building_treaty`
- Процесс работ: `can_view_building_work_process`
- `owner/admin/superuser` имеют полный доступ.

---

## 1) Клиенты (BuildingClient)

### Список / создание
- `GET /clients/`
- `POST /clients/`

Фильтры/поиск:
- `is_active`
- `search` (по `name/phone/email/inn`)

Пример create:

```json
{
  "name": "ОсОО Ромашка",
  "phone": "+996700000000",
  "email": "info@example.com",
  "inn": "123456789",
  "address": "г. Бишкек, ...",
  "notes": "Постоянный клиент",
  "is_active": true
}
```

### Детали / обновление / удаление
- `GET /clients/{id}/`
- `PATCH /clients/{id}/`
- `DELETE /clients/{id}/`

---

## 2) Договора (BuildingTreaty)

### Список / создание
- `GET /treaties/`
- `POST /treaties/`

Фильтры/поиск:
- `residential_complex`, `client`, `status`, `erp_sync_status`, `auto_create_in_erp`
- `search` (по `number/title/description/client/residential_complex`)

Пример create:

```json
{
  "residential_complex": "uuid-жк",
  "client": "uuid-клиента",
  "number": "ДГ-001",
  "title": "Договор подряда",
  "description": "Условия договора...",
  "amount": "150000.00",
  "status": "draft",
  "auto_create_in_erp": false
}
```

### Детали / обновление / удаление
- `GET /treaties/{id}/`
- `PATCH /treaties/{id}/`
- `DELETE /treaties/{id}/`

### Вложения (сканы/файлы)
- `POST /treaties/{id}/files/` (multipart/form-data)

Поля:
- `file` (обязательно)
- `title` (опционально)

### ERP: запросить создание договора
- `POST /treaties/{id}/erp/create/`

Важно:
- если ERP не настроена, договор помечается `erp_sync_status = not_configured`, а причина пишется в `erp_last_error`.
- настройки берутся из переменных окружения:
  - `BUILDING_ERP_TREATY_ENDPOINT`
  - `BUILDING_ERP_TOKEN` (опционально)

---

## 3) Процесс работ (BuildingWorkEntry)

### Список / создание
- `GET /work-entries/`
- `POST /work-entries/`

Фильтры/поиск:
- `residential_complex`, `category`, `created_by`, `client`, `treaty`
- `search` (по `title/description/ЖК/клиент/номер договора`)

Категории (`category`):
- `note`, `treaty`, `defect`, `report`, `other`

Пример create:

```json
{
  "residential_complex": "uuid-жк",
  "category": "defect",
  "title": "Технадзор: замечания по стенам",
  "description": "Выявлены трещины, требуется устранение.",
  "occurred_at": "2026-02-27T10:30:00+06:00"
}
```

### Детали / обновление / удаление
- `GET /work-entries/{id}/`
- `PATCH /work-entries/{id}/`
- `DELETE /work-entries/{id}/`

Правило:
- редактировать/удалять запись может **автор** или **owner/admin/superuser**.

### Фото к записи
- `POST /work-entries/{id}/photos/` (multipart/form-data)

Поля:
- `image` (обязательно)
- `caption` (опционально)

