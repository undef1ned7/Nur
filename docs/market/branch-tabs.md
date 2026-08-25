# Маркет — вкладки филиала: контракт для бэкенда

**Страница:** `/crm/branch/:id` (фронт: `BranchDetails.jsx`)  
**Секторы:** `Магазин`, `Цветочный магазин`  
**Дата:** 25 августа 2026  
**Статус фронта:** реализовано — карточка филиала запрашивает данные с `?branch=<uuid>`

---

## 1. Зачем

На карточке филиала для маркета показываются **все операционные вкладки сферы**:

| Вкладка (UI) | Источник | Endpoint (FE сейчас) |
|---|---|---|
| Касса | BASE | `GET /construction/cashflows/?branch=` |
| Склад | BASE | `GET /main/products/list/?branch=` |
| Продажи | BASE | `GET /main/pos/sales/?branch=` |
| Аналитика | BASE | локальная агрегация загруженных данных |
| Сотрудники | BASE | `GET /users/employees/?branch=` |
| Клиенты | BASE | `GET /main/clients/?branch=` |
| История продаж | marketMenu | `GET /main/pos/sales/?branch=` |
| Аналитика маркета | marketMenu | `GET /main/pos/sales/?branch=` *(временный срез; нужен analytics)* |
| Смены | marketMenu | `GET /construction/shifts/?branch=` |
| Закупки | marketMenu | `GET /main/suppliers/receipts/?branch=` |
| Поставщики | marketMenu | `GET /main/clients/?branch=&type=suppliers` |
| Документы | marketMenu | `GET /main/pos/sales/?branch=` |
| Кассир | extra | `GET /construction/cashboxes/?branch=` |
| Категории | extra | `GET /main/categories/?branch=` |

Устаревший `/crm/market/bar` **не показывается**.

---

## 2. Общий контракт параметра `branch`

Для всех list-эндпоинтов ниже:

| Параметр | Тип | Обязательный | Описание |
|---|---|---|---|
| `branch` | uuid | да (на карточке филиала) | UUID филиала из `/users/branches/` |

### Правила авторизации

1. **owner / admin** — могут передать любой `branch` своей компании; без параметра — поведение «все филиалы / как сейчас».
2. **Сотрудник с `branch_ids`** — если передан чужой `branch` → `403` или пустой список (предпочтительно `403` с `detail`).
3. Записи **без филиала** (`branch=null`, «глобальные») на карточке конкретного филиала **не включать**, если отдельно не запрошен `include_global=1` (как в analytics).

### Пагинация

Фронт тянет все страницы через `next` (`fetchAllPages`). Ответ — DRF-пагинация `{ count, next, previous, results }` или голый массив. Оба варианта поддерживаются.

### Поле филиала в объектах

Желательно единообразно отдавать одно из:

- `branch` (uuid), или
- `branch_id` (uuid)

Фронт дополнительно фильтрует на клиенте, если поле присутствует; если поля нет ни у одного элемента — считает, что бэкенд уже отфильтровал.

---

## 3. Требования по эндпоинтам

### 3.1. Продажи / история / документы

`GET /main/pos/sales/?branch=<uuid>`

Используется вкладками: **Продажи**, **История продаж**, **Документы**, временно **Аналитика маркета**.

**Нужно:**

- фильтр по филиалу продажи / кассы / смены (что является источником истины на BE);
- в объекте: `id`, `created_at` / `paid_at`, `total` / `amount`, `status`, `client` или `client_name`, желательно `branch`.

Документы на отдельной странице маркета — те же sales (чеки/накладные). Отдельный documents-list не обязателен, если sales уже scoped.

### 3.2. Аналитика маркета (целевое поведение)

Сейчас FE на вкладке «Аналитика маркета» грузит sales-list как упрощённый срез.

**Целевой контракт** (уже описан в [analytics.md](./analytics.md)):

```
GET /main/analytics/market/?tab=sales&branch=<uuid>&period_start=...&period_end=...
```

Дополнительно:

| Параметр | Описание |
|---|---|
| `branch` | обязателен на карточке филиала |
| `include_global` | `"1"` — опционально подмешать записи без филиала |

После поддержки на BE фронт сможет заменить sales-list на cards/charts этой вкладки.

### 3.3. Смены

`GET /construction/shifts/?branch=<uuid>`

**Нужно:**

- смены, открытые на кассах данного филиала;
- поля: `opened_at`, `closed_at`, `status`, `cashier_name` / `cashier`, `cashbox_name` / `cashbox`, `branch`.

### 3.4. Закупки (приходы поставщиков)

`GET /main/suppliers/receipts/?branch=<uuid>`

