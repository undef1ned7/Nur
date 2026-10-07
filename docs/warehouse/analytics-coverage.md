# Аналитика склада — полнота: какие операции должны попадать в отчёт

**Сфера:** Склад (`warehouse`).
**Страница:** `/crm/warehouse/analytics` (владелец/админ).
**Фронт:** `src/Components/Sectors/Warehouse/Analytics/OwnerAnalyticsContent.jsx`.
**Бэкенд (снимок прода `/home/nur`, 03.10.2026, HEAD `ca526727`):**
`apps/warehouse/analytics.py` (`build_owner_warehouse_analytics_payload`),
`apps/warehouse/salary_services.py`, `apps/warehouse/services.py`.
**Эндпоинт:** `GET /api/warehouse/owner/analytics/`.
**Статус:** ⚠️ Аналитика неполная. Бэкенд — нужны новые блоки.
Фронт — ✅ готово (§6): блоки появятся автоматически, когда бэкенд начнёт отдавать поля.

Сводка: [audit-2026-10-stock-analytics.md](./audit-2026-10-stock-analytics.md).
Ошибки в уже существующих расчётах: [analytics-calculation-fixes.md](./analytics-calculation-fixes.md).

---

## 1. Задача

Сейчас аналитика владельца — это по сути «продажи агентов + касса». Закупки,
движение товара, зарплата агентов и прибыль в неё не попадают совсем. Владелец
не видит полной картины бизнеса за период.

Нужно:

1. Зафиксировать, **какая операция в какую метрику попадает** (матрица §3).
2. Добавить недостающие блоки: закупки, движение товара, агенты, зарплата, прибыль.
3. Сделать так, чтобы деньги, ушедшие из кассы на зарплату, были видны в кассе.

---

## 2. Что попадает сейчас (прод, 30 дней до 03.10.2026)

| Операция | Количество / сумма | В аналитике владельца |
|---|---|---|
| Продажи агентов, `POSTED` | 3 932 / 17 672 097 сом | ✅ |
| Продажи без агента, `POSTED` | 11 / 91 963 сом | ❌ (см. A6) |
| Продажи «Ожидает кассы» | 3 / 39 584 сом | ❌ (см. A7) |
| Возвраты продаж агентов | 0 | ⚠️ только в KPI (см. A9) |
| Закупки (`PURCHASE`), `POSTED` | 10 / 745 832 сом | ❌ |
| Приход товара (`RECEIPT`), `POSTED` | 2 / 6 530 675 сом | ❌ как товар; ⚠️ как **приход денег** (ошибка A1) |
| Возврат поставщику (`PURCHASE_RETURN`) | 0 | ❌ |
| Списание (`WRITE_OFF`) | 0 проведённых | ❌ (только в аналитике агента — по его документам) |
| Инвентаризация (`INVENTORY`) | 1 / 325 | ❌ |
| Перемещение (`TRANSFER`) | 0 за период (43 за всё время) | ❌ |
| Выдача товара агентам (заявки) | 2 одобрено | ✅ |
| Возврат товара от агентов на склад | 0 | ❌ |
| Начисления зарплаты агентам | 6 711 / **758 240 сом** | ❌ |
| Выплаты зарплаты агентам | 0 | ❌ — и в кассе не видны вообще, см. §4.4 |
| Денежные документы, `POSTED` | приход 90 / 7 074 102, расход 11 / 771 171 | ✅ (с ошибками классификации A1–A3) |
| Себестоимость и прибыль | — | ❌ не считаются |
| Остаток на складе | 321 057 ед. (ИП Акматалиева) | ❌ показывается остаток у агентов (A5) |

> Продажи покрыты на 99,3% по сумме. Основные пробелы — закупки, движение
> товара, зарплата, прибыль, остатки и деньги агентов.

---

## 3. Целевая матрица: операция → метрика

Обозначения: **Пр** — «Продажи», **Зк** — «Закупки», **Дв** — «Движение товара»,
**Аг** — «Агенты», **ЗП** — «Зарплата», **Кс** — «Касса», **Пб** — «Прибыль».

