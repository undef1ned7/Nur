/** Весовая продажа блюд в кафе (контракт: docs/cafe_weighted_menu_frontend.md). */

export const MIN_WEIGHT_QTY_KG = 0.001;
export const MIN_WEIGHT_QTY_G = 1;
export const MIN_PIECE_QTY = 1;
export const WEIGHT_QTY_DECIMALS = 3;

export const DECIMAL_INPUT_PATTERN = /^\d*[,.]?\d*$/;

/** Минимальное количество для весовой строки по единице продажи. */
export const minWeightQty = (saleUnit) =>
  saleUnit === "g" ? MIN_WEIGHT_QTY_G : MIN_WEIGHT_QTY_KG;

export const normalizeMenuWeightFields = (item) => ({
  is_sold_by_weight: Boolean(item?.is_sold_by_weight),
  sale_unit: item?.sale_unit === "g" ? "g" : "kg",
});

export const saleUnitLabel = (unit) => (unit === "g" ? "г" : "кг");

export const menuPriceFieldLabel = (form) =>
  form?.is_sold_by_weight
    ? `Цена за 1 ${saleUnitLabel(form?.sale_unit)}, сом`
    : "Цена, сом";

export const formatMenuPriceHint = (price, menu) => {
  const p = Number(String(price ?? "").replace(",", "."));
  const money = Number.isFinite(p) ? p : 0;
  const w = normalizeMenuWeightFields(menu);
  if (!w.is_sold_by_weight) return `${money} сом`;
  return `${money} сом/${saleUnitLabel(w.sale_unit)}`;
};

export const isIncompleteDecimalInput = (rawValue) => {
  const v = String(rawValue ?? "").trim();
  return v === "" || v.endsWith(".") || v.endsWith(",");
};

export const roundWeightQty = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  const f = 10 ** WEIGHT_QTY_DECIMALS;
  return Math.round(x * f) / f;
};

export const weightQtyStep = (unit) => (unit === "g" ? 50 : 0.1);

export const defaultWeightQty = (unit) => (unit === "g" ? "100" : "1");

export const parseWeightQtyInput = (
  raw,
  max = Number.MAX_SAFE_INTEGER,
  saleUnit = "kg",
) => {
  const cleaned = String(raw ?? "")
    .replace(",", ".")
    .trim();
  if (cleaned === "") return "";
  if (!DECIMAL_INPUT_PATTERN.test(cleaned)) return null;
  if (isIncompleteDecimalInput(cleaned)) return cleaned;
  const n = roundWeightQty(Number(cleaned));
  const min = minWeightQty(saleUnit);
  if (!Number.isFinite(n) || n < min) return "";
  if (n > max) return String(roundWeightQty(max)).replace(",", ".");
  return String(n).replace(",", ".");
};

export const parsePieceQtyInput = (raw, max = Number.MAX_SAFE_INTEGER) => {
  const s = String(raw ?? "").replace(/\D/g, "");
  if (s === "") return "";
  let n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n > max) n = max;
  return n;
};

export const lineQtyInputValue = (q) => (q === "" ? "" : String(q));

