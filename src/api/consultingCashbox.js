/**
 * Консалтинг: касса — операции с фильтрами, заявки на подтверждение прихода
 * (ТЗ №9) и сдача наличных сотрудником (ТЗ №7).
 *
 * Контракт: docs/consulting/backend-money-tenant/03-cash-confirmation.md,
 * docs/consulting/backend/07-employee-finance.md.
 *
 * Ключевое правило учёта: неподтверждённая заявка НЕ входит в остаток кассы.
 * Поэтому список заявок и список операций — разные ресурсы.
 */
import api from "./index";
import { BASE, cGet, cPost, cPut } from "./consultingHttp";
import {
  isCashExpenseType,
  normalizeCashConfirmMode,
  normalizeCashRequestCounters,
} from "../utils/consultingMoney";

const URL_CASH = `${BASE}/cashbox`;

const asList = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

const isNotReady = (e) => e?.status === 404 || e?.status === 501;

/** Legacy-кассы (общая модель CashBox) — пока бэк не выкатил /cashbox/cashboxes/. */
async function listLegacyConstructionCashboxes(params = {}, config = {}) {
  const res = await api.get("/construction/cashboxes/", {
    params,
    signal: config.signal,
  });
  return asList(res.data);
}

/** Собрать уникальные кассы из подтверждённых операций. */
async function deriveCashboxesFromOperations(config = {}) {
  const data = await cGet(
    "List Cash Operations Error",
    `${URL_CASH}/operations/`,
    { page_size: 200 },
    config,
  );
  const map = new Map();
  for (const op of asList(data)) {
    const id = op.cashbox ?? op.cashbox_id;
    if (id == null || id === "") continue;
    const key = String(id);
    if (map.has(key)) continue;
    map.set(key, {
      id,
      name: op.cashbox_name || op.cashbox_display || `Касса ${key.slice(0, 8)}`,
      department_name: op.department_name || "",
    });
  }
  return [...map.values()];
}

export const CASH_REQUEST_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  REJECTED: "rejected",
  CANCELED: "canceled",
};

export const CASH_REQUEST_STATUS_LABELS = {
  [CASH_REQUEST_STATUS.PENDING]: "Ожидает подтверждения",
  [CASH_REQUEST_STATUS.CONFIRMED]: "Подтверждено",
  [CASH_REQUEST_STATUS.REJECTED]: "Отклонено",
  [CASH_REQUEST_STATUS.CANCELED]: "Снято",
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

/* ==================== КАССЫ (consalting) ==================== */

/**
 * Список касс консалтинга.
 * GET /consalting/cashbox/cashboxes/
 *
 * На prod (2026-09) эндпоинт может отсутствовать (404) — тогда fallback:
 * /construction/cashboxes/ → уникальные cashbox из operations.
 */
export async function listConsultingCashboxes(params = {}, config = {}) {
  try {
    return await cGet(
      "List Consulting Cashboxes Error",
      `${URL_CASH}/cashboxes/`,
      params,
      config,
    );
  } catch (e) {
    if (!isNotReady(e)) throw e;
  }
  try {
    return await listLegacyConstructionCashboxes(params, config);
  } catch (e) {
    const st = e?.response?.status ?? e?.status;
    if (st && st !== 404 && st !== 501) throw e;
  }
  try {
    const derived = await deriveCashboxesFromOperations(config);
    if (derived.length) return derived;
  } catch (e) {
    if (!isNotReady(e)) throw e;
  }
  return [{ id: "", name: "Основная касса", department_name: "Консалтинг" }];
}

/**
 * POST /consalting/cashbox/cashboxes/
 * @param {Object} payload - { name, department_name? }
 */
export async function createConsultingCashbox(payload) {
  try {
    return await cPost(
      "Create Consulting Cashbox Error",
      `${URL_CASH}/cashboxes/`,
      payload,
    );
  } catch (e) {
    if (!isNotReady(e)) throw e;
    const res = await api.post("/construction/cashboxes/", payload);
    return res.data;
  }
}

/**
 * GET /consalting/cashbox/cashboxes/{id}/
 */
export async function getConsultingCashbox(id, config = {}) {
  if (!id) {
    return { id: "", name: "Основная касса", department_name: "Консалтинг" };
  }
  try {
    return await cGet(
      "Get Consulting Cashbox Error",
      `${URL_CASH}/cashboxes/${id}/`,
      {},
      config,
    );
  } catch (e) {
    if (!isNotReady(e)) throw e;
    const res = await api.get(`/construction/cashboxes/${id}/`, {
      signal: config.signal,
    });
    return res.data;
  }
}

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
export const getCashRequestCounters = async (params = {}, config) => {
  const data = await cGet(
    "Cash Request Counters Error",
    `${URL_CASH}/requests/counters/`,
    params,
    config,
  );
  return normalizeCashRequestCounters(data);
};

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
export const getCashConfirmationSettings = async (config) => {
  const data = await cGet(
    "Get Cash Confirmation Settings Error",
    `${URL_CASH}/confirmation-settings/`,
    {},
    config,
  );
  if (!data || typeof data !== "object") return data;
  return { ...data, mode: normalizeCashConfirmMode(data.mode) };
};

/** Прод принимает POST; спека — PUT. */
export const updateCashConfirmationSettings = async (payload) => {
  try {
    return await cPost(
      "Update Cash Confirmation Settings Error",
      `${URL_CASH}/confirmation-settings/`,
      payload,
    );
  } catch (e) {
    if (e?.status !== 405 && e?.status !== 404) throw e;
    return cPut(
      "Update Cash Confirmation Settings Error",
      `${URL_CASH}/confirmation-settings/`,
      payload,
    );
  }
};

export { isCashExpenseType };
