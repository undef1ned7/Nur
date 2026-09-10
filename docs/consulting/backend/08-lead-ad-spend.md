# 8. Финансы лидов: рекламный отчёт (показы, лиды, затраты)

**Фронт:** `src/Components/Sectors/Consulting/leads/Leads.jsx` (кнопка «Финансы»
в шапке) → `modals/LeadFinanceModal.jsx`; API-слой
`src/api/consultingLeadFinance.js`; право — `utils/consultingFunnelAccess.js →
canManageConsultingLeadFinance`, пункт в `Components/DepartmentDetails/AccessList.jsx`.

## 8.1. Задача

На странице «Лиды» есть кнопка «Финансы». Раньше она просто скачивала пустой
Excel-шаблон рекламного отчёта. Теперь по клику открывается модалка с
**редактируемой таблицей**, где менеджер по трафику ведёт закупку рекламы по
дням:

| Дата | Показы | Лиды | Сумма затрат | Стоимость лида |
|------|--------|------|--------------|----------------|

«Стоимость лида» — расчётное поле (`затраты / лиды`), не редактируется. Внизу
строка «Итого» с суммами и общей стоимостью лида.

Данные должны **сохраняться на сервере** (одна таблица на компанию, накопительно
по всем дням), быть доступны при повторном открытии и переиспользоваться в
аналитике лидов (см. §8.7).

Excel-скачивание шаблона осталось как вторичная кнопка внутри модалки — бэкенд
для неё не нужен.

## 8.2. Модель

```python
class LeadAdSpend(models.Model):
    """Строка рекламного отчёта: один день закупки трафика."""
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE,
                                related_name="lead_ad_spends", db_index=True)

    date = models.DateField(db_index=True)
    impressions = models.PositiveIntegerField(default=0)      # показы
    leads = models.PositiveIntegerField(default=0)            # полученных лидов
    spend = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # сумма затрат
    note = models.CharField(max_length=255, blank=True, default="")

    created_by = models.ForeignKey(User, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("company", "date")]        # один день — одна строка
        ordering = ["-date"]
        indexes = [models.Index(fields=["company", "date"])]

    @property
    def cost_per_lead(self) -> Decimal:
        if self.leads > 0:
            return (self.spend / self.leads).quantize(Decimal("0.01"))
        return Decimal("0.00")
```

- **Мультитенантность:** каждый queryset фильтруется по `company` текущего
  пользователя. `company` в теле запроса игнорировать — брать из
  `request.user`.
- `cost_per_lead` не хранить, отдавать вычислением в сериализаторе.
- Валюта — валюта компании, отдельного поля не нужно (фронт не показывает знак).

## 8.3. Право доступа

Новое булево право сотрудника — как остальные `can_*` в профиле:

```
can_manage_lead_ad_spend: bool = False
```

- `owner` / `admin` / `rop` — доступ всегда (как в
  `isConsultingFunnelManager`).
- Прочий сотрудник — только при `can_manage_lead_ad_spend = true`.
- Право выдаётся на карточке сотрудника (тот же механизм, что
  `can_view_leads_inbox`): фронт уже шлёт этот ключ в списке доступов
  (`AccessList.jsx`, секция «Консалтинг»).
- Должно попадать в сериализатор профиля (`/users/me/`, `/users/employees/`,
  выдача при логине) — иначе фронт не покажет кнопку.

Пермишен на API:

```python
class CanManageLeadAdSpend(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        if not u.is_authenticated:
            return False
        if is_consulting_manager(u):        # owner / admin / rop
            return True
        return bool(getattr(u, "can_manage_lead_ad_spend", False))
```

Без права: список — `403` (не пустой `200`), запись — `403`.

## 8.4. Эндпоинты

Домен — `/api/consalting/` (историческое написание через «а»).

