# Услуги (barber / services / dentistry) — Аналитика: единый dashboard API

**Страница:** `/crm/services/cash-reports` (и аналоги для barber/dentistry по сектору)  
**Фронт:** `src/Components/Sectors/Barber/BarberAnalitika/BarberAnalitika.jsx`  
**Хук данных:** `src/Components/Sectors/Barber/BarberAnalitika/BarberAnalitikaData.js`  
**API-клиент:** `src/api/barberAnalytics.js`  
**Маппер ответа:** `src/Components/Sectors/Barber/BarberAnalitika/mapDashboardResponse.js`

---

## 1. Задача

Раньше страница «Аналитика» при открытии делала **десятки–сотни HTTP-запросов**:

- 6 пагинированных списков (`appointments`, `bookings`, `employees`, `services`, `clients` × 2)
- все cashflows постранично без фильтра по дате
- до 60 detail-запросов на продажи POS
- отдельно `/barbershop/analytics/`, `/barbershop/sale-payouts/`, Redux thunks

**Цель:** один агрегирующий эндпоинт, который отдаёт все данные для экрана за выбранный месяц.

---

## 2. Эндпоинт

```
GET /api/barbershop/analytics/dashboard/
```

### Авторизация

`Authorization: Bearer <JWT>` — компания и филиал из токена / профиля пользователя.

### Query-параметры

| Параметр | Тип | Обязательный | Описание |
|---|---|---|---|
| `date_from` | `YYYY-MM-DD` | да | Первый день периода (включительно), местное время компании |
| `date_to` | `YYYY-MM-DD` | да | Последний день периода (включительно), `23:59:59` местного |

Пример:

```
GET /api/barbershop/analytics/dashboard/?date_from=2026-08-01&date_to=2026-08-31
```

### Ошибки

| HTTP | Когда |
|---|---|
| `400` | Невалидные даты, `date_from > date_to` |
| `401` | Нет/просрочен токен |
| `403` | Нет доступа к компании |
| `404` / `501` | Эндпоинт ещё не реализован — фронт показывает заглушку |

---

## 3. Структура ответа (полная)

```json
{
  "period": {
    "date_from": "2026-08-01",
    "date_to": "2026-08-31",
    "label": "2026-08"
  },
  "totals": {},
  "cash": {},
  "charts": {},
  "rankings": {},
  "bookings": {},
  "products": {},
  "details": {},
  "navigation": {}
}
```

Ниже — **обязательные поля**, которые читает фронт.

---

### 3.1. `period`

| Поле | Тип | Описание |
|---|---|---|
| `date_from` | string | Эхо запроса |
| `date_to` | string | Эхо запроса |
| `label` | string | `YYYY-MM` для внутренних связей (выплаты мастерам) |

---

### 3.2. `totals` — KPI верхней панели

| Поле | Тип | UI / расчёт на фронте |
|---|---|---|
| `appointments_total` | int | «Записей (месяц)» |
| `appointments_completed` | int | Статус «Завершено», конверсия |
| `appointments_canceled` | int | Блок «Отменены и не пришёл» (часть 1) |
| `appointments_no_show` | int | Блок «Отменены и не пришёл» (часть 2) |
| `revenue_completed` | decimal | Сумма завершённых записей; средний чек = `revenue_completed / appointments_completed` |
| `services_total` | int | «Услуг (всего)» — **весь каталог**, не за период |
| `clients_barber_total` | int | «Клиенты» — **все клиенты барбершопа** |
| `clients_market_total` | int | «Клиенты продаж» — клиенты POS без поставщиков |
| `clients_market_active` | int | опционально; активные клиенты продаж за период |
| `income_unified` | decimal | «Приход (месяц)» |
| `expense_unified` | decimal | «Расход (месяц)» |
| `sale_fund` | decimal | Фонд выплат мастерам за `period.label` из `/barbershop/sale-payouts/` |

**Формулы (должны совпадать с прежней клиентской логикой):**

```
income_unified = revenue_completed + cash_income_approved
expense_unified = sale_fund + cash_expense_approved
profit = income_unified - expense_unified
conversion = appointments_completed / appointments_total * 100
```

**Исключения из кассовых операций (важно):**

- Только операции со `status = approved` (или эквивалент).
- **Исключить** автоматическую запись вида `Выплаты мастерам YYYY-MM` из cashflows — она учитывается отдельно через `sale_fund`.

---

### 3.3. `cash`

```json
{
  "totals": {
    "income": 0,
    "expense": 0,
    "net": 0
  },
  "by_cashbox": [
    {
      "name": "Основная касса",
      "ops": 12,
      "income": 15000,
      "expense": 3000
    }
  ]
}
```

