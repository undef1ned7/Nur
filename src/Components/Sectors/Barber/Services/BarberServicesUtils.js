// BarberServicesUtils.js

export const fmtMoney = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString("ru-RU")} сом` : "—";
};

export const mapEmployee = (e) => {
  const first = e.first_name ?? "";
  const last = e.last_name ?? "";
  const name =
    [last, first].filter(Boolean).join(" ").trim() || e.email || "—";
  return { id: e.id, name };
};

export const mapService = (s) => ({
  id: s.id,
  name: s.name ?? "",
  price: s.price ?? 0,
  active: Boolean(s.is_active ?? true),
  time: s.time ?? "",
  categoryId: s.category || "",
  categoryName: s.category_name || "",
  barbers: Array.isArray(s.barbers)
    ? s.barbers.map(String)
    : Array.isArray(s.barbers_detail)
    ? s.barbers_detail.map((b) => String(b.id))
    : [],
  barbersDetail: Array.isArray(s.barbers_detail)
    ? s.barbers_detail.map((b) => ({
        id: b.id,
        fullName: b.full_name || "",
      }))
    : [],
  createdAt: s.created_at || s.createdAt || null,
  updatedAt: s.updated_at || s.updatedAt || null,
});

export const formatBarberNames = (service) => {
  const names = (service?.barbersDetail || [])
    .map((b) => b.fullName)
    .filter(Boolean);
  return names.length ? names.join(", ") : "—";
};

export const mapCategory = (c) => ({
  id: c.id,
  name: c.name ?? "",
  active: Boolean(c.is_active ?? true),
});