**Нужно:**

- приходы, оформленные в контексте филиала (склад/касса/сотрудник филиала);
- поля: `date` / `created_at`, `supplier_name` / `supplier`, `total_amount` / `total`, `status`, `branch`.

### 3.5. Поставщики

`GET /main/clients/?type=suppliers&branch=<uuid>`

**Нужно:**

- либо поставщики, привязанные к филиалу;
- либо поставщики, по которым были приходы/закупки этого филиала (зафиксировать один вариант в API);
- поля: `full_name` / `name`, `phone`, `email`, `status` / `is_active`, опционально `branch`.

Если поставщики всегда company-wide — вернуть полный список при любом `branch` и задокументировать это (FE уже готов показать список).

### 3.6. Кассы POS (вкладка «Кассир»)

`GET /construction/cashboxes/?branch=<uuid>`

**Нужно:**

- кассы, принадлежащие филиалу;
- поля: `name`, `balance` / `current_balance`, `currency`, `is_active`, `branch`.

Критично для checkout: без кассы филиала POS не должен работать (см. [MARKET_BUGS_FIX_TZ.md](./MARKET_BUGS_FIX_TZ.md)).

### 3.7. Категории

`GET /main/categories/?branch=<uuid>`

**Варианты (выбрать один и зафиксировать):**

1. Категории company-wide → игнор `branch`, полный список.
2. Категории с привязкой к филиалу → фильтр по `branch`.

FE показывает `name`, `description`, `is_active`.

### 3.8. Товары / склад

`GET /main/products/list/?branch=<uuid>` — уже используется на базовой вкладке «Склад».

Ожидание: остатки и ассортимент **этого** филиала (не чужого). Товары `other_branch` не отдавать (см. [bulk_update_products.md](./bulk_update_products.md)).

### 3.9. ДДС / касса

`GET /construction/cashflows/?branch=<uuid>` — базовая вкладка «Касса».

Только движения по кассам филиала.

### 3.10. Сотрудники / клиенты

- `GET /users/employees/?branch=<uuid>` — сотрудники с `branches` содержащим uuid.
- `GET /main/clients/?branch=<uuid>` — клиенты филиала (или клиенты с продажами филиала).

---

## 4. Матрица готовности (чеклист для BE)

| Endpoint | `branch` фильтр | Поле `branch` в item | Приоритет |
|---|---|---|---|
| `/main/pos/sales/` | ☐ | ☐ | P0 |
| `/construction/shifts/` | ☐ | ☐ | P0 |
| `/construction/cashboxes/` | ☐ | ☐ | P0 |
| `/main/products/list/` | ☐ | ☐ | P0 |
| `/construction/cashflows/` | ☐ | ☐ | P0 |
| `/main/suppliers/receipts/` | ☐ | ☐ | P1 |
| `/main/clients/?type=suppliers` | ☐ | ☐ | P1 |
| `/main/clients/` | ☐ | ☐ | P1 |
| `/users/employees/` | ☐ | ☐ | P1 |
| `/main/categories/` | ☐ | ☐ | P2 |
| `/main/analytics/market/` | ☐ (уже в analytics.md) | — | P1 |

---

## 5. Ошибки

| Код | Когда |
|---|---|
| `400` | `branch` не uuid |
| `403` | филиал чужой компании / нет доступа |
| `404` | филиал не найден |

Тело: `{ "detail": "..." }` или полевая ошибка `{ "branch": ["..."] }`.

---

## 6. Тест-план (BE)

1. Owner открывает `/crm/branch/{A}` → каждый list с `branch=A` возвращает только данные A.
2. Owner открывает филиал B → данные A не протекают.
3. Кассир филиала A с `branch_ids=[A]` запрашивает `branch=B` → 403.
4. Касса: у филиала без cashbox список касс пуст; checkout с этой локации падает с понятной ошибкой.
5. Смены: смена на кассе филиала A видна только при `branch=A`.
6. Приход поставщика на склад A не виден при `branch=B`.
7. `include_global` на analytics не ломает карточку филиала (карточка **не** шлёт `include_global` по умолчанию).

---

## 7. Связанные файлы фронта

- `src/Components/pages/Branch/branchTabsConfig.js` — правила табов + `SECTOR_EXTRA_TABS`
- `src/Components/pages/Branch/BranchDetails.jsx` — загрузка с `branch`
- `src/Components/Sidebar/config/sectors/marketMenu.js` — секторное меню маркета
- `docs/market/analytics.md` — полный контракт аналитики
- `docs/market/MARKET_BUGS_FIX_TZ.md` — касса/филиал в POS
