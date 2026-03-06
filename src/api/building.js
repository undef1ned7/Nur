import api from "./index";
import warehouseAPI from "./warehouse";

/**
 * Получить список платежей по взносу рассрочки договора.
 * GET /api/building/treaty-installments/{installment_id}/payments/
 */
export const getInstallmentPayments = async (installmentId, params = {}) => {
  try {
    const response = await api.get(
      `/building/treaty-installments/${installmentId}/payments/`,
      { params },
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      // eslint-disable-next-line no-console
      console.error(
        "Get Building Installment Payments Error:",
        error.response.data,
      );
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Создать оплату по взносу рассрочки (частичную или полную).
 * POST /api/building/treaty-installments/{installment_id}/payments/
 */
export const createInstallmentPayment = async (installmentId, payload) => {
  try {
    const response = await api.post(
      `/building/treaty-installments/${installmentId}/payments/`,
      payload,
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      // eslint-disable-next-line no-console
      console.error(
        "Create Building Installment Payment Error:",
        error.response.data,
      );
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Список касс, доступных пользователю.
 * По возможности переиспользует общий API касс.
 */
export const listCashboxes = async (params = {}) => {
  // Переиспользуем общий API склада, если он доступен.
  if (warehouseAPI?.listCashRegisters) {
    return warehouseAPI.listCashRegisters(params);
  }

  try {
    const response = await api.get("/construction/cashboxes/", { params });
    const data = response.data;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data)) return data;
    return [];
  } catch (error) {
    if (error.response) {
      // eslint-disable-next-line no-console
      console.error("List Building Cashboxes Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export default {
  getInstallmentPayments,
  createInstallmentPayment,
  listCashboxes,
};

