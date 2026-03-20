# Building — Строительство (единая backend-спецификация)

Базовый URL: `/api/building/`

Цель документа — дать backend-разработчику **однозначное ТЗ**: модели, перечисления, бизнес-правила и API.

## 0) Термины

- **ЖК**: `ResidentialComplex`
- **Квартира**: `Apartment`
- **Договор**: `BuildingTreaty`
- **Взнос рассрочки**: `TreatyInstallment`
- **Процесс работ**: `WorkEntry`
- **Закупка**: `Procurement`
- **Поставщик**: `Supplier`
- **Подрядчик**: `Contractor`
- **Касса**: `CashFlow`
- **Долги**: единый реестр (ledger) AP/AR

---

## 1) Квартиры — поле “Блок” + фильтрация + статистика

### 1.1 Модель

Отдельную сущность Block **не делаем**. Блок вводится вручную **прямо в квартире**.

В `Apartment` добавить поле:
- `block` (string, nullable) — например: `Блок А`, `Подъезд 1`, `Секция 2`.

Рекомендации:
- при сохранении делать `trim`;
- для устойчивой фильтрации можно хранить `block_normalized` (lowercase) — опционально.

### 1.2 Фильтрация квартир по блокам

- `GET /apartments/?residential_complex=<uuid>&block=<string>`
- опционально: `block__in=<string,string>`

### 1.3 Статистика по блокам “как этажи”

- `GET /objects/{residential_complex_id}/blocks/stats/`

Ответ:

```json
[
  {"block": "Блок А", "total": 40, "available": 30, "reserved": 6, "sold": 4},
  {"block": "Блок Б", "total": 32, "available": 20, "reserved": 5, "sold": 7}
]
```

Статусы квартир: `available`, `reserved`, `sold`.

---

## 2) Договора — типы строительства + фильтрация + группы (папки)

### 2.1 Тип договора для “строительства” (treaty_type)

В `BuildingTreaty` добавить поле **`treaty_type`** (это бизнес-категория договора, не путать с `operation_type`).

Перечисления `treaty_type`:
- `construction_department` — строительный отдел
- `sale` — продажа
- `booking` — бронь
- `procurement` — закупки
- `other` — прочее

`operation_type` можно оставить как “операция по квартире” (если уже используется: `sale`/`booking`/`other`).

### 2.2 Фильтрация по типам договора

- `GET /treaties/?treaty_type=<value>`
- опционально: `GET /treaties/?treaty_type__in=construction_department,sale`

Остальные фильтры по договорам сохраняются (ЖК, клиент, квартира, статус, условия оплаты, поиск).

---

### 2.3 Группы/папки для договоров (иерархия)

#### 2.3.1 Модель TreatyGroup

Сущность “папка”:
- `id` (uuid)
- `residential_complex` (uuid, nullable) — если папки в разрезе ЖК; либо `null` (общие)
- `parent` (uuid, nullable) — вложенность папок
- `title` (string)
- `order` (int, optional)
- `is_active` (bool)

Ограничения:
- запрет циклов (нельзя поставить parent потомком самого себя).

#### 2.3.2 API папок

- `GET /treaty-groups/?residential_complex=<uuid>&tree=true`
- `POST /treaty-groups/`
- `PATCH /treaty-groups/{id}/`
- `DELETE /treaty-groups/{id}/` (правила удаления: либо запрет при детях/договорах, либо перенос)

#### 2.3.3 Привязка договора к папке

В `BuildingTreaty` добавить:
- `group` (uuid, nullable)

Перенос:
- `PATCH /treaties/{id}/` с `{"group": "<uuid>"}` / `{"group": null}`
- массово: `POST /treaties/move/`:

```json
{"treaty_ids": ["uuid-1","uuid-2"], "target_group": "uuid-group"}
```

Фильтрация:
- `GET /treaties/?group=<uuid>`
- опционально: `GET /treaties/?group=<uuid>&include_descendants=true`

---

## 3) Рассрочка — переплата переносится на следующий взнос

Эндпоинт оплаты взноса:
- `POST /treaty-installments/{installment_id}/payments/` с `amount`

### 3.1 Бизнес-правило “переплата”

