# Building — Долги и бартер (Backend-спецификация)

Базовый URL: `/api/building/`

Документ описывает:
- как проводить **закупки** и **процесс работ** “в долг” (мы должны поставщику/подрядчику);
- единый реестр долгов: **кому мы должны / кто должен нам** (поставщик/подрядчик/клиент);
- API для просмотра долга по конкретному контрагенту и общего списка;
- **бартер** и смешанные оплаты (часть бартером + остаток деньгами, в т.ч. рассрочка), с файлами.

---

## 1) Общие понятия

### 1.1 Контрагент (Counterparty)

У долга всегда есть контрагент:
- `counterparty_type`: `client` | `supplier` | `contractor`
- `counterparty_id`: uuid сущности

### 1.2 Долг (Debt / Ledger)

Рекомендуется вести реестр в формате “журнала” (ledger):
- каждая операция создаёт запись (invoice/charge, payment, adjustment, barter, write-off);
- текущий баланс считается как сумма записей.

Сторона долга:
- **payable** (AP) — *мы должны* (поставщику/подрядчику)
- **receivable** (AR) — *нам должны* (обычно клиент)

Поля записи реестра (рекомендуемо):
- `id`
- `direction`: `payable` | `receivable`
- `counterparty_type`, `counterparty_id`
- `residential_complex` (uuid, опционально)
- `source_type` (string): `procurement` | `work_entry` | `treaty` | `manual` | ...
- `source_id` (uuid, опционально)
- `currency` (например `KGS`)
- `amount` (decimal) — положительное число
- `entry_type`: `charge` | `payment` | `barter` | `adjustment` | `writeoff`
- `status`: `draft` | `approved` | `cancelled`
- `comment`
- `created_at`, `approved_at`

Правило знака:
- Храним `amount` всегда положительным, а направление/тип определяет смысл.
- Баланс считается по формуле:
  - для **payable**: `balance = charges - payments - barter - writeoff (+/- adjustments)`
  - для **receivable**: `balance = charges - payments - barter - writeoff (+/- adjustments)`

---

## 2) Закупки “в долг” (мы должны поставщику)

### 2.1 Документ закупки

В закупке должна быть возможность указать:
- `supplier` (uuid, опционально, если закупка без поставщика)
- `payment_mode`: `cash` | `debt` | `mixed`

Поведение:
- если `payment_mode = debt`:
  - при подтверждении/приёмке закупки создаётся запись долга (**payable**) к поставщику:
    - `entry_type = charge`
    - `source_type = procurement`, `source_id = procurement.id`
    - `amount = total_amount` (или сумма по позициям поставщика, если в одной закупке несколько поставщиков)

Если в одной закупке несколько поставщиков:
- долг создаётся **отдельно по каждому поставщику** на его часть суммы.

### 2.2 Оплата долга поставщику

Оплата долга проводится как:
- либо платёж через кассу (создаётся `CashFlow` + запись `debt_ledger entry_type=payment`);
- либо бартер (см. раздел 5).

---

## 3) Процесс работ “в долг” (мы должны подрядчику)

В процессе работ (`work_entry`) при наличии:
- `contractor`
- `contract_amount`
- статуса (например `completed`)

должна быть возможность выбрать:
- `payment_mode`: `cash` | `debt` | `mixed`

Поведение:
- при `payment_mode = debt`:
  - при фиксации “выполнено” создаётся запись долга (**payable**) к подрядчику:
    - `entry_type=charge`
    - `source_type=work_entry`, `source_id=work_entry.id`
    - `amount=contract_amount`

Если `mixed` — часть может уйти в кассу, часть останется долгом (см. 5).

---

## 4) API долгов (единый)

### 4.1 Список записей реестра долгов

- `GET /debts/ledger/`

Фильтры:
- `direction` = `payable|receivable`
- `counterparty_type` = `client|supplier|contractor`
- `counterparty_id` = uuid
- `residential_complex`
- `source_type`, `source_id`
- `status`
- `date_from`, `date_to`
- `search` (по комментарию/номеру источника и т.п.)

Возвращает список записей (пагинация).

### 4.2 Сводка по контрагентам (кто сколько должен)

- `GET /debts/summary/`

Фильтры аналогично `ledger`.

Ответ (пример):

```json
{
  "results": [
    {
      "direction": "payable",
      "counterparty_type": "supplier",
      "counterparty_id": "uuid",
      "counterparty_display": "ОсОО СтройСнаб",
      "currency": "KGS",
      "balance": "125000.00"
    }
  ]
}
```

