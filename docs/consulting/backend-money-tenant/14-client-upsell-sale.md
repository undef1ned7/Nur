# 14. Доп. продажа действующему клиенту (свободные позиции)

**Приоритет:** P2 — новая функция для продажников.
**Дата:** 09.09.2026
**Фронт:** `src/Components/Sectors/Consulting/client/ConsultingClientDetail.jsx`
(`AddSaleModal`, `handleAddSale`), `src/api/consultingSales.js`
(`createConsultingSaleApi`).
**Связано:** [01-subscription.md](./01-subscription.md)
(`create_sale_side_effects`), [03-cash-confirmation.md](./03-cash-confirmation.md),
[02-sale-cancel.md](./02-sale-cancel.md),
[05-analytics-kpi.md](./05-analytics-kpi.md).

---

## 1. Задача

В карточке клиента `/crm/consulting/client/{id}` — кнопка **«+ Докупить услугу»**,
открывает модалку **«Доп. продажа»**. Продажник вручную вбивает **свободные
позиции** — название + цена + количество (напр. «Умные весы», «Доставка»,
«Настройка оборудования») — выбирает способ оплаты (или рассрочку на N месяцев)
и оформляет продажу на **действующего клиента**.

**Это НЕ услуги из `/crm/consulting/services`.** Каталог здесь не используется:
позиции произвольные, вводятся текстом. Ни `services`, ни `tariff` в запросе нет.

Результат должен быть тем же, что у обычной продажи: `Sale` + касса + начисление
зарплаты + аналитика (+ расписание при рассрочке).

## 2. Контракт API

Используется **существующий** эндпоинт (новых роутов не требуется):

```
POST /consalting/sales/
```

### 2.1. Тело запроса (то, что шлёт фронт)

```jsonc
{
  "client": "<client_uuid>",           // обязателен — действующий клиент
  "items": [                            // 1..N свободных позиций
    { "name": "Умные весы", "price": 3500, "quantity": 1 },
    { "name": "Доставка",   "price": 300,  "quantity": 1 }
  ],
  "amount": 3800,                       // = Σ(price × quantity), посчитан фронтом
  "payment_mode": "cash" | "transfer" | "installment",
  "status": "Продажа" | "Предоплата",  // RU-строка — совместимость с sale.jsx
  "debt_months": 3,                     // только для рассрочки (installment)
  "description": "Умные весы + ещё 1",  // авто из первой позиции либо коммент
  "kind": "addon",                     // НОВОЕ — пометка «доп. продажа вне тарифа»
  "source": "client_card",             // НОВОЕ — источник для аналитики
  "idempotency_key": "<uuid>"          // защита от дабл-сабмита
}
```

### 2.2. Обработка

| Поле | Поведение бэка |
|---|---|
| `items` | Массив позиций чека. `name` — обязателен (строка), `price ≥ 0` (реально > 0, фронт валидирует), `quantity` — целое ≥ 1. Каждая позиция = строка `SaleItem`. `services`/`tariff` при этом **не переданы** — сериализатор должен допускать продажу **без услуги из каталога**, только по `items`. |
| `amount` | Канон суммы (фронт уже перемножил `price × quantity` и просуммировал). Если не пришёл — бэк считает сам из `items`. |
| `kind` | `"addon"` → `Sale.kind`. Добавить в choices (рядом с `sale`/`subscription`). Нужно, чтобы отделять допродажи в аналитике и в истории сделок. Неизвестное значение → трактовать как обычную продажу. |
| `source` | Свободная строка (`client_card`, `funnel`, `sale_page`). `Sale.source` (`CharField(max_length=32, blank=True, db_index=True)`). Отсутствие поддержки → игнор. |
| `idempotency_key` | Продажа с тем же ключом в компании за 24 ч → вернуть её же (`200`), не дублировать. |

### 2.3. Ответ

`201` + сериализованная `Sale` (как обычная продажа): `id`, `client`,
`amount`/`total`, `kind`, `status`, `payment_mode`, `items[]`, `created_at`,
`deal_id`, `cash_request_id`, при рассрочке — `schedule`/`installment`.

Ошибки:

- `400 {"detail": "..."}` — нет `client`; пустой `items`; позиция без `name`;
  `amount <= 0`.
- `404` — клиент не найден в компании.
- Конфликт `idempotency_key` — не ошибка, а возврат существующей продажи (2.2).