Если `amount` больше остатка по текущему взносу:
- закрываем текущий взнос полностью,
- **остаток автоматически распределяем** на следующий(ие) взнос(ы) по порядку `order`/`due_date`,
- для каждого взноса создаём **отдельную запись платежа** (чтобы было видно в истории выплат).

Рекомендованный ответ:

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

Если переплата больше суммы всех оставшихся взносов:
- вернуть `unused_amount > 0` (или по правилам продукта запретить и вернуть `400`).

Идемпотентность (рекомендуемо):
- `Idempotency-Key` или `external_payment_id`.

---

## 4) Долги (AP/AR) — единый реестр для поставщиков/подрядчиков/клиентов

Цель: можно работать “в долг” и видеть:
- сколько **мы должны** поставщику/подрядчику,
- сколько **клиент должен нам**,
- как меняется баланс по операциям (начисление, оплата, бартер, списание).

### 4.1 Унифицированный контрагент

- `counterparty_type`: `client` | `supplier` | `contractor`
- `counterparty_id`: uuid

### 4.2 Модель записи реестра (ledger entry)

- `direction`: `payable` (мы должны) | `receivable` (нам должны)
- `entry_type`: `charge` | `payment` | `barter` | `adjustment` | `writeoff`
- `amount` (decimal, всегда > 0)
- `currency` (например `KGS`)
- `status`: `draft` | `approved` | `cancelled`
- `residential_complex` (optional)
- `source_type`: `procurement` | `work_entry` | `treaty` | `manual` | ...
- `source_id` (uuid, optional)
- `comment`, даты

Баланс считается как:
- `balance = charges - payments - barter - writeoff (+/- adjustments)` (в рамках выбранного `direction` и контрагента).

### 4.3 API долгов

**Журнал операций:**
- `GET /debts/ledger/` (фильтры: direction, counterparty_type/id, ЖК, source, статус, даты, search)

**Сводка “кто сколько должен”:**
- `GET /debts/summary/`

**Сводка по конкретному контрагенту:**
- `GET /debts/summary/{counterparty_type}/{counterparty_id}/`

**Ручная регистрация долга/оплаты/корректировки:**
- `POST /debts/ledger/`

**Файлы к записи долга:**
- `POST /debts/ledger/{id}/files/` (multipart: `file`, `title`)

---

## 5) Закупки и процесс работ “в долг”

### 5.1 Закупка “в долг” (мы должны поставщику)

В `Procurement` добавить:
- `supplier` (uuid, optional)
- `payment_mode`: `cash` | `debt` | `mixed`

Поведение:
- при `payment_mode=debt` и подтверждении/приёмке закупки:
  - создаётся запись долга `direction=payable`, `entry_type=charge`,
  - `counterparty_type=supplier`, `counterparty_id=supplier`,
  - `source_type=procurement`, `source_id=procurement.id`,
  - `amount = total_amount` (или сумма по позициям конкретного поставщика, если в закупке несколько поставщиков).

Если несколько поставщиков в одной закупке:
- создаём **несколько** `charge` — по каждому поставщику.

### 5.2 Процесс работ “в долг” (мы должны подрядчику)

В `WorkEntry` добавить/использовать:
- `contractor` + `contract_amount`
- `payment_mode`: `cash` | `debt` | `mixed`

Поведение:
- при `payment_mode=debt` и фиксации “выполнено”:
  - создаём `debts/ledger` запись `direction=payable`, `entry_type=charge`,
  - `counterparty_type=contractor`, `counterparty_id=contractor`,
  - `source_type=work_entry`, `source_id=work_entry.id`,
  - `amount=contract_amount`.

---

## 5.3 Склад → процесс работ: выдача материалов, “кому передали”, история полученного, АВР

### 5.3.1 Поле “кому передали” при выдаче со склада

Для операций выдачи материалов со склада (например, `warehouse-movements/transfer-to-work-entry`) добавить поле:
- `issued_to` (string, optional) — **ФИО/кому передали** (ввод вручную).

Хранение:
- поле сохраняется в записи движения склада (WarehouseMovement) и отображается в журнале движений.

### 5.3.2 Заявка на материалы (создаёт процесс работ)

- `POST /work-entries/{id}/warehouse-requests/`

