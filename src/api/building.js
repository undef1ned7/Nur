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

/**
 * Заявки на аванс (для кассы).
 * GET /api/building/salary/advance-requests/
 * Фильтры: cashbox, residential_complex, payroll
 */
export const getBuildingAdvanceRequests = async (params = {}) => {
  const { data } = await api.get("/building/salary/advance-requests/", {
    params,
  });
  const list = data?.results ?? data;
  return Array.isArray(list) ? list : [];
};

/**
 * Одобрить заявку на аванс. POST /api/building/salary/advance-requests/{id}/approve/
 */
export const approveBuildingAdvanceRequest = async (id, payload = {}) => {
  const { data } = await api.post(
    `/building/salary/advance-requests/${id}/approve/`,
    payload,
  );
  return data;
};

/**
 * Отклонить заявку на аванс. POST /api/building/salary/advance-requests/{id}/reject/
 */
export const rejectBuildingAdvanceRequest = async (id, payload = {}) => {
  const { data } = await api.post(
    `/building/salary/advance-requests/${id}/reject/`,
    payload,
  );
  return data;
};

/**
 * Заявки на кассу (cash-register/requests).
 * GET /api/building/cash-register/requests/
 * Фильтры: request_type, status, cashbox, residential_complex, treaty, client, work_entry
 */
export const getBuildingCashRegisterRequests = async (params = {}) => {
  const { data } = await api.get("/building/cash-register/requests/", {
    params,
  });
  const list = data?.results ?? data;
  return Array.isArray(list) ? list : [];
};

/**
 * Создать заявку на кассу. POST /api/building/cash-register/requests/
 * payload: { request_type, treaty, apartment, client, cashbox, shift, amount, comment }
 */
export const createBuildingCashRegisterRequest = async (payload = {}) => {
  const { data } = await api.post("/building/cash-register/requests/", payload);
  return data;
};

/**
 * Одобрить заявку на кассу. POST /api/building/cash-register/requests/{id}/approve/
 * Тело (опционально): { cashbox, shift, paid_at, comment }
 */
export const approveBuildingCashRegisterRequest = async (id, payload = {}) => {
  const { data } = await api.post(
    `/building/cash-register/requests/${id}/approve/`,
    payload,
  );
  return data;
};

/**
 * Отклонить заявку на кассу. POST /api/building/cash-register/requests/{id}/reject/
 * Тело (опционально): { reason }
 */
export const rejectBuildingCashRegisterRequest = async (id, payload = {}) => {
  const { data } = await api.post(
    `/building/cash-register/requests/${id}/reject/`,
    payload,
  );
  return data;
};

/**
 * Детали заявки на кассу (в т.ч. файлы). GET /api/building/cash-register/requests/{id}/
 */
export const getBuildingCashRegisterRequest = async (id) => {
  const { data } = await api.get(`/building/cash-register/requests/${id}/`);
  return data;
};

/**
 * Прикрепить файл к заявке на кассу. POST /api/building/cash-register/requests/{id}/files/
 * formData: { file: File, title?: string }
 */
export const uploadBuildingCashRegisterRequestFile = async (requestId, formData) => {
  const { data } = await api.post(
    `/building/cash-register/requests/${requestId}/files/`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return data;
};

/**
 * Статистика квартир по блокам.
 * GET /api/building/objects/{residential_complex_id}/blocks/stats/
 */
export const getBuildingBlocksStats = async (
  residentialComplexId,
  params = {},
) => {
  const { data } = await api.get(
    `/building/objects/${residentialComplexId}/blocks/stats/`,
    { params },
  );
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data)) return data;
  return [];
};

/**
 * Что было выдано со склада по процессу работ.
 * GET /api/building/work-entries/{id}/warehouse-receipts/
 */
export const getBuildingWorkEntryWarehouseReceipts = async (workEntryId) => {
  const { data } = await api.get(
    `/building/work-entries/${workEntryId}/warehouse-receipts/`,
  );
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.items) ? data.items : [];
};

/**
 * Получить АВР процесса работ.
 * GET /api/building/work-entries/{id}/acceptance/
 */
export const getBuildingWorkEntryAcceptance = async (workEntryId) => {
  const { data } = await api.get(`/building/work-entries/${workEntryId}/acceptance/`);
  return data;
};

/**
 * Создать АВР процесса работ.
 * POST /api/building/work-entries/{id}/acceptance/
 */
export const saveBuildingWorkEntryAcceptance = async (
  workEntryId,
  payload = {},
) => {
  const { data } = await api.post(
    `/building/work-entries/${workEntryId}/acceptance/`,
    payload,
  );
  return data;
};

/**
 * Обновить АВР процесса работ.
 * PATCH /api/building/work-entry-acceptance/{id}/
 */
export const updateBuildingWorkEntryAcceptance = async (
  acceptanceId,
  payload = {},
) => {
  const { data } = await api.patch(
    `/building/work-entry-acceptance/${acceptanceId}/`,
    payload,
  );
  return data;
};

/**
 * Прикрепить файл к АВР.
 * POST /api/building/work-entry-acceptance/{id}/files/
 */
export const uploadBuildingWorkEntryAcceptanceFile = async (
  acceptanceId,
  formData,
) => {
  const { data } = await api.post(
    `/building/work-entry-acceptance/${acceptanceId}/files/`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
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
  getBuildingAdvanceRequests,
  approveBuildingAdvanceRequest,
  rejectBuildingAdvanceRequest,
  getBuildingCashRegisterRequests,
  createBuildingCashRegisterRequest,
  approveBuildingCashRegisterRequest,
  rejectBuildingCashRegisterRequest,
  getBuildingCashRegisterRequest,
  uploadBuildingCashRegisterRequestFile,
  getBuildingBlocksStats,
  getBuildingWorkEntryWarehouseReceipts,
  getBuildingWorkEntryAcceptance,
  saveBuildingWorkEntryAcceptance,
  updateBuildingWorkEntryAcceptance,
  uploadBuildingWorkEntryAcceptanceFile,
};

