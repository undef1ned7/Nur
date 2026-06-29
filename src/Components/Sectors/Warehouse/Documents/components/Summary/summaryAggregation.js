// Клиентская агрегация данных сводки.
// Главный источник данных — готовые products/documents/totals из бэкенда
// (см. docs/warehouse-summary-api.md). Эти функции:
//  1) нормализуют объект сводки к единому виду для PDF/просмотра;
//  2) служат fallback-агрегацией, если приходят «сырые» накладные.

const toNum = (v) => {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const pickName = (item) =>
  item?.product?.name ||
  item?.product_name ||
  item?.name ||
  item?.title ||
  "Без наименования";

const pickUnit = (item) =>
  (item?.product?.unit || item?.unit || "шт").toString().toLowerCase();

const pickQty = (item) => toNum(item?.quantity ?? item?.qty ?? item?.count);

const pickPrice = (item) =>
  toNum(item?.unit_price ?? item?.price ?? item?.product?.price);

const pickWeight = (item) => {
  const explicit = toNum(item?.weight ?? item?.total_weight);
  if (explicit) return explicit;
  const unitWeight = toNum(item?.product?.weight ?? item?.unit_weight);
  return unitWeight ? unitWeight * pickQty(item) : 0;
};

const pickPerPackage = (item) =>
  toNum(item?.per_package ?? item?.package_size ?? item?.product?.package_size);

const clientName = (doc) =>
  doc?.counterparty?.name ||
  doc?.counterparty_display_name ||
  (typeof doc?.counterparty === "string" ? doc.counterparty : "") ||
  doc?.client ||
  "—";

const agentName = (doc) =>
  doc?.agent_display?.trim?.() ||
  doc?.agent_name ||
  (doc?.agent ? String(doc.agent) : "—");

const docAddress = (doc) =>
  doc?.address ||
  doc?.delivery_address ||
  doc?.counterparty?.address ||
  doc?.shipping_address ||
  "—";

const docAmount = (doc) => {
  const t = toNum(doc?.amount ?? doc?.total);
  if (t) return t;
  const items = doc?.items || [];
  return items.reduce((s, it) => s + pickQty(it) * pickPrice(it), 0);
};

const docQuantity = (doc) => {
  const explicit = toNum(doc?.quantity);
  if (explicit) return explicit;
  return (doc?.items || []).reduce((s, it) => s + pickQty(it), 0);
};

const docWeight = (doc) => {
  const explicit = toNum(doc?.weight);
  if (explicit) return explicit;
  return (doc?.items || []).reduce((s, it) => s + pickWeight(it), 0);
};

/** Агрегирует товары из массива накладных в строки таблицы №1. */
export const aggregateProducts = (documents = []) => {
  const map = new Map();
  documents.forEach((doc) => {
    (doc?.items || []).forEach((item) => {
      const name = pickName(item);
      const unit = pickUnit(item);
      const price = pickPrice(item);
      const key = `${name}__${unit}__${price}`;
      const qty = pickQty(item);
      const weight = pickWeight(item);
      const perPackage = pickPerPackage(item);
      const existing = map.get(key);
      if (existing) {
        existing.quantity += qty;
        existing.weight += weight;
        existing.amount += qty * price;
      } else {
        map.set(key, {
          name,
          unit,
          per_package: perPackage,
          packages: 0, // вычислим ниже
          quantity: qty,
          price,
          amount: qty * price,
          weight,
        });
      }
    });
  });
  const rows = Array.from(map.values()).map((r) => ({
    ...r,
    packages: r.per_package > 0 ? Math.floor(r.quantity / r.per_package) : 0,
  }));
  rows.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  return rows;
};

/**
 * Нормализует позиции (товары) одной накладной к единому виду для PDF/просмотра.
 * Принимает как «сырые» items накладной, так и уже готовые позиции из снапшота бэкенда.
 * Идемпотентна: повторный прогон не меняет результат.
 */
export const mapDocumentItems = (items = []) =>
  (Array.isArray(items) ? items : []).map((it) => {
    const quantity = pickQty(it);
    const price = pickPrice(it);
    const amount =
      toNum(it?.amount ?? it?.total ?? it?.line_total) || quantity * price;
    const discountPercent = toNum(
      it?.discount_percent ?? it?.effective_discount_percent ?? it?.discount,
    );
    const discountAmount = toNum(it?.discount_amount);
    return {
      name: pickName(it),
      unit: pickUnit(it),
      quantity,
      price,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      amount,
      weight: pickWeight(it),
    };
  });

/** Приводит накладные к строкам таблицы №2 (с детализацией позиций в `items`). */
export const mapDocuments = (documents = []) =>
  documents.map((doc) => ({
    id: doc.id,
    number: doc.number || "—",
    date: doc.date || doc.created_at || "",
    agent: agentName(doc),
    client: clientName(doc),
    address: docAddress(doc),
    quantity: docQuantity(doc),
    weight: docWeight(doc),
    amount: docAmount(doc),
    items: mapDocumentItems(doc.items),
  }));

/** Считает итоги из products и documents. */
export const computeTotals = (products = [], documents = []) => ({
  documents_count: documents.length,
  products_count: products.length,
  total_quantity: products.reduce((s, p) => s + toNum(p.quantity), 0),
  total_weight: products.reduce((s, p) => s + toNum(p.weight), 0),
  total_amount: products.reduce((s, p) => s + toNum(p.amount), 0),
});

/**
 * Нормализует сводку к виду, готовому для PDF/просмотра.
 * Если бэкенд уже отдал products/documents/totals — используем их;
 * иначе агрегируем из rawDocuments (накладные).
 */
export const normalizeSummary = (summary = {}, rawDocuments = null) => {
  const hasReadyProducts =
    Array.isArray(summary.products) && summary.products.length > 0;
  const hasReadyDocs =
    Array.isArray(summary.documents) && summary.documents.length > 0;

  let documents = hasReadyDocs ? summary.documents : null;
  let products = hasReadyProducts ? summary.products : null;

  if ((!documents || !products) && Array.isArray(rawDocuments)) {
    if (!documents) documents = mapDocuments(rawDocuments);
    if (!products) products = aggregateProducts(rawDocuments);
  }

  // Детализация позиций по каждой накладной (documents[].items): бэкенд может
  // прислать их в снапшоте — нормализуем к единому виду; при их отсутствии получится [].
  documents = (documents || []).map((d) => ({
    ...d,
    items: mapDocumentItems(d?.items),
  }));
  products = products || [];

  const totals =
    summary.totals && typeof summary.totals === "object"
      ? summary.totals
      : computeTotals(products, documents);

  return { ...summary, documents, products, totals };
};

export { toNum };
