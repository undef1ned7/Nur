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

// Высота A4 в pt минус вертикальные отступы страницы накладной (14 + 14)
// и линия отреза между экземплярами (~24). Половина — бюджет одного экземпляра,
// когда два печатаются на одной странице.
export const INVOICE_HALF_PAGE_HEIGHT = Math.floor((841.89 - 28 - 24) / 2);

/**
 * Грубая оценка высоты содержимого накладной (в pt) по структуре
 * InvoicePdfPageContent. Используется, чтобы решить, помещаются ли два
 * экземпляра на одну страницу A4. Оценка намеренно консервативная:
 * при сомнении лучше напечатать два отдельных листа, чем получить разрыв
 * экземпляра между страницами.
 */
export function estimateInvoiceContentHeight(data) {
  const doc = data?.document || {};
  const docType = data?.doc_type || doc.doc_type || doc.type || "SALE";
  const isInventory = docType === "INVENTORY";
  const isTransfer = docType === "TRANSFER";
  const showPriceColumns = needsPriceColumns(docType);
  const items = buildInvoiceItemsFromData(data);

  const LINE = 13; // строка текста 8–9pt с межстрочным интервалом

  let h = 25; // заголовок 12pt + marginBottom 10

  // Блоки сторон (поставщик/покупатель или организация)
  if (isTransfer || isInventory) {
    h += 8 + LINE * (1 + (data?.seller?.address ? 1 : 0));
  } else if (usesPartyBlocks(docType)) {
    const { supplier, buyer } = resolvePartiesForDocType(
      docType,
      data?.seller || {},
      data?.buyer,
    );
    const blocks = ["RECEIPT", "WRITE_OFF"].includes(docType)
      ? [supplier]
      : [supplier, buyer];
    for (const p of blocks) {
      if (!p?.name || p.name === "—") continue;
      h += 8 + LINE * (1 + (p.addressLine ? 1 : 0) + (p.phoneLine ? 1 : 0));
    }
  }

  // Мета-строки: склады и комментарий
  if (isTransfer) {
    h += 6 + LINE * ((data?.warehouse ? 1 : 0) + (data?.warehouse_to ? 1 : 0));
  } else if (!isInventory && data?.warehouse) {
    h += LINE + 6;
  }
  const comment = String(doc.comment ?? data?.comment ?? "").trim();
  if (comment) h += LINE + 6;

  // Таблица товаров: шапка + строки (название может переноситься) + «Итого»
  const nameCharsPerLine = showPriceColumns ? 26 : 60;
  h += 6 + 14;
  for (const it of items) {
    const lines = Math.max(
      1,
      Math.ceil(String(it.name || "").length / nameCharsPerLine),
    );
    h += Math.max(14, 6 + lines * 10);
  }
  if (showPriceColumns) h += 14;

  // Итоги: «ИТОГО» (+скидка документа) и сумма прописью (до двух строк)
  if (showPriceColumns) {
    const subtotal = items.reduce((sum, it) => sum + Number(it.total || 0), 0);
    const { showDocumentDiscountLine } = resolveDocumentDiscount(
      doc,
      data,
      subtotal,
      data?.items,
    );
    h += 6 + 14 + (showDocumentDiscountLine ? LINE : 0);
    h += 8 + LINE + 2 * LINE;
  }

  // Подписи / примечание инвентаризации
  h += isInventory ? 8 + 2 * LINE : 16 + 10 + 4 + 14;

  return h;
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
