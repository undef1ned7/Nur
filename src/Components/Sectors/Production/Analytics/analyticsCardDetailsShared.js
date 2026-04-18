/**
 * Общая логика детализации карточек GET /main/analytics/cards/details/
 * (см. analytics_cards_details_api — разбивка по периоду и поля items/totals).
 */

/** Ответ: { card, branch_id, count, offset, limit, totals, items, period? } */
export const CARD_DETAILS_PAGE_SIZE = 200;

export const INITIAL_CARD_DETAILS_META = {
  count: 0,
  offset: 0,
  limit: CARD_DETAILS_PAGE_SIZE,
  branch_id: null,
  totals: {},
  period: null,
};

/**
 * Период в query (_parse_period): передачи, приёмки, продажи, скидки,
 * revenue / COGS / валовая прибыль / маржа по товарам.
 * Без периода: склад, сырьё, брак, пользователи, остатки на руках,
 * дебиторка / кредиторка / долг (снимок сальдо).
 */
export const CARD_DETAILS_USES_PERIOD = new Set([
  "transfers_count",
  "items_transferred",
  "acceptances_count",
  "sales_count",
  "sales_amount",
  "discounts_total",
  "revenue",
  "cost_of_goods_sold",
  "gross_profit",
  "gross_margin_percent",
]);

export function parseCardDetailsRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.rows)) return payload.rows;
  return [];
}

const STOCK_DETAIL_COLUMNS = [
  "id",
  "name",
  "unit",
  "kind",
  "quantity",
  "purchase_price",
  "retail_price",
  "purchase_sum",
  "retail_sum",
];

const RAW_MATERIAL_DETAIL_COLUMNS = [
  "id",
  "name",
  "unit",
  "quantity",
  "price",
  "sum",
  "supplier",
];

const DEFECTIVE_DETAIL_COLUMNS = [
  "product_id",
  "product_name",
  "qty",
  "returns_count",
];

const TRANSFERS_DETAIL_COLUMNS = [
  "id",
  "created_at",
  "status",
  "qty_transferred",
  "qty_accepted",
  "qty_returned",
  "agent",
  "product",
];

const DISCOUNTS_DETAIL_COLUMNS = ["user", "client", "sales_count", "discounts_total"];

const ACCEPTANCES_DETAIL_COLUMNS = [
  "id",
  "accepted_at",
  "qty",
  "accepted_by",
  "agent",
  "subreal",
  "product",
];

const SALES_DETAIL_COLUMNS = [
  "id",
  "created_at",
  "total",
  "discount_total",
  "user",
  "client",
];

const USERS_COUNT_DETAIL_COLUMN_ORDER = [
  "id",
  "email",
  "first_name",
  "last_name",
  "phone_number",
  "role",
  "is_active",
];

/** Остатки на руках у агента (items_on_hand_*). */
const ITEMS_ON_HAND_QTY_COLUMNS = [
  "product_id",
  "product_name",
  "name",
  "qty_on_hand",
];

const ITEMS_ON_HAND_AMOUNT_COLUMNS = [...ITEMS_ON_HAND_QTY_COLUMNS, "amount"];

/** Разбивка по товару (SaleItem оплаченных продаж за период). */
const SALE_ITEM_AGG_COLUMNS = [
  "product_id",
  "product_name",
  "revenue",
  "cost_of_goods_sold",
  "gross_profit",
  "gross_margin_percent",
];

const TOTAL_DEBT_COLUMNS = [
  "id",
  "title",
  "client",
  "amount",
  "prepayment",
  "paid",
  "remaining",
];

/** Объединённый список: client_deal + sale_debt. */
const ACCOUNTS_RECEIVABLE_COLUMNS = [
  "kind",
  "id",
  "title",
  "client",
  "amount",
  "prepayment",
  "paid",
  "remaining",
  "total",
  "created_at",
];

const ACCOUNTS_PAYABLE_COLUMNS = ["counterparty_id", "name", "accounts_payable"];

const CARD_DETAIL_COLUMN_ORDER = {
  stock_purchase_value: STOCK_DETAIL_COLUMNS,
  stock_value: STOCK_DETAIL_COLUMNS,
  stock_retail_value: STOCK_DETAIL_COLUMNS,
  raw_material_value: RAW_MATERIAL_DETAIL_COLUMNS,
  defective_items: DEFECTIVE_DETAIL_COLUMNS,
  transfers_count: TRANSFERS_DETAIL_COLUMNS,
  items_transferred: TRANSFERS_DETAIL_COLUMNS,
  acceptances_count: ACCEPTANCES_DETAIL_COLUMNS,
  sales_count: SALES_DETAIL_COLUMNS,
  sales_amount: SALES_DETAIL_COLUMNS,
  discounts_total: DISCOUNTS_DETAIL_COLUMNS,
  users_count: USERS_COUNT_DETAIL_COLUMN_ORDER,
  items_on_hand_qty: ITEMS_ON_HAND_QTY_COLUMNS,
  items_on_hand_amount: ITEMS_ON_HAND_AMOUNT_COLUMNS,
  revenue: SALE_ITEM_AGG_COLUMNS,
  cost_of_goods_sold: SALE_ITEM_AGG_COLUMNS,
  gross_profit: SALE_ITEM_AGG_COLUMNS,
  gross_margin_percent: SALE_ITEM_AGG_COLUMNS,
  total_debt: TOTAL_DEBT_COLUMNS,
  accounts_receivable: ACCOUNTS_RECEIVABLE_COLUMNS,
  accounts_payable: ACCOUNTS_PAYABLE_COLUMNS,
};

