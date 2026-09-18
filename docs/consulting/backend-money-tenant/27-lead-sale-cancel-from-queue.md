# 27. Отмена продажи прямо из очереди лидов

**Фронт:** `src/Components/Sectors/Consulting/leads/LeadsInbox.jsx`,
переиспользует `SaleCancelModal.jsx` и `api/consultingSales.js` (см.
[02-sale-cancel.md](./02-sale-cancel.md) — эндпоинты `cancel`/`refund` там уже
описаны и не меняются).
**Страница:** `/crm/consulting/leads` (раздел «Очередь»).
**Статус:** ✅ Фронт готов и задеплоен. Требуется бэк — см. §2.

---

## 1. Задача

Продавец оформляет продажу по лиду прямо из очереди (кнопка «Продажа» →
`register-payment`). Если это сделано по ошибке (не тот лид, не та сумма,
дубль), раньше приходилось идти на отдельную страницу «Продажи»
(`/crm/consulting/sale`), искать там нужную запись и отменять её оттуда —
неудобно и легко потерять контекст лида.

**Решение:** на карточке лида со статусом «Купил» (`converted`), если по нему
есть продажа и она ещё не отменена, показываем кнопку **«Отменить продажу»**.
Она открывает ту же модалку `SaleCancelModal`, что и на странице «Продажи» —
без перехода на другую страницу. Логика отмены (транзакция, откат
абонентки/зарплаты/кассы, возврат лида в работу) **не меняется** —
переиспользуется §8.4 из [02-sale-cancel.md](./02-sale-cancel.md).

## 2. Что нужно на бэке

Единственный пробел: `InboundLead` (очередь лидов, `/consalting/inbound-leads/`)
уже имеет FK `sale` (см. [01-leads.md](../backend/01-leads.md) §1.1), но:

1. **список/детали `InboundLead` не отдают `sale`** — сериализатор ещё не
   расширен (текущий пример ответа в 01-leads.md §1.2 поля `sale` не содержит);
2. **неясно, кто проставляет `InboundLead.sale`** при оформлении продажи через
   `register-payment` со страницы «Лиды».

### 2.1. Поле `sale` в ответе `GET /consalting/inbound-leads/`

Добавить в сериализатор компактный вложенный объект (не просто id — фронту
нужны деньги и статус сразу в списке, без лишнего запроса):

```jsonc
{
  "id": "…", "status": "converted", …,
  "sale": {
    "id": "sale-uuid",
    "status": "completed",        // completed | canceled | refunded | pending_confirmation
    "total": 45000,
    "client_display": "Иван Иванов",
    "service_display": "Консультация · Базовый"
  }
}
```

`sale: null`, если лид ещё не куплен или продажа не привязана. Поля —
подмножество того, что уже отдаёт `GET /consalting/sales/{id}/`
(`consultingSales.js:getConsultingSale`), чтобы фронт мог использовать этот
объект напрямую в `SaleCancelModal` без дополнительного запроса.

> Если поле `total` в компактном объекте отсутствует, фронт (уже готов к
> этому) сам дозапросит `GET /consalting/sales/{id}/` по клику — но это лишний
> round-trip на каждую отмену, лучше сразу отдать полностью.

### 2.2. Связка `register-payment` → `InboundLead.sale` / `status`

Когда продажа оформляется по лиду со страницы «Лиды» (кнопка «Продажа» →
`POST /consalting/leads/{funnelLeadId}/register-payment/`, см.
[09-frontend-contract.md](./09-frontend-contract.md)), нужно **автоматически**:

```python
# внутри register_payment(), после создания Sale
inbound = InboundLead.objects.filter(lead=funnel_lead).first()
if inbound:
    inbound.sale = sale
    inbound.status = InboundLead.Status.CONVERTED
    inbound.converted_at = timezone.now()
    inbound.closed_at = timezone.now()
    inbound.save(update_fields=["sale", "status", "converted_at", "closed_at"])
```

