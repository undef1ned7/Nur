# 18. Аналитика: долги по абонентской плате

**Фронт:** вкладка «Долги» в `Analytics/Analytics.jsx`, эндпоинт-клиент
`getAnalyticsDebts` в `src/api/consultingAnalytics.js`.
**Контракт списков (для фронтендера):** [../analytics.md](../analytics.md) §1a.
**Смежные:** [01-subscription.md](./01-subscription.md) (модели `Subscription`/
`SubscriptionPayment`, статус `overdue`), [05-analytics-kpi.md](./05-analytics-kpi.md)
(`subscription_mrr`, `pending_cash`), [03-cash-confirmation.md](./03-cash-confirmation.md)
(`CashOperation`).

---

## 18.1. Задача

Компания продаёт абонентские услуги, но нигде не видит **кто и сколько
должен**. Два разных случая, которые сейчас не различаются и не считаются:

1. **Просрочка** — у клиента активная подписка, но очередной платёж графика
   (`SubscriptionPayment`) не оплачен вовремя (`status = overdue`). Клиент
   «долго не платит абонплату».
2. **Долг/рассрочка** — подписка была подключена в момент закрытия сделки, но
   оплата принята не сразу, а оформлена как `payment_mode = debt` («в долг»)
   или `payment_mode = installment` (рассрочка). Клиент «взял абонплату в
   долг» — обязательство есть с первого дня, а не только с первой просрочки.

Обе категории — **деньги компании, зависшие у клиентов**. Нужен один экран,
где видно суммарный долг, разбивку по давности и списки клиентов, чтобы
менеджер мог обзвонить, а руководитель — оценить риск.

Новых таблиц не требуется — это агрегирующий отчёт поверх уже описанных в
[01-subscription.md](./01-subscription.md) моделей `Subscription` /
`SubscriptionPayment` и существующей модели `Sale` (`payment_mode`,
`debt_months`, `prepayment`).

---

## 18.2. Источники данных

### Просрочка (категория 1)

```sql
SubscriptionPayment.objects.filter(
    subscription__company=company,
    status="overdue",             -- проставляется ежедневной задачей, см. 01-subscription.md §5.3
)
```

`days_overdue = today - due_date`.

### Долг/рассрочка (категория 2)

```sql
Subscription.objects.filter(
    company=company,
    sale__payment_mode__in=["debt", "installment"],
    status="active",
)
```

Для каждой такой подписки:

- `amount_total` = `sale.amount` (сумма сделки, за которую подключена
  абонплата);
- `amount_paid` = `sale.prepayment or 0` **+** сумма подтверждённых
  `CashOperation` по этой продаже (частичные погашения долга через кассу);
- `amount_remaining = max(amount_total - amount_paid, 0)`;
- дедлайн погашения `due_date = sale.created_at.date() + relativedelta(months=sale.debt_months)`;
- `days_overdue = today - due_date`, если `today > due_date`, иначе `null`
  (срок ещё не наступил — долг есть, но пока не просрочен).

Строку показываем, пока `amount_remaining > 0`, независимо от того, наступил
дедлайн или нет (нужно видеть долг сразу, не дожидаясь просрочки).

### Пересечение категорий

Если у клиента и просрочка по графику, и незакрытый долг по сделке —
считаем оба случая, но `top_debtors`/`debtors_count` **дедуплицируют по
клиенту** (сумма долга у клиента = сумма всех его строк из обеих категорий).

---

## 18.3. Контракт — `GET /consalting/analytics/debts/`

Параметры: `date_from`, `date_to`, `branch` — как в остальных эндпоинтах
аналитики ([../analytics.md](../analytics.md)). Влияют **только на `percent`/
`diff`** у KPI (сравнение текущего среза с предыдущим периодом той же длины).
Списки (`aging`, `overdue_subscriptions`, `debt_subscriptions`, `top_debtors`)
— это **срез на сегодня**, а не на конец периода: долг либо есть сейчас, либо
его нет, ждать конца отчётного периода не нужно.

