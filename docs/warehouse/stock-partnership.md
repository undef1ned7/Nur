# Склад — партнёрство компаний: права, согласие партнёра, история

**Сфера:** Склад (`warehouse`).
**Страницы:** `/crm/warehouse/warehouses?tab=partnerships` (заявки, партнёры, запросы),
`/crm/warehouse/partners/:partnerId` (обмен товаром), `/crm/warehouse/kassa` → «Инкассация партнёров»,
`/crm/warehouse/partners/analytics`, `/crm/warehouse/partners/:partnerId/analytics`,
`/crm/warehouse/partners/:partnerId/sales` (история продаж партнёра),
карточка товара → «Переместить» → «Партнёру».
**Фронт:** `src/api/warehousePartnership.js`, `src/Components/Sectors/Warehouse/Warehouses/partnership/`,
`Warehouses/components/StockPartnershipPanel.jsx`, `Warehouses/components/StockPartnershipTransferModal.jsx`,
`Warehouses/PartnerCatalogPage.jsx`, `Products/WarehouseMoveProductModal.jsx`,
`Kassa/WarehouseKassa.jsx` (`PartnerCashIncassationPanel`), `Analytics/PartnerAnalytics*.jsx`,
`Analytics/PartnerSalesHistory.jsx`, `Analytics/PartnerSaleDetailModal.jsx`, `Analytics/partnerSalesModel.js`.
**Бэкенд (снимок прода `/home/nur`, 05.10.2026, HEAD `ca526727`):**
`apps/warehouse/views_partnership.py`, `apps/warehouse/models.py:1229-1430`,
`apps/warehouse/services.py` (`post_document`, ветка `TRANSFER`, стр. 750-880),
`apps/warehouse/services_money.py` (`post_partner_cash_incassation`),
`apps/warehouse/views_analytics.py:19-260`, `apps/warehouse/views.py:1975`
(`CompaniesSearchForAgentsAPIView`), `apps/warehouse/views_documents.py:529`
(`DocumentUnpostView`).
**Статус:** ❌ Дыры в правах и согласии на проде. Бэкенд — нужны правки (этапы 1–3)
и разовая чистка данных. Фронт — ✅ готово (§8), работает и со старым, и с новым бэкендом.

Сводка по аудиту склада: [audit-2026-10-stock-analytics.md](./audit-2026-10-stock-analytics.md).

---

## 1. Задача

Партнёрство связывает две компании: после принятия заявки каждая видит склады,
остатки, кассы и аналитику другой, может перемещать товар между складами
компаний и переводить наличные между кассами (инкассация).

Сейчас:

- **любой сотрудник** компании (не только владелец) может забрать товар со склада
  партнёра или деньги из его кассы;
- забирают **без согласия** партнёра: документ проводится сразу;
- по документу **не видно, кто** и с какой стороны его создал; отменить проведение может
  любая сторона;
- партнёрство **нельзя разорвать**, а если его удаляют из базы — не остаётся истории;
- поиск компаний для приглашения отдаёт **названия всех клиентов NurCRM** любому
  вошедшему пользователю.

Нужно:

1. Оставить операции с партнёрством только владельцу и администратору.
2. «Забрать у партнёра» (товар и деньги) — только с подтверждением партнёра, если
   партнёр сам не разрешил забирать без подтверждения.
3. Записывать автора и компанию-инициатора, ограничить отмену проведения.
4. Добавить разрыв партнёрства с сохранением истории; запретить физическое удаление.
5. Починить транзакционность, гонку в инкассации, цену и сопоставление товаров.
6. Закрыть утечку списка компаний; облегчить каталог партнёра.
7. Дать владельцу/админу смотреть **историю продаж партнёра** (документы продаж и
   возвратов с составом), с правом партнёра скрыть её (§7.15–7.16).

---

## 2. Как устроено сейчас

**Модели** (`models.py:1229-1430`):

| Модель | Поля | Замечания |
|---|---|---|
| `CompanyStockPartnership` | `company_a`, `company_b` (канонический порядок), `created_at` | Нет статуса, нет автора, нет настроек. Наличие строки = активное партнёрство |
| `CompanyStockPartnershipRequest` | `from_company`, `to_company`, `status` (PENDING/ACCEPTED/REJECTED/CANCELLED), `note`, `created_by`, `decided_by`, `decided_at` | Уникальность PENDING в одном направлении |
| `CompanyCashIncassation` | `from_company`, `to_company`, `cash_register_from/to`, `expense_document`, `receipt_document`, `amount`, `comment`, `created_by` | Создаётся сразу проведённой парой денежных документов |

**Эндпоинты** (`urls.py:199-219`), все под `/api/warehouse/`:

| Метод и путь | Кто может сейчас | Что делает |
|---|---|---|
| `GET stock-partnership-requests/` | любой сотрудник | `incoming` (только PENDING), `outgoing` (до 200, все статусы) |
| `POST stock-partnership-requests/` | любой сотрудник | Заявка `{to_company, note}` |
| `POST stock-partnership-requests/{id}/accept/` | владелец/админ получателя | Создаёт `CompanyStockPartnership` |
| `POST …/{id}/reject/`, `…/{id}/cancel/` | владелец/админ получателя / любой сотрудник отправителя | |
| `GET stock-partnerships/active/` | любой сотрудник | `{partners: [{id, name}]}` |
| `GET stock-partnerships/companies/{id}/catalog/` | любой сотрудник | Все склады партнёра со **всеми** товарами + все кассы с сальдо |
| `POST stock-partnerships/transfer/` | любой сотрудник, кроме агента | `TRANSFER` между компаниями, **проводится сразу**, склад-источник может быть партнёрским |
| `GET/POST stock-partnerships/cash-incassations/` | любой сотрудник, кроме агента | Инкассация, **проводится сразу**, касса-источник может быть партнёрской |
| `GET owner/partners/analytics/`, `GET owner/partners/{id}/analytics/` | владелец/админ | Полная аналитика партнёра «как owner/analytics» |
| `GET agents/companies/search/` | любой аутентифицированный | До 50 названий **любых** компаний |

Права проверяет `user_can_represent_company` (`views_partnership.py:39`): это
**членство** в компании, роль не проверяется. `_is_owner_like` используется только
в accept/reject и аналитике.

---

## 3. Проблемы

