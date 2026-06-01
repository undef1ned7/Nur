# История продаж POS — API для бэкенда

Эндпоинт **`GET /api/main/pos/sales/`** используется в нескольких разделах CRM. На фронте общий парсер ответа: `src/tools/posSalesListResponse.js` (`meta.total_amount`, `results`, `count`).

**Базовый префикс:** `/api/main/`

---

## Где используется на фронте

| Раздел | Маршрут / компонент | Запрос |
|--------|---------------------|--------|
| Маркет | `/crm/sell` → `Sell.jsx` | `historySellProduct` → `/main/pos/sales/` |
| Производство (владелец/админ) | Продажи → `ProductionSell.jsx` | `getAllProductionSalesList` → `/main/pos/sales/` |
| Производство (агент) | то же | `getAgentSalesList` → `/main/agents/me/sales/` (отдельный URL, при возможности — тот же `meta.total_amount`) |
| Смена маркета | `ShiftPage.jsx` | прямой `api.get("/main/pos/sales/", { shift })` |
| Агенты производства | `ProductionAgents.jsx` | `historySellProduct` (вкладка истории) |
| Филиал | `BranchDetails.jsx` | `historySellProduct({ branch })` |

Оплата с отсрочкой и предоплатой (checkout `payment_method: debt`, `createDeal`, тариф **Старт** → `/main/debts/`):

| Раздел | Компонент |
|--------|-----------|
| Маркет-касса | `Sectors/Market/CashierPage/PaymentPage.jsx` |
| Касса «Старт» / общая | `/crm/sell/start` → `SellCashierPage` → `pages/Sell/Cashier/PaymentPage.jsx` |
| Продажа «Старт» (legacy) | `SellMainStart.jsx` + `DebtModal` |
| Производство — продажа | `ProductionAgents/SellStart/SellStart.jsx` |

---

## `GET /api/main/pos/sales/`

### Query-параметры (использует фронт)

| Параметр | Описание |
|----------|----------|
| `page` | Номер страницы |
| `limit` | Размер страницы (маркет `/crm/sell` — `100`) |
| `search` | Поиск |
| `user` | UUID продавца |
| `date_from` / `date_to` | Период (`YYYY-MM-DD`, маркет) |
| `start` / `end` | Период (производство) |
| `client` | UUID клиента |
| `status` | Статус продажи |
| `ordering` | Сортировка (производство) |
| `shift` | UUID смены (касса смены) |

### Ответ (DRF pagination)

```json
{
  "count": 240,
  "next": "…",
  "previous": null,
  "results": [ … ],
  "meta": {
    "total_amount": "458900.00"
  }
}
```

### `meta.total_amount`

| Поле | Описание |
|------|----------|
| `meta.total_amount` | Сумма **всех** продаж по текущим фильтрам, **без** учёта `page` / `limit`. |

**Правила:**

1. Учитываются те же фильтры, что и для списка.
2. Сумма по одной продаже — поле `total`.
3. Не суммировать только `results` текущей страницы.
4. Отменённые (`canceled`) — не включать в агрегат или согласовать с `status`.

---

## Checkout и долги (кратко)

- **Отсрочка:** `POST` checkout с `payment_method: "debt"`; при предоплате — `cash_received` = сумма предоплаты.
- **Сделка:** `createDeal` с `debtDays`, `first_due_date`, опционально `prepayment`.
- **Тариф «Старт»:** дополнительно `POST /main/debts/` на **остаток** долга (сумма заказа минус предоплата).

Хелперы дат: `src/tools/deferredPaymentDates.js`.
