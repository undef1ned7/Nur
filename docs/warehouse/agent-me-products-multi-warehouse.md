# Склад: `agents/me/products` не отдаёт остатки со всех складов

**Статус:** баг на бэке, воспроизведён на prod (`app.nurcrm.kg`), 2026-08-08.  
**Сектор:** Склад (`/crm/warehouse`).  
**Приоритет:** высокий — агент не видит выданный товар в UI, каталог продажи и экран остатков вводят в заблуждение; `post` SALE при этом может работать.

---

## 1. Симптом

1. Агент (или владелец через «Выдать») оформляет заявку `agent-cart` на товар со склада **B**.
2. Владелец одобряет (`approve`) или выдаёт (`dispatch`) → статус `approved`, со склада B списывается qty.
3. У владельца в `GET /api/warehouse/owner/agents/products/` остаток агента **есть** (корректный `warehouse`, `product`, `qty`).
4. У агента в `GET /api/warehouse/agents/me/products/` этой позиции **нет**. В ответе только остатки со склада **A** (старый / «домашний»).
5. Проведение документа SALE с этим агентом (`POST .../documents/{id}/post/`) **успешно списывает** с agent stock — то есть запись в БД есть, ломается именно **листинг** `me/products`.

Итог для пользователя: «товар выдали, на складе убавилось, у владельца видно, у агента — пусто».

---

## 2. Воспроизведение (prod, 2026-08-08)

### Участники

| Роль | id / display |
|---|---|
| Агент | `9161463e-a70b-43e4-99ec-304d11a391f4` — **12321 JAY** |
| Товар | `514ba1ef-46b4-4f50-a716-afc5d25adc4e` — **КОКАКОЛА 1Л**, артикул `312312` |
| Склад заявки (B) | `8f5d5f2c-6de6-4e2b-9747-273bc5aa3a19` — **new склад** |
| Склад, который видит `me/products` (A) | `4cf95f0e-e72e-4621-8c4c-e5c88bafb09e` |

### Шаги

1. На складе **new склад** у товара было `quantity ≈ 300`.
2. Создана и одобрена заявка:

```http
GET /api/warehouse/agent-carts/03e4e0b5-caff-44a3-a303-0452af3759bd/
```

```json
{
  "id": "03e4e0b5-caff-44a3-a303-0452af3759bd",
  "agent": "9161463e-a70b-43e4-99ec-304d11a391f4",
  "agent_display": "12321 JAY",
  "warehouse": "8f5d5f2c-6de6-4e2b-9747-273bc5aa3a19",
  "status": "approved",
  "approved_at": "2026-08-08T17:23:37.637251+06:00",
  "auto_approved": false,
  "items": [
    {
      "product": "514ba1ef-46b4-4f50-a716-afc5d25adc4e",
      "product_name": "КОКАКОЛА 1Л",
      "product_article": "312312",
      "quantity_requested": "50.000",
      "qty": "50.000"
    }
  ]
}
```

Дополнительно была выдача (`dispatch`) тем же товаром/складом. Итого со склада ушло **~100** (300 → 200).

3. Владелец видит остаток агента:

```http
GET /api/warehouse/owner/agents/products/
```

Фрагмент ответа (агент 12321 JAY):

```json
{
  "id": "35cef9fe-97fe-497e-8534-cdba94c12c2e",
  "agent": "9161463e-a70b-43e4-99ec-304d11a391f4",
  "agent_display": "12321 JAY",
  "warehouse": "8f5d5f2c-6de6-4e2b-9747-273bc5aa3a19",
  "product": "514ba1ef-46b4-4f50-a716-afc5d25adc4e",
  "product_name": "КОКАКОЛА 1Л",
  "product_article": "312312",
  "qty": "101.000",
  "qty_available": "101.000"
}
```

У того же агента на том же складе B в owner-листе есть и другие позиции (`312ё1` qty 10, «Чистящий крем» qty 1) — их тоже **нет** в `me/products`.

4. Агент запрашивает свои остатки:

```http
GET /api/warehouse/agents/me/products/?page=1
```

- `count: 38`, `next: null`
- **Все** `results[].warehouse === "4cf95f0e-e72e-4621-8c4c-e5c88bafb09e"`
- Product `514ba1ef-…` (КОКАКОЛА) в списке **отсутствует**
- Позиций со склада `8f5d5f2c-…` **ноль**

5. Документ SALE с этим агентом и товаром (qty 10, `warehouse_from` = new склад) после появления остатка в owner-листе успешно провелся:

```http
POST /api/warehouse/documents/{id}/post/
→ 200 / документ проведён
```

До выдачи тот же `post` отвечал:

```json
{
  "detail": "Недостаточно у агента для товара '312312'. Доступно: 1.000, требуется: 10.000"
}
```

То есть проверка на `post` и owner-листинг смотрят в **одну** таблицу agent stock; `me/products` — в ту же таблицу, но с **лишним/неверным фильтром по складу**.

---

## 3. Диагноз

