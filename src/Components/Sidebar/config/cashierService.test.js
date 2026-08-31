import { describe, expect, it } from "vitest";

import {
  getAdditionalServicesForMenu,
  getAdditionalServicesForPage,
} from "./additionalServicesConfig";
import { SERVICE_IDS } from "../../../config/additionalServiceIds";
import { barberSectorMenus } from "./sectors/barberMenu";

const baseParams = {
  tariff: "Стандарт",
  company: {},
  hasPermission: (permission) => permission === "can_view_cashier",
  isAllowed: () => true,
};

const menuFor = (sector) =>
  getAdditionalServicesForMenu({
    ...baseParams,
    sector,
  });

const pageFor = (sector) =>
  getAdditionalServicesForPage({
    ...baseParams,
    sector,
  });

const cashierTo = (sector) =>
  menuFor(sector).find((item) => item.label === "Интерфейс кассира")?.to;

const cashierOnPage = (sector) =>
  pageFor(sector).find((item) => item.id === SERVICE_IDS.CASHIER);

describe("Интерфейс кассира — путь по сфере", () => {
  it("в барбершопе/услугах/стоматологии ведёт в кассу продаж", () => {
    expect(cashierTo("Барбершоп")).toBe("/crm/sell/start");
    expect(cashierTo("Услуги")).toBe("/crm/sell/start");
    expect(cashierTo("Стоматология")).toBe("/crm/sell/start");
  });

  it("в кафе и других не-маркет сферах ведёт в кассу маркета", () => {
    expect(cashierTo("Кафе")).toBe("/crm/market/cashier");
    expect(cashierTo("Производство")).toBe("/crm/market/cashier");
  });

  it("не показывается в маркете (встроенная касса сферы)", () => {
    expect(cashierTo("Магазин")).toBeUndefined();
    expect(cashierTo("Цветочный магазин")).toBeUndefined();
    expect(cashierOnPage("Магазин")).toBeUndefined();
    expect(cashierOnPage("Цветочный магазин")).toBeUndefined();
  });

  it("есть на странице доп. услуг вне маркета", () => {
    const card = cashierOnPage("Услуги");
    expect(card?.title).toBe("Интерфейс кассира");
    expect(card?.to).toBe("/crm/sell/start");
    expect(card?.isConnected).toBe(true);
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
