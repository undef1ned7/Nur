# 6. Региональные воронки и автораспределение лидов

**ТЗ:** «Доработка логики и автоматизация CRM», блок 1 (День 1).  
**Страницы:** `/crm/consulting/funnel`, `/crm/consulting/leads?tab=settings`  
**Фронт:** `Funnel/Funnel.jsx`, `leads/LeadsDistribution.jsx`, `api/consultingLeads.js`

## 6.1. Задача

1. Три **региональные воронки продаж**: Бишкек, Ош, Джалал-Абад.
2. **Автораспределение** inbound: назначить ответственного и положить лид в
   воронку города (гео → источник → round-robin).
3. Воронка **«Внедрение»**: автоматический перенос из региональной воронки
   после «Оплачено» (`register-payment`).

См. также [../backend/03-funnel-hierarchy.md](../backend/03-funnel-hierarchy.md).

---

## 6.2. Модель

```python
class RegionalFunnelRouting(models.Model):
    company = models.OneToOneField(Company, on_delete=models.CASCADE)
    enabled = models.BooleanField(default=False)
    fallback_strategy = models.CharField(max_length=16, default="round_robin")
    # round_robin | default_funnel
    default_funnel = models.ForeignKey("Funnel", null=True, on_delete=models.SET_NULL)
    _rr_cursor = models.PositiveIntegerField(default=0)


class RegionalFunnelRule(models.Model):
    routing = models.ForeignKey(RegionalFunnelRouting, related_name="rules")
    funnel = models.ForeignKey("Funnel", on_delete=models.CASCADE)
    region_code = models.CharField(max_length=32)  # bishkek | osh | jalal_abad
    phone_prefixes = models.JSONField(default=list)
    wazzup_account_ids = models.JSONField(default=list)
    source_channels = models.JSONField(default=list)  # whatsapp|instagram|telegram
    assign_role_ids = models.JSONField(default=list)
    assign_strategy = models.CharField(max_length=16, default="round_robin")
```

| `region_code` | Город | Стартовые префиксы телефона* |
|---|---|---|
| `bishkek` | Бишкек | `+996312`, `+996313`, `+996555`… |
| `osh` | Ош | `+996322`, `+996323`… |
| `jalal_abad` | Джалал-Абад | `+996772`, `+996882`… |

\*Настраиваются в UI; таблица — дефолты.

---

## 6.3. Алгоритм inbound (webhook / создание Lead)

```text
1. Resolve company
2. IF NOT RegionalFunnelRouting.enabled:
     → поведение 1A (main funnel), см. ../backend-main-funnel-inbound.md
3. funnel = resolve_funnel_by_rules(phone, wazzup_account_id, source)
     a) phone_prefix (longest wins)
     b) wazzup_account_id in rule.wazzup_account_ids
     c) source in rule.source_channels
4. IF funnel is None:
     IF fallback_strategy == default_funnel → routing.default_funnel
     ELIF fallback_strategy == round_robin → next rule.funnel from RR cursor
5. stage = first stage of funnel (order=0)
6. Lead.create(funnel=funnel, stage=stage, owner=null, …)
7. assign_owner_within_region(lead, rule)  # RR / least_loaded по assign_role_ids
8. WS: lead.created + lead.assigned
```

**Инварианты:**

- Inbound не кладётся на ролевую воронку SMM, если она не в rules.
- Повторное сообщение того же чата **не меняет** `funnel`.
- Параллельный inbound → RR под `select_for_update`.

---

## 6.4. API

```
GET  /consalting/regional-funnel-routing/
PUT  /consalting/regional-funnel-routing/
```

```jsonc
{
  "enabled": true,
  "fallback_strategy": "round_robin",
  "default_funnel_id": "uuid|null",
  "rules": [
    {
      "funnel_id": "uuid",
      "region_code": "bishkek",
      "phone_prefixes": ["+996312", "+996555"],
      "wazzup_account_ids": [],
      "source_channels": ["whatsapp"],
      "assign_role_ids": ["role-uuid"],
      "assign_strategy": "round_robin"
    }
  ]
}
```

Ответ: `funnel_display`, `region_label` для UI. При `404/501` фронт — заглушка.

### Связь с `lead-distribution`

| Настройка | Область |
|---|---|
| `lead-distribution` | Глобальный fallback owner |
| `regional-funnel-routing` | **Какую воронку** + локальный пул ролей |

Приоритет: **регион** → глобальное распределение → manual (пул).