const STOCK_COLUMN_LABELS = {
  id: "ID",
  name: "Название",
  unit: "Ед.",
  kind: "Тип",
  quantity: "Количество",
  purchase_price: "Закуп",
  retail_price: "Розница",
  purchase_sum: "Сумма закуп",
  retail_sum: "Сумма розницы",
};

const RAW_MATERIAL_COLUMN_LABELS = {
  id: "ID",
  name: "Название",
  unit: "Ед.",
  quantity: "Количество",
  price: "Цена",
  sum: "Сумма",
  supplier: "Поставщик",
};

const DEFECTIVE_COLUMN_LABELS = {
  product_id: "ID товара",
  product_name: "Товар",
  qty: "Количество",
  returns_count: "Возвратов",
};

const TRANSFERS_COLUMN_LABELS = {
  id: "ID",
  created_at: "Дата",
  status: "Статус",
  qty_transferred: "Передано",
  qty_accepted: "Принято",
  qty_returned: "Возвращено",
  agent: "Агент",
  product: "Товар",
};

const DISCOUNTS_COLUMN_LABELS = {
  user: "Кто дал скидку",
  client: "Кому",
  sales_count: "Продаж",
  discounts_total: "Сумма скидок",
};

const ACCEPTANCES_COLUMN_LABELS = {
  id: "ID",
  accepted_at: "Дата приёмки",
  qty: "Количество",
  accepted_by: "Принял",
  agent: "Агент (передача)",
  subreal: "Передача",
  product: "Товар",
};

const SALES_COLUMN_LABELS = {
  id: "ID",
  created_at: "Дата",
  total: "Сумма",
  discount_total: "Скидка",
  user: "Сотрудник",
  client: "Клиент",
};

const USERS_COLUMN_LABELS = {
  id: "ID",
  email: "Email",
  first_name: "Имя",
  last_name: "Фамилия",
  phone_number: "Телефон",
  role: "Роль",
  is_active: "Активен",
};

const ITEMS_ON_HAND_LABELS = {
  product_id: "ID товара",
  product_name: "Товар",
  name: "Название",
  qty_on_hand: "На руках (шт)",
  amount: "Сумма",
};

const SALE_ITEM_AGG_LABELS = {
  product_id: "ID товара",
  product_name: "Товар",
  revenue: "Выручка",
  cost_of_goods_sold: "Себестоимость",
  gross_profit: "Валовая прибыль",
  gross_margin_percent: "Маржа %",
};

const TOTAL_DEBT_LABELS = {
  id: "ID",
  title: "Сделка",
  client: "Клиент",
  amount: "Сумма",
  prepayment: "Предоплата",
  paid: "Оплачено",
  remaining: "Остаток",
};

const ACCOUNTS_RECEIVABLE_LABELS = {
  kind: "Тип",
  id: "ID",
  title: "Название",
  client: "Клиент / контрагент",
  amount: "Сумма",
  prepayment: "Предоплата",
  paid: "Оплачено",
  remaining: "Остаток",
  total: "Итого",
  created_at: "Дата",
};

const ACCOUNTS_PAYABLE_LABELS = {
  counterparty_id: "ID контрагента",
  name: "Контрагент",
  accounts_payable: "Кредиторская",
};

export const CARD_DETAILS_COLUMN_LABELS = {
  stock_purchase_value: STOCK_COLUMN_LABELS,
  stock_value: STOCK_COLUMN_LABELS,
  stock_retail_value: STOCK_COLUMN_LABELS,
  raw_material_value: RAW_MATERIAL_COLUMN_LABELS,
  defective_items: DEFECTIVE_COLUMN_LABELS,
  transfers_count: TRANSFERS_COLUMN_LABELS,
  items_transferred: TRANSFERS_COLUMN_LABELS,
  acceptances_count: ACCEPTANCES_COLUMN_LABELS,
  sales_count: SALES_COLUMN_LABELS,
  sales_amount: SALES_COLUMN_LABELS,
  discounts_total: DISCOUNTS_COLUMN_LABELS,
  users_count: USERS_COLUMN_LABELS,
  items_on_hand_qty: ITEMS_ON_HAND_LABELS,
  items_on_hand_amount: ITEMS_ON_HAND_LABELS,
  revenue: SALE_ITEM_AGG_LABELS,
  cost_of_goods_sold: SALE_ITEM_AGG_LABELS,
  gross_profit: SALE_ITEM_AGG_LABELS,
  gross_margin_percent: SALE_ITEM_AGG_LABELS,
  total_debt: TOTAL_DEBT_LABELS,
  accounts_receivable: ACCOUNTS_RECEIVABLE_LABELS,
  accounts_payable: ACCOUNTS_PAYABLE_LABELS,
};

