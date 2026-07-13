/**
 * Склад: Зарплата агентов — процентные ставки складов, начисления, выплаты.
 * Бэкенд ещё не реализован — спецификация: docs/warehouse/salary.md
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

// ==================== СТАВКИ СКЛАДОВ ====================

/**
 * Ставки всех складов компании (розница/опт), owner/admin.
 * GET /api/warehouse/salary/rates/
 * @param {Object} params - search, page
 * @returns {{results: Array<{warehouse, warehouse_name, retail_percent, wholesale_percent, updated_at}>}}
 */
export const listSalaryRates = async (params = {}) => {
  try {
    const response = await api.get("warehouse/salary/rates/", { params });
    return response.data;
  } catch (error) {
    return reject("List Salary Rates Error")(error);
  }
};

/**
 * Изменить ставку склада (создаёт запись, если её ещё нет).
 * PUT /api/warehouse/salary/rates/{warehouse_id}/
 * @param {string} warehouseId - UUID склада
 * @param {Object} payload - { retail_percent: "5.00", wholesale_percent: "2.50" }
 */
export const updateSalaryRate = async (warehouseId, payload) => {
  try {
    const response = await api.put(
      `warehouse/salary/rates/${warehouseId}/`,
      payload,
    );
    return response.data;
  } catch (error) {
    return reject("Update Salary Rate Error")(error);
  }
};

// ==================== НАЧИСЛЕНИЯ ====================

/**
 * История начислений. Owner/admin видит все, агент — только свои.
 * GET /api/warehouse/salary/accruals/
 * @param {Object} params - date_from, date_to (YYYY-MM-DD), agent (uuid),
 *   warehouse (uuid), sale_type (retail|wholesale),
 *   status (pending|accrued|paid|canceled), search, page
 */
export const listSalaryAccruals = async (params = {}) => {
  try {
    const response = await api.get("warehouse/salary/accruals/", { params });
    return response.data;
  } catch (error) {
    return reject("List Salary Accruals Error")(error);
  }
};

/**
 * Сводка по начислениям за период (итоги + разбивка по агентам).
 * GET /api/warehouse/salary/summary/
 * @param {Object} params - date_from, date_to, agent, warehouse
 */
export const getSalarySummary = async (params = {}) => {
  try {
    const response = await api.get("warehouse/salary/summary/", { params });
    return response.data;
  } catch (error) {
    return reject("Get Salary Summary Error")(error);
  }
};

// ==================== ВЫПЛАТЫ ====================

/**
 * История выплат. Owner/admin — все, агент — только свои.
 * GET /api/warehouse/salary/payouts/
 * @param {Object} params - date_from, date_to, agent, page
 */
export const listSalaryPayouts = async (params = {}) => {
  try {
    const response = await api.get("warehouse/salary/payouts/", { params });
    return response.data;
  } catch (error) {
    return reject("List Salary Payouts Error")(error);
  }
};

/**
 * Выплатить агенту (закрывает его начисления в статусе accrued).
 * POST /api/warehouse/salary/payouts/
 * @param {Object} payload - { agent: uuid, amount?: "1500.00", comment?: string }
 */
export const createSalaryPayout = async (payload) => {
  try {
    const response = await api.post("warehouse/salary/payouts/", payload);
    return response.data;
  } catch (error) {
    return reject("Create Salary Payout Error")(error);
  }
};
