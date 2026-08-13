import { describe, expect, it } from "vitest";
import {
  aggregateClientKpisFromDeals,
  mapClientKpis,
} from "./clientKpis";

describe("mapClientKpis", () => {
  it("reads nested buckets", () => {
    expect(
      mapClientKpis({
        debt: { amount: "1200.50", count: 2 },
        prepayment: { amount: "300.00", count: 1 },
        sale: { amount: "4500", count: 4 },
      }),
    ).toEqual({
      debt: { amount: 1200.5, count: 2 },
      prepayment: { amount: 300, count: 1 },
      sale: { amount: 4500, count: 4 },
    });
  });

  it("reads a wrapped payload and flat aliases", () => {
    expect(
      mapClientKpis({
        kpis: {
          remaining_debt: "10.00",
          debt_count: 3,
          prepayment_amount: "4.5",
          prepayment_count: 1,
          sales_total: "99",
          sales_count: 8,
        },
      }),
    ).toEqual({
      debt: { amount: 10, count: 3 },
      prepayment: { amount: 4.5, count: 1 },
      sale: { amount: 99, count: 8 },
    });
  });

  it("returns zeros for empty input", () => {
    expect(mapClientKpis(null)).toEqual({
      debt: { amount: 0, count: 0 },
      prepayment: { amount: 0, count: 0 },
      sale: { amount: 0, count: 0 },
    });
  });
});

describe("aggregateClientKpisFromDeals", () => {
  it("splits debt remaining, prepaid amount and sales", () => {
    expect(
      aggregateClientKpisFromDeals([
        {
          kind: "debt",
          remaining_debt: "70.00",
          prepayment: "30.00",
          amount: "100",
        },
        { kind: "prepayment", amount: "20" },
        { kind: "sale", amount: "15.5" },
        { kind: "sale", amount: "4.5" },
      ]),
    ).toEqual({
      debt: { amount: 70, count: 1 },
      prepayment: { amount: 50, count: 2 },
      sale: { amount: 20, count: 2 },
    });
  });

  it("ignores zero prepaid on debt and defaults missing kind to sale", () => {
    expect(
      aggregateClientKpisFromDeals([
        { kind: "debt", remaining_debt: "10", prepayment: "0" },
        { amount: "5" },
      ]),
    ).toEqual({
      debt: { amount: 10, count: 1 },
      prepayment: { amount: 0, count: 0 },
      sale: { amount: 5, count: 1 },
    });
  });
});