Сейчас это, судя по всему, не происходит (либо происходит без привязки
`sale`): отдельная кнопка «Купил» (`POST /inbound-leads/{id}/won/`) в очереди
никак не связана с `register-payment` и не передаёт `sale`. Если синхронизация
уже реализована — этот пункт можно закрыть без изменений, просто подтвердить
контракт.

### 2.3. Отмена продажи возвращает лид в очередь

Уже покрыто существующей логикой `cancel_sale` (§8.4 п.5 в
[02-sale-cancel.md](./02-sale-cancel.md)): при `lead_action="return_to_work"`
воронковый `Lead.status` возвращается в `in_work`. Дополнительно нужно
применить то же к `InboundLead`, если он привязан к этому `Lead`:

```python
# в cancel_sale(), пункт 5 «ЛИД»
if sale.lead_id and not partial:
    lead = sale.lead
    inbound = InboundLead.objects.filter(lead=lead).first()
    if lead_action == "return_to_work":
        lead.status = "in_work"; lead.converted_at = None; lead.sale = None
        if inbound:
            inbound.status = InboundLead.Status.IN_WORK
            inbound.sale = None
            inbound.converted_at = None
            inbound.closed_at = None
            inbound.save(update_fields=["status", "sale", "converted_at", "closed_at"])
    elif lead_action == "reject":
        lead.status = "rejected"; …
        if inbound:
            inbound.status = InboundLead.Status.REJECTED
            inbound.sale = None
            inbound.closed_at = timezone.now()
            inbound.save(update_fields=["status", "sale", "closed_at"])
    lead.save()
```

Без этого шага: после отмены продажи карточка лида в очереди «Лиды» продолжит
висеть в табе «Купили» (при этом воронка уже покажет лид «в работе») —
рассинхрон между двумя списками одного и того же лида.

## 3. Права

Без изменений относительно [02-sale-cancel.md](./02-sale-cancel.md) §8.6:
отменять может `owner`/`admin`, либо сам продавец в течение
`SALE_SELF_CANCEL_MINUTES` после оформления. Фронт не скрывает кнопку по
ролям — полагается на `403` с сервера (как и на странице «Продажи»).

## 4. Чек-лист приёмки

- [ ] `GET /consalting/inbound-leads/` и `GET /consalting/inbound-leads/{id}/`
      отдают `sale` (`id`, `status`, `total`, `client_display`,
      `service_display`) для купленных лидов, `null` для остальных.
- [ ] Оформление продажи через `register-payment` со страницы «Лиды»
      проставляет `InboundLead.sale` и переводит `InboundLead.status` в
      `converted`.
- [ ] Кнопка «Отменить продажу» на карточке лида в очереди отменяет ту же
      запись `Sale`, что видна на странице «Продажи» (единый источник правды,
      без дублей).
- [ ] После отмены с `lead_action=return_to_work` лид в очереди «Лиды»
      переходит из «Купили» обратно в «В работе»; `sale` на лиде — `null`.
- [ ] После отмены с `lead_action=reject` лид уходит в «Отказ» с тем же
      `reject_comment`, что ставит текущая логика `cancel_sale`.
- [ ] Повторный клик «Отменить продажу» по уже отменённой продаже — фронт не
      даёт открыть модалку (проверяет `status`), сервер всё равно возвращает
      `400` «Продажа уже отменена» на прямой повторный вызов API.

## 5. Связанные файлы

| Слой | Путь |
|---|---|
| Кнопка + открытие модалки из очереди | `src/Components/Sectors/Consulting/leads/LeadsInbox.jsx` |
| Модалка отмены (общая с «Продажами») | `src/Components/Sectors/Consulting/sale/SaleCancelModal.jsx` |
| API продаж | `src/api/consultingSales.js` |
| API лидов (модель, `sale` FK) | `src/api/consultingLeads.js`, [../backend/01-leads.md](../backend/01-leads.md) |
| Алгоритм отката отмены | [02-sale-cancel.md](./02-sale-cancel.md) §8.4 |
