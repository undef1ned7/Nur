# Консалтинг · Аналитика — API для фронтенда

**Страница:** `/crm/consulting/analytics`
(`src/Components/Sectors/Consulting/Analytics/Analytics.jsx`).
**API-клиент:** `src/api/consultingAnalytics.js`.

Все эндпоинты: `Authorization: Bearer <JWT>`, компания берётся из токена.
Общие параметры: `date_from` / `date_to` (либо `period_start` / `period_end`,
формат `YYYY-MM-DD`), `branch`. Период по умолчанию — **последние 30 дней**.
На фронте смена периода debounce 400 ms.

| Эндпоинт | Вкладка UI |
|---|---|
| `GET /api/consalting/analytics/dashboard/` | Обзор |
| `GET /api/consalting/analytics/messenger/` | Мессенджер |
| `GET /api/consalting/analytics/sources/` | Источники |
| `GET /api/consalting/analytics/managers/` | Менеджеры |
| `GET /api/consalting/analytics/` | Продажи (legacy, опционально) |
| `GET /api/consalting/funnels/<id>/analytics/` | Воронка по стадиям (отдельно) |

При `404` / `501` страница показывает заглушку «серверная аналитика ещё не
подключена».

---

## 1. Дашборд — `/analytics/dashboard/`

Одна точка для главного экрана. Каждый KPI приходит **с динамикой**:

```json
{
  "period":         { "date_from": "2026-06-28", "date_to": "2026-07-27" },
  "compare_period": { "date_from": "2026-05-29", "date_to": "2026-06-27" },
  "kpis": {
    "revenue":              { "current": 62200.0, "previous": 33244.0, "diff": 28956.0, "percent": 87.1 },
    "paid_income":          {},
    "sales_count":          {}, "avg_check": {}, "subscription_mrr": {},
    "leads": {}, "requests": {}, "messages": {}, "avg_response_minutes": {}
  },
  "leads":     { "total": 19, "won": 4, "lost": 0, "in_work": 15, "win_rate": 1.0,
                 "pipeline_value": 76500.0, "at_risk": 0 },
  "messenger": { "totals": {}, "response": {}, "waiting_now": 10, "by_day": [], "by_hour": [] },
  "sources":   { "totals": {}, "by_status": {}, "by_source": [] },
  "sales":     { "by_day": [], "by_service": [], "by_employee": [] },
  "managers":  []
}
```

`percent` — рост в % к прошлому периоду той же длины (стрелки ↑/↓).
Для `avg_response_minutes` **меньше = лучше**: рост красим негативно.

---

## 2. Мессенджер — `/analytics/messenger/`

Дополнительно принимает `owner=<user_id>`.

Ключевые блоки UI:
- KPI: сообщения, чаты, медиана/среднее ответа, `answer_rate`, `never_answered_chats`
- **`waiting_now`** — рабочий список «ответить сейчас» (последнее сообщение
  клиентское, ждёт &gt; 15 мин; не привязан к периоду). Ссылка на карточку лида.
- Графики `by_day` / `by_hour`
- Таблица `by_operator` (атрибуция по ответственному за лида; `user_id: null` —
  «Без ответственного»)

---

## 3. Источники — `/analytics/sources/`

Воронка **заявка → лид → won**. `share` уже в процентах; `conversion_*` —
доли `0..1`.

---

## 4. Менеджеры — `/analytics/managers/`

Отсортировано по числу лидов. `user_id: null` показываем как
«Не распределено».

---

## Замечания по отображению

1. **Пустой период — не ошибка.** Нули и `null` в средних. `null` → «—», не `0`.
2. **Проценты-доли** (`0.385`) умножаем на 100; `share` и `percent` уже в %.
3. **Деньги** без валюты; на UI суффикс «с».
4. Тяжёлые срезы (`dashboard`) — debounce на фильтре периода.