| # | Проблема | Где | Приоритет |
|---|---|---|---|
| П1 | Операции с партнёром доступны любому сотруднику | `user_can_represent_company` во всех view, кроме accept/reject | 🔴 P0 |
| П2 | «Забрать» товар и деньги у партнёра без его согласия | `DocumentPartnerTransferCreateAPIView`, `PartnerCashIncassationListCreateAPIView` | 🔴 P0 |
| П3 | Нет автора и инициатора перемещения; отменить проведение может любая сторона | `Document` без `created_by`; `DocumentUnpostView` фильтрует `warehouse_from__company OR warehouse_to__company` | 🔴 P0 |
| П4 | Партнёрство нельзя разорвать; удаление строки не оставляет следов | Нет статуса и эндпоинта; на проде пропали 2 партнёрства (§4) | 🔴 P0 |
| П5 | Создание и проведение перемещения не в одной транзакции → висячие черновики | `views_partnership.py:310-328` | 🟠 P1 |
| П6 | Баланс кассы проверяется без блокировки → два параллельных запроса уводят кассу в минус | `services_money.post_partner_cash_incassation` | 🟠 P1 |
| П7 | Цена в перемещении 0 (документ на 0 сом); товар у получателя ищется по одному названию | `TransferItemInputSerializer.price` default 0; `_get_or_create_transfer_product` | 🟠 P1 |
| П8 | Поиск компаний раскрывает список клиентов NurCRM, не исключает свою компанию | `CompaniesSearchForAgentsAPIView` | 🟠 P1 |
| П9 | Каталог партнёра тяжёлый: все товары всех складов одним ответом, запрос `StockBalance` на каждый склад, фолбэк на `quantity` карточки | `PartnerCompanyCatalogAPIView` | 🟡 P2 |
| П10 | Встречные заявки A→B и B→A обе висят в PENDING | `CompanyStockPartnershipRequestListCreateAPIView.post` | 🟡 P2 |
| П11 | Партнёр видит сальдо всех касс даже без доверенного режима | `_partner_cash_registers_payload` | 🟡 P2 |
| П12 | Аналитика партнёра отдаёт `branch_id` без названия и без списка филиалов | `build_owner_partner_warehouse_analytics_payload` | 🟢 P3 |

### П1–П2. Как выглядит атака

Сотрудник (кассир, кладовщик) компании A, у которой есть партнёр B:

```http
POST /api/warehouse/stock-partnerships/transfer/
{ "warehouse_from": "<склад B>", "warehouse_to": "<склад A>",
  "items": [{ "product": "<товар B>", "qty": "100.000" }] }
```

→ `201`, документ проведён, у B списано 100 единиц. Аналогично
`cash-incassations/` с `cash_register_from = <касса B>` переводит наличные B в кассу A.
B узнаёт об этом только из истории.

### П3. Кто отменяет проведение

`DocumentUnpostView.get_queryset` отдаёт документ обеим компаниям. Владелец B может
распровести перемещение, которое инициировала A, и наоборот. Поля «кто создал» у
`Document` нет — установить инициатора невозможно.

### П5. Висячие черновики

`Document.objects.create(...)` и `item.save()` выполняются до `post_document`,
без `transaction.atomic()`. Если проведение падает (не хватает остатка, валидация),
ответ — 400, но документ остаётся в `DRAFT`. На проде таких 3 (§4).

### П7. Товар «склеивается» по названию

`_get_or_create_transfer_product` ищет товар у получателя по штрихкоду, коду,
артикулу+названию и в конце **только по названию**. Разные товары с одинаковым
названием у разных компаний сольются (как S8 в
[stock-single-source-of-truth.md](./stock-single-source-of-truth.md)).

---

## 4. Данные прода (снимок 05.10.2026, только SELECT)

| Показатель | Значение |
|---|---|
| Активных партнёрств | 2: «ОсОО Сильвер Китчен ош» ↔ «Сильвер Манас» (с 30.05.2026), «Эламан Кара суу» ↔ «ИП Айдаралиев» (с 05.10.2026) |
| Заявок | 2, обе `ACCEPTED` |
| Межкомпанейских `TRANSFER` | 16: `POSTED` 13, `DRAFT` 3 (без движений — висячие, П5); последний — 03.06.2026 |
| Строк в них | 19, всего 120 ед., **у всех `price = 0`**, сумма документов 0 |
| Инкассаций | 0 |
| Перемещения без текущего партнёрства | «Сильвер Китчен ош» ↔ «Сильвер Бишкек» (13 док.), «Сильвер Бишкек» → «Сильвер Манас» (1 док.), 30.05–03.06.2026. Сейчас этих партнёрств и заявок нет, в `django_admin_log` записей нет — удалены напрямую из БД (П4) |

Запросы для повтора — в §10.

---

## 5. Принятые решения

| # | Вопрос | Решение | Почему |
|---|---|---|---|
| D1 | Кто работает с партнёрством | Только `_is_owner_like` (владелец, админ, суперюзер). Агенты — никогда | Операции двигают товар и деньги между юрлицами |
| D2 | «Отдать партнёру» (своё → партнёру) | Проводится сразу | Компания распоряжается своим имуществом |
| D3 | «Забрать у партнёра» (товар и деньги) | Запрос `PENDING`, проводит владелец/админ партнёра | Согласие владельца имущества |
| D4 | Сети одного владельца («Сильвер») | Компания может разрешить партнёру забирать **у себя** без подтверждения: флаг `allow_direct_pull` на своей стороне партнёрства. По умолчанию `false` | Сохраняем быстрый режим для доверенных пар, но только по явному решению отдающей стороны |
| D5 | Цена в перемещении | Сервер ставит `price = purchase_price` товара-источника (значение клиента игнорирует). Долг между компаниями **не создаётся** | Документ показывает стоимость переданного; взаиморасчёты — отдельная задача (продажа/закуп между компаниями) |
| D6 | Разрыв партнёрства | Любая сторона (владелец/админ) в одностороннем порядке; статус `TERMINATED`, история сохраняется; ожидающие операции отменяются | Выход из доверия не должен требовать согласия второй стороны |
| D7 | Отмена проведения межкомпанейского перемещения | Только владелец/админ компании-**получателя** (склад `warehouse_to`): отмена забирает товар у получателя | Тот, у кого списывается товар, должен решать сам. Отправитель, которому нужен товар обратно, делает «Забрать» |
| D8 | Видимость данных | Партнёр видит склады и остатки всегда; сальдо касс — только при `allow_direct_pull = true` у владельца кассы; полная аналитика — как сейчас (владелец/админ) | Остатки нужны для обмена, сальдо — нет, если каждое списание подтверждается |
| D9 | Поиск компаний для приглашения | Отдельный эндпоинт: только владелец/админ, от 3 символов, до 20 результатов, без своей компании, со статусом партнёрства | Не раскрывать всю клиентскую базу |
| D10 | История продаж партнёра | Владелец/админ видит продажи и возвраты продаж партнёра (`SALE`, `SALE_RETURN` в статусах `POSTED`, `CASH_PENDING`) со строками. Каждая сторона может скрыть **свои** продажи флагом `share_sales_history` (по умолчанию `true`) | Суммы продаж партнёр уже видит в аналитике; документы нужны, чтобы понять, из чего они сложились. Флаг — для пар, где покупатели партнёра — коммерческая тайна |
| D11 | Какие данные продажи отдавать партнёру | Номер, дата, статус, склад и филиал, способ оплаты, **название** покупателя, имя агента, строки (товар, артикул, кол-во, цена, скидка, сумма), итоги. **Не отдавать:** комментарии, телефоны/ИНН/адреса покупателей, предоплату, долг покупателя, закупочную цену и наценку | Минимум, достаточный для сверки продаж; без персональных данных покупателей и себестоимости |

