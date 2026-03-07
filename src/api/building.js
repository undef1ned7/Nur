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
 * Список касс Building (собственная система касс модуля Building).
 * GET /api/building/cashboxes/
 */
export const getBuildingCashboxes = async (params = {}) => {
  try {
    const response = await api.get("/building/cashboxes/", { params });
    const data = response.data;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data)) return data;
    return [];
  } catch (error) {
    if (error.response) {
      // eslint-disable-next-line no-console
      console.error("Get Building Cashboxes Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Список касс, доступных пользователю (legacy — construction).
 * По возможности переиспользует общий API касс.
 */
export const listCashboxes = async (params = {}) => {
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

/**
 * Создать кассу Building. POST /api/building/cashboxes/
 */
export const createBuildingCashbox = async (payload) => {
  const { data } = await api.post("/building/cashboxes/", payload);
  return data;
};

/**
 * Детали кассы. GET /api/building/cashboxes/{id}/
 */
export const getBuildingCashbox = async (id) => {
  const { data } = await api.get(`/building/cashboxes/${id}/`);
  return data;
};

/**
 * Обновить кассу. PATCH /api/building/cashboxes/{id}/
 */
export const updateBuildingCashbox = async (id, payload) => {
  const { data } = await api.patch(`/building/cashboxes/${id}/`, payload);
  return data;
};

/**
 * Удалить кассу. DELETE /api/building/cashboxes/{id}/
 */
export const deleteBuildingCashbox = async (id) => {
  await api.delete(`/building/cashboxes/${id}/`);
};

/**
 * Список движений по кассе. GET /api/building/cash/flows/
 * Параметры: cashbox (uuid)
 */
export const getBuildingCashFlows = async (params = {}) => {
  const { data } = await api.get("/building/cash/flows/", { params });
  if (Array.isArray(data?.results)) return data;
  if (Array.isArray(data)) return { results: data, count: data.length };
  return { results: [], count: 0 };
};

/**
 * Создать движение. POST /api/building/cash/flows/
 */
export const createBuildingCashFlow = async (payload) => {
  const { data } = await api.post("/building/cash/flows/", payload);
  return data;
};

/**
 * Детали движения. GET /api/building/cash/flows/{id}/
 */
export const getBuildingCashFlow = async (id) => {
  const { data } = await api.get(`/building/cash/flows/${id}/`);
  return data;
};

/**
 * Обновить движение. PATCH /api/building/cash/flows/{id}/
 */
export const updateBuildingCashFlow = async (id, payload) => {
  const { data } = await api.patch(`/building/cash/flows/${id}/`, payload);
  return data;
};

/**
 * Удалить движение. DELETE /api/building/cash/flows/{id}/
 */
export const deleteBuildingCashFlow = async (id) => {
  await api.delete(`/building/cash/flows/${id}/`);
};

/**
 * Массовое обновление статуса движений. PATCH /api/building/cash/flows/bulk/status/
 */
export const bulkStatusBuildingCashFlows = async (payload) => {
  const { data } = await api.patch(
    "/building/cash/flows/bulk/status/",
    payload,
  );
  return data;
};

export default {
  getInstallmentPayments,
  createInstallmentPayment,
  listCashboxes,
  getBuildingCashboxes,
  createBuildingCashbox,
  getBuildingCashbox,
  updateBuildingCashbox,
  deleteBuildingCashbox,
  getBuildingCashFlows,
  createBuildingCashFlow,
  getBuildingCashFlow,
  updateBuildingCashFlow,
  deleteBuildingCashFlow,
  bulkStatusBuildingCashFlows,
};

