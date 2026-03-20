# Building — backend implementation report (что сделано)

Базовый URL: `/api/building/`

Документ фиксирует **реально внесённые изменения в код/БД** по спецификации “Building — Строительство (единая backend-спецификация)”.

## 1) Квартиры — поле “Блок” + фильтрация + статистика

### 1.1 Модель

Сущность отдельного Block **не создавалась** — блок хранится прямо в квартире.

В `ResidentialComplexApartment` (квартира ЖК) добавлены поля:
- `block` (string, nullable) — ввод вручную (например `Блок А`, `Подъезд 1`, `Секция 2`)
- `block_normalized` (string, nullable) — техническое поле для устойчивой фильтрации

Поведение при сохранении:
- `block` приводится к `trim()`, пустая строка → `null`
- `block_normalized = lower(trim(block))` (если `block` заполнен)

### 1.2 Фильтрация квартир по блокам

Эндпоинт:
- `GET /api/building/apartments/`

Фильтры:
- `residential_complex=<uuid>`
- `block=<string>`
- `block__in=<string,string>` (django-filter)

### 1.3 Статистика по блокам “как этажи”

Добавлен эндпоинт:
- `GET /api/building/objects/{residential_complex_id}/blocks/stats/`

Формат ответа:

```json
[
  {"block": "Блок А", "total": 40, "available": 30, "reserved": 6, "sold": 4},
  {"block": "Блок Б", "total": 32, "available": 20, "reserved": 5, "sold": 7}
]
```

Статусы квартир: `available`, `reserved`, `sold`.

## 2) Договора — типы строительства + фильтрация + группы (папки)

### 2.1 `BuildingTreaty.treaty_type` (бизнес-категория договора)

В `BuildingTreaty` добавлено поле:
- `treaty_type` (string, db_index)

Значения:
- `construction_department`
- `sale`
- `booking`
- `procurement`
- `other`

Фильтрация:
- `GET /api/building/treaties/?treaty_type=<value>`
- `GET /api/building/treaties/?treaty_type__in=construction_department,sale` (django-filter)

### 2.2 Группы/папки договоров (иерархия)

Добавлена сущность `BuildingTreatyGroup` (MPTT tree):
- `id` (uuid)
- `company` (FK)
- `residential_complex` (FK, nullable)
- `parent` (FK self, nullable)
- `title` (string)
- `order` (int, nullable)
- `is_active` (bool)

В `BuildingTreaty` добавлено поле:
- `group` (FK на `BuildingTreatyGroup`, nullable)

API папок:
- `GET /api/building/treaty-groups/?residential_complex=<uuid>&tree=true`
- `POST /api/building/treaty-groups/`
- `PATCH /api/building/treaty-groups/{id}/`
- `DELETE /api/building/treaty-groups/{id}/` (удаление запрещено, если есть дети или договора)

Перенос договоров:
- `POST /api/building/treaties/move/`

Тело:

```json
{"treaty_ids": ["uuid-1","uuid-2"], "target_group": "uuid-group"}
```

Фильтрация по папке:
- `GET /api/building/treaties/?group=<uuid>`
- `GET /api/building/treaties/?group=<uuid>&include_descendants=true`

## 3) Рассрочка — переплата переносится на следующий взнос

Эндпоинт:
- `POST /api/building/treaty-installments/{installment_id}/payments/`

Изменено поведение:
- если сумма больше остатка текущего взноса, то излишек **распределяется на следующий(ие)** по `order/due_date`
- по каждому взносу создаётся **отдельная запись оплаты** (`BuildingTreatyInstallmentPayment`) + отдельный `CashFlow`
- поддержана идемпотентность через `external_payment_id` (если передан и уже был — возвращается 200 и прежний результат)

Формат ответа:

```json
{
  "applied": [
    {"installment_id": "uuid-1", "amount": "10000.00", "paid_total_after": "10000.00", "status": "paid"},
    {"installment_id": "uuid-2", "amount": "5000.00", "paid_total_after": "5000.00", "status": "planned"}
  ],
  "input_amount": "15000.00",
  "unused_amount": "0.00"
}
```

## 4) Долги (AP/AR) — единый реестр (ledger)

Добавлены модели:
- `BuildingDebtLedgerEntry`
- `BuildingDebtLedgerFile`

Ключевые поля `BuildingDebtLedgerEntry`:
- `direction`: `payable|receivable`
- `entry_type`: `charge|payment|barter|adjustment|writeoff`
- `counterparty_type`: `client|supplier|contractor`
- `counterparty_id` (uuid)
- `amount` (>0), `currency`, `status`: `draft|approved|cancelled`
- `residential_complex` (optional)
- `source_type`, `source_id` (например `procurement`, `work_entry`, `treaty`, `manual`)

