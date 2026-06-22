import api from "@/api";

const BASE = "/building";

export const DEFAULT_PAGE_SIZE = 10;

export const normalizePaginated = (payload) => {
  const results = Array.isArray(payload?.results)
    ? payload.results
    : Array.isArray(payload)
      ? payload
      : [];

  const count =
    typeof payload?.count === "number" ? payload.count : results.length;

  return {
    results,
    count,
    next: payload?.next ?? null,
    previous: payload?.previous ?? null,
  };
};

export const getPageCount = (count, pageSize = DEFAULT_PAGE_SIZE) => {
  if (!count || !pageSize) return 1;
  return Math.max(1, Math.ceil(count / pageSize));
};

export const withPagination = (params = {}, page = 1, pageSize = DEFAULT_PAGE_SIZE) => ({
  ...params,
  page,
  page_size: pageSize,
});

export const fetchProcurements = (params) =>
  api.get(`${BASE}/procurements/`, { params });

export const createProcurement = (payload) =>
  api.post(`${BASE}/procurements/`, payload);

export const submitToCash = (procurementId) =>
  api.post(`${BASE}/procurements/${procurementId}/submit-to-cash/`);

export const createTransfer = (procurementId, payload) =>
  api.post(`${BASE}/procurements/${procurementId}/transfers/create/`, payload);

export const fetchProcurementItems = (params) =>
  api.get(`${BASE}/procurement-items/`, { params });

export const fetchWorkflowEvents = (params) =>
  api.get(`${BASE}/workflow-events/`, { params });

export const fetchPendingCashProcurements = (params) =>
  api.get(`${BASE}/cash/procurements/pending/`, { params });

export const approveCashProcurement = (procurementId, payload) =>
  api.post(`${BASE}/cash/procurements/${procurementId}/approve/`, payload);

export const rejectCashProcurement = (procurementId, payload) =>
  api.post(`${BASE}/cash/procurements/${procurementId}/reject/`, payload);

export const fetchWarehouseTransfers = (params) =>
  api.get(`${BASE}/warehouse-transfers/`, { params });

export const acceptWarehouseTransfer = (transferId, payload) =>
  api.post(`${BASE}/warehouse-transfers/${transferId}/accept/`, payload);

export const rejectWarehouseTransfer = (transferId, payload) =>
  api.post(`${BASE}/warehouse-transfers/${transferId}/reject/`, payload);

export const fetchWarehouseStockItems = (params) =>
  api.get(`${BASE}/warehouse-stock/items/`, { params });

export const fetchWarehouseStockMoves = (params) =>
  api.get(`${BASE}/warehouse-stock/moves/`, { params });
