import api from "../../../../api";

// ===== helpers
const toNum = (v) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

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
  total: toNum(o.total ?? o.amount ?? 0),
});

const calcOrderTotal = (ord) => {
  const items = Array.isArray(ord?.items) ? ord.items : [];
  return items.reduce((s, it) => {
    const price = toNum(it.menu_item_price ?? it.price ?? it.price_each ?? 0);
    const qty = Number(it.quantity) || 0;
    return s + price * qty;
  }, 0);
};

async function enrichOrdersDetails(list) {
  const needIds = list
    .filter(
      (o) =>
        !o.status || !o.total || !Array.isArray(o.items) || o.items.length === 0
    )
    .map((o) => o.id);

  if (!needIds.length) return list;

  const details = await Promise.all(
    needIds.map((id) =>
      api
        .get(`/cafe/orders/${id}/`)
        .then((r) => ({ id, data: r.data }))
        .catch(() => null)
    )
  );

  const byId = new Map(
    details.filter(Boolean).map((x) => [String(x.id), x.data])
  );
  return list.map((o) => {
    const d = byId.get(String(o.id));
    if (!d) return { ...o, total: o.total || calcOrderTotal(o) };
    const merged = normalizeOrderLite({ ...o, ...d });
    return { ...merged, total: merged.total || calcOrderTotal(merged) };
  });
}

const normalizeHistoryLite = (h) => ({
  id: h.id,
  original_id: h.original_order_id || null,
  table: h.table ?? null,
  table_name: h.table_number != null ? `Стол ${h.table_number}` : "",
  guests: h.guests ?? 0,
  status: "архив",
  created_at: h.created_at || h.archived_at || null,
  archived_at: h.archived_at || null,
  items: Array.isArray(h.items) ? h.items : [],
  total: 0,
});

function calcHistoryTotal(items) {
  const arr = Array.isArray(items) ? items : [];
  return arr.reduce((s, it) => {
    const price = toNum(it.menu_item_price);
    const qty = Number(it.quantity) || 0;
    return s + price * qty;
  }, 0);
}

async function getOrdersHistoryByClient(clientId) {
  const raw = await fetchAll(`/cafe/clients/${clientId}/orders/history/`);
  return raw.map((h) => {
    const base = normalizeHistoryLite(h);
    return { ...base, total: calcHistoryTotal(base.items) };
  });
}

export async function getOrdersByClient(clientId) {
  if (!clientId) return [];

  let raw = await fetchAll(`/cafe/orders/?client=${clientId}`);
  if (!raw.length) raw = await fetchAll(`/cafe/clients/${clientId}/orders/`);
  const base = raw.map(normalizeOrderLite);
  const fullActive = await enrichOrdersDetails(base);
  const withTotals = fullActive.map((o) => ({
    ...o,
    total: o.total || calcOrderTotal(o),
  }));

  const history = await getOrdersHistoryByClient(clientId);

  return [...withTotals, ...history].sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );
}

/* ===== ЛЁГКАЯ СТАТИСТИКА ДЛЯ ТАБЛИЦЫ ===== */
export async function getOrdersStatsByClient(clientId) {
  if (!clientId) return { orders_count: 0, updated_at_derived: null };

  // активные
  let active = await fetchAll(`/cafe/orders/?client=${clientId}`);
  if (!Array.isArray(active)) active = [];

  // история
  let history = await fetchAll(`/cafe/clients/${clientId}/orders/history/`);
  if (!Array.isArray(history)) history = [];

  const count = active.length + history.length;

  const lastActive =
    active
      .map((o) => o.created_at)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || null;

  const lastHist =
    history
      .map((h) => h.created_at || h.archived_at)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || null;

  const updated_at_derived =
    [lastActive, lastHist].filter(Boolean).sort().slice(-1)[0] || null;

  return { orders_count: count, updated_at_derived };
}
