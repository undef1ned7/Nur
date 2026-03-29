export function safe(v) {
  return v ? String(v) : "—";
}

export function n2(v) {
  const num = Number(v || 0);
  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtQty(v) {
  const num = Number(v || 0);
  return num.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  });
}

export function fmtDate(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function fmtDateTime(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getDocumentTitle(docType) {
  const titles = {
    SALE: "Расходная накладная",
    PURCHASE: "Приходная накладная",
    SALE_RETURN: "Расходная накладная на возврат",
    PURCHASE_RETURN: "Приходная накладная на возврат",
    INVENTORY: "Бланк инвентаризации",
    RECEIPT: "Оприходование",
    WRITE_OFF: "Списание",
    TRANSFER: "Накладная на перемещение",
  };
  return titles[docType] || "Накладная";
}

export function needsPriceColumns(docType) {
  return !["INVENTORY", "TRANSFER"].includes(docType);
}

export function needsDiscountColumns(docType) {
  return ["SALE", "PURCHASE", "SALE_RETURN", "PURCHASE_RETURN"].includes(docType);
}

/**
 * Отдельно сумма и процент скидки по документу: в сумму не подставляем discount_percent.
 */
export function resolveDocumentDiscount(doc, data, subtotal) {
  const rawPercent = Number(doc.discount_percent);
  const percentProvided =
    doc.discount_percent != null &&
    doc.discount_percent !== "" &&
    !Number.isNaN(rawPercent) &&
    rawPercent >= 0 &&
    rawPercent <= 100;

  const explicitAmount = Number(
    doc.order_discount_total ??
      doc.discount_total ??
      doc.discount_amount ??
      data?.order_discount_total ??
      0
  );

  let documentDiscountPercent = 0;
  let documentDiscountAmount = 0;

  if (percentProvided) {
    documentDiscountPercent = rawPercent;
    if (explicitAmount > 0) {
      documentDiscountAmount = explicitAmount;
    } else if (subtotal > 0) {
      documentDiscountAmount = (subtotal * rawPercent) / 100;
    }
  } else if (explicitAmount > 0) {
    documentDiscountAmount = explicitAmount;
    if (subtotal > 0) {
      documentDiscountPercent = (explicitAmount / subtotal) * 100;
    }
  }

  return { documentDiscountPercent, documentDiscountAmount };
}

/** Стабильный ключ строки PDF (список статичен; без id — составной). */
export function goodsRowKey(it, idx, invoiceNumber) {
  if (it.id != null && it.id !== "") {
    return `id-${String(it.id)}`;
  }
  const name = String(it.name ?? "").slice(0, 48);
  const art = String(it.article ?? "");
  return `row-${invoiceNumber || "n"}-${idx}-${name}-${art}`;
}