---

## 6. Решение: модель

### 6.1. `CompanyStockPartnership` — статус, настройки, автор

```python
class CompanyStockPartnership(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Активно"
        TERMINATED = "TERMINATED", "Разорвано"

    # существующие поля: id, company_a, company_b, created_at
    status = models.CharField(max_length=16, choices=Status.choices,
                              default=Status.ACTIVE, db_index=True)
    a_allows_direct_pull = models.BooleanField(default=False)  # A разрешает B забирать без подтверждения
    b_allows_direct_pull = models.BooleanField(default=False)  # B разрешает A
    a_shares_sales_history = models.BooleanField(default=True)  # A показывает B свои продажи (D10)
    b_shares_sales_history = models.BooleanField(default=True)  # B показывает A
    created_from_request = models.ForeignKey("warehouse.CompanyStockPartnershipRequest",
                                             null=True, blank=True, on_delete=models.SET_NULL)
    activated_at = models.DateTimeField(null=True, blank=True)   # последняя активация
    terminated_at = models.DateTimeField(null=True, blank=True)
    terminated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                      on_delete=models.SET_NULL, related_name="+")
    terminated_by_company = models.ForeignKey("users.Company", null=True, blank=True,
                                              on_delete=models.SET_NULL, related_name="+")
```

- `has_active_stock_partnership_between_ids` и `list_active_stock_partner_companies`
  фильтруют `status=ACTIVE`.
- Уникальность пары остаётся: повторное принятие заявки после разрыва
  **реактивирует** ту же строку (`status=ACTIVE`, флаги `*_allows_direct_pull = False`,
  `activated_at = now`).
- Хелперы: `partnership.allows_direct_pull_from(company_id)`,
  `partnership.shares_sales_history_of(company_id)` → флаг стороны `company_id`.
- При реактивации `*_shares_sales_history` возвращаются в `True` (как при первом принятии).

### 6.2. Журнал партнёрства

```python
class CompanyStockPartnershipEvent(models.Model):
    class Kind(models.TextChoices):
        ACTIVATED = "ACTIVATED"
        TERMINATED = "TERMINATED"
        SETTINGS_CHANGED = "SETTINGS_CHANGED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    partnership = models.ForeignKey(CompanyStockPartnership, on_delete=models.PROTECT,
                                    related_name="events")
    kind = models.CharField(max_length=24, choices=Kind.choices)
    company = models.ForeignKey("users.Company", null=True, on_delete=models.SET_NULL)  # чья сторона
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    payload = models.JSONField(default=dict, blank=True)  # {"allow_direct_pull": true} / {"share_sales_history": false}
    created_at = models.DateTimeField(auto_now_add=True)
```

- В админке `CompanyStockPartnership` и событий — `has_delete_permission = False`.
- Ручное удаление партнёрства из БД запрещено регламентом; для выхода — terminate.

### 6.3. Операция, ожидающая подтверждения партнёра

```python
class PartnerOperationRequest(models.Model):
    class Kind(models.TextChoices):
        TRANSFER = "TRANSFER", "Товар"
        INCASSATION = "INCASSATION", "Деньги"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Ожидает"
        APPROVED = "APPROVED", "Проведена"
        REJECTED = "REJECTED", "Отклонена"
        CANCELLED = "CANCELLED", "Отозвана"
        FAILED = "FAILED", "Ошибка"   # зарезервировано для асинхронного проведения

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    partnership = models.ForeignKey(CompanyStockPartnership, on_delete=models.PROTECT)
    kind = models.CharField(max_length=16, choices=Kind.choices)
    status = models.CharField(max_length=16, choices=Status.choices,
                              default=Status.PENDING, db_index=True)
    initiator_company = models.ForeignKey("users.Company", on_delete=models.PROTECT,
                                          related_name="partner_operations_out")  # кто забирает
    source_company = models.ForeignKey("users.Company", on_delete=models.PROTECT,
                                       related_name="partner_operations_in")    # у кого забирают, он подтверждает
    # TRANSFER
    warehouse_from = models.ForeignKey("warehouse.Warehouse", null=True, on_delete=models.PROTECT, related_name="+")
    warehouse_to = models.ForeignKey("warehouse.Warehouse", null=True, on_delete=models.PROTECT, related_name="+")
    items = models.JSONField(default=list, blank=True)  # [{"product": uuid, "qty": "3.000"}]
    # INCASSATION
    cash_register_from = models.ForeignKey("warehouse.CashRegister", null=True, on_delete=models.PROTECT, related_name="+")
    cash_register_to = models.ForeignKey("warehouse.CashRegister", null=True, on_delete=models.PROTECT, related_name="+")
    amount = models.DecimalField(max_digits=18, decimal_places=2, null=True)

    comment = models.CharField(max_length=512, blank=True)
    reject_reason = models.CharField(max_length=512, blank=True)
    error = models.CharField(max_length=512, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    decided_at = models.DateTimeField(null=True, blank=True)
    document = models.ForeignKey("warehouse.Document", null=True, on_delete=models.SET_NULL, related_name="+")
    incassation = models.ForeignKey("warehouse.CompanyCashIncassation", null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["source_company", "status"]),
            models.Index(fields=["initiator_company", "status"]),
        ]
```

### 6.4. `Document` — автор и инициатор

```python
created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                               on_delete=models.SET_NULL, related_name="+")
initiator_company = models.ForeignKey("users.Company", null=True, blank=True,
                                      on_delete=models.SET_NULL, related_name="+")
```

- `created_by` заполнять во **всех** местах создания документов (не только в партнёрстве).
- `initiator_company` — для межкомпанейских `TRANSFER`: компания пользователя,
  создавшего документ (или `initiator_company` операции при подтверждении).
- В `DocumentSerializer` отдать `created_by`, `created_by_email`, `initiator_company`,
  `initiator_company_name`.

### 6.5. `CompanyCashIncassation`

Без изменений структуры. Добавить `partner_operation = FK(PartnerOperationRequest, null=True)`
— ссылка на подтверждённый запрос.

---

## 7. Решение: API

Все пути — от `/api/warehouse/`. Во всех эндпоинтах этого раздела:

```python
def user_can_manage_partnership(user, company) -> bool:
    return _is_owner_like(user) and user_can_represent_company(user, company)
```

Иначе — `403 {"detail": "Партнёрство доступно только владельцу и администратору."}`.
Агентам (`_agent_membership() is not None`) — всегда 403.

