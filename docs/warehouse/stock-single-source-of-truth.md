# Склад — товары «сами увеличиваются»: единый источник остатка

**Сфера:** Склад (`warehouse`).
**Страницы:** `/crm/warehouse/stocks`, карточка/редактирование товара
(`AddWarehouseProductPage`), `/crm/warehouse/documents`, заявки и возвраты агентов.
**Фронт:** `src/Components/Sectors/Warehouse/Stocks/AddWarehouseProductPage.jsx`,
`src/Components/Sectors/Warehouse/Stocks/Stocks.jsx`.
**Бэкенд (снимок прода `/home/nur`, 03.10.2026, HEAD `ca526727`):**
`apps/warehouse/services.py`, `apps/warehouse/models.py`, `apps/warehouse/serializers.py`.
**Эндпоинты:** `PATCH /api/warehouse/products/{id}/`, `POST /api/warehouse/{warehouse_id}/products/`,
`POST /api/warehouse/documents/{id}/post/`, `…/unpost/`.
**Статус:** ❌ Баг на проде. Бэкенд — нужны правки и разовая сверка данных.
Фронт — ✅ готово (§5.6), работает и со старым бэкендом.

Сводка по всему аудиту: [audit-2026-10-stock-analytics.md](./audit-2026-10-stock-analytics.md).

---

## 1. Задача

Пользователи жалуются, что остатки товаров **растут сами по себе**: в карточке
ставят 0 (или меньшее число), а после ближайшей продажи остаток снова большой.

Нужно:

- оставить **один источник правды** для остатка;
- менять остаток **только документами** и движениями (`StockMove`);
- убрать логику «берём максимум из двух значений»;
- разово сверить расходящиеся данные на проде.

---

## 2. Как воспроизвести

| Шаг | Действие | `WarehouseProduct.quantity` (карточка) | `StockBalance.qty` (регистр) |
|---|---|---|---|
| 1 | Товар на складе | 100 | 100 |
| 2 | Продажа 10 шт (проведена) | 90 | 90 |
| 3 | В форме редактирования товара ставим количество **50** и сохраняем | **50** | 90 ← не изменился |
| 4 | Продажа 1 шт | **89** ← «вырос» с 50 | 89 |

Обратный случай: в карточке ставят **больше**, чем в регистре (100 вместо 2).
При следующем проведении регистр поднимается до 100, хотя ни одного документа
прихода не было.

---

## 3. Корневые причины

### S1. Два хранилища остатка и «храповик» `max()` — главная причина

Остаток хранится в двух местах:

- **карточка товара** `WarehouseProduct.quantity` — её показывает UI;
- **регистр** `StockBalance.qty` (склад + товар) — с ним работают документы.

При проведении документа `_apply_move` (`services.py:278-294`) сначала
«подтягивает» регистр к карточке, но **только вверх**:

```python
# services.py:284-294 (текущий код)
if move.product.warehouse_id == move.warehouse_id:
    prod_qty = product_card_qty(move.product)
    bal_qty = q_qty(Decimal(bal.qty or 0))
    if created or (bal_qty <= 0 and prod_qty > 0) or (prod_qty > bal_qty):
        bal.qty = prod_qty                      # ← регистр поднимается до карточки
bal.qty = Decimal(bal.qty or 0) + Decimal(move.qty_delta or 0)
bal.save()
if move.product.warehouse_id == move.warehouse_id:
    type(move.product).objects.filter(pk=move.product_id).update(quantity=q_qty(bal.qty))  # ← карточка перезаписывается регистром
```

Что из этого следует:

- **карточка < регистра**: карточка игнорируется, после проведения в неё пишется
  `регистр + delta`. **Ручное уменьшение отменяется**, товар «растёт».
- **карточка > регистра**: регистр поднимается до карточки, хотя документа прихода нет.

Та же логика `max()` есть в `resolve_warehouse_on_hand_qty`
(`services.py:122-151`). Её вызывают с `sync=True` и записывают максимум
обратно в регистр:

- проверка остатка при продаже, покупке и т.п. (`services.py:867-877`);
- выдача товара агенту `AgentRequestCart._transfer_items_to_agent` (`models.py:2011-2030`);
- возврат от агента `AgentReturnCart._transfer_items_from_agent_to_warehouse` (`models.py:2262-2277`).

