# Аналитика склада — неверные расчёты: касса, продажи, остатки

**Сфера:** Склад (`warehouse`).
**Страницы:** `/crm/warehouse/analytics` (владелец/админ и агент), аналитика
партнёров. Косвенно — фильтр агентов в «Документах» и «Кассе».
**Фронт:** `src/Components/Sectors/Warehouse/Analytics/` — `Analytics.jsx`,
`OwnerAnalyticsContent.jsx`, `AgentAnalytics.jsx`, `useAnalyticsPeriod.js`,
`warehouseAnalyticsShared.js`.
**Бэкенд (снимок прода `/home/nur`, 03.10.2026, HEAD `ca526727`):**
`apps/warehouse/analytics.py`, `apps/warehouse/views_analytics.py`,
`apps/warehouse/services.py`.
**Эндпоинты:** `GET /api/warehouse/owner/analytics/`,
`GET /api/warehouse/agents/me/analytics/`,
`GET /api/warehouse/owner/agents/{agent_id}/analytics/`,
`GET /api/warehouse/owner/agents/analytics/`,
`GET /api/warehouse/owner/partners/analytics/`,
`GET /api/warehouse/owner/partners/{id}/analytics/`.
**Статус:** ❌ Баги на проде. Бэкенд и данные — нужны правки.
Фронт — ✅ готово (§5), работает и со старым, и с новым ответом.

Сводка: [audit-2026-10-stock-analytics.md](./audit-2026-10-stock-analytics.md).
Что вообще не попадает в аналитику: [analytics-coverage.md](./analytics-coverage.md).
Остатки: [stock-single-source-of-truth.md](./stock-single-source-of-truth.md).

---

## 1. Задача

Пользователи сообщают, что аналитика склада «неправильно считает». Аудит
кода и данных прода нашёл ошибки в трёх местах:

1. **Касса** показывает фиктивный приход и не показывает реальную выручку.
2. **Продажи** считаются по разным формулам в разных блоках и не все.
3. **Остатки** показывают остаток у агентов, а не на складе.

Нужно исправить расчёты, договориться об одной формуле для каждой метрики и
поправить испорченные данные.

---

## 2. Сводка проблем

| # | Проблема | Влияние на проде (30 дней до 03.10.2026) | Приоритет |
|---|---|---|---|
| A1 | Оприходование (`RECEIPT`) создаёт **приход** денег в кассу | +6 530 675 сом фиктивного прихода | 🔴 P0 |
| A2 | Категория платежа для автодокументов выбирается «первая попавшаяся» | авто-приход товара записан в категорию «Продажа» | 🔴 P0 |
| A3 | Оплаты продаж попадают в «контрагентов», а не в «Приход по кассе» | 10 оплат / 66 313 сом не в той графе | 🟠 P1 |
| A4 | Выручка агентов не видна в кассовой части | 3 932 продажи / 17,7 млн сом | 🟠 P1 (решение продукта) |
| A5 | «Остаток» = остаток **у агентов**, а не на складе | показывает 0 при 321 057 ед. на складе | 🔴 P0 |
| A6 | Продажи без агента не учитываются | 11 продаж / 91 963 сом | 🟠 P1 |
| A7 | Продажи «Ожидает кассы» не учитываются | 3 / 39 584 сом | 🟡 P2 |
| A8 | Сумма продаж считается по 4 разным формулам | «по товарам» +7 665 сом у одного клиента | 🟠 P1 |
| A9 | Возвраты вычитаются только в KPI | разойдётся при первом возврате | 🟠 P1 |
| A10 | Доля агента считается от топ-10, а не от общей суммы | доли завышены (11 агентов) | 🟡 P2 |
| A11 | Кэш 10 минут без сброса | продажа видна через 10 минут | 🟡 P2 |
| A12 | Фронт берёт «сегодня» в UTC | с 00:00 до 06:00 «День» = вчера | 🟡 P2 |
| A13 | Мультискладские продажи без `warehouse_from` выпадают | 44 старых документа / 685 903 сом | 🟡 P2 |
| A14 | Продажи с датой в будущем | 7 / 54 027 сом не в текущем периоде | 🟢 P3 |
| A15 | Фильтр агентов в «Документах» и «Кассе» строится из топ-10 аналитики | агенты вне топ-10 не выбираются | 🟡 P2 |
| A16 | Мелочи UI: подписи и поле закупочной цены | — | 🟢 P3 |

---

## 3. Проблемы и решения

### A1. Оприходование создаёт приход денег (🔴 P0)

**Где:** `services.py:317-326`, функция `_resolve_money_doc_type`:

```python
models.Document.DocType.RECEIPT: models.MoneyDocument.DocType.MONEY_RECEIPT,   # ← ошибка
```

`RECEIPT` — это **приход товара** на склад. На фронте у него есть способ
оплаты: «Через кассу / В долг / Вне кассы» ([Documents.jsx:1444-1460](../../src/Components/Sectors/Warehouse/Documents/Documents.jsx#L1444-L1460)).
Если товар оплачен через кассу, деньги **уходят** поставщику. Сейчас создаётся
**приход** денег.

При этом `sync_document_auto_cashflow` (`services.py:1145-1151`) для того же
документа пишет **расход** «Закупки». Сервис противоречит сам себе.

**Данные прода:** у ИП Акматалиева Жыргал весь «Приход по кассе» за месяц
состоит из двух таких авто-документов:

| Документ | Денежный документ | Сумма | Категория |
|---|---|---|---|
| RECEIPT-20260924-0001 | «АВТО: RECEIPT RECEIPT-20260924-0001», `MONEY_RECEIPT` | 4 608 665 | Продажа |
| RECEIPT-20261001-0001 | «АВТО: RECEIPT RECEIPT-20261001-0001», `MONEY_RECEIPT` | 1 922 010 | Продажа |

Кроме того, `cash_register_balance` (баланс кассы) завышен на ту же сумму.
Касса позволит «выдать» деньги, которых нет.

**Решение:**

```python
mapping = {
    SALE: MONEY_RECEIPT,
    PURCHASE: MONEY_EXPENSE,
    RECEIPT: MONEY_EXPENSE,          # приход товара, оплаченный из кассы = расход денег
    SALE_RETURN: MONEY_EXPENSE,
    PURCHASE_RETURN: MONEY_RECEIPT,
    WRITE_OFF: None,                 # списание — без денег (см. ниже)
}
```

- `WRITE_OFF → MONEY_EXPENSE` тоже ошибочно: при списании брака деньги из кассы
  не уходят. Поставить `None`. Убыток от списания показывать в аналитике по
  закупочной цене (см. [analytics-coverage.md](./analytics-coverage.md)).
- `sync_document_auto_cashflow` оставить как есть (`RECEIPT` → расход «Закупки»).
  Проверить, что `WRITE_OFF` там тоже не трактуется как денежный расход
  (`DEFECT_WRITEOFF`) — это решение владельца продукта.

**Исправление данных** (команда `fix_receipt_money_documents`, по умолчанию `--dry-run`):

1. Найти `MoneyDocument`, у которых `source_document.doc_type = RECEIPT` и
   `doc_type = MONEY_RECEIPT`. На проде 2 шт.
2. Для каждого выполнить `services_money.unpost_money_document(doc)`, затем
   поставить статус `REJECTED` с пометкой «Исправление: приход товара ошибочно
   создал приход денег».
3. **Спросить владельца компании**, оплачивался ли этот товар из кассы. Если да —
   создать корректный `MONEY_EXPENSE` (через повторную генерацию по исправленному
   маппингу). Если нет — сменить у документа `payment_kind` на `external`
   («Вне кассы»).
4. Сбросить кэш аналитики компании.

### A2. Категория платежа выбирается «первая попавшаяся» (🔴 P0)

**Где:** `services.py:466-472` (`_create_or_post_money_document`) и
`services.py:936-942` (предоплата):

```python
payment_category = _pick_single(qs, what="категорий платежа", allow_multiple_take_first=True)
```

Если категория не указана в документе, берётся первая категория компании по
`id`. Поэтому приход товара из A1 попал в «Продажа», а в отчёте «Приходы/Расходы
по категориям» суммы разложены случайно.

**Решение:** выбирать **системную** категорию по типу документа, а если её
нет — оставлять `None` («Без категории»).

```python
class PaymentCategory.SystemCode(models.TextChoices):
    SALE = "sale", "Продажа"
    DEBT = "debt", "Долги"
    INCASSATION = "incassation", "Инкассация"
    PURCHASE = "purchase", "Закупка"                 # новый
    SALE_RETURN = "sale_return", "Возврат покупателю" # новый
    PURCHASE_RETURN = "purchase_return", "Возврат от поставщика"  # новый
    SALARY = "salary", "Зарплата агентам"            # новый, см. analytics-coverage.md

DOC_TYPE_TO_CATEGORY = {
    SALE: SystemCode.SALE,
    PURCHASE: SystemCode.PURCHASE,
    RECEIPT: SystemCode.PURCHASE,
    SALE_RETURN: SystemCode.SALE_RETURN,
    PURCHASE_RETURN: SystemCode.PURCHASE_RETURN,
}
```

Системные категории создаются через `get_or_create` на компанию и филиал (как
сейчас «Инкассация» в `_payment_category_incassation`).

### A3. Оплаты продаж попадают в «Операции с контрагентами» (🟠 P1)

**Где:** `analytics.py:371-378`:

```python
is_debt = Q(payment_category__system_code="debt")
is_cp = Q(counterparty_id__isnull=False) & ~is_debt      # любой документ с контрагентом
is_regular = ~is_cp & ~is_debt
```

Для наличной продажи контрагент обязателен (`services.py:439-444`). Поэтому
**любая** авто-оплата продажи попадает в «Приход от контрагентов», а не в
«Приход по кассе».

**Данные прода:** 10 авто-оплат продаж на 66 313 сом сейчас в графе контрагентов.

**Решение:** классифицировать по **источнику**, а не по наличию контрагента:

```python
is_debt = Q(payment_category__system_code=PaymentCategory.SystemCode.DEBT)
is_doc_payment = Q(source_document__isnull=False)                 # оплата товарного документа
is_cp = Q(counterparty_id__isnull=False) & Q(source_document__isnull=True) & ~is_debt
is_regular = ~is_cp & ~is_debt                                     # включает оплаты документов
```

| Графа | Что в неё входит |
|---|---|
| «Приход/Расход по кассе» | ручные документы без контрагента + **авто-оплаты товарных документов** (продажа, закупка, возвраты, предоплата) |
| «Операции с контрагентами» | ручные взаиморасчёты: есть контрагент, нет `source_document` |
| «Долги» | системная категория `debt` |

Те же условия использовать в `by_cash_register`, `_by_category` и `money_by_date`
(`analytics.py:402-539`).

### A4. Выручка агентов не видна в кассе (🟠 P1, нужно решение продукта)

**Где:** `services.py:985-989`:

```python
requires_money = (payment_kind == CASH and money_doc_type is not None and not document.agent_id)
```

Для продаж агентов денежный документ не создаётся, а кассовая аналитика
строится только по `MoneyDocument`.

**Данные прода:** 3 932 наличные продажи агентов на 17 672 097 сом. В кассовой
аналитике их нет.

**Варианты** (выбирает владелец продукта):

| Вариант | Суть | Плюсы | Минусы |
|---|---|---|---|
| **A (рекомендуется сейчас)** | Ввести в аналитике отдельный блок **«Выручка по документам продаж»** с разбивкой по `payment_kind` (`cash` / `credit` / `external`) и по агентам. «Касса» остаётся «движением денег по кассе» | Без изменения модели денег, честные подписи | Деньги агентов в кассе компании не видны, пока агент их не сдал |
| B (следующая итерация) | Касса агента: при наличной продаже агента создавать `MONEY_RECEIPT` в **кассу агента**, а сдачу денег оформлять инкассацией в кассу компании | Полный денежный учёт | Нужны кассы агентов и процесс сдачи выручки |

Для варианта A контракт описан в §4 (`revenue_by_payment_kind`).

### A5. «Остаток» — это остаток у агентов, а не на складе (🔴 P0)

**Где:** `analytics.py:872-880` (KPI) и `analytics.py:1002-1036` (таблица
«Склады»). Оба берут `AgentStockBalance`.

Агенты продают с общего склада (`use_common_stock=True`: 9 253 из 9 274
проведённых агентских документов за всё время), поэтому `AgentStockBalance`
почти всегда 0.

**Данные прода:**

| Компания | В аналитике «Остаток» | Фактически на складах |
|---|---|---|
| ИП Акматалиева Жыргал | 0 | 321 057 |
| БАТКЕН ШААРЫ САЙДЫМАН | 0 | 38 420 |
| ИП Айдаралиев | 8 | 25 110 |

**Решение:** считать две метрики раздельно.

- **Остаток на складах** — по `StockBalance` (после исправления из
  [stock-single-source-of-truth.md](./stock-single-source-of-truth.md)):
  - `warehouse_on_hand_qty = Σ qty`;
  - `warehouse_on_hand_amount = Σ qty × product.price`;
  - `warehouse_on_hand_purchase_amount = Σ qty × product.purchase_price`.
- **У агентов на руках** — по `AgentStockBalance`, поля `agent_on_hand_qty` и
  `agent_on_hand_amount`.
- Те же поля возвращать в каждом `details.warehouses[]`. Это закрывает и ТЗ
  [analytics-warehouses-purchase-price.md](./analytics-warehouses-purchase-price.md):
  поле `on_hand_purchase_amount` сейчас **не реализовано**, и колонка
  «Закупочная цена» на фронте всегда 0.
- Старые `on_hand_qty`/`on_hand_amount` оставить на один релиз как алиасы
  `agent_on_hand_*` (помечены deprecated), потом удалить.

### A6. Продажи без агента не учитываются (🟠 P1)

**Где:** `analytics.py:843-850`, `857-864` и в `build_owner_agents_sales_analytics_payload`:
стоит фильтр `agent__isnull=False`.

Продажи владельца или кассира не видны ни в KPI, ни в графике, ни в «по товарам
/ группам / складам».

**Данные прода:** 11 продаж на 91 963 сом (ИП Акматалиева — 10 / 66 313,
ИП Айдаралиев — 1 / 25 650).

**Решение:** в `build_owner_warehouse_analytics_payload`:

- `sales_*` — **все** продажи компании;
- добавить `agent_sales_count`, `agent_sales_amount` (с `agent__isnull=False`) и
  `own_sales_count`, `own_sales_amount` (без агента);
- `top_agents` по-прежнему только по агентам;
- `build_owner_agents_sales_analytics_payload` («аналитика по агентам») оставить
  только по агентам — это его смысл.

На фронте KPI переименовать: «Количество продаж» и «Сумма продаж», а в
подсказке «из них агенты: …».

### A7. Продажи «Ожидает кассы» не учитываются (🟡 P2)

**Где:** везде фильтр `status=POSTED`. Документ в `CASH_PENDING` уже списал
товар со склада (`post_document`), но в продажах его нет.

**Данные прода:** 3 продажи / 39 584 сом.

**Решение:** продажи считать по статусам `POSTED` и `CASH_PENDING` (товар отгружен).
Отдельно вернуть `pending_cash_sales_count` и `pending_cash_sales_amount`, чтобы
показать «ожидают подтверждения кассы». Кассовые метрики по-прежнему только по
проведённым `MoneyDocument`.

### A8. Сумма продаж по четырём разным формулам (🟠 P1)

| Блок | Сейчас считает | Учитывает скидку строки | Учитывает скидку документа | Вычитает возвраты |
|---|---|---|---|---|
| KPI «Сумма продаж» | `Σ Document.total` − возвраты | ✅ | ✅ | ✅ |
| График «Динамика продаж», топ агентов, «Склады» | `Σ Document.total` | ✅ | ✅ | ❌ |
| «Продажи по товарам» (`analytics.py:903-916`) | `Σ qty × price` | ❌ | ❌ | ❌ |
| «Продажи по группам» (`analytics.py:322-350`) | `Σ line_total` | ✅ | ❌ | ❌ |

**Данные прода:** у ИП Айдаралиев за 30 дней документы дают 316 607, а «по
товарам» — 324 272 (+7 665, это скидки).

**Решение: одна формула «чистой суммы строки».**

1. Новое поле `DocumentItem.net_amount` (`Decimal(18,2)`): сумма строки с учётом
   **и** скидки строки, **и** доли скидки документа.
2. Заполнять в `recalc_document_totals` (`services.py:248-275`):

```python
subtotal = Σ item.line_total
doc_discount = document.discount_amount
for item in items:
    share = item.line_total / subtotal if subtotal > 0 else 0
    item.net_amount = (item.line_total - doc_discount * share).quantize(0.01)
# остаток от округления добавить к самой крупной строке, чтобы Σ net_amount == document.total
```

3. Миграция с backfill для всех существующих документов (тот же расчёт).
4. Все блоки «по товарам», «по группам» и «по складам строк» считать по
   `Σ net_amount`. KPI и график — по `Σ Document.total`. Инвариант:
   `Σ net_amount по документу == Document.total`.

### A9. Возвраты вычитаются только в KPI (🟠 P1)

**Решение:** во **всех** блоках возвращать тройку `gross_*`, `returns_*` и
`net_*` (или `amount` = нетто). По умолчанию показывать нетто:

| Блок | Возврат вычитается из |
|---|---|
| График по датам | даты документа возврата |
| Топ агентов | агента документа возврата |
| «Склады» | склада возврата (`warehouse_from`) |
| «По товарам» / «По группам» | товара или группы строки возврата (`net_amount` строки возврата) |

Возвратов за 30 дней на проде не было, поэтому сейчас цифры совпадают. Первый
же возврат их разведёт.

### A10. Доля агента считается от топ-10 (🟡 P2)

**Где:** бэкенд отдаёт `top_agents.by_sales[:10]` (`analytics.py:929-949`), а фронт
считает долю от суммы этих десяти ([OwnerAnalyticsContent.jsx:76-100](../../src/Components/Sectors/Warehouse/Analytics/OwnerAnalyticsContent.jsx#L76-L100)).
У ИП Акматалиева 11 продающих агентов, поэтому доли завышены.

**Решение:**

- бэкенд добавляет в каждую строку `share_percent` (доля от **всех** продаж
  агентов за период) и `top_agents.total_sales_amount`;
- фронт берёт `share_percent`, а если его нет — считает от
  `summary.agent_sales_amount`;
- колонку «Кол-во» с подписью «шт» переименовать в «Документов» (это число
  документов, а не штук).

### A11. Кэш 10 минут без сброса (🟡 P2)

**Где:** `@cached_result(timeout=settings.CACHE_TIMEOUT_ANALYTICS, …)`, где
`CACHE_TIMEOUT_ANALYTICS = 600`. Ничто не сбрасывает кэш, поэтому новая продажа
видна только через 10 минут.

**Решение:** версионный ключ на компанию.

```python
def analytics_version(company_id) -> int:
    return cache.get_or_set(f"wh_analytics_ver:{company_id}", 1, None)

def bump_analytics_version(company_id):
    try:
        cache.incr(f"wh_analytics_ver:{company_id}")
    except ValueError:
        cache.set(f"wh_analytics_ver:{company_id}", 2, None)
```

- Версию добавить в ключ `cached_result` (параметр `version` или аргумент функции).
- `bump_analytics_version` вызывать через `transaction.on_commit` в
  `post_document`, `unpost_document`, `approve/reject_cash_request`,
  `post/unpost_money_document`, выдаче и возврате агента, `create_payout`.
- TTL можно оставить 600.

### A12. «Сегодня» на фронте в UTC (🟡 P2)

**Где:** `new Date().toISOString().slice(0, 10)`:

- [Analytics.jsx:27, 31, 34](../../src/Components/Sectors/Warehouse/Analytics/Analytics.jsx#L27)
- [useAnalyticsPeriod.js:6, 10, 13](../../src/Components/Sectors/Warehouse/Analytics/useAnalyticsPeriod.js#L6)
- [AgentAnalytics.jsx:259, 264, 267](../../src/Components/Sectors/Warehouse/Analytics/AgentAnalytics.jsx#L259)

Бишкек — UTC+6, поэтому с 00:00 до 06:00 вкладка «День» показывает вчера.

**Решение:** общий хелпер в `warehouseAnalyticsShared.js`:

```javascript
export const toLocalISODate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
```

Заменить им все 9 мест. Заодно убрать дублирование: `Analytics.jsx` и
`AgentAnalytics.jsx` должны использовать `useAnalyticsPeriod`.

Бэкенд работает правильно: `TIME_ZONE='Asia/Bishkek'`, `_dt_range` и `TruncDate`
используют локальную зону.

### A13. Продажи без `warehouse_from` выпадают целиком (🟡 P2)

**Где:** все выборки документов фильтруют `warehouse_from__company=company`.
Мультискладская продажа (`document_allows_multi_warehouse`) может иметь
`warehouse_from = NULL`, и тогда она не попадает **никуда**.

**Данные прода:** 44 проведённые продажи на 685 903 сом (май–август 2026),
без позиций. Новые мультискладские продажи будут теряться так же.

**Решение:**

- Минимум: фильтр компании через `Q(warehouse_from__company=company) |
  Q(warehouse_from__isnull=True, items__product__company=company)` + `.distinct()`.
- Правильно: добавить в `Document` поле `company` (FK, денормализация,
  заполняется при создании, backfill из `warehouse_from`, `warehouse_to` или
  товара первой строки). Фильтровать по нему.
- В таблице «Склады» разносить сумму по складу **строки**
  (`resolve_item_warehouse` → `product.warehouse`), а не по `warehouse_from`.
- Отдельно разобрать 44 пустых проведённых документа: распровести или удалить
  (у них нет строк).

### A14. Продажи с датой в будущем (🟢 P3)

**Данные прода:** 7 продаж на 54 027 сом с `date` более чем на 2 дня позже
`created_at`. В текущем периоде они не видны.

**Решение:** при создании и проведении запретить `date > now() + 1 день`
(`400` «Дата документа не может быть в будущем»). Существующие 7 документов
показать владельцам.

### A15. Фильтр агентов строится из топ-10 аналитики (🟡 P2)

**Где:** [Documents.jsx:227](../../src/Components/Sectors/Warehouse/Documents/Documents.jsx#L227),
[WarehouseKassa.jsx:1230](../../src/Components/Sectors/Warehouse/Kassa/WarehouseKassa.jsx#L1230):
список агентов собирается из `getOwnerAnalytics({period: "month"}).top_agents`,
то есть максимум 10 агентов с продажами или заявками **за последний месяц**.

**Решение:** брать список из `GET /api/warehouse/agents/company-requests/` со
статусом `active` (уже есть в `src/api/warehouse.js`). Если нужен лёгкий
справочник — добавить `GET /api/warehouse/owner/agents/` →
`[{id, name, status}]`.

### A16. Мелочи UI (🟢 P3)

| Где | Сейчас | Должно быть |
|---|---|---|
| KPI «Одобрено позиций» | `Σ quantity_requested` (штуки) | подпись «Выдано агентам, шт» или отдельно `items_count` (число позиций) |
| KPI «Количество/Сумма продаж агентов» (по умолчанию в `OwnerAnalyticsContent`) | только агенты | «Продажи» (все) + «из них агенты» (после A6) |
| Таблица «Склады» → «Остаток, шт» | остаток у агентов | «На складе, шт» + «У агентов, шт» (после A5) |
| «Закупочная цена, сом» | поле не приходит, всегда 0 | заработает после A5 |

---

## 4. Контракт API после исправлений

`GET /api/warehouse/owner/analytics/?period=month|week|day|custom&date=…&date_from=…&date_to=…&branch=…&all_branches=…`

Новые и изменённые поля (существующие, которые здесь не указаны, остаются без изменений):

```jsonc
{
  "summary": {
    // Продажи — ВСЕ продажи компании (POSTED + CASH_PENDING), нетто
    "sales_count": 3946,
    "sales_amount": "17803644.00",          // нетто = gross − returns
    "gross_sales_amount": "17803644.00",
    "returns_count": 0,
    "returns_amount": "0.00",
    "agent_sales_count": 3932,              // новое
    "agent_sales_amount": "17672097.00",    // новое
    "own_sales_count": 14,                  // новое: без агента
    "own_sales_amount": "131547.00",        // новое
    "pending_cash_sales_count": 3,          // новое: CASH_PENDING
    "pending_cash_sales_amount": "39584.00",
    "revenue_by_payment_kind": {            // новое (A4, вариант A)
      "cash": "17803644.00",            // тот же набор документов, что и sales_amount
      "credit": "0.00",
      "external": "0.00"
    },

    // Остатки (A5)
    "warehouse_on_hand_qty": "321057.000",          // новое, по StockBalance
    "warehouse_on_hand_amount": "…",                // × price
    "warehouse_on_hand_purchase_amount": "…",       // × purchase_price
    "agent_on_hand_qty": "0.000",                   // новое = старое on_hand_qty
    "agent_on_hand_amount": "0.00",
    "on_hand_qty": "0.000",                         // DEPRECATED, алиас agent_on_hand_qty
    "on_hand_amount": "0.00",                       // DEPRECATED

    // Касса (A1–A3): ключи прежние, меняется классификация
    "money_receipt_amount": "…",            // включает авто-оплаты документов
    "money_counterparty_receipt_amount": "…" // только ручные взаиморасчёты
  },
  "charts": {
    "sales_by_date": [
      { "date": "2026-10-01", "sales_count": 120, "sales_amount": "…", "gross_sales_amount": "…", "returns_amount": "…" }
    ]
  },
  "top_agents": {
    "total_sales_amount": "17672097.00",    // новое (A10)
    "by_sales": [
      { "agent_id": "…", "agent_name": "…", "sales_count": 812, "sales_amount": "…", "share_percent": "21.40" }
    ]
  },
  "details": {
    "warehouses": [
      {
        "warehouse_id": "…",
        "warehouse_name": "…",
        "sales_count": 0, "sales_amount": "…",
        "warehouse_on_hand_qty": "…",
        "warehouse_on_hand_amount": "…",
        "warehouse_on_hand_purchase_amount": "…",
        "on_hand_purchase_amount": "…",     // = warehouse_on_hand_purchase_amount (ТЗ analytics-warehouses-purchase-price.md)
        "agent_on_hand_qty": "…",
        "agent_on_hand_amount": "…",
        "on_hand_qty": "…", "on_hand_amount": "…"   // DEPRECATED
      }
    ],
    "sales_by_product": [ { "product_id": "…", "product_name": "…", "qty": "…", "amount": "…" } ],  // amount = Σ net_amount − возвраты
    "sales_by_group":   [ { "group_id": "…", "group_name": "…", "docs_count": 0, "qty": "…", "amount": "…" } ]
  }
}
```

Числа в примере — иллюстрация на данных ИП Акматалиева за 30 дней, не эталон для теста.

`GET /api/warehouse/agents/me/analytics/` и `…/owner/agents/{id}/analytics/`:
применить A7, A8, A9, A11. Поле `sales_by_product.amount` считать по `net_amount`.

---

## 5. Фронт: что поменять

| Файл | Изменение |
|---|---|
| `OwnerAnalyticsContent.jsx` | KPI «Продажи» и «Сумма продаж» (все) + подсказка «из них агенты»; KPI «На складах, шт / сом / по закупке» и «У агентов, шт / сом»; доля агента из `share_percent`; «Кол-во» → «Документов»; таблица «Склады»: колонки «На складе», «У агентов», «Продажная», «Закупочная» |
| `OwnerAnalyticsContent.jsx` | Блок «Выручка по способу оплаты» (`revenue_by_payment_kind`) рядом с кассой. Подпись кассы: «Движение денег по кассе (без продаж агентов)», пока не сделан A4-B |
| `Analytics.jsx`, `AgentAnalytics.jsx`, `useAnalyticsPeriod.js` | `toLocalISODate` вместо `toISOString` (A12) |
| `Documents.jsx`, `WarehouseKassa.jsx` | список агентов из `agents/company-requests/` (A15) |

Фронт должен работать и со старым ответом: на все новые поля нужен fallback
(`?? summary.sales_amount` и т.п.).

**Реализовано на фронте:**

| Что | Где |
|---|---|
| Нормализация ответа (новые поля + fallback на старый контракт) | `Analytics/warehouseAnalyticsModel.js` (+ тест) |
| KPI продаж: со старым ответом «Сумма продаж агентов», с новым — «Сумма продаж» + «из них агенты»; «Возвраты», «Ожидают подтверждения кассы», «Выручка: оплата сразу / в долг / вне кассы» | `OwnerAnalyticsContent.jsx` |
| Остатки: «На складах, шт / сом / по закупке» (только если бэкенд прислал `warehouse_on_hand_*`) и «У агентов на руках» | `OwnerAnalyticsContent.jsx` |
| Таблица «Склады»: «На складе, шт», «Продажная», «Закупочная», «У агентов, шт»; со старым ответом остаток склада — «—» | `OwnerAnalyticsContent.jsx` |
| Доля агента: `share_percent`, иначе от `total_sales_amount` / `agent_sales_amount` / `gross_sales_amount`; колонка «Документов» | `warehouseAnalyticsModel.js` → `buildTopAgentsBySales` |
| Подписи кассы: «взаиморасчёты» вместо «контрагенты», пометка, что продажи агентов в кассу не попадают | `OwnerAnalyticsContent.jsx` |
| A12: локальная дата | `Warehouse/utils/localDate.js`; `Analytics.jsx` и `AgentAnalytics.jsx` переведены на `useAnalyticsPeriod` |
| A15: фильтр агентов | `Warehouse/utils/useCompanyAgents.js` (активные + отстранённые) в `Documents.jsx`, `WarehouseKassa.jsx` |
| A16: «Выдано агентам, шт» | `OwnerAnalyticsContent.jsx`, `PartnerAnalyticsList.jsx` |
| Таблица партнёров: склад и агенты раздельно | `PartnerAnalyticsList.jsx` |

---

## 6. Сценарии для тестов (`tests_analytics.py`)

| # | Данные | Ожидание |
|---|---|---|
| 1 | Проведён `RECEIPT` на 1 000, `payment_kind=cash` | создан `MONEY_EXPENSE` 1 000; «Приход по кассе» = 0, «Расход по кассе» = 1 000 |
| 2 | `RECEIPT` без категории в документе, у компании есть «Продажа» и «Закупка» | категория денежного документа = системная «Закупка» |
| 3 | Наличная продажа 500 с контрагентом (без агента) | 500 в «Приход по кассе», 0 в «Приход от контрагентов» |
| 4 | Ручной `MONEY_RECEIPT` от контрагента 300 (без `source_document`) | 300 в «Приход от контрагентов» |
| 5 | Продажа агента 1 000 + продажа владельца 200 | `sales_amount` = 1 200, `agent_sales_amount` = 1 000, `own_sales_amount` = 200 |
| 6 | Продажа в `CASH_PENDING` 400 | входит в `sales_amount`, `pending_cash_sales_amount` = 400, в кассе 0 |
| 7 | Строка 100 × 2 со скидкой строки 10% + скидка документа 18 | `total` = 162, `Σ net_amount` = 162, «по товарам» = 162 |
| 8 | Продажа 1 000, возврат 200 (агент А, склад С, товар Т) | KPI, график, топ агентов, склад С и товар Т = 800 |
| 9 | 11 агентов | `share_percent` в сумме ≈ 100% по всем агентам; у топ-10 < 100% |
| 10 | Склад: `StockBalance` 50 шт (цена 10, закупка 6), у агента 3 шт | `warehouse_on_hand_qty` = 50, `…_amount` = 500, `…_purchase_amount` = 300, `agent_on_hand_qty` = 3 |
| 11 | Запрос аналитики → проведение продажи → повторный запрос | второй ответ содержит новую продажу (кэш сброшен) |
| 12 | Мультискладская продажа с `warehouse_from = NULL` | попадает в KPI и в «Склады» по складу строки |
| 13 | Документ с `date` = завтра + 2 дня | `400` при создании или проведении |

---

## 7. Чек-лист приёмки

**Бэкенд**
- [ ] `RECEIPT → MONEY_EXPENSE`, `WRITE_OFF → None` в `_resolve_money_doc_type`.
- [ ] Авто-категория — системная по типу документа, без «первой попавшейся».
- [ ] Классификация кассы по `source_document` (A3) во всех разрезах.
- [ ] Блок `revenue_by_payment_kind` (A4-A) или принято решение по варианту B.
- [ ] Остатки по `StockBalance` + `agent_on_hand_*` + `on_hand_purchase_amount` в складах.
- [ ] `sales_*` — все продажи (POSTED + CASH_PENDING), `agent_sales_*` и `own_sales_*` отдельно.
- [ ] `DocumentItem.net_amount` добавлено, заполняется и сделан backfill.
- [ ] Возвраты вычитаются во всех блоках.
- [ ] `share_percent` и `total_sales_amount` в топ агентов.
- [ ] Версионный сброс кэша аналитики на изменениях.
- [ ] Продажи без `warehouse_from` учитываются.
- [ ] Запрет даты документа в будущем.
- [ ] Тесты §6 зелёные.

**Данные**
- [ ] 2 ошибочных денежных документа от `RECEIPT` распроведены и отклонены; решение владельца по оплате применено.
- [ ] 44 пустых проведённых документа без `warehouse_from` разобраны.
- [ ] 7 документов с датой в будущем показаны владельцам.

**Фронт**
- [x] Локальная дата вместо UTC (9 мест + фильтры периода в «Зарплате»).
- [x] KPI и таблица «Склады» по новым полям, со старым fallback.
- [x] Доля агента из `share_percent`.
- [x] Фильтр агентов в «Документах» и «Кассе» — из списка агентов, а не из аналитики.

---

## 8. Связанные файлы

| Слой | Путь |
|---|---|
| Расчёт аналитики | `apps/warehouse/analytics.py` (бэкенд) |
| Вьюхи и параметры периода | `apps/warehouse/views_analytics.py` (бэкенд) |
| Маппинг денег и авто-категории | `apps/warehouse/services.py` — `_resolve_money_doc_type`, `_create_or_post_money_document`, `post_document` (бэкенд) |
| Денежные документы | `apps/warehouse/services_money.py` (бэкенд) |
| Кэш | `apps/main/cache_utils.py`, `core/settings.py` (`CACHE_TIMEOUT_ANALYTICS`) |
| Тесты | `apps/warehouse/tests_analytics.py` |
| Страница аналитики | `src/Components/Sectors/Warehouse/Analytics/Analytics.jsx` |
| Контент владельца | `src/Components/Sectors/Warehouse/Analytics/OwnerAnalyticsContent.jsx` |
| Аналитика агента | `src/Components/Sectors/Warehouse/Analytics/AgentAnalytics.jsx` |
| Период | `src/Components/Sectors/Warehouse/Analytics/useAnalyticsPeriod.js`, `warehouseAnalyticsShared.js` |
| Фильтр агентов | `src/Components/Sectors/Warehouse/Documents/Documents.jsx`, `src/Components/Sectors/Warehouse/Kassa/WarehouseKassa.jsx` |
| ТЗ закупочной стоимости | [analytics-warehouses-purchase-price.md](./analytics-warehouses-purchase-price.md) |

---

## 9. Порядок выката

1. **P0, бэкенд:** A1 + A2 + исправление данных A1 → A5 (после сверки остатков из
   [stock-single-source-of-truth.md](./stock-single-source-of-truth.md)).
2. **P1, бэкенд:** A3, A6, A8 (миграция `net_amount` + backfill), A9; решение по A4.
3. **Фронт:** новые поля с fallback, A12, A15.
4. **P2/P3:** A7, A10, A11, A13, A14, A16.

Все новые поля добавляются **рядом** со старыми, поэтому старый фронт не
ломается. Меняется смысл двух существующих полей (`sales_*` теперь включает
продажи без агента, `money_*` — авто-оплаты документов). Это нужно согласовать с
выкатом фронта: подписи KPI меняются в том же релизе.