Склад видит список/детали заявок:
- `GET /work-entries/warehouse-requests/`
- `GET /work-entries/warehouse-requests/{id}/`

### 5.3.3 Выдача по заявке (создаёт движения склада)

- `POST /warehouse-movements/transfer-to-work-entry/`

Тело (пример):

```json
{
  "warehouse_request": "uuid-заявки",
  "warehouse": "uuid-склада",
  "issued_to": "Иванов И.И.",
  "items": [
    {"nomenclature": "uuid-позиции", "quantity": "8.00"},
    {"nomenclature": "uuid-позиции-2", "quantity": "5.00"}
  ],
  "comment": "Выдача материалов по заявке",
  "files": []
}
```

Правила:
- `issued_to` не валидируется по справочнику — это свободная строка.
- по `warehouse_request` определяем `work_entry`, проверяем “не больше запрошенного” (частичная выдача допустима).
- создаём **движения склада** с привязкой:
  - `work_entry`, `warehouse_request`, `issued_to`, `comment`.
- при необходимости файлы прикрепляются к движению (`POST /warehouse-movements/{id}/files/`).

### 5.3.4 Просмотр “что получили от склада” со стороны процесса работ

Нужен API, чтобы в карточке процесса работ видеть **список выданных позиций** и количества:

- `GET /work-entries/{id}/warehouse-receipts/`

Ответ (пример):

```json
{
  "work_entry": "uuid",
  "results": [
    {
      "warehouse_movement_id": "uuid",
      "warehouse": "uuid",
      "issued_to": "Иванов И.И.",
      "issued_at": "2026-03-15T10:00:00+06:00",
      "items": [
        {"nomenclature": "uuid", "name": "Цемент", "quantity": "8.00", "unit": "мешок"},
        {"nomenclature": "uuid", "name": "Арматура", "quantity": "5.00", "unit": "тонна"}
      ],
      "files": []
    }
  ]
}
```

Источник данных:
- по движениям склада типа `transfer_to_work_entry`, отфильтрованным по `work_entry`.

### 5.3.5 АВР при завершении процесса работ (файлы)

При завершении процесса работ нужен блок **АВР** (акт выполненных работ) с файлами.

Вариант реализации (рекомендуемый): отдельная сущность `WorkEntryAcceptance`:
- `id`
- `work_entry` (uuid)
- `status`: `draft` | `signed` (или `approved`)
- `comment`
- `created_at`, `signed_at`

API:
- создать/обновить АВР (метаданные): `POST /work-entries/{id}/acceptance/` или `PATCH /work-entry-acceptance/{id}/`
- файлы к АВР:
  - `POST /work-entry-acceptance/{id}/files/` (multipart: `file`, `title`)
- просмотр АВР в процессе работ:
  - `GET /work-entries/{id}/acceptance/` → возвращает АВР и список файлов

UI-поведение:
- при переводе WorkEntry в `completed` можно автоматически создавать черновик АВР (или требовать явного создания).

---

## 6) Бартер и смешанные оплаты (часть бартером + деньги/рассрочка)

### 6.1 Модель BarterItem

`BarterItem` (позиция бартера):
- `title` (название товара/услуги)
- `quantity` (optional)
- `unit` (optional)
- `unit_price` (optional)
- `total_price` (обязательно) — оценка в деньгах
- `currency`
- `comment`
- связь с источником: `source_type`, `source_id`

### 6.2 Где применяется бартер

В `BuildingTreaty` добавить:
- `payment_mode`: `cash` | `installment` | `barter` | `mixed`

Поведение:
- `barter`: договор закрывается бартером полностью (BarterItems суммарно = amount_total или заданная логика).
- `mixed`: часть бартером, остаток:
  - либо `cash` сразу,
  - либо `installment` (остаток становится суммой рассрочки).

### 6.3 API бартера

- `POST /barter/{source_type}/{source_id}/items/` (создать/обновить набор)
- `PATCH /barter/items/{id}/`
- `DELETE /barter/items/{id}/`
- файлы:
  - `POST /barter/{source_type}/{source_id}/files/` (multipart)

### 6.4 Связь бартера с долгами/кассой