### 7.1. Заявки на партнёрство (изменения)

`GET stock-partnership-requests/` — без изменений формата.

`POST stock-partnership-requests/` — дополнительно:

- если есть встречная PENDING-заявка от `to_company` к нам —
  `400 {"to_company": ["У вас есть входящая заявка от этой компании — примите её."], "code": "incoming_request_exists", "request_id": "<uuid>"}`;
- если партнёрство `TERMINATED` — заявка разрешена (после принятия — реактивация).

`POST stock-partnership-requests/{id}/accept/` — `get_or_create` пары; если строка
есть и `TERMINATED` → реактивировать (§6.1), записать событие `ACTIVATED`,
`created_from_request = заявка`.

### 7.2. Активные партнёры (расширение ответа)

`GET stock-partnerships/active/`

```json
{
  "partners": [
    {
      "id": "<uuid компании-партнёра>",
      "name": "Сильвер Манас",
      "partnership_id": "<uuid партнёрства>",
      "since": "2026-05-30T10:12:00+06:00",
      "allow_direct_pull": false,
      "partner_allows_direct_pull": true,
      "share_sales_history": true,
      "partner_shares_sales_history": true,
      "pending_operations_in": 2
    }
  ]
}
```

- `allow_direct_pull` — **наш** флаг: разрешаем ли партнёру забирать у нас без подтверждения.
- `partner_allows_direct_pull` — флаг партнёра: можем ли мы забирать у него без подтверждения.
- `share_sales_history` — **наш** флаг: видит ли партнёр нашу историю продаж.
- `partner_shares_sales_history` — флаг партнёра: можем ли мы смотреть его продажи.
- `pending_operations_in` — сколько запросов этого партнёра ждут нашего решения.

> Фронт по наличию `partnership_id` включает кнопку «Разорвать» и переключатель
> «Может забирать у вас»; по наличию `share_sales_history` (boolean) — переключатель
> «Ваши продажи»; при `partner_shares_sales_history = false` выключает кнопку «Продажи».

### 7.3. Разрыв партнёрства (новый)

`POST stock-partnerships/companies/{partner_company_id}/terminate/`

- 404, если активного партнёрства нет.
- В одной транзакции: `status=TERMINATED`, `terminated_at/by/by_company`, событие `TERMINATED`,
  все PENDING-операции пары → `CANCELLED` с `reject_reason = "Партнёрство разорвано"`.
- Проведённые документы и инкассации не трогаются.
- Ответ `200`:

```json
{ "partner_company_id": "<uuid>", "partnership_id": "<uuid>", "status": "TERMINATED",
  "terminated_at": "2026-10-06T09:00:00+06:00", "cancelled_operations": 1 }
```

### 7.4. Настройки своей стороны (новый)

`PATCH stock-partnerships/companies/{partner_company_id}/settings/`

```json
{ "allow_direct_pull": true }
```

или

```json
{ "share_sales_history": false }
```

- Принимает любое подмножество полей `allow_direct_pull`, `share_sales_history`
  (неизвестные поля → 400). Фронт шлёт по одному полю за раз.
- Меняет только флаги **своей** стороны (`a_` или `b_` по каноническому порядку).
- Событие `SETTINGS_CHANGED` с `payload` = изменённые поля.
- Ответ — элемент из §7.2 для этого партнёра.

### 7.5. Поиск компаний для приглашения (новый)

`GET stock-partnerships/companies/search/?search=<строка>`

- `search` после `strip()` короче 3 символов → `400 {"search": ["Минимум 3 символа."]}`.
- Не больше 20 результатов, своя компания исключена, сортировка по названию.
- Rate limit: 30 запросов в минуту на пользователя (DRF throttle `partnership_search`).

```json
[
  { "id": "<uuid>", "name": "Сильвер Бишкек", "partnership_status": null },
  { "id": "<uuid>", "name": "Сильвер Манас", "partnership_status": "ACTIVE" },
  { "id": "<uuid>", "name": "Сильвер Ош", "partnership_status": "PENDING_OUT" }
]
```

`partnership_status`: `ACTIVE` | `PENDING_OUT` (наша заявка ждёт) | `PENDING_IN`
(их заявка ждёт нас) | `null`.

Отдельно: `agents/companies/search/` (для заявок агентов) — тоже минимум 3 символа и
не больше 20 результатов.

### 7.6. Склады и кассы партнёра без товаров (новый)

`GET stock-partnerships/companies/{partner_company_id}/warehouses/`

```json
{
  "partner_company": { "id": "<uuid>", "name": "Сильвер Манас" },
  "partnership": {
    "id": "<uuid>",
    "since": "2026-05-30T10:12:00+06:00",
    "allow_direct_pull": false,
    "partner_allows_direct_pull": true
  },
  "warehouses": [
    { "id": "<uuid>", "name": "Основной", "branch_id": "<uuid>|null",
      "branch_name": "Манас|null", "products_count": 412 }
  ],
  "cash_registers": [
    { "id": "<uuid>", "name": "Касса 1", "location": "", "branch_id": null,
      "branch_name": null, "balance": "15400.00" }
  ]
}
```

- `balance` — строка, если партнёр разрешил нам забирать без подтверждения
  (`partner_allows_direct_pull = true`), иначе `null` (D8).
- `products_count` — одним агрегирующим запросом по `StockBalance` (`qty > 0`), без цикла.

### 7.7. Товары склада партнёра с пагинацией (новый)

`GET stock-partnerships/companies/{partner_company_id}/warehouses/{warehouse_id}/products/?search=&page=&page_size=`

- Склад обязан принадлежать партнёру → иначе 404.
- `search` — по `name`, `article`, `barcode` (icontains), `page_size` по умолчанию 50, максимум 200.
- Остаток — **только** из `StockBalance` (после этапа 1 из
  [stock-single-source-of-truth.md](./stock-single-source-of-truth.md); до него — текущая логика каталога).
- Товары с нулевым остатком отдаются (фронт блокирует выбор).

```json
{
  "count": 412, "next": "...?page=2", "previous": null,
  "results": [
    { "id": "<uuid>", "name": "Нори", "article": "N-1", "barcode": "4600000000000",
      "unit": "шт", "qty": "40.000" }
  ]
}
```

`GET stock-partnerships/companies/{id}/catalog/` — оставить для совместимости (старые
сборки фронта), применить права §7 и правило `balance` из §7.6, пометить deprecated.
Удалить через 2 релиза после выката фронта.

### 7.8. Перемещение товара (изменение поведения)

`POST stock-partnerships/transfer/` — тело как сейчас:

```json
{ "warehouse_from": "<uuid>", "warehouse_to": "<uuid>", "comment": "…",
  "items": [{ "product": "<uuid>", "qty": "3.000", "price": "0.00" }] }
```

Логика:

1. Права §7, проверки как сейчас (разные компании, одна из них наша, партнёрство `ACTIVE`).
2. `price` из запроса **игнорируется**: сервер ставит `price = product.purchase_price`
   (`discount_* = 0`) — D5.
3. Направление:
   - `warehouse_from` **наш** («отдать») → провести сразу;
   - `warehouse_from` **партнёра** («забрать») и `partnership.allows_direct_pull_from(partner) == True`
     → провести сразу;
   - иначе — создать `PartnerOperationRequest(kind=TRANSFER, status=PENDING)`, ничего не проводить.
4. Предварительная проверка остатка у источника (тот же код, что в `post_document`) — чтобы
   не создавать заведомо невыполнимый запрос: `400 {"detail": "Недостаточно товара …"}`.
5. Проведение — **одна транзакция** (`transaction.atomic()`): создание `Document`
   (`created_by`, `initiator_company`), строк, `post_document`. Ошибка → откат, черновика не остаётся (П5).

Ответы:

| Случай | Код | Тело |
|---|---|---|
| Проведено сразу | `201` | `DocumentSerializer` + `"result": "posted"` |
| Ждёт подтверждения | `202` | `{"result": "pending", "operation": <PartnerOperation>}` |

> Фронт определяет «ждёт подтверждения» по `result === "pending"` или
> `operation.status === "PENDING"`; старый ответ (документ без `result`) считается проведённым.

### 7.9. Инкассация (изменение поведения)

`POST stock-partnerships/cash-incassations/` — тело как сейчас
`{cash_register_from, cash_register_to, amount, comment}`.

1. Права §7; партнёрство `ACTIVE`.
2. Касса-источник **наша** → провести сразу; **партнёра** и он разрешил прямое списание →
   сразу; иначе — `PartnerOperationRequest(kind=INCASSATION, status=PENDING)`, ответ `202` как в §7.8.
3. В `post_partner_cash_incassation`: перед проверкой баланса —
   `CashRegister.objects.select_for_update().filter(id__in=[from, to]).order_by("id")`
   (П6). Порядок блокировки по `id`, чтобы не было взаимоблокировок.
4. Ответ при проведении — `201` `CompanyCashIncassationSerializer` + `"result": "posted"`.

`GET stock-partnerships/cash-incassations/` — без изменений.

### 7.10. Операции с подтверждением (новый)

`GET stock-partnerships/operations/?status=&kind=`

```json
{
  "incoming": [ <PartnerOperation>, … ],   // source_company = мы, ждут нашего решения (по умолчанию PENDING + последние 50 решённых)
  "outgoing": [ <PartnerOperation>, … ]    // initiator_company = мы (последние 200)
}
```

`PartnerOperation`:

```json
{
  "id": "<uuid>",
  "kind": "TRANSFER",
  "status": "PENDING",
  "initiator_company": "<uuid>", "initiator_company_name": "Сильвер Манас",
  "source_company": "<uuid>", "source_company_name": "Сильвер Китчен ош",
  "warehouse_from": "<uuid>", "warehouse_from_name": "Ош, основной",
  "warehouse_to": "<uuid>", "warehouse_to_name": "Манас",
  "items": [ { "product": "<uuid>", "product_name": "Нори", "unit": "шт", "qty": "3.000" } ],
  "cash_register_from": null, "cash_register_from_name": null,
  "cash_register_to": null, "cash_register_to_name": null,
  "amount": null,
  "comment": "", "reject_reason": "", "error": "",
  "created_by_email": "manas@example.com", "decided_by_email": null,
  "created_at": "…", "decided_at": null,
  "document": null, "document_number": null, "incassation": null
}
```

`POST stock-partnerships/operations/{id}/approve/` — владелец/админ `source_company`:

- `select_for_update` операции; статус должен быть `PENDING`, партнёрство `ACTIVE`;
- провести тем же сервисом, что прямое перемещение / инкассацию (документ: `created_by` =
  инициатор операции, `initiator_company` = `initiator_company`);
- успех → `APPROVED`, `decided_by/at`, ссылка на `document` / `incassation`, ответ `200` `PartnerOperation`;
- бизнес-ошибка (нет остатка, нет денег) → `400 {"detail": "…"}`, операция **остаётся PENDING**
  (можно пополнить и подтвердить ещё раз или отклонить).

`POST stock-partnerships/operations/{id}/reject/` — владелец/админ `source_company`,
тело `{ "reason": "…" }` (необязательно) → `REJECTED`.

`POST stock-partnerships/operations/{id}/cancel/` — владелец/админ `initiator_company`,
только `PENDING` → `CANCELLED`.

Повторный approve/reject/cancel не в `PENDING` → `400 {"detail": "Операция уже обработана."}`.

### 7.11. Отмена проведения межкомпанейского перемещения

В `DocumentUnpostView` (и в удалении проведённых документов, если оно есть): для
`TRANSFER`, где `warehouse_from.company_id != warehouse_to.company_id`, разрешать
только `_is_owner_like` пользователю компании `warehouse_to.company` (D7). Иначе —
`403 {"detail": "Отменить межкомпанейское перемещение может только получатель."}`.

### 7.12. Сопоставление товара у получателя

В `_get_or_create_transfer_product` для **межкомпанейского** перемещения убрать
последний шаг «найти по одному названию». Порядок: штрихкод → код → артикул+название →
создать новую карточку (как сейчас, с копированием `purchase_price`, `price`, единицы и т.д.).
Для перемещения внутри компании поведение — по решению S8 в
[stock-single-source-of-truth.md](./stock-single-source-of-truth.md).

### 7.13. Аналитика партнёра

`GET owner/partners/{id}/analytics/` — добавить в корень ответа:

```json
{
  "branch_name": "Манас",
  "partner_branches": [ { "id": "<uuid>", "name": "Манас" }, { "id": "<uuid>", "name": "Ош" } ]
}
```

Фронт показывает название филиала и селектор, если филиалов больше одного.

### 7.14. Кассы партнёров в общем списке касс

`GET cash-registers/?include_partners=1` (владелец) сейчас подмешивает кассы партнёров
со всеми суммами. Применить правило D8: сальдо и обороты чужих касс — только при
`partner_allows_direct_pull = true`, иначе `null`.

### 7.15. История продаж партнёра — список (новый)

`GET stock-partnerships/companies/{partner_company_id}/sales/`

**Доступ.** Права §7 (владелец/админ, не агент), партнёрство `ACTIVE`, у партнёра
`shares_sales_history_of(partner) == True`. Иначе:

| Случай | Ответ |
|---|---|
| Нет активного партнёрства | `403 {"detail": "Нет активного партнёрства с этой компанией."}` |
| Партнёр скрыл продажи | `403 {"detail": "Партнёр скрыл историю продаж.", "code": "sales_history_hidden"}` |
| Неверный `partner_branch` | `403 {"detail": "Филиал партнёра не найден."}` (как в аналитике) |