| Операция | Поведение | Вердикт |
|---|---|---|
| `approve` / `dispatch` | Списание со склада + запись agent stock | OK |
| `GET owner/agents/products/` | Видит остаток по складу B | OK |
| `POST documents/{id}/post/` (SALE + agent) | Списывает с agent stock | OK |
| `GET agents/me/products/` | Отдаёт только остатки склада A | **BUG** |

Наиболее вероятная причина: queryset `me/products` фильтруется по:

- `assigned_warehouse` членства, **или**
- одному legacy `common_warehouse`, **или**
- «текущему / первому» складу компании,

вместо «все строки agent stock текущего пользователя».

Это расходится с контрактом multi-warehouse из
[`agent-common-warehouses.md`](./agent-common-warehouses.md): агент может получать товар и продавать с **нескольких** складов; остатки должны быть видны по всем складам-источникам.

---

## 4. Что нужно исправить

### 4.1. `GET /api/warehouse/agents/me/products/`

**Ожидаемое поведение**

- Возвращать **все** остатки текущего пользователя-агента (все строки agent stock, где `agent = request.user`), **без** отсечения по одному «домашнему» складу.
- В каждой строке обязательно поле `warehouse` (uuid склада-источника) — как уже есть в owner-ответе и в текущей схеме `me/products`.
- Опциональные query-фильтры (если есть / нужны):
  - `?warehouse=<uuid>` — сузить до одного склада;
  - `?product=<uuid>`, поиск, пагинация — без изменения семантики «по умолчанию = все склады».
- Не фильтровать по `assigned_warehouse` / `common_warehouse` / `common_warehouses` для **личного остатка агента**.  
  `common_warehouses` влияет на доступ к **общему прайсу склада** (`agents/my/products` / аналог), а не на то, видит ли агент уже выданный ему товар.

**Не путать эндпоинты**

| Эндпоинт | Назначение |
|---|---|
| `GET /warehouse/agents/me/products/` | Личный остаток агента (после approve/dispatch) |
| `GET /warehouse/agents/my/products/` (см. common-warehouses) | Каталог общего прайса по `common_warehouses` |
| `GET /warehouse/owner/agents/products/` | То же agent stock, вид владельца по всем агентам |
| `GET /warehouse/owner/agents/{agent_id}/products/` | Agent stock одного агента для владельца |

`me/products` и owner-list должны показывать **один и тот же набор строк** для данного агента (с точностью до полей `agent` / `agent_display`, которые в `me` можно не дублировать).

### 4.2. Регрессии, которые стоит проверить заодно

1. **Пагинация** — при остатках на 2+ складах `count` должен включать все склады, не только A.
2. **Продажа из UI агента** — каталог SALE для агента строится с `me/products`; пока баг жив, агент не может выбрать выданный со склада B товар в UI, хотя `post` чужого/старого черновика проходит.
3. **Возвраты** (`agent-return-carts`) — убедиться, что агент видит для возврата позиции со всех складов, с которых у него есть qty.
4. Если где-то есть кэш / materialised view для `me/products` — инвалидировать при `approve` / `dispatch` / `post` SALE / approve return.

### 4.3. Что менять не нужно

- Логику `approve` / `dispatch` / `post` SALE — в инциденте они отработали верно (склад 300→200, owner qty 101, post успешен).
- Контракт `common_warehouses` / `can_sell_without_approval` — отдельная тема; этот баг про личный agent stock.

---

## 5. Критерии приёмки

- [ ] После `approve`/`dispatch` заявки со склада B позиция появляется в `GET /warehouse/agents/me/products/` у этого агента с тем же `warehouse`, `product`, `qty`, что в `owner/agents/products/`.
- [ ] В `me/products` без фильтра одновременно видны остатки со склада A и склада B (если оба есть у агента).
- [ ] `?warehouse=<B>` возвращает только остатки склада B; без параметра — все.
- [ ] Повтор сценария из §2: КОКАКОЛА на `new склад` видна агенту `12321 JAY` без повторной выдачи (данные уже в БД — достаточно починить queryset).
- [ ] `POST .../documents/{id}/post/` для SALE с агентом по-прежнему списывает с того же agent stock (регрессии нет).
- [ ] Owner-эндпоинты без изменений по смыслу.

---

## 6. Связанные доки

- [`agent-sell-without-approval.md`](./agent-sell-without-approval.md) — контракт: approve зачисляет на agent stock.
- [`agent-common-warehouses.md`](./agent-common-warehouses.md) — несколько складов общего доступа; `me/products` не должен ограничиваться одним складом членства.

---

## 7. Краткий баг-тикет (для копирования)

**Title:** `GET /warehouse/agents/me/products/` не возвращает agent stock со всех складов  

**Body:**  
После `approve`/`dispatch` agent-cart со склада B товар списывается со склада и появляется в `GET /warehouse/owner/agents/products/`, но отсутствует в `GET /warehouse/agents/me/products/` (там только склад A). `POST /warehouse/documents/{id}/post/` для SALE с агентом при этом корректно списывает остаток. Нужно убрать фильтр queryset `me/products` по одному складу (`assigned_warehouse` / legacy `common_warehouse`) и отдавать все строки agent stock текущего пользователя; опционально фильтр `?warehouse=`. Воспроизведение и UUID — в `docs/warehouse/agent-me-products-multi-warehouse.md`.
