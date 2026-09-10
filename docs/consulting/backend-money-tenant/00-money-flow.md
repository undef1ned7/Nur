# Консалтинг — единый денежный контур

**Дата:** 02.09.2026  
**Префикс API:** `/api/consalting/`  
**Фронт:** `VITE_CONSULTING_CASH_V2=true` (по умолчанию включён)

---

## 1. Задача

Сейчас деньги в консалтинге проходят **тремя несвязанными путями**:

| Путь | API | Проблема |
|------|-----|----------|
| Fallback воронки | `/main/clients/{id}/deals/` | Нет абонентки, кассы, tenant |
| Продажи UI | `/construction/cashflows/` | Мимо `CashRequest` |
| Абонплата UI | `/main/debts/` через deals | Мимо `SubscriptionPayment` |

Цель — **один контур** на backend: все side-effects в `create_sale_side_effects` и
`confirm_cash_request`.

---

## 2. Целевая схема

```
Лид / Продажа
    → POST register-payment | POST sales | win
        → create_sale_side_effects (transaction.atomic)
            → Sale
            → Subscription + график (если абонентка)
            → SalaryAccrual (stub / полная схема)
            → CashRequest (pending) ИЛИ CashOperation (если confirm off)
    → Кассир: POST cashbox/requests/{id}/confirm/
        → CashOperation (источник остатка)
        → Sale.status = completed
        → provision_tenant_account (kind=sale)
        → SubscriptionPayment.status = paid + extend (kind=subscription)
```

**Остаток кассы** = сумма только `CashOperation`.  
**Выручка в аналитике** = `Sale` (completed − canceled − refunded).  
**Факт денег** = `CashOperation` income.

---

## 3. Deprecated paths (удалить на фронте при V2)

| Файл | Deprecated | Замена |
|------|------------|--------|
| `funnelThunk.js` | fallback `POST /main/clients/.../deals/` | `POST /consalting/leads/{id}/register-payment/` |
| `sale.jsx` | `createDeal` + `addCashFlows` | `POST /consalting/sales/` |
| `ConsultingClientDetail.jsx` | `payDebtDeal` | `POST /consalting/subscription-payments/{id}/pay/` |
| `Kassa.jsx` | `/construction/cashboxes/` | `/consalting/cashbox/cashboxes/` |
| `Reports.jsx` | `/construction/cashflows/` | `/consalting/cashbox/operations/` |
| `clientCreators.js` | `/main/clients/.../subscription-schedule/` | `/consalting/clients/{id}/subscriptions/` |

---

## 4. CashRequest kinds

| kind | direction | Источник |
|------|-----------|----------|
| sale | income | Продажа / register-payment |
| subscription | income | Оплата периода абонентки |
| handover | income | Сдача наличных сотрудником |
| refund | expense | Отмена / возврат продажи |

---

## 5. Настройки подтверждения

`GET/PUT /consalting/cashbox/confirmation-settings/`

| mode | Поведение |
|------|-----------|
| always | Всегда заявка, Sale = pending_confirmation |
| cash_only | Заявка только для наличных (default) |
| off | Сразу CashOperation + side-effects |

---

## 6. Отмена продажи

`POST /consalting/sales/{id}/cancel/` — атомарный откат:

1. Subscription → cancel future payments
2. Installment → cancel
3. SalaryAccrual → cancel / deduction
4. CashRequest pending → canceled; refund → новая заявка
5. Lead → return_to_work / reject

См. [02-sale-cancel.md](./02-sale-cancel.md).

---

## 7. Аналитика (разделение KPI)

| KPI | Источник |
|-----|----------|
| revenue | Sum(Sale.total) where completed |
| net_revenue | revenue − cancellations − refunds |
| paid_income | Sum(CashOperation) income |
| pending_cash | Sum(CashRequest) pending amount |
| subscription_mrr | SubscriptionPayment planned/paid |
| on_hands | employee_finance (07) |

---

## 8. Порядок реализации backend

См. [README.md](./README.md).

**5 → 8 → 9 → 10** (абонентка, отмена, касса, tenant) — первыми.

---

## 9. Флаг фронта

```env
# .env — единый денежный контур consalting (default: true)
VITE_CONSULTING_CASH_V2=true
```

При `false` — legacy fallback для переходного периода (не рекомендуется в prod).

Утилита: `src/utils/consultingMoney.js` → `isConsultingCashV2()`.

---

## 10. Чек-лист «деньги сходятся»

- [ ] Нет записей в `/construction/cashflows/` из консалтинга.
- [ ] Нет `/main/deals/` из register-payment fallback.
- [ ] Остаток кассы = operations, не requests.
- [ ] pending_amount виден в UI до confirm.
- [ ] Абонплата: матрица = карточка клиента = SubscriptionPayment.
- [ ] reconciliation.discrepancy = 0 на тестовых данных.
