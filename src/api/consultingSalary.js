/**
 * Консалтинг: Зарплата — конструктор схем оплаты (оклад / % / фикс за сделку),
 * правила премий, штрафы и разовые премии, начисления, расчётный лист, выплаты.
 *
 * Контракт: docs/consulting/backend/02-salary.md.
 *
 * Принципы, на которых построен раздел:
 *  - схема оплаты задаётся сотруднику, ставки ищутся по приоритету
 *    сотрудник → услуга → компания;
 *  - при начислении фиксируется СНИМОК ставки/правила: изменение настроек не
 *    переписывает историю;
 *  - отмена/возврат продажи отменяет связанное начисление (ТЗ №8).
 */
import { BASE, cDelete, cGet, cPatch, cPost, cPut } from "./consultingHttp";

const URL = `${BASE}/salary`;

/* ==================== СПРАВОЧНИКИ ==================== */

export const ACCRUAL_STATUS_LABELS = {
  pending: "Ожидает",
  accrued: "Начислено",
  paid: "Выплачено",
  canceled: "Отменено",
};

/** Типы строк расчётного листа. */
export const ACCRUAL_KIND = {
  SALARY: "salary", // оклад
  PERCENT: "percent", // процент со сделки
  FIXED: "fixed", // фикс за сделку
  BONUS: "bonus", // премия по правилу
  MANUAL_BONUS: "manual_bonus", // разовая премия
  FINE: "fine", // штраф
  DEDUCTION: "deduction", // удержание (недостача, отмена продажи)
};

export const ACCRUAL_KIND_LABELS = {
  [ACCRUAL_KIND.SALARY]: "Оклад",
  [ACCRUAL_KIND.PERCENT]: "Процент со сделки",
  [ACCRUAL_KIND.FIXED]: "Фикс за сделку",
  [ACCRUAL_KIND.BONUS]: "Премия по правилу",
  [ACCRUAL_KIND.MANUAL_BONUS]: "Разовая премия",
  [ACCRUAL_KIND.FINE]: "Штраф",
  [ACCRUAL_KIND.DEDUCTION]: "Удержание",
};

/** Строки, уменьшающие сумму к выплате. */
export const NEGATIVE_KINDS = [ACCRUAL_KIND.FINE, ACCRUAL_KIND.DEDUCTION];

export const SALARY_PERIOD = {
  MONTH: "month",
  WEEK: "week",
  QUARTER: "quarter",
};

export const SALARY_PERIOD_LABELS = {
  [SALARY_PERIOD.WEEK]: "Неделя",
  [SALARY_PERIOD.MONTH]: "Месяц",
  [SALARY_PERIOD.QUARTER]: "Квартал",
};

/** Типы условий премиального правила. */
export const BONUS_CONDITIONS = [
  {
    value: "service_count",
    label: "За количество продаж услуги",
    hint: "Продал выбранную услугу N раз за период.",
    needsService: true,
  },
  {
    value: "revenue_amount",
    label: "За объём выручки (план)",
    hint: "Закрыл сделок на сумму не меньше указанной.",
  },
  {
    value: "deals_count",
    label: "За количество сделок",
    hint: "Закрыл N сделок за период, независимо от услуги.",
  },
  {
    value: "revenue_ladder",
    label: "Прогрессивная шкала",
    hint: "Процент зависит от достигнутой ступени выручки.",
    isLadder: true,
  },
];

export const BONUS_REWARD_TYPES = [
  { value: "fixed", label: "Фиксированная сумма" },
  { value: "percent", label: "Процент от выручки за период" },
];

/** Причины штрафов — нужны для отчётности и споров. */
export const FINE_REASONS = [
  { value: "late", label: "Опоздание" },
  { value: "client_complaint", label: "Жалоба клиента" },
  { value: "lost_lead", label: "Потеря лида" },
  { value: "rules_violation", label: "Нарушение регламента" },
  { value: "shortage", label: "Недостача по подотчёту" },
  { value: "other", label: "Другое" },
];

/* ==================== СХЕМЫ ОПЛАТЫ ==================== */

/**
 * Схемы оплаты сотрудников.
 * GET /consalting/salary/schemes/
 * @param {Object} params - search, role, is_active, page, page_size
 * @returns {{results: Array<SalaryScheme>, count}}
 *
 * SalaryScheme: {
 *   user, user_display, role_display,
 *   base_salary_enabled, base_salary, base_salary_period,
 *   percent_enabled, percent,            // процент по умолчанию для сотрудника
 *   fixed_enabled, fixed_amount,         // фикс за каждую закрытую сделку
 *   service_overrides: [{ service, service_name, percent, fixed_amount }],
 *   updated_at
 * }
 */
export const listSalarySchemes = (params = {}, config) =>
  cGet("List Salary Schemes Error", `${URL}/schemes/`, params, config);

export const getSalaryScheme = (userId, config) =>
  cGet("Get Salary Scheme Error", `${URL}/schemes/${userId}/`, {}, config);

/** PUT /consalting/salary/schemes/{user_id}/ — upsert схемы сотрудника. */
export const updateSalaryScheme = (userId, payload) =>
  cPut("Update Salary Scheme Error", `${URL}/schemes/${userId}/`, payload);

