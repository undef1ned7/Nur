// BarberServicesUtils.js

export const PAGE_SIZE = 12;

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

const baseServiceSorter = (lastAddedId) => (a, b) => {
  if (a.active !== b.active) return a.active ? -1 : 1;

  if (lastAddedId && (a.id === lastAddedId || b.id === lastAddedId)) {
    if (a.id === lastAddedId && b.id !== lastAddedId) return -1;
    if (b.id === lastAddedId && a.id !== lastAddedId) return 1;
  }

  if (a.createdAt && b.createdAt) {
    const ad = new Date(a.createdAt).getTime() || 0;
    const bd = new Date(b.createdAt).getTime() || 0;
    if (ad !== bd) return bd - ad;
  }

  return String(a.name || "").localeCompare(String(b.name || ""), "ru", {
    sensitivity: "base",
  });
};

export const serviceSorter = (lastAddedId) => baseServiceSorter(lastAddedId);

export const categorySorter = (a, b) =>
  String(a.name || "").localeCompare(String(b.name || ""), "ru", {
    sensitivity: "base",
  });