export const TOTALS_VALUE_LABELS = {
  purchase_sum: "Сумма закуп (страница)",
  retail_sum: "Сумма розницы (страница)",
  sum: "Сумма (страница)",
  qty: "Количество",
  items_transferred: "Передано единиц",
  qty_accepted: "Принято единиц",
  sales_amount: "Сумма продаж",
  discounts_total: "Сумма скидок",
  qty_on_hand: "На руках (шт)",
  amount: "Стоимость на руках",
  revenue: "Выручка",
  cost_of_goods_sold: "Себестоимость",
  gross_profit: "Валовая прибыль",
  gross_margin_percent: "Маржа %",
  accounts_receivable: "Дебиторская",
  accounts_receivable_client_deals: "Сделки (рассрочка)",
  accounts_receivable_pos_sales: "POS в долг",
  accounts_payable: "Кредиторская",
  total_debt: "Общий долг (остатки)",
  remaining: "Остаток",
  prepayment: "Предоплата",
  paid: "Оплачено",
};

export function getCardDetailColumns(cardKey, rows) {
  if (!rows?.length) return [];
  const keys = Object.keys(rows[0] || {});
  const order = CARD_DETAIL_COLUMN_ORDER[cardKey];
  if (order) {
    const ordered = order.filter((k) => keys.includes(k));
    const rest = keys.filter((k) => !order.includes(k));
    return [...ordered, ...rest.sort()];
  }
  return keys;
}

/**
 * Без технических идентификаторов: поле `id`, все `*_id` (product_id, counterparty_id, …).
 * Порядковый номер строки — отдельная колонка «№» в модалке.
 */
export function getDisplayDetailColumns(cardKey, rows) {
  return getCardDetailColumns(cardKey, rows).filter(
    (c) => c !== "id" && !c.endsWith("_id"),
  );
}

const TOTALS_DECIMAL_KEYS = new Set([
  "discounts_total",
  "purchase_sum",
  "retail_sum",
  "sum",
  "sales_amount",
  "amount",
  "revenue",
  "cost_of_goods_sold",
  "gross_profit",
  "gross_margin_percent",
  "accounts_receivable",
  "accounts_receivable_client_deals",
  "accounts_receivable_pos_sales",
  "accounts_payable",
  "total_debt",
  "remaining",
  "prepayment",
  "paid",
]);

export function formatTotalsValue(key, value) {
  if (value === null || value === undefined) return "—";
  if (TOTALS_DECIMAL_KEYS.has(key)) {
    const n = typeof value === "string" ? parseFloat(value) : Number(value);
    if (Number.isNaN(n)) return String(value);
    return n.toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (typeof value === "number") return value.toLocaleString("ru-RU");
  return String(value);
}

export function formatDetailsCell(value, column) {
  if (value === null || value === undefined || value === "") return "—";
  if (column === "is_active") {
    if (value === true || value === "true" || value === 1 || value === "1")
      return "Да";
    if (value === false || value === "false" || value === 0 || value === "0")
      return "Нет";
  }
  if (
    (column === "agent" ||
      column === "user" ||
      column === "client" ||
      column === "product" ||
      column === "accepted_by") &&
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    return (
      value.name ??
      value.full_name ??
      value.title ??
      String(value.id ?? "—")
    );
  }
  if (
    column === "subreal" &&
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    const parts = [value.id, value.status].filter(
      (x) => x !== null && x !== undefined && x !== "",
    );
    return parts.length ? parts.join(" · ") : "—";
  }
  if (
    column === "supplier" &&
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    return value.full_name ?? String(value.id ?? "—");
  }
  if (
    (column === "created_at" || column === "accepted_at") &&
    typeof value === "string"
  ) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString("ru-RU");
  }
  if (column === "kind" && typeof value === "string") {
    if (value === "client_deal") return "Сделка (рассрочка)";
    if (value === "sale_debt") return "Продажа в долг";
    return value;
  }
  const moneyColumns = new Set([
    "discounts_total",
    "sales_amount",
    "amount",
    "total",
    "discount_total",
    "revenue",
    "gross_profit",
    "gross_margin_percent",
    "cost",
    "cost_of_goods_sold",
    "line_total",
    "unit_price",
    "line_discount",
    "purchase_sum",
    "retail_sum",
    "sum",
    "purchase_price",
    "retail_price",
    "price",
    "prepayment",
    "paid",
    "remaining",
    "accounts_payable",
  ]);
  if (moneyColumns.has(column)) {
    const n = typeof value === "string" ? parseFloat(value) : Number(value);
    if (Number.isNaN(n)) return String(value);
    return n.toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (typeof value === "number") return value.toLocaleString("ru-RU");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
