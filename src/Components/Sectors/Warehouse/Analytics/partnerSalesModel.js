/**
 * История продаж компании-партнёра: параметры запроса и разбор ответа
 * GET /api/warehouse/stock-partnerships/companies/{id}/sales/
 * (docs/warehouse/stock-partnership.md, §7.15).
 */

export const PARTNER_SALES_PAGE_SIZE = 50;

export const PARTNER_SALES_DOC_TYPES = [
  { value: "SALE", label: "Продажи" },
  { value: "SALE_RETURN", label: "Возвраты" },
];

/** "" — проведённые и ожидающие кассы вместе (как в выручке аналитики). */
export const PARTNER_SALES_STATUS_FILTERS = [
  { value: "", label: "Все" },
  { value: "POSTED", label: "Проведённые" },
  { value: "CASH_PENDING", label: "Ожидают кассы" },
];

const SALE_STATUS = {
  POSTED: { label: "Проведён", className: "is-posted" },
  CASH_PENDING: { label: "Ожидает кассы", className: "is-pending" },
};

export const saleStatusMeta = (status) =>
  SALE_STATUS[status] || { label: status || "—", className: "" };

export const paymentKindLabel = (kind) => {
  switch (String(kind || "").toLowerCase()) {
    case "":
      return "—";
    case "cash":
      return "Через кассу";
    case "credit":
      return "В долг";
    case "external":
      return "Вне кассы";
    default:
      return String(kind);
  }
};

/**
 * @param {object} periodParams результат useAnalyticsPeriod().periodParams()
 */
export const buildPartnerSalesParams = ({
  periodParams,
  docType = "SALE",
  status = "",
  search = "",
  partnerBranch,
  page = 1,
  pageSize = PARTNER_SALES_PAGE_SIZE,
}) => {
  const params = { ...periodParams, doc_type: docType, page, page_size: pageSize };
  if (status) params.status = status;
  const q = String(search || "").trim();
  if (q) params.search = q;
  if (partnerBranch) params.partner_branch = partnerBranch;
  return params;
};

/** null — значения нет (а не 0): пустую сводку показываем «—», а не нулём. */
const toNumber = (v) => {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export const normalizePartnerSalesResponse = (data) => {
  const rows = Array.isArray(data?.results) ? data.results : [];
  const summary = data?.summary || {};
  return {
    rows,
    count: typeof data?.count === "number" ? data.count : rows.length,
    next: data?.next ?? null,
    previous: data?.previous ?? null,
    dateFrom: data?.date_from ?? null,
    dateTo: data?.date_to ?? null,
    partnerName: data?.partner_company?.name ?? null,
    summary: {
      count: toNumber(summary.count),
      amount: toNumber(summary.amount),
      discountAmount: toNumber(summary.discount_amount),
      itemsQty: toNumber(summary.items_qty),
    },
  };
};

/**
 * Сумма строки документа после скидок: net_amount от бэка (миграция 0046),
 * иначе считаем qty × price − discount_amount.
 */
export const saleLineAmount = (item) => {
  const net = toNumber(item?.net_amount ?? item?.line_total);
  if (net != null) return net;
  const qty = toNumber(item?.qty ?? item?.quantity) ?? 0;
  const price = toNumber(item?.price ?? item?.unit_price) ?? 0;
  const discount = toNumber(item?.discount_amount) ?? 0;
  return Math.max(0, qty * price - discount);
};
