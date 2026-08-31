import { describe, expect, it } from "vitest";
import { mapDashboardResponse } from "./mapDashboardResponse";

describe("mapDashboardResponse", () => {
  it("maps dashboard payload into hook shape", () => {
    const result = mapDashboardResponse({
      totals: {
        appointments_total: 12,
        appointments_completed: 8,
        appointments_canceled: 2,
        appointments_no_show: 1,
        revenue_completed: 4000,
        services_total: 5,
        clients_barber_total: 20,
        clients_market_total: 3,
        clients_market_active: 2,
        income_unified: 5000,
        expense_unified: 1200,
        sale_fund: 300,
      },
      cash: {
        totals: { income: 1000, expense: 900, net: 100 },
        by_cashbox: [
          {
            cashbox_id: "cb-1",
            name: "Основная",
            ops: 4,
            income: 1000,
            expense: 900,
          },
        ],
      },
      charts: {
        weekday_appointments: [1, 2, 0, 0, 5, 3, 1],
        daily_cashflow: {
          labels: ["1", "2"],
          income: [100, 200],
          expense: [50, 0],
        },
      },
      rankings: {
        masters: [{ master_id: 1, master_name: "Алекс", count: 3, revenue: 900 }],
        services: [{ service_id: 2, name: "Стрижка", count: 4, revenue: 1600 }],
        clients_visits: [{ client_id: 3, name: "Иван", count: 2, revenue: 800 }],
        clients_sales: [{ client_id: "c-1", name: "Магазин", orders: 1, revenue: 500 }],
      },
      bookings: {
        statuses: [{ status: "confirmed", label: "Подтверждены", count: 2 }],
        top_services: [{ service_id: 2, name: "Стрижка", count: 2 }],
      },
      products: {
        sales_rows: [{ name: "Шампунь", qty: 2, revenue: 400 }],
        suppliers_rows: [{ supplier_id: "s-1", name: "Поставщик А", items: 1, amount: 300 }],
        stock: { positions: 10, total_qty: 50, stock_value_retail: 12000 },
        summary: { total_qty: 99, total_revenue: 15000 },
      },
      details: {
        income: [
          {
            source: "Запись",
            title: "Стрижка",
            amount: 500,
            date: "01.08.2026",
          },
        ],
        expense: [
          {
            source: "Касса",
            title: "Аренда",
            amount: 200,
            date: "02.08.2026",
          },
        ],
      },
      navigation: { default_cashbox_id: "cashbox-1" },
    });

    expect(result.totalApps).toBe(12);
    expect(result.completedCount).toBe(8);
    expect(result.unifiedIncome).toBe(5000);
    expect(result.unifiedExpense).toBe(1200);
    expect(result.goodsSummary).toEqual({ totalQty: 99, totalRevenue: 15000 });
    expect(result.salesClientsSummary.activeClients).toBe(2);
    expect(result.rankBarbers[0]).toEqual({
      id: 1,
      name: "Алекс",
      count: 3,
      sum: 900,
    });
    expect(result.cashRows[0]).toMatchObject({
      id: "cb-1",
      name: "Основная",
    });
    expect(result.clientsSalesRows[0]).toMatchObject({
      id: "c-1",
      name: "Магазин",
    });
    expect(result.weekChart).toEqual([1, 2, 0, 0, 5, 3, 1]);
    expect(result.dayLineChart.income).toEqual([100, 200]);
    expect(result.defaultCashboxId).toBe("cashbox-1");
  });

  it("does not derive goods summary from truncated sales_rows", () => {
    const result = mapDashboardResponse({
      totals: {},
      cash: { totals: {}, by_cashbox: [] },
      charts: {},
      rankings: {},
      bookings: {},
      products: {
        sales_rows: [{ name: "Шампунь", qty: 2, revenue: 400 }],
      },
      details: {},
      navigation: {},
    });

    expect(result.goodsSummary).toEqual({ totalQty: 0, totalRevenue: 0 });
  });
});
