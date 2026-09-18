/**
 * Консалтинг: абонентка — матрица, график клиента, оплата периода.
 *
 * Контракт: docs/consulting/subscription-matrix.md,
 * docs/consulting/backend-money-tenant/01-subscription.md
 */
import { BASE, cGet, cPatch, cPost } from "./consultingHttp";

export const SUBSCRIPTION_PAYMENT_STATUS = {
  PLANNED: "planned",
  PAID: "paid",
  OVERDUE: "overdue",
  CANCELED: "canceled",
  /** Бэкенд: scheduled | pending — маппим в UI как planned */
  SCHEDULED: "scheduled",
  PENDING: "pending",
};

/** Статусы платежа, по которым можно нажать «Оплатить». */
export const PAYABLE_SUBSCRIPTION_STATUSES = new Set([
  SUBSCRIPTION_PAYMENT_STATUS.PLANNED,
  SUBSCRIPTION_PAYMENT_STATUS.OVERDUE,
  SUBSCRIPTION_PAYMENT_STATUS.SCHEDULED,
  SUBSCRIPTION_PAYMENT_STATUS.PENDING,
]);

/**
 * Бэкенд: scheduled, pending, paid, overdue, canceled.
 * UI/ТЗ: planned, paid, overdue, canceled.
 */
export function normalizeSubscriptionPaymentStatus(raw) {
  const s = String(raw || "").toLowerCase();
  if (s === "scheduled" || s === "pending") return SUBSCRIPTION_PAYMENT_STATUS.PLANNED;
  if (s === "paid") return SUBSCRIPTION_PAYMENT_STATUS.PAID;
  if (s === "overdue") return SUBSCRIPTION_PAYMENT_STATUS.OVERDUE;
  if (s === "canceled" || s === "cancelled") return SUBSCRIPTION_PAYMENT_STATUS.CANCELED;
  if (s === "planned") return SUBSCRIPTION_PAYMENT_STATUS.PLANNED;
  return s || SUBSCRIPTION_PAYMENT_STATUS.PLANNED;
}

export function isPayableSubscriptionStatus(raw) {
  const s = String(raw || "").toLowerCase();
  return PAYABLE_SUBSCRIPTION_STATUSES.has(s) || s === "scheduled" || s === "pending";
}

/**
 * Абонентская матрица за период.
 * GET /consalting/subscription-matrix/
 */
export const getSubscriptionMatrix = (params = {}, config) =>
  cGet(
    "Get Subscription Matrix Error",
    `${BASE}/subscription-matrix/`,
    params,
    config,
  );

/**
 * Подключённые абонентки клиента + график платежей.
 * GET /consalting/clients/{id}/subscriptions/
 */
export const getClientSubscriptions = (clientId, config) =>
  cGet(
    "Get Client Subscriptions Error",
    `${BASE}/clients/${clientId}/subscriptions/`,
    {},
    config,
  );

/**
 * Оплата одного периода абонентки → заявка в кассу kind=subscription.
 * POST /consalting/subscription-payments/{id}/pay/
 * @param {string|number} paymentId - SubscriptionPayment.id
 * @param {Object} payload - { cashbox?, payment_method: "cash"|"transfer", amount, note? }
 */
export const paySubscriptionPayment = (paymentId, payload) =>
  cPost(
    "Pay Subscription Payment Error",
    `${BASE}/subscription-payments/${paymentId}/pay/`,
    payload,
  );

/**
 * Продлить график абонентки на N периодов вперёд (месяцев — при
 * `period="month"`, лет — при `period="year"`). Бэкенд дозаписывает строки
 * `SubscriptionPayment` начиная сразу после последней существующей, не трогая
 * уже созданные (в т.ч. оплаченные) периоды.
 * POST /consalting/subscriptions/{id}/extend/
 * @param {string|number} subscriptionId
 * @param {{ periods?: number, amount?: number }} payload - periods >=1 (дефолт 12);
 *   amount — опционально, если нужно продлить сразу по новой цене (иначе берётся
 *   текущая Subscription.amount).
 * Контракт: docs/consulting/backend-money-tenant/01-subscription.md §5.8.
 */
export const extendSubscriptionSchedule = (subscriptionId, payload = {}) =>
  cPost(
    "Extend Subscription Schedule Error",
    `${BASE}/subscriptions/${subscriptionId}/extend/`,
    payload,
  );

/**
 * Изменить абонентскую цену. Уже оплаченные периоды не трогаются — новая
 * сумма применяется только к будущим (`planned`/`overdue`) строкам графика.
 * PATCH /consalting/subscriptions/{id}/
 * @param {string|number} subscriptionId
 * @param {{ amount: number }} payload
 * Контракт: docs/consulting/backend-money-tenant/01-subscription.md §5.8.
 */
export const updateSubscriptionAmount = (subscriptionId, payload) =>
  cPatch(
    "Update Subscription Amount Error",
    `${BASE}/subscriptions/${subscriptionId}/`,
    payload,
  );

/**
 * Разворачивает payments из ответа subscriptions в плоский список для UI-календаря.
 * @param {object} data - ответ GET subscriptions (results или массив)
 * @returns {Array<object>}
 */
export function flattenSubscriptionPayments(data) {
  const subs = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data)
      ? data
      : [];
  const rows = [];
  for (const sub of subs) {
    const payments = sub.payments || [];
    for (const p of payments) {
      const status = normalizeSubscriptionPaymentStatus(p.status);
      rows.push({
        ...p,
        status,
        subscription_id: sub.id,
        subscription_amount: sub.amount,
        subscription_period: sub.period,
        subscription_status: sub.status,
        service_display: sub.service_display,
        tariff_display: sub.tariff_display,
        period: p.period_month || p.period,
        payment_id: p.id,
      });
    }
  }
  return rows.sort((a, b) =>
    String(a.period_month || a.period || "").localeCompare(
      String(b.period_month || b.period || ""),
    ),
  );
}
