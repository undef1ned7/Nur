import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/api/products", () => ({
  fetchProductsApi: vi.fn(),
  getProductByBarcodeApi: vi.fn(),
  lookupWarehouseProductByBarcodeApi: vi.fn(),
}));

import {
  fetchProductsApi,
  getProductByBarcodeApi,
  lookupWarehouseProductByBarcodeApi,
} from "../src/api/products";
import {
  isCompanyWarehouseBarcodeProduct,
  lookupMarketWarehouseProductByBarcode,
  normalizeWarehouseBarcodeProduct,
  WAREHOUSE_BARCODE_SOURCE,
} from "./marketWarehouseBarcodeScan";

describe("normalizeWarehouseBarcodeProduct", () => {
  it("unwraps product wrapper and normalizes id", () => {
    expect(
      normalizeWarehouseBarcodeProduct({
        product: { uuid: "abc", name: "Cola" },
      }),
    ).toEqual({ uuid: "abc", name: "Cola", id: "abc" });
  });
});

describe("lookupMarketWarehouseProductByBarcode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns warehouse source for local product", async () => {
    lookupWarehouseProductByBarcodeApi.mockResolvedValue({
      id: "local-1",
      name: "Локальный",
    });

    const result = await lookupMarketWarehouseProductByBarcode("123");

    expect(result).toEqual({
      product: { id: "local-1", name: "Локальный" },
      source: WAREHOUSE_BARCODE_SOURCE.warehouse,
    });
    expect(getProductByBarcodeApi).not.toHaveBeenCalled();
    expect(isCompanyWarehouseBarcodeProduct(result)).toBe(true);
  });

  it("returns global source when product exists only in global catalog", async () => {
    lookupWarehouseProductByBarcodeApi.mockRejectedValue({ status: 404 });
    fetchProductsApi.mockResolvedValue({ results: [] });
    getProductByBarcodeApi.mockResolvedValue({
      id: "69417210-e4c7-4028-8949-d78b7f9a817c",
      name: "Кока Кола (ПЭТ) 2л",
    });

    const result = await lookupMarketWarehouseProductByBarcode("487000123");

    expect(result.source).toBe(WAREHOUSE_BARCODE_SOURCE.global);
    expect(result.product.id).toBe("69417210-e4c7-4028-8949-d78b7f9a817c");
    expect(isCompanyWarehouseBarcodeProduct(result)).toBe(false);
  });

  it("prefers company alternate barcode over global catalog", async () => {
    lookupWarehouseProductByBarcodeApi.mockRejectedValue({ status: 404 });
    fetchProductsApi.mockResolvedValue({
      results: [
        {
          id: "local-alt",
          barcode: "111",
          alternate_barcodes: ["487000123"],
          name: "Локальный с доп. кодом",
        },
      ],
    });

    const result = await lookupMarketWarehouseProductByBarcode("487000123");

    expect(result).toEqual({
      product: {
        id: "local-alt",
        barcode: "111",
        alternate_barcodes: ["487000123"],
        name: "Локальный с доп. кодом",
      },
      source: WAREHOUSE_BARCODE_SOURCE.alternate,
    });
    expect(getProductByBarcodeApi).not.toHaveBeenCalled();
    expect(isCompanyWarehouseBarcodeProduct(result)).toBe(true);
  });
});
