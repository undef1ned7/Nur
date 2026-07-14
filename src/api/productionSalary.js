/**
 * Производство: Зарплата — почасовой оклад и сдельная оплата.
 * Бэкенд ещё не реализован — спецификация: docs/production/salary.md
 */
import api from ".";

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

const BASE = "main/production/salary";

// ==================== СТАВКИ ====================

/**
 * Почасовые ставки сотрудников.
 * GET /main/production/salary/rates/
 * @returns {{results: Array<{employee, employee_name, hourly_rate}>}}
 */
export const listHourlyRates = async (params = {}) => {
  try {
    const response = await api.get(`${BASE}/rates/`, { params });
    return response.data;
  } catch (error) {
    return reject("List Hourly Rates Error")(error);
  }
};

/**
 * Установить почасовую ставку сотрудника.
 * PUT /main/production/salary/rates/{employee_id}/
 * @param {Object} payload - { hourly_rate: "100.00" }
 */
export const updateHourlyRate = async (employeeId, payload) => {
  try {
    const response = await api.put(`${BASE}/rates/${employeeId}/`, payload);
    return response.data;
  } catch (error) {
    return reject("Update Hourly Rate Error")(error);
  }
};

/**
 * Сдельные ставки по товарам (сом за единицу).
 * GET /main/production/salary/piece-rates/
 * @returns {{results: Array<{product, product_name, amount_per_unit}>}}
 */
export const listPieceRates = async (params = {}) => {
  try {
    const response = await api.get(`${BASE}/piece-rates/`, { params });
    return response.data;
  } catch (error) {
    return reject("List Piece Rates Error")(error);
  }
};

/**
 * Установить сдельную ставку товара.
 * PUT /main/production/salary/piece-rates/{product_id}/
 * @param {Object} payload - { amount_per_unit: "5.00" }
 */
export const updatePieceRate = async (productId, payload) => {
  try {
    const response = await api.put(
      `${BASE}/piece-rates/${productId}/`,
      payload,
    );
    return response.data;
  } catch (error) {
    return reject("Update Piece Rate Error")(error);
  }
};

// ==================== ТАБЕЛЬ ЧАСОВ ====================

/**
 * Табель отработанных часов.
 * GET /main/production/salary/work-sessions/
 * @param {Object} params - employee, date_from, date_to, page
 */
export const listWorkSessions = async (params = {}) => {
  try {
    const response = await api.get(`${BASE}/work-sessions/`, { params });
    return response.data;
  } catch (error) {
    return reject("List Work Sessions Error")(error);
  }
};

/**
 * Внести/обновить часы за день (upsert по сотруднику+дате).
 * POST /main/production/salary/work-sessions/
 * @param {Object} payload - { employee, date: "YYYY-MM-DD", hours: "8", comment? }
 */
export const upsertWorkSession = async (payload) => {
  try {
    const response = await api.post(`${BASE}/work-sessions/`, payload);
    return response.data;
  } catch (error) {
    return reject("Upsert Work Session Error")(error);
  }
};

/**
 * Удалить запись табеля (если начисление не оплачено).
 * DELETE /main/production/salary/work-sessions/{id}/
 */
export const deleteWorkSession = async (id) => {
  try {
    const response = await api.delete(`${BASE}/work-sessions/${id}/`);
    return response.data;
  } catch (error) {
    return reject("Delete Work Session Error")(error);
  }
};

// ==================== НАЧИСЛЕНИЯ И СВОДКА ====================

/**
 * История начислений. Owner/admin — все, сотрудник — только свои.
 * GET /main/production/salary/accruals/
 * @param {Object} params - employee, kind (hourly|piece), status, date_from, date_to, page
 */
export const listSalaryAccruals = async (params = {}) => {
  try {
    const response = await api.get(`${BASE}/accruals/`, { params });
    return response.data;
  } catch (error) {
    return reject("List Salary Accruals Error")(error);
  }
};

/**
 * Сводка по сотрудникам за период.
 * GET /main/production/salary/summary/
 * @param {Object} params - date_from, date_to, employee
 */
export const getSalarySummary = async (params = {}) => {
  try {
    const response = await api.get(`${BASE}/summary/`, { params });
    return response.data;
  } catch (error) {
    return reject("Get Salary Summary Error")(error);
  }
};

// ==================== ВЫПЛАТЫ ====================

/**
 * История выплат.
 * GET /main/production/salary/payouts/
 * @param {Object} params - employee, date_from, date_to, page
 */
export const listSalaryPayouts = async (params = {}) => {
  try {
    const response = await api.get(`${BASE}/payouts/`, { params });
    return response.data;
  } catch (error) {
    return reject("List Salary Payouts Error")(error);
  }
};

/**
 * Выплатить сотруднику (закрывает начисления accrued, создаёт расход кассы).
 * POST /main/production/salary/payouts/
 * @param {Object} payload - { employee, amount: "1500.00", cashbox, comment? }
 */
export const createSalaryPayout = async (payload) => {
  try {
    const response = await api.post(`${BASE}/payouts/`, payload);
    return response.data;
  } catch (error) {
    return reject("Create Salary Payout Error")(error);
  }
};
