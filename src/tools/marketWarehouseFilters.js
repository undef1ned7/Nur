/**
 * Параметры GET /main/products/list/ для склада маркета (/crm/sklad).
 * UI — на русском, в query уходят стабильные английские коды.
 */

export const MARKET_WAREHOUSE_KIND = {
  product: "product",
  service: "service",
  bundle: "bundle",
};

export const MARKET_WAREHOUSE_PRESETS = [
  { value: "discounted", label: "Товары со скидкой" },
  { value: "shelf_life_expires_7d", label: "Срок годности истекает в течение 7 дней" },
  { value: "zero_cost", label: "Нулевая себестоимость" },
  { value: "shelf_life_expired", label: "Истёк срок годности" },
  { value: "out_of_stock", label: "Нет в наличии" },
  { value: "not_sold_90d", label: "Не продаются 3 месяца" },
  { value: "negative_stock", label: "Отрицательный остаток" },
  { value: "stock_below_min", label: "Общий остаток меньше минимального" },
];

/** @deprecated старые value на кириллице — для восстановления сохранённых фильтров */
const LEGACY_PRESET_MAP = {
  товары_со_скидкой: "discounted",
  срок_годности_истекает_7_дней: "shelf_life_expires_7d",
  нулевая_себестоимость: "zero_cost",
  истек_срок_годности: "shelf_life_expired",
  нет_в_наличии: "out_of_stock",
  не_продаются_3_месяца: "not_sold_90d",
  отрицательный_остаток: "negative_stock",
  общий_остаток_меньше_минимального: "stock_below_min",
};

const PRICE_TYPE_TO_API = {
  базовая: "base",
  "цена закупки": "purchase",
  себестоимость: "cost",
  скидка: "discount",
};

const PRICE_TYPE_FROM_API = Object.fromEntries(
  Object.entries(PRICE_TYPE_TO_API).map(([ru, en]) => [en, ru]),
);

const CONDITION_TO_API = {
  больше: "gt",
  меньше: "lt",
  равно: "eq",
};

const CONDITION_FROM_API = Object.fromEntries(
  Object.entries(CONDITION_TO_API).map(([ru, en]) => [en, ru]),
);

const SHELF_LIFE_CONDITION_TO_API = {
  "истекает в течение": "expires_within",
  истек: "expired",
};

const SHELF_LIFE_CONDITION_FROM_API = Object.fromEntries(
  Object.entries(SHELF_LIFE_CONDITION_TO_API).map(([ru, en]) => [en, ru]),
);

const SELLABILITY_CONDITION_TO_API = {
  "продавался в течение": "sold_within",
  "не продавался в течение": "not_sold_within",
};

const SELLABILITY_CONDITION_FROM_API = Object.fromEntries(
  Object.entries(SELLABILITY_CONDITION_TO_API).map(([ru, en]) => [en, ru]),
);

const STOCK_TYPE_TO_API = {
  общие: "total",
};

const STOCK_TYPE_FROM_API = { total: "общие" };

const mapToApi = (value, map) => {
  if (!value) return "";
  const key = String(value).trim();
  return map[key] || key;
};

const mapFromApi = (value, map, fallback) => {
  if (!value) return fallback;
  const key = String(value).trim();
  return map[key] || key;
};

export const normalizePresetValue = (preset) => {
  if (!preset) return "";
  const key = String(preset).trim();
  return LEGACY_PRESET_MAP[key] || key;
};

/** Чекбоксы модалки из query-параметра kind */
export const itemTypesFromKindParam = (kind) => {
  const allSelected = {
    product: true,
    service: true,
    kit: true,
  };
  if (!kind) return allSelected;

  const tokens = String(kind)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!tokens.length) return allSelected;

  return {
    product: tokens.includes("product"),
    service: tokens.includes("service"),
    kit: tokens.includes("bundle") || tokens.includes("kit"),
  };
};

/** kind для API из чекбоксов */
export const kindParamFromItemTypes = (itemTypes) => {
  const kinds = [];
  if (itemTypes?.product) kinds.push(MARKET_WAREHOUSE_KIND.product);
  if (itemTypes?.service) kinds.push(MARKET_WAREHOUSE_KIND.service);
  if (itemTypes?.kit) kinds.push(MARKET_WAREHOUSE_KIND.bundle);
  return kinds;
};

