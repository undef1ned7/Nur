# Building — Frontend API (полная документация)

Документация API модуля Building для фронтенда: ЖК, квартиры, договора, закупки, склад, касса, зарплата, задачи и процесс работ.

---

## Базовые настройки

### Базовый URL

```http
/api/building/
```

### Аутентификация

- Все запросы требуют `Authorization: Bearer <token>`.
- Доступ ограничен **компанией** пользователя (multi-tenant).

### Форматы данных

- **Даты**: `YYYY-MM-DD`
- **Дата-время**: ISO 8601, например `2026-03-10T10:00:00+06:00`
- **Денежные поля**: строка или число, в ответах обычно строка (`"10000.00"`)

### Пагинация

- DRF `PageNumberPagination`, `PAGE_SIZE=100`.
- Ответ списка:

```json
{
  "count": 123,
  "next": "...?page=2",
  "previous": null,
  "results": []
}
```

### Ошибки

| Код | Описание |
|-----|----------|
| `401` | Нет/невалидный токен |
| `403` | Нет прав / чужая компания / ограничение бизнес-правил |
| `404` | Объект не найден или недоступен |
| `400` | Ошибки валидации: `{"field_name": ["Сообщение"]}` |

### Права (функциональные роли)

| Право | Описание |
|-------|----------|
| `can_view_building_treaty` | Квартиры, продажи, договора |
| `can_view_building_clients` | Клиенты |
| `can_view_building_work_process` | Процесс работ |
| `can_view_building_salary` | Зарплата |
| `can_view_building_cash_register` | Касса (выплаты ЗП, рассрочки) |
| `can_view_building_procurement` | Закупки |
| `can_view_building_stock` | Склад |
| `can_view_building_employess` | Сотрудники ЖК |

`owner` / `admin` / `superuser` имеют расширенные права.

---

## 0) ЖК (ResidentialComplex)

### Список / создание

- `GET /objects/`
- `POST /objects/`

**Видимость списка:**
- Без назначений на ЖК → все ЖК компании
- С назначениями → только назначенные ЖК
- `owner/admin/superuser` → все ЖК компании

### Детали / обновление / удаление

- `GET /objects/{id}/`
- `PATCH /objects/{id}/`
- `DELETE /objects/{id}/`

### Назначение сотрудников на ЖК

- `GET /objects/{residential_complex_id}/members/` — список
- `POST /objects/{residential_complex_id}/members/` — назначить
- `DELETE /objects/{residential_complex_id}/members/{user_id}/` — снять

Тело `POST`:
```json
{
  "user": "uuid-сотрудника",
  "is_active": true
}
```

### Этажи по ЖК

- `GET /objects/{residential_complex_id}/floors/`

Ответ:
```json
[
  {"floor": 1, "total": 10, "available": 8, "reserved": 1, "sold": 1},
  {"floor": 2, "total": 12, "available": 12, "reserved": 0, "sold": 0}
]
```

### Поля ЖК

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | ID |
| `company` | uuid | Компания (read-only) |
| `name` | string | Название |
| `address` | string | Адрес |
| `description` | string | Описание |
| `salary_cashbox` | uuid \| null | Касса для ЗП по умолчанию (**Building**, не construction) |
| `is_active` | bool | Активен |
| `created_at`, `updated_at` | datetime | Даты |

---

## 1) Касса Building (своя система)

> **Важно:** Building использует **собственную** систему касс (`BuildingCashbox`), не связанную с `construction`. Для выплат ЗП, рассрочек и т.п. используйте эндпоинты `/api/building/cashboxes/` и `/api/building/cash/`.

### 1.1) Кассы

- `GET /cashboxes/` — список касс компании
- `POST /cashboxes/` — создать кассу
- `GET /cashboxes/{id}/` — детали
- `PATCH /cashboxes/{id}/` — обновить
- `DELETE /cashboxes/{id}/` — удалить

Тело создания:
```json
{
  "name": "Основная касса Building",
  "branch": "uuid-филиала или null"
}
```

