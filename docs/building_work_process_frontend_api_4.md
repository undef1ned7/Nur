## Building — Frontend API (подробно)

Базовый URL:

```http
/api/building/
```

Авторизация:
- Все запросы требуют `Authorization: Bearer <token>`.
- Доступ всегда ограничен **компанией** пользователя (multi-tenant).

Временная зона/форматы:
- Сервер: `Asia/Bishkek`
- Даты: `YYYY-MM-DD`
- Дата-время: ISO 8601, пример: `2026-03-10T10:00:00+06:00`
- Денежные поля: строка или число, в ответах обычно строка (`"10000.00"`).

Пагинация:
- По умолчанию используется DRF `PageNumberPagination`, `PAGE_SIZE=100`.
- Типичный ответ списка:

```json
{
  "count": 123,
  "next": "...?page=2",
  "previous": null,
  "results": []
}
```

Фильтры/поиск:
- `search=<text>` — полнотекстовый поиск по указанным полям (см. разделы).
- Фильтрация через query params (см. `filterset_fields` в разделах).

Типовые ошибки:
- `401 Unauthorized`: нет/невалидный токен
- `403 Forbidden`: нет прав/другая компания/ограничение бизнес-правил
- `404 Not Found`: объект не найден (или недоступен в вашей компании)
- `400 Bad Request`: ошибки валидации, формат стандартный DRF:

```json
{
  "field_name": ["Сообщение об ошибке"]
}
```

Права (функциональные роли — частично):
- Квартиры/продажи/договора: `can_view_building_treaty`
- Клиенты: `can_view_building_clients`
- Процесс работ: `can_view_building_work_process`
- Зарплата: `can_view_building_salary`
- Касса (для выплаты ЗП через кассу): `can_view_building_cash_register`
- `owner/admin/superuser` имеют расширенные права.

---

## 0) ЖК (ResidentialComplex)

### Список / создание
- `GET /objects/`
- `POST /objects/`

Поведение списка:
- если у пользователя **нет ни одного назначения на ЖК** (см. 0.1), он видит **все ЖК своей компании**;
- если хотя бы один ЖК назначен, он видит **только назначенные ЖК**;
- `owner/admin/superuser` всегда видят все ЖК компании, независимо от назначений.

### Детали / обновление / удаление
- `GET /objects/{id}/`
- `PATCH /objects/{id}/`
- `DELETE /objects/{id}/`

### 0.1) Назначение сотрудников на ЖК (ограничение видимости)

Смысл:
- Если сотруднику назначили **1+ ЖК**, то в модуле Building он **видит и может изменять данные только по этим ЖК** (для всех эндпоинтов, где есть привязка к ЖК: квартиры, чертежи, договора, процесс работ, закупки/склад, задачи и т.д.).
- Если назначений нет, он видит все данные своей компании (при наличии соответствующих функциональных прав).
- `owner/admin/superuser` не ограничиваются назначениями и всегда видят все ЖК компании.

Пример бизнес-сценария:
- есть 3 ЖК: `A`, `B`, `C`;
- сотруднику назначили только `A`;
- везде в модуле Building (списки, детали, создание/редактирование) он:
  - видит только данные по `A`;
  - не увидит и не сможет создать/редактировать сущности, привязанные к `B` или `C` (получит `403` или `404`).

Эндпоинты:
- `GET /objects/{residential_complex_id}/members/` — список назначений на ЖК
- `POST /objects/{residential_complex_id}/members/` — назначить сотрудника
- `DELETE /objects/{residential_complex_id}/members/{user_id}/` — снять назначение

Кто может управлять назначениями (доступ к самому эндпоинту):
- `owner/admin/superuser`, либо пользователи с доступом к сотрудникам.

Пример назначения сотрудника:

```json
{
  "user": "uuid-сотрудника",
  "is_active": true
}
```

### 0.2) Как именно работают ограничения по ЖК (важно для фронта)

Общее правило:
- во всех эндпоинтах, где есть явная ссылка на ЖК (`residential_complex`, `residential_complex_id`, склад ЖК, квартира ЖК и т.д.), данные на backend уже **отфильтрованы по назначенным ЖК пользователя**;
- фронту **не нужно** дополнительно фильтровать по ЖК для безопасности, но можно фильтровать для удобства UX.

Где применяются ограничения (неполный, но важный список):
- **ЖК**:
  - `GET /objects/`
  - `GET /objects/{id}/`
  - `GET /objects/{residential_complex_id}/floors/`