**Параметры** (период — те же, что у `owner/partners/{id}/analytics/`, через `_parse_period`):

| Параметр | Значения | По умолчанию |
|---|---|---|
| `period` | `day` \| `week` \| `month` \| `custom` | `month` |
| `date` | `YYYY-MM-DD` (для day/week/month) | сегодня (Asia/Bishkek) |
| `date_from`, `date_to` | `YYYY-MM-DD` (для `custom`), включительно; не больше 366 дней → иначе 400 | — |
| `doc_type` | `SALE` \| `SALE_RETURN` | `SALE` |
| `status` | `POSTED` \| `CASH_PENDING`; без параметра — оба | оба |
| `search` | номер документа (icontains) или название покупателя (icontains) | — |
| `partner_branch` | UUID филиала партнёра | все филиалы |
| `page`, `page_size` | `page_size` ≤ 200 | 1, 50 |

**Выборка** — те же правила, что в аналитике, чтобы суммы совпадали с
`owner/partners/{id}/analytics/` за тот же период:

- компания — по правилу A13 из [analytics-calculation-fixes.md](./analytics-calculation-fixes.md)
  (`Document.company`, а до его появления —
  `Q(warehouse_from__company=partner) | Q(warehouse_from__isnull=True, items__product__company=partner)` + `distinct()`);
- в выборку входят и агентские продажи партнёра (`agent` не фильтруется);
- статусы — `POSTED` и `CASH_PENDING` (A7); `DRAFT`, `SALE_REQUEST`, `REJECTED` не отдаются;
- дата — по `Document.date` в часовом поясе `Asia/Bishkek`;
- сортировка — `-date, -number`.

**Ответ `200`:**

```json
{
  "partner_company": { "id": "<uuid>", "name": "Сильвер Манас" },
  "date_from": "2026-09-05",
  "date_to": "2026-10-05",
  "summary": {
    "count": 120,
    "amount": "45000.50",
    "discount_amount": "300.00",
    "items_qty": "512.000"
  },
  "count": 120,
  "next": "https://…/sales/?page=2&…",
  "previous": null,
  "results": [
    {
      "id": "<uuid>",
      "doc_type": "SALE",
      "number": "S-101",
      "date": "2026-10-01T10:00:00+06:00",
      "status": "POSTED",
      "payment_kind": "cash",
      "warehouse_from": "<uuid>|null",
      "warehouse_from_name": "Основной",
      "branch_name": "Манас|null",
      "counterparty_display_name": "ИП Асан",
      "agent_display": "Бекжан|null",
      "items_count": 2,
      "items_qty": "3.000",
      "discount_amount": "0.00",
      "total": "1000.00"
    }
  ]
}
```

- `summary` — по **всей** выборке с учётом фильтров (не по странице): `count` документов,
  `amount = Σ Document.total`, `discount_amount = Σ скидок документа и строк`,
  `items_qty = Σ DocumentItem.qty`.
- `total` и `amount` — после скидок (A8). Для `SALE_RETURN` — положительные числа
  (сумма возврата), знак не меняем.
- `items_count`, `items_qty` — аннотацией (`Count`, `Sum`), без N+1.
- `counterparty_display_name` — только название (D11); `agent_display` — ФИО агента или `null`.

**Производительность.** Индекс по `(doc_type, status, date)` у `warehouse_document` (если нет),
`select_related("warehouse_from__branch", "counterparty", "agent")`, сводка — одним
`aggregate`. Цель: < 300 мс на компании с 20 000 продаж за месяц.

### 7.16. История продаж партнёра — документ (новый)

`GET stock-partnerships/companies/{partner_company_id}/sales/{document_id}/`

- Доступ — как в §7.15. Документ обязан принадлежать партнёру и быть `SALE`/`SALE_RETURN`
  в статусе `POSTED`/`CASH_PENDING`, иначе `404 {"detail": "Документ не найден."}`
  (не раскрывать, что документ существует).
- Ответ — поля строки списка плюс:

```json
{
  "id": "<uuid>",
  "doc_type": "SALE",
  "number": "S-101",
  "date": "2026-10-01T10:00:00+06:00",
  "status": "POSTED",
  "payment_kind": "credit",
  "warehouse_from_name": "Основной",
  "branch_name": "Манас",
  "counterparty_display_name": "ИП Асан",
  "agent_display": "Бекжан",
  "discount_percent": "0.00",
  "discount_amount": "0.00",
  "total": "1000.00",
  "items": [
    {
      "id": "<uuid>",
      "product_name": "Нори",
      "product_article": "N-1",
      "unit": "шт",
      "qty": "2.000",
      "price": "300.00",
      "discount_percent": "0.00",
      "discount_amount": "0.00",
      "net_amount": "600.00"
    }
  ]
}
```

- `net_amount` — из A8 (`DocumentItem.net_amount`); до backfill — `qty × price − discount_amount`.
  Фронт считает так же, если поля нет.
- Не отдавать (D11): `comment`, `prepayment_*`, `counterparty` (UUID и реквизиты),
  `purchase_price`, `markup_percent`, `cash_register`, `payment_category`.

---

## 8. Фронт (сделано)

Работает и со старым, и с новым бэком. Новые эндпоинты фронт находит сам: если путь
отвечает `404/405` **не-JSON** (страница Django «Not Found»), фронт до перезагрузки
страницы считает эндпоинт отсутствующим и использует старый (`src/api/warehousePartnership.js`,
`isEndpointMissing`). JSON-ответ `404 {"detail": …}` считается обычной ошибкой.

| Что | Старый бэк | Новый бэк |
|---|---|---|
| Доступ к обмену, «Партнёру» в карточке товара, «Инкассация партнёров» | Только владелец/админ (фронт) | То же + 403 с бэка |
| Список складов партнёра | `catalog/`, товары листаются на клиенте | `warehouses/` + `warehouses/{id}/products/` с пагинацией |
| «Забрать у партнёра» | Жёлтое предупреждение «спишется сразу без подтверждения» | Подсказка по `partner_allows_direct_pull`; кнопка «Запросить», ответ 202 → «Запрос отправлен» |
| Вкладка «Запросы на товар и деньги» | Скрыта (`operations/` → 404) | Входящие: Подтвердить / Отклонить; исходящие: Отозвать |
| «Разорвать», «Может забирать у вас» | Скрыты (нет `partnership_id`) | Показаны |
| Поиск компаний для приглашения | `agents/companies/search/`, статус вычисляется на фронте | `companies/search/` с `partnership_status` |
| Цена строки перемещения | Закупочная цена своего товара; для товара партнёра 0 | Игнорируется, ставит сервер |
| Сальдо касс партнёра | Как отдаёт бэк | `null` → «—» |
| Филиал в аналитике партнёра | UUID не показывается | Название + селектор |
| История продаж партнёра (`/crm/warehouse/partners/:id/sales`) | Страница открывается, вместо таблицы — «станет доступна после обновления сервера» и ссылка на аналитику | Сводка, таблица с пагинацией, фильтры, состав документа |
| «Ваши продажи» / кнопка «Продажи» у партнёра | Переключателя нет, кнопка активна | Переключатель по `share_sales_history`; кнопка выключена при `partner_shares_sales_history = false` |