Ответ:
```json
{
  "id": "uuid",
  "company": "uuid",
  "branch": "uuid|null",
  "name": "string",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### 1.2) Движения по кассе

- `GET /cash/flows/` — список
- `POST /cash/flows/` — создать (ручной приход/расход)
- `GET /cash/flows/{id}/` — детали
- `PATCH /cash/flows/{id}/` — обновить
- `DELETE /cash/flows/{id}/` — удалить
- `PATCH /cash/flows/bulk/status/` — массовое одобрение/отклонение

**Фильтры `GET /cash/flows/`:**
- `?cashbox=<uuid>`

Тело создания движения:
```json
{
  "cashbox": "uuid-кассы",
  "type": "income|expense",
  "name": "Наименование",
  "amount": "1000.00",
  "status": "pending|approved|rejected"
}
```

Массовое обновление статуса:
```json
{
  "items": [
    {"id": "uuid-движения", "status": "approved"},
    {"id": "uuid-движения-2", "status": "rejected"}
  ]
}
```

**Бизнес-логика:**
- При одобрении (`approved`) движения с `source_business_operation_id` (выплата ЗП) автоматически проводится связанная операция.
- Оплата рассрочки создаёт приход сразу в статусе `approved`.

---

## 2) Квартиры (ResidentialComplexApartment)

- `GET /apartments/`
- `POST /apartments/`
- `GET /apartments/{id}/`
- `PATCH /apartments/{id}/`
- `DELETE /apartments/{id}/`

**Фильтры:** `residential_complex`, `floor`, `status`, `search`

**Статусы:** `available` | `reserved` | `sold`

Тело создания:
```json
{
  "residential_complex": "uuid-жк",
  "floor": 5,
  "number": "5-12",
  "rooms": 2,
  "area": "54.60",
  "price": "72000.00",
  "status": "available",
  "notes": ""
}
```

---

## 3) Чертежи (ResidentialComplexDrawing)

- `GET /drawings/`
- `POST /drawings/` (multipart/form-data)
- `GET /drawings/{id}/`
- `PATCH /drawings/{id}/` (multipart/form-data)
- `DELETE /drawings/{id}/`

**Поля POST:** `residential_complex`, `title`, `file`, `description`, `is_active`

---

## 4) Клиенты (BuildingClient)

- `GET /clients/`
- `POST /clients/`
- `GET /clients/{id}/` — с вложенными `treaties`
- `PATCH /clients/{id}/`
- `DELETE /clients/{id}/`

**Фильтры:** `is_active`, `search` (name/phone/email/inn)

---

## 5) Договора (BuildingTreaty)

- `GET /treaties/`
- `POST /treaties/`
- `GET /treaties/{id}/`
- `PATCH /treaties/{id}/`
- `DELETE /treaties/{id}/`

**Фильтры:** `residential_complex`, `client`, `status`, `operation_type`, `payment_type`, `apartment`, `search`

**Перечисления:**
- `operation_type`: `sale` | `booking`
- `payment_type`: `full` | `installment`
- `status`: `draft` | `active` | `signed` | `cancelled`

### Оплата рассрочки

- `GET /treaty-installments/{id}/payments/` — состояние платежа
- `POST /treaty-installments/{id}/payments/` — оплатить

Тело:
```json
{
  "amount": "10000.00",
  "cashbox": "uuid-кассы-building",
  "paid_at": "2026-04-01T10:00:00+06:00"
}
```

> `cashbox` — из **Building** (`/api/building/cashboxes/`).

### Файлы договора

- `POST /treaties/{id}/files/` (multipart: `file`, `title`)

### ERP

- `POST /treaties/{id}/erp/create/`

---

## 6) Закупки и склад

> Подробнее: `docs/building_procurement_frontend_api.md`

### Закупки

- `GET /procurements/`, `POST /procurements/`
- `GET /procurements/{id}/`, `PATCH /procurements/{id}/`, `DELETE /procurements/{id}/`
- `POST /procurements/{id}/submit-to-cash/` — отправить в кассу

### Позиции закупки

- `GET /procurement-items/`, `POST /procurement-items/`
- `GET /procurement-items/{id}/`, `PATCH /procurement-items/{id}/`, `DELETE /procurement-items/{id}/`

### Касса (одобрение закупок)

- `GET /cash/procurements/pending/`
- `POST /cash/procurements/{id}/approve/` — тело: `{"reason": "..."}`
- `POST /cash/procurements/{id}/reject/` — тело: `{"reason": "..."}` (обязательно)

### Передачи на склад

- `POST /procurements/{id}/transfers/create/` — создать передачу
- `GET /warehouse-transfers/`
- `GET /warehouse-transfers/{id}/`
- `POST /warehouse-transfers/{id}/accept/`
- `POST /warehouse-transfers/{id}/reject/`

### Документы закупки (warehouse-style)

- `GET /documents/purchase/`, `POST /documents/purchase/`
- `GET /documents/purchase/{id}/`, `PATCH /documents/purchase/{id}/`, `DELETE /documents/purchase/{id}/`
- `POST /documents/purchase/{id}/cash/approve/`
- `POST /documents/purchase/{id}/cash/reject/`

### Товары

- `GET /products/`, `POST /products/`
- `GET /products/{id}/`, `PATCH /products/{id}/`, `DELETE /products/{id}/`

### Остатки и движения

- `GET /warehouse-stock/items/`
- `GET /warehouse-stock/moves/`

### Workflow-события

- `GET /workflow-events/` — история действий

---

## 7) Процесс работ (BuildingWorkEntry)

- `GET /work-entries/`
- `POST /work-entries/`
- `GET /work-entries/{id}/`
- `PATCH /work-entries/{id}/`
- `DELETE /work-entries/{id}/`

**Фото:** `POST /work-entries/{id}/photos/` (multipart: `image`, `caption`)

**Файлы:** `POST /work-entries/{id}/files/` (multipart: `file`)

**Фильтры:** `residential_complex`, `category`, `created_by`, `client`, `treaty`, `search`

**Категории:** `note`, `treaty`, `defect`, `report`, `other`

---

## 8) Задачи (BuildingTask)

- `GET /tasks/`
- `POST /tasks/`
- `GET /tasks/{id}/`
- `PATCH /tasks/{id}/`
- `DELETE /tasks/{id}/`

**Статусы:** `open` | `done` | `cancelled`

**Поля:** `assignee_ids` (write), `assignees` (read), `checklist_items` (read)

**Чек-лист:**
- `POST /tasks/{task_id}/checklist-items/` — добавить: `{"text": "...", "order": 1}`
- `PATCH /task-checklist-items/{id}/` — изменить: `{"is_done": true}`

---

## 9) Зарплата (Building Payroll)

**Права:** `can_view_building_salary` + `can_view_building_cash_register` для выплат.

### Сотрудники

- `GET /salary/employees/`
- `PATCH /salary/employees/{user_id}/compensation/` — настройки ЗП: `salary_type`, `base_salary`, `sale_commission_type`, `sale_commission_value`, `is_active`, `notes`

**Типы оплаты (`salary_type`):** `monthly` (оклад месяц), `monthly_pct` (оклад + % от продаж), `daily` (ставка день), `hourly` (ставка час).

**Оклад + % (`monthly_pct`):** при выборе указывайте `sale_commission_type` = `percent` и `sale_commission_value` (например `2.5` для 2.5%). При подписании договора продажи автоматически создаётся премия в строке начисления ответственного.

### Периоды

- `GET /salary/payrolls/`, `POST /salary/payrolls/`
- `GET /salary/payrolls/{id}/`, `PATCH /salary/payrolls/{id}/`, `DELETE /salary/payrolls/{id}/`
- `POST /salary/payrolls/{id}/approve/` — начислить (`status=approved`)

**Статусы периода:** `draft` | `approved` | `paid`

### Строки начислений

- `GET /salary/payrolls/{payroll_id}/lines/`
- `POST /salary/payrolls/{payroll_id}/lines/` — `{"employee": "uuid", "base_amount": "45000.00", "comment": ""}`

### Корректировки

- `GET /salary/payroll-lines/{id}/adjustments/` — список корректировок
- `POST /salary/payroll-lines/{id}/adjustments/` — типы: `bonus`, `deduction`, `advance`
- `DELETE /salary/payroll-adjustments/{id}/`

Для аванса (`advance`) в теле:
```json
{
  "type": "advance",
  "amount": "10000.00",
  "cashbox": "uuid-кассы-building",
  "paid_at": "2026-03-10T10:00:00+06:00"
}
```

### Выплаты

- `GET /salary/payroll-lines/{id}/payments/` — список выплат
- `POST /salary/payroll-lines/{id}/payments/` — создать выплату

Тело:
```json
{
  "amount": "10000.00",
  "cashbox": "uuid-кассы-building",
  "paid_at": "2026-03-10T10:00:00+06:00"
}
```

> `cashbox` — из **Building** (`/api/building/cashboxes/`).

**Бизнес-правила:**
- Выплаты только при `status=approved` периода
- `amount <= (net_to_pay - paid_total)`
- Создаётся `BuildingCashFlow` (expense, pending) → одобрение через `PATCH /cash/flows/bulk/status/` проводит выплату

### Мои начисления

- `GET /salary/my/lines/` — сотрудник видит только свои строки

### Заявки на аванс (для кассы)

Оператор кассы (`can_view_building_cash_register`) просматривает и обрабатывает заявки на аванс.

- `GET /salary/advance-requests/` — список заявок со статусом `pending`
  - Фильтры: `?cashbox=uuid`, `?residential_complex=uuid`, `?payroll=uuid`
- `POST /salary/advance-requests/{id}/approve/` — одобрить (сумма снимается с net_to_pay, движение кассы проводится)
  - Тело (опционально): `{"paid_at": "2026-03-10T14:00:00+06:00"}`
- `POST /salary/advance-requests/{id}/reject/` — отклонить

---

## 10) Ограничения по ЖК

Если сотруднику назначены ЖК, он видит и может изменять данные **только по этим ЖК** во всех эндпоинтах Building.

`owner` / `admin` / `superuser` не ограничиваются назначениями.

**Рекомендации для фронта:**
- Хранить текущий «контекст ЖК» и передавать `residential_complex` при создании/редактировании
- Список ЖК брать из `GET /objects/` — он уже отфильтрован по доступу

---

## Сводная таблица эндпоинтов

| Раздел | Метод | Путь |
|--------|-------|------|
| **Касса** | GET/POST | `/cashboxes/` |
| | GET/PATCH/DELETE | `/cashboxes/{id}/` |
| | GET/POST | `/cash/flows/` |
| | GET/PATCH/DELETE | `/cash/flows/{id}/` |
| | PATCH | `/cash/flows/bulk/status/` |
| **ЖК** | GET/POST | `/objects/` |
| | GET/PATCH/DELETE | `/objects/{id}/` |
| | GET | `/objects/{id}/floors/` |
| | GET/POST | `/objects/{id}/members/` |
| | DELETE | `/objects/{id}/members/{user_id}/` |
| **Квартиры** | GET/POST | `/apartments/` |
| | GET/PATCH/DELETE | `/apartments/{id}/` |
| **Чертежи** | GET/POST | `/drawings/` |
| | GET/PATCH/DELETE | `/drawings/{id}/` |
| **Клиенты** | GET/POST | `/clients/` |
| | GET/PATCH/DELETE | `/clients/{id}/` |
| **Договора** | GET/POST | `/treaties/` |
| | GET/PATCH/DELETE | `/treaties/{id}/` |
| | POST | `/treaties/{id}/files/` |
| | POST | `/treaties/{id}/erp/create/` |
| | GET/POST | `/treaty-installments/{id}/payments/` |
| **Зарплата** | GET | `/salary/employees/` |
| | PATCH | `/salary/employees/{id}/compensation/` |
| | GET/POST | `/salary/payrolls/` |
| | GET/PATCH/DELETE | `/salary/payrolls/{id}/` |
| | POST | `/salary/payrolls/{id}/approve/` |
| | GET/POST | `/salary/payrolls/{id}/lines/` |
| | GET/PATCH/DELETE | `/salary/payroll-lines/{id}/` |
| | GET/POST | `/salary/payroll-lines/{id}/adjustments/` |
| | DELETE | `/salary/payroll-adjustments/{id}/` |
| | GET/POST | `/salary/payroll-lines/{id}/payments/` |
| | GET | `/salary/my/lines/` |
| | GET | `/salary/advance-requests/` |
| | POST | `/salary/advance-requests/{id}/approve/` |
| | POST | `/salary/advance-requests/{id}/reject/` |
| **Задачи** | GET/POST | `/tasks/` |
| | GET/PATCH/DELETE | `/tasks/{id}/` |
| | POST | `/tasks/{id}/checklist-items/` |
| | PATCH/DELETE | `/task-checklist-items/{id}/` |
| **Процесс работ** | GET/POST | `/work-entries/` |
| | GET/PATCH/DELETE | `/work-entries/{id}/` |
| | POST | `/work-entries/{id}/photos/` |
| | POST | `/work-entries/{id}/files/` |
