/**
 * Нормализация ответа аналитики склада (owner/analytics, partners/{id}/analytics).
 *
 * Бэкенд переходит на новый контракт (docs/warehouse/analytics-calculation-fixes.md §4,
 * docs/warehouse/analytics-coverage.md §5). Фронт обязан работать с обоими ответами:
 * поле, которого нет в ответе, даёт `null`, и блок, построенный на нём, не рисуется.
 */

const hasValue = (obj, key) =>
  obj != null &&
  Object.prototype.hasOwnProperty.call(obj, key) &&
  obj[key] !== null &&
  obj[key] !== "";

export const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Число из поля или `null`, если бэкенд поле не прислал. */
export const numOrNull = (obj, key) => (hasValue(obj, key) ? toNum(obj[key]) : null);

const firstNum = (obj, keys) => {
  for (const key of keys) {
    const v = numOrNull(obj, key);
    if (v != null) return v;
  }
  return null;
};

const anyValue = (obj, keys) => keys.some((key) => hasValue(obj, key));

/**
 * Продажи.
 * Старый бэкенд: `sales_*` — только продажи агентов (нетто).
 * Новый: `sales_*` — все продажи (POSTED + CASH_PENDING), отдельно `agent_sales_*`, `own_sales_*`.
 */
export const buildSalesSummary = (summary = {}) => {
  const hasSplit = anyValue(summary, ["agent_sales_amount", "agent_sales_count"]);
  const count = toNum(summary.sales_count);
  const amount = toNum(summary.sales_amount);
  return {
    hasSplit,
    count,
    amount,
    grossAmount: numOrNull(summary, "gross_sales_amount"),
    returnsCount: toNum(summary.returns_count),
    returnsAmount: toNum(summary.returns_amount),
    agentCount: hasSplit ? toNum(summary.agent_sales_count) : count,
    agentAmount: hasSplit ? toNum(summary.agent_sales_amount) : amount,
    ownCount: numOrNull(summary, "own_sales_count"),
    ownAmount: numOrNull(summary, "own_sales_amount"),
    pendingCashCount: numOrNull(summary, "pending_cash_sales_count"),
    pendingCashAmount: numOrNull(summary, "pending_cash_sales_amount"),
  };
};

/**
 * Остатки — для summary и для строки details.warehouses[].
 * Старый бэкенд отдавал в `on_hand_*` остаток **у агентов** (AgentStockBalance),
 * поэтому на «склад» он не подставляется никогда.
 */
export const buildOnHand = (src = {}) => {
  const warehouseQty = numOrNull(src, "warehouse_on_hand_qty");
  return {
    hasWarehouse: warehouseQty != null,
    warehouseQty,
    warehouseAmount: numOrNull(src, "warehouse_on_hand_amount"),
    warehousePurchaseAmount: firstNum(src, [
      "warehouse_on_hand_purchase_amount",
      "on_hand_purchase_amount",
    ]),
    agentQty: firstNum(src, ["agent_on_hand_qty", "on_hand_qty"]) ?? 0,
    agentAmount: firstNum(src, ["agent_on_hand_amount", "on_hand_amount"]) ?? 0,
  };
};

/**
 * Топ агентов по продажам с долей от ВСЕХ продаж агентов.
 * Раньше доля считалась от суммы первых 10 строк — при 11+ агентах завышалась.
 */
export const buildTopAgentsBySales = (topAgents = {}, summary = {}) => {
  const rows = Array.isArray(topAgents?.by_sales) ? topAgents.by_sales : [];
  const rowsTotal = rows.reduce(
    (acc, a) => acc + toNum(a.sales_amount ?? a.amount),
    0,
  );
  // Знаменатель: total из бэкенда → продажи агентов из summary →
  // (старый бэкенд) gross_sales_amount = все продажи агентов до возвратов → сумма строк.
  const denominator =
    firstNum(topAgents, ["total_sales_amount"]) ??
    firstNum(summary, ["agent_sales_amount", "gross_sales_amount", "sales_amount"]) ??
    rowsTotal;

  return rows.map((a) => {
    const amount = toNum(a.sales_amount ?? a.amount);
    const backendShare = numOrNull(a, "share_percent");
    return {
      id: a.agent_id ?? a.id ?? null,
      name: a.agent_name || a.name || a.agent_display || a.agent_id || a.id || "—",
      amount,
      docsCount: toNum(a.sales_count ?? a.count),
      sharePercent:
        backendShare ?? (denominator > 0 ? (amount / denominator) * 100 : null),
    };
  });
};

