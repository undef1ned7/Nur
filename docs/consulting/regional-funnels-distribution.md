# Консалтинг — региональные воронки и автораспределение лидов

> **Спека для бэкенда:** [backend-money-tenant/06-regional-funnels-routing.md](./backend-money-tenant/06-regional-funnels-routing.md)  
> Сквозной сценарий: [backend-money-tenant/scenario-crm-automation.md](./backend-money-tenant/scenario-crm-automation.md)

**Страницы:** `/crm/consulting/funnel`, `/crm/consulting/leads?tab=settings`  
**Фронт:** `Funnel/Funnel.jsx`, `leads/LeadsDistribution.jsx`, `api/consultingLeads.js`  
**Статус:** UI настроек и цепочка «оплата → внедрение» на фронте готовы как
контракт + fallback; **маршрутизация inbound по городу** — задача бэкенда.

## 1. Задача

1. Три **региональные воронки продаж**: Бишкек, Ош, Джалал-Абад.
2. **Автораспределение** входящих лидов: назначить ответственного и положить
   карточку в воронку города (гео → источник → round-robin).
3. Воронка **«Внедрение»**: автоматический перенос из региональной воронки
   после статуса «Оплачено» (`register-payment`).

## 2. Что уже есть на фронте

| Возможность | Где |
|---|---|
| Создание воронок, стадий | Воронка → «+ Воронка», «+ Стадия» |
| Цепочка «что дальше» (`next_funnel`, `next_stage`, `next_assign`) | `FunnelForm` → блок «Что дальше» |
| Round-robin / least-loaded **по owner** (без выбора воронки) | Лиды → Распределение |
| Оформление оплаты | Карточка лида → «Оформить оплату» → `register-payment` |
| Fallback: после оплаты вызов `win` для перехода по цепочке | `LeadDetail` (если бэк не перенёс сам) |

**Ограничение текущего продукта (1A):** inbound из WhatsApp кладётся только на
**главную** воронку (`is_main`). Для региональной модели нужно расширение бэка
(§4) — **главная** становится диспетчером или снимается с inbound.

## 3. Ручная настройка (можно сделать сейчас в UI)

### 3.1. Создать воронки

В `/crm/consulting/funnel` (owner/admin) → **+ Воронка**:

| Воронка | `is_main` | `is_final` | Стадии (пример) |
|---|---|---|---|
| Бишкек | нет | нет | Новый → КП → Переговоры → Оплачено |
| Ош | нет | нет | то же |
| Джалал-Абад | нет | нет | то же |
| **Внедрение** | нет | **да** | Договор → Настройка → Запуск → Завершено |

Снять флаг «Главная воронка» с «Основной» **после** включения региональной
маршрутизации на бэке (или оставить main как буфер «неопределённый регион»).

### 3.2. Цепочка «регион → внедрение»

Для **каждой** региональной воронки: **Изменить** → блок **«Что дальше»**:

- **Следующая воронка:** «Внедрение»
- **Стадия:** первая стадия внедрения (например «Договор»)
- **Кому назначить:** «Распределить автоматически» (отдел внедрения) или
  конкретный координатор
- **Финальная воронка:** снята (`is_final = false`) — продажа оформляется
  **до** перехода через «Оформить оплату», внедрение не дублирует сделку

### 3.3. Распределение менеджеров по регионам

Пока бэк не отдаёт per-region pools — через **роли**:

1. Создать роли «Продажи Бишкек», «Продажи Ош», «Продажи Джалал-Абад».
2. Назначить сотрудникам роли и `funnel_grants` на свою региональную воронку.
3. Лиды → **Распределение**: round-robin среди ролей (временно **общий** пул,
   пока не задеплоен §4).

## 4. Бэкенд: маршрутизация inbound по региону

### 4.1. Модель

```python
class RegionalFunnelRouting(models.Model):
    """Настройки компании: куда класть inbound."""
    company = models.OneToOneField(Company, on_delete=models.CASCADE)
    enabled = models.BooleanField(default=False)
    # Если гео и источник не сработали — куда класть лид
    fallback_strategy = models.CharField(max_length=16, default="round_robin")
    # round_robin | default_funnel
    default_funnel = models.ForeignKey("Funnel", null=True, on_delete=models.SET_NULL)
    _rr_cursor = models.PositiveIntegerField(default=0)


class RegionalFunnelRule(models.Model):
    routing = models.ForeignKey(RegionalFunnelRouting, related_name="rules")
    funnel = models.ForeignKey("Funnel", on_delete=models.CASCADE)
    region_code = models.CharField(max_length=32)  # bishkek | osh | jalal_abad
    # Опционально: несколько правил на одну воронку
    phone_prefixes = models.JSONField(default=list)   # ["+996312", "+996555"]
    wazzup_account_ids = models.JSONField(default=list)  # uuid аккаунтов Wazzup
    source_channels = models.JSONField(default=list)  # whatsapp|instagram|telegram
    assign_role_ids = models.JSONField(default=list)  # роли для RR внутри региона
    assign_strategy = models.CharField(max_length=16, default="round_robin")
```

Коды регионов (константа, совпадает с фронтом):

