# 1. Лиды: очередь, отложенные, счётчики, аналитика

**Фронт:** `src/Components/Sectors/Consulting/leads/` (Leads.jsx, LeadsInbox.jsx,
LeadsAnalytics.jsx, modals/), API-слой `src/api/consultingLeads.js`.
**Базовая модель `InboundLead`** уже описана в
[../leads-whatsapp.md](../leads-whatsapp.md) — здесь только дополнения.

## 1.1. Изменения модели

```python
class InboundLead(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "Новый"
        ASSIGNED = "assigned", "Назначен"
        IN_WORK = "in_work", "В работе"
        DEFERRED = "deferred", "Отложен"        # НОВОЕ
        CONVERTED = "converted", "Купил"
        REJECTED = "rejected", "Отказ"

    class DeferReason(models.TextChoices):
        NO_ANSWER_CALL = "no_answer_call", "Не взял трубку"
        NO_ANSWER_CHAT = "no_answer_chat", "Не ответил в переписке"
        CALL_LATER = "call_later", "Просил перезвонить позже"
        THINKING = "thinking", "Думает / советуется"
        NO_MONEY = "no_money", "Нет денег сейчас"
        OTHER = "other", "Другое"

    class RejectReason(models.TextChoices):
        EXPENSIVE = "expensive", "Дорого"
        COMPETITOR = "competitor", "Ушёл к конкуренту"
        NO_NEED = "no_need", "Не актуально"
        NO_CONTACT = "no_contact", "Не выходит на связь"
        SPAM = "spam", "Спам / нецелевой"
        OTHER = "other", "Другое"

    # --- НОВЫЕ ПОЛЯ ---
    remind_at = models.DateTimeField(null=True, blank=True, db_index=True)
    defer_reason = models.CharField(max_length=32, choices=DeferReason.choices, blank=True)
    defer_comment = models.TextField(blank=True)
    defer_count = models.PositiveIntegerField(default=0)   # сколько раз откладывали
    deferred_at = models.DateTimeField(null=True, blank=True)
    reminded_at = models.DateTimeField(null=True, blank=True)  # когда отправили напоминание

    reject_reason = models.CharField(max_length=32, choices=RejectReason.choices, blank=True)
    reject_comment = models.TextField(blank=True)

    first_reply_at = models.DateTimeField(null=True, blank=True)  # первый ИСХОДЯЩИЙ ответ
    converted_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    sale = models.ForeignKey("Sale", null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        indexes = [
            models.Index(fields=["company", "status", "created_at"]),
            models.Index(fields=["company", "owner", "status"]),
            models.Index(fields=["company", "status", "remind_at"]),
        ]
```

`first_reply_at` заполняется один раз — при первом исходящем сообщении по лиду
(webhook/отправка из чата). На нём строится метрика «время до первого ответа».

## 1.2. Список лидов

```
GET /consalting/inbound-leads/
```

| Параметр | Тип | Поведение |
|---|---|---|
| `status` | str | одно значение или список через запятую: `new,assigned` → `status__in` |
| `owner` | uuid \| `none` | `none` = `owner__isnull=True` |
| `source` | str | whatsapp / instagram / telegram / manual |
| `search` | str | icontains по `full_name`, `phone`, `message` |
| `date_from`, `date_to` | date | по `created_at` (дата получения лида) |
| `overdue` | `true` | только `status=deferred AND remind_at <= now()` |
| `page`, `page_size`, `ordering` | | по умолчанию `-created_at` |

Элемент выдачи (дополнен новыми полями):

```jsonc
{
  "id": "…", "full_name": "Иван", "phone": "+996700…",
  "source": "whatsapp", "message": "Здравствуйте…",
  "owner": "user-uuid|null", "owner_display": "Менеджер А",
  "status": "deferred", "status_display": "Отложен",
  "created_at": "2026-07-29T10:12:00+06:00",
  "lead": "funnel-lead-uuid|null",

  "remind_at": "2026-07-30T10:00:00+06:00",
  "defer_reason": "call_later",
  "defer_reason_display": "Просил перезвонить позже",
  "defer_comment": "после отпуска",
  "defer_count": 2,
  "is_overdue": false
}
```

`is_overdue` считайте на сервере (`remind_at <= now()`), фронт умеет и сам, но
серверное значение приоритетнее.

**Права:** сотрудник видит только `owner=self`; параметр `owner` для него
игнорируется (не 403 — просто фильтр по себе).

## 1.3. Действия над лидом

Все — `POST`, возвращают обновлённый объект лида (тот же сериализатор, что в
списке).

### Отложить

```
POST /consalting/inbound-leads/{id}/defer/
{ "remind_at": "2026-07-30T10:00:00+06:00", "reason": "call_later", "comment": "" }
```

Логика:

1. Валидация: `remind_at` обязателен и должен быть в будущем (допуск 1 мин);
   `reason` обязателен; при `reason="other"` обязателен непустой `comment`.
2. `status = deferred`, `deferred_at = now()`, `defer_count += 1`,
   `reminded_at = None`.
3. Нельзя откладывать лид в статусе `converted`/`rejected` → `400`
   «Лид уже закрыт».
4. Событие `consulting.lead.deferred` владельцу (для обновления списка).

### Вернуть в работу

```
POST /consalting/inbound-leads/{id}/resume/
{}
```

