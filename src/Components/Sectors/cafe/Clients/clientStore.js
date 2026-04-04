// src/Components/Sectors/cafe/Clients/clientStore.js
import api from "../../../../api";

// ===== helpers
const toNum = (v) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Остаток к оплате: из API или total − скидка − оплачено (архивные заказы часто без balance_due). */
export function computeBalanceDue(o) {
  if (o?.balance_due != null && o.balance_due !== "") {
    return Math.max(0, toNum(o.balance_due));
  }
  const total = toNum(o.total_amount ?? o.total ?? o.amount);
  const disc = toNum(o.discount_amount);
  const paid = toNum(o.paid_amount);
  return Math.max(0, total - disc - paid);
}

// клиент из /cafe/clients/
const normalizeClient = (c) => ({
  id: c.id,
  full_name: c.name ?? c.full_name ?? "",
  phone: c.phone ?? "",
  notes: c.notes ?? "",
  created_at: c.created_at || null,
  updated_at: c.updated_at || null,
  orders: Array.isArray(c.orders) ? c.orders : [],
});

// DRF pagination fetch-all
async function fetchAll(url0) {
  let url = url0;
  const acc = [];
  let guard = 0;
  while (url && guard < 60) {
    const { data } = await api.get(url);
    const list = Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data)
      ? data
      : [];
    acc.push(...list);
    url = data?.next || null;
    guard += 1;
  }
  return acc;
}

/* ===== public: clients CRUD ===== */
export async function getAll() {
  const raw = await fetchAll("/cafe/clients/");
  return raw.map(normalizeClient);
}

/** Один гость — GET /cafe/clients/:id/ (без загрузки всего списка). */
export async function getClient(id) {
  if (!id) return null;
  const { data } = await api.get(`/cafe/clients/${id}/`);
  return normalizeClient(data);
}

export async function createClient(dto) {
  const payload = {
    name: (dto.full_name || dto.name || "").trim(),
    phone: (dto.phone || "").trim(),
    notes: (dto.notes || "").trim(),
  };
  const { data } = await api.post("/cafe/clients/", payload);
  return normalizeClient(data);
}

export async function updateClient(id, patch) {
  const payload = {
    name: (patch.full_name || patch.name || "").trim(),
    phone: (patch.phone || "").trim(),
    notes: (patch.notes || "").trim(),
  };
  const { data } = await api.put(`/cafe/clients/${id}/`, payload);
  return normalizeClient(data);
}

export async function removeClient(id) {
  await api.delete(`/cafe/clients/${id}/`);
  return true;
}

/* ===== orders for client (активные + история) ===== */

const normalizeOrderLite = (o) => ({
  id: o.id,
  table: o.table ?? null,
  table_name: o.table_name ?? o.table_label ?? o.table_number ?? "",
  guests: o.guests ?? o.people ?? 0,
  status: o.status ?? "",
  created_at: o.created_at || null,
  items: Array.isArray(o.items) ? o.items : [],
  total: toNum(o.total ?? o.total_amount ?? o.amount ?? 0),
  original_order_id: o.original_order_id ?? o.original_id ?? null,
  total_amount: o.total_amount ?? null,
  discount_amount: o.discount_amount ?? null,
  paid_amount: o.paid_amount ?? null,
  balance_due: o.balance_due ?? null,
  payment_method: o.payment_method ?? null,
  is_paid: o.is_paid ?? null,
});

const lineUnitPrice = (it) => {
  if (String(it?.line_kind || "menu").toLowerCase() === "service") {
    return toNum(it.unit_price ?? it.price ?? it.price_each ?? 0);
  }
  return toNum(it.menu_item_price ?? it.price ?? it.price_each ?? 0);
};

const calcOrderTotal = (ord) => {
  const items = Array.isArray(ord?.items) ? ord.items : [];
  return items.reduce((s, it) => {
    const price = lineUnitPrice(it);
    const qty = Number(it.quantity) || 0;
    return s + price * qty;
  }, 0);
};

function resolveOrderRowTotal(o) {
  let total = toNum(o?.total);
  if (!total && o?.total_amount != null && o.total_amount !== "")
    total = toNum(o.total_amount);
  if (!total) total = calcOrderTotal(o);
  return total;
}

/** Один «логический» заказ: архив ссылается на исходный id — не дублировать со списком /cafe/orders/. */
function orderDedupeKey(o) {
  const k = o?.original_order_id ?? o?.original_id ?? o?.id;
  return k != null && k !== "" ? String(k) : "";
}

