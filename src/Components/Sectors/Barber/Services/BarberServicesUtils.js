// BarberServicesUtils.js

export const fmtMoney = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString("ru-RU")} сом` : "—";
};

export const mapService = (s) => ({
  id: s.id,
  name: s.name ?? "",
  price: s.price ?? 0,
  active: Boolean(s.is_active ?? true),
  time: s.time ?? "",
  categoryId: s.category || "",
  categoryName: s.category_name || "",
  createdAt: s.created_at || s.createdAt || null,
  updatedAt: s.updated_at || s.updatedAt || null,
});

export const mapCategory = (c) => ({
  id: c.id,
  name: c.name ?? "",
  active: Boolean(c.is_active ?? true),
});