```
GET    /consalting/lead-ad-spend/            список
POST   /consalting/lead-ad-spend/            создать одну строку
GET    /consalting/lead-ad-spend/{id}/       одна строка
PUT    /consalting/lead-ad-spend/{id}/       заменить строку
PATCH  /consalting/lead-ad-spend/{id}/       частично изменить
DELETE /consalting/lead-ad-spend/{id}/       удалить строку
PUT    /consalting/lead-ad-spend/bulk/       пакетное сохранение всей таблицы
```

Фронт в модалке использует **`GET` (список) + `PUT .../bulk/`**. Одиночные
CRUD-методы нужны для программного доступа и совместимости — реализовать их
всё равно стоит (ViewSet покрывает бесплатно).

### GET /consalting/lead-ad-spend/

Query-параметры:

| Параметр | Описание |
|----------|----------|
| `date_from`, `date_to` | `YYYY-MM-DD`, включительно, местное время компании (Asia/Bishkek) |
| `ordering` | DRF `OrderingFilter`, по умолчанию `-date` |
| `page`, `page_size` | DRF-пагинация; фронт запрашивает `page_size=366` (год), максимум ограничить 1000 |

Ответ — стандартная DRF-пагинация:

```jsonc
{
  "count": 12,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "0e5c…",
      "date": "2026-09-09",
      "impressions": 15230,
      "leads": 48,
      "spend": "12400.00",
      "cost_per_lead": "258.33",   // spend / leads, 2 знака; 0 если leads = 0
      "note": "Instagram + Facebook",
      "created_at": "2026-09-09T21:30:00+06:00",
      "updated_at": "2026-09-10T08:12:00+06:00"
    }
  ]
}
```

Фронт также принимает голый массив (без пагинации) — но пагинированный ответ
предпочтителен.

### POST /consalting/lead-ad-spend/

```jsonc
// запрос
{ "date": "2026-09-10", "impressions": 8000, "leads": 25, "spend": 6100, "note": "" }
// 201 — объект строки как в GET
```

Если строка на эту `date` уже есть → `400`:

```jsonc
{ "detail": "За 10.09.2026 отчёт уже заведён — измените существующую строку." }
```

### PUT / PATCH /consalting/lead-ad-spend/{id}/

Тело — те же поля. `date` менять можно; коллизия по `(company, date)` → тот же
`400`. `cost_per_lead`, `company`, `created_by` в теле игнорировать.

### PUT /consalting/lead-ad-spend/bulk/ — основной путь сохранения

Полная синхронизация набора строк компании: **upsert по `(company, date)` +
удаление отсутствующих**.

```jsonc
// запрос
{
  "items": [
    { "id": "0e5c…", "date": "2026-09-09", "impressions": 15230, "leads": 48, "spend": 12400, "note": "" },
    { "date": "2026-09-10", "impressions": 8000, "leads": 25, "spend": 6100, "note": "тест оффера" }
  ]
}
```

Правила обработки (в одной `transaction.atomic()`):

1. `items` с `id` — обновить (строка обязана принадлежать компании; чужой/
   несуществующий `id` → `400`).
2. `items` без `id` — создать; если на эту `date` уже есть строка компании —
   **обновить её** (не плодить дубль, не падать).
3. Строки компании, чьих `date` **нет** в `items`, — **удалить**. Так фронт
   убирает строки: он присылает то, что осталось в таблице.
4. Пустые строки (все поля нулевые/пустые, без даты) фронт не присылает.
5. Внутри `items` две одинаковые `date` → `400`
   («Дата 2026-09-10 встречается дважды»). Фронт это тоже проверяет, но
   бэкенд обязан подстраховать.

Ответ — итоговый набор (как список `results`), отсортированный `-date`:

```jsonc
{ "results": [ { "id": "…", "date": "2026-09-10", "impressions": 8000, "leads": 25,
                 "spend": "6100.00", "cost_per_lead": "244.00", "note": "тест оффера",
                 "created_at": "…", "updated_at": "…" }, … ] }
```

