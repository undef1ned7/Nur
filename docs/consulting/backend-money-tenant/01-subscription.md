# 5. Абонентская плата при закрытии сделки (главный блокер)

**Фронт:** `Funnel/LeadPaymentModal.jsx` (блок «Абонентская плата»),
`client/ConsultingClientDetail.jsx`, `client/SubscriptionMatrix.jsx`.
**Смежные:** [02-sale-cancel.md](./02-sale-cancel.md) (откат),
[03-cash-confirmation.md](./03-cash-confirmation.md) (приём платежа).

## 5.1. Что сейчас сломано

1. У тарифа задаётся `subscription_amount` + `subscription_period` — работает.
2. Лид/продажа несут `service` и `tariff` — работает, фронт их отправляет.
3. **При закрытии сделки график абонентских платежей не создаётся** — данных
   нет ни в карточке клиента, ни в матрице, ни в планах поступлений.

Компания уже продаёт абонентские услуги и не видит их в системе. Это не новая
функция, а недоделанная логика — поэтому пункт первый по приоритету.

## 5.2. Модель

```python
class Subscription(models.Model):
    """Подключённая клиенту абонентская услуга."""
    class Period(models.TextChoices):
        MONTH = "month", "Ежемесячно"
        YEAR = "year", "Ежегодно"

    class Status(models.TextChoices):
        ACTIVE = "active", "Активна"
        PAUSED = "paused", "Приостановлена"
        CANCELED = "canceled", "Отменена"
        FINISHED = "finished", "Завершена"

    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="subscriptions")
    service = models.ForeignKey(Service, on_delete=models.PROTECT)
    tariff = models.ForeignKey(Tariff, null=True, blank=True, on_delete=models.PROTECT)
    sale = models.ForeignKey("Sale", null=True, blank=True,
                             on_delete=models.SET_NULL, related_name="subscriptions")
    lead = models.ForeignKey("Lead", null=True, blank=True, on_delete=models.SET_NULL)

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    period = models.CharField(max_length=8, choices=Period.choices, default=Period.MONTH)
    start_date = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    canceled_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)


class SubscriptionPayment(models.Model):
    """Одна строка графика: период → сумма → статус."""
    class Status(models.TextChoices):
        PLANNED = "planned", "Запланирован"
        PAID = "paid", "Оплачен"
        OVERDUE = "overdue", "Просрочен"
        CANCELED = "canceled", "Отменён"

    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE,
                                     related_name="payments")
    period_month = models.CharField(max_length=7)      # "2026-07" — ключ ячейки матрицы
    due_date = models.DateField(db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PLANNED)
    paid_at = models.DateTimeField(null=True, blank=True)
    cash_operation = models.ForeignKey("CashOperation", null=True, blank=True,
                                       on_delete=models.SET_NULL)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["subscription", "period_month"],
                                    name="uniq_subscription_period")
        ]
        indexes = [models.Index(fields=["due_date", "status"])]
```

`period_month` дублирует `due_date` намеренно: матрица группируется строго по
месяцам, а искать по строке дешевле, чем по `TruncMonth` на каждый запрос.

## 5.3. Когда создаётся график

**Единая точка** — функция `create_sale_side_effects(sale)`, вызываемая внутри
одной транзакции при:

- `POST /consalting/sales/` — оформление продажи;
- `POST /consalting/leads/{id}/register-payment/` — оплата по лиду;
- переход лида в выигрыш **в финальной воронке** (см.
  [03-funnel-hierarchy.md](../backend/03-funnel-hierarchy.md), `is_final=True`).

```python
@transaction.atomic
def create_sale_side_effects(sale, *, subscription_enabled=True,
                             subscription_start=None, subscription_amount=None,
                             subscription_period=None):
    # 1. клиент (создаётся/находится выше по стеку)
    # 2. сама продажа уже создана
    # 3. абонентка
    tariff = sale.tariff
    amount = subscription_amount if subscription_amount is not None else (
        tariff.subscription_amount if tariff else 0)
    if subscription_enabled and amount and amount > 0:
        sub, created = Subscription.objects.get_or_create(
            sale=sale, service=sale.service,      # ключ идемпотентности
            defaults=dict(
                company=sale.company, client=sale.client, tariff=tariff,
                lead=sale.lead, amount=amount,
                period=subscription_period or (tariff.subscription_period if tariff else "month"),
                start_date=subscription_start or timezone.localdate(),
                created_by=sale.user,
            ),
        )
        if created:
            generate_schedule(sub, horizon_months=12)
    # 4. зарплата → 02-salary.md
    # 5. заявка в кассу → 03-cash-confirmation.md
```

