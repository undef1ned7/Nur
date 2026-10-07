import api from "./index";
import { getStockPartnerCatalog, searchAgentCompanies } from "./warehouse";

/**
 * Партнёрство складов между компаниями: эндпоинты из
 * docs/warehouse/stock-partnership.md (этапы 1–3).
 *
 * В отличие от api/warehouse.js ошибки здесь сохраняют HTTP-статус:
 * фронт должен отличать «эндпоинта ещё нет на бэке» (старый прод) от
 * обычной ошибки и в первом случае откатываться на старые эндпоинты.
 */

export class PartnershipApiError extends Error {
  constructor(status, data) {
    const detail =
      data && typeof data === "object" && data.detail
        ? String(data.detail)
        : `HTTP ${status ?? "—"}`;
    super(detail);
    this.name = "PartnershipApiError";
    this.status = status ?? null;
    this.data = data ?? null;
  }
}

/**
 * Эндпоинт не существует: Django отдаёт 404/405 HTML-страницей (не JSON).
 * DRF-ответ 404 «объект не найден» приходит JSON-объектом и сюда не попадает.
 */
export const isEndpointMissing = (err) =>
  err instanceof PartnershipApiError &&
  (err.status === 404 || err.status === 405) &&
  (err.data == null || typeof err.data !== "object");

const request = async (method, url, { params, data } = {}) => {
  try {
    const response = await api.request({ method, url, params, data });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new PartnershipApiError(error.response.status, error.response.data);
    }
    throw error;
  }
};

// Эндпоинты, которых нет на текущем бэке, запоминаем до перезагрузки страницы,
// чтобы не стучаться в 404 на каждом экране.
const missingEndpoints = new Set();

const withFallback = async (key, primary, fallback) => {
  if (missingEndpoints.has(key)) return fallback();
  try {
    return await primary();
  } catch (err) {
    if (isEndpointMissing(err)) {
      missingEndpoints.add(key);
      return fallback();
    }
    throw err;
  }
};

/** Только для тестов. */
export const __resetPartnershipEndpointCache = () => missingEndpoints.clear();

const BASE = "warehouse/stock-partnerships";

const asList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

// ==================== ПОИСК КОМПАНИЙ ====================

/**
 * GET /stock-partnerships/companies/search/?search=
 * → [{ id, name, partnership_status: "ACTIVE" | "PENDING_OUT" | "PENDING_IN" | null }]
 * Старый бэк: поиск компаний для агентов (без статуса партнёрства).
 */
export const searchPartnershipCompanies = (search) =>
  withFallback(
    "companies-search",
    async () => asList(await request("get", `${BASE}/companies/search/`, { params: { search } })),
    async () => asList(await searchAgentCompanies({ search })),
  );

// ==================== ПАРТНЁРСТВО ====================

/** POST /stock-partnerships/companies/{id}/terminate/ */
export const terminateStockPartnership = (partnerCompanyId) =>
  request("post", `${BASE}/companies/${partnerCompanyId}/terminate/`);

/**
 * PATCH /stock-partnerships/companies/{id}/settings/
 * @param {{ allow_direct_pull: boolean }} payload — разрешить партнёру забирать
 *   товар и деньги вашей компании без подтверждения.
 */
export const updateStockPartnershipSettings = (partnerCompanyId, payload) =>
  request("patch", `${BASE}/companies/${partnerCompanyId}/settings/`, {
    data: payload,
  });

// ==================== КАТАЛОГ ПАРТНЁРА ====================

/**
 * Склады и кассы партнёра без товаров.
 * GET /stock-partnerships/companies/{id}/warehouses/
 * Старый бэк: полный каталог (склады вместе со всеми товарами).
 *
 * @returns {{ source: "light" | "catalog", partner_company, partnership,
 *   warehouses: Array, cash_registers: Array }}
 *   При source === "catalog" у складов есть массив products.
 */
export const getPartnerWarehouses = (partnerCompanyId) =>
  withFallback(
    "partner-warehouses",
    async () => ({
      ...(await request("get", `${BASE}/companies/${partnerCompanyId}/warehouses/`)),
      source: "light",
    }),
    async () => ({
      ...(await getStockPartnerCatalog(partnerCompanyId)),
      source: "catalog",
    }),
  );

/**
 * Товары склада партнёра с пагинацией и поиском на бэке.
 * GET /stock-partnerships/companies/{id}/warehouses/{wid}/products/
 * Есть только на новом бэке: вызывать, когда getPartnerWarehouses вернул source === "light".
 */
export const listPartnerWarehouseProducts = (partnerCompanyId, warehouseId, params = {}) =>
  request(
    "get",
    `${BASE}/companies/${partnerCompanyId}/warehouses/${warehouseId}/products/`,
    { params },
  );

// ==================== ИСТОРИЯ ПРОДАЖ ПАРТНЁРА ====================

/**
 * Продажи / возвраты продаж компании-партнёра с пагинацией и сводкой.
 * GET /stock-partnerships/companies/{id}/sales/
 * Params: period, date | date_from + date_to, doc_type (SALE | SALE_RETURN),
 *   status (POSTED | CASH_PENDING), search, partner_branch, page, page_size.
 * На старом бэке эндпоинта нет — вызывающий проверяет isEndpointMissing(err).
 */
export const listPartnerSales = (partnerCompanyId, params = {}) =>
  request("get", `${BASE}/companies/${partnerCompanyId}/sales/`, { params });

/** GET /stock-partnerships/companies/{id}/sales/{document_id}/ — документ со строками. */
export const getPartnerSale = (partnerCompanyId, documentId) =>
  request("get", `${BASE}/companies/${partnerCompanyId}/sales/${documentId}/`);

// ==================== ОПЕРАЦИИ С ПОДТВЕРЖДЕНИЕМ ====================

/**
 * GET /stock-partnerships/operations/ → { incoming: [], outgoing: [] }
 * Возвращает null, если на бэке ещё нет операций с подтверждением.
 */
export const listPartnerOperations = async () => {
  if (missingEndpoints.has("operations")) return null;
  try {
    return await request("get", `${BASE}/operations/`);
  } catch (err) {
    if (isEndpointMissing(err)) {
      missingEndpoints.add("operations");
      return null;
    }
    throw err;
  }
};

/** POST /stock-partnerships/operations/{id}/approve/ */
export const approvePartnerOperation = (id) =>
  request("post", `${BASE}/operations/${id}/approve/`);

/** POST /stock-partnerships/operations/{id}/reject/ */
export const rejectPartnerOperation = (id, reason) =>
  request("post", `${BASE}/operations/${id}/reject/`, {
    data: reason ? { reason } : {},
  });

/** POST /stock-partnerships/operations/{id}/cancel/ */
export const cancelPartnerOperation = (id) =>
  request("post", `${BASE}/operations/${id}/cancel/`);

export default {
  searchPartnershipCompanies,
  terminateStockPartnership,
  updateStockPartnershipSettings,
  getPartnerWarehouses,
  listPartnerWarehouseProducts,
  listPartnerSales,
  getPartnerSale,
  listPartnerOperations,
  approvePartnerOperation,
  rejectPartnerOperation,
  cancelPartnerOperation,
};
