# Склад: что должен проверить бэкенд

**Дата:** 2026-08-08  
**Аудитория:** backend  
**Контекст:** на prod два **разных** бага — не смешивать.  
**Детали:**  
- Баг A (подтверждён): [`agent-me-products-multi-warehouse.md`](./agent-me-products-multi-warehouse.md) — в т.ч. кейс SALE-20260808-0132  
- Баг B (отдельный, P0): [`sale-request-stock-without-post.md`](./sale-request-stock-without-post.md) — списание при «не проведённой» заявке на продажу  

Ниже — обязательные проверки. Отметить после прогона на staging.

---

## Блок 0. SALE: списание без успешного проведения (отдельный баг B)

**Не** объяснять кейсом SALE-20260808-0132 (там было 400 + выдача agent-cart).

Симптом: жмут `post` по «Заявке на продажу» / SALE → документ для пользователя не провелся, qty уже ушёл.

- [ ] Зафиксировать контракт: cash `post` → `CASH_PENDING` + списание qty **или** списание только на `cash/approve` (сейчас фронт ждёт списание на `post`).
- [ ] Атомарность: любой 4xx/5xx на `post` → `status=DRAFT`, qty без изменений, без частичных moves.
- [ ] Запрещённое состояние: `status=DRAFT` + уже списанный qty / moves по этому `document_id`.
- [ ] `cash/reject` и `unpost` откатывают qty.
- [ ] Прогнать T1–T6 из `sale-request-stock-without-post.md` §4.

---

## Блок 1. `GET /warehouse/agents/me/products/` (подтверждённый баг A)

### Проблема

После `approve`/`dispatch` товар есть в `owner/agents/products/`, но **нет** в `agents/me/products/` (отдаются остатки только с одного «домашнего» склада).

### Prod-якоря

| | UUID |
|---|---|
| Агент | `9161463e-a70b-43e4-99ec-304d11a391f4` (12321 JAY) |
| Товар | `514ba1ef-46b4-4f50-a716-afc5d25adc4e` (КОКАКОЛА 1Л) |
| Склад выдачи (B) | `8f5d5f2c-6de6-4e2b-9747-273bc5aa3a19` (new склад) |
| Склад, который видит me (A) | `4cf95f0e-e72e-4621-8c4c-e5c88bafb09e` |
| Cart | `03e4e0b5-caff-44a3-a303-0452af3759bd` (`approved`) |

### Что сделать

- [ ] Найти queryset `me/products`: убрать фильтр по `assigned_warehouse` / одному `common_warehouse`.
- [ ] По умолчанию отдавать **все** строки agent stock текущего user.
- [ ] Опционально поддержать `?warehouse=<uuid>`.
- [ ] Не путать с `agents/my/products` (общий прайс по `common_warehouses`).

### Приёмка

- [ ] Токен агента: `GET /warehouse/agents/me/products/` содержит КОКАКОЛА + `warehouse=8f5d5f2c-…` с тем же `qty`, что owner-list.
- [ ] В одном ответе есть позиции и склада A, и склада B.
- [ ] `?warehouse=8f5d5f2c-…` — только склад B.
- [ ] `count`/`pagination` учитывают все склады.
- [ ] `POST /warehouse/documents/{id}/post/` для SALE с агентом без регрессии.

---

## Блок 2. Атомарность `POST /warehouse/documents/{id}/post/`

### Проблема (нужно исключить)

Жалоба: «документ не провелся, а qty уже списан». На кейсе `1aa15e3c-…` при 400 документ остался `DRAFT` — списание шло от agent-cart. Нужно **доказать**, что при ошибке `post` склад/agent stock не трогается.

### Тест 2.1 — отказ из‑за нехватки

1. SALE + `agent`, qty больше, чем у агента.
2. Зафиксировать qty агента и склада.
3. `POST …/post/` → ожидать **4xx**.

- [ ] `GET document` → `status=DRAFT`
- [ ] `moves` пустые (или без новых)
- [ ] qty агента и склада **не изменились**

### Тест 2.2 — ошибка в середине (несколько позиций)

1. Документ с 2+ позициями; на последней заведомо нехватка (или throw после списания первой).
2. `POST …/post/` → 4xx.

- [ ] Полный rollback всех позиций
- [ ] Нет частичных движений
- [ ] `status=DRAFT`

### Тест 2.3 — обрыв после write (если можно симулировать)

- [ ] Транзакция: stock + status + moves в одной atomic-блоке; при exception — rollback всего.

---

## Блок 3. Контракт `CASH_PENDING` (cash SALE)

Фронт ожидает: при `payment_kind=cash` остаток списывается на **`post`**, статус становится **`CASH_PENDING`**, не `POSTED`. Финал — `cash/approve`; откат — `cash/reject` или `unpost`.

### Тест 3.1 — post cash

1. SALE, `payment_kind=cash`, достаточный остаток.
2. Зафиксировать qty.
3. `POST …/post/` → 200.