- **Квартиры**:
  - `GET /apartments/`
  - `GET /apartments/{id}/`
  - `POST /apartments/` (создание в неразрешённом ЖК вернёт `403`)
- **Чертежи**:
  - `GET /drawings/`
  - `GET /drawings/{id}/`
  - `POST /drawings/`
- **Закупки/склад**:
  - закупки (`/procurements/`, `/documents/purchase/` и связанные) фильтруются по ЖК;
  - склады ЖК (`/warehouses/`, остатки и движения склада) фильтруются по ЖК;
  - передача на склад (`/transfers/` и операции `accept/reject`) также проверяют ЖК.
- **Клиенты/договоры**:
  - список клиентов `/clients/` при наличии назначений ограничивается только теми клиентами, у которых есть договоры по доступным ЖК;
  - список/детали договоров `/treaties/` фильтруются по ЖК.
- **Процесс работ**:
  - `/work-entries/`, `/work-entries/{id}/`, `/work-entries/{id}/photos/` — возвращают и создают записи только по доступным ЖК.
- **Задачи**:
  - `/tasks/` и связанные чек-листы — при наличии назначений задачи, привязанные к ЖК, ограничиваются этими ЖК.

Типичные ошибки, связанные с доступом по ЖК:
- `403 Forbidden`:
  - попытка создать/изменить объект с `residential_complex`, к которому пользователь не назначен;
  - пример: пользователь назначен только на `A`, но фронт отправляет `residential_complex = B` в `POST /apartments/`.
- `404 Not Found`:
  - запрос деталей объекта по `id`, который относится к другому ЖК (backend «прячет» такие объекты).

Рекомендации для фронта:
- всегда хранить текущий «контекст ЖК» (выбранный ЖК) и:
  - передавать его `id` в поля `residential_complex` во всех запросах создания/редактирования;
  - не давать пользователю выбирать из списка ЖК те, к которым он не назначен (можно брать список из `GET /objects/`).
- не полагаться на фронтовую логику безопасности:
  - backend всё равно проверяет компанию и назначения;
  - фронту достаточно корректно обрабатывать `403/404` и не показывать лишние элементы UI.

---

## 1) Продажа/бронь квартир (этаж → квартира → клиент → договор)

### 1.1) Этажи по ЖК (шаг выбора этажа)
- `GET /objects/{residential_complex_id}/floors/`

Ответ: список этажей с агрегатами по статусам квартир:

```json
[
  {"floor": 1, "total": 10, "available": 8, "reserved": 1, "sold": 1},
  {"floor": 2, "total": 12, "available": 12, "reserved": 0, "sold": 0}
]
```

### 1.2) Квартиры (ResidentialComplexApartment)

Эндпоинты:
- `GET /apartments/`
- `POST /apartments/`
- `GET /apartments/{id}/`
- `PATCH /apartments/{id}/`
- `DELETE /apartments/{id}/`

Фильтры/поиск:
- `residential_complex`, `floor`, `status`
- `search` (по `number/notes`)

Статусы квартир:
- `available` — доступна
- `reserved` — забронирована (обычно договор `operation_type=booking`)
- `sold` — продана (обычно договор `operation_type=sale`)

Поля квартиры (ответ):
- `id`, `residential_complex`, `residential_complex_name`
- `floor`, `number`, `rooms`, `area`, `price`, `status`, `notes`
- `created_at`, `updated_at`

Пример создания квартиры:

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

### 1.3) Бизнес-правила продажи/брони
- При создании договора с `apartment` квартира должна быть `status=available`.
- После создания договора:
  - `operation_type=sale` → квартира становится `sold`
  - `operation_type=booking` → квартира становится `reserved`
- При удалении договора квартира возвращается в `available`, если нет других активных договоров на эту квартиру.
- При `PATCH /treaties/{id}/` и переводе договора в `status=cancelled` квартира тоже возвращается в `available` (если нет других активных договоров на эту квартиру).

---

## 2) Чертежи ЖК (ResidentialComplexDrawing)

Эндпоинты:
- `GET /drawings/`
- `POST /drawings/` (multipart/form-data)
- `GET /drawings/{id}/`
- `PATCH /drawings/{id}/` (multipart/form-data)
- `DELETE /drawings/{id}/`

Фильтры/поиск:
- `residential_complex`, `is_active`
- `search` (по `title/description/ЖК`)