/**
 * Собирает query-параметры для GET /main/products/list/
 * @param {object} modalState — состояние формы FilterModal
 * @returns {{ params: object, error?: string }}
 */
export const buildMarketWarehouseListParams = (modalState) => {
  const params = {};
  const kinds = kindParamFromItemTypes(modalState?.itemTypes);

  if (kinds.length === 0) {
    return { params: {}, error: "Выберите хотя бы один тип товара" };
  }

  if (kinds.length < 3) {
    params.kind = kinds;
  }

  const preset = normalizePresetValue(modalState?.preset);
  if (preset) params.preset = preset;

  if (modalState?.category) params.category = modalState.category;
  if (modalState?.brand) params.brand = modalState.brand;
  if (modalState?.supplier) params.supplier = modalState.supplier;

  const priceValue = String(modalState?.price?.value ?? "0").trim();
  if (priceValue && priceValue !== "0") {
    params.price_type = mapToApi(modalState.price.type, PRICE_TYPE_TO_API);
    params.price_condition = mapToApi(
      modalState.price.condition,
      CONDITION_TO_API,
    );
    params.price_value = priceValue;
  }

  const stockValue = String(modalState?.stock?.value ?? "0").trim();
  if (stockValue && stockValue !== "0") {
    params.stock_type = mapToApi(modalState.stock.type, STOCK_TYPE_TO_API);
    params.stock_condition = mapToApi(
      modalState.stock.condition,
      CONDITION_TO_API,
    );
    params.stock_value = stockValue;
  }

  const shelfValue = String(modalState?.shelfLife?.value ?? "0").trim();
  if (shelfValue && shelfValue !== "0") {
    params.shelf_life_condition = mapToApi(
      modalState.shelfLife.condition,
      SHELF_LIFE_CONDITION_TO_API,
    );
    params.shelf_life_value = shelfValue;
  }

  const changesValue = String(modalState?.productChanges?.value ?? "0").trim();
  if (changesValue && changesValue !== "0") {
    params.changes_condition = mapToApi(
      modalState.productChanges.condition,
      CONDITION_TO_API,
    );
    params.changes_value = changesValue;
  }

  const sellValue = String(modalState?.sellability?.value ?? "0").trim();
  if (sellValue && sellValue !== "0") {
    params.sellability_condition = mapToApi(
      modalState.sellability.condition,
      SELLABILITY_CONDITION_TO_API,
    );
    params.sellability_value = sellValue;
  }

  return { params };
};

/** Восстановление UI-модалки из применённых query-параметров */
export const modalStateFromAppliedFilters = (applied = {}) => {
  const kindRaw = applied.kind;
  const kindStr = Array.isArray(kindRaw)
    ? kindRaw.join(",")
    : String(kindRaw || "");

  return {
    itemTypes: itemTypesFromKindParam(kindStr),
    preset: normalizePresetValue(applied.preset),
    category: applied.category || "",
    brand: applied.brand || "",
    supplier: applied.supplier || "",
    price: {
      type: mapFromApi(
        applied.price_type,
        PRICE_TYPE_FROM_API,
        "базовая",
      ),
      condition: mapFromApi(
        applied.price_condition,
        CONDITION_FROM_API,
        "больше",
      ),
      value: applied.price_value || "0",
    },
    stock: {
      type: mapFromApi(applied.stock_type, STOCK_TYPE_FROM_API, "общие"),
      condition: mapFromApi(
        applied.stock_condition,
        CONDITION_FROM_API,
        "больше",
      ),
      value: applied.stock_value || "0",
    },
    shelfLife: {
      condition: mapFromApi(
        applied.shelf_life_condition,
        SHELF_LIFE_CONDITION_FROM_API,
        "истекает в течение",
      ),
      value: applied.shelf_life_value || "0",
    },
    productChanges: {
      condition: mapFromApi(
        applied.changes_condition,
        CONDITION_FROM_API,
        "изменялся в течение",
      ),
      value: applied.changes_value || "0",
    },
    sellability: {
      condition: mapFromApi(
        applied.sellability_condition,
        SELLABILITY_CONDITION_FROM_API,
        "продавался в течение",
      ),
      value: applied.sellability_value || "0",
    },
  };
};
