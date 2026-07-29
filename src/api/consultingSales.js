/**
 * Консалтинг: продажи — список с серверной пагинацией/фильтрами и
 * отмена/возврат вместо удаления (ТЗ №8).
 *
 * Контракт: docs/consulting/backend/08-sale-cancel.md.
 *
 * Почему не удаление: продажа тянет за собой абонентский график, начисление
 * зарплаты, приход в кассе и цифры аналитики. Удаление записи оставляет всё это
 * «висеть», поэтому продажа переводится в статус «отменена», а сервер
 * атомарно откатывает последствия.
 */
import { BASE, cGet, cPost } from "./consultingHttp";

const URL_SALES = `${BASE}/sales/`;

export const SALE_STATUS = {
  COMPLETED: "completed",
  CANCELED: "canceled",
  REFUNDED: "refunded", // частичный возврат
  PENDING_CASH: "pending_confirmation", // ждёт подтверждения кассой (ТЗ №9)
};

export const SALE_STATUS_LABELS = {
  [SALE_STATUS.COMPLETED]: "Проведена",
  [SALE_STATUS.CANCELED]: "Отменена",
  [SALE_STATUS.REFUNDED]: "Частичный возврат",
  [SALE_STATUS.PENDING_CASH]: "Ждёт подтверждения",
};

/** Причины отмены — питают отчёт «Отмены и возвраты». */
export const CANCEL_REASONS = [
  { value: "client_refused", label: "Клиент отказался" },
  { value: "input_error", label: "Ошибка оформления" },
  { value: "warranty", label: "Возврат по гарантии" },
  { value: "duplicate", label: "Дубль" },
  { value: "other", label: "Другое" },
];

export const REFUND_MODES = [
  { value: "cash", label: "Наличными" },
  { value: "transfer", label: "Переводом" },
  { value: "none", label: "Деньги не поступали" },
];

/**
 * Список продаж.
 * GET /consalting/sales/
 * @param {Object} params - search, status, user, client, service,
 *   date_from, date_to, page, page_size, ordering
 */
export const listConsultingSales = (params = {}, config) =>
  cGet("List Consulting Sales Error", URL_SALES, params, config);

/** Одна продажа со всеми последствиями (абонентка, начисление, касса). */
export const getConsultingSale = (id, config) =>
  cGet("Get Consulting Sale Error", `${URL_SALES}${id}/`, {}, config);

/**
 * Отмена продажи (полная) — сервер откатывает абонентку, долги, начисление
 * зарплаты, кассовую операцию и данные аналитики одной транзакцией.
 * POST /consalting/sales/{id}/cancel/
 * @param {Object} payload - {
 *   reason, comment?, refund_mode: "cash"|"transfer"|"none",
 *   lead_action?: "return_to_work"|"reject"   // что делать с лидом на воронке
 * }
 */
export const cancelConsultingSale = (id, payload) =>
  cPost("Cancel Consulting Sale Error", `${URL_SALES}${id}/cancel/`, payload);

/**
 * Частичный возврат: возвращается часть суммы или отдельная позиция чека.
 * POST /consalting/sales/{id}/refund/
 * @param {Object} payload - { amount?, items?: string[], reason, comment?, refund_mode }
 */
export const refundConsultingSale = (id, payload) =>
  cPost("Refund Consulting Sale Error", `${URL_SALES}${id}/refund/`, payload);

/**
 * Отчёт «Отмены и возвраты» за период.
 * GET /consalting/sales/cancellations/
 * @param {Object} params - date_from, date_to, user, reason, page, page_size
 */
export const listSaleCancellations = (params = {}, config) =>
  cGet("List Sale Cancellations Error", `${URL_SALES}cancellations/`, params, config);