| `region_code` | Город | Типичные префиксы телефона* |
|---|---|---|
| `bishkek` | Бишкек | `+996312`, `+996313`, `+996555`, `+996700`… |
| `osh` | Ош | `+996322`, `+996323`… |
| `jalal_abad` | Джалал-Абад | `+996772`, `+996882`… |

\*Префиксы настраиваются в UI; таблица — стартовые значения.

### 4.2. Алгоритм при webhook / создании Lead

```text
1. Resolve company
2. IF NOT RegionalFunnelRouting.enabled:
     → текущее поведение 1A (main funnel)
3. funnel = resolve_funnel_by_rules(phone, wazzup_account_id, source)
     a) phone_prefix match (longest prefix wins)
     b) wazzup_account_id in rule.wazzup_account_ids
     c) source in rule.source_channels (если задано)
4. IF funnel is None:
     IF fallback_strategy == default_funnel → routing.default_funnel
     ELIF fallback_strategy == round_robin → next rule.funnel from RR cursor
5. stage = first stage of funnel (intake / order=0)
6. Lead.create(funnel=funnel, stage=stage, owner=null, …)
7. assign_owner_within_region(lead, rule)  # RR / least_loaded по assign_role_ids
8. WS: lead.created + lead.assigned
```

**Инварианты:**

- Inbound **не** кладётся на ролевую воронку SMM, если она не указана в rules.
- Повторное сообщение того же чата **не меняет** `funnel`.
- Два одновременных inbound → RR под `select_for_update`.

### 4.3. API

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

Ответ включает `funnel_display`, `region_label` для UI.

При `404/501` фронт показывает заглушку (как у `lead-distribution`).

### 4.4. Связь с `lead-distribution`

| Настройка | Область |
|---|---|
| `lead-distribution` | Глобальный fallback owner, если регион не задал `assign_role_ids` |
| `regional-funnel-routing` | **Какую воронку** выбрать + локальный пул ролей |

Приоритет: **регион** → глобальное распределение → manual (пул).

## 5. Бэкенд: «Оплачено» → воронка «Внедрение»

### 5.1. Триггер

После успешного `POST /consalting/leads/{id}/register-payment/`:

```python
@transaction.atomic
def on_register_payment(lead, payment, *, user):
    create_sale_side_effects(...)   # сделка, зарплата, абонентка — как сейчас
    lead.payment_status = "paid"    # или status=in_work + stage «Оплачено»
    lead.save()

    funnel = lead.funnel
    if funnel.next_funnel_id and not funnel.is_final:
        move_lead_to_next_funnel(lead, funnel, user=user, transition="payment")
    # Если is_final — лид остаётся (воронка внедрения — финальная для онбординга)
```

**Не** дублировать сделку при `move_lead_to_next_funnel` — продажа уже создана
на шаге payment.

### 5.2. Отличие от `win` на завершающей стадии

| Событие | Промежуточная воронка (`is_final=false`) |
|---|---|
| Drag на «Завершено» / `win` | Переход дальше **без** продажи (квалификация) |
| `register-payment` | Продажа **+** переход в `next_funnel` (оплачено → внедрение) |

### 5.3. Ответ API

`register-payment` должен возвращать обновлённый lead с `funnel`, `funnel_id`,
`stage` — фронт обновит доски без второго `win`.

## 6. Фронт: fallback после оплаты

Если в ответе `register-payment` `funnel` уже сменился — только refresh досок.
Иначе, при `funnel.next_funnel && !funnel.is_final`, фронт вызывает `winLead`
(совместимость со старым бэком). См. `LeadDetail` → `LeadPaymentModal.onSuccess`.

## 7. Чек-лист приёмки

### Настройка
- [ ] Созданы 3 региональные воронки + «Внедрение».
- [ ] У региональных `next_funnel` = Внедрение, `is_final=false`.
- [ ] У «Внедрение» `is_final=true` (или конец цепочки без `next_funnel`).

### Inbound
- [ ] WA с номером Бишкека → воронка Бишкек + owner из RR региональных ролей.
- [ ] Неизвестный регион → round-robin между тремя воронками.
- [ ] Wazzup-аккаунт «Ош» (если привязан в rule) → воронка Ош.

### Оплата
- [ ] `register-payment` создаёт **одну** сделку.
- [ ] Лид появляется в «Внедрение» на заданной стадии.
- [ ] Ответственный по `next_assign` (auto / user / keep).
- [ ] Повторная оплата не дублирует сделку и не переносит повторно.

### Права
- [ ] Менеджер Бишкека не видит чужие регионы без grant.
- [ ] Отдел внедрения видит воронку «Внедрение».

## 8. Связанные документы

- **[backend-money-tenant/06-regional-funnels-routing.md](./backend-money-tenant/06-regional-funnels-routing.md)** — основная спека для бэка
- [backend/03-funnel-hierarchy.md](./backend/03-funnel-hierarchy.md) — цепочка воронок
- [backend-main-funnel-inbound.md](./backend-main-funnel-inbound.md) — текущий 1A (до регионов)
- [leads-whatsapp.md](./leads-whatsapp.md) — авто-assign owner
- [funnel-crm-logic.md](./funnel-crm-logic.md) — жизненный цикл и оплата
