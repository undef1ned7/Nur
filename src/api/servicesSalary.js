/**
 * Услуги: Зарплата сотрудников (процент с оказанных услуг).
 *
 * По логике повторяет «Склад: Зарплата агентов», но адаптировано под сектор
 * «Услуги»: вместо склада-источника ставка задаётся на услугу, вместо агента
 * зарабатывает мастер (сотрудник), вместо продажи основанием начисления служит
 * завершённая запись (appointment).
 *
 * Бэкенд ещё не реализован — спецификация: docs/services/salary.md
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

// ==================== СТАВКИ УСЛУГ ====================

/**
 * Процентные ставки всех услуг компании, owner/admin.
 * GET /api/barbershop/salary/rates/
 * @param {Object} params - search (по названию услуги), page
 * @returns {{results: Array<{service, service_name, price, percent, updated_at}>}}
 */
export const listSalaryRates = async (params = {}) => {
  try {
    const response = await api.get("barbershop/salary/rates/", { params });
    return response.data;
  } catch (error) {
    return reject("List Services Salary Rates Error")(error);
  }
};

/**
 * Изменить ставку услуги (создаёт запись, если её ещё нет).
 * PUT /api/barbershop/salary/rates/{service_id}/
 * @param {string} serviceId - UUID услуги
 * @param {Object} payload - { percent: "40.00" }
 */
export const updateSalaryRate = async (serviceId, payload) => {
  try {
    const response = await api.put(
      `barbershop/salary/rates/${serviceId}/`,
      payload,
    );
    return response.data;
  } catch (error) {
    return reject("Update Services Salary Rate Error")(error);
  }
};

// ==================== НАЧИСЛЕНИЯ ====================

/**
 * История начислений. Owner/admin видит все, мастер — только свои.
 * GET /api/barbershop/salary/accruals/
 * @param {Object} params - date_from, date_to (YYYY-MM-DD), master (uuid),
 *   service (uuid), status (pending|accrued|paid|canceled), search, page
 */
export const listSalaryAccruals = async (params = {}) => {
  try {
    const response = await api.get("barbershop/salary/accruals/", { params });
    return response.data;
  } catch (error) {
    return reject("List Services Salary Accruals Error")(error);
  }
};

/**
 * Сводка по начислениям за период (итоги + разбивка по мастерам).
 * GET /api/barbershop/salary/summary/
 * @param {Object} params - date_from, date_to, master, service
 */
export const getSalarySummary = async (params = {}) => {
  try {
    const response = await api.get("barbershop/salary/summary/", { params });
    return response.data;
  } catch (error) {
    return reject("Get Services Salary Summary Error")(error);
  }
};

// ==================== ВЫПЛАТЫ ====================

/**
 * История выплат. Owner/admin — все, мастер — только свои.
 * GET /api/barbershop/salary/payouts/
 * @param {Object} params - date_from, date_to, master, page
 */
export const listSalaryPayouts = async (params = {}) => {
  try {
    const response = await api.get("barbershop/salary/payouts/", { params });
    return response.data;
  } catch (error) {
    return reject("List Services Salary Payouts Error")(error);
  }
};

/**
 * Выплатить мастеру (закрывает его начисления в статусе accrued, FIFO).
 * POST /api/barbershop/salary/payouts/
 * @param {Object} payload - { master: uuid, amount: "1500.00", comment?: string }
 */
export const createSalaryPayout = async (payload) => {
  try {
    const response = await api.post("barbershop/salary/payouts/", payload);
    return response.data;
  } catch (error) {
    return reject("Create Services Salary Payout Error")(error);
  }
};
