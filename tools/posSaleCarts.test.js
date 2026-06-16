import { describe, expect, it } from "vitest";
import {
  mapCartTabFromApi,
  mapCartTabsFromApi,
  normalizePosStartResponse,
  buildPosStartPayload,
  getMainCartSaleId,
  isCartLineItemResponse,
  applyPosCartItemPatchToState,
  enrichPosSaleResponse,
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

  describe("applyPosCartItemPatchToState", () => {
    const saleId = "e16ac280-be60-4229-aff6-63638810aeb3";

    it("merges add-item line response into active sale", () => {
      const state = {
        activeSaleId: saleId,
        start: {
          id: saleId,
          items: [],
          total: "0",
        },
        posCarts: [{ saleId, isMain: true, itemCount: 0, total: "0" }],
      };

      applyPosCartItemPatchToState(state, {
        id: "line-piece",
        product: "prod-1",
        product_name: "Сигареты",
        quantity: "5.000",
        unit_price: "15.00",
        sale_package: "pkg-1",
        line_total: "75.00",
      });

      applyPosCartItemPatchToState(state, {
        id: "line-pack",
        product: "prod-1",
        product_name: "Сигареты",
        quantity: "1.000",
        unit_price: "300.00",
        sale_package: null,
        line_total: "300.00",
      });

      expect(state.start.items).toHaveLength(2);
      expect(state.start.items[0].sale_package).toBe("pkg-1");
      expect(state.start.items[1].sale_package).toBeNull();
      expect(state.posCarts[0].itemCount).toBe(2);
    });

    it("clears cart when delete returns empty items array", () => {
      const state = {
        activeSaleId: saleId,
        start: {
          id: saleId,
          items: [{ id: "line-1", product: "prod-1", quantity: "1" }],
          total: "100",
        },
        posCarts: [{ saleId, isMain: true, itemCount: 1, total: "100" }],
      };

      applyPosCartItemPatchToState(state, {
        id: saleId,
        items: [],
        total: "0",
      });

      expect(state.start.items).toEqual([]);
      expect(state.posCarts[0].itemCount).toBe(0);
    });

    it("preserves items when start response omits items field", () => {
      const state = {
        activeSaleId: saleId,
        start: {
          id: saleId,
          items: [{ id: "line-1", product: "prod-1", quantity: "1" }],
          total: "100",
        },
        posCarts: [{ saleId, isMain: true, itemCount: 1, total: "100" }],
      };

      applyPosCartItemPatchToState(state, {
        id: saleId,
        total: "100",
        subtotal: "100",
      });

      expect(state.start.items).toHaveLength(1);
    });
  });

  describe("enrichPosSaleResponse", () => {
    it("copies sale_package from added_item into items[]", () => {
      const apiResponse = {
        id: "faab89d4-927f-4efe-bb37-01deb55ec589",
        items: [
          {
            id: "e8f05a75-60f6-4ab0-bda7-743094311a4d",
            product: "303cb660-039e-465d-81b3-392f2f6e6a2a",
            quantity: "20.000",
          },
        ],
        added_item_id: "e8f05a75-60f6-4ab0-bda7-743094311a4d",
        added_item: {
          id: "e8f05a75-60f6-4ab0-bda7-743094311a4d",
          product: "303cb660-039e-465d-81b3-392f2f6e6a2a",
          sale_package: "1f993aad-3cc2-4b0b-a210-86888c066b63",
        },
      };

      const enriched = enrichPosSaleResponse(apiResponse, {
        salePackageId: "1f993aad-3cc2-4b0b-a210-86888c066b63",
      });

      expect(enriched.items[0].sale_package).toBe(
        "1f993aad-3cc2-4b0b-a210-86888c066b63",
      );
    });
  });

  describe("isCartLineItemResponse", () => {
    it("detects cart line payloads", () => {
      expect(
        isCartLineItemResponse({
          id: "line-1",
          product: "prod-1",
          quantity: "1",
        }),
      ).toBe(true);
      expect(
        isCartLineItemResponse({
          id: "e16ac280-be60-4229-aff6-63638810aeb3",
          items: [],
        }),
      ).toBe(false);
    });
  });
});