### Генерация графика

```python
def generate_schedule(sub, horizon_months=12):
    """Плановые платежи вперёд на горизонт. Продлевается ежемесячной задачей."""
    step = relativedelta(months=1) if sub.period == "month" else relativedelta(years=1)
    count = horizon_months if sub.period == "month" else 3   # для года — 3 периода
    due = sub.start_date
    rows = []
    for _ in range(count):
        rows.append(SubscriptionPayment(
            subscription=sub, due_date=due,
            period_month=due.strftime("%Y-%m"), amount=sub.amount,
        ))
        due += step
    SubscriptionPayment.objects.bulk_create(rows, ignore_conflicts=True)
```

Ежедневная задача:

- продлевает график, если до конца горизонта осталось меньше 3 периодов;
- переводит `planned → overdue`, если `due_date < today` и оплаты нет;
- шлёт уведомление ответственному за клиента о просрочке (опционально).

**Годовой тариф**: платёж раз в год, в матрице показывается только в месяце
списания, остальные месяцы года пустые.

## 5.4. Приём оплаты

```
POST /consalting/subscription-payments/{id}/pay/
{ "cashbox": "uuid|null", "payment_method": "cash|transfer", "amount": 5000 }
```

- Создаёт **заявку в кассу** `kind="subscription"`
  ([03-cash-confirmation.md](./03-cash-confirmation.md)); платёж переходит в
  `paid` только после подтверждения (либо сразу, если подтверждение выключено).
- Частичная оплата: если `amount < payment.amount`, допускается создание
  «остатка» — либо запретите (проще) с понятным `detail`.
- Повторная оплата уже оплаченного периода → `400`.

### 5.4a. Оплата нескольких периодов сразу (batch)

Фронт (карточка клиента → «Абонентские платежи» → «Оплатить вперёд N мес.»)
пока платит **циклом** по `subscription-payments/{id}/pay/` — это `N` заявок в
кассу. Нужен один эндпоинт, создающий **одну** заявку на `N` ближайших
`planned/overdue` периодов:

```
POST /consalting/subscriptions/{id}/pay-periods/
{ "count": 3, "cashbox": "uuid|null", "payment_method": "cash|transfer", "note": "" }
```

- Берёт первые `count` неоплаченных периодов графика по `due_date ASC`
  (при `count > осталось` — только сколько есть; при необходимости достраивает
  график).
- Создаёт **одну** `CashRequest` `kind="subscription"` на `count × amount`,
  `period_month` = диапазон `first..last`.
- После подтверждения кассиром все `count` периодов → `paid`,
  `Subscription.paid_through` = `due_date` последнего, `company.end_date`
  продлевается на `count` периодов (один `extend_tenant_subscription`).
- Идемпотентность по `(subscription, first_period, count)` в пределах суток.

Когда появится — фронт заменит цикл на один вызов
(`api/consultingSubscriptions.js` → `paySubscriptionPeriods`).

## 5.5. Что читает фронт

### Карточка клиента

```
GET /consalting/clients/{id}/subscriptions/
```

```jsonc
{
  "results": [
    {
      "id": "sub-1", "service_display": "Внедрение CRM", "tariff_display": "Стандарт",
      "amount": 5000, "period": "month", "period_display": "Ежемесячно",
      "status": "active", "start_date": "2026-03-01",
      "next_payment": { "id": "p-9", "due_date": "2026-08-01", "amount": 5000, "status": "planned" },
      "payments": [
        { "id": "p-1", "period_month": "2026-03", "due_date": "2026-03-01",
          "amount": 5000, "status": "paid", "paid_at": "2026-03-02T11:00:00+06:00" }
      ]
    }
  ]
}
```

### Абонентская матрица

Контракт уже описан в [../subscription-matrix.md](../subscription-matrix.md) —
он не меняется:

```
GET /consalting/subscription-matrix/?month_from=YYYY-MM&month_to=YYYY-MM&search=&page=&page_size=
```

