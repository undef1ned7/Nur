// Преобразование warehouse-документа (GET /warehouse/documents/{id}/)
// в формат данных для InvoicePdfDocument. Общая логика для
// InvoicePreviewModal и накладных внутри PDF сводки — формат «точь-в-точь».

/**
 * @param {Object} doc — документ склада (с items)
 * @param {Object} company — компания из профиля (продавец)
 * @returns {Object|null} data для InvoicePdfDocument
 */
export const transformWarehouseDocumentToInvoiceData = (doc, company) => {
  if (!doc) return null;

  // Получаем данные компании
  const seller = {
    id: company?.id || "",
    name: company?.name || "",
    inn: company?.inn || "",
    okpo: company?.okpo || "",
    score: company?.score || "",
    bik: company?.bik || "",
    address: company?.address || "",
    phone: company?.phone || null,
    email: company?.email || null,
  };

  // Получаем данные контрагента
  const buyer =
    doc.counterparty && typeof doc.counterparty === "object"
      ? {
          id: doc.counterparty.id,
          name: doc.counterparty.name || "",
          inn: doc.counterparty.inn || "",
          okpo: doc.counterparty.okpo || "",
          score: doc.counterparty.score || "",
          bik: doc.counterparty.bik || "",
          address: doc.counterparty.address || "",
          phone: doc.counterparty.phone || null,
          email: doc.counterparty.email || null,
        }
      : doc.counterparty_display_name
        ? {
            id: String(doc.counterparty || ""),
            name: doc.counterparty_display_name || "",
            inn: "",
            okpo: "",
            score: "",
            bik: "",
            address: "",
            phone: null,
            email: null,
          }
        : null;

  const docDiscountPercent = Number(doc.discount_percent || 0);
  const docDiscountAmount = Number(doc.discount_amount || 0);

  // Преобразуем товары (та же логика, что при скачивании из Documents.jsx)
  const items = Array.isArray(doc.items)
    ? doc.items.map((item) => {
        const basePrice = Number(item.price ?? item.unit_price ?? 0);
        const qty = Number(item.qty || item.quantity || 0);
        const lineDiscPct = Number(item.discount_percent ?? item.discount ?? 0);
        const effectiveDisc =
          item.effective_discount_percent != null &&
          item.effective_discount_percent !== ""
            ? Number(item.effective_discount_percent)
            : lineDiscPct > 0
              ? lineDiscPct
              : docDiscountPercent;
        const lineTotal =
          Number(item.line_total ?? item.total) ||
          basePrice * qty * (1 - effectiveDisc / 100);
        return {
          id: item.id,
          product_image_url: item.product_image_url || "",
          image_url: item.product_image_url || item.image_url || "",
          imageDataUrl: item.product_image_url || item.image_url || "",
          name:
            item.product_name ??
            item.product?.name ??
            item.name ??
            item.product?.title ??
            "Товар",
          qty: String(qty),
          price: String(basePrice.toFixed(2)),
          unit_price: String(basePrice.toFixed(2)),
          total: String(lineTotal.toFixed(2)),
          unit: item.product?.unit ?? item.unit ?? "ШТ",
          article:
            String(
              item.product?.article ??
                item.article ??
                item.product_article ??
                "",
            ).trim() || "",
          discount_percent: lineDiscPct,
          discount_amount: Number(item.discount_amount || 0),
          price_before_discount: String(basePrice.toFixed(2)),
          original_price: String(basePrice.toFixed(2)),
          effective_discount_percent: effectiveDisc,
          description:
            item.product?.characteristics?.description ??
            item.product?.description ??
            item.description ??
            item.product_description ??
            "",
          product_description:
            item.product?.characteristics?.description ??
            item.product?.description ??
            item.description ??
            item.product_description ??
            "",
          product_characteristics:
            item.product_characteristics ??
            item.product?.product_characteristics ??
            item.product?.characteristics ??
            item.characteristics ??
            null,
          characteristics:
            item.product_characteristics ??
            item.product?.characteristics ??
            item.characteristics ??
            null,
        };
      })
    : [];

  // Вычисляем итоги
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.unit_price) * Number(item.qty),
    0,
  );
  const itemsDiscountTotal = items.reduce(
    (sum, item) =>
      sum +
      (Number(item.unit_price) *
        Number(item.qty) *
        Number(item.discount_percent || 0)) /
        100,
    0,
  );
  const totalDiscount = itemsDiscountTotal + docDiscountAmount;
  const total = Number(doc.total) || subtotal - totalDiscount;

  // Получаем название склада
  const warehouseName = doc.warehouse_from?.name || doc.warehouse?.name || "";
  const warehouseToName = doc.warehouse_to?.name || "";

  return {
    doc_type: doc.doc_type || "SALE",
    document: {
      type: doc.doc_type?.toLowerCase() || "sale_invoice",
      doc_type: doc.doc_type || "SALE",
      title:
        doc.doc_type === "COMMERCIAL_OFFER"
          ? "Коммерческое предложение"
          : "Накладная",
      id: doc.id,
      number: doc.number || "",
      date: doc.date || doc.created_at?.split("T")[0] || "",
      datetime: doc.created_at || doc.date || "",
      created_at: doc.created_at || "",
      discount_percent: docDiscountPercent,
      discount_amount: docDiscountAmount,
      discount_total: docDiscountAmount,
      comment: doc.comment ?? "",
    },
    seller,
    buyer,
    items,
    totals: {
      subtotal: String(subtotal.toFixed(2)),
      discount_total: String(totalDiscount.toFixed(2)),
      tax_total: "0.00",
      total: String(total.toFixed(2)),
    },
    warehouse: warehouseName,
    warehouse_to: warehouseToName,
  };
};