| Операция (статус) | Пр | Зк | Дв | Аг | ЗП | Кс | Пб |
|---|---|---|---|---|---|---|---|
| `SALE` (`POSTED`, `CASH_PENDING`) | + выручка | | − отгружено | по агенту | | только через `MoneyDocument` | + выручка, − себестоимость |
| `SALE_RETURN` (`POSTED`) | − выручка | | + возвращено | по агенту | | через `MoneyDocument` | − выручка, + себестоимость |
| `PURCHASE` (`POSTED`) | | + закупка | + принято | | | через `MoneyDocument` | |
| `RECEIPT` (`POSTED`) | | + закупка | + принято | | | через `MoneyDocument` (**расход**, A1) | |
| `PURCHASE_RETURN` (`POSTED`) | | − закупка | − возвращено поставщику | | | через `MoneyDocument` | |
| `WRITE_OFF` (`POSTED`) | | | − списано | | | — (A1) | − убыток по закупочной цене |
| `INVENTORY` (`POSTED`) | | | ± излишки и недостачи | | | — | ± по закупочной цене |
| `TRANSFER` (`POSTED`) | | | перемещено (не меняет итог по компании) | | | — | |
| Выдача агенту (заявка `approved`) | | | − со склада | + выдано | | — | |
| Возврат от агента (`approved`) | | | + на склад | − у агента | | — | |
| Начисление ЗП (`accrued`, `paid`) | | | | по агенту | + начислено | — | − расход на ЗП |
| Выплата ЗП (`AgentSalaryPayout`) | | | | по агенту | + выплачено | **− расход** (§4.4) | |
| `MoneyDocument` (`POSTED`) | | | | | | ± | |
| Инкассация | | | | | | ± (между кассами) | |
| `DRAFT`, `SALE_REQUEST`, `REJECTED`, `COMMERCIAL_OFFER` | не учитываются нигде | | | | | | |

Правило статусов: товарные метрики — `POSTED` (+ `CASH_PENDING` для продаж,
см. A7). Денежные — только проведённые `MoneyDocument`.

---

## 4. Новые блоки

### 4.1. Закупки

```python
purchase_qs = Document.objects.filter(
    company_scope, status=POSTED, doc_type__in=(PURCHASE, RECEIPT), date__range=…)
purchase_return_qs = … doc_type=PURCHASE_RETURN
```

| Поле | Формула |
|---|---|
| `purchases_count` | число документов `PURCHASE` + `RECEIPT` |
| `purchases_amount` | `Σ total` |
| `purchase_returns_amount` | `Σ total` по `PURCHASE_RETURN` |
| `net_purchases_amount` | `purchases_amount − purchase_returns_amount` |
| `purchases_by_payment_kind` | `{cash, credit, external}` |
| `details.purchases_by_supplier[]` | `counterparty_id, name, docs_count, amount` (топ 100) |
| `charts.purchases_by_date[]` | `date, amount` |

### 4.2. Движение товара

По `StockMove` (после [stock-single-source-of-truth.md](./stock-single-source-of-truth.md)
у каждого движения есть `source_kind`), за период, в штуках и по закупочной цене:

| Поле | Источник |
|---|---|
| `received_qty`, `received_cost` | движения `+` документов `PURCHASE`/`RECEIPT` |
| `shipped_qty` | движения `−` документов `SALE` |
| `written_off_qty`, `written_off_cost` | `WRITE_OFF` |
| `inventory_surplus_qty/cost`, `inventory_shortage_qty/cost` | `INVENTORY` с `+` и `−` |
| `transferred_qty` | `TRANSFER` (только расход, чтобы не считать дважды) |
| `issued_to_agents_qty` | `source_kind=agent_issue` |
| `returned_from_agents_qty` | `source_kind=agent_return` |

`cost` = `qty × DocumentItem.cost_price` (§4.5), а для движений без строки
документа — `qty × product.purchase_price`.

### 4.3. Агенты

| Поле | Формула |
|---|---|
| `agents.issued_qty` | `Σ quantity_requested` одобренных заявок (сейчас `items_approved`) |
| `agents.returned_qty` | `Σ quantity_returned` по `AgentReturnCart` в статусе `approved` |
| `agents.on_hand_qty`, `agents.on_hand_amount` | `AgentStockBalance` (см. A5) |
| `top_agents.by_sales[]` | как сейчас + `returned_qty`, `salary_accrued` |