История продаж партнёра (`Analytics/PartnerSalesHistory.jsx`):

- входы: кнопка «Продажи» в списке партнёров, «История продаж» в аналитике партнёра
  (с тем же `partner_branch`);
- фильтры: «Продажи / Возвраты», статус («Все» / «Проведённые» / «Ожидают кассы»),
  период как в аналитике, поиск по номеру или покупателю (debounce 300 мс);
- сводка: количество, сумма после скидок, скидки, единиц товара;
- таблица: номер, дата, склад (филиал), покупатель, агент, позиций, сумма, статус;
  страницы по 50; при смене любого фильтра — первая страница;
- клик по строке → окно с составом документа (`sales/{id}/`);
- `403 sales_history_hidden` → текст из `detail`; эндпоинта нет → сообщение без ошибки.

Исправленные баги фронта:

- внутреннее перемещение из карточки товара уносило **весь остаток** — добавлено поле
  количества с проверкой;
- кнопки «Принять»/«Отклонить» и счётчик — только для заявок `PENDING`;
- приглашение: минимум 3 символа, своя компания / партнёры / открытые заявки — без кнопки;
- страница обмена сбрасывала страницу и поиск при открытии; смена направления не
  сбрасывала страницу (`usePagination` возвращал её в URL);
- модалку перемещения можно было закрыть во время отправки; неправильные склонения;
- `alert()` браузера заменён на модалки приложения; ошибки бэка без JSON-дампов;
- принятие заявки, разрыв, «без подтверждения», подтверждение операции — через подтверждение.

---

## 9. Сценарии для тестов (бэкенд)

| # | Сценарий | Ожидание |
|---|---|---|
| T1 | Сотрудник (не владелец/админ) вызывает `transfer/`, `cash-incassations/`, `catalog/`, `warehouses/`, `active/`, POST заявки | 403 |
| T2 | Агент вызывает любой эндпоинт партнёрства | 403 |
| T3 | Владелец A: transfer со своего склада на склад B | 201, `result=posted`, у A списано, у B оприходовано, `created_by`, `initiator_company=A`, `price = purchase_price` |
| T4 | Владелец A: transfer со склада B, `b_allows_direct_pull=false` | 202, операция PENDING, остатки не изменились, документов нет |
| T5 | То же, `b_allows_direct_pull=true` | 201, проведено |
| T6 | Владелец B подтверждает операцию из T4 | 200 APPROVED, документ проведён, `initiator_company=A` |
| T7 | Подтверждение при нехватке остатка | 400, операция остаётся PENDING, документов и движений нет |
| T8 | Владелец A пытается подтвердить свою операцию | 403 |
| T9 | Повторный approve после APPROVED | 400 «Операция уже обработана.» |
| T10 | Инкассация из кассы B без разрешения | 202 PENDING; после approve — пара проведённых документов |
| T11 | Две параллельные инкассации на сумму больше половины баланса | одна 201, вторая 400 «Недостаточно средств» |
| T12 | transfer, падающий на проведении | 400, в БД нет нового `Document` (ни DRAFT, ни POSTED) |
| T13 | terminate от A | партнёрство TERMINATED, событие, PENDING-операции → CANCELLED, `transfer/` → 400 «нет принятого партнёрства» |
| T14 | Новая заявка и accept после terminate | та же строка → ACTIVE, флаги сброшены, событие ACTIVATED |
| T15 | Unpost межкомпанейского TRANSFER владельцем отправителя | 403; владельцем получателя — 200 |
| T16 | Встречная заявка B→A при PENDING A→B | 400 `incoming_request_exists` |
| T17 | `companies/search/?search=ab` | 400; `search=abc` — ≤20, без своей компании, со статусами |
| T18 | `warehouses/` при `partner_allows_direct_pull=false` | `cash_registers[].balance = null` |
| T19 | `warehouses/{чужой склад не партнёра}/products/` | 404 |
| T20 | Межкомпанейский transfer товара, у получателя есть другой товар с тем же названием | Создаётся новая карточка, не склеивается |
| T21 | Удаление партнёрства через админку | Недоступно |
| T22 | `sales/` владельцем A при активном партнёрстве и `b_shares_sales_history = true` | 200; только `SALE` B в статусах `POSTED`/`CASH_PENDING`; черновики и `SALE_REQUEST` не попадают |
| T23 | `sales/` при `b_shares_sales_history = false` | 403 `sales_history_hidden` |
| T24 | `sales/` сотрудником (не владелец/админ), агентом, после terminate | 403 |
| T25 | `summary.amount` за месяц == сумма продаж в `owner/partners/{id}/analytics/` за тот же месяц и филиал | Равны (с учётом A7/A8/A13) |
| T26 | Мультискладская продажа партнёра без `warehouse_from` | Попадает в список (A13) |
| T27 | `sales/{id}/` с документом своей компании, чужой компании, `PURCHASE` партнёра, `DRAFT` партнёра | 404 во всех случаях |
| T28 | Ответ `sales/{id}/` | Нет `comment`, реквизитов покупателя, `purchase_price` (D11) |
| T29 | `date_from`–`date_to` больше 366 дней | 400 |
| T30 | `search=S-10` и `search=Асан` | Находит по номеру и по названию покупателя |

---

## 10. Разовая чистка данных на проде

1. **Висячие черновики** (П5). Проверить и удалить (только DRAFT без движений):

```sql
SELECT d.id, d.number, d.date, cf.name AS from_company, ct.name AS to_company
FROM warehouse_document d
JOIN warehouse_warehouse wf ON wf.id = d.warehouse_from_id
JOIN warehouse_warehouse wt ON wt.id = d.warehouse_to_id
JOIN users_company cf ON cf.id = wf.company_id
JOIN users_company ct ON ct.id = wt.company_id
WHERE d.doc_type = 'TRANSFER' AND wf.company_id <> wt.company_id
  AND d.status = 'DRAFT'
  AND NOT EXISTS (SELECT 1 FROM warehouse_stockmove m WHERE m.document_id = d.id);
-- ожидается 3 строки (01.06.2026, Сильвер Китчен ош → Сильвер Бишкек)
```

   Удаление — через Django (`Document.objects.filter(id__in=[…]).delete()`), с бэкапом.