**Идемпотентность:** повторный `PUT .../bulk/` с тем же телом не меняет данные
(кроме `updated_at`) и не создаёт дублей. Ключ — `(company, date)`.

## 8.5. Валидация

| Поле | Правило | Сообщение при ошибке (`detail`, по-русски) |
|------|---------|--------------------------------------------|
| `date` | обязательно, валидная дата | «Укажите дату строки.» |
| `date` | не из будущего дальше, чем сегодня (компании) | «Дата не может быть в будущем.» |
| `impressions`, `leads` | целое ≥ 0 | «Показы и лиды не могут быть отрицательными.» |
| `spend` | число ≥ 0, ≤ 999 999 999.99 | «Сумма затрат указана неверно.» |
| `leads` vs `impressions` | если оба > 0, `leads ≤ impressions` (мягко, можно `400`) | «Лидов больше, чем показов — проверьте цифры.» |
| `note` | ≤ 255 символов | «Комментарий слишком длинный.» |

Формат ошибки — как во всех разделах:
`{ "detail": "…", "field": ["…"] }`.

## 8.6. Права (сводка)

- Список и запись — `owner`/`admin`/`rop` или `can_manage_lead_ad_spend`.
- Данные **общие по компании** (не «только свои»): рекламный отчёт — один на
  компанию, поэтому изоляции по автору строки нет. `created_by` — только для
  аудита.
- Обычный сотрудник без права не должен видеть суммы затрат ни в одном ответе
  (кнопки «Финансы» у него на фронте нет, но API обязан вернуть `403`).

## 8.7. Использование в аналитике (следующий шаг, не блокирует)

`GET /consalting/inbound-leads/analytics/` (см. [01-leads.md](./01-leads.md)
§аналитика) — добавить в ответ блок по рекламным затратам за тот же период:

```jsonc
"ad_spend": {
  "total_spend": "182400.00",
  "total_impressions": 210300,
  "reported_leads": 640,        // сумма LeadAdSpend.leads
  "actual_leads": 612,          // фактические InboundLead за период
  "cost_per_lead": "285.00",    // total_spend / reported_leads
  "cost_per_actual_lead": "298.04"  // total_spend / actual_leads
}
```

Это позволит на фронте свести «сколько заплатили за рекламу» с «сколько лидов
реально пришло». Отдельным ТЗ; здесь — чтобы модель проектировалась с учётом
этого.

## 8.8. Реалтайм

Не требуется. Отчёт правит один-два человека, конкурентного редактирования нет.
Если понадобится — общий WS-канал компании с событием
`lead_ad_spend.updated` (payload не нужен, фронт перезапросит список).

## 8.9. Чек-лист приёмки

- [ ] Модель `LeadAdSpend` с `unique_together (company, date)` и миграцией.
- [ ] Право `can_manage_lead_ad_spend` заведено в профиле и отдаётся в
      `/users/me/`, `/users/employees/`, ответе логина.
- [ ] Право выдаётся/снимается на карточке сотрудника (ключ
      `can_manage_lead_ad_spend`).
- [ ] `GET /consalting/lead-ad-spend/` — DRF-пагинация, фильтры `date_from`/
      `date_to`, `ordering`, `page_size` до 1000; каждый ответ содержит
      `cost_per_lead`.
- [ ] CRUD по одной строке (`POST`/`GET {id}`/`PUT`/`PATCH`/`DELETE`).
- [ ] `PUT /consalting/lead-ad-spend/bulk/` — upsert по `(company, date)` +
      удаление отсутствующих, всё в одной транзакции, идемпотентно.
- [ ] Дубль `date` (в БД или внутри `items`) → `400` с русским `detail`.
- [ ] Все queryset фильтруются по компании; чужой `id` в bulk → `403`/`400`.
- [ ] Сотрудник без права: список и запись → `403`.
- [ ] Отрицательные/будущие значения отклоняются с понятным текстом.
- [ ] Повторный `bulk` с тем же телом не создаёт дублей и не меняет данные.
