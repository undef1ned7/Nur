# Склад — что не доделано на бэкенде (сводка на 05.10.2026)

**Сфера:** Склад (`warehouse`).
**Для кого:** бэкенд.
**Проверено:** 05.10.2026, прод `/home/nur`, рабочая копия поверх HEAD `ca526727` (01.10.2026).
Код читался, данные — только `SELECT` в read-only транзакции, логи nginx. На проде ничего не менялось,
тесты бэка не запускались.
**Источники:** все ТЗ из `docs/warehouse/`. Этот документ их **не заменяет**: контракты, модели и
тест-сценарии — в исходных ТЗ (ссылки в каждом пункте). Здесь — только то, что **не сделано**,
и доказательства.

Сводка аудита: [audit-2026-10-stock-analytics.md](./audit-2026-10-stock-analytics.md).

---

## 1. Сводная таблица

| ID | Что | Приоритет | Тип | Исходное ТЗ |
|---|---|---|---|---|
| R1 | Правки бэка не закоммичены, но уже работают на проде | 🔴 P0 | процесс | — |
| R2 | `DELETE` удаляет **проведённые** документы, движения стираются, остатки не откатываются | 🔴 P0 | код | [documents-delete-draft.md](./documents-delete-draft.md) |
| R3 | Создание товара теряет начальное количество | 🔴 P0 | код (регрессия) | [stock-single-source-of-truth.md](./stock-single-source-of-truth.md) §5.4 |
| R4 | В `_apply_move` осталась склейка карточки и регистра (`max()`) | 🔴 P0 | код | [stock-single-source-of-truth.md](./stock-single-source-of-truth.md) S1, S4 |
| R5 | Нет `POST /products/{id}/stock-adjustment/` — кнопка на фронте получает 404 | 🔴 P0 | код | [stock-single-source-of-truth.md](./stock-single-source-of-truth.md) §5.4 |
| R6 | 46 фиктивных приходов в кассу от `RECEIPT` на 30,7 млн не исправлены | 🔴 P0 | данные | [analytics-calculation-fixes.md](./analytics-calculation-fixes.md) A1 |
| R7 | Партнёрство: любой сотрудник забирает товар и деньги партнёра без согласия | 🔴 P0 | код | [stock-partnership.md](./stock-partnership.md) этапы 1–2 |
| R8 | Распроведение агентского документа пишет остаток агента в карточку склада | 🟠 P1 | код | stock-single-source S5 |
| R9 | Движения без `StockMove` (выдача/возврат агента, создание товара); нет команд сверки | 🟠 P1 | код | stock-single-source S6, §5.7–5.8 |
| R10 | 31 товар «карточка ≠ регистр», 4 374 товара без `StockBalance` | 🟠 P1 | данные | stock-single-source §5.7 |
| R11 | Перемещение склеивает разные товары по одному названию | 🟠 P1 | код | stock-single-source S8, stock-partnership §7.12 |
| R12 | `agents/me/products` при общем доступе отдаёт общий склад вместо личного остатка | 🟠 P1 | код | [agent-me-products-multi-warehouse.md](./agent-me-products-multi-warehouse.md) |
| R13 | «Не найдена касса» при проведении: строгий поиск по филиалу, 3 склада без кассы | 🟠 P1 | код + данные | — (новое) |
| R14 | Нет блока «Движение товара»; `writeoff_loss_amount` всегда `0.00` | 🟠 P1 | код | [analytics-coverage.md](./analytics-coverage.md) C2 |
| R15 | Себестоимость по текущей закупочной цене, нет `DocumentItem.cost_price`, `cost_is_estimated` всегда `False` | 🟠 P1 | код | analytics-coverage C5 |
| R16 | Выплата ЗП не проходит через кассу | 🟠 P1 | код | [salary.md](./salary.md), analytics-coverage C4 |
| R17 | Проведённый денежный документ от `WRITE_OFF` | 🟡 P2 | данные | analytics-calculation-fixes A1, решение D4 |
| R18 | Партнёрство этап 3 и история продаж партнёра | 🟡 P2 | код | stock-partnership §7.5–7.7, §7.13–7.16 |
| R19 | `PATCH` товара с другим `quantity` молча игнорируется вместо `400` | 🟡 P2 | код | stock-single-source §5.4 |
| R20 | `Document.company` (правильное решение A13) | 🟡 P2 | код | analytics-calculation-fixes A13 |
| R21 | Не подтверждено: S7, A3, C3, upsert по штрихкоду | 🟡 P2 | проверка | stock-single-source, analytics-* |
| R22 | Тест-сценарии из ТЗ не прогнаны на staging | 🟡 P2 | проверка | все ТЗ |

