# 3. Иерархия воронок: цепочка обработки лида

**Фронт:** `Funnel/Funnel.jsx` → `FunnelForm` (блок «Что дальше»),
`LeadTransferModal.jsx` (ручная передача остаётся).
**Смежное:** [../funnel-crm-logic.md](../funnel-crm-logic.md) — жизненный цикл
лида и сайд-эффекты завершения.

## 3.1. Задача

Воронки не связаны между собой: чтобы передать лид дальше, менеджер вручную
выбирает воронку и стадию. Процесс держится на памяти сотрудников, лиды
застревают, руководитель не видит, на каком уровне теряются клиенты.

Нужна настраиваемая цепочка: завершил лид в воронке → он автоматически появился
в следующей, на нужной стадии, у нужного человека.

## 3.2. Изменения модели

```python
class Funnel(models.Model):
    class NextAssign(models.TextChoices):
        KEEP = "keep", "Оставить текущего ответственного"
        POOL = "pool", "Вернуть в общий пул"
        AUTO = "auto", "Распределить автоматически"
        USER = "user", "Назначить конкретному сотруднику"

    # --- НОВЫЕ ПОЛЯ ---
    next_funnel = models.ForeignKey("self", null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="prev_funnels")
    next_stage = models.ForeignKey("FunnelStage", null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="+")
    next_assign = models.CharField(max_length=8, choices=NextAssign.choices,
                                   default=NextAssign.KEEP)
    next_assign_user = models.ForeignKey(User, null=True, blank=True,
                                         on_delete=models.SET_NULL, related_name="+")
    is_final = models.BooleanField(default=True)      # оформляет продажу
    stage_sla_hours = models.PositiveIntegerField(null=True, blank=True)


class LeadFunnelHistory(models.Model):
    """Путь лида: где был, кто вёл, сколько времени."""
    lead = models.ForeignKey("Lead", on_delete=models.CASCADE, related_name="funnel_history")
    funnel = models.ForeignKey(Funnel, on_delete=models.CASCADE)
    stage = models.ForeignKey("FunnelStage", null=True, on_delete=models.SET_NULL)
    owner = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    entered_at = models.DateTimeField(default=timezone.now)
    left_at = models.DateTimeField(null=True, blank=True)
    transition = models.CharField(max_length=16, default="auto")   # auto | manual | initial
```

`FunnelStage` дополняется `sla_hours` (перекрывает `funnel.stage_sla_hours`) и
`entered_at` на карточке лида — чтобы считать просрочку по стадии.

Валидация при сохранении воронки:

- `next_funnel != self` → `400` «Воронка не может быть следующей для самой себя».
- Цепочка не должна образовывать цикл: пройти по `next_funnel` до `None`, при
  повторе id → `400` «Цепочка воронок зациклена».
- `next_stage` должна принадлежать `next_funnel` → иначе `400`.
- `next_assign="user"` без `next_assign_user` → `400`.
- Если `next_funnel` задан, `is_final` по умолчанию `False`; если не задан —
  принудительно `True` (последняя воронка всегда финальная).

## 3.3. Ключевое правило: продажу оформляет только финальная воронка

Сейчас любой «успех» в любой воронке трактуется как продажа — отсюда задвоенные
сделки и расхождения в отчётах.

```python
@transaction.atomic
def on_lead_won(lead, *, user):
    funnel = lead.funnel
    if funnel.is_final:
        create_sale_side_effects(...)        # сделка, абонентка, зарплата, касса
        lead.status = "won"
        lead.save()
    else:
        move_lead_to_next_funnel(lead, funnel, user=user)
```

В промежуточной воронке «успех» означает **«передан дальше»**, а не «продано».

## 3.4. Переход по цепочке

```python
@transaction.atomic
def move_lead_to_next_funnel(lead, funnel, *, user, transition="auto"):
    target = funnel.next_funnel
    if not target:
        return
    stage = funnel.next_stage or target.stages.order_by("order").first()

    LeadFunnelHistory.objects.filter(lead=lead, left_at__isnull=True).update(
        left_at=timezone.now())

    if funnel.next_assign == Funnel.NextAssign.POOL:
        lead.owner = None
    elif funnel.next_assign == Funnel.NextAssign.USER:
        lead.owner = funnel.next_assign_user
    elif funnel.next_assign == Funnel.NextAssign.AUTO:
        lead.owner = pick_recipient(lead.company)     # те же правила, что у inbound-лидов
    # KEEP — владелец не меняется

    lead.funnel = target
    lead.stage = stage
    lead.status = "in_progress"
    lead.stage_entered_at = timezone.now()
    lead.save()

    LeadFunnelHistory.objects.create(
        lead=lead, funnel=target, stage=stage, owner=lead.owner, transition=transition)

    if lead.owner:
        notify_user(lead.owner, "consulting.lead.moved_to_funnel", {...})
    broadcast_board_update(target.id)
```

**Что переносится вместе с лидом:** клиент, переписка (сообщения привязаны к
лиду, а не к воронке), комментарии, сумма, услуга/тариф, вложения. Ничего не
копируется — это тот же самый объект `Lead`, меняются только `funnel`/`stage`.

Триггер перехода: завершение лида (`win`) **или** перенос на завершающую стадию
воронки. Ручная передача (`LeadTransferModal`) остаётся и работает как раньше —
она пишет `transition="manual"` в историю.

## 3.5. SLA стадии

- На карточке лида — `stage_entered_at`.
- Просрочка: `now() - stage_entered_at > (stage.sla_hours or funnel.stage_sla_hours)`.
- В выдаче доски добавьте флаг `is_sla_overdue` — фронт подсветит карточку.
- Просрочки идут в аналитику сотрудника как «дисциплина»
  ([06-employee-card.md](./06-employee-card.md)).

## 3.6. Эндпоинты

Отдельных не нужно — поля добавляются в существующие:

```
POST /consalting/funnels/            # + next_funnel, next_stage, next_assign,
PATCH /consalting/funnels/{id}/      #   next_assign_user, is_final, stage_sla_hours
GET  /consalting/funnels/            # отдаёт те же поля + next_funnel_display
```

Новый — история пути:

```
GET /consalting/leads/{id}/funnel-history/
```

```jsonc
{ "results": [
  { "funnel": "uuid", "funnel_display": "Первичная обработка",
    "stage_display": "Квалификация", "owner_display": "Менеджер А",
    "entered_at": "2026-07-20T10:00:00+06:00",
    "left_at": "2026-07-22T15:30:00+06:00",
    "duration_hours": 53.5, "transition": "auto" }
] }
```

## 3.7. Права

- Настраивать цепочку (`next_*`, `is_final`, SLA) — `owner`/`admin`.
- Автопереход выполняется от имени системы, права сотрудника не проверяются:
  он завершил лид легально, дальше решает настройка.
- Если у сотрудника нет доступа к целевой воронке, лид всё равно переходит —
  просто пропадает из его видимости (это ожидаемое поведение).

## 3.8. Чек-лист приёмки

- [ ] Завершение лида в промежуточной воронке НЕ создаёт продажу.
- [ ] Лид появляется в следующей воронке на заданной стадии с заданным
      ответственным.
- [ ] Переписка и клиент сохраняются, дублей лида не возникает.
- [ ] Ответственный получает персональное уведомление.
- [ ] Попытка зациклить цепочку → `400`.
- [ ] `GET /leads/{id}/funnel-history/` показывает путь с длительностями.
- [ ] Просроченный по SLA лид помечен флагом в выдаче доски.
- [ ] Единственная воронка без `next_funnel` остаётся финальной и оформляет
      продажу как раньше.