| Поле | Описание |
|---|---|
| `totals.income` / `expense` | Суммы approved cashflows за период (без master payout flow) |
| `by_cashbox[].ops` | Количество операций |
| `by_cashbox[].name` | `department_name` или `name` кассы |

Источник данных: `/construction/cashflows/` + `/construction/cashboxes/`, **фильтр по периоду на сервере**.

---

### 3.4. `charts`

```json
{
  "weekday_appointments": [3, 5, 2, 1, 4, 6, 2],
  "daily_cashflow": {
    "labels": ["1", "2", "3"],
    "income": [1000, 0, 500],
    "expense": [200, 100, 0]
  }
}
```

| Поле | Описание |
|---|---|
| `weekday_appointments` | **7 чисел**, индекс `0 = Пн`, `6 = Вс`. Все записи за месяц (любой статус) |
| `daily_cashflow.labels` | Номера дней месяца `"1"` … `"N"` |
| `daily_cashflow.income[]` | По дням: завершённые записи + cash income |
| `daily_cashflow.expense[]` | По дням: cash expense (без master payout flow) |

Группировка — **местное время компании** (Asia/Bishkek, UTC+6).

---

### 3.5. `rankings`

```json
{
  "masters": [
    { "master_id": 1, "master_name": "Алексей", "count": 10, "revenue": 25000 }
  ],
  "services": [
    { "service_id": 2, "name": "Стрижка", "count": 15, "revenue": 18000 }
  ],
  "clients_visits": [
    { "client_id": 3, "name": "Иван", "count": 4, "revenue": 6000 }
  ],
  "clients_sales": [
    { "name": "Петр", "orders": 2, "revenue": 1200 }
  ]
}
```

| Список | Правила сортировки | count | revenue/sum |
|---|---|---|---|
| `masters` | по `revenue` desc, затем `count` | записи со статусами `booked`, `confirmed`, `completed`, `no_show` | только `completed` |
| `services` | то же | то же | то же |
| `clients_visits` | по `revenue` desc | только `completed` | сумма completed |
| `clients_sales` | по `revenue` desc | число POS/object-sales за период | сумма продаж |

Допустимы алиасы полей `id`/`name`/`sum` — фронт нормализует через маппер.

---

### 3.6. `bookings` — заявки (не appointments)

```json
{
  "statuses": [
    { "status": "confirmed", "label": "Подтверждены", "count": 5 },
    { "status": "no_show", "label": "Не пришли", "count": 1 }
  ],
  "top_services": [
    { "service_id": 2, "name": "Стрижка", "count": 8 }
  ]
}
```

| Правило | Описание |
|---|---|
| Статус `new` | **не включать** в `statuses` |
| `top_services` | топ-5 услуг по числу заявок за период |

Источник: `/barbershop/bookings/` с фильтром по дате на сервере.

---

### 3.7. `products`

```json
{
  "sales_rows": [
    { "name": "Шампунь", "qty": 3, "revenue": 900 }
  ],
  "suppliers_rows": [
    { "name": "Поставщик А", "items": 2, "amount": 5000 }
  ],
  "stock": {
    "positions": 120,
    "total_qty": 450,
    "stock_value_retail": 89000
  },
  "summary": {
    "total_qty": 3,
    "total_revenue": 900
  }
}
```

| Блок | Источник (ранее на фронте) |
|---|---|
| `sales_rows` | POS `/main/pos/sales/` + `/main/object-sales/` за период, агрегация по позициям |
| `suppliers_rows` | приходы товаров за период (`products` с `client_name` / поставщик) |
| `stock` | текущий склад (`main/products/list/`), **не фильтруется по периоду** |

---

### 3.8. `details` — модалки «Приход» / «Расход»

```json
{
  "income": [
    {
      "source": "Запись",
      "title": "Стрижка • Клиент: Иван • Мастер: Алекс",
      "amount": 500,
      "date": "15.08.2026"
    },
    {
      "source": "Касса",
      "title": "Оплата аренды",
      "amount": 1000,
      "date": "10.08.2026"
    }
  ],
  "expense": [
    {
      "source": "Касса",
      "title": "Закупка материалов",
      "amount": 800,
      "date": "05.08.2026"
    },
    {
      "source": "Выплаты мастерам",
      "title": "Период 2026-08",
      "amount": 12000,
      "date": "2026-08"
    }
  ]
}
```

| Поле | Формат |
|---|---|
| `source` | `"Запись"` \| `"Касса"` \| `"Выплаты мастерам"` |
| `title` | Человекочитаемое описание |
| `amount` | Положительное число |
| `date` | `DD.MM.YYYY` или `YYYY-MM` для выплат |