Побочный эффект: можно **продать товар, которого по карточке нет**. Проверка
берёт максимум, то есть «невидимый» остаток регистра.

### S2. Количество в карточке можно изменить в обход документов

- `WarehouseProductSerializer` (`serializers.py:384-460`): поле `quantity` есть в
  `fields` и **не read-only**.
- `update()` (`serializers.py:562-580`) записывает `quantity` только в карточку.
  `StockBalance` не меняется, `StockMove` не создаётся, следа в истории нет.
- `create()` (`serializers.py:522-554`): если товар с таким штрихкодом на этом
  складе уже есть, он **перезаписывается целиком, включая `quantity`**. Тоже в
  обход документов.
- `instance.save()` без `update_fields` сохраняет **все** поля экземпляра,
  загруженного в начале запроса. Если между загрузкой и сохранением провели
  продажу, её списание затирается старым значением (гонка на миллисекунды).

### S3. Фронт всегда отправляет `quantity` при редактировании

`AddWarehouseProductPage.jsx`:

- [строка 421](../../src/Components/Sectors/Warehouse/Stocks/AddWarehouseProductPage.jsx#L421):
  `quantity` подставляется в форму при открытии;
- [строки 845-855](../../src/Components/Sectors/Warehouse/Stocks/AddWarehouseProductPage.jsx#L845-L855):
  `quantity` всегда попадает в payload;
- [строки 902-908](../../src/Components/Sectors/Warehouse/Stocks/AddWarehouseProductPage.jsx#L902-L908):
  в режиме редактирования отправляется `PATCH /warehouse/products/{id}/`.

Поэтому любое сохранение карточки (даже ради смены цены) переписывает количество.
Если форма была открыта долго, а товар за это время продавали, вернётся старое,
**большее** число.

### S4. Инвентаризация ставит неверный остаток

`services.py:811-844`: `delta = факт − StockBalance.qty`. Потом `_apply_move`
сначала поднимает регистр до карточки (S1) и только затем прибавляет `delta`.

> Регистр 5, карточка 10, факт 8 → `delta = +3` → регистр поднят до 10 → 10 + 3 = **13** вместо 8.

### S5. Отмена проведения агентского документа пишет остаток агента в карточку склада

`services.py:1075-1076` (ветка «личный остаток агента» в `unpost_document`):

```python
if mv.product.warehouse_id == mv.warehouse_id:
    type(mv.product).objects.filter(pk=mv.product_id).update(quantity=q_qty(bal.qty))  # bal — AgentStockBalance!
```

После распроведения в карточку склада записывается **личный остаток агента**.
При проведении (`_apply_agent_move`) карточка не трогается, то есть логика
несимметрична. На проде 5 черновиков такого типа с номером: возможно, это уже
сработало.

### S6. Движения без `StockMove` (нет истории)

Эти операции меняют `StockBalance` и карточку, но **не создают `StockMove`**:

- выдача товара агенту (`models.py:2011-2030`);
- возврат от агента на склад (`models.py:2262-2277`);
- создание и редактирование товара с `quantity` (S2).

Итог: `StockBalance ≠ Σ StockMove`. Восстановить историю остатка и найти,
откуда взялось количество, невозможно. На проде у **433 из 781** записей
регистра остаток больше суммы движений.

### S7. Разные проверки остатка в разных документах

- Продажа, покупка, списание: `max(регистр, карточка)` (`resolve_warehouse_on_hand_qty`).
- Перемещение и инвентаризация: только регистр, а при его отсутствии карточка
  (`services.py:766-788`, `814-822`).

Один и тот же товар может пройти проверку в одном типе документа и не пройти в другом.

### S8 (риск). Перемещение может склеить разные товары

`_get_or_create_transfer_product` (`services.py:678-760`) ищет товар на
складе-приёмнике по штрихкоду, коду, артикулу+названию и в конце **просто по
названию**. Разные товары с одинаковым названием склеятся, и приход уйдёт не в
тот товар.

---

## 4. Данные прода (снимок 03.10.2026)

| Показатель | Значение |
|---|---|
| Товаров, привязанных к складу | 4 825 |
| Из них **без** записи `StockBalance` (остаток только в карточке) | 4 046 |
| Карточка ≠ регистр | **32** |
| — карточка **меньше** регистра (вырастут при ближайшей продаже) | 25 товаров, **9 677 ед.** |
| — карточка **больше** регистра (регистр поднимется без документа) | 7 |
| Из 32: карточку правили **после** последнего движения | 32 из 32 |
| `StockBalance > Σ StockMove` | 433 из 781 |

Подтверждение по логам nginx: время `PATCH /api/warehouse/products/{id}/`
совпадает с `updated_date` карточки минута в минуту. Сессии редактирования
длятся 10–20 сек (GET → PATCH).

Примеры:

| Компания | Товар | Карточка | Регистр | PATCH карточки | Что будет при продаже 1 шт |
|---|---|---|---|---|---|
| ИП Акматалиева Жыргал | Нори | 0 | 6 183 | 30.09 04:51 | карточка станет **6 182** |
| ИП Акматалиева Жыргал | Майонез 10 кг Ведро | 4 | 661 | 03.10 06:26 | **660** |
| БАТКЕН ШААРЫ САЙДЫМАН | бумага сирен арзан | 0 | 830 | 19.09 | **829** |
| БАТКЕН ШААРЫ САЙДЫМАН | фариман дурож 85гр | 240 | 0 | 29.09 14:36 | регистр поднимется до 240 → **239** |
| warehouse | Новый товар 123 | 1 000 | 95 | 22.06 | регистр поднимется до 1 000 → **999** |

---

## 5. Решение

### 5.1. Принцип

1. **`StockBalance` — единственный источник правды** по остатку (склад + товар).
2. `WarehouseProduct.quantity` — **денормализованная копия** регистра для своего
   склада. Её пишет **только** сервис остатков, никогда не API и не формы.
3. Любое изменение регистра — это `StockMove` (с документом или с указанием
   источника). Инвариант: `StockBalance.qty == Σ StockMove.qty_delta`.
4. Никаких `max()`: проверка и списание идут по одному числу.

### 5.2. Единый сервис остатков (бэкенд)

Новый модуль `apps/warehouse/stock.py` (или раздел в `services.py`):

```python
def get_on_hand(*, warehouse, product, lock: bool = False) -> Decimal:
    qs = models.StockBalance.objects.filter(warehouse=warehouse, product=product)
    if lock:
        qs = qs.select_for_update()
    bal = qs.first()
    return q_qty(bal.qty) if bal else Decimal("0.000")


def apply_stock_delta(*, warehouse, product, delta: Decimal, move_kind,
                      document=None, source_kind: str, source_id=None,
                      allow_negative: bool = False) -> models.StockBalance:
    bal, _ = models.StockBalance.objects.select_for_update().get_or_create(
        warehouse=warehouse, product=product, defaults={"qty": Decimal("0.000")}
    )
    new_qty = q_qty(Decimal(bal.qty) + Decimal(delta))
    if new_qty < 0 and not allow_negative:
        raise InsufficientStock(product=product, warehouse=warehouse,
                                available=bal.qty, required=abs(delta))
    models.StockMove.objects.create(
        document=document, warehouse=warehouse, product=product,
        qty_delta=delta, move_kind=move_kind,
        source_kind=source_kind, source_id=source_id,
    )
    bal.qty = new_qty
    bal.save(update_fields=["qty"])
    if product.warehouse_id == warehouse.id:
        type(product).objects.filter(pk=product.pk).update(quantity=new_qty)
    return bal
```

Изменения в модели `StockMove`:

```python
class StockMove(models.Model):
    class SourceKind(models.TextChoices):
        DOCUMENT = "document", "Документ"
        AGENT_ISSUE = "agent_issue", "Выдача агенту"
        AGENT_RETURN = "agent_return", "Возврат от агента"
        OPENING = "opening", "Начальный остаток"
        ADJUSTMENT = "adjustment", "Корректировка"

    document = models.ForeignKey(Document, null=True, blank=True, …)   # было NOT NULL
    source_kind = models.CharField(max_length=16, choices=SourceKind.choices,
                                   default=SourceKind.DOCUMENT)
    source_id = models.UUIDField(null=True, blank=True)
```

Миграция: `document` → nullable, новые поля с default. Существующие строки
получают `source_kind="document"`.

### 5.3. Где заменить логику

| Место | Сейчас | Должно быть |
|---|---|---|
| `_apply_move` (`services.py:278-294`) | подтягивает регистр к карточке через `max` | вызывает `apply_stock_delta`, без `max` |
| `resolve_warehouse_on_hand_qty` (`services.py:122-151`) | `max(регистр, карточка)` + `sync` | **удалить**, вместо неё `get_on_hand(lock=True)` |
| Проверка остатка в `post_document` (`services.py:867-877`) | `resolve_warehouse_on_hand_qty(sync=True)` | `get_on_hand(lock=True)` |
| Перемещение (`services.py:766-788`) | регистр, иначе карточка | `get_on_hand(lock=True)` |
| Инвентаризация (`services.py:811-844`) | `delta` от регистра, потом `max` | `delta = факт − get_on_hand(lock=True)`, затем `apply_stock_delta` (S4 исправится сам) |
| `unpost_document`, склад (`services.py:1080-1099`) | правит регистр напрямую и удаляет move | `apply_stock_delta(−qty_delta, source_kind="document")` со сторнирующим движением; исходные движения **не удалять** (история) |
| `unpost_document`, агент (`services.py:1075-1076`) | пишет остаток агента в карточку | **удалить эти две строки**: агентские движения карточку склада не трогают |
| Выдача агенту (`models.py:2011-2030`) | правит регистр и карточку без движения | `apply_stock_delta(−need_qty, source_kind="agent_issue", source_id=cart.id)` |
| Возврат от агента (`models.py:2262-2277`) | `max` + правка без движения | `apply_stock_delta(+return_qty, source_kind="agent_return", source_id=cart.id)` |

> Сторно вместо удаления движений при распроведении нужно, чтобы аналитика и
> история показывали «провели → отменили». Если это слишком большое изменение
> для первой итерации, допустимо оставить удаление, но без `max()`.

### 5.4. API товара

**Обновление `PATCH/PUT /api/warehouse/products/{id}/`:**

- `quantity` становится **read-only** при обновлении.
- Переходный период (пока фронт не обновлён): если `quantity` пришло и **равно**
  текущему значению — молча игнорировать; если **отличается** — `400`:

```json
{
  "quantity": [
    "Количество меняется только документами: инвентаризация, оприходование или списание. Используйте «Корректировку остатка»."
  ]
}
```

- `instance.save(update_fields=[…только изменённые поля…])`, чтобы не затирать
  `quantity` старым значением (гонка из S2).

**Создание `POST /api/warehouse/{warehouse_id}/products/`:**

- `quantity > 0` трактуется как **начальный остаток**: в той же транзакции
  создаётся и проводится документ `INVENTORY` с комментарием «Начальный остаток
  при создании товара» (без денежного эффекта).
- Ветка «штрихкод уже существует» (`serializers.py:533-554`) **не меняет
  `quantity`** существующего товара. Если пришло `quantity > 0`, вернуть `409`
  с предложением сделать приход или корректировку.

**Новый эндпоинт: корректировка остатка**

```http
POST /api/warehouse/products/{id}/stock-adjustment/
Authorization: Bearer …
Content-Type: application/json

{
  "fact_qty": "50",
  "comment": "Пересчёт на полке"
}
```

Поведение: создаёт и проводит документ `INVENTORY` по складу товара с одной
строкой (`qty = fact_qty`).

**Ответ `201`:**

```json
{
  "document_id": "…",
  "document_number": "INVENTORY-20261003-0002",
  "qty_before": "90.000",
  "qty_after": "50.000",
  "delta": "-40.000"
}
```

| Код | Когда |
|---|---|
| `400` | `fact_qty < 0` или не число |
| `403` | нет права на документы склада |
| `404` | товар другой компании |

### 5.5. Перемещение: не склеивать товары по названию

В `_get_or_create_transfer_product` убрать последний шаг «поиск только по
`name`». Если нет совпадения по штрихкоду, коду или артикулу+названию, создавать
новый товар на складе-приёмнике.

### 5.6. Фронт

[AddWarehouseProductPage.jsx](../../src/Components/Sectors/Warehouse/Stocks/AddWarehouseProductPage.jsx):

| Режим | Сейчас | Должно быть |
|---|---|---|
| Редактирование | поле «Количество» редактируемое, `quantity` всегда в PATCH | поле **только для чтения**; `quantity` **не отправлять**; рядом кнопка **«Корректировка остатка»** (модалка: факт + комментарий → `POST …/stock-adjustment/`) |
| Создание | `quantity` уходит в POST | без изменений; подпись поля «Начальный остаток» |

После корректировки обновить карточку и список (`fetchProductsAsync`). Ошибку
`400` по `quantity` показывать как есть.

**Реализовано на фронте:**

| Что | Где |
|---|---|
| `quantity` не отправляется в PATCH при редактировании | `AddWarehouseProductPage.jsx` → `handleSubmit` (`delete payload.quantity`) |
| Поле количества: при создании «Начальный остаток *», при редактировании read-only «Остаток на складе» + кнопка «Корректировка остатка» (у услуг кнопки нет) | `AddWarehouseProductPage.jsx` → `ProductQuantityField` (обе формы) |
| Модалка: факт, комментарий, подсказка «излишек/недостача», ошибки бэкенда | `Stocks/StockAdjustmentModal.jsx` (+ тест) |
| API | `src/api/warehouse.js` → `adjustProductStock` |
| Ошибка `400 {"quantity": …}` показывается под полем | `AddWarehouseProductPage.jsx` → `catch` в `handleSubmit` |

Список остатков (`Stocks.jsx`) перезагружается при возврате со страницы товара,
отдельный `fetchProductsAsync` не нужен.

> До выката бэкенда кнопка «Корректировка остатка» вернёт `404` (текст ошибки
> покажется в модалке). PATCH без `quantity` старый бэкенд принимает.

### 5.7. Разовая сверка данных на проде

Команда `python manage.py reconcile_warehouse_stock`:

1. `--report` (по умолчанию, ничего не меняет): CSV со строками
   `company, warehouse, product, card_qty, balance_qty, moves_sum, agent_qty,
   card_updated_at, last_move_at`. Сейчас это 32 товара.
2. Для **4 046 товаров без `StockBalance`**: создать `StockBalance = card_qty` и
   движение `source_kind="opening"` (один документ `INVENTORY` «Начальные
   остатки (миграция)» на склад).
3. Для **433 записей, где регистр ≠ сумма движений**: создать движение
   `opening` на разницу, чтобы выполнялся инвариант `StockBalance == Σ StockMove`.
4. Для **32 расходящихся товаров** — **решение владельца бизнеса**: какое число
   верное (карточка или регистр). Применять **только через документ
   `INVENTORY`** (`--apply decisions.csv`), чтобы осталась история.

> ⚠️ Шаг 4 обязателен **до** выката исправлений 5.2–5.3. Иначе при удалении
> `max()` товары с карточкой больше регистра (7 шт) «потеряют» остаток, а
> товары с карточкой меньше регистра (25 шт) сохранят завышенный регистр.

### 5.8. Контроль

Ежедневная задача Celery `check_stock_consistency`. Ищет нарушения:

- карточка ≠ регистр для своего склада;
- регистр ≠ Σ движений;
- отрицательный регистр при `ALLOW_NEGATIVE_STOCK=False`.

Результат пишет в лог или админ-уведомление. Код можно взять из запросов
сверки (раздел 4).

---

## 6. Сценарии для тестов

| # | Сценарий | Ожидание |
|---|---|---|
| 1 | Товар 100, продажа 10 | карточка = регистр = 90, 1 `StockMove` −10 |
| 2 | PATCH `{"quantity": 50}` (отличается) | `400`, остаток 90 |
| 3 | PATCH `{"price": "120", "quantity": "90.000"}` (совпадает) | `200`, цена изменена, остаток 90 |
| 4 | `stock-adjustment` `fact_qty=50`, потом продажа 1 | 50 → **49** (не 89), есть документ `INVENTORY` |
| 5 | Инвентаризация: регистр 5, факт 8 | регистр = **8** |
| 6 | Продажа 10 при регистре 5, отрицательный остаток запрещён | `400` «Недостаточно…», ничего не списано |
| 7 | Выдача агенту 3 шт из 10 | регистр 7, `StockMove` −3 `agent_issue`, `AgentStockBalance` +3 |
| 8 | Возврат от агента 2 шт | регистр 9, `StockMove` +2 `agent_return` |
| 9 | Провести и распровести агентский документ (личный остаток) | карточка склада **не меняется** |
| 10 | Создание товара с `quantity=20` | регистр 20, документ `INVENTORY` «Начальный остаток» |
| 11 | POST товара с существующим штрихкодом и `quantity=5` | `quantity` старого товара не изменился (`409` или игнор) |
| 12 | Перемещение товара «Чай» на склад, где есть другой «Чай» без штрихкода/кода | создаётся новый товар, существующий не трогается |
| 13 | Для любого товара после сценариев 1–12 | `StockBalance.qty == Σ StockMove.qty_delta`, карточка == регистр |

---

## 7. Чек-лист приёмки

**Бэкенд**
- [ ] `resolve_warehouse_on_hand_qty` удалена; в `_apply_move` и проверках нет `max()` между карточкой и регистром.
- [ ] Все изменения `StockBalance` идут через `apply_stock_delta` и создают `StockMove`.
- [ ] `StockMove.document` nullable, добавлены `source_kind`/`source_id`, миграция применена.
- [ ] Выдача и возврат агента создают `StockMove`.
- [ ] Распроведение агентского документа не трогает `WarehouseProduct.quantity`.
- [ ] Инвентаризация даёт ровно факт (сценарий 5).
- [ ] `PATCH` товара с отличающимся `quantity` → `400`, с совпадающим → игнор.
- [ ] `serializer.update` сохраняет только изменённые поля.
- [ ] `POST …/stock-adjustment/` работает по контракту §5.4.
- [ ] Создание товара с `quantity > 0` создаёт документ начального остатка; upsert по штрихкоду не меняет `quantity`.
- [ ] Перемещение не ищет товар по одному названию.
- [ ] Тесты из §6 есть в `tests_stock_consistency.py`.

**Данные**
- [ ] `reconcile_warehouse_stock --report` выгружен и передан владельцам компаний.
- [ ] Решения по 32 товарам применены документами `INVENTORY`.
- [ ] Для товаров без `StockBalance` созданы начальные остатки.
- [ ] Повторный `--report` показывает 0 расхождений.
- [ ] Задача `check_stock_consistency` включена.

**Фронт**
- [x] В режиме редактирования количество read-only и не уходит в PATCH.
- [x] Кнопка «Корректировка остатка» вызывает новый эндпоинт и обновляет данные.

---

## 8. Связанные файлы

| Слой | Путь |
|---|---|
| Проведение и распроведение, `_apply_move`, проверки | `apps/warehouse/services.py` (бэкенд) |
| Выдача и возврат агента | `apps/warehouse/models.py` — `AgentRequestCart`, `AgentReturnCart` |
| Сериализатор товара | `apps/warehouse/serializers.py` — `WarehouseProductSerializer` |
| Существующие тесты консистентности | `apps/warehouse/tests_stock_consistency.py` |
| Форма товара | `src/Components/Sectors/Warehouse/Stocks/AddWarehouseProductPage.jsx` |
| Список остатков | `src/Components/Sectors/Warehouse/Stocks/Stocks.jsx` |
| API товара (фронт) | `src/api/warehouse.js` — `updateProductByUuid`, `createProductInWarehouse` |

---

## 9. Порядок выката и совместимость

1. **Данные:** `reconcile_warehouse_stock --report` → решения владельцев →
   применение (§5.7). Делать до изменения логики.
2. **Бэкенд:** миграция `StockMove` → сервис остатков → замена мест из §5.3 →
   read-only `quantity` в переходном режиме (совпадает — игнор, отличается — `400`).
3. **Фронт:** убрать `quantity` из PATCH, добавить «Корректировку остатка».
4. Включить `check_stock_consistency`.

Старый фронт после шага 2 продолжит работать: он шлёт то же `quantity`, что
загрузил, поэтому получит игнор. Если между открытием формы и сохранением была
продажа, вернётся `400`, и это правильное поведение.