---

## 2. P0 — сделать первым

### R1. Правки бэка не закоммичены

**Сейчас:** `git status` в `/home/nur`:

```
 M apps/warehouse/analytics.py               (+~750 / −300)
 M apps/warehouse/models.py
 M apps/warehouse/serializers.py
 M apps/warehouse/serializers_documents.py
 M apps/warehouse/services.py
 M apps/warehouse/signals.py
 M apps/warehouse/tests_analytics.py
 M apps/warehouse/tests_documents.py
 M apps/warehouse/tests_stock_consistency.py
?? apps/warehouse/analytics_cache.py
?? apps/warehouse/management/commands/cleanup_empty_posted_documents.py
?? apps/warehouse/management/commands/fix_receipt_money_documents.py
?? apps/warehouse/management/commands/report_future_dated_documents.py
```

`gunicorn.service` перезапущен 05.10.2026 12:27 UTC — этот код уже обслуживает пользователей.
Любой `git checkout` / `git reset` / деплой из репозитория откатит исправления A1, A2, A8, A11, A14
и всю новую аналитику.

**Сделать:** закоммитить в ветку, прогнать тесты, слить в основную. Дальше — только через деплой.

**Приёмка:** `git status apps/warehouse` чистый, коммит в удалённом репозитории.

---

### R2. `DELETE` удаляет проведённые документы

**Где:** `apps/warehouse/views_documents.py:255` — `DocumentDetailView(RetrieveUpdateDestroyAPIView)`
без переопределения `destroy` / `perform_destroy`. У модели `Document` нет своего `delete()`,
сигналов `pre_delete` нет. `StockMove.document` — `on_delete=CASCADE`.

**Сейчас:** `DELETE /api/warehouse/documents/{id}/` для документа в любом статусе:

- удаляет документ и **каскадом его `StockMove`**;
- `StockBalance` и `WarehouseProduct.quantity` **не откатываются** — товар остаётся списанным
  (или оприходованным), а истории движения больше нет;
- не-владелец удаляет свои документы (`qs.filter(agent=user)`), в том числе проведённые.

В логах nginx: `DELETE /api/warehouse/documents/{uuid}/ → 204` один раз, 03.10.2026 10:12.
Был ли документ проведённым — по логу не определить.

Фронт показывает кнопку удаления только для `DRAFT`, но API ничем не защищён.

**Сделать** (контракт — [documents-delete-draft.md](./documents-delete-draft.md)):

```python
def perform_destroy(self, instance):
    if instance.status != models.Document.Status.DRAFT:
        raise DRFValidationError({"detail": "Удалить можно только черновик. Сначала отмените проведение."})
    if instance.moves.exists() or instance.agent_moves.exists():
        raise DRFValidationError({"detail": "У документа есть движения — удаление запрещено."})
    if getattr(instance, "money_document", None) is not None:
        raise DRFValidationError({"detail": "У документа есть денежный документ — удаление запрещено."})
    # заявка агента (is_sale_request / cart.sale_document) — 400 по ТЗ
    instance.delete()
```

Дополнительно: `StockMove.document` → `on_delete=PROTECT`, чтобы движения нельзя было стереть
никаким путём (админка, shell).

**Приёмка:** чек-лист [documents-delete-draft.md](./documents-delete-draft.md); `DELETE` проведённого →
`400`, движения и остатки не изменились.

