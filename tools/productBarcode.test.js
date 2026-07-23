import { describe, expect, it } from "vitest";
import { productMatchesBarcode } from "./productBarcode";

describe("productMatchesBarcode", () => {
  const product = {
    name: "Вода Легенда",
    barcode: "0460123456789",
    alternate_barcodes: ["460123456789"],
    article: "LEGEND-05",
    code: "12345",
  };

  it("matches the primary barcode exactly", () => {
    expect(productMatchesBarcode(product, "0460123456789")).toBe(true);
  });

  it("matches an alternate barcode exactly", () => {
    expect(productMatchesBarcode(product, "460123456789")).toBe(true);
  });

  it("does not match article, code, name or a barcode substring", () => {
    expect(productMatchesBarcode(product, "LEGEND-05")).toBe(false);
    expect(productMatchesBarcode(product, "12345")).toBe(false);
    expect(productMatchesBarcode(product, "Легенда")).toBe(false);
    expect(productMatchesBarcode(product, "460123")).toBe(false);
  });
});