## 3. Сайд-эффекты (обязательно, атомарно)

Тот же `create_sale_side_effects`, что и для продажи из лида
([01-subscription.md §4](./01-subscription.md)):

1. **`Sale`** (`kind="addon"`, `client=<client>`, `lead=null`,
   `source="client_card"`) + строки `SaleItem` из `items`.
2. **`CashRequest`** `kind="sale"` на `amount` (для `cash`/`transfer`) — ждёт
   кассира ([03-cash-confirmation.md](./03-cash-confirmation.md)).
   Для `installment` — расписание платежей на `debt_months`, первый →
   `CashRequest`.
3. **Начисление зарплаты** продавцу (`request.user`) — ставка по проценту
   сотрудника, т.к. услуги из каталога (и её ставки) здесь нет
   ([../salary-auto-accrual.md](../salary-auto-accrual.md)).
4. **Аналитика** — продажа в `/consalting/sales/` и в KPI; срез
   `kind="addon"` / `source="client_card"` = выручка с допродаж
   ([05-analytics-kpi.md](./05-analytics-kpi.md)).
5. **Tenant не трогать** — разовые позиции не создают CRM-аккаунт и не меняют
   `end_date`.
6. Идемпотентность по `idempotency_key` — повтор не дублирует 1–4.

Отмена (`POST /consalting/sales/{id}/cancel/`,
[02-sale-cancel.md](./02-sale-cancel.md)) — обычный атомарный откуп; `lead_action`
не применяется (лида нет).

## 4. Права

- Оформлять может любой сотрудник с доступом к продажам консалтинга
  (owner/admin/rop/salesperson). Salesperson — только для клиентов, которых он
  видит ([07-seller-access-isolation.md](./07-seller-access-isolation.md));
  supervisor — в пределах своих регионов
  ([12-regional-supervisor-rbac.md](./12-regional-supervisor-rbac.md)).
- `client` должен принадлежать компании пользователя, иначе `404`.

## 5. Что делает фронт (готово)

- **`AddSaleModal`** — модалка «Доп. продажа»: список строк-позиций
  (`Название` + `Цена` + степпер количества + удалить), кнопка «+ Позиция»;
  сегмент-контрол оплаты (Наличными / Переводом / Картой / **Рассрочка**),
  при рассрочке — чипы месяцев (2–24); комментарий; в футере — «Итого» = сумма
  позиций и кнопка «Оформить».
- **`handleAddSale`** → `createConsultingSaleApi(dto)` (раздел 2.1).
- **Фолбэк:** при `404`/`501` (нет `/consalting/sales/`) — `POST
  /main/clients/{id}/deals/` (`createDeals`) c `title` = первая позиция, чтобы
  продажа не потерялась; касса/зарплата в этом режиме не создаются.
- После успеха — `reload()`: новая сделка в «Истории сделок», при рассрочке —
  строки в «Абонентских платежах».
- **`LeadPaymentModal`** (воронка) — блок «Доп. услуги» со строками
  `{name, price, qty}`; их сумма прибавляется к «Сумма, с *» (строка «Итого»),
  уходит в `POST /consalting/leads/{id}/register-payment/` полем `items` +
  общим `amount`. См. §6.

## 6. Второй вход: доп. услуги при оплате по лиду

Кроме карточки клиента, доп. позиции можно добавить прямо в момент оплаты лида
в воронке — модалка **«Оформить оплату по лиду»**
(`Funnel/LeadPaymentModal.jsx`). Там появился блок **«Доп. услуги»** со строками
`{ name, price, qty }` и кнопкой «+ Доп. услуга». Их сумма прибавляется к полю
«Сумма, с *» и показывается строкой **«Итого: Сумма + доп. услуги = …»**.

### 6.1. Контракт

Эндпоинт — **существующий**:

```
POST /consalting/leads/{id}/register-payment/
```

Фронт добавляет в тело **одно новое поле**:

```jsonc
{
  "payment_mode": "cash",
  "amount": 8000,               // УЖЕ включает доп. услуги (base + Σ items)
  "note": "...",
  // существующие поля абонентки: subscription_enabled / _amount / _period /
  // _start / subscription_prepaid_periods / paid_months  — без изменений
  "items": [                    // НОВОЕ — разовые позиции, 0..N
    { "name": "Умные весы", "price": 3000, "quantity": 1 }
  ]
}
```

### 6.2. Поведение бэка