export const lineQtyNum = (q, isWeight, saleUnit = "kg") => {
  if (q === "" || q === null || q === undefined) return 0;
  const n = Number(String(q).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (isWeight) {
    const r = roundWeightQty(n);
    return r >= minWeightQty(saleUnit) ? r : 0;
  }
  const i = Math.floor(n);
  return i >= MIN_PIECE_QTY ? i : 0;
};

export const formatLineQtyDisplay = (q, saleUnit, isWeight) => {
  const n = lineQtyNum(q, isWeight, saleUnit);
  if (!n) return "—";
  if (!isWeight) return String(n);
  return `${String(n).replace(",", ".")} ${saleUnitLabel(saleUnit)}`;
};

export const resolveLineWeightMeta = (line, menuMap) => {
  if (String(line?.line_kind || "menu").toLowerCase() === "service") {
    return { is_sold_by_weight: false, sale_unit: "kg" };
  }
  if (line?.is_sold_by_weight != null) {
    return normalizeMenuWeightFields(line);
  }
  if (line?.menu_item_is_sold_by_weight != null) {
    return {
      is_sold_by_weight: Boolean(line.menu_item_is_sold_by_weight),
      sale_unit: line.menu_item_sale_unit === "g" ? "g" : "kg",
    };
  }
  const mi = menuMap?.get?.(String(line?.menu_item ?? ""));
  return mi
    ? normalizeMenuWeightFields(mi)
    : { is_sold_by_weight: false, sale_unit: "kg" };
};

export const isLineWeight = (line, menuMap) =>
  resolveLineWeightMeta(line, menuMap).is_sold_by_weight;

export const serializeOrderQuantity = (
  quantity,
  isWeight,
  saleUnit = "kg",
  maxQty = Number.MAX_SAFE_INTEGER,
) => {
  const raw = Number(String(quantity ?? "").replace(",", "."));
  if (!Number.isFinite(raw)) {
    return isWeight ? minWeightQty(saleUnit) : MIN_PIECE_QTY;
  }
  if (isWeight) {
    const min = minWeightQty(saleUnit);
    return Math.min(maxQty, Math.max(min, roundWeightQty(raw)));
  }
  return Math.max(
    MIN_PIECE_QTY,
    Math.min(maxQty, Math.floor(raw) || MIN_PIECE_QTY),
  );
};

export const isValidOrderQuantity = (quantity, isWeight, saleUnit = "kg") =>
  lineQtyNum(quantity, isWeight, saleUnit) > 0;

export const weightQtyValidationHint = (saleUnit) =>
  saleUnit === "g"
    ? "для весовых в граммах — не меньше 1 г"
    : "для весовых в кг — не меньше 0.001";

export const parseReturnQtyInput = (raw, maxRefund, isWeight, saleUnit = "kg") => {
  if (isWeight) {
    const cleaned = String(raw ?? "")
      .replace(",", ".")
      .trim();
    if (cleaned === "") return "";
    if (!DECIMAL_INPUT_PATTERN.test(cleaned)) return null;
    if (isIncompleteDecimalInput(cleaned)) return cleaned;
    const n = roundWeightQty(Number(cleaned));
    const min = minWeightQty(saleUnit);
    if (!Number.isFinite(n) || n < min) return "";
    const max = Math.max(min, roundWeightQty(Number(maxRefund) || 0));
    if (n > max) return String(max).replace(",", ".");
    return String(n).replace(",", ".");
  }
  const s = String(raw ?? "").replace(/\D/g, "");
  if (s === "") return "";
  let n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1) return "";
  const max = Math.max(1, Math.floor(Number(maxRefund) || 1));
  if (n > max) n = max;
  return n;
};

export const returnQtyNum = (q, isWeight, saleUnit = "kg") =>
  lineQtyNum(q, isWeight, saleUnit);

const pickFirstQty = (...vals) => {
  for (const v of vals) {
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
};

/** Вес/единица с kitchen task или сгруппированной карточки (§6 API). */
export const resolveKitchenTaskWeightMeta = (task) => {
  if (task?.menu_item_is_sold_by_weight != null) {
    return {
      is_sold_by_weight: Boolean(task.menu_item_is_sold_by_weight),
      sale_unit: task.menu_item_sale_unit === "g" ? "g" : "kg",
    };
  }
  if (task?.is_sold_by_weight != null) {
    return normalizeMenuWeightFields(task);
  }
  const nested = task?.menu_item;
  if (nested && typeof nested === "object") {
    return normalizeMenuWeightFields(nested);
  }
  return { is_sold_by_weight: false, sale_unit: "kg" };
};

/** Числовой объём задачи кухни (вес или число порций). */
export const kitchenTaskQtyNum = (task) => {
  const meta = resolveKitchenTaskWeightMeta(task);
  const raw = pickFirstQty(
    task?.quantity,
    task?.qty,
    task?.count,
    task?.portions,
    task?.amount,
  );

  if (raw !== null) {
    const n = lineQtyNum(raw, meta.is_sold_by_weight, meta.sale_unit);
    if (n > 0) return n;
  }

  if (!meta.is_sold_by_weight) {
    const tasksLen = Array.isArray(task?.tasks) ? task.tasks.length : 0;
    if (tasksLen > 0) return tasksLen;
    return MIN_PIECE_QTY;
  }

  return 0;
};

/** Подпись количества для Cook: «1.5 кг» или «2». */
export const formatKitchenTaskQty = (taskOrGroup) => {
  const meta = resolveKitchenTaskWeightMeta(taskOrGroup);
  const qty = kitchenTaskQtyNum(taskOrGroup);
  if (meta.is_sold_by_weight) {
    return formatLineQtyDisplay(qty, meta.sale_unit, true);
  }
  return String(qty || MIN_PIECE_QTY);
};
