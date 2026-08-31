import { describe, expect, it } from "vitest";

import {
  isMarketSector,
  resolveCashierPath,
  SELL_CASHIER_SECTORS,
} from "./cashierRoutes";

describe("cashierRoutes", () => {
  it("определяет маркет", () => {
    expect(isMarketSector("Магазин")).toBe(true);
    expect(isMarketSector("Цветочный магазин")).toBe(true);
    expect(isMarketSector("Услуги")).toBe(false);
  });

  it("возвращает маршрут кассира по сфере", () => {
    expect(resolveCashierPath("Услуги")).toBe("/crm/sell/start");
    expect(resolveCashierPath("Склад")).toBe("/crm/warehouse/kassa");
    expect(resolveCashierPath("Кафе")).toBe("/crm/market/cashier");
  });

  it("экспортирует sell-cashier сферы", () => {
    expect(SELL_CASHIER_SECTORS).toContain("services");
  });
});