- [ ] `status == CASH_PENDING` (не POSTED)
- [ ] qty **уже уменьшен**
- [ ] документ в cash inbox (`GET /warehouse/cash/requests/` или аналог)

### Тест 3.2 — cash approve

- [ ] `POST …/cash/approve/` → `status=POSTED`
- [ ] qty **не** списывается повторно
- [ ] при необходимости создаётся money-документ

### Тест 3.3 — cash reject / unpost

- [ ] `POST …/cash/reject/` → `REJECTED`, qty **откатан**
- [ ] `POST …/unpost/` из `CASH_PENDING` → `DRAFT`, qty **откатан**

### Зафиксировать в API-доке бэка

- [ ] Явно описать: списание на `post` → `CASH_PENDING`, не на `cash/approve`.

---

## Блок 4. SALE с агентом vs выдача agent-cart (не смешивать)

Две разные операции:

| Операция | Эндпоинт | Эффект |
|---|---|---|
| Выдача / одобрение заявки | `agent-carts/{id}/approve\|dispatch` | склад ↓, agent stock ↑ |
| Проведение продажи | `documents/{id}/post` | agent stock ↓ (если есть `agent`) |

### Проверить

- [ ] При `approve`/`dispatch` типы движений / audit отличаются от движений `documents.post`.
- [ ] Неуспешный `post` **никогда** не вызывает логику approve cart.
- [ ] SALE с `agent`: `post` проверяет и списывает **agent stock**, не «общий» qty склада (кроме отдельно задокументированных режимов).

### Матрица (прогнать и отметить)

| Шаг | Ожидаемый status | Ожидаемый qty |
|---|---|---|
| Черновик SALE | DRAFT | без изменений |
| `post` 400 (мало у агента) | DRAFT | без изменений |
| `approve`/`dispatch` cart | — | склад ↓, агент ↑ |
| `post` 200, cash | CASH_PENDING | агент ↓ |
| `cash/approve` | POSTED | без повторного списания |
| `cash/reject` или `unpost` | REJECTED / DRAFT | откат |

- [ ] Все строки матрицы выполняются на staging.

---

## Блок 5. `is_sale_request` / «Заявка на продажу»

### Проверить

- [ ] `is_sale_request` — флаг документа, **не** отдельный status в БД.
- [ ] После `post` в ответе `status` = `CASH_PENDING` или `POSTED` / `REJECTED`, а не «залипший» draft-only лейбл.
- [ ] `create-sale` из agent-cart создаёт SALE с корректным `agent`, складом, позициями; `post` ведёт себя как у обычного SALE с агентом.

(UI-лейбл «Заявка на продажу» на фронте строится только при `DRAFT` + `is_sale_request`.)

---

## Блок 6. Быстрые curl-шаги (под Bearer агента / владельца)

```http
GET  /api/warehouse/agents/me/products/
GET  /api/warehouse/owner/agents/{agent_id}/products/
GET  /api/warehouse/owner/agents/products/

GET  /api/warehouse/agent-carts/{cart_id}/
POST /api/warehouse/agent-carts/{cart_id}/approve/
POST /api/warehouse/agent-carts/{cart_id}/dispatch/

GET  /api/warehouse/documents/{doc_id}/
POST /api/warehouse/documents/{doc_id}/post/
POST /api/warehouse/documents/{doc_id}/unpost/
POST /api/warehouse/documents/{doc_id}/cash/approve/
POST /api/warehouse/documents/{doc_id}/cash/reject/

GET  /api/warehouse/products/{product_id}/
GET  /api/warehouse/cash/requests/
```

После каждого мутирующего вызова — сразу `GET` документа + qty (owner products / product detail) и сравнение с таблицей блока 4.

---

## Приоритеты

| P | Блок | Почему |
|---|---|---|
| **P0** | 0 — списание без проведения (баг B) | Отдельный репорт; не закрывать кейсом 0132 |
| **P0** | 1 — `me/products` (баг A) | Подтверждён на prod |
| **P0** | 2 — атомарность `post` | Часть проверки бага B |
| **P1** | 3 — контракт CASH_PENDING | Может маскироваться под баг B |
| **P1** | 4 — разделение cart vs sale | Чтобы не путать с багом A/0132 |
| **P2** | 5 — `is_sale_request` | Согласованность статусов с фронтом |

---

## Результат прогона (заполнить бэком)

| Блок | Staging | Prod / комментарий | Кто | Дата |
|---|---|---|---|---|
| 0 списание без post (баг B) | ☐ pass / ☐ fail | | | |
| 1 me/products (баг A) | ☐ | | | |
| 2.1 post 400 | ☐ | | | |
| 2.2 partial rollback | ☐ | | | |
| 3.1–3.3 cash | ☐ | | | |
| 4 матрица | ☐ | | | |
| 5 is_sale_request | ☐ | | | |