- Бартер уменьшает баланс так же, как платёж, но **без CashFlow**:
  - создаём `debts/ledger` запись `entry_type=barter` на сумму `barter_total`.
- Денежная часть (если есть):
  - создаёт CashFlow (income/expense) + `debts/ledger entry_type=payment` (если операция влияет на долг).

---

## 7) Минимальный “чек-лист” для backend реализации

1. `Apartment.block` (string) + фильтры + `blocks/stats`.
2. `BuildingTreaty.treaty_type` + фильтры.
3. `TreatyGroup` (tree) + привязка `BuildingTreaty.group` + перенос.
4. Рассрочка: перераспределение переплаты по взносам с созданием нескольких payment-записей.
5. Долги: таблица ledger + summary + файлы.
6. Источники долгов:
   - закупка с `payment_mode=debt/mixed` создаёт payable к поставщику,
   - процесс работ с `payment_mode=debt/mixed` создаёт payable к подрядчику.
7. Бартер:
   - `BarterItem` + файлы,
   - `payment_mode=barter/mixed` для договоров,
   - отражение в debts ledger как `entry_type=barter`.

---

## 8) Автосоздание/привязка договора при создании закупки или процесса работ

Цель: при создании **процесса работ** или **закупки** пользователь может:
- **прикрепить существующий договор** (выбрать `treaty_id`), или
- **создать новый договор** “по этой работе/закупке” из прикреплённых файлов, или
- создать сущность **без договора**.

### 8.1 Поля в `WorkEntry` и `Procurement`

Добавить/поддержать поля:
- `treaty` (uuid, nullable) — ссылка на существующий договор.
- `treaty_auto_create` (bool, optional) — если `true`, backend создаёт новый договор автоматически.
- `treaty_type` (string, optional) — тип создаваемого договора (см. `treaty_type` в разделе 2). Для процесса работ обычно `construction_department`, для закупки — `procurement`.
- `treaty_title` (string, optional) — название нового договора (если создаём автоматически).
- `treaty_files[]` (array, optional) — список файлов, которые должны попасть в новый договор.

Важно:
- Если `treaty` передан — `treaty_auto_create` игнорируется.
- Если `treaty` не передан и `treaty_auto_create=false/пусто` — сущность создаётся без договора.

### 8.2 Рекомендуемая реализация API (не завязанная на multipart внутри JSON)

#### Вариант A (рекомендуемый): двухшаговый

1) Создать WorkEntry/Procurement без файлов:
- `POST /work-entries/` / `POST /procurements/` с полями:
  - `treaty` (если выбрали существующий) **или** `treaty_auto_create=true` + `treaty_type` + `treaty_title`.

2) Загрузить файлы как “вложения сущности”, а backend при `treaty_auto_create=true` автоматически:
- создаёт договор (если ещё не создан),
- переносит/копирует эти файлы в `treaty.files` (как `POST /treaties/{id}/files/`),
- сохраняет связь `work_entry.treaty` / `procurement.treaty`.

Эндпоинты вложений:
- `POST /work-entries/{id}/files/` (multipart: `file`, `title`)
- `POST /procurements/{id}/files/` (multipart: `file`, `title`)

Правило:
- если у сущности включён режим `treaty_auto_create`, то каждое вложение “поднимается” также в договор.

#### Вариант B: “создать договор из файлов” отдельным вызовом

Если нужно явно управлять моментом создания договора:
- `POST /work-entries/{id}/treaty/create-from-files/`
- `POST /procurements/{id}/treaty/create-from-files/`

Тело:

```json
{
  "treaty_type": "procurement",
  "title": "Договор закупки по заявке №123",
  "use_existing_files": true
}
```

### 8.3 Правила по файлам

- Все файлы, которые “создают договор”, должны оставаться доступными и на сущности (WorkEntry/Procurement), и в договоре (для аудита).
- Дублирование можно реализовать как:
  - копирование файла (если хранение позволяет),
  - или одна запись файла с привязкой к двум объектам (если поддерживается).

### 8.4 Тип создаваемого договора

По умолчанию:
- для `WorkEntry` → `treaty_type = construction_department`
- для `Procurement` → `treaty_type = procurement`

При необходимости пользователь может выбрать другой `treaty_type` (например, `other`).


