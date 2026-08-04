import { describe, expect, it } from "vitest";

import { getAdditionalServicesForMenu } from "./additionalServicesConfig";
import { barberSectorMenus } from "./sectors/barberMenu";

const menuFor = (sector) =>
  getAdditionalServicesForMenu({
    sector,
    tariff: "Стандарт",
    company: {},
    hasPermission: (permission) => permission === "can_view_cashier",
  });

const cashierTo = (sector) =>
  menuFor(sector).find((item) => item.label === "Интерфейс кассира")?.to;

describe("Интерфейс кассира — путь по сфере", () => {
  it("в барбершопе/услугах/стоматологии ведёт в кассу продаж", () => {
    expect(cashierTo("Барбершоп")).toBe("/crm/sell/start");
    expect(cashierTo("Услуги")).toBe("/crm/sell/start");
    expect(cashierTo("Стоматология")).toBe("/crm/sell/start");
  });

  it("в остальных сферах ведёт в кассу маркета", () => {
    expect(cashierTo("Магазин")).toBe("/crm/market/cashier");
    expect(cashierTo("Кафе")).toBe("/crm/market/cashier");
  });
});

describe("Меню сфер барбершоп/услуги/стоматология", () => {
  it("содержит пункт «Смены»", () => {
    ["barber", "services", "dentistry"].forEach((sector) => {
      const shifts = barberSectorMenus[sector].find(
        (item) => item.label === "Смены",
      );
      expect(shifts, sector).toBeTruthy();
      expect(shifts.to).toBe("/crm/shifts");
      expect(shifts.permission).toBe("can_view_shifts");
    });
  });
});