API:
- `GET/POST /api/building/debts/ledger/`
- `POST /api/building/debts/ledger/{id}/files/` (multipart: `file`, `title`)
- `GET /api/building/debts/summary/`
- `GET /api/building/debts/summary/{counterparty_type}/{counterparty_id}/`

Баланс в summary считается так:
- `balance = charges - payments - barter - writeoff + adjustments` (в рамках `direction + counterparty`)

## 5) Закупки и процесс работ “в долг”

### 5.1 Закупка “в долг”

В `BuildingProcurementRequest` добавлено:
- `payment_mode`: `cash|debt|mixed`
- `treaty` (nullable)
- `treaty_auto_create` (bool)
- `treaty_type` (string)
- `treaty_title` (string)

Автосоздание долга:
- при принятии передачи на склад (accept transfer) при `payment_mode in (debt,mixed)` создаётся ledger запись:
  - `direction=payable`, `entry_type=charge`, `counterparty_type=supplier`, `source_type=procurement`

### 5.2 Процесс работ “в долг”

В `BuildingWorkEntry` добавлено:
- `payment_mode`: `cash|debt|mixed`
- `treaty_auto_create`, `treaty_type`, `treaty_title`

Автосоздание долга:
- при переводе `work_status` в `completed` при `payment_mode in (debt,mixed)` создаётся ledger запись:
  - `direction=payable`, `entry_type=charge`, `counterparty_type=contractor`, `source_type=work_entry`

## 5.3 Склад → процесс работ: issued_to, receipts, АВР

### 5.3.1 issued_to в движениях склада

В `BuildingWarehouseMovement` добавлено поле:
- `issued_to` (string, nullable)

Эндпоинт выдачи:
- `POST /api/building/warehouse-movements/transfer-to-work-entry/`

Поддержано:
- `issued_to` сохраняется в движении
- можно передать **только `warehouse_request`** без `work_entry` — `work_entry` определяется по заявке

### 5.3.4 Просмотр “что получили от склада”

Добавлен эндпоинт:
- `GET /api/building/work-entries/{id}/warehouse-receipts/`

### 5.3.5 АВР (акт выполненных работ)

Добавлены сущности:
- `BuildingWorkEntryAcceptance`
- `BuildingWorkEntryAcceptanceFile`

API:
- `GET/POST /api/building/work-entries/{id}/acceptance/`
- `POST /api/building/work-entry-acceptance/{id}/files/` (multipart: `file`, `title`)

Поведение:
- при переводе `WorkEntry` в `completed` автоматически создаётся черновик АВР (best-effort).

## 6) Бартер и смешанные оплаты (минимальный backend)

В `BuildingTreaty` добавлено поле:
- `payment_mode`: `cash|installment|barter|mixed`

Добавлены модели:
- `BuildingBarterItem`
- `BuildingBarterFile`

API:
- `POST /api/building/barter/{source_type}/{source_id}/items/` (upsert набора позиций)
- `PATCH/DELETE /api/building/barter/items/{id}/`
- `POST /api/building/barter/{source_type}/{source_id}/files/` (multipart)

## 8) Автосоздание/привязка договора при создании закупки или процесса работ (двухшаговый вариант)

Добавлены/поддержаны поля (см. раздел 5):
- `treaty` / `treaty_auto_create` / `treaty_type` / `treaty_title`

Реализация (2 шага):
1) создаём `WorkEntry/Procurement` (с `treaty` или `treaty_auto_create=true`)
2) загружаем файлы:
   - `POST /api/building/work-entries/{id}/files/`
   - `POST /api/building/procurements/{id}/files/`

Правило:
- если `treaty_auto_create=true` и договор ещё не создан — создаётся договор и файлы “поднимаются” в `treaty.files`
- если договор уже указан — каждый файл также добавляется в `treaty.files` (best-effort)

## 9) Статус по исходной спецификации

Сделано (готово в коде и БД):
- ✅ Пункт 1: `Apartment.block` + фильтры + `blocks/stats`
- ✅ Пункт 2: `BuildingTreaty.treaty_type` + папки `TreatyGroup` + `group` + перенос `treaties/move/`
- ✅ Пункт 3: переплата по рассрочке с созданием нескольких payment-записей
- ✅ Пункт 4: debts ledger + summary + файлы
- ✅ Пункт 5: источники долгов из Procurement/WorkEntry при `payment_mode=debt/mixed`
- ✅ Пункт 5.3: `issued_to` + receipts + acceptance/АВР + файлы
- ✅ Пункт 6: barter items/files + `payment_mode` для договоров
- ✅ Пункт 8: автосоздание/поднятие договора из файлов (двухшаговый вариант)

