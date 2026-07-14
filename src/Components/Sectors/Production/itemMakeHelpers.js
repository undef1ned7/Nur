/** Утилиты ItemMake — Decimal-строки и формулы обработки (см. item_make_processing API). */

export const parseItemsMakeResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

export const toDecimal2 = (value) => {
  const num = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
};

export const toDecimal3 = (value) => {
  const num = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(num)) return "0.000";
  return (Math.round(num * 1000) / 1000).toFixed(3);
};

export const isRawItem = (item) => {
  if (!item) return false;
  if (item.kind === "processed" || item.is_processed) return false;
  return item.kind === "raw" || item.kind == null;
};

/** Сырьё, которое нужно пропустить через /process/ перед рецептом */
export const needsProcessingItem = (item) => Boolean(item?.needs_processing);

export const canProcessItem = (item) =>
  isRawItem(item) &&
  needsProcessingItem(item) &&
  Number(item?.quantity || 0) > 0;

/** Допустимо в рецепте: processed + raw с needs_processing=false */
export const isRecipeReadyItem = (item) => {
  if (!item) return false;
  if (item.kind === "processed" || item.is_processed) return true;
  return isRawItem(item) && !needsProcessingItem(item);
};

export const getKindLabel = (item) => {
  if (item?.kind_display) return item.kind_display;
  if (item?.kind === "processed" || item?.is_processed) return "Обработанное";
  return "Сырьё";
};

export const getProcessingStatusLabel = (item) => {
  if (!item || item.kind === "processed" || item.is_processed) return null;
  if (needsProcessingItem(item)) return "Нужна обработка";
  return "В рецепте";
};

/** Потери: input - output */
export const calcProcessingLoss = (inputQty, outputQty) => {
  const input = Number(inputQty) || 0;
  const output = Number(outputQty) || 0;
  const loss = Math.max(0, input - output);
  const pct = input > 0 ? (loss / input) * 100 : 0;
  return { loss, pct };
};

/** Новая партия: (input × source.price + cost) / output */
export const calcProcessedPricePreview = ({
  inputQty,
  outputQty,
  sourcePrice,
  processingCost = 0,
}) => {
  const input = Number(inputQty) || 0;
  const output = Number(outputQty) || 0;
  const price = Number(sourcePrice) || 0;
  const cost = Number(processingCost) || 0;
  if (output <= 0) return 0;
  return (input * price + cost) / output;
};

/** Пополнение существующей processed-позиции */
export const calcProcessedPriceReplenish = ({
  oldQty,
  oldPrice,
  inputQty,
  outputQty,
  sourcePrice,
  processingCost = 0,
}) => {
  const oq = Number(oldQty) || 0;
  const op = Number(oldPrice) || 0;
  const input = Number(inputQty) || 0;
  const output = Number(outputQty) || 0;
  const sp = Number(sourcePrice) || 0;
  const cost = Number(processingCost) || 0;
  const denom = oq + output;
  if (denom <= 0) return calcProcessedPricePreview({ inputQty, outputQty, sourcePrice, processingCost });
  return (oq * op + input * sp + cost) / denom;
};

/** Себестоимость рецепта на 1 ед. готового товара */
export const calcRecipePurchasePrice = (recipeItems, materials, getPrice = (m) => m?.price) => {
  return (recipeItems || []).reduce((acc, row) => {
    const material = (materials || []).find(
      (m) => String(m.id) === String(row.materialId ?? row.id),
    );
    if (!material) return acc;
    const qty = Number(row.quantity ?? row.qty_per_unit ?? 0);
    const price = Number(getPrice(material) ?? 0);
    return acc + qty * price;
  }, 0);
};

/**
 * Тип оплаты для журнала закупок бэка: cash | transfer | debt | prepayment.
 * В формах фронта «полная оплата» = "full" — бэк такого значения не знает
 * и молча записал бы cash, поэтому маппим явно.
 */
export const toBackendPaymentType = (paymentType) => {
  switch (paymentType) {
    case "debt":
      return "debt";
    case "prepayment":
      return "prepayment";
    case "transfer":
      return "transfer";
    default:
      return "cash";
  }
};

export const buildItemMakeCreatePayload = (form) => {
  const payload = {
    name: String(form.name || "").trim(),
    price: toDecimal2(form.price),
    unit: String(form.unit || "").trim(),
    quantity: toDecimal3(form.quantity),
  };
  const supplier = form.supplier || form.client;
  if (supplier) payload.supplier = supplier;
  payload.needs_processing = Boolean(form.needs_processing);
  payload.payment_type = toBackendPaymentType(form.payment_type);
  return payload;
};

/** Докупка сырья: POST /main/items-make/{id}/purchase/ */
export const buildItemMakePurchasePayload = (form) => {
  const payload = {
    quantity: toDecimal3(form.quantity),
    payment_type: toBackendPaymentType(form.payment_type),
  };
  if (form.unit_price != null && form.unit_price !== "")
    payload.unit_price = toDecimal2(form.unit_price);
  const supplier = form.supplier ?? form.client;
  if (supplier) payload.supplier = supplier;
  return payload;
};

export const buildItemMakeUpdatePayload = (form) => {
  const payload = {};
  if (form.name != null) payload.name = String(form.name).trim();
  if (form.unit != null) payload.unit = String(form.unit).trim();
  if (form.price != null && form.price !== "") payload.price = toDecimal2(form.price);
  if (form.quantity != null && form.quantity !== "")
    payload.quantity = toDecimal3(form.quantity);
  const supplier = form.supplier ?? form.client;
  if (supplier) payload.supplier = supplier;
  return payload;
};

export const buildProcessPayload = ({
  input_quantity,
  output_quantity,
  name,
  processing_cost,
  target_item_make_id,
}) => ({
  input_quantity: toDecimal3(input_quantity),
  output_quantity: toDecimal3(output_quantity),
  ...(name ? { name: String(name).trim() } : {}),
  processing_cost: toDecimal2(processing_cost ?? 0),
  target_item_make_id: target_item_make_id || null,
});
