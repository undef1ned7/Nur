# Кафе: расходы, аналитика, отказы, услуги, разделение чеков, смена, зарплата

Документ описывает доработки backend кафе (приложение `apps/cafe`), **без** онлайн-заказа для гостей.

Базовый префикс API: **`/api/cafe/`** (см. `core/urls.py`).


## 2. Модели (кратко)

### Заказ `Order`

| Поле | Назначение |
|------|------------|
| `table_session_id` (UUID, nullable) | Общая «сессия стола» для **нескольких чеков** на один стол |
| `check_label` (str) | Подпись чека (например «Гость 1») |
| `cash_shift` (FK → `construction.CashShift`, nullable) | Привязка оплаты к **кассовой смене** для отчёта по смене |

Сумма заказа пересчитывается с учётом только строк **без отказа** (`recalc_total`).

### Позиция заказа `OrderItem`

| Поле | Назначение |
|------|------------|
| `line_kind` | `menu` — блюдо, `service` — услуга |
| `menu_item` | Для `menu` обязателен; для `service` — пусто |
| `service_title`, `unit_price` | Для услуги: название и цена за единицу |
| `quantity` | Количество |
| `is_rejected` | Отказ гостя |
| `rejection_reason` | Причина (обязательна при `is_rejected=true`) |
| `rejected_at` | Время отказа (проставляется при установке отказа через API) |

Ограничение: уникальность пары `(order, menu_item)` только если `menu_item` задан (частичный unique в БД).

### Архив `OrderItemHistory`

Добавлены: `line_kind`, `is_rejected`, `rejection_reason` (снапшот при архивации).

### `CafeExpense`

Операционные расходы кафе (не путать с закупками `Purchase`): `company`, `branch`, `title`, `amount`, `category`, `expense_date`, `note`, `created_by`, `created_at`.

### `CafeWaiterPayProfile`

Настройки расчёта зарплаты: `company`, `branch` (nullable), `user`, `monthly_base_salary`, `revenue_percent` (0–100).  
Уникальность: для филиала — одна запись на `(company, branch, user)`; для глобального режима филиала — на `(company, user)` при `branch IS NULL`.

---

## 3. Поведение

- **Аналитика выручки по позициям** строится по **`order.paid_at`**, только **`order.is_paid=true`**, строки с **`is_rejected=false`**. Сумма строки: `quantity * Coalesce(unit_price, menu_item.price)`.
- **Списание ингредиентов** при оплате — только неотклонённые позиции меню (не услуги).
- **Кухня:** для `service` задачи `KitchenTask` не создаются; при отказе по меню активные задачи по позиции переводятся в `cancelled` (логика в сигнале `post_save` на `OrderItem`).
- **Оплата:** в JSON-ответе чекаута добавлены `payment_method_label` (человекочитаемо) и `cash_shift_id`.
- **Редактирование позиций заказа:** менять позиции можно только у **открытого и неоплаченного** заказа. Для закрытых/оплаченных заказов изменение строк через API запрещено.
- **Standalone `order-items` API:** поддерживает поле `order`, то есть позиции можно создавать и изменять не только вложенно через `OrderSerializer`, но и напрямую через `/api/cafe/order-items/`.
- **Архив заказа:** при изменениях позиций у неоткрытого заказа архивный снапшот синхронизируется заново.

---

## 4. API: расходы и зарплатные профили

| Метод | Путь | Описание |
|--------|------|----------|
| GET, POST | `/api/cafe/expenses/` | Список / создание расхода |
| GET, PATCH, DELETE | `/api/cafe/expenses/<uuid>/` | Одна запись |
| GET, POST | `/api/cafe/waiter-pay-profiles/` | Профили официантов |
| GET, PATCH, DELETE | `/api/cafe/waiter-pay-profiles/<uuid>/` | Один профиль |

Фильтрация и филиал — как у остальных cafe-эндпоинтов (`CompanyBranchQuerysetMixin`, при необходимости `?branch=`).

---

## 5. API: заказы и позиции

- **Несколько чеков на стол:** при создании/редактировании заказа передавайте один и тот же **`table_session_id`** (UUID) и при желании разные **`check_label`**. Список заказов: **`?table_session_id=<uuid>`**.
- **Услуга:** в `items` у заказа или через `POST /api/cafe/order-items/`:
  - `line_kind`: `"service"`
  - `service_title`, `unit_price`, `quantity`