`status = in_work`, `remind_at = None`. `defer_count` **не сбрасывается** — это
история, по ней видно «пылесосы», которые бесконечно откладывают.

### Купил

```
POST /consalting/inbound-leads/{id}/won/
{ "sale": "sale-uuid|null" }   // необязательно
```

`status = converted`, `converted_at = now()`, `closed_at = now()`, если передан
`sale` — связываем. Сама продажа оформляется в разделе «Продажи» или на воронке;
этот эндпоинт только помечает лид.

### Отказ

```
POST /consalting/inbound-leads/{id}/lost/
{ "reason": "expensive", "comment": "" }
```

`reason` обязателен (при `other` — обязателен `comment`), `status = rejected`,
`closed_at = now()`.

## 1.4. Счётчики табов

```
GET /consalting/inbound-leads/counters/
```

Принимает **те же фильтры**, что список, **кроме `status`** (`owner`, `source`,
`search`, `date_from`, `date_to`). Возвращает:

```jsonc
{
  "all": 128,
  "new": 14,          // status IN (new, assigned) — фронт объединяет их в таб «Новые»
  "in_work": 31,
  "deferred": 22,
  "converted": 47,
  "rejected": 14,
  "overdue": 5        // из deferred: remind_at <= now()
}
```

Один запрос, одна агрегация (`aggregate` с `Count(Case(When(...)))`), без N+1.

## 1.5. Аналитика по лидам

```
GET /consalting/inbound-leads/analytics/?date_from=&date_to=&owner=&source=
```

**Ключевое правило — когортный принцип.** Лид попадает в период по
`created_at` (когда пришёл), а не по дате покупки. «Конверсия за июль» =
«из июльских лидов купили столько-то», даже если оплата прошла в августе.
Все разрезы строятся по одной и той же когорте.

```jsonc
{
  "totals": {
    "leads": 128,
    "new": 14, "in_work": 31, "deferred": 22, "overdue": 5,
    "converted": 47, "rejected": 14,
    "conversion": 36.72,              // converted / leads * 100
    "revenue": 1250000,               // сумма НЕотменённых продаж по этим лидам
    "avg_check": 26595.74,
    "first_reply_avg_minutes": 42.5,  // avg(first_reply_at - created_at)
    "time_to_sale_avg_minutes": 4320  // avg(converted_at - created_at)
  },
  "by_source": [
    { "source": "whatsapp", "leads": 80, "converted": 30, "conversion": 37.5, "revenue": 820000 }
  ],
  "by_user": [
    { "user": "uuid", "name": "Менеджер А", "leads": 40, "in_work": 8,
      "deferred": 6, "overdue": 2, "converted": 15, "conversion": 37.5, "revenue": 410000 }
  ],
  "by_day": [
    { "date": "2026-07-01", "leads": 6, "converted": 2 }
  ],
  "defer_reasons":  [ { "reason": "call_later", "count": 12 } ],
  "reject_reasons": [ { "reason": "expensive",  "count": 9 } ]
}
```

Уточнения:

- `revenue` считается по связанным продажам **за вычетом отменённых и
  возвратов** (см. [08-sale-cancel.md](./08-sale-cancel.md)). Отменённая продажа
  также **не считается** конверсией: если продажа по лиду отменена, лид
  возвращается из `converted` (см. `lead_action` в отмене).
- `by_day` — только дни внутри периода, включая дни с нулями (фронт рисует
  график и ждёт непрерывный ряд).
- Средние времена — в минутах, `null` если данных нет.
- Сотруднику отдаём только его срез (`by_user` из одной строки).

## 1.6. Напоминания по отложенным

Периодическая задача (Celery beat, раз в 5 минут):

```python
qs = InboundLead.objects.filter(
    status=InboundLead.Status.DEFERRED,
    remind_at__lte=timezone.now(),
    reminded_at__isnull=True,
)
for lead in qs.select_related("owner"):
    notify_user(lead.owner, event="consulting.lead.remind", payload={...})
    lead.reminded_at = timezone.now()
```

- Уведомление получает **только владелец** лида, не вся компания.
- Статус при этом **не меняется** — лид остаётся в «Отложенных», но становится
  `is_overdue=true` и поднимается в списке. Так менеджер не теряет очередь
  отложенных.
- Повторно не шлём (`reminded_at` — защита от дублей).

## 1.7. События реалтайма

| Событие | Кому | Когда |
|---|---|---|
| `consulting.lead.assigned` | новому владельцу | назначение / авто-раздача |
| `consulting.lead.deferred` | владельцу | отложен |
| `consulting.lead.remind` | владельцу | наступил срок напоминания |
| `consulting.lead.closed` | владельцу | купил / отказ |

## 1.8. Чек-лист приёмки

- [ ] `status=new,assigned` возвращает объединённую выборку.
- [ ] `owner=none` возвращает неназначенные лиды.
- [ ] Сотрудник видит только свои лиды при любых значениях `owner`.
- [ ] `defer` с прошедшей датой → `400`; с `reason=other` без комментария → `400`.
- [ ] `defer_count` растёт при каждом откладывании и не сбрасывается при resume.
- [ ] `counters` учитывают активные фильтры и совпадают с `count` списка по
      каждому статусу.
- [ ] `analytics` считает когорту по `created_at`; отменённая продажа не
      попадает ни в `revenue`, ни в `converted`.
- [ ] Напоминание приходит один раз и только владельцу.
