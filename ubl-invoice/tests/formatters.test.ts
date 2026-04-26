import { describe, expect, it } from "vitest";
import { toDecimal } from "../src/lib/decimal.js";
import {
  calculateMonetaryTotal,
  calculateTaxTotal,
  calculateTotals,
} from "../src/utils/formatters.js";

describe("calculateTotals", () => {
  it("sums multiple lines and tax deterministically", () => {
    const lines = [
      {
        id: "1",
        description: "A",
        quantity: toDecimal(3),
        unitCode: "C62",
        unitPrice: toDecimal("10.00"),
        taxCategory: {
          id: "S" as const,
          percent: toDecimal(10),
          scheme: "VAT" as const,
        },
      },
      {
        id: "2",
        description: "B",
        quantity: toDecimal(1),
        unitCode: "C62",
        unitPrice: toDecimal(25),
        taxCategory: {
          id: "S" as const,
          percent: toDecimal(10),
          scheme: "VAT" as const,
        },
      },
    ];
    const tax = calculateTaxTotal(lines);
    expect(tax.taxAmount.toFixed(2)).toBe("5.50");
    const totals = calculateMonetaryTotal(lines, tax);
    expect(totals.lineExtensionAmount.toFixed(2)).toBe("55.00");
    expect(totals.taxInclusiveAmount.toFixed(2)).toBe("60.50");
    expect(totals.payableAmount.toFixed(2)).toBe("60.50");
  });

  it("handles zero tax category", () => {
    const lines = [
      {
        id: "1",
        description: "Z",
        quantity: toDecimal(2),
        unitCode: "C62",
        unitPrice: toDecimal(40),
        taxCategory: {
          id: "Z" as const,
          percent: toDecimal(0),
          scheme: "VAT" as const,
        },
      },
    ];
    const totals = calculateTotals(lines);
    expect(totals.taxInclusiveAmount.equals(totals.lineExtensionAmount)).toBe(true);
    expect(totals.payableAmount.toFixed(2)).toBe("80.00");
  });
});