- `items` — массив позиций. Каждая → строка `SaleItem` у создаваемой
  продажи/сделки лида. `name` обязателен, `price > 0`, `quantity ≥ 1`.
- `amount` **уже содержит** сумму позиций. Бэк **не должен** прибавлять `items`
  к `amount` повторно — только сверить или довериться `amount`.
- **Три режима — зависят от `subscription_enabled` + `subscription_autorenew`
  (см. [01-subscription.md §5.6](./01-subscription.md)):**

  | Режим | Признаки в запросе | Что делает бэк с `items` |
  |---|---|---|
  | **Разовые** (галочки нет, `N = 1`) | нет `subscription_*` | `items` → строки чека, разовый платёж. `amount = base + Σ items`. |
  | **Фикс. график за N мес.** (галочки нет, `N > 1`) | `subscription_enabled: true`, `subscription_autorenew: false` | `items` → **разовые** строки чека (в `subscription_amount` НЕ входят). `subscription_amount = base/N`, график на `N` периодов, все оплачены. `amount = base(за N мес.) + Σ items`. |
  | **Подписка** (галочка «Вести как подписку») | `subscription_enabled: true`, `subscription_autorenew: true` | `items` **входят в ежемесячную** ставку: `subscription_amount = база/мес + Σ items`. `items` записать как расшифровку, **отдельным разовым платежом не выставлять**. `amount = subscription_amount × subscription_prepaid_periods`. |

  Пример «подписка»: база 1300/мес + «умные весы» 1200 + «модуль» 1250,
  `subscription_prepaid_periods = 3` →
  `subscription_amount = 3750`, `amount = 11 250`, график по 3750/мес, 3 оплачены.
- Касса: `CashRequest`/`CashOperation` — на полный `amount` (вместе с доп.
  услугами). Одна заявка, не отдельная на каждую позицию.
- Зарплата и аналитика — как для обычного `register-payment`; позиции
  учитываются в сумме продажи и в срезе `kind`/`source` при наличии.
- Для `payment_mode` `debt`/`installment`: рекомендуется относить сумму
  `items` к **первому платежу** (не размазывать разовые товары по графику),
  но окончательное решение — за бэком; фронт шлёт только общий `amount` +
  `items`.
- Обратная совместимость: `items` отсутствует / пустой → прежнее поведение.
- Фолбэк-режим фронта (нет `/consalting/sales/`-логики, старый бэк) уже
  дописывает названия позиций в примечание сделки — данные не теряются.

### 6.3. Чек-лист (доп. услуги при оплате лида)

- [ ] Разовый режим (`N=1`, без `subscription_*`): `items` → строки `SaleItem`,
      `CashRequest` на `amount = base + Σ items`; график не создаётся.
- [ ] Фикс. график (`subscription_autorenew=false`, `N>1`): график ровно на `N`
      периодов, все `paid`; `items` — разовые строки, в `subscription_amount` не
      входят; `amount = base(за N мес.) + Σ items`.
- [ ] Подписка (`subscription_autorenew=true`): `subscription_amount = база +
      Σ items`, `amount = subscription_amount × N`; `items` НЕ создают отдельный
      разовый платёж.
- [ ] `amount` не дублируется (позиции не прибавляются повторно).
- [ ] Пустой/отсутствующий `items` — поведение не изменилось.

---

## 7. Чек-лист приёмки

- [ ] `POST /consalting/sales/` с `client`, `items:[{name,price,quantity}]`,
      `amount`, без `services`/`tariff` → `201`, создан `Sale(kind="addon")` +
      `SaleItem` по каждой позиции + `CashRequest kind=sale` на `amount`.
- [ ] Сериализатор не требует `services`/`tariff`, если есть непустой `items`.
- [ ] После подтверждения кассиром — приход в кассе консалтинга, начисление
      зарплаты продавцу, продажа в аналитике.
- [ ] `kind="addon"` и `source="client_card"` сохранены; в аналитике есть срез
      по допродажам.
- [ ] `payment_mode:"installment"` + `debt_months:3` → расписание на 3 платежа,
      первый → `CashRequest`.
- [ ] Повтор с тем же `idempotency_key` не создаёт вторую продажу.
- [ ] Доп. продажа **не** меняет tenant/`end_date`.
- [ ] Отмена продажи откатывает кассу/зарплату/аналитику атомарно.
- [ ] Salesperson не может оформить продажу на чужого клиента.
