# 6. Карточка сотрудника: показатели, КПД, рейтинг

**Фронт:** `Teachers/EmployeeCard.jsx` (вкладка «Работа и КПД»),
`Teachers/EmployeesRating.jsx`, API-слой `src/api/consultingEmployees.js`.
**Смежное:** [07-employee-finance.md](./07-employee-finance.md) — финансовые
вкладки той же карточки.

## 6.1. Задача

Раздел «Сотрудники» — это список и права доступа. Открыть человека и посмотреть,
как он работает, невозможно; оценка делается «на ощущениях». Нужны измеримые
показатели и сводная оценка КПД.

## 6.2. Эндпоинт показателей

```
GET /consalting/employees/{id}/stats/?date_from=&date_to=
```

```jsonc
{
  "leads": {
    "received": 40,          // назначено за период
    "claimed": 12,           // взято из пула самостоятельно
    "in_work": 8,
    "deferred": 6,
    "overdue": 2,            // из отложенных: срок прошёл
    "processed": 26,         // доведено до результата (купил или отказ)
    "no_reply_in_time": 3    // первый ответ позже норматива
  },
  "sales": {
    "deals": 15,
    "revenue": 410000,       // без отменённых и возвратов
    "avg_check": 27333.33,
    "conversion": 37.5,      // deals / leads.received * 100
    "plan": 500000,
    "plan_done_percent": 82.0,
    "canceled": 1,
    "cancel_rate": 6.25      // отменённые / (закрытые + отменённые) * 100
  },
  "speed": {
    "first_reply_avg_minutes": 42.5,
    "deal_cycle_avg_days": 6.4,
    "by_stage": [ { "stage": "uuid", "stage_display": "Переговоры", "avg_hours": 26.5 } ]
  },
  "kpi": {
    "score": 74,
    "conversion_score": 75, "plan_score": 82,
    "speed_score": 68, "discipline_score": 67,
    "rank": 3, "of": 9,
    "weights": { "conversion": 0.35, "plan": 0.3, "speed": 0.2, "discipline": 0.15 }
  },
  "salary": { "accrued": 98500, "paid": 50000, "remaining": 48500 },
  "top_services": [
    { "service": "uuid", "service_name": "Внедрение CRM", "deals": 7, "revenue": 210000 }
  ]
}
```

Все показатели — за период (`date_from`..`date_to`), лиды учитываются по дате
получения (когорта, как в [01-leads.md](./01-leads.md)).

## 6.3. Формула КПД

Четыре составляющие, каждая нормируется в 0..100, затем взвешивается. Веса
настраиваются на уровне компании (модель `KpiWeights`, значения по умолчанию —
как в ответе выше). Фронт умеет считать по этой же формуле, если сервер пришлёт
только сырые данные (`calcKpiScore` в `consultingEmployees.js`) — держите
формулы синхронными.

```python
def kpi_score(stats, w):
    clamp = lambda v: max(0, min(100, float(v or 0)))

    conversion = clamp(stats["sales"]["conversion"])
    plan       = clamp(stats["sales"]["plan_done_percent"])

    # Скорость: 5 минут и быстрее → 100, 120 минут и дольше → 0
    reply = stats["speed"]["first_reply_avg_minutes"]
    speed = clamp((120 - min(reply, 120)) / 115 * 100) if reply is not None else 0

    # Дисциплина: доля НЕпросроченных среди отложенных
    deferred, overdue = stats["leads"]["deferred"], stats["leads"]["overdue"]
    discipline = clamp((1 - overdue / deferred) * 100) if deferred else 100

    return round(conversion * w.conversion + plan * w.plan
                 + speed * w.speed + discipline * w.discipline)
```

Пояснения по смыслу (пригодятся при объяснении заказчику):

- **конверсия** — умеет ли закрывать;
- **план** — делает ли объём;
- **скорость** — не теряет ли горячие лиды;
- **дисциплина** — перезванивает ли по отложенным вовремя.

`rank` / `of` — место в рейтинге компании за тот же период.

## 6.4. План продаж

Личный план нужен для `plan_done_percent`:

```python
class SalesPlan(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    period_month = models.CharField(max_length=7)      # "2026-07"
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "period_month"],
                                               name="uniq_user_plan_month")]
```

Если плана нет — `plan = null`, `plan_done_percent = null`, а вес `plan`
перераспределяется на остальные составляющие пропорционально (иначе сотрудник
без плана будет вечно недобирать баллы).

## 6.5. Рейтинг команды

```
GET /consalting/employees/rating/?date_from=&date_to=&ordering=-kpi&search=&page=&page_size=
```

```jsonc
{ "count": 9, "results": [
  { "user": "uuid", "name": "Менеджер А",
    "leads": 40, "deferred": 6, "overdue": 2, "deals": 15,
    "conversion": 37.5, "revenue": 410000, "kpi": 74 }
] }
```

Сортировка (`ordering`): `kpi`, `revenue`, `deals`, `conversion`, `leads`,
`deferred`, `overdue` — с минусом для убывания. По умолчанию `-kpi`.

Считайте одним агрегирующим запросом с `GROUP BY user`, без цикла по
сотрудникам с отдельным `stats/` на каждого — иначе на 50 сотрудниках экран
будет открываться минуту.

## 6.6. Лента активности (опционально)

```
GET /consalting/employees/{id}/activity/?page=&page_size=
```

Последние события сотрудника: назначенные лиды, закрытые сделки, отправленные
сообщения. Формат свободный: `{ type, title, subtitle, at, url }`. Фронт
показывает списком; если эндпоинта нет — блок просто не отображается.

## 6.7. Права

- Рядовой сотрудник: только своя карточка (`id == self`), рейтинг ему
  не отдаём (`403`) либо отдаём без чужих имён — на ваше решение, фронт
  скрывает вкладку у не-руководителей.
- `owner`/`admin` — все карточки и рейтинг.

## 6.8. Производительность

- Все агрегаты — на уровне БД (`annotate`/`aggregate`), никаких выборок в
  Python по всем лидам.
- Индексы: `(company, owner, status, created_at)` по лидам,
  `(company, user, created_at, status)` по продажам.
- Рейтинг за месяц по компании на 50 сотрудников должен укладываться в ~300 мс;
  если не укладывается — кэшируйте на 5 минут по ключу
  `(company, date_from, date_to)`.

## 6.9. Чек-лист приёмки

- [ ] Показатели считаются за выбранный период, лиды — по дате получения.
- [ ] Отменённые продажи не попадают в `revenue` и `deals`, но видны в
      `canceled` / `cancel_rate`.
- [ ] КПД на фронте и на сервере совпадает на одних и тех же данных.
- [ ] Сотрудник без плана не получает 0 за составляющую «план».
- [ ] Рейтинг сортируется по любому столбцу и совпадает с карточками.
- [ ] Сотрудник не может открыть чужую карточку.
