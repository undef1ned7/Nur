/**
 * Консалтинг: Зарплата сотрудников (процент с закрытых продаж/выигранных лидов).
 *
 * Модель повторяет «Услуги: Зарплата мастеров» (docs/services/salary.md), но
 * адаптирована под консалтинг: ставка задаётся на услугу, зарабатывает продавец
 * (владелец лида / автор продажи), основанием начисления служит закрытая продажа
 * или выигранный лид. Бэкенд ещё не реализован — спецификация:
 * docs/consulting/salary-auto-accrual.md
 */
import api from ".";

const BASE = "/consalting/salary";

const reject = (label) => (error) => {
  if (error.response) {
    console.error(`${label}:`, error.response.data);
    const data = error.response.data;
    const payload =
      data && typeof data === "object" ? { ...data } : { detail: data };
    payload.status = error.response.status;
    return Promise.reject(payload);
  }
  return Promise.reject(error);
};

// ==================== СТАВКИ УСЛУГ ====================

/**
 * Процентные ставки всех услуг компании (owner/admin).
 * GET /consalting/salary/rates/
 * @param {Object} params - search (по названию услуги), page
 * @returns {{results: Array<{service, service_name, price, percent, updated_at}>}}
 */
export const listSalaryRates = async (params = {}) => {
  try {
    const { data } = await api.get(`${BASE}/rates/`, { params });
    return data;
  } catch (error) {
    return reject("List Consulting Salary Rates Error")(error);
  }
};

/**
 * Изменить ставку услуги (создаёт запись, если её ещё нет).
 * PUT /consalting/salary/rates/{service_id}/
 * @param {string} serviceId - UUID услуги
 * @param {Object} payload - { percent: "10.00" }
 */
export const updateSalaryRate = async (serviceId, payload) => {
  try {
    const { data } = await api.put(`${BASE}/rates/${serviceId}/`, payload);
    return data;
  } catch (error) {
    return reject("Update Consulting Salary Rate Error")(error);
  }
};

// ==================== НАЧИСЛЕНИЯ ====================

/**
 * История начислений. Owner/admin видит все, сотрудник — только свои.
 * GET /consalting/salary/accruals/
 * @param {Object} params - date_from, date_to (YYYY-MM-DD), user (uuid),
 *   service (uuid), status (pending|accrued|paid|canceled), search, page
 */
export const listSalaryAccruals = async (params = {}) => {
  try {
    const { data } = await api.get(`${BASE}/accruals/`, { params });
    return data;
  } catch (error) {
    return reject("List Consulting Salary Accruals Error")(error);
  }
};

/**
 * Сводка по начислениям за период (итоги + разбивка по сотрудникам).
 * GET /consalting/salary/summary/
 * @param {Object} params - date_from, date_to, user, service
 */
export const getSalarySummary = async (params = {}) => {
  try {
    const { data } = await api.get(`${BASE}/summary/`, { params });
    return data;
  } catch (error) {
    return reject("Get Consulting Salary Summary Error")(error);
  }
};

// ==================== ВЫПЛАТЫ ====================

/**
 * История выплат. Owner/admin — все, сотрудник — только свои.
 * GET /consalting/salary/payouts/
 * @param {Object} params - date_from, date_to, user, page
 */
export const listSalaryPayouts = async (params = {}) => {
  try {
    const { data } = await api.get(`${BASE}/payouts/`, { params });
    return data;
  } catch (error) {
    return reject("List Consulting Salary Payouts Error")(error);
  }
};

/**
 * Выплатить сотруднику (закрывает его начисления в статусе accrued, FIFO).
 * POST /consalting/salary/payouts/
 * @param {Object} payload - { user: uuid, amount: "1500.00", comment?: string }
 */
export const createSalaryPayout = async (payload) => {
  try {
    const { data } = await api.post(`${BASE}/payouts/`, payload);
    return data;
  } catch (error) {
    return reject("Create Consulting Salary Payout Error")(error);
  }
};