### 4.4. Зарплата агентов

**Метрики** (по `AgentSalaryAccrual` и `AgentSalaryPayout`):

| Поле | Формула |
|---|---|
| `salary_accrued_amount` | `Σ amount` начислений, созданных за период, статусы `accrued` + `paid` |
| `salary_paid_amount` | `Σ amount` выплат за период |
| `salary_payable_amount` | текущий долг по ЗП: `Σ amount` по `accrued` (не зависит от периода) |
| `details.salary_by_agent[]` | `agent_id, name, accrued, paid, payable` |

**Связь с кассой.** Сейчас `salary_services.create_payout` (`salary_services.py:213-283`)
создаёт только `AgentSalaryPayout`, денежного документа нет. Деньги физически
уходят из кассы, но в кассе этого не видно, и её баланс завышен.
В [salary.md](./salary.md) это записано как «не в этой итерации». Предлагается
сделать в следующей:

```python
def create_payout(*, company, agent, amount, comment="", created_by=None, cash_register=None):
    …
    if cash_register is not None:
        money = MoneyDocument.objects.create(
            doc_type=MoneyDocument.DocType.MONEY_EXPENSE,
            status=MoneyDocument.Status.DRAFT,
            cash_register=cash_register,
            company=company, branch=cash_register.branch,
            payment_category=system_category(company, branch, SystemCode.SALARY),
            amount=amount,
            comment=f"Выплата ЗП агенту {agent_display}",
        )
        services_money.post_money_document(money)
        payout.money_document = money          # новое поле FK, nullable
        payout.save(update_fields=["money_document"])
```

- `cash_register` — новый необязательный параметр `POST` выплаты. Без него
  поведение прежнее (выплата «вне кассы»).
- В ответе `GET/POST /api/warehouse/salary/payouts/` добавить read-only поля
  `cash_register` (uuid | null), `cash_register_name` (string | null) и
  `money_document` (uuid | null). Фронт показывает в колонке «Касса»
  `cash_register_name`, а без него — «Касса» или «Вне кассы».
- Ошибки (нет денег в кассе, касса другой компании) возвращать как
  `400 {"cash_register": ["…"]}` или `{"detail": "…"}`: фронт показывает текст как есть.
- Проверять, что в кассе достаточно денег (`cash_register_balance`), как при
  инкассации.
- Отмена выплаты должна распроводить денежный документ.
- В кассовой аналитике такой расход попадает в «Расход по кассе», категория
  «Зарплата агентам».

### 4.5. Себестоимость и прибыль

Чтобы прибыль не «плыла» при смене закупочной цены, себестоимость нужно
фиксировать в момент проведения.

**Модель:** `DocumentItem.cost_price` (`Decimal(18,2)`, nullable). Заполняется в
`post_document` для `SALE` и `SALE_RETURN` значением `product.purchase_price` на
момент проведения.

**Backfill:** для проведённых документов взять текущий `purchase_price`. В
ответе API пометить `cost_is_estimated: true`, если в периоде есть строки с
восстановленной себестоимостью.

| Поле | Формула |
|---|---|
| `revenue_amount` | `Σ net_amount` строк продаж − то же для возвратов (= `sales_amount` из A8/A9) |
| `cogs_amount` | `Σ qty × cost_price` продаж − то же для возвратов |
| `gross_profit_amount` | `revenue_amount − cogs_amount` |
| `gross_margin_percent` | `gross_profit / revenue × 100` (если `revenue > 0`) |
| `writeoff_loss_amount` | `written_off_cost + inventory_shortage_cost − inventory_surplus_cost` |
| `salary_expense_amount` | `salary_accrued_amount` |
| `operating_profit_amount` | `gross_profit − writeoff_loss − salary_expense` |
| `details.profit_by_product[]` | `product_id, name, qty, revenue, cogs, profit, margin` (топ 100 по прибыли) |
| `details.profit_by_agent[]` | то же по агентам |

> Это **управленческая** прибыль по документам склада. Прочие расходы из кассы
> (аренда и т.п.) сюда не входят: их видно в «Расходах по категориям».

---

## 5. Контракт API (добавления к `GET /api/warehouse/owner/analytics/`)