2. **Миграция партнёрств:** существующим строкам `status=ACTIVE`, `activated_at=created_at`,
   `created_from_request` — по паре компаний из ACCEPTED-заявки; событие `ACTIVATED` задним
   числом. Флаги `*_allows_direct_pull = False`, `*_shares_sales_history = True`
   (сейчас партнёры уже видят аналитику друг друга — история продаж не расширяет доступ
   сверх ожидаемого; владельцам двух активных пар сообщить, что продажи можно скрыть).

3. **Удалённые партнёрства «Сильвер»** (§4): восстановить нельзя. Согласовать с клиентом
   («Сильвер Китчен ош», «Сильвер Бишкек», «Сильвер Манас»), нужно ли партнёрство
   Китчен↔Бишкек и Бишкек↔Манас; если да — заново через заявки. Для сети одного
   владельца предложить включить «может забирать без подтверждения».

4. **Цена в старых перемещениях:** не пересчитывать (документы проведены, денег не было).

---

## 11. Чек-лист приёмки

- [ ] Все эндпоинты §7 возвращают 403 сотруднику без роли владельца/админа и агенту (T1, T2).
- [ ] «Отдать» проводится сразу; «забрать» без разрешения партнёра → 202 и запрос (T3–T5).
- [ ] Владелец партнёра видит запрос во вкладке «Запросы на товар и деньги», подтверждает,
      товар/деньги движутся только после подтверждения (T6, T10).
- [ ] Ошибка проведения не оставляет черновиков (T12); повторный `SELECT` из §10.1 — 0 новых строк.
- [ ] Параллельные инкассации не уводят кассу в минус (T11).
- [ ] В документе межкомпанейского перемещения видны автор и компания-инициатор; цена = закупочная.
- [ ] Отменить проведение может только получатель (T15).
- [ ] Разрыв и повторное партнёрство работают, история в `CompanyStockPartnershipEvent` (T13, T14).
- [ ] В админке нельзя удалить партнёрство (T21).
- [ ] Поиск компаний: от 3 символов, ≤20, без своей компании, со статусом (T17).
- [ ] Каталог: `warehouses/` отвечает < 300 мс на компании с 5 000 товаров; товары листаются страницами.
- [ ] Сальдо касс партнёра скрыто без доверенного режима — в `warehouses/`, `catalog/` и
      `cash-registers/?include_partners=1` (T18, §7.14).
- [ ] Аналитика партнёра отдаёт `branch_name` и `partner_branches`.
- [ ] История продаж партнёра: список, сводка, фильтры, документ со строками (T22, T27, T30).
- [ ] Сводка истории продаж совпадает с аналитикой партнёра за тот же период (T25).
- [ ] Партнёр может скрыть свои продажи; после скрытия — 403 и выключенная кнопка «Продажи» (T23).
- [ ] В истории продаж нет комментариев, реквизитов покупателей и себестоимости (T28).
- [ ] На фронте после выката: появляются вкладка «Запросы на товар и деньги», «Разорвать»,
      переключатель; «Забрать» превращается в «Запросить» (без пересборки фронта).

---

## 12. Порядок выката и совместимость

| Этап | Бэкенд | Риск для старого фронта |
|---|---|---|
| 0 | Чистка §10.1, бэкап | нет |
| 1 (P0) | Права §7 (`user_can_manage_partnership`), транзакция в transfer (П5), блокировка в инкассации (П6), `created_by`/`initiator_company` у `Document`, unpost §7.11, запрет удаления в админке | нет: фронт уже не даёт сотрудникам эти действия |
| 2 (P0) | Модели §6.1–6.3, миграция §10.2, `active/` §7.2, terminate/settings §7.3–7.4, операции §7.10, поведение transfer/incassation §7.8–7.9 | старые сборки фронта получат 202 на «забрать»: покажут «Перемещение проведено», хотя ушёл запрос. Выкатывать после фронта из этой ветки |
| 3 (P1–P2) | Поиск §7.5, `warehouses/` §7.6–7.7, сальдо §7.14, сопоставление §7.12, встречные заявки П10, аналитика §7.13 | нет |
| 3б (P1) | История продаж §7.15–7.16 и флаг `*_shares_sales_history` (§6.1, §7.2, §7.4). Независима от этапа 2: если этап 2 ещё не выкачен — добавить в миграцию только поля `a_/b_shares_sales_history`, а в `active/` — `share_sales_history`, `partner_shares_sales_history` | нет: до выката страница показывает «станет доступна после обновления сервера» |
| 4 | Удалить `catalog/` (через 2 релиза) | старые сборки фронта — откат на `catalog/` сломается; к этому времени их нет |

---

## 13. Связанные файлы фронта

| Файл | Что |
|---|---|
| `src/api/warehousePartnership.js` | Новые эндпоинты, откат на старые, `PartnershipApiError` со статусом |
| `src/Components/Sectors/Warehouse/Warehouses/partnership/partnershipHelpers.js` | Ошибки, склонения, `partnerPullMode`, `isPendingOperationResponse`, статусы приглашения |
| `…/Warehouses/partnership/PartnershipRequestsTable.jsx` | Заявки (действия только для PENDING) |
| `…/Warehouses/partnership/PartnerOperationsTable.jsx` | Запросы на товар и деньги |
| `…/Warehouses/partnership/PartnersTable.jsx` | Партнёры, разрыв, «может забирать у вас» |
| `…/Warehouses/partnership/PartnershipInviteModal.jsx` | Приглашение |
| `…/Warehouses/components/StockPartnershipPanel.jsx` | Вкладка «Партнёры» на странице складов |
| `…/Warehouses/components/StockPartnershipTransferModal.jsx` | Перемещение/запрос товара |
| `…/Warehouses/PartnerCatalogPage.jsx` | Обмен товаром с партнёром |
| `…/Products/WarehouseMoveProductModal.jsx` | Перемещение из карточки товара |
| `…/Kassa/WarehouseKassa.jsx` | `PartnerCashIncassationPanel` |
| `…/Analytics/PartnerAnalyticsDetail.jsx`, `PartnerAnalyticsOwnerGate.jsx` | Аналитика, доступ, ссылка на историю продаж |
| `…/Analytics/PartnerSalesHistory.jsx` | История продаж партнёра |
| `…/Analytics/PartnerSaleDetailModal.jsx` | Состав документа продажи |
| `…/Analytics/partnerSalesModel.js` | Параметры запроса, разбор ответа, сумма строки |
| `src/config/routes/warehouseRoutes.jsx` | `/warehouse/partners/:partnerId` и `/warehouse/partners/:partnerId/sales` под проверкой роли |

Тесты: `src/api/warehousePartnership.test.js`, `…/partnership/partnershipHelpers.test.js`,
`…/components/StockPartnershipPanel.test.jsx`, `…/components/StockPartnershipTransferModal.test.jsx`,
`…/Products/WarehouseMoveProductModal.test.jsx`, `…/Analytics/PartnerSalesHistory.test.jsx`,
`…/Analytics/partnerSalesModel.test.js`.