---

### R3. Создание товара теряет начальное количество (регрессия)

**Где:** `apps/warehouse/serializers.py`, `WarehouseProductSerializer`:
`read_only_fields = [..., "quantity"]` и `validated_data.pop("quantity", None)` в **`create()`**
и `update()`.

**Сейчас:** фронт при создании товара отправляет количество из формы
(`src/Components/Sectors/Warehouse/Stocks/AddWarehouseProductPage.jsx:899`, `quantity: quantityValue`).
Бэк его отбрасывает: товар создаётся с `quantity = 0`, без `StockBalance` и без документа.
Пользователь вводит «10», а на складе 0. Для `update()` поведение правильное, для `create()` — нет.

С момента перезапуска (05.10 12:27 UTC) товаров не создавали, поэтому на данных регрессии ещё нет.

**Сделать** ([stock-single-source-of-truth.md](./stock-single-source-of-truth.md) §5.4):

- в `create()` принимать `quantity` (write-only на создание);
- если `quantity > 0` — создать и провести документ начального остатка (`INVENTORY` или `RECEIPT`
  с `payment_kind=external`, комментарий «Начальный остаток при создании товара») через общий
  сервис проведения, чтобы появились `StockMove` и `StockBalance`;
- ветка «товар с таким штрихкодом уже есть» (upsert) **не меняет** остаток.

**Приёмка:** создание товара с `quantity=10` → в карточке 10, `StockBalance.qty = 10`, есть
проведённый документ и `StockMove(+10)`; повторный POST с тем же штрихкодом остаток не меняет.

---

### R4. Склейка карточки и регистра в `_apply_move`

**Где:** `apps/warehouse/services.py`, `_apply_move`:

```python
if move.product.warehouse_id == move.warehouse_id:
    prod_qty = product_card_qty(move.product)
    bal_qty = q_qty(Decimal(bal.qty or 0))
    if created or (bal_qty <= 0 and prod_qty > 0) or (prod_qty > bal_qty):
        bal.qty = prod_qty          # ← это и есть max(карточка, регистр)
bal.qty = Decimal(bal.qty or 0) + Decimal(move.qty_delta or 0)
```

`resolve_warehouse_on_hand_qty` исправлена (регистр — источник правды), но при **применении**
движения регистр по-прежнему поднимается до карточки. Последствия:

- остаток «растёт сам», если карточка когда-либо оказалась больше регистра (S1);
- инвентаризация при `карточка > регистр` ставит `карточка + (факт − регистр)` вместо факта (S4);
- на проде таких товаров **31** (R10).

**Сделать** (§5.2 исходного ТЗ): регистр меняется только на `qty_delta`; карточка — копия регистра
после изменения. Если `StockBalance` нет — создать его из карточки **один раз** миграцией данных
(R10), а не в `_apply_move`. Лучше всего — общий сервис `apply_stock_delta(...)` для всех изменений
остатка.

**Приёмка:** сценарии 1–5 из §6 исходного ТЗ; инвентаризация товара с `карточка=100, регистр=90,
факт=95` даёт ровно 95.

---

### R5. Нет эндпоинта корректировки остатка

**Где:** в `urls.py` / `views*.py` нет `stock-adjustment`.

**Сейчас:** фронт уже вызывает `POST /api/warehouse/products/{id}/stock-adjustment/`
(`src/api/warehouse.js:1114`, `Stocks/StockAdjustmentModal.jsx`) — кнопка «Корректировка остатка»
в карточке товара получает 404. Количество в карточке на фронте read-only, поэтому **другого способа
поправить остаток, кроме документа инвентаризации, у пользователя нет**.

**Сделать:** контракт §5.4 [stock-single-source-of-truth.md](./stock-single-source-of-truth.md)
(`{fact_qty, comment}` → проведённый `INVENTORY` на одну позицию, ответ с новым остатком).

**Приёмка:** фронтовая модалка корректирует остаток; появляется документ `INVENTORY` и `StockMove`.

---

