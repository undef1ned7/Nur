/**
 * Консалтинг: касса — операции с фильтрами, заявки на подтверждение прихода
 * (ТЗ №9) и сдача наличных сотрудником (ТЗ №7).
 *
 * Контракт: docs/consulting/backend/09-cash-confirmation.md,
 * docs/consulting/backend/07-employee-finance.md.
 *
 * Ключевое правило учёта: неподтверждённая заявка НЕ входит в остаток кассы.
 * Поэтому список заявок и список операций — разные ресурсы.
 */
import { BASE, cGet, cPost, cPut } from "./consultingHttp";

const URL_CASH = `${BASE}/cashbox`;

export const CASH_REQUEST_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  REJECTED: "rejected",
};

export const CASH_REQUEST_STATUS_LABELS = {
  [CASH_REQUEST_STATUS.PENDING]: "Ожидает подтверждения",
  [CASH_REQUEST_STATUS.CONFIRMED]: "Подтверждено",
  [CASH_REQUEST_STATUS.REJECTED]: "Отклонено",
};

/** Что породило заявку — от этого зависит текст в списке и права. */
export const CASH_REQUEST_KIND = {
  SALE: "sale", // приход по продаже
  HANDOVER: "handover", // сотрудник сдаёт наличные
  REFUND: "refund", // возврат клиенту (расход)
  SUBSCRIPTION: "subscription", // абонентский платёж
};

export const CASH_REQUEST_KIND_LABELS = {
  [CASH_REQUEST_KIND.SALE]: "Продажа",
  [CASH_REQUEST_KIND.HANDOVER]: "Сдача наличных",
  [CASH_REQUEST_KIND.REFUND]: "Возврат клиенту",
  [CASH_REQUEST_KIND.SUBSCRIPTION]: "Абонентский платёж",
};

export const CASH_REJECT_REASONS = [
  { value: "no_money", label: "Деньги не поступили" },
  { value: "amount_mismatch", label: "Сумма не совпадает" },
  { value: "other_method", label: "Оплата прошла другим способом" },
  { value: "duplicate", label: "Дубль операции" },
  { value: "other", label: "Другое" },
];

/* ==================== ЗАЯВКИ НА ПОДТВЕРЖДЕНИЕ ==================== */

/**
 * Список заявок на подтверждение.
 * GET /consalting/cashbox/requests/
 * @param {Object} params - status, kind, user, cashbox, date_from, date_to,
 *   search, page, page_size
 */
export const listCashRequests = (params = {}, config) =>
  cGet("List Cash Requests Error", `${URL_CASH}/requests/`, params, config);

/**
 * Счётчики по статусам заявок (для бейджа на вкладке кассы).
 * GET /consalting/cashbox/requests/counters/
 * @returns {{ pending, confirmed, rejected, pending_amount }}
 */
export const getCashRequestCounters = (params = {}, config) =>
  cGet(
    "Cash Request Counters Error",
    `${URL_CASH}/requests/counters/`,
    params,
    config,
  );

/**
 * Подтвердить приход — только после этого деньги попадают в остаток кассы.
 * POST /consalting/cashbox/requests/{id}/confirm/
 * @param {Object} payload - { cashbox?: uuid, comment?: string }
 */
export const confirmCashRequest = (id, payload = {}) =>
  cPost(
    "Confirm Cash Request Error",
    `${URL_CASH}/requests/${id}/confirm/`,
    payload,
  );

/**
 * Отклонить заявку. Причина обязательна — менеджер должен понимать, что делать.
 * POST /consalting/cashbox/requests/{id}/reject/
 * @param {Object} payload - { reason, comment? }
 */
export const rejectCashRequest = (id, payload) =>
  cPost(
    "Reject Cash Request Error",
    `${URL_CASH}/requests/${id}/reject/`,
    payload,
  );

/**
 * Сдача наличных сотрудником: создаёт заявку kind="handover".
 * POST /consalting/cashbox/handovers/
 * @param {Object} payload - { amount, comment?, cashbox? }
 */
export const createCashHandover = (payload) =>
  cPost("Create Cash Handover Error", `${URL_CASH}/handovers/`, payload);

/* ==================== ОПЕРАЦИИ И НАСТРОЙКИ ==================== */

/**
 * Кассовые операции (подтверждённые) с разрезом по сотруднику.
 * GET /consalting/cashbox/operations/
 * @param {Object} params - cashbox, type (income|expense), user, kind,
 *   date_from, date_to, search, page, page_size
 */
export const listCashOperations = (params = {}, config) =>
  cGet("List Cash Operations Error", `${URL_CASH}/operations/`, params, config);

/**
 * Сверка по сотрудникам за период: продал / принял налом / сдал / на руках.
 * GET /consalting/cashbox/reconciliation/
 * @param {Object} params - date_from, date_to, user, page, page_size
 */
export const getCashReconciliation = (params = {}, config) =>
  cGet(
    "Cash Reconciliation Error",
    `${URL_CASH}/reconciliation/`,
    params,
    config,
  );

/**
 * Настройки подтверждения прихода.
 * GET/PUT /consalting/cashbox/confirmation-settings/
 * @returns {{ mode: "always"|"cash_only"|"off", skip_for_cashier: boolean,
 *   overdue_hours: number }}
 */
export const getCashConfirmationSettings = (config) =>
  cGet(
    "Get Cash Confirmation Settings Error",
    `${URL_CASH}/confirmation-settings/`,
    {},
    config,
  );

export const updateCashConfirmationSettings = (payload) =>
  cPut(
    "Update Cash Confirmation Settings Error",
    `${URL_CASH}/confirmation-settings/`,
    payload,
  );
