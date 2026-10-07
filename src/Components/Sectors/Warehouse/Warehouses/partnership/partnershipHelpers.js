import { PartnershipApiError } from "../../../../../api/warehousePartnership";

const collectMessages = (value, out) => {
  if (value == null) return;
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    if (text) out.push(text);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v) => collectMessages(v, out));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((v) => collectMessages(v, out));
  }
};

/**
 * Человекочитаемый текст ошибки партнёрских эндпоинтов. Принимает и
 * `error.response.data` из api/warehouse.js, и PartnershipApiError.
 * Ключи полей не показываем: сообщения бэка уже на русском.
 */
export const extractPartnershipError = (err) => {
  if (!err) return "Неизвестная ошибка";
  if (err instanceof PartnershipApiError) {
    if (err.data && typeof err.data === "object") {
      return extractPartnershipError(err.data);
    }
    if (err.status === 403) return "Недостаточно прав для этого действия.";
    if (err.status === 404) return "Не найдено.";
    return `Ошибка сервера (${err.status ?? "нет ответа"}).`;
  }
  if (typeof err === "string") {
    return err.trim().startsWith("<") ? "Ошибка сервера." : err;
  }
  if (err instanceof Error) return err.message || "Неизвестная ошибка";
  if (err.detail) return String(err.detail);
  const messages = [];
  collectMessages(err, messages);
  return messages.length ? [...new Set(messages)].join("; ") : "Неизвестная ошибка";
};

/** pluralRu(3, ["товар", "товара", "товаров"]) → "товара" */
export const pluralRu = (n, [one, few, many]) => {
  const abs = Math.abs(Number(n) || 0) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
};

export const isOwnerOrAdmin = (profile) =>
  profile?.role === "owner" || profile?.role === "admin";

export const normalizeList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const toNumber = (raw) => {
  const n = Number(String(raw ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export const getProductQty = (product) =>
  toNumber(product?.qty ?? product?.quantity ?? product?.stock);

export const mapOwnProductRow = (row) => ({
  id: row.id,
  name: row.name,
  article: row.article,
  barcode: row.barcode,
  unit: row.unit,
  qty: row.quantity ?? row.qty ?? row.stock,
  purchase_price: row.purchase_price,
});

/**
 * Цена строки межкомпанейского перемещения: закупочная цена источника.
 * Бэк после этапа 1 сам подставляет себестоимость; до этого фронт передаёт то,
 * что знает (у товаров партнёра цены в каталоге нет — тогда 0).
 */
export const transferItemPrice = (product) => {
  const n = toNumber(product?.purchase_price);
  return (n > 0 ? n : 0).toFixed(2);
};

export const formatQty = (v) => toNumber(v).toFixed(3);

/**
 * Количество для перемещения: > 0 и не больше остатка (если остаток известен).
 * @returns {string|null} текст ошибки
 */
export const validateTransferQty = (value, maxQty) => {
  const qtyNum = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(qtyNum) || qtyNum <= 0) return "Укажите корректное количество";
  if (maxQty > 0 && qtyNum > maxQty) {
    return `Количество не может превышать остаток (${formatQty(maxQty)})`;
  }
  return null;
};

export const warehouseLabel = (w) => {
  if (!w) return "—";
  const name = w.name || w.title || `Склад #${w.id}`;
  return w.branch_name ? `${name} (${w.branch_name})` : name;
};

export const filterProducts = (products, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return products;
  return products.filter((p) => {
    const name = String(p.name || "").toLowerCase();
    const article = String(p.article || "").toLowerCase();
    const barcode = String(p.barcode || "").toLowerCase();
    return name.includes(q) || article.includes(q) || barcode.includes(q);
  });
};

/**
 * Ответ transfer / cash-incassations: операция ушла партнёру на подтверждение
 * (HTTP 202, `{ result: "pending", operation }`), а не проведена сразу.
 */
export const isPendingOperationResponse = (data) =>
  data?.result === "pending" || data?.operation?.status === "PENDING";

/**
 * Как партнёр отдаёт свой товар и деньги:
 * - "confirm" — каждое «забрать» партнёр подтверждает;
 * - "direct"  — партнёр разрешил забирать без подтверждения;
 * - "legacy"  — старый бэк: списание у партнёра происходит сразу.
 */
export const partnerPullMode = (partnership) => {
  const flag = partnership?.partner_allows_direct_pull;
  if (flag === true) return "direct";
  if (flag === false) return "confirm";
  return "legacy";
};

export const PULL_MODE_HINT = {
  confirm:
    "Партнёр получит запрос и должен его подтвердить. Товар или деньги поступят после подтверждения.",
  direct:
    "Партнёр разрешил забирать без подтверждения: операция проведётся сразу.",
  legacy:
    "Операция проведётся сразу: остаток или деньги спишутся у партнёра без его подтверждения.",
};

export const PARTNERSHIP_REQUEST_STATUS = {
  PENDING: { label: "Ожидает", className: "badge--pending" },
  ACCEPTED: { label: "Принята", className: "badge--approved" },
  REJECTED: { label: "Отклонена", className: "badge--rejected" },
  CANCELLED: { label: "Отозвана", className: "badge--removed" },
};

export const PARTNER_OPERATION_STATUS = {
  PENDING: { label: "Ожидает", className: "badge--pending" },
  APPROVED: { label: "Проведена", className: "badge--approved" },
  REJECTED: { label: "Отклонена", className: "badge--rejected" },
  CANCELLED: { label: "Отозвана", className: "badge--removed" },
  FAILED: { label: "Ошибка", className: "badge--rejected" },
};

export const statusMeta = (map, status) =>
  map[status] || { label: status || "—", className: "badge--draft" };

export const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString("ru-RU");
};

export const fmtMoney = (v) =>
  toNumber(v).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Краткое описание операции для таблицы входящих/исходящих. */
export const describePartnerOperation = (op) => {
  if (!op) return "—";
  if (op.kind === "INCASSATION") {
    const from = op.cash_register_from_name || "касса";
    const to = op.cash_register_to_name || "касса";
    return `${fmtMoney(op.amount)} сом: ${from} → ${to}`;
  }
  const items = Array.isArray(op.items) ? op.items : [];
  const from = op.warehouse_from_name || "склад";
  const to = op.warehouse_to_name || "склад";
  const count = items.length;
  return `${count} ${pluralRu(count, ["позиция", "позиции", "позиций"])}: ${from} → ${to}`;
};

/**
 * Статус компании в выдаче поиска для приглашения.
 * Новый бэк отдаёт partnership_status, для старого вычисляем по уже
 * загруженным спискам партнёров и заявок.
 */
export const resolveInviteStatus = (company, { ownCompanyId, partnerIds, outgoingPendingIds, incomingPendingIds }) => {
  const id = String(company?.id ?? "");
  if (!id) return "UNAVAILABLE";
  if (ownCompanyId && id === String(ownCompanyId)) return "SELF";
  if (company.partnership_status) return company.partnership_status;
  if (partnerIds.has(id)) return "ACTIVE";
  if (outgoingPendingIds.has(id)) return "PENDING_OUT";
  if (incomingPendingIds.has(id)) return "PENDING_IN";
  return null;
};

export const INVITE_STATUS_LABEL = {
  SELF: "Ваша компания",
  ACTIVE: "Уже партнёр",
  PENDING_OUT: "Заявка отправлена",
  PENDING_IN: "Есть входящая заявка",
  UNAVAILABLE: "Недоступно",
};

export const INVITE_MIN_SEARCH_LENGTH = 3;
