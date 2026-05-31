export const extractPartnershipError = (err) => {
  if (!err) return "Неизвестная ошибка";
  if (typeof err === "string") return err;
  if (err.detail) return String(err.detail);
  const parts = Object.entries(err).map(([k, v]) => {
    if (typeof v === "object") return `${k}: ${JSON.stringify(v)}`;
    return `${k}: ${v}`;
  });
  return parts.length ? parts.join("; ") : JSON.stringify(err);
};

export const normalizeList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

export const getProductQty = (product) => {
  const raw = product?.qty ?? product?.quantity ?? product?.stock;
  const n = Number(String(raw ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export const mapOwnProductRow = (row) => ({
  id: row.id,
  name: row.name,
  article: row.article,
  unit: row.unit,
  qty: row.quantity ?? row.qty ?? row.stock,
});

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
