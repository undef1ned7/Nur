import { describe, expect, it } from "vitest";
import {
  buildConsultantCheckoutFields,
  calcCommissionPreview,
  employeeDisplayName,
  employeeUserId,
  isValidCommissionPercent,
  parseCommissionPercent,
  pickDefaultSalesPercentFromProfiles,
} from "./marketSaleConsultant.js";

describe("marketSaleConsultant", () => {
  it("parses employee id/name", () => {
    expect(employeeUserId({ id: 1, user_id: 9 })).toBe("9");
    expect(employeeDisplayName({ first_name: "Ай", last_name: "Бек" })).toBe(
      "Бек Ай",
    );
  });

  it("validates percent and preview", () => {
    expect(parseCommissionPercent("5,5")).toBe(5.5);
    expect(isValidCommissionPercent(101)).toBe(false);
    expect(calcCommissionPreview(2000, 5)).toBe(100);
  });

  it("picks default from pay profiles", () => {
    expect(
      pickDefaultSalesPercentFromProfiles([
        { pay_scheme: "salary", sales_percent: "0" },
        { pay_scheme: "percent", sales_percent: "7" },
      ]),
    ).toBe("7");
  });

  it("builds checkout fields", () => {
    expect(
      buildConsultantCheckoutFields({
        enabled: false,
        consultantId: "1",
        commissionEnabled: true,
        commissionPercent: "5",
      }),
    ).toBeNull();

    expect(
      buildConsultantCheckoutFields({
        enabled: true,
        consultantId: "u1",
        commissionEnabled: false,
        commissionPercent: "5",
      }),
    ).toEqual({
      consultant_id: "u1",
      consultant_commission_enabled: false,
      consultant_commission_percent: "0.00",
    });

    expect(
      buildConsultantCheckoutFields({
        enabled: true,
        consultantId: "u1",
        commissionEnabled: true,
        commissionPercent: "5",
      }),
    ).toEqual({
      consultant_id: "u1",
      consultant_commission_enabled: true,
      consultant_commission_percent: "5.00",
    });
  });
});