Поля `POST /drawings/` (multipart/form-data):
- `residential_complex` (uuid, обязательно)
- `title` (строка, обязательно)
- `file` (файл, обязательно)
- `description` (строка, опционально)
- `is_active` (bool, опционально)

Ответ содержит:
- `file` (путь в media) и `file_url` (абсолютный URL, если доступно)

---

## 3) Клиенты (BuildingClient)

Эндпоинты:
- `GET /clients/`
- `POST /clients/`
- `GET /clients/{id}/`
- `PATCH /clients/{id}/`
- `DELETE /clients/{id}/`

Фильтры/поиск:
- `is_active`
- `search` (по `name/phone/email/inn`)

Карточка клиента:
- `GET /clients/{id}/` дополнительно возвращает `treaties`:
  - квартира (`apartment_number`, `apartment_floor`)
  - тип операции (`operation_type`)
  - условия оплаты (`payment_type`, `down_payment`, `payment_terms`)
  - рассрочка (`installments`)
  - файлы договора (`files`)

---

## 4) Договора / сделки по квартирам (BuildingTreaty)

Эндпоинты:
- `GET /treaties/`
- `POST /treaties/`
- `GET /treaties/{id}/`
- `PATCH /treaties/{id}/`
- `DELETE /treaties/{id}/`

Фильтры/поиск:
- `residential_complex`, `client`, `status`, `erp_sync_status`, `auto_create_in_erp`, `operation_type`, `payment_type`, `apartment`
- `search` (по `number/title/description/client/residential_complex/apartment`)

Перечисления:
- `operation_type`: `sale` / `booking`
- `payment_type`: `full` / `installment`
- `status`: `draft` / `active` / `signed` / `cancelled`
- `installments[].status` (в ответе): `planned` / `paid`

Автогенерация номера:
- поле `number` можно не передавать — номер сгенерируется автоматически в формате `ДГ-000001` (по компании).

### 4.1) Создание договора (продажа/бронь)

Поля (ключевые):
- `residential_complex` (uuid, обязательно)
- `client` (uuid, опционально)
- `apartment` (uuid, для продажи/брони квартиры — обязательно)
- `operation_type` (sale/booking)
- `payment_type` (full/installment)
- `amount` (сумма договора)
- `down_payment` (первоначальный взнос)
- `payment_terms` (текст)
- `installments` (только при `payment_type=installment`)

Пример `payment_type=installment`:

```json
{
  "residential_complex": "uuid-жк",
  "client": "uuid-клиента",
  "apartment": "uuid-квартиры",
  "operation_type": "sale",
  "payment_type": "installment",
  "down_payment": "30000.00",
  "payment_terms": "Рассрочка на 12 месяцев",
  "amount": "150000.00",
  "installments": [
    {"order": 1, "due_date": "2026-04-01", "amount": "10000.00"},
    {"order": 2, "due_date": "2026-05-01", "amount": "10000.00"}
  ],
  "status": "draft",
  "auto_create_in_erp": false
}
```

Валидации по рассрочке:
- `installments` можно передавать только при `payment_type=installment`.
- сумма `down_payment + sum(installments.amount)` должна быть равна `amount`.

### 4.2) Редактирование рассрочки

Редактирование идет через `PATCH /treaties/{id}/`:
- при `payment_type=installment` и наличии поля `installments` график **перезаписывается целиком**.
- если поменять `payment_type` на `full`, рассрочка очищается.

### 4.3) Файлы договора

Загрузка файла:
- `POST /treaties/{id}/files/` (multipart/form-data)

Поля:
- `file` (обязательно)
- `title` (опционально)

Ответ:
- список `files` с `file_url` (если доступно)

### 4.4) ERP

- `POST /treaties/{id}/erp/create/`

Если ERP не настроена:
- `erp_sync_status = not_configured`
- причина в `erp_last_error`

---

## 5) Процесс работ (BuildingWorkEntry)

Эндпоинты:
- `GET /work-entries/`
- `POST /work-entries/`
- `GET /work-entries/{id}/`
- `PATCH /work-entries/{id}/`
- `DELETE /work-entries/{id}/`

Фильтры/поиск:
- `residential_complex`, `category`, `created_by`, `client`, `treaty`
- `search` (по `title/description/ЖК/клиент/номер договора`)

Категории:
- `note`, `treaty`, `defect`, `report`, `other`

