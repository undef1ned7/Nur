/**
 * Константы для страницы добавления товара
 */

// Типы товаров
export const ITEM_TYPES = {
  PRODUCT: "product",
  SERVICE: "service",
  KIT: "kit",
};

// Типы товаров для старого формата
export const PRODUCT_TYPES = {
  PIECE: "piece",
  WEIGHT: "weight",
};

// Вкладки формы
export const TABS = {
  MANUAL: 0,
  SCAN: 1,
};

// Единицы измерения по умолчанию
export const DEFAULT_UNIT = "шт";

// Значения по умолчанию для полей
export const DEFAULT_VALUES = {
  UNIT: "шт",
  MARKUP: "0",
  DISCOUNT: "0",
  MIN_STOCK: "0",
  HEIGHT: "0",
  WIDTH: "0",
  DEPTH: "0",
  WEIGHT: "0",
  PLU: "0001",
};

// Опции статусов долга
export const DEBT_TYPES = {
  PREPAYMENT: "Предоплата",
  DEBT: "Долги",
};

// Операции с кассой
export const CASH_OPERATIONS = {
  SOURCE_BUSINESS_OPERATION_ID: "Склад",
  TYPE_EXPENSE: "expense",
};

// Значения по умолчанию для новых товаров
export const DEFAULT_NEW_ITEM_DATA = {
  name: "",
  barcode: "",
  brand_name: "",
  category_name: "",
  price: "",
  quantity: "",
  client: "",
  purchase_price: "",
  plu: "",
  scale_type: "",
};

// Значения по умолчанию для данных маркета
export const DEFAULT_MARKET_DATA = {
  code: "",
  article: "",
  unit: DEFAULT_VALUES.UNIT,
  isWeightProduct: false,
  isFractionalService: false,
  plu: "",
  height: DEFAULT_VALUES.HEIGHT,
  width: DEFAULT_VALUES.WIDTH,
  depth: DEFAULT_VALUES.DEPTH,
  weight: DEFAULT_VALUES.WEIGHT,
  description: "",
  country: "",
  purchasePrice: "",
  markup: DEFAULT_VALUES.MARKUP,
  discount: DEFAULT_VALUES.DISCOUNT,
  supplier: "",
  minStock: DEFAULT_VALUES.MIN_STOCK,
  expiryDate: "",
  kitProducts: [],
  kitSearchTerm: "",
  packagings: [],
};

// Задержка навигации после успешного сохранения (мс)
export const NAVIGATION_DELAY = 1500;

// Лимит загрузки товаров для оптимизации
export const PRODUCT_FETCH_LIMIT = 100;