### R6. Фиктивные приходы в кассу от `RECEIPT` (данные)

**Сейчас:** код исправлен (`RECEIPT → MONEY_EXPENSE`), новых ошибочных документов после
перезапуска нет. Но старые не тронуты:

| Компания | Проведённых `MONEY_RECEIPT` от `RECEIPT` | Сумма, сом | Период |
|---|---|---|---|
| ИП Акматалиева Жыргал | 24 | 25 438 398,50 | 21.07–01.10.2026 |
| Алтын Балык | 10 | 5 230 500,00 | 10.06–26.06.2026 |
| `warehouse` (тестовая) | 12 | 37 820,78 | 07.04–29.06.2026 |
| **Итого** | **46** | **30 706 719,28** | |

Ещё 1 такой документ в `DRAFT` (1 550,02). Эти суммы сидят в остатках касс и в кассовой
аналитике как приход денег. В аудите было «2 документа / 6,53 млн» — тогда считалось только за 30 дней.

**Сделать:** команда уже написана (`fix_receipt_money_documents`, по умолчанию dry-run).

```bash
python manage.py fix_receipt_money_documents                     # отчёт
# решение владельца по каждой компании (D2):
python manage.py fix_receipt_money_documents --regenerate-expense <document_uuid> --apply   # платили из кассы
python manage.py fix_receipt_money_documents --mark-external <document_uuid> --apply        # не из кассы
python manage.py fix_receipt_money_documents --company <uuid> --apply                       # остальное → REJECTED
```

**Блокер:** решение D2 (оплачивались ли эти приходы из кассы) — от владельцев трёх компаний.

**Приёмка:** `SELECT` из §5 этого документа возвращает 0 проведённых `MONEY_RECEIPT` от `RECEIPT`;
сальдо касс сверено с владельцами.

---

### R7. Партнёрство: права и согласие

**Сейчас:** `views_partnership.py` не менялся с 09.09.2026. Ничего из
[stock-partnership.md](./stock-partnership.md) не сделано. На проде 2 активных партнёрства,
3 висячих черновика межкомпанейских перемещений.

**Сделать (P0 из ТЗ):** этап 1 — `user_can_manage_partnership` во всех эндпоинтах (§7),
транзакция в `transfer/` (П5), блокировка касс в инкассации (П6), `created_by` / `initiator_company`
у `Document` (§6.4), ограничение распроведения (§7.11), запрет удаления партнёрств в админке.
Этап 2 — согласие партнёра (§6.1–6.3, §7.2–7.4, §7.8–7.10).

**Приёмка:** §11 исходного ТЗ, сценарии T1–T21.

---

## 3. P1

### R8. Распроведение агентского документа пишет в карточку склада (S5)

**Где:** `services.py`, `unpost_document`, ветка `agent_personal_stock`: после отката
`AgentStockBalance` выполняется
`type(mv.product).objects.filter(pk=mv.product_id).update(quantity=q_qty(bal.qty))` —
в карточку **склада** записывается остаток **агента**.

**Сделать:** в агентской ветке карточку не трогать (§3 S5 исходного ТЗ).

**Приёмка:** распроведение агентской продажи не меняет `WarehouseProduct.quantity`.

### R9. Движения без истории, нет команд сверки (S6, §5.7–5.8)

**Сейчас:** `StockMove.document` — обязательный FK, полей `source_kind` / `source_id` нет.
Выдача и возврат агента, создание товара меняют остатки без `StockMove`. В
`management/commands/` нет `reconcile_warehouse_stock` и `check_stock_consistency`.

**Сделать:** миграция `StockMove` (`document` nullable, `source_kind`, `source_id`), выдача/возврат
агента через общий сервис, команда `reconcile_warehouse_stock --report`, периодическая задача
`check_stock_consistency` (§5.7–5.8 исходного ТЗ).

**Приёмка:** чек-лист §7 исходного ТЗ (бэкенд и данные).

### R10. Расхождения остатков (данные)

