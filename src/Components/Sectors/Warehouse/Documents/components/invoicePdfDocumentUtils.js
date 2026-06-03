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

/** Дата и время в заголовке: «27.01.2017 13:44». */
export function fmtTitleDateTime(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  const datePart = d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timePart = d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} ${timePart}`;
}

export function getDocumentTitle(docType) {
  const titles = {
    SALE: "Товарная накладная",
    PURCHASE: "Товарная накладная",
    SALE_RETURN: "Товарная накладная (возврат)",
    PURCHASE_RETURN: "Товарная накладная (возврат)",
    INVENTORY: "Инвентаризационная опись",
    RECEIPT: "Накладная на оприходование",
    WRITE_OFF: "Накладная на списание",
    TRANSFER: "Накладная на перемещение",
    COMMERCIAL_OFFER: "Коммерческое предложение",
  };
  return titles[docType] || "Товарная накладная";
}

export function needsPriceColumns(docType) {
  return !["INVENTORY", "TRANSFER"].includes(docType);
}

export function needsDiscountColumns(docType) {
  return needsPriceColumns(docType);
}

export function fmtDiscountPct(v) {
  const num = Number(v || 0);
  if (!num) return "—";
  return (
    num.toLocaleString("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) + "%"
  );
}

export function usesPartyBlocks(docType) {
  return !["INVENTORY", "TRANSFER"].includes(docType);
}

export function resolvePartiesForDocType(docType, seller, buyer) {
  const s = seller || {};
  const b = buyer || {};

  if (["PURCHASE", "PURCHASE_RETURN"].includes(docType)) {
    return {
      supplier: {
        name: safe(b.name || b.full_name),
        addressLine: b.address ? `Адрес: ${safe(b.address)}` : "",
        phoneLine: b.phone ? `Тел: ${safe(b.phone)}` : "",
      },
      buyer: {
        name: safe(s.name),
        addressLine: s.address ? `Адрес: ${safe(s.address)}` : "",
        phoneLine: s.phone ? `Тел: ${safe(s.phone)}` : "",
      },
    };
  }

  return {
    supplier: {
      name: safe(s.name),
      addressLine: s.address ? `Адрес: ${safe(s.address)}` : "",
      phoneLine: s.phone ? `Тел: ${safe(s.phone)}` : "",
    },
    buyer: {
      name: b ? safe(b.name || b.full_name) : "—",
      addressLine: b?.address ? `Адрес: ${safe(b.address)}` : "",
      phoneLine: b?.phone ? `Тел: ${safe(b.phone)}` : "",
    },
  };
}

export function resolveDocumentDiscount(doc, data, subtotal, rawItems) {
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

  const showDocumentDiscountLine =
    documentDiscountAmount > 0 || documentDiscountPercent > 0;

  return {
    documentDiscountPercent,
    documentDiscountAmount,
    showDocumentDiscountLine,
  };
}

export function goodsRowKey(it, idx, invoiceNumber) {
  if (it.id != null && it.id !== "") {
    return `id-${String(it.id)}`;
  }
  const name = String(it.name ?? "").slice(0, 48);
  const art = String(it.article ?? "");
  return `row-${invoiceNumber || "n"}-${idx}-${name}-${art}`;
}

/** Строки товаров для PDF/Excel — единая логика с InvoicePdfDocument. */
export function buildInvoiceItemsFromData(data) {
  const doc = data?.document || {};
  const docDiscountPctForLines = Number(doc.discount_percent ?? 0);

  return (Array.isArray(data?.items) ? data.items : []).map((it) => {
    const qty = Number(it.qty || it.quantity || 0);
    const unitBase = Number(it.price ?? it.unit_price ?? 0);
    const lineDisc = Number(it.discount_percent ?? it.discount ?? 0);
    const discount =
      it.effective_discount_percent != null &&
      it.effective_discount_percent !== ""
        ? Number(it.effective_discount_percent)
        : lineDisc > 0
          ? lineDisc
          : docDiscountPctForLines;

    let priceNoDiscount = Number(
      it.original_price ??
        it.price_before_discount ??
        it.price_without_discount ??
        unitBase,
    );
    if (!priceNoDiscount) {
      priceNoDiscount = unitBase;
    }

    const priceAfterDiscount =
      priceNoDiscount * (1 - Number(discount || 0) / 100);
    const rowTotal = qty * priceAfterDiscount;

    return {
      id: it.id,
      name: it.name || it.product_name || "Товар",
      qty,
      unit_price: priceAfterDiscount,
      price_no_discount: priceNoDiscount,
      discount,
      total: rowTotal,
      unit: it.unit || "шт",
      article: it.article || "",
    };
  });
}