export const PAYMENT_KIND_LABELS = {
  cash: "Оплата сразу",
  credit: "В долг",
  external: "Вне кассы",
};

const buildByPaymentKind = (src) => {
  if (!src || typeof src !== "object") return null;
  const rows = Object.keys(PAYMENT_KIND_LABELS)
    .filter((key) => hasValue(src, key))
    .map((key) => ({ key, label: PAYMENT_KIND_LABELS[key], amount: toNum(src[key]) }));
  return rows.length ? rows : null;
};

/** Выручка по способу оплаты (A4, вариант A). `null` — бэкенд не прислал. */
export const buildRevenueByPaymentKind = (summary = {}) =>
  buildByPaymentKind(summary.revenue_by_payment_kind);

/** Итоги бизнеса за период: закупки, ЗП, себестоимость, прибыль (coverage §4.1, §4.4, §4.5). */
export const buildBusinessTotals = (summary = {}) => {
  const keys = [
    "purchases_amount",
    "net_purchases_amount",
    "salary_accrued_amount",
    "revenue_amount",
    "cogs_amount",
    "gross_profit_amount",
    "operating_profit_amount",
    "writeoff_loss_amount",
  ];
  if (!anyValue(summary, keys)) return null;
  return {
    purchasesCount: numOrNull(summary, "purchases_count"),
    purchasesAmount: numOrNull(summary, "purchases_amount"),
    purchaseReturnsAmount: numOrNull(summary, "purchase_returns_amount"),
    netPurchasesAmount: firstNum(summary, ["net_purchases_amount", "purchases_amount"]),
    purchasesByPaymentKind: buildByPaymentKind(summary.purchases_by_payment_kind),
    revenue: numOrNull(summary, "revenue_amount"),
    cogs: numOrNull(summary, "cogs_amount"),
    grossProfit: numOrNull(summary, "gross_profit_amount"),
    grossMarginPercent: numOrNull(summary, "gross_margin_percent"),
    writeoffLoss: numOrNull(summary, "writeoff_loss_amount"),
    salaryExpense: firstNum(summary, ["salary_expense_amount", "salary_accrued_amount"]),
    salaryAccrued: numOrNull(summary, "salary_accrued_amount"),
    salaryPaid: numOrNull(summary, "salary_paid_amount"),
    salaryPayable: numOrNull(summary, "salary_payable_amount"),
    operatingProfit: numOrNull(summary, "operating_profit_amount"),
    costIsEstimated: Boolean(summary.cost_is_estimated),
  };
};

const STOCK_MOVEMENT_ROWS = [
  { label: "Принято (закупки и приходы)", qty: "received_qty", cost: "received_cost" },
  { label: "Отгружено (продажи)", qty: "shipped_qty", cost: null },
  { label: "Списано", qty: "written_off_qty", cost: "written_off_cost" },
  { label: "Излишки по инвентаризации", qty: "inventory_surplus_qty", cost: "inventory_surplus_cost" },
  { label: "Недостачи по инвентаризации", qty: "inventory_shortage_qty", cost: "inventory_shortage_cost" },
  { label: "Перемещено между складами", qty: "transferred_qty", cost: null },
  { label: "Выдано агентам", qty: "issued_to_agents_qty", cost: null },
  { label: "Возвращено от агентов", qty: "returned_from_agents_qty", cost: null },
];

/** Движение товара за период (coverage §4.2). `null` — бэкенд не прислал ни одного поля. */
export const buildStockMovementRows = (summary = {}) => {
  const rows = STOCK_MOVEMENT_ROWS.filter((r) => hasValue(summary, r.qty)).map((r) => ({
    label: r.label,
    qty: toNum(summary[r.qty]),
    cost: r.cost ? numOrNull(summary, r.cost) : null,
  }));
  return rows.length ? rows : null;
};

/** Массив из ответа или пустой массив. */
export const listOf = (v) => (Array.isArray(v) ? v : []);
