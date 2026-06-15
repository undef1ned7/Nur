import { describe, expect, it } from "vitest";
import {
  mapCartTabFromApi,
  mapCartTabsFromApi,
  normalizePosStartResponse,
  buildPosStartPayload,
  getMainCartSaleId,
} from "./posSaleCarts";

describe("posSaleCarts", () => {
  describe("mapCartTabFromApi", () => {
    it("maps API cart tab fields", () => {
      expect(
        mapCartTabFromApi({
          id: 5,
          label: "Корзина 1",
          is_default: true,
          items_count: 3,
          total: "150.00",
        }),
      ).toEqual({
        saleId: "5",
        label: "Корзина 1",
        isMain: true,
        itemCount: 3,
        total: "150.00",
        status: "open",
      });
    });

    it("returns null for invalid input", () => {
      expect(mapCartTabFromApi(null)).toBeNull();
      expect(mapCartTabFromApi({})).toBeNull();
    });
  });

  describe("normalizePosStartResponse", () => {
    it("normalizes multi-cart start response", () => {
      const result = normalizePosStartResponse({
        sale: { id: 1, items: [] },
        carts: [
          { id: 1, is_default: true, items_count: 0 },
          { id: 2, is_default: false, items_count: 1 },
        ],
        active_sale_id: 1,
      });

      expect(result.activeSaleId).toBe("1");
      expect(result.carts).toHaveLength(2);
      expect(result.sale).toEqual({ id: 1, items: [] });
    });

    it("returns empty state for invalid data", () => {
      expect(normalizePosStartResponse(null)).toEqual({
        sale: null,
        carts: [],
        activeSaleId: null,
      });
    });
  });

  describe("buildPosStartPayload", () => {
    it("normalizes numeric discount shorthand", () => {
      expect(buildPosStartPayload(10)).toEqual({ order_discount_total: 10 });
    });

    it("maps sale_id and is_new flags", () => {
      expect(
        buildPosStartPayload({
          discount_total: 5,
          saleId: 42,
          isNew: true,
          shift: 7,
        }),
      ).toEqual({
        order_discount_total: 5,
        sale_id: 42,
        is_new: true,
        shift: 7,
      });
    });
  });

  describe("getMainCartSaleId", () => {
    it("prefers main cart id", () => {
      expect(
        getMainCartSaleId([
          { saleId: "2", isMain: false },
          { saleId: "1", isMain: true },
        ]),
      ).toBe("1");
    });

    it("falls back to first cart", () => {
      expect(getMainCartSaleId([{ saleId: "9", isMain: false }])).toBe("9");
    });
  });

  describe("mapCartTabsFromApi", () => {
    it("filters invalid entries", () => {
      expect(
        mapCartTabsFromApi([{ id: 1, is_default: true }, null, {}]),
      ).toHaveLength(1);
    });
  });
});