/**
 * Ставки по умолчанию на уровне компании.
 * GET/PUT /consalting/salary/defaults/
 * @returns {{ percent, fixed_amount, base_salary, base_salary_period }}
 */
export const getSalaryDefaults = (config) =>
  cGet("Get Salary Defaults Error", `${URL}/defaults/`, {}, config);

export const updateSalaryDefaults = (payload) =>
  cPut("Update Salary Defaults Error", `${URL}/defaults/`, payload);

/* ==================== СТАВКИ УСЛУГ ==================== */

/**
 * Процент/фикс на уровне услуги (средний уровень приоритета).
 * GET /consalting/salary/rates/
 * @param {Object} params - search, page, page_size
 */
export const listSalaryRates = (params = {}, config) =>
  cGet("List Consulting Salary Rates Error", `${URL}/rates/`, params, config);

/** PUT /consalting/salary/rates/{service_id}/ ← { percent, fixed_amount } */
export const updateSalaryRate = (serviceId, payload) =>
  cPut(
    "Update Consulting Salary Rate Error",
    `${URL}/rates/${serviceId}/`,
    payload,
  );

/* ==================== ПРАВИЛА ПРЕМИЙ ==================== */

/**
 * GET /consalting/salary/bonus-rules/
 * @param {Object} params - search, is_active, condition, page, page_size
 *
 * BonusRule: {
 *   id, name, condition, service, service_name, threshold,
 *   reward_type, reward_value, period,
 *   applies_to: "all"|"role"|"user", role, user,
 *   tiers: [{ from, to, percent }],   // для condition="revenue_ladder"
 *   valid_from, valid_to, is_active
 * }
 */
export const listBonusRules = (params = {}, config) =>
  cGet("List Bonus Rules Error", `${URL}/bonus-rules/`, params, config);

export const createBonusRule = (payload) =>
  cPost("Create Bonus Rule Error", `${URL}/bonus-rules/`, payload);

export const updateBonusRule = (id, payload) =>
  cPatch("Update Bonus Rule Error", `${URL}/bonus-rules/${id}/`, payload);

export const deleteBonusRule = (id) =>
  cDelete("Delete Bonus Rule Error", `${URL}/bonus-rules/${id}/`);

/**
 * Прогресс сотрудника к премиям за текущий период («осталось 2 продажи»).
 * GET /consalting/salary/bonus-progress/
 * @param {Object} params - user, date_from, date_to
 */
export const getBonusProgress = (params = {}, config) =>
  cGet("Bonus Progress Error", `${URL}/bonus-progress/`, params, config);

/* ==================== ШТРАФЫ И РАЗОВЫЕ ПРЕМИИ ==================== */

/**
 * GET /consalting/salary/adjustments/
 * @param {Object} params - user, kind (fine|manual_bonus), date_from, date_to,
 *   search, page, page_size
 */
export const listSalaryAdjustments = (params = {}, config) =>
  cGet("List Salary Adjustments Error", `${URL}/adjustments/`, params, config);

/**
 * POST /consalting/salary/adjustments/
 * @param {Object} payload - { user, kind: "fine"|"manual_bonus", amount,
 *   reason, comment?, date }
 */
export const createSalaryAdjustment = (payload) =>
  cPost("Create Salary Adjustment Error", `${URL}/adjustments/`, payload);

/** Отмена штрафа/премии — запись остаётся в истории со статусом canceled. */
export const cancelSalaryAdjustment = (id, payload = {}) =>
  cPost(
    "Cancel Salary Adjustment Error",
    `${URL}/adjustments/${id}/cancel/`,
    payload,
  );

/* ==================== НАЧИСЛЕНИЯ И РАСЧЁТНЫЙ ЛИСТ ==================== */

/**
 * История начислений. Owner/admin видит все, сотрудник — только свои.
 * GET /consalting/salary/accruals/
 * @param {Object} params - date_from, date_to, user, service, status, kind,
 *   search, page, page_size
 */
export const listSalaryAccruals = (params = {}, config) =>
  cGet("List Consulting Salary Accruals Error", `${URL}/accruals/`, params, config);

/** Сводка по начислениям за период (итоги + разбивка по сотрудникам). */
export const getSalarySummary = (params = {}, config) =>
  cGet("Get Consulting Salary Summary Error", `${URL}/summary/`, params, config);

/**
 * Расчётный лист сотрудника за месяц.
 * GET /consalting/salary/payslip/
 * @param {Object} params - user, month (YYYY-MM) либо date_from/date_to
 * @returns {{
 *   user, user_display, period,
 *   lines: [{ kind, label, amount, count, details_url? }],
 *   accrued, paid, to_pay
 * }}
 */
export const getSalaryPayslip = (params = {}, config) =>
  cGet("Get Salary Payslip Error", `${URL}/payslip/`, params, config);

/* ==================== ВЫПЛАТЫ ==================== */

/** GET /consalting/salary/payouts/ — сотрудник видит только свои. */
export const listSalaryPayouts = (params = {}, config) =>
  cGet("List Consulting Salary Payouts Error", `${URL}/payouts/`, params, config);

/** POST /consalting/salary/payouts/ ← { user, amount, comment? } (закрывает accrued FIFO). */
export const createSalaryPayout = (payload) =>
  cPost("Create Consulting Salary Payout Error", `${URL}/payouts/`, payload);
