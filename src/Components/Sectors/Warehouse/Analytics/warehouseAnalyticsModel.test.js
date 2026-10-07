import { describe, expect, it } from "vitest";
import {
  buildBusinessTotals,
  buildOnHand,
  buildRevenueByPaymentKind,
  buildSalesSummary,
  buildStockMovementRows,
  buildTopAgentsBySales,
} from "./warehouseAnalyticsModel";

describe("buildSalesSummary", () => {
  it("старый ответ: sales_* — продажи агентов, разбивки нет", () => {
    const s = buildSalesSummary({ sales_count: 5, sales_amount: "1000.00" });
    expect(s.hasSplit).toBe(false);
    expect(s.agentAmount).toBe(1000);
    expect(s.ownAmount).toBeNull();
    expect(s.pendingCashCount).toBeNull();
  });

  it("новый ответ: все продажи + агенты + свои + ожидают кассы", () => {
    const s = buildSalesSummary({
      sales_count: 3946,
      sales_amount: "17803644.00",
      agent_sales_count: 3932,
      agent_sales_amount: "17672097.00",
      own_sales_count: 14,
      own_sales_amount: "131547.00",
      pending_cash_sales_count: 3,
      pending_cash_sales_amount: "39584.00",
    });
    expect(s.hasSplit).toBe(true);
    expect(s.amount).toBe(17803644);
    expect(s.agentAmount).toBe(17672097);
    expect(s.ownAmount).toBe(131547);
    expect(s.pendingCashAmount).toBe(39584);
  });
});

describe("buildOnHand", () => {
  it("старый ответ: on_hand_* — это остаток у агентов, склад неизвестен", () => {
    const o = buildOnHand({ on_hand_qty: "8.000", on_hand_amount: "400.00" });
    expect(o.hasWarehouse).toBe(false);
    expect(o.warehouseQty).toBeNull();
    expect(o.agentQty).toBe(8);
    expect(o.agentAmount).toBe(400);
  });

  it("новый ответ: склад отдельно от агентов", () => {
    const o = buildOnHand({
      warehouse_on_hand_qty: "50",
      warehouse_on_hand_amount: "500",
      warehouse_on_hand_purchase_amount: "300",
      agent_on_hand_qty: "3",
      agent_on_hand_amount: "30",
      on_hand_qty: "3",
    });
    expect(o.hasWarehouse).toBe(true);
    expect(o.warehouseQty).toBe(50);
    expect(o.warehouseAmount).toBe(500);
    expect(o.warehousePurchaseAmount).toBe(300);
    expect(o.agentQty).toBe(3);
  });

  it("закупочная стоимость из on_hand_purchase_amount (ТЗ analytics-warehouses-purchase-price)", () => {
    expect(buildOnHand({ on_hand_purchase_amount: "120" }).warehousePurchaseAmount).toBe(120);
  });
});

describe("buildTopAgentsBySales", () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    agent_id: `a${i}`,
    agent_name: `Агент ${i}`,
    sales_count: 1,
    sales_amount: "100",
  }));

  it("доля от всех продаж агентов, а не от суммы топ-10", () => {
    // 11 агентов по 100: топ-10 = 1000, всего 1100
    const top = buildTopAgentsBySales({ by_sales: rows }, { agent_sales_amount: "1100" });
    expect(top[0].sharePercent).toBeCloseTo(9.09, 2);
  });

  it("берёт share_percent и total_sales_amount из бэкенда, если они есть", () => {
    const top = buildTopAgentsBySales(
      { total_sales_amount: "2000", by_sales: [{ agent_id: "x", sales_amount: "500", share_percent: "21.40" }] },
      {},
    );
    expect(top[0].sharePercent).toBe(21.4);
  });

  it("старый бэкенд: знаменатель — gross_sales_amount", () => {
    const top = buildTopAgentsBySales({ by_sales: rows }, { sales_amount: "900", gross_sales_amount: "1100" });
    expect(top[0].sharePercent).toBeCloseTo(9.09, 2);
  });

  it("число документов, а не штук", () => {
    expect(buildTopAgentsBySales({ by_sales: [{ sales_count: 7, sales_amount: 1 }] })[0].docsCount).toBe(7);
  });
});

describe("новые блоки: null, если бэкенд их не прислал", () => {
  it("старый ответ", () => {
    const summary = { sales_amount: "1" };
    expect(buildRevenueByPaymentKind(summary)).toBeNull();
    expect(buildBusinessTotals(summary)).toBeNull();
    expect(buildStockMovementRows(summary)).toBeNull();
  });

  it("выручка по способу оплаты", () => {
    const rows = buildRevenueByPaymentKind({
      revenue_by_payment_kind: { cash: "100", credit: "20", external: "0" },
    });
    expect(rows.map((r) => r.key)).toEqual(["cash", "credit", "external"]);
    expect(rows[1].amount).toBe(20);
  });

  it("итоги и прибыль", () => {
    const t = buildBusinessTotals({
      purchases_amount: "1500",
      net_purchases_amount: "1300",
      revenue_amount: "800",
      cogs_amount: "480",
      gross_profit_amount: "320",
      gross_margin_percent: "40",
      salary_accrued_amount: "300",
      cost_is_estimated: true,
    });
    expect(t.netPurchasesAmount).toBe(1300);
    expect(t.grossProfit).toBe(320);
    expect(t.salaryExpense).toBe(300);
    expect(t.costIsEstimated).toBe(true);
    expect(t.operatingProfit).toBeNull();
  });

  it("движение товара — только присланные строки", () => {
    const rows = buildStockMovementRows({ written_off_qty: "3", written_off_cost: "150", transferred_qty: "4" });
    expect(rows).toEqual([
      { label: "Списано", qty: 3, cost: 150 },
      { label: "Перемещено между складами", qty: 4, cost: null },
    ]);
  });
});