Все поля новые. Существующие поля не меняются (кроме описанных в
[analytics-calculation-fixes.md](./analytics-calculation-fixes.md) §4).

```jsonc
{
  "summary": {
    "purchases_count": 12,
    "purchases_amount": "7276507.00",
    "purchase_returns_amount": "0.00",
    "net_purchases_amount": "7276507.00",
    "purchases_by_payment_kind": { "cash": "…", "credit": "…", "external": "…" },

    "received_qty": "…", "shipped_qty": "…",
    "written_off_qty": "…", "written_off_cost": "…",
    "inventory_surplus_qty": "…", "inventory_surplus_cost": "…",
    "inventory_shortage_qty": "…", "inventory_shortage_cost": "…",
    "transferred_qty": "…",
    "issued_to_agents_qty": "…", "returned_from_agents_qty": "…",

    "salary_accrued_amount": "758240.00",
    "salary_paid_amount": "0.00",
    "salary_payable_amount": "…",

    "revenue_amount": "…",
    "cogs_amount": "…",
    "gross_profit_amount": "…",
    "gross_margin_percent": "…",
    "writeoff_loss_amount": "…",
    "salary_expense_amount": "758240.00",
    "operating_profit_amount": "…",
    "cost_is_estimated": true
  },
  "charts": {
    "purchases_by_date": [ { "date": "2026-10-01", "amount": "…" } ],
    "profit_by_date":    [ { "date": "2026-10-01", "revenue": "…", "cogs": "…", "gross_profit": "…" } ]
  },
  "details": {
    "purchases_by_supplier": [ { "counterparty_id": "…", "name": "…", "docs_count": 3, "amount": "…" } ],
    "salary_by_agent":      [ { "agent_id": "…", "agent_name": "…", "accrued": "…", "paid": "…", "payable": "…" } ],
    "profit_by_product":    [ { "product_id": "…", "product_name": "…", "qty": "…", "revenue": "…", "cogs": "…", "profit": "…", "margin_percent": "…" } ],
    "profit_by_agent":      [ { "agent_id": "…", "agent_name": "…", "revenue": "…", "cogs": "…", "profit": "…" } ]
  }
}
```

Числа в примере — иллюстрация на данных прода за 30 дней, не эталон для теста.

**Права:** блоки «Закупки», «Прибыль» и «Зарплата» — только `owner`/`admin`. В
аналитике агента (`agents/me/analytics/`) их не возвращать, кроме
`salary_by_agent` по самому агенту.

**Производительность:** блоки считать агрегатами в БД, без циклов в Python.
Для «прибыли по товарам» нужен индекс `DocumentItem(document_id, product_id)`
(проверить, есть ли). Кэш — как в A11 (версионный ключ).

---

## 6. Фронт

[OwnerAnalyticsContent.jsx](../../src/Components/Sectors/Warehouse/Analytics/OwnerAnalyticsContent.jsx):

| Блок | Содержимое |
|---|---|
| KPI-ряд «Итоги» | Выручка, Себестоимость, Валовая прибыль (маржа %), Закупки, Списания, ЗП агентам |
| Аккордеон «Закупки» | по поставщикам + график по датам |
| Аккордеон «Движение товара» | принято / отгружено / списано / инвентаризация ± / перемещено / агентам ↔ |
| Аккордеон «Зарплата агентов» | по агентам: начислено, выплачено, к выплате |
| Аккордеон «Прибыль по товарам» | таблица с маржой; пометка «себестоимость оценочная», если `cost_is_estimated` |

Все новые блоки скрывать, если полей нет в ответе (совместимость со старым
бэкендом).

**Реализовано на фронте:**

| Что | Где |
|---|---|
| «Итоги за период»: выручка, себестоимость, валовая прибыль (маржа), закупки, списания, ЗП агентам, операционная прибыль; пометка «себестоимость оценочная» | `OwnerAnalyticsContent.jsx` + `warehouseAnalyticsModel.js` → `buildBusinessTotals` |
| Аккордеоны «Закупки» (по оплате, график, по поставщикам), «Движение товара», «Зарплата агентов», «Прибыль по товарам» (с графиком), «Прибыль по агентам» | `OwnerAnalyticsContent.jsx` |
| Агенту закупки, прибыль и ЗП не показываются (`showMoneyAnalytics=false`) | `OwnerAnalyticsContent.jsx` |
| Выплата ЗП: выбор кассы («Без кассы» по умолчанию), колонка «Касса» в списке выплат, понятные ошибки | `Salary/Salary.jsx`, `src/api/warehouseSalary.js` |