Строка = «клиент × услуга», ячейка = `{ amount, status }` по `period_month`.
Источник данных — те же `SubscriptionPayment`. Добавьте пагинацию строк
(`count`, `results` в поле `rows`) — фронт к ней готов.

## 5.6. Что приходит с фронта дополнительно

`POST /consalting/leads/{id}/register-payment/` теперь получает четыре поля
(фронт уже их шлёт, см. `funnelThunk.registerLeadPayment`):

```jsonc
{
  "payment_mode": "cash|transfer|debt|installment",
  "amount": 45000, "debt_months": 6, "prepayment": 10000, "note": "",

  "subscription_enabled": true,          // менеджер подтвердил подключение / фикс. график
  "subscription_amount": 5000,
  "subscription_period": "month",
  "subscription_start": "2026-08-01",    // дата первого списания
  "subscription_prepaid_periods": 6,     // сколько периодов оплачено вперёд (>=1)
  "subscription_autorenew": false,       // true = подписка, false = фикс. график на N мес.

  "items": [                             // разовые доп. услуги (умные весы и т.п.)
    { "name": "Умные весы", "price": 1200, "quantity": 1 }
  ],
  "paid_months": 3                       // дублирует prepaid_periods в сценарии C
}
```

Если полей нет (старый клиент) — берите абонплату из тарифа, старт = сегодня,
`subscription_prepaid_periods = 1`.

### Три сценария «оплатить за несколько месяцев» из окна оплаты по лиду

Менеджер в `LeadPaymentModal` указывает число месяцев. Что приходит на бэк:

| Сценарий | Условие на фронте | Поля запроса | Что делает бэк |
|---|---|---|---|
| **A. Абонплата тарифа** | у тарифа лида есть `subscription_amount` | `subscription_*` + `subscription_prepaid_periods=N` | `Subscription` из тарифа, первые `N` платежей графика → `paid` |
| **B. Подписка вручную** | тумблер «Вести как подписку» | `subscription_enabled=true`, `subscription_amount=<сумма/мес>`, `subscription_period="month"`, `subscription_start`, `subscription_prepaid_periods=N`, **`subscription_autorenew=true`** | `Subscription` (без тарифа), 12-мес. график, первые `N` → `paid`, **автопродление**, попадает в абонентскую матрицу, после кассы → CRM-аккаунт. `amount` = сумма/мес × `N` |
| **C. Фикс. график за N мес.** | обычная оплата (галочка выкл.), `N > 1` | `subscription_enabled=true`, `subscription_amount=<amount/N>`, `subscription_period="month"`, `subscription_start`, `subscription_prepaid_periods=N`, **`subscription_autorenew=false`**, `paid_months=N` | Создать `Subscription`/график **ровно на `N` периодов**, все `N` → `paid`. **Без автопродления, без абонентской матрицы, без CRM-аккаунта.** `amount` запроса = сумма основной продажи (за `N` мес.) + разовые `items` |

Сценарии B и C — новые. A уже описан выше.

**`subscription_autorenew` (bool, дефолт `true`)** — ключевое различие B и C:

- `true` — полноценная подписка: 12-мес. график с «планируемыми» будущими
  строками, автопродление, строка в абонентской матрице, провижен CRM-аккаунта
  после подтверждения кассой.
- `false` — **фиксированный оплаченный план**: график ровно на
  `subscription_prepaid_periods` периодов, все оплачены, будущих «планируемых»
  строк нет, подписка не продлевается, в матрицу не попадает, CRM-аккаунт
  автоматически не создаётся. Клиент видит график в карточке; отдельных
  «неоплаченных» строк там не будет.
- Поле отсутствует → трактовать как `true` (обратная совместимость со старым
  фронтом).

**Требование продукта (важно):** график в карточке клиента должен появляться
**всегда, когда `N > 1`** — и при галочке «Вести как подписку» (B), и без неё
(C). Разница только в автопродлении/матрице/CRM-аккаунте (управляется
`subscription_autorenew`).

**`paid_months`:** целое ≥ 1, дефолт 1. Метаданные покрытия, дублируют
`subscription_prepaid_periods` в сценарии C. Хранить на `Sale.paid_months`,
отдавать в сериализаторе сделки и в `won`-инфо лида.