```jsonc
{
  "kpis": {
    "debtors_count":     { "current": 14, "previous": 9,  "diff": 5,    "percent": 55.6 },
    "total_debt":        { "current": 187500, "previous": 132000, "diff": 55500, "percent": 42.0 },
    "overdue_amount":    { "current": 96000,  "previous": 71000,  "diff": 25000, "percent": 35.2 },
    "overdue_count":     { "current": 11 },
    "debt_mode_amount":  { "current": 91500,  "previous": 61000,  "diff": 30500, "percent": 50.0 },
    "debt_mode_count":   { "current": 6 },
    "bucket_0_30": 42000,
    "bucket_31_60": 58500,
    "bucket_61_90": 31000,
    "bucket_90_plus": 56000
  },
  "aging": [
    { "bucket": "0-30",  "bucket_label": "0–30 дн.",  "amount": 42000, "count": 5 },
    { "bucket": "31-60", "bucket_label": "31–60 дн.", "amount": 58500, "count": 4 },
    { "bucket": "61-90", "bucket_label": "61–90 дн.", "amount": 31000, "count": 2 },
    { "bucket": "90+",   "bucket_label": "90+ дн.",   "amount": 56000, "count": 3 }
  ],
  "overdue_subscriptions": [
    {
      "payment_id": "p-101", "subscription_id": "sub-9",
      "client_id": "c-1", "client_name": "Иванов Иван", "phone": "+996700000001",
      "service_display": "Внедрение CRM", "tariff_display": "Стандарт",
      "amount": 5000, "due_date": "2026-07-01", "days_overdue": 42,
      "owner": "Азамат"
    }
  ],
  "debt_subscriptions": [
    {
      "subscription_id": "sub-14", "sale_id": "sale-33",
      "client_id": "c-2", "client_name": "Петрова Анна", "phone": "+996700000002",
      "service_display": "Консультация · Премиум", "tariff_display": "Премиум",
      "payment_mode": "installment", "debt_months": 6,
      "amount_total": 60000, "amount_paid": 20000, "amount_remaining": 40000,
      "start_date": "2026-05-10", "due_date": "2026-11-10", "days_overdue": 0,
      "owner": "Бекова Дария"
    }
  ],
  "top_debtors": [
    { "client_id": "c-2", "client_name": "Петрова Анна", "phone": "+996700000002",
      "total_debt": 40000, "max_days_overdue": 0 },
    { "client_id": "c-1", "client_name": "Иванов Иван", "phone": "+996700000001",
      "total_debt": 5000, "max_days_overdue": 42 }
  ]
}
```

Примечания:

- `owner` — ответственный за клиента/лида (тот же принцип, что в `managers`/
  `by_operator` других вкладок): `null` → фронт покажет «—».
- `top_debtors` — топ **20–50** клиентов по `total_debt` убыв.; при бо́льших
  объёмах отдавайте `limit` (без пагинации, это дайджест, а не список для
  постраничного просмотра).
- `overdue_subscriptions` сортировать по `days_overdue` убыв. (сначала самые
  просроченные), `debt_subscriptions` — по `amount_remaining` убыв.
- Пустой долг — не ошибка: `404`/`501` только если эндпоинт не задеплоен
  (фронт показывает штатную заглушку «аналитика ещё не подключена»), иначе —
  `200` с пустыми массивами и нулевыми KPI.
- `bucket_*` — плоские числа (снэпшот на сегодня), без `previous/percent`
  (сравнивать давность долга с прошлым периодом не имеет смысла).

---

## 18.4. Что читает фронт (уже реализовано)

`Analytics.jsx`, вкладка «Долги»:

- 4 KPI-карточки (`debtors_count`, `total_debt`, `overdue_amount`,
  `debt_mode_amount`) + 4 плашки давности (`bucket_0_30` … `bucket_90_plus`).
- Столбчатая диаграмма `aging` (сумма долга по давности).
- «Топ должников» (`top_debtors`, до 8 в списке) — сумма кликабельна, ведёт в
  `/crm/consulting/client/{client_id}`.
- Таблица «Просроченная абонентская плата» (`overdue_subscriptions`) —
  клиент, услуга/тариф, сумма, дата платежа, просрочка (дней), ответственный,
  ссылка на карточку клиента.
- Таблица «Абонплата, оформленная в долг/рассрочку» (`debt_subscriptions`) —
  клиент, услуга, способ (В долг/Рассрочка), срок в месяцах, оплачено,
  осталось, дата оформления, ответственный, ссылка на карточку клиента.

Если у строки нет `days_overdue` с бэка, фронт досчитывает его сам из
`due_date` (`today − due_date`, не отрицательное) — так что поле желательно,
но не блокирует интеграцию.

---

## 18.5. Чек-лист приёмки

- [ ] `overdue_amount`/`overdue_count` совпадают с суммой/количеством
      `SubscriptionPayment.status="overdue"` компании.
- [ ] `debt_mode_amount`/`debt_mode_count` считают только подписки от `Sale`
      с `payment_mode in (debt, installment)` и `amount_remaining > 0`.