/**
 * Накладная из снапшота сводки (GET /warehouse/summaries/{id}/ → documents[])
 * в формат данных для InvoicePdfDocument. Снапшот уже содержит номер, дату,
 * контрагента и позиции (name, unit, quantity, price, скидки, amount) —
 * отдельный запрос за документом не нужен.
 *
 * @param {Object} sdoc — элемент summary.documents
 * @param {Object} company — компания из профиля (продавец)
 * @param {string} warehouseName — название склада сводки (для строки «Склад»)
 */
export const transformSummaryDocumentToInvoiceData = (
  sdoc,
  company,
  warehouseName = "",
) => {
  if (!sdoc) return null;

  const seller = {
    id: company?.id || "",
    name: company?.name || "",
    inn: company?.inn || "",
    okpo: company?.okpo || "",
    score: company?.score || "",
    bik: company?.bik || "",
    address: company?.address || "",
    phone: company?.phone || null,
    email: company?.email || null,
  };

  const clientName = String(sdoc.client || "").trim();
  const buyer = clientName
    ? {
        id: "",
        name: clientName,
        inn: "",
        okpo: "",
        score: "",
        bik: "",
        address: sdoc.address || "",
        phone: null,
        email: null,
      }
    : null;

  // Позиции снапшота (quantity/price/discount_percent) buildInvoiceItemsFromData
  // читает как есть — передаём без пересборки.
  const items = Array.isArray(sdoc.items) ? sdoc.items : [];

  const subtotal = items.reduce(
    (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
    0,
  );
  const total =
    Number(sdoc.amount) ||
    items.reduce((sum, it) => sum + Number(it.amount || 0), 0);
  const discountTotal = Math.max(0, subtotal - total);

  return {
    doc_type: "SALE",
    document: {
      type: "sale_invoice",
      doc_type: "SALE",
      title: "Накладная",
      id: sdoc.id,
      number: sdoc.number || "",
      date: sdoc.date || "",
      datetime: sdoc.date || "",
      created_at: sdoc.date || "",
      discount_percent: 0,
      discount_amount: 0,
      discount_total: discountTotal,
      comment: "",
    },
    seller,
    buyer,
    items,
    totals: {
      subtotal: String(subtotal.toFixed(2)),
      discount_total: String(discountTotal.toFixed(2)),
      tax_total: "0.00",
      total: String(total.toFixed(2)),
    },
    warehouse: warehouseName || "",
  };
};

export default transformWarehouseDocumentToInvoiceData;
