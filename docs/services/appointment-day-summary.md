# Записи (Recorda) — сводка ожидаемой суммы за день

**Сферы:** Барбершоп, Услуги, Стоматология — `barbershop`.  
**Страницы:** `/crm/barber/records`, `/crm/services/records`, `/crm/dentistry/records`.  
**Фронт:** `src/Components/Sectors/Barber/Recorda/Recorda.jsx`,  
`src/api/barberAppointments.js`.  
**Эндпоинт:** `GET /api/barbershop/appointments/summary/`  
**Статус:** ⚠️ Требуется реализация на бэкенде. На фронте — готово (с fallback).

---

## 1. Задача

В шапке календаря записей показывается строка:

> **Сегодня · 5 записей · ожидается 12 500 сом**

Сейчас сумма считается на фронте по всем загруженным appointments
(`page_size=1000`). При пагинации и server-side фильтрах клиентский расчёт
**неточен**.

Бэкенд должен отдавать **агрегат** независимо от пагинации списка записей.

---

## 2. Эндпоинт

```http
GET /api/barbershop/appointments/summary/
Authorization: Bearer …
```

### 2.1. Сводка за день (календарь)

| Параметр | Обязательный | Формат | Смысл |
|---|---|---|---|
| `date` | да | `YYYY-MM-DD` | День по `start_at` (локальная TZ компании или `+06:00`) |
| `barber` | нет | uuid | Только записи этого мастера |
| `status` | нет | string | Как в list API; если не передан — все статусы **кроме** `deleted` |

**Пример:**

```http
GET /api/barbershop/appointments/summary/?date=2026-03-05&barber=9b1caf00-…
```

**Ответ `200`:**

```json
{
  "date": "2026-03-05",
  "scope": "day",
  "expected_count": 5,
  "expected_total": "12500.00"
}
```

| Поле | Тип | Смысл |
|---|---|---|
| `date` | string | Echo запроса |
| `scope` | `"day"` | Тип сводки |
| `expected_count` | int | Число записей, вошедших в сумму (§3) |
| `expected_total` | decimal string | Ожидаемая выручка в **сомах** |

### 2.2. Сводка удалённых (раздел «Удалённые»)

| Параметр | Обязательный | Формат | Смысл |
|---|---|---|---|
| `scope` | да | `deleted` | Режим архива удалённых |
| `barber` | нет | uuid | Фильтр по мастеру |

`date` **не передаётся** — сумма по всем записям со статусом `deleted`
(видимым текущему пользователю, см. `appointment-soft-delete.md` §4.3).

**Пример:**

```http
GET /api/barbershop/appointments/summary/?scope=deleted
```

**Ответ `200`:**

```json
{
  "scope": "deleted",
  "records_count": 12,
  "expected_total": "45300.00"
}
```

| Поле | Тип | Смысл |
|---|---|---|
| `records_count` | int | Все записи `deleted` (после фильтра `barber`) |
| `expected_total` | decimal string | Сумма `price` / расчётная цена (§3.2) |

---

## 3. Правила расчёта `expected_total`

### 3.1. Какие записи входят в `expected_count` (scope=day)

По умолчанию (без `status` в query) — только статусы:

- `booked`
- `confirmed`
- `completed`

**Не входят:** `canceled`, `cancelled`, `no_show`, `deleted`.

Если передан `status=completed` — считаются только `completed` (и т.д.).

### 3.2. Сумма одной записи

1. Если `appointment.price` задан и `>= 0` → берётся он (уже с учётом ручной
   правки и скидки на фронте).
2. Иначе — сумма базовых цен услуг из `appointment.services` на момент расчёта,
   с учётом `appointment.discount` (%), по той же формуле, что в
   `RecordaModal` / `docs/services/salary.md` §3.2 (пропорционально или одна
   услуга).
3. Если итог `<= 0` → в сумму **не добавлять** (или добавлять 0).

Бэкенд — **единственный источник истины** для сводки; фронт при `200` показывает
ответ API as-is.

### 3.3. Scope `deleted`

Все записи со статусом `deleted`; сумма по правилу §3.2 для каждой.

---

## 4. Права и фильтрация

- Компания — из JWT, как у `GET /barbershop/appointments/`.
- Записи `deleted` в scope `day` **никогда** не учитываются.
- Scope `deleted` — только для `owner` / `admin`; для остальных ролей `403` или
  `{ "records_count": 0, "expected_total": "0.00" }` (предпочтительно `403`).

---

## 5. Ошибки

| Код | Когда |
|---|---|
| `400` | Нет `date` при scope=day; неверный формат даты |
| `403` | Нет доступа (deleted-summary для не-admin) |
| `404` | Эндпоинт ещё не развёрнут (фронт использует client fallback) |

---

## 6. Связь со списком записей (пагинация)

Рекомендуемый путь миграции:

1. **Сейчас:** `GET /appointments/?page_size=1000` + `GET /appointments/summary/`.
2. **Далее:** `GET /appointments/?date=…&page=…` для календаря + тот же summary.
3. Сводка **не зависит** от `page` / `page_size` list-эндпоинта.

Опционально list может дублировать агрегат:

```json
{
  "count": 120,
  "next": "…",
  "results": [ … ],
  "summary": {
    "expected_count": 5,
    "expected_total": "12500.00"
  }
}
```

Фронт v1 вызывает **отдельный** `/summary/` — проще кэшировать и не тянуть
лишние поля.

---

## 7. Что сделано на фронте

- `src/api/barberAppointments.js` — `getAppointmentsSummary(params)`.
- `Recorda.jsx` — при смене даты / мастера / статуса запрос summary; при
  `404`/`405`/сети — расчёт через `computeDayExpectedSummary` (legacy).
- После сохранения / удаления записи summary перезапрашивается.
- `RecordaDaySummary.jsx` — кнопка **«Итого за день»** сверху страницы;
  раскрывается таблица **по клиентам** (client fallback:
  `computeDaySummaryByClient`).

### 7.1. Опционально: разбивка с бэка

Для точности при server-side пагинации list API можно расширить ответ summary:

```json
{
  "date": "2026-03-05",
  "scope": "day",
  "expected_count": 45,
  "expected_total": "125000.00",
  "by_client": [
    { "client_id": "…", "client_name": "Айгуль", "records_count": 2, "expected_total": "3500.00" }
  ]
}
```

Пока поле не реализовано — фронт считает `by_client` по загруженным записям дня.

---

## 8. Чек-лист приёмки

- [ ] `GET …/summary/?date=2026-03-05` → `200`, поля `expected_count`,
  `expected_total`.
- [ ] Сумма совпадает с ручной проверкой по записям дня (5–10 кейсов).
- [ ] `barber=` сужает count и total.
- [ ] `status=completed` — только завершённые.
- [ ] Записи `deleted` не входят в day-summary.
- [ ] `scope=deleted` — только для admin/owner.
- [ ] При >1000 записей в компании summary за один день корректен без
  загрузки всего списка.
- [ ] Фронт без бэка (404) — показывает client fallback без ошибки в UI.

---

## 9. Связанные файлы

| Слой | Путь |
|---|---|
| API-клиент | `src/api/barberAppointments.js` |
| Страница | `src/Components/Sectors/Barber/Recorda/Recorda.jsx` |
| Client fallback | `src/Components/Sectors/Barber/Recorda/components/RecordaUtils.js` |
| Мягкое удаление | `docs/services/appointment-soft-delete.md` |