---

## 7. Сценарии для тестов

| # | Данные за период | Ожидание |
|---|---|---|
| 1 | `PURCHASE` 1 000 (cash) + `RECEIPT` 500 (credit) + `PURCHASE_RETURN` 200 | `purchases_amount` = 1 500, `net_purchases_amount` = 1 300, `by_payment_kind.cash` = 1 000 |
| 2 | Продажа 10 шт по 100 (закупка 60), возврат 2 шт | `revenue` = 800, `cogs` = 480, `gross_profit` = 320, маржа 40% |
| 3 | Сменили `purchase_price` товара после продажи | прибыль за прошлый период не изменилась |
| 4 | `WRITE_OFF` 3 шт (закупка 50) | `written_off_qty` = 3, `written_off_cost` = 150, в кассе 0 |
| 5 | `INVENTORY`: учёт 10, факт 8 (закупка 50) | `inventory_shortage_qty` = 2, `…_cost` = 100 |
| 6 | Выдача агенту 5, возврат от агента 2 | `issued_to_agents_qty` = 5, `returned_from_agents_qty` = 2 |
| 7 | Начислено агенту 300, выплачено 200 с кассой | `salary_accrued` = 300, `salary_paid` = 200, `payable` = 100; в кассе расход 200, категория «Зарплата агентам» |
| 8 | Выплата без `cash_register` | `salary_paid` = 200, в кассе 0 (прежнее поведение) |
| 9 | `TRANSFER` 4 шт между своими складами | `transferred_qty` = 4, итог остатка по компании не изменился, в прибыли 0 |
| 10 | Документы `DRAFT`/`REJECTED`/`COMMERCIAL_OFFER` | ни в одной метрике |

---

## 8. Чек-лист приёмки

**Бэкенд**
- [ ] Блок «Закупки» (§4.1) с разбивкой по оплате и поставщикам.
- [ ] Блок «Движение товара» (§4.2) по `StockMove`.
- [ ] Блок «Агенты» (§4.3) с возвратами от агентов.
- [ ] Блок «Зарплата» (§4.4); `create_payout` с необязательной кассой создаёт `MONEY_EXPENSE`.
- [ ] `DocumentItem.cost_price` добавлено, заполняется при проведении, сделан backfill.
- [ ] Блок «Прибыль» (§4.5), флаг `cost_is_estimated`.
- [ ] Права: агенту не отдаются закупки и прибыль.
- [ ] Тесты §7 зелёные.

**Фронт**
- [x] Новые KPI и аккордеоны, со скрытием при отсутствии полей.
- [x] Выплата ЗП: выбор кассы (страница зарплаты агентов).

---

## 9. Связанные файлы

| Слой | Путь |
|---|---|
| Аналитика владельца | `apps/warehouse/analytics.py` (бэкенд) |
| Зарплата агентов | `apps/warehouse/salary_services.py`, `salary_views.py` (бэкенд); ТЗ [salary.md](./salary.md) |
| Проведение документов | `apps/warehouse/services.py` (бэкенд) |
| Модели | `apps/warehouse/models.py` — `DocumentItem`, `StockMove`, `AgentSalaryAccrual`, `AgentSalaryPayout`, `AgentReturnCart` |
| Фронт аналитики | `src/Components/Sectors/Warehouse/Analytics/OwnerAnalyticsContent.jsx` |
| Фронт зарплаты | `src/Components/Sectors/Warehouse/Salary/` |

---

## 10. Зависимости

- §4.2 «Движение товара» зависит от `StockMove.source_kind` из
  [stock-single-source-of-truth.md](./stock-single-source-of-truth.md) §5.2.
- §4.5 «Прибыль» использует `DocumentItem.net_amount` из
  [analytics-calculation-fixes.md](./analytics-calculation-fixes.md) A8.
- §4.1 «Закупки» корректна в кассовой части только после A1 (`RECEIPT → MONEY_EXPENSE`).