- **Позиция напрямую:** `POST /api/cafe/order-items/` требует поле `order`.
- **Отказ:** `PATCH /api/cafe/order-items/<uuid>/` с `is_rejected: true` и **`rejection_reason`** (непустая строка). Сумма заказа пересчитывается; уведомление через существующий WebSocket-поток заказов.
- **Услуга:** для `line_kind=service` нельзя передавать `menu_item`; для `line_kind=menu` наоборот нужен `menu_item`.

---

## 6. API: оплата и смена

**POST** `/api/cafe/orders/<uuid>/pay/` — в теле опционально:

```json
"cash_shift_id": "<uuid смены из construction>"
```

**POST** `/api/cafe/orders/<uuid>/pay-debt/` — то же поле `cash_shift_id` (если у заказа ещё не была привязана смена).

Смена по-прежнему **открывается и закрывается** через API **`/api/construction/`** (`CashShift`). Кафе только сохраняет ссылку на смену у заказа для отчёта.

---

## 7. API: аналитика

Общие параметры периода там, где указано: **`date_from`**, **`date_to`** (даты `YYYY-MM-DD`).

| Путь | Назначение |
|------|------------|
| `GET .../analytics/sales/summary/` | Заказы/позиции/выручка по **оплате** (`paid_at`) |
| `GET .../analytics/sales/items/` | Топ блюд (только `line_kind=menu`) |
| `GET .../analytics/sales/categories/` | По категориям меню |
| `GET .../analytics/sales/kitchens/` | По кухням (`MenuItem.kitchen`) |
| `GET .../analytics/revenue-inflow/` | Итоги по `payment_method` (наличные / перевод / карта / прочее) за период по `paid_at` |
| `GET .../analytics/rejections/` | Отказы: группировка по `rejection_reason`, `rejected_at` |
| `GET .../analytics/expenses/summary/` | Сводка по `CafeExpense` за период |
| `GET .../analytics/debts/` | Открытые долги (не оплаченные, не отменённые, `balance_due > 0`) |
| `GET .../analytics/waiter-sales/` | Выручка по официантам (заказы оплачены, `paid_at`), плюс `waiter_label` |
| `GET .../analytics/waiter-salary/?date_from=&date_to=` | Оклад × (дни/30) + % от личной выручки за период (нужны профили в `waiter-pay-profiles`); в ответе есть `waiter_label` и `profile_scope` |
| `GET .../analytics/shift-report/?shift=<uuid>` | Сводка по заказам кафе с этим `cash_shift_id` |
| `GET .../analytics/daily-close/?date=YYYY-MM-DD` | Дневной отчёт по оплаченным заказам за календарную дату (`paid_at`) |
| `GET .../analytics/unified/?tab=...` | Один entrypoint; см. таблицу ниже |

### Параметр `tab` для `analytics/unified/`

`revenue`, `dishes`, `kitchens`, `waiters`, `sales_summary`, `categories`, `purchases`, `expenses`, `debts`, `rejections`, `salary`, `daily_close`, `shift` — проксируют соответствующие представления (те же query-параметры, что и у прямых URL).

---

## 8. Экспорт

**GET** `/api/cafe/analytics/export/?report=analytics|cash&format=excel|word&date_from=&date_to=`

Для `report=analytics` в сводку добавлены: **`basis: paid_at`**, **`cafe_expenses_count`**, **`cafe_expenses_sum`**, топ блюд считается по оплаченным заказам без отказов.

---

## 9. Админка Django

Зарегистрированы: `CafeExpense`, `CafeWaiterPayProfile` (`apps/cafe/admin.py`).

---

## 10. Файлы кода (ориентир)

- Модели и сигналы: `apps/cafe/models.py`
- Сериализаторы: `apps/cafe/serializers.py`
- Представления (заказы, расходы, профили, фильтры): `apps/cafe/views.py`
- Аналитика: `apps/cafe/analytics.py`
- Маршруты: `apps/cafe/urls.py`

---

## 11. Ограничения и заметки

- **Скидки** и **долг** — существующая логика `discount_amount`, `payment_method=debt`, `pay-debt` не менялась по смыслу.
- **Зарплата:** формула в отчёте — `monthly_base_salary * (дней в периоде / 30) + waiter_revenue * revenue_percent / 100`; при необходимости скорректируйте делитель или логику под свои правила.
- **Профили зарплаты официантов:** если у сотрудника есть и глобальный, и филиальный профиль, для аналитики филиала используется **филиальный профиль**, а глобальный считается fallback.
- **Runtime-проверка проекта полностью не выполнялась**, потому что в текущем окружении отсутствуют как минимум `celery` и `python-dotenv`; синтаксис Python-файлов и IDE-диагностика по изменённым файлам проверены успешно.
- Онлайн-меню и заказ гостя с сайта **в объём работ не входили**.