function mergeOrdersWithoutDuplicates(activeRows, historyRows) {
  const byKey = new Map();
  const extras = [];

  for (const o of activeRows) {
    const k = orderDedupeKey(o);
    if (k) byKey.set(k, o);
    else extras.push(o);
  }
  for (const o of historyRows) {
    const k = orderDedupeKey(o);
    if (k) {
      if (!byKey.has(k)) byKey.set(k, o);
    } else {
      extras.push(o);
    }
  }
  return [...byKey.values(), ...extras];
}

/**
 * Полные данные заказа для модалки «Детали» (GET /cafe/orders/:id/).
 * Для архива id запроса — original_order_id (как при оплате долга).
 */
export async function fetchCafeOrderDetail(order) {
  if (!order?.id) return null;
  const detailId = order.original_order_id ?? order.original_id ?? order.id;
  const { data } = await api.get(`/cafe/orders/${detailId}/`);
  const merged = normalizeOrderLite({ ...order, ...data });
  const total = resolveOrderRowTotal(merged);
  return {
    ...merged,
    id: order.id,
    original_id: order.original_id ?? order.original_order_id ?? merged.original_order_id,
    original_order_id:
      order.original_order_id ?? order.original_id ?? merged.original_order_id,
    total,
    balance_due: computeBalanceDue({ ...merged, total }),
  };
}

const normalizeHistoryLite = (h) => ({
  id: h.id,
  original_id: h.original_order_id || null,
  original_order_id: h.original_order_id || null,
  table: h.table ?? null,
  table_name: h.table_number != null ? `Стол ${h.table_number}` : "",
  guests: h.guests ?? 0,
  status: h.status || "архив",
  created_at: h.created_at || h.archived_at || null,
  archived_at: h.archived_at || null,
  items: Array.isArray(h.items) ? h.items : [],
  total: 0,
  total_amount: h.total_amount ?? null,
  discount_amount: h.discount_amount ?? null,
  is_paid: h.is_paid ?? false,
  paid_at: h.paid_at ?? null,
  payment_method: h.payment_method ?? null,
  paid_amount: h.paid_amount ?? null,
  waiter: h.waiter ?? null,
  waiter_label: h.waiter_label ?? null,
});

function calcHistoryTotal(items) {
  const arr = Array.isArray(items) ? items : [];
  return arr.reduce((s, it) => {
    const price = lineUnitPrice(it);
    const qty = Number(it.quantity) || 0;
    return s + price * qty;
  }, 0);
}

async function getOrdersHistoryByClient(clientId) {
  const raw = await fetchAll(`/cafe/clients/${clientId}/orders/history/`);
  return raw.map((h) => {
    const base = normalizeHistoryLite(h);
    // Используем total_amount из API, если есть, иначе считаем из items
    const total = base.total_amount != null ? toNum(base.total_amount) : calcHistoryTotal(base.items);
    const balance_due = computeBalanceDue({ ...base, total });
    /* Позиции подгружаются в модалке «Детали заказа» (fetchCafeOrderDetail). */
    return { ...base, total, balance_due, items: [] };
  });
}

export async function getOrdersByClient(clientId) {
  if (!clientId) return [];

  let raw = await fetchAll(`/cafe/orders/?client=${clientId}`);
  if (!raw.length) raw = await fetchAll(`/cafe/clients/${clientId}/orders/`);

  const base = raw.map(normalizeOrderLite);
  const withTotals = base.map((o) => {
    const total = resolveOrderRowTotal(o);
    return { ...o, total, balance_due: computeBalanceDue({ ...o, total }) };
  });

  const history = await getOrdersHistoryByClient(clientId);

  const merged = mergeOrdersWithoutDuplicates(withTotals, history);

  return merged.sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );
}

/* ===== ЛЁГКАЯ СТАТИСТИКА ДЛЯ ТАБЛИЦЫ (без истории — она грузится в карточке гостя) ===== */
export async function getOrdersStatsByClient(clientId) {
  if (!clientId) return { orders_count: 0, updated_at_derived: null };

  let active = await fetchAll(`/cafe/orders/?client=${clientId}`);
  if (!Array.isArray(active)) active = [];

  const lastActive =
    active
      .map((o) => o.created_at)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || null;

  return { orders_count: active.length, updated_at_derived: lastActive };
}