---

## 6.5. «Оплачено» → воронка «Внедрение»

После успешного `POST /consalting/leads/{id}/register-payment/`:

```python
@transaction.atomic
def on_register_payment(lead, payment, *, user):
    create_sale_side_effects(...)   # см. 01-subscription.md
    lead.payment_registered = True
    lead.save()

    funnel = lead.funnel
    if funnel.next_funnel_id and not funnel.is_final:
        move_lead_to_next_funnel(lead, funnel, user=user, transition="payment")
```

| Событие | Промежуточная воронка (`is_final=false`) |
|---|---|
| `win` / drag на «Завершено» | Переход **без** продажи |
| `register-payment` | Продажа **+** переход в `next_funnel` |

**Не** дублировать `Sale` при `move_lead_to_next_funnel`.

Ответ `register-payment` должен содержать обновлённый `lead` с `funnel`, `stage` —
фронт обновит доски без второго `win`.

---

## 6.5a. Обязательные стадии у КАЖДОЙ воронки `[LIVE-BUG]`

**Симптом на проде (09.09.2026):** региональные воронки «Ош» и «Бишкек»
созданы с `"stages": []`. Последствия:

- `GET /consalting/funnels/{osh}/board/` → нет колонок → лиды с `stage=null`
  **не видны** на доске (фронт показывает «Нет стадий»); лид «пропадает».
- `POST /consalting/leads/{id}/win/` → `400 {"detail":"В воронке нет
  WON-стадии."}` — цепочка `Ош → Бишкек` (`next_funnel` задан, `is_final=false`)
  не срабатывает.
- `register-payment` проходит (`201`, `deal_id`), но `lead.funnel` не меняется —
  переход `move_lead_to_next_funnel` не выполнен.

**Требования:**

1. При создании **любой** воронки (main / role / custom / региональная, через
   `POST /funnels/`, `for-role/`, автосоздание регионов из
   `regional-funnel-routing`) — сразу создавать 3 системные стадии
   `intake` (`stage_type=new_lead`, order 0), `in_progress` (`nurture`, 1),
   `completed` (`stage_type=won`, `system_key=completed`, `is_success=true`, 2).
2. Миграция/management-команда: добить стадии всем воронкам компании, где
   `stages == []`; лиды с `stage=null` привязать к `intake`.
3. Кастомные стадии, названные «Завершено», но с `stage_type=new_lead`
   (как в «Джалал-Абад») — не считаются WON. Нужна ровно одна стадия с
   `stage_type=won` / `system_key=completed` на воронку; при отсутствии —
   создать.
4. `board/` при пустых `columns` всё равно возвращает лиды воронки в
   `unassigned` (fallback-колонка «Без стадии» на фронте уже есть).
5. `POST /leads/{id}/win/` в промежуточной воронке (`next_funnel` задан) —
   если своей WON-стадии нет, **не** отвечать `400`, а выполнять
   `move_lead_to_next_funnel` (то же, что `register-payment`), либо вернуть
   `409` с понятным `detail` и не терять лид.
6. `register-payment` в промежуточной региональной воронке должен сам
   переносить лид в `next_funnel` (см. §6.5) — фронт больше не вызывает `win`
   как фолбэк, если в воронке нет WON-стадии.

**Чек-лист:**

- [ ] Новая воронка любого типа создаётся с 3 системными стадиями.
- [ ] У «Ош»/«Бишкек» после миграции есть `intake`/`in_progress`/`completed`.
- [ ] `board/` пустой воронки с лидами отдаёт их в `unassigned`.
- [ ] `win` в промежуточной воронке без WON-стадии не роняет `400`.
- [ ] `register-payment` в «Ош» переносит лид в «Бишкек» (`next_funnel`).

## 6.6. Чек-лист приёмки

### Inbound
- [ ] WA с номером Бишкека → воронка Бишкек + owner из RR.
- [ ] Неизвестный регион → RR между тремя воронками.
- [ ] Wazzup-аккаунт «Ош» → воронка Ош.

### Оплата → внедрение
- [ ] `register-payment` создаёт **одну** сделку ([01-subscription.md](./01-subscription.md)).
- [ ] Лид в «Внедрение» на `next_stage`.
- [ ] Повторная оплата не дублирует sale и не переносит повторно.

### Права
- [ ] Менеджер Бишкека не видит чужие регионы ([07-seller-access-isolation.md](./07-seller-access-isolation.md)).