| Показатель | 03.10 (аудит) | 05.10 |
|---|---|---|
| Товаров «карточка ≠ регистр» | 32 | **31** |
| Товаров на складе без `StockBalance` | 4 046 | **4 374** |

Число товаров без регистра растёт: товары создавались без `StockBalance` (до 05.10 — с количеством
только в карточке, после 05.10 из-за R3 — без количества вообще).

**Сделать:** после R4 и R9 — `reconcile_warehouse_stock --report`, решения владельцев (D1),
применение документами `INVENTORY`; начальные `StockBalance` для товаров без регистра.

**Приёмка:** повторный отчёт — 0 расхождений; товаров без `StockBalance` — 0.

### R11. Перемещение склеивает товары по названию (S8)

**Где:** `services.py`, `post_document` → `_get_or_create_transfer_product`: последний шаг
`qs.filter(name=source.name).first()`.

**Сделать:** убрать поиск по одному названию (и для внутренних, и для межкомпанейских перемещений):
штрихкод → код → артикул+название → новая карточка.

**Приёмка:** T20 [stock-partnership.md](./stock-partnership.md), сценарий S8 исходного ТЗ.

### R12. `agents/me/products` при общем доступе

**Где:** `views.py:1763`, `AgentMyProductsListAPIView`. Докстринг: «при включённом общем доступе —
остатки общего склада, иначе — персональные остатки».

**Сейчас:** личный остаток (`AgentStockBalance`) отдаётся со всех складов, `?warehouse=` работает —
это исправлено. Но если у агента включён `common_access_enabled`, эндпоинт отдаёт **общий склад**,
и выданный агенту товар он не видит.

**Сделать:** по [agent-me-products-multi-warehouse.md](./agent-me-products-multi-warehouse.md) §4.1
`me/products` всегда отдаёт личный остаток; общий прайс — отдельный эндпоинт (`agents/my/products`
или параметр `?source=common`, согласовать с фронтом).

**Приёмка:** §5 исходного ТЗ для агента с включённым общим доступом.

### R13. «Не найдена касса» при проведении

**Где:** `services.py:534` (`_create_or_post_money_document`) и `:1007` (предоплата).
Касса без `cash_register` в документе ищется так:

```python
qs = CashRegister.objects.filter(company=company)
qs = qs.filter(branch=branch) if branch is not None else qs.filter(branch__isnull=True)
```

`branch` — филиал **склада** документа. Если у склада филиал есть, кассы без филиала не подходят;
если у склада филиала нет, не подходят кассы филиалов. При отсутствии `payment_kind` бэк считает
его `cash` (`effective_payment_kind`, default `"cash"`).

**Сейчас на проде:** 3 склада без подходящей кассы — «Эламан Кара суу» (нет касс; черновик закупки
на 13 360 сом не проводится 05.10), ОсОО «Бостон Пласт» (нет касс), тестовая `warehouse`
(касса без филиала, склад в филиале). Фронт `cash_register` в документе не передаёт (на проде 0
документов с ним), а касса на фронте ограничена одной на компанию
(`Kassa/WarehouseKassa.jsx`, «Разрешена только одна касса») — компания с филиалами не может
завести кассу на филиал.

**Сделать (решение бэка + продукта):**

1. Фолбэк: если в филиале склада кассы нет — касса компании без филиала (если она одна).
2. Понятная ошибка с кодом:
   `400 {"detail": "В компании (филиале «…») нет кассы. Создайте кассу или выберите оплату «В долг» / «Вне кассы».", "code": "cash_register_not_found"}` —
   фронт по `code` покажет кнопку «Создать кассу».
3. Разрешить одну кассу **на филиал** (снять ограничение «одна на компанию» на фронте и проверить,
   что бэк не ограничивает).
4. `GET /warehouse/cash-registers/?for_warehouse=<uuid>` — чтобы фронт мог заранее предупредить.

**Приёмка:** проведение наличного документа на складе филиала без своей кассы проходит через кассу
компании; при отсутствии касс — понятная ошибка с `code`.

### R14. Блок «Движение товара» (C2)