### Оплата абонплаты на несколько периодов вперёд

`subscription_prepaid_periods = N` (целое ≥ 1, дефолт 1) — менеджер принял
оплату сразу за N абонентских периодов (месяцев или лет по `period`).

Поведение бэка после `create_sale_side_effects` создал `Subscription` и график:

1. Взять первые `N` строк `SubscriptionPayment` по `due_date ASC`
   (при необходимости достроить график, если `N > horizon`).
2. Пометить их `status="paid"`, `paid_at=now()`, `paid_via="lead_prepayment"`.
3. Создать **одну** заявку в кассу на сумму `N × subscription_amount`
   (`kind="subscription"`, см. [03-cash-confirmation.md](./03-cash-confirmation.md)),
   а не N заявок. `period_month` заявки — диапазон `first..last`.
4. `Subscription.paid_through = <due_date N-й строки>` (для карточки клиента).
5. Идемпотентность: повторный `register-payment` того же лида не оплачивает
   периоды повторно (`get_or_create` по `sale+service` уже защищает график;
   для оплаты периодов — проверка `status != "paid"`).

`N × subscription_amount` **не** входит в `amount` (это сумма основной
продажи/сделки) — абонентская предоплата идёт отдельной строкой кассы.

Валидация: `subscription_prepaid_periods` игнорируется, если
`subscription_enabled=false` или у тарифа нет абонплаты. Значение `< 1` → `1`.

## 5.7. Чек-лист приёмки

- [ ] Продажа с абонентским тарифом создаёт `Subscription` + график платежей.
- [ ] Повторное закрытие того же лида/продажи не создаёт второй график
      (`get_or_create` по `sale+service`).
- [ ] Годовой тариф даёт один платёж в год, а не 12.
- [ ] Просроченный платёж сам переходит в `overdue`.
- [ ] Оплата периода проходит через кассу и меняет статус на `paid`.
- [ ] Карточка клиента и матрица показывают одни и те же суммы.
- [ ] Отмена продажи аннулирует будущие платежи (см. 08).
- [ ] `subscription_prepaid_periods=N` помечает первые N платежей графика
      `paid` и создаёт **одну** заявку в кассу на `N × amount`.
- [ ] Повторный `register-payment` того же лида не оплачивает периоды дважды.
- [ ] `subscription_prepaid_periods` без абонплаты / при `enabled=false` — игнор.
- [ ] Сценарий B (`subscription_autorenew=true`): `subscription_amount` без
      тарифа создаёт `Subscription`, 12-мес. график, автопродление, строка в
      матрице, `amount` = сумма/мес × N.
- [ ] Сценарий C (`subscription_autorenew=false`): создаётся график **ровно на
      N периодов**, все `paid`; нет автопродления, нет строки в матрице, нет
      CRM-аккаунта. График виден в карточке клиента.
- [ ] `subscription_autorenew` отсутствует → трактуется как `true`.
- [ ] `N > 1` → график создаётся **и с галочкой, и без неё** (различие — только
      автопродление/матрица/CRM).
- [ ] `items` при `subscription_autorenew=false` — разовые строки чека, в
      `subscription_amount` не входят.
- [ ] §5.8 `POST /subscriptions/{id}/extend/` дописывает `periods` строк
      после хвоста существующего графика (без дыр/дублей дат).
- [ ] §5.8 `extend` с `amount` — обновляет и новые строки, и
      `Subscription.amount` для последующих автопродлений.
- [ ] §5.8 `PATCH /subscriptions/{id}/` с `amount` — меняет только
      `planned`/`overdue` строки, `paid` остаются с прежней суммой.
- [ ] §5.8 Сквозной сценарий: клиент оплатил все периоды до конца горизонта →
      «Продлить на 12 мес.» → в графике появляются новые `planned`-строки по
      той же (или новой) цене, старые `paid`-строки не изменились.

## 5.8. Ручное продление графика и изменение цены (обновлено 12.09.2026)

**Фронт:** `client/ConsultingClientDetail.jsx` → кнопка «Управлять графиком»
рядом с заголовком «Абонентские платежи».

### 5.8.1. Проблема

