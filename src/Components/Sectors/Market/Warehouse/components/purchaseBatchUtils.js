export const formatBatchDateTime = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
};

export const formatBatchNumber = (value) =>
  Number(value || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });

export const formatBatchMoney = (value, fractionDigits = 2) => {
  if (value == null || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${num.toLocaleString("ru-RU", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} сом`;
};

export const receiptItemLabel = (item) => {
  if (!item || typeof item !== "object") return "—";
  const product = item.product;
  if (product && typeof product === "object") {
    return (
      product.product_name ||
      product.name ||
      product.title ||
      product.article ||
      product.barcode ||
      "—"
    );
  }
  return (
    item.product_name ||
    item.name ||
    item.title ||
    item.product_title ||
    (item.product != null ? `Товар #${item.product}` : "—")
  );
};