**Где:** `analytics.py`, `build_owner_warehouse_analytics_payload` — `"writeoff_loss_amount": "0.00"`
константой; блока по `StockMove` (списания, инвентаризация, перемещения) нет.

**Сделать:** §4.2 [analytics-coverage.md](./analytics-coverage.md); `writeoff_loss_amount` =
Σ себестоимости списаний за период (решение D4 — списание это убыток, не деньги).

### R15. Себестоимость (C5)

**Где:** `analytics.py:475` `_lines_by_product_with_cost` — `cogs = qty × product__purchase_price`
(текущая цена товара); в ответе `"cost_is_estimated": False` константой. Поля `DocumentItem.cost_price`
нет.

**Сейчас:** изменение закупочной цены задним числом меняет прибыль за прошлые периоды, а флаг
говорит, что себестоимость точная.

**Сделать:** `DocumentItem.cost_price` (заполняется при проведении из закупочной цены на момент
продажи) + backfill; `cost_is_estimated = true`, пока в периоде есть строки без `cost_price`
(§4.5 analytics-coverage).

### R16. Выплата ЗП через кассу (C4, D6)

**Где:** `salary_services.py:213` `create_payout(*, company, agent, amount, comment, created_by)` —
параметра кассы нет, `MONEY_EXPENSE` не создаётся.

**Сейчас:** на весь прод 1 выплата на 100 сом; начислено за месяц ~758 тыс. (аудит). Фронт уже
даёт выбрать кассу при выплате.

**Сделать:** необязательный `cash_register` в `POST /salary/payouts/`; если передан — проведённый
`MONEY_EXPENSE` с системной категорией «Зарплата» (§4.4 analytics-coverage, §4.6 salary.md).

---

## 4. P2

### R17. Денежный документ от `WRITE_OFF` (данные)

1 проведённый денежный документ от списания (по старому маппингу). По D4 — распровести и
отклонить, сверить кассу.

### R18. Партнёрство этап 3 и история продаж

[stock-partnership.md](./stock-partnership.md): поиск компаний (§7.5), лёгкий каталог (§7.6–7.7),
кассы партнёров в общем списке (§7.14), аналитика с `partner_branches` (§7.13), история продаж
(§7.15–7.16, этап 3б), встречные заявки (П10). Фронт готов и ждёт эндпоинты.

### R19. `PATCH quantity` → `400`

Сейчас `update()` молча выбрасывает `quantity`. По ТЗ: отличающееся значение → `400` с подсказкой
про корректировку, совпадающее — игнор. Новый фронт `quantity` не шлёт; ошибка нужна для старых
клиентов и интеграций, которые иначе «тихо» не меняют остаток.

### R20. `Document.company` (A13)

Аналитика учитывает продажи без `warehouse_from` через `warehouse_from__isnull` (сделано), на проде
таких проведённых продаж 44 (со строками). Правильное решение — поле `Document.company` с backfill;
понадобится и для истории продаж партнёра (§7.15 stock-partnership).

### R21. Не подтверждено проверкой

- **S7** — единые проверки остатка во всех типах документов.
- **A3** — классификация кассы по `source_document` во всех разрезах (в коде есть, не проверялось
  на данных).
- **C3** — возвраты от агентов в блоке «Агенты» (упоминания в `analytics.py` есть).
- **Upsert по штрихкоду** не меняет остаток (S2).

Нужна проверка тестами (R22).

### R22. Тест-сценарии из ТЗ

Тестов добавлено: `tests_analytics.py` (36), `tests_stock_consistency.py` (9). Не покрыты и не
прогонялись на staging:

- stock-single-source §6 (сценарии 1–8);
- analytics-calculation-fixes §6, analytics-coverage §7;
- stock-partnership §9 (T1–T30);
- sale-request-stock-without-post §4 (T1–T6), backend-checklist блоки 0–5 (отметить «Результат прогона»).

---

## 5. Запросы для проверки (read-only)