Фото к записи:
- `POST /work-entries/{id}/photos/` (multipart/form-data)
  - `image` (обязательно)
  - `caption` (опционально)

Правило:
- редактировать/удалять может **автор** или **owner/admin/superuser**.

---

## 6) Напоминания / задачи (BuildingTask)

Эндпоинты:
- `GET /tasks/`
- `POST /tasks/`
- `GET /tasks/{id}/`
- `PATCH /tasks/{id}/`
- `DELETE /tasks/{id}/`

Кто видит задачу:
- автор
- отмеченные сотрудники (`assignee_ids`)
- `owner/admin/superuser` (по компании)

Статусы:
- `open`, `done`, `cancelled`

Поля задачи (важное):
- `assignee_ids` (write-only): список UUID сотрудников (только вашей компании)
- `assignees` (read-only): список `{id, display}`
- `checklist_items` (read-only): пункты чек-листа

Чек-лист:
- добавить пункт: `POST /tasks/{task_id}/checklist-items/` с телом:

```json
{"text": "Подготовить договор", "order": 1}
```

- изменить/отметить: `PATCH /task-checklist-items/{id}/`:

```json
{"is_done": true}
```

---

## 7) Зарплата сотрудников (Building Payroll)

Права:
- начисления/управление: `can_view_building_salary` (или `owner/admin/superuser`)
- выплата через кассу: дополнительно `can_view_building_cash_register` (или `owner/admin/superuser`)

### 7.1) Сотрудники и настройки оклада/ставки

Список сотрудников компании:
- `GET /salary/employees/`

Ответ (пример полей):
- `id`, `display`
- `compensation_id` (если настройки есть)
- `salary_type`, `base_salary`, `is_active`

Настроить оклад/ставку:
- `PATCH /salary/employees/{user_id}/compensation/`

Поля:
- `salary_type`: `monthly|daily|hourly`
- `base_salary`: сумма
- `is_active`: bool
- `notes`: строка

### 7.2) Периоды начислений

Список / создание:
- `GET /salary/payrolls/`
- `POST /salary/payrolls/`

Статусы периода:
- `draft` — редактирование разрешено
- `approved` — начислено, выплаты разрешены
- `paid` — автоматически, когда по всем строкам выплачено полностью

Пример create:

```json
{
  "title": "ЗП за март 2026",
  "period_start": "2026-03-01",
  "period_end": "2026-03-31"
}
```

Детали / обновление / удаление:
- `GET /salary/payrolls/{id}/`
- `PATCH /salary/payrolls/{id}/` (только `draft`)
- `DELETE /salary/payrolls/{id}/` (только `draft`)

Начислить:
- `POST /salary/payrolls/{id}/approve/` → `status=approved`

### 7.3) Строки начислений

Список/добавление строк:
- `GET /salary/payrolls/{payroll_id}/lines/`
- `POST /salary/payrolls/{payroll_id}/lines/` (только `draft`)

Пример создания строки:

```json
{
  "employee": "uuid-сотрудника",
  "base_amount": "45000.00",
  "comment": ""
}
```

Если `base_amount` не передан — берется `base_salary` из настроек сотрудника (если есть), иначе `0.00`.

Корректировки:
- добавить: `POST /salary/payroll-lines/{id}/adjustments/`
- удалить: `DELETE /salary/payroll-adjustments/{id}/`

Типы корректировок:
- `bonus`, `deduction`, `advance`

Правило целостности:
- система не даст привести строку к переплате: `paid_total > net_to_pay`.

### 7.4) Выплаты (частичные) + касса

Список выплат строки:
- `GET /salary/payroll-lines/{id}/payments/`

Создать выплату:
- `POST /salary/payroll-lines/{id}/payments/`

Поля:
- `amount` (обязательно)
- `cashbox` (uuid кассы, обязательно)
- `shift` (uuid смены, опционально)
- `paid_at` (опционально)

Пример:

```json
{
  "amount": "10000.00",
  "cashbox": "uuid-кассы",
  "shift": "uuid-смены"
}
```

Бизнес-правила выплат:
- выплачивать можно только из периода `status=approved`
- нельзя выплатить больше остатка: `amount <= (net_to_pay - paid_total)`
- при успешной выплате создается `CashFlow`:
  - `type=expense`
  - `status=approved`
  - `source_business_operation_id` = UUID выплаты

### 7.5) Мои начисления (для сотрудника)

- `GET /salary/my/lines/` — сотрудник видит только свои начисления и выплаты.