Автопродление графика (`generate_schedule` + ежедневная задача из §5.3)
рассчитано на скользящий горизонт в 12 периодов. На практике владелец видит
календарь только на уже сгенерированные месяцы вперёд — когда последний
показанный период оплачен (например, клиент оплатил всё до конца года),
календарь упирается в потолок и новых ячеек не появляется, пока не отработает
фоновая задача (а она может быть не настроена/не задеплоена). Нужна ручная
кнопка «Продлить график», не завязанная на крон.

Отдельно: цена абонентки на момент продажи могла быть согласована ниже
рыночной, и её нужно повышать для будущих периодов без пересоздания
подписки и без изменения уже оплаченных месяцев.

### 5.8.2. Продление графика

```
POST /consalting/subscriptions/{id}/extend/
{ "periods": 12, "amount": 2000 }   // amount опционален
```

- `periods` — целое ≥ 1 (пресеты на фронте: 3/6/12), сколько ещё строк
  `SubscriptionPayment` дописать.
- Точка отсчёта — `due_date` **последней существующей** строки графика этой
  подписки (`SubscriptionPayment.objects.filter(subscription=sub).order_by("-due_date").first()`),
  не сегодняшняя дата — иначе при продлении с разрывом (клиент не платил
  несколько месяцев, есть `overdue`) образуется дырка или дублирование дат.
  Шаг — `relativedelta(months=1)` или `years=1)` по `sub.period`, как в
  `generate_schedule` (§5.3) — переиспользуйте эту функцию с параметром
  `start_after=last_row.due_date`.
- `amount` (опционально) — если передан, новые строки создаются с этой
  ценой **и** одновременно обновляется `Subscription.amount` (следующая
  автогенерация тоже пойдёт по новой цене). Если не передан — берётся
  текущий `Subscription.amount`.
- Доступ: `canManageConsultingLeadFinance` (owner/admin/rop либо
  `can_manage_lead_ad_spend`) — та же проверка, что на «Оплатить вперёд».
- Ответ — обновлённый объект подписки с полным `payments[]` (тот же формат,
  что в §5.5), фронт просто перезапрашивает
  `GET /consalting/clients/{id}/subscriptions/` после вызова.
- Идемпотентность не нужна: каждый вызов детерминированно достраивает
  график от текущего хвоста, повторный вызов просто продлит ещё дальше —
  это ожидаемое поведение (не защита от даблклика, а обычное «продлить ещё»).
- `404` — если у компании выключен `consulting cash v2`; `403` — если
  подписка `canceled`/`finished`.

### 5.8.3. Изменение цены будущих периодов

```
PATCH /consalting/subscriptions/{id}/
{ "amount": 2000 }
```

- Обновляет `Subscription.amount` **и** все строки `SubscriptionPayment` со
  статусом `planned`/`overdue` (ещё не оплаченные) — их `amount` заменяется
  на новое значение.
- Строки со статусом `paid` (и `canceled`) не трогаются — история платежей
  сохраняет фактически уплаченные суммы.
- Если у подписки нет ни одной `planned`/`overdue` строки (всё оплачено,
  график не продлён) — метод всё равно обновляет `Subscription.amount`,
  чтобы следующая генерация/продление шли по новой цене.
- Валидация: `amount > 0`, иначе `400`.
- Доступ — тот же `canManageConsultingLeadFinance`.

### 5.8.4. Что уже делает фронт

- Кнопка «Управлять графиком» видна при `isConsultingCashV2()` и наличии
  хотя бы одной не отменённой подписки клиента; открывает модалку с двумя
  независимыми секциями (продлить / изменить цену).
- Под таблицей календаря — подсказка «Все показанные периоды оплачены…»,
  когда `payableRows.length === 0`, чтобы подсказать про кнопку продления.
- После продления/смены цены — просто `reload()` карточки клиента (без
  оптимистичного обновления календаря).
- `api/consultingSubscriptions.js` → `extendSubscriptionSchedule(id, { periods, amount })`,
  `updateSubscriptionAmount(id, { amount })`.

### 5.8.5. Не в этой итерации

- Групповое продление/изменение цены сразу для всех подписок компании.
- Понижение цены задним числом для уже оплаченных периодов (сознательно не
  делаем — это отдельная операция «корректировка платежа», не эта форма).
- Уведомление клиента об изменении цены (email/SMS) — не входит в контракт.