```sql
-- R6: фиктивные приходы от RECEIPT
SELECT m.status, count(*), sum(m.amount)
FROM warehouse_moneydocument m JOIN warehouse_document d ON d.id = m.source_document_id
WHERE d.doc_type = 'RECEIPT' AND m.doc_type = 'MONEY_RECEIPT' GROUP BY m.status;

-- R17: деньги от WRITE_OFF
SELECT m.status, count(*) FROM warehouse_moneydocument m
JOIN warehouse_document d ON d.id = m.source_document_id
WHERE d.doc_type = 'WRITE_OFF' GROUP BY m.status;

-- R10: карточка ≠ регистр
SELECT count(*) FROM warehouse_warehouseproduct p
JOIN warehouse_stockbalance b ON b.product_id = p.id AND b.warehouse_id = p.warehouse_id
WHERE round(coalesce(p.quantity,0),3) <> round(coalesce(b.qty,0),3);

-- R10: товары без регистра
SELECT count(*) FROM warehouse_warehouseproduct p
WHERE p.warehouse_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM warehouse_stockbalance b WHERE b.product_id = p.id AND b.warehouse_id = p.warehouse_id);

-- R13: склады без подходящей кассы
SELECT co.name, w.name FROM warehouse_warehouse w JOIN users_company co ON co.id = w.company_id
WHERE NOT EXISTS (SELECT 1 FROM warehouse_cashregister cr WHERE cr.company_id = w.company_id
  AND ((w.branch_id IS NULL AND cr.branch_id IS NULL) OR cr.branch_id = w.branch_id));

-- R7: висячие межкомпанейские черновики
SELECT count(*) FROM warehouse_document d
JOIN warehouse_warehouse wf ON wf.id = d.warehouse_from_id JOIN warehouse_warehouse wt ON wt.id = d.warehouse_to_id
WHERE d.doc_type = 'TRANSFER' AND wf.company_id <> wt.company_id AND d.status = 'DRAFT'
  AND NOT EXISTS (SELECT 1 FROM warehouse_stockmove m WHERE m.document_id = d.id);
```

Значения на 05.10.2026: R6 — 46 POSTED / 30 706 719,28 + 1 DRAFT; R17 — 1 POSTED; R10 — 31 и 4 374;
R13 — 3; R7 — 3.

---

## 6. Решения, без которых нельзя закончить

| # | Вопрос | Блокирует | Кто решает |
|---|---|---|---|
| D1 | Какое значение остатка верное для 31 товара | R10 | владельцы компаний (по отчёту `reconcile`) |
| D2 | Оплачивались ли из кассы 46 приходов товара (3 компании) | R6 | владельцы ИП Акматалиева, «Алтын Балык» |
| D4 | Списание — денежный расход или только убыток | R14, R17 | продукт (рекомендация: только убыток) |
| D6 | Выплата ЗП через кассу обязательна или по выбору | R16 | продукт (рекомендация: по выбору) |
| D7 | Распроведение: удалять движения или сторнировать | R4, R9 | бэк + продукт (рекомендация: сторно) |
| D12 | Касса для склада филиала без своей кассы: брать кассу компании или ошибка | R13 | продукт (рекомендация: фолбэк на кассу компании) |
| D13 | `me/products` при общем доступе: отдельный эндпоинт или параметр | R12 | бэк + фронт |

Решения по партнёрству (D1–D11 в [stock-partnership.md](./stock-partnership.md) §5) приняты
на стороне фронта; бэку — подтвердить или оспорить до начала R7.

---

## 7. Что уже сделано (не переделывать)

