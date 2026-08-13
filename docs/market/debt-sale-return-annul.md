# Возврат продажи в долг — аннулирование / уменьшение долга

| Поле | Значение |
|------|----------|
| **Версия** | 1.0 |
| **Дата** | 13 августа 2026 |
| **Сфера** | Маркет (POS + клиентские сделки / долги) |
| **Аудитория** | Backend (`apps/main`) |
| **Статус** | ⚠️ Требуется реализация на бэкенде |
| **Связанные документы** | [MARKET_BUGS_FIX_TZ.md](./MARKET_BUGS_FIX_TZ.md) (A3 / dual-write долга), [sale-consultant-commission.md](./sale-consultant-commission.md) (§3.3 возвраты), [service-kind-no-quantity.md](./service-kind-no-quantity.md) |
| **Фронт (текущее поведение)** | Возврат: `POST .../sales/{id}/return/` (`returnSale`). Долг создаётся отдельно после checkout (`createDeal` / `/main/debts/`) **без** `sale_id`. При возврате FE **не** трогает deal. |

---

## 1. Проблема

Сейчас продажа «в долг» — это **две независимые записи**:

1. `Sale` со статусом/методом `debt` (checkout списывает товар).
2. `ClientDeal` (`kind=debt` / `prepayment`) или legacy `/main/debts/` — учёт долга клиента.

Связи `Deal.sale_id` (или аналога) **нет**. Поэтому при

`POST /main/pos/sales/{sale_id}/return/`

(и agent-варианте `/main/agents/me/sales/{sale_id}/return/`):

- остатки товара восстанавливаются (ожидаемо, на BE);
- статус продажи → `canceled` (или частичный возврат по позициям);
- **долг клиента не уменьшается и не закрывается**.

Бизнес-риск: клиент вернул товар, а в карточке остаётся `remaining_debt` / график платежей / попадание в «Должники».

---

## 2. Цель

При любом успешном возврате продажи, у которой есть связанный долг:

1. **Полный возврат** → долг по этой продаже **закрывается / аннулируется** (остаток = 0, сделка не активна).
2. **Частичный возврат** → `remaining_debt` и график **уменьшаются** на сумму возвращённых позиций (пропорционально долгу, не предоплате).
3. Всё в **одной транзакции** с возвратом склада/продажи: либо sale-return + debt-adjust оба успешны, либо оба откатываются.
4. Фронту **не нужно** отдельно вызывать `deleteDebt` / `pay` / `refund` — достаточно текущего `.../return/`.

---

## 3. Термины и сущности

| Термин | Смысл |
|--------|--------|
| **Debt-sale** | Продажа, закрытая с `payment_method=debt` или со строкой `payments[]` где есть `method=debt`. |
| **Linked deal** | `ClientDeal` (или legacy Debt), созданный по этой продаже и связанный через `sale_id`. |
| **Returned amount** | Сумма возвращённых позиций по чеку (по `sale_item` line totals с учётом скидок). |
| **Sale debt principal** | Часть чека, которая легла в долг: `sale_total - prepaid` (где `prepaid` = `cash_received` / сумма non-debt payments). |
| **Paid on deal** | Уже погашенная сумма по сделке (`amount - remaining_debt` или сумма успешных `pay`). |

---

## 4. Предварительное условие: связь Sale ↔ Deal

Без связи корректное авто-аннулирование **невозможно** (нельзя надёжно угадать сделку по клиенту/сумме/дате).

### 4.1. Модель

Добавить на `ClientDeal` (и при необходимости на legacy `Debt`):

| Поле | Тип | Описание |
|------|-----|----------|
| `sale_id` | FK → Sale, `null=True`, `unique=True` (или unique per company) | Продажа-источник. `null` у ручных сделок без чека. |

Индекс: `(company, sale_id)`, `(client, kind, status)` как сейчас.

Инвариант: одна продажа → **не больше одной** долговой сделки с этим `sale_id`.

### 4.2. Создание связи при checkout (предпочтительно)

Вариант **A (рекомендуемый, см. A3 в MARKET_BUGS_FIX_TZ):**  
`POST .../checkout/` с `payment_method=debt` **атомарно** создаёт Deal:

```json
{
  "client_id": "...",
  "payment_method": "debt",
  "cash_received": "500.00",
  "schedule_version": "v2",
  "debt_schedule": { "...": "как сейчас с FE" }
}
```

Внутри транзакции checkout:

1. Закрыть Sale (`status=debt` / paid_at и т.д.).
2. Создать `ClientDeal(kind=debt|prepayment, sale_id=sale.id, amount=sale.total, prepayment=..., installments=...)`.
3. Для тарифа «Старт» — либо тот же Deal, либо legacy Debt **тоже** с `sale_id`.

Если deal не создался → rollback checkout (или явный outbox + компенсация; продукт: **атомарно**).

Вариант **B (переходный):** FE продолжает `createDeal` после checkout, но **обязан** передать:

```json
{ "sale_id": "<uuid продажи>", "...остальные поля" }
```

BE: идемпотентность по `sale_id` — повторный POST не плодит вторую сделку.

### 4.3. Ответ checkout / deal

В сериализации Sale и Deal вернуть:

```json
{
  "id": "sale-uuid",
  "deal_id": "deal-uuid-or-null",
  "remaining_debt": "1500.00"
}
```

и на Deal:

```json
{
  "id": "deal-uuid",
  "sale_id": "sale-uuid",
  "sale": { "id": "...", "status": "debt", "total": "..." }
}
```

---

## 5. Поведение `POST .../sales/{sale_id}/return/`

Эндпоинты (оба обязаны вести себя одинаково по долгу):

- `POST /main/pos/sales/{sale_id}/return/`
- `POST /main/agents/me/sales/{sale_id}/return/`

Тело как сейчас:

```json
{} 
```

полный возврат, или

```json
{
  "items": [{ "sale_item_id": "...", "quantity": "1" }],
  "is_defect": false
}
```

### 5.1. Алгоритм (псевдокод)

```
в одной DB-транзакции:
  1. выполнить текущий возврат склада / позиций / статус Sale
  2. deal = Deal.objects.filter(sale_id=sale.id).first()
     (для «Старт» — также Debt по sale_id)
  3. если deal is None → конец (ручная/legacy продажа без связи; см. §8)
  4. returned_money = сумма только что возвращённых позиций (money)
  5. debt_reduce = min(deal.remaining_debt, allocate_to_debt(returned_money, sale, deal))
  6. применить debt_reduce к deal + installments
  7. если remaining_debt == 0 и полный возврат чека (или все позиции возвращены)
       → закрыть/аннулировать deal (status=canceled|closed)
  8. записать аудит DebtAdjustment / DealEvent
  9. вернуть в ответе return + debt_adjustment
```

### 5.2. Как считать `allocate_to_debt`

Чек мог иметь предоплату:

```
sale_total     = 2000
prepaid        = 500   # cash_received / non-debt payments
debt_principal = 1500  # то, что в remaining на момент создания
```

Правило приоритета возврата денег относительно долга:

1. **Сначала уменьшаем долг** (товар «не продан» → клиент не должен долг).
2. Если `returned_money > remaining_debt`, остаток `returned_money - remaining_debt` считается возвратом **уже оплаченной** части (предоплата / погашения) → см. §6 (деньги).

Формула для шага 5:

```
debt_reduce = min(remaining_debt, returned_money)
overpay_or_cash_refund_basis = returned_money - debt_reduce  # ≥ 0
```

Для **частичного** возврата нескольких шагов: каждый return уменьшает `remaining_debt` на свой `debt_reduce`, пока не 0.

### 5.3. Полный возврат

Условия: тело без `items` **или** после операции все позиции полностью возвращены.

| Состояние deal до возврата | Действие |
|----------------------------|----------|
| `remaining_debt > 0`, платежей по deal не было | `remaining_debt = 0`, installments unpaid → `canceled` / amount 0, **status = `canceled`** (или `closed` + reason=`sale_return`). Сделка **не** должна попадать в должники. |
| Были погашения (`paid_on_deal > 0`) | `remaining_debt = 0`, незакрытые installments отменить; по оплаченной части — §6 (refund basis в ответе, авто-refund кассы **не обязателен в v1**). Status = `canceled` / `closed`. |
| `remaining_debt` уже 0 (всё погашено раньше) | Deal не «оживлять»; пометить `closed_reason=sale_return` если нужно; в ответе `cash_refund_hint = returned_money`. |

Клиент **не** должен оставаться в `/main/clients/with-debts/` из‑за этой сделки.

### 5.4. Частичный возврат