Сортировка: **новые сверху**.

---

### 3.9. `navigation`

```json
{
  "default_cashbox_id": "uuid-кассы"
}
```

Первая доступная касса компании — для перехода по клику на KPI «Приход» / «Расход» (`/crm/kassa/{id}?tab=income|expense`).

---

## 4. Источники данных (маппинг со старой логики)

| Блок ответа | Бывшие эндпоинты |
|---|---|
| `totals.*` (appointments) | `/barbershop/appointments/` + `/barbershop/analytics/` |
| `bookings.*` | `/barbershop/bookings/` |
| `rankings.masters` | appointments + `/users/employees/` |
| `rankings.services` | appointments + `/barbershop/services/` |
| `rankings.clients_visits` | appointments + `/barbershop/clients/` |
| `cash.*` | `/construction/cashflows/` + `/construction/cashboxes/` |
| `totals.sale_fund` | `/barbershop/sale-payouts/` |
| `products.sales_rows` | `/main/pos/sales/`, `/main/object-sales/` (+ detail при отсутствии items) |
| `products.suppliers_rows` | `main/products/list/` движения за период |
| `products.stock` | `main/products/list/` |
| `totals.clients_market_total` | `/main/clients/` (исключить поставщиков) |
| `navigation.default_cashbox_id` | `/construction/cashboxes/` |

---

## 5. Производительность (рекомендации бэкенду)

1. **Один SQL/ORM round-trip** или materialized view на период — не N+1.
2. Фильтр `date_from` / `date_to` на уровне БД для appointments, bookings, cashflows, sales.
3. Не отдавать сырые списки appointments/bookings — только агрегаты и топ-N (5–20 строк).
4. Кэш на 1–5 минут по ключу `(company_id, date_from, date_to)`.
5. Целевое время ответа: **< 500 ms** при типичной базе.

---

## 6. Чек-лист приёмки

| # | Проверка | Ожидание |
|---|---|---|
| 1 | Один запрос при открытии страницы | Только `GET .../analytics/dashboard/` |
| 2 | Смена месяца | Повторный запрос с новыми `date_from`/`date_to` |
| 3 | KPI «Приход» = completed revenue + cash income | Совпадает со старой страницей на тестовых данных |
| 4 | KPI «Расход» = sale_fund + cash expense | Без дубля master payout в cashflows |
| 5 | График по дням недели | 7 значений, Пн=index 0 |
| 6 | Линейный график | `labels.length` = число дней в месяце |
| 7 | Модалка прихода | `details.income` содержит записи + кассу |
| 8 | Модалка расхода | `details.expense` + строка выплат мастерам |
| 9 | `404` на эндпоинт | Фронт: «Серверная аналитика ещё не подключена» |
| 10 | Нагрузка | ≤ 1 HTTP-запрос на загрузку/смену периода |

---

## 7. Legacy

Эндпоинт `GET /barbershop/analytics/` (без `/dashboard/`) считается **устаревшим** — частичные агрегаты. После внедрения dashboard его можно оставить для обратной совместимости или удалить.

---

## 8. Пример минимального ответа (пустой месяц)

```json
{
  "period": {
    "date_from": "2026-08-01",
    "date_to": "2026-08-31",
    "label": "2026-08"
  },
  "totals": {
    "appointments_total": 0,
    "appointments_completed": 0,
    "appointments_canceled": 0,
    "appointments_no_show": 0,
    "revenue_completed": 0,
    "services_total": 2,
    "clients_barber_total": 0,
    "clients_market_total": 0,
    "income_unified": 0,
    "expense_unified": 0,
    "sale_fund": 0
  },
  "cash": {
    "totals": { "income": 0, "expense": 0, "net": 0 },
    "by_cashbox": []
  },
  "charts": {
    "weekday_appointments": [0, 0, 0, 0, 0, 0, 0],
    "daily_cashflow": {
      "labels": ["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31"],
      "income": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      "expense": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    }
  },
  "rankings": {
    "masters": [],
    "services": [],
    "clients_visits": [],
    "clients_sales": []
  },
  "bookings": {
    "statuses": [],
    "top_services": []
  },
  "products": {
    "sales_rows": [],
    "suppliers_rows": [],
    "stock": { "positions": 0, "total_qty": 0, "stock_value_retail": 0 },
    "summary": { "total_qty": 0, "total_revenue": 0 }
  },
  "details": {
    "income": [],
    "expense": []
  },
  "navigation": {
    "default_cashbox_id": null
  }
}
```
