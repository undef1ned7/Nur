/**
 * Agent Sales API — история продаж агента (GET /api/main/agents/me/sales/)
 * Документация: agent_sales_api.md
 */
import api from ".";

/**
 * Список продаж агента
 * @param {Object} params - start, end (date YYYY-MM-DD), paid (bool), status (new|paid|debt|canceled), user (uuid), search, ordering (created_at|total|status)
 */
export const getAgentSalesList = async (params = {}) => {
  const { data } = await api.get("/main/agents/me/sales/", { params });
  return data;
};

export const getAllProductionSalesList = async (params = {}) => {
  const { data } = await api.get("/main/pos/sales/", { params });
  return data;
};

/**
 * Детали продажи агента
 * @param {string} saleId - UUID продажи
 */
export const getAgentSaleDetail = async (saleId) => {
  const { data } = await api.get(`/main/agents/me/sales/${saleId}/`);
  return data;
};

export const getAllProductionSaleDetail = async (saleId) => {
  const { data } = await api.get(`/main/pos/sales/${saleId}/`);
  return data;
};

export const getAllProductionSaleReturn = async (saleId) => {
  const { data } = await api.post(`/main/pos/sales/${saleId}/return/`);
  return data;
};

/**
 * Возврат продажи (только paid или debt). Статус → canceled.
 * @param {string} saleId - UUID продажи
 */
export const agentSaleReturn = async (saleId) => {
  const { data } = await api.post(`/main/agents/me/sales/${saleId}/return/`);
  return data;
};

/**
 * Получить JSON данные накладной по продаже
 * @param {string} saleId - UUID продажи
 */
export const getAgentSaleInvoiceJson = async (saleId) => {
  const { data } = await api.get(`/main/sales/json/${saleId}/invoice/`);
  return data;
};
