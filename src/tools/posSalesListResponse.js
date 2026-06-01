/** Парсинг ответа GET /main/pos/sales/ (и совместимых списков продаж). */

export const parsePosSalesListTotalAmount = (payload) => {
  const data = payload?.data ?? payload;
  const meta = data?.meta && typeof data.meta === "object" ? data.meta : {};
  const raw =
    meta.total_amount ?? data?.total_amount ?? meta.sales_total_amount ?? null;
  if (raw == null || raw === "") return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
};

export const parsePosSalesListResponse = (payload) => {
  const data = payload?.data ?? payload;
  const rows = data?.results ?? (Array.isArray(data) ? data : []);
  const list = Array.isArray(rows) ? rows : [];
  return {
    list,
    count: Number(data?.count) || list.length,
    next: data?.next ?? null,
    previous: data?.previous ?? null,
    totalAmount: parsePosSalesListTotalAmount(payload),
  };
};