| ТЗ / пункт | Что работает на проде |
|---|---|
| A1 (код) | `RECEIPT → MONEY_EXPENSE`, `WRITE_OFF` без денег |
| A2 | Системные категории платежей по типу документа (`purchase`, `sale_return`, `purchase_return` …) |
| A4–A7, A9, A10 | `revenue_by_payment_kind`, остатки по `StockBalance` + `agent_on_hand_*`, `own_sales_*` / `agent_sales_*`, `pending_cash_sales_*`, возвраты, `share_percent` / `total_sales_amount` |
| A8 | `DocumentItem.net_amount` (миграция 0046), пересчёт при проведении, backfill (44 866 из 44 910 строк) |
| A11 | Версионный сброс кэша аналитики (`analytics_cache.py` + сигналы) |
| A13 (минимум) | Продажи без `warehouse_from` учитываются в аналитике |
| A14 | Запрет даты в будущем при сохранении и проведении; документов с будущей датой 0 |
| C1, C4 (аналитика), C5 (частично) | Блоки «Закупки», «Зарплата», «Прибыль» в аналитике владельца |
| S1 (частично), S3 | `resolve_warehouse_on_hand_qty` без `max()`; `quantity` не меняется через `PATCH` |
| analytics-warehouses-purchase-price | `on_hand_purchase_amount` по складам |
| documents-date-filter | `date_from` / `date_to` по `date` |
| cash-confirmation-toggle | Настройка, по умолчанию выключено |
| counterparties-turnover-balance-sheet | Свёрнутое сальдо на начало и конец |
| agent-common-warehouses, agent-sell-without-approval | Несколько складов общего доступа; автоодобрение на `submit` |
| summary-agents-warehouses, summary-products-aggregation | `all_warehouses` / `warehouses`; группировка по названию + единице + цене |
| sale-request-stock-without-post | `post_document` в транзакции с блокировкой строки и защитой от дубля |

---

## 8. Порядок работ

| Этап | Пункты | Зачем в таком порядке |
|---|---|---|
| 0 (сразу) | R1, R2, R3 | Защитить уже сделанное и закрыть потерю данных |
| 1 | R4, R5, R8, R11 | Остатки перестают «расти сами», пользователь может корректировать остаток |
| 2 | R9, затем R10 (данные), R6 и R17 (данные, после D2/D4) | Сверка имеет смысл только после того, как код перестал портить остатки |
| 3 | R7 (этапы 1–2 партнёрства), R12, R13 | Права и согласие у партнёров, агентские остатки, кассы |
| 4 | R14, R15, R16, R20 | Полнота и точность аналитики |
| 5 | R18, R19, R21, R22 | Партнёрство этап 3, история продаж, проверки |

---

## 9. Чек-лист закрытия

- [ ] R1 — правки закоммичены, `git status` чистый.
- [ ] R2 — `DELETE` не-черновика → `400`; `StockMove.document` — `PROTECT`.
- [ ] R3 — создание товара с количеством создаёт документ начального остатка.
- [ ] R4 — в `_apply_move` нет подъёма регистра до карточки; инвентаризация даёт факт.
- [ ] R5 — `stock-adjustment` работает с фронтовой модалкой.
- [ ] R6 — 0 проведённых `MONEY_RECEIPT` от `RECEIPT`; кассы сверены.
- [ ] R7 — §11 stock-partnership (этапы 1–2).
- [ ] R8 — распроведение агентского документа не трогает карточку склада.
- [ ] R9 — `StockMove` у всех изменений остатка; команды сверки есть, задача включена.
- [ ] R10 — 0 расхождений, 0 товаров без `StockBalance`.
- [ ] R11 — перемещение не склеивает товары по названию.
- [ ] R12 — `me/products` всегда личный остаток.
- [ ] R13 — касса находится для склада филиала; понятная ошибка с `code`.
- [ ] R14 — блок «Движение товара», `writeoff_loss_amount` считается.
- [ ] R15 — `DocumentItem.cost_price` + backfill; `cost_is_estimated` честный.
- [ ] R16 — выплата ЗП с кассой создаёт `MONEY_EXPENSE`.
- [ ] R17 — денежный документ от `WRITE_OFF` распроведён.
- [ ] R18 — эндпоинты этапа 3 и истории продаж.
- [ ] R19 — `PATCH` с другим `quantity` → `400`.
- [ ] R20 — `Document.company` с backfill.
- [ ] R21–R22 — тест-сценарии из ТЗ зелёные на staging, результат записан в backend-checklist.