- [ ] `amount_remaining` уменьшается сразу после подтверждения кассиром
      очередного погашения долга (`CashOperation` confirmed по этой продаже).
- [ ] Полностью погашённый долг (`amount_remaining = 0`) пропадает из
      `debt_subscriptions` и из `total_debt` на следующей загрузке.
- [ ] `debtors_count`/`top_debtors` дедуплицируют клиента с долгом в обеих
      категориях одновременно.
- [ ] Отмена продажи ([02-sale-cancel.md](./02-sale-cancel.md)) аннулирует её
      долг — строка пропадает, а не «зависает» с `amount_remaining`.
- [ ] `aging`-корзины в сумме дают `overdue_amount + debt_mode_amount`
      (без двойного счёта одной и той же просроченной строки).
- [ ] Пустой долг → `200` с нулями, а не `404`.

---

## 18.6. Что ещё стоит добавить в аналитику (анализ, не в этом релизе)

Разбор того, что уже есть в консалтинге, но не отражено в `Analytics.jsx` —
для приоритизации следующих итераций отчётности. В этом релизе реализована
только вкладка «Долги» (см. выше); остальное — рекомендации.

| Модуль консалтинга | Отражено в аналитике? | Комментарий |
|---|---|---|
| Воронка/лиды (`Funnel`, `Leads`) | Да | Обзор, Источники, Менеджеры |
| Мессенджер/чаты (`Chats`, Wazzup) | Да | Вкладка «Мессенджер» |
| Продажи (`sale.jsx`) | Частично | В Обзоре только сумма и разбивка по услугам; нет разбивки по `payment_mode` (нал/перевод/долг/рассрочка) и нет отдельного вида на отмены/возвраты (сейчас это одна цифра `cancellations` внутри `net_revenue`) |
| Абонентка (`SubscriptionMatrix`) | Частично → закрыто этой задачей | Матрица показывает график платежей, но не считала долг агрегированно — теперь считает вкладка «Долги» |
| Касса (`Kassa`, `CashRequests`, `Kassa/Reports`) | Частично | `Kassa/Reports.jsx` уже даёт помесячные движения по кассам вручную; в аналитике — только `paid_income`/`pending_cash`, без разбивки по кассе/методу оплаты |
| Зарплата (`salary/*`, `SalaryAdjustments`, `SalaryBonusRules`) | Нет | Фонд оплаты труда нигде не сведён с выручкой — нельзя увидеть «чистую прибыль» (revenue − payroll − cancellations) |
| Рейтинг сотрудников (`EmployeesRating`) | Частично | Отдельная страница со своими метриками (лиды, отложено, просрочено по лидам, конверсия, КПД); вкладка «Менеджеры» в аналитике не пересекается с ней и не показывает выручку/продажи на сотрудника |
| Бронирования (`Bookings`) | Нет | Нет конверсии «бронь → визит → продажа», нет `no-show rate` |
| Заявки клиентов (`client-requests`) | Нет | Не видно объёма и SLA обработки (время до `accept`/`decline`, см. [../backend-money-tenant/16-request-assigned-to.md](./16-request-assigned-to.md)) |
| Регионы (`RegionFilter`, региональные воронки) | Нет | Аналитика не режется по региону, хотя воронки и распределение лидов — региональные |
| Услуги/тарифы (`services.jsx`) | Частично | Есть «Услуги по выручке», но нет `MRR`/`ARPU` в разрезе тарифа, только в разрезе услуги |

### Рекомендации на следующие итерации (по приоритету)

1. **Разбивка по региону** — фильтр `region` во всех вкладках аналитики (как
   в `LeadsDistribution`), иначе руководитель мультирегиональной компании не
   сравнит Бишкек/Ош по одному отчёту.
2. **Касса в Обзоре** — KPI/таблица по способу оплаты (нал/перевод/долг/
   рассрочка) и по кассе (`cashbox`), без похода в `Kassa/Reports` вручную.
3. **Зарплата и чистая прибыль** — KPI «Фонд оплаты труда» и `net_profit =
   net_revenue − payroll_cost`, тянуть из `salary/*`.
4. **Retention/LTV** — доля новых vs повторных клиентов за период, отток
   подписок (`churn = (canceled+paused за период) / active на начало периода`).
5. **Бронирования** — конверсия «бронь → визит → продажа», `no-show rate` из
   `Bookings`.
6. **SLA заявок** — среднее время `assigned → accepted/declined` из
   `client-requests`.
7. **Тарифы** — `MRR`/`ARPU` в разрезе тарифа (не только услуги) в блоке
   «Абонентка (MRR)» Обзора.