| Действие | Детали |
|----------|--------|
| `remaining_debt` | `-= debt_reduce` (не ниже 0) |
| `amount` сделки | либо оставить исходный snapshot + хранить `returned_total`, либо уменьшить `amount` — **рекомендация:** хранить `original_amount` immutable, `returned_total` += returned_money, `remaining_debt` пересчитать |
| График v2 (`installments`) | уменьшить **с конца** (последние unpaid), либо пропорционально по unpaid; unpaid с amount 0 удалить/skip. Уже `paid` installments не трогать суммой вниз без refund. |
| Status | остаётся `open`/`active`, пока `remaining_debt > 0`; при 0 → как полный по долгу |

Рекомендуемый алгоритм графика (простой, предсказуемый):

1. Взять unpaid installments в порядке `due_date` **desc** (с конца).
2. Списывать `debt_reduce` с их `amount` / `remaining`, пока не исчерпан.
3. Если installment стал 0 — статус `canceled`.

Альтернатива (пропорция) допустима, но тогда зафиксировать в тестах и в ответе API `schedule_recalc_method: "from_end" | "proportional"`. **Для v1 — `from_end`.**

### 5.5. Идемпотентность

Повторный return тех же позиций → 400 «уже возвращено» (как сейчас) **или** 200 no-op без повторного уменьшения долга.  
Долг уменьшается **только** на фактически новые возвращённые qty/money.

---

## 6. Деньги (предоплата и уже погашенный долг)

Авто-создание расходного cashflow при return **в v1 не обязательно**, но BE **обязан** посчитать и отдать фронту суммы для UX / ручной выдачи.

В ответе return:

```json
{
  "sale_id": "...",
  "status": "canceled",
  "returned_total": "800.00",
  "debt_adjustment": {
    "deal_id": "...",
    "reduced_by": "800.00",
    "remaining_debt": "700.00",
    "deal_status": "open",
    "cash_refund_due": "0.00",
    "reason": "sale_return"
  }
}
```

Правила `cash_refund_due`:

| Кейс | `cash_refund_due` |
|------|-------------------|
| Вернули на сумму ≤ `remaining_debt` | `0` (долг просто уменьшили) |
| Вернули больше, чем остаток долга | `returned_money - debt_reduce` (= затронута предоплата / прошлые pay) |
| Полный возврат, по deal уже платили | сумма `paid_on_deal` (или её доля), не покрытая уменьшением долга |

v2 (опционально, отдельная фаза): авто-`refund` платежей deal + расход в кассу с `source_sale_id` / idempotency_key.

**Не делать в том же return без явного флага:** молчаливый `refundDeal` всех платежей — риск двойных выплат, если кассир уже выдал наличные вручную.

---

## 7. Контракт ответа (расширение)

Расширить текущий ответ `.../return/` (обратная совместимость: новые поля опциональны для старого FE):

```json
{
  "id": "sale-uuid",
  "status": "canceled",
  "returned_items": [ "...существующие поля..." ],
  "debt_adjustment": {
    "deal_id": "uuid-or-null",
    "legacy_debt_id": "uuid-or-null",
    "reduced_by": "500.00",
    "remaining_debt_before": "1500.00",
    "remaining_debt": "1000.00",
    "deal_status": "open",
    "installments_updated": 2,
    "cash_refund_due": "0.00",
    "reason": "sale_return"
  }
}
```

Если связанного долга нет:

```json
"debt_adjustment": null
```

или

```json
"debt_adjustment": { "deal_id": null, "reduced_by": "0.00", "note": "no_linked_deal" }
```

Ошибки:

| Код | Когда |
|-----|--------|
| 400 | Нечего возвращать / qty > remaining |
| 409 | Конфликт идемпотентности / параллельный pay по deal — повторить |
| 500 | Не должно: склад вернули, а deal нет — транзакция откатывается целиком |

---

## 8. Legacy и миграция

### 8.1. Исторические продажи без `sale_id` на deal

Авто-аннулирование **не применять наугад**. Опции:

1. One-off management command: сматчить `Deal` ↔ `Sale` по `(client_id, company, amount≈debt_principal, created_at ± N минут, payment_method=debt)` и проставить `sale_id`, если матч однозначный.
2. Неоднозначные — отчёт админу, ручная привязка.
3. После миграции новые checkout **только** со связью.

### 8.2. Тариф «Старт» (`/main/debts/`)

Либо:

- мигрировать на Deal + тот же алгоритм, либо
- добавить `sale_id` на Debt и в return закрывать/уменьшать `amount` аналогично.

Оба списка должников (`with-debts`, UI Debts) должны учитывать статус после return.

---

## 9. Аналитика и KPI

После return:

- клиентский KPI «долг» / вкладка должников — без этой суммы;
- выручка / продажи — как уже учитывается canceled/return;
- комиссия консультанта — по [sale-consultant-commission.md](./sale-consultant-commission.md) §3.3 (пропорция), независимо от долга;
- не допускать double-count: уменьшение `remaining_debt` ≠ повторный «платёж» в кассу.

---

## 10. Что менять на фронте (после BE)

Минимально (можно отдельным тикетом):

1. После `returnSale` читать `debt_adjustment` и показывать тост:
   - «Долг уменьшен на X. Остаток: Y»
   - или «Долг по этой продаже аннулирован»
   - если `cash_refund_due > 0` — «К возврату наличными: Z» (без автосписания кассы в v1).
2. При post-checkout `createDeal` передавать `sale_id` (пока нет atomic checkout).
3. Обновлять список сделок клиента / должников после возврата.

До готовности BE фронт **не** должен сам вызывать `deleteDebt` угадывая сделку — только после появления `sale_id` / `deal_id` в API.

---

## 11. Тест-план (BE)

| # | Сценарий | Ожидание |
|---|----------|----------|
| T1 | Debt-sale без предоплаты, полный return, платежей по deal нет | Sale canceled; deal canceled; remaining_debt=0; товар на складе; клиент не в должниках |
| T2 | Debt + prepay 500 из 2000, полный return | remaining_debt=0; `cash_refund_due=500` (или paid portion); deal closed |
| T3 | Частичный return на 300, remaining был 1500 | remaining=1200; график урезан с конца; deal open |
| T4 | Два частичных return, в сумме = debt principal | remaining=0; deal closed |
| T5 | По deal уже pay 400, remaining 1100, полный return товара | remaining=0; deal closed; `cash_refund_due` ≥ 400 |
| T6 | Return услуги (`kind=service`) в debt-sale | долг уменьшается; склад qty не растёт |
| T7 | Sale без linked deal | return склада OK; `debt_adjustment` null/no_linked |
| T8 | Параллельно pay и return | 409 или сериализация; нет отрицательного remaining |
| T9 | Повторный return тех же items | нет повторного списания долга |
| T10 | Agent endpoint return | то же, что POS |
| T11 | Идемпотентный createDeal с тем же `sale_id` | одна сделка |
| T12 | Checkout debt без client_id | 400 (см. BE-1) |

---

## 12. Критерии приёмки (DoD)

- [ ] У Deal/Debt есть `sale_id`; checkout или createDeal всегда проставляет его для debt-sale.
- [ ] `POST .../return/` в одной транзакции корректирует долг.
- [ ] Полный возврат → клиент не висит должником из‑за этой продажи.
- [ ] Частичный возврат → `remaining_debt` и unpaid installments уменьшены предсказуемо (`from_end`).
- [ ] Ответ содержит `debt_adjustment` (+ `cash_refund_due`).
- [ ] Нет рассинхрона «склад вернули / долг остался» при успехе API.
- [ ] Тесты T1–T12 зелёные.
- [ ] Документирован метод пересчёта графика.

---

## 13. Рекомендуемый порядок внедрения

1. **Миграция:** поле `sale_id` + unique.
2. **Checkout / createDeal:** запись связи + идемпотентность (закрывает A3 dual-write).
3. **Return service:** корректировка долга в той же транзакции.
4. **Ответ API** `debt_adjustment`.
5. **Legacy match command** для старых сделок.
6. **FE** тосты / `sale_id` в createDeal / refresh должников.

---

## 14. Вне объёма (v1)

- Автоматический cashflow-расход на `cash_refund_due` без подтверждения кассира.
- Авто-`refundDeal` всех исторических pay.
- Возврат через складской документ `SALE_RETURN` (отдельный поток) — **не** синхронизировать в v1; при необходимости фаза 2: при проведении документа искать Sale и звать тот же debt-adjust сервис.
- Ручные сделки без продажи (`sale_id=null`) — по-прежнему только ручное удаление/оплата в карточке клиента.

---

## 15. Краткая постановка одной фразой для бэка

> При `POST .../sales/{id}/return/` для продажи в долг в той же транзакции найти Deal/Debt по `sale_id`, уменьшить `remaining_debt` (и unpaid installments) на сумму возврата, при полном возврате или нулевом остатке — закрыть/аннулировать сделку; в ответе отдать `debt_adjustment` и `cash_refund_due` для предоплаты/уже оплаченной части.
