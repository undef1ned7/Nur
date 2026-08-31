import { describe, expect, it } from "vitest";
import {
  BASE_TABS,
  applyBranchTabsRules,
  applySectorTabsRules,
  SECTOR_EXTRA_TABS,
  SECTOR_TAB_LABEL_OVERRIDES,
} from "./branchTabsConfig";

const marketMenuTabs = [
  { id: "market-history", label: "История", route: "/crm/market/history" },
  {
    id: "market-analytics",
    label: "Аналитика",
    route: "/crm/market/analytics",
  },
  { id: "shifts", label: "Смены", route: "/crm/shifts" },
  {
    id: "market-procurement",
    label: "Закупки",
    route: "/crm/market/procurement",
  },
  {
    id: "market-suppliers",
    label: "Поставщики",
    route: "/crm/market/suppliers",
  },
  {
    id: "market-documents",
    label: "Документы",
    route: "/crm/market/documents",
  },
  { id: "market-bar", label: "Бар", route: "/crm/market/bar" },
];

describe("branchTabsConfig — Магазин", () => {
  it("оставляет все базовые табы", () => {
    const tabs = applyBranchTabsRules(BASE_TABS, "Магазин", "Профи");
    expect(tabs.map((t) => t.id)).toEqual([
      "kassa",
      "warehouse",
      "sales",
      "analytics",
      "employees",
      "clients",
    ]);
  });

  it("показывает все marketMenu-вкладки кроме устаревшего bar", () => {
    const tabs = applySectorTabsRules(marketMenuTabs, "Магазин", "Профи");
    const routes = tabs.map((t) => t.route);
    expect(routes).toContain("/crm/market/history");
    expect(routes).toContain("/crm/market/analytics");
    expect(routes).toContain("/crm/shifts");
    expect(routes).toContain("/crm/market/procurement");
    expect(routes).toContain("/crm/market/suppliers");
    expect(routes).toContain("/crm/market/documents");
    expect(routes).not.toContain("/crm/market/bar");
  });

  it("для Цветочный магазин тоже скрывает только bar", () => {
    const tabs = applySectorTabsRules(marketMenuTabs, "Цветочный магазин", "Профи");
    expect(tabs.map((t) => t.route)).not.toContain("/crm/market/bar");
    expect(tabs.map((t) => t.route)).toContain("/crm/market/history");
  });

  it("задаёт extra-табы Кассир и Категории", () => {
    expect(SECTOR_EXTRA_TABS["Магазин"].map((t) => t.route)).toEqual([
      "/crm/market/cashier",
      "/crm/market/categories",
    ]);
    expect(SECTOR_EXTRA_TABS["Цветочный магазин"].map((t) => t.route)).toEqual([
      "/crm/market/cashier",
      "/crm/market/categories",
    ]);
  });

  it("переименовывает конфликтные подписи аналитики/истории", () => {
    expect(SECTOR_TAB_LABEL_OVERRIDES["Магазин"]["/crm/market/analytics"]).toBe(
      "Аналитика маркета"
    );
    expect(SECTOR_TAB_LABEL_OVERRIDES["Магазин"]["/crm/market/history"]).toBe(
      "История продаж"
    );
  });
});