### 4.3 Сводка по одному контрагенту

- `GET /debts/summary/{counterparty_type}/{counterparty_id}/`

Возвращает:
- текущий баланс
- обороты (charges/payments/barter/writeoff)
- последние операции (опционально).

### 4.4 Регистрация долга вручную

Чтобы можно было “зарегистрировать долги” не только из закупки/процесса работ:

- `POST /debts/ledger/`

Тело (пример):

```json
{
  "direction": "payable",
  "counterparty_type": "supplier",
  "counterparty_id": "uuid-поставщика",
  "amount": "50000.00",
  "currency": "KGS",
  "entry_type": "charge",
  "status": "approved",
  "comment": "Долг за материалы по устной договоренности",
  "residential_complex": "uuid-жк"
}
```

### 4.5 Файлы к записи долга

- `POST /debts/ledger/{id}/files/` (multipart/form-data: `file`, `title`)

Файлы: акт сверки, накладная, доп. соглашение, переписка и т.п.

---

## 5) Бартер и смешанные оплаты (частично бартер + деньги)

### 5.1 Что такое “бартер” в системе

Бартер — это частичное/полное закрытие суммы по сделке **не деньгами**, а товаром/услугой.

Нужно хранить отдельную сущность:
- `BarterItem` (позиция бартера)
  - `id`
  - `title` (название товара/услуги)
  - `quantity` (опционально)
  - `unit` (опционально)
  - `unit_price` (опционально)
  - `total_price` (обязательно) — оценка в деньгах
  - `currency`
  - `comment`

Бартер всегда привязан к источнику (например, договор продажи, закупка, долг, процесс работ):
- `source_type`, `source_id`
- и/или к записи долга в реестре

### 5.2 Бартер при продаже/договоре

В договоре (`treaty`) добавить:
- `payment_mode`: `cash` | `installment` | `barter` | `mixed`

Если `payment_mode = barter`:
- сумму договора можно закрывать бартером полностью;
- создаются записи по “оплатам” с типом `barter`.

Если `payment_mode = mixed`:
- часть закрывается бартером (BarterItems суммарно = barter_amount);
- остаток можно:
  - оплатить сразу (`cash`) или
  - оформить в рассрочку (`installment`) — тогда остаток становится “телом” рассрочки.

### 5.3 API бартера (универсально)

**Создать/обновить позиции бартера для источника:**
- `POST /barter/{source_type}/{source_id}/items/`
- `DELETE /barter/items/{id}/`
- `PATCH /barter/items/{id}/`

Пример `POST`:

```json
{
  "items": [
    {"title": "Кирпич", "quantity": "1000", "unit": "шт", "total_price": "12000.00", "currency": "KGS"},
    {"title": "Доставка", "total_price": "3000.00", "currency": "KGS"}
  ],
  "comment": "Частичный бартер"
}
```

**Файлы к бартеру:**
- `POST /barter/{source_type}/{source_id}/files/` (multipart: `file`, `title`)

### 5.4 Связь бартера с долгами/кассой

- Для **payable/receivable** бартер уменьшает баланс так же, как платёж, но без CashFlow:
  - создаётся запись в `debts/ledger` с `entry_type=barter`, `amount = barter_total`.
- Если часть оплачивается деньгами:
  - создаётся CashFlow (income/expense) + запись `entry_type=payment`.

---

## 6) Смешанная схема: бартер + рассрочка

Сценарий: договор на сумму `amount_total`, часть закрываем бартером, остаток — рассрочка.

Правила:
1. Сохраняем `BarterItems` (сумма = `barter_total`).
2. Рассчитываем `remaining = amount_total - barter_total`.
3. Если `remaining > 0` и выбран `installment`:
   - график рассрочки строится/проверяется на сумму `remaining`;
   - платежи по рассрочке учитываются как денежные платежи (касса) и/или как отдельные оплаты.

---

## 7) История и аудит

Для поставщиков/подрядчиков/клиентов важно иметь:
- историю по долгам (`/debts/ledger/` фильтр по контрагенту);
- историю по оплатам/кассе (CashFlow);
- историю по бартеру (позиции + файлы).

Для UI удобно иметь агрегированные методы:
- `GET /suppliers/{id}/debt/` (обёртка над summary)
- `GET /contractors/{id}/debt/`
- `GET /clients/{id}/debt/`

Но базово достаточно унифицированного `debts/summary/{type}/{id}`.

