import { describe, expect, it, vi, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { startSale, createDeal, sendBarCode } from "./saleThunk";
import saleReducer from "../slices/saleSlice";

vi.mock("../../api", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../../tools/posSaleCarts", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    buildPosStartPayload: vi.fn((...args) => actual.buildPosStartPayload(...args)),
    getMainCartSaleId: vi.fn((...args) => actual.getMainCartSaleId(...args)),
  };
});

import api from "../../api";
import { buildPosStartPayload } from "../../../tools/posSaleCarts";

const createTestStore = (preloadedState) =>
  configureStore({
    reducer: { sale: saleReducer, user: () => ({ profile: { role: "owner" } }) },
    preloadedState,
  });

describe("saleThunk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("startSale", () => {
    it("posts POS start payload and returns sale data", async () => {
      const saleData = { id: 1, status: "open" };
      buildPosStartPayload.mockReturnValue({ order_discount_total: 0 });
      api.post.mockResolvedValue({ data: saleData });

      const store = createTestStore();
      const result = await store.dispatch(startSale({ discount_total: 0 }));

      expect(buildPosStartPayload).toHaveBeenCalledWith({ discount_total: 0 });
      expect(api.post).toHaveBeenCalledWith("/main/pos/sales/start/", {
        order_discount_total: 0,
      });
      expect(result.type).toBe("sale/start/fulfilled");
      expect(result.payload).toEqual(saleData);
    });

    it("prevents parallel startSale requests while one is in flight", async () => {
      let resolvePost;
      api.post.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePost = () => resolve({ data: { id: 1, status: "open" } });
          }),
      );

      const store = createTestStore();
      const first = store.dispatch(startSale({}));
      const second = store.dispatch(startSale({}));

      expect(api.post).toHaveBeenCalledTimes(1);
      expect(store.getState().sale.startSaleLoading).toBe(true);

      resolvePost();
      await first;
      await second;
    });
  });

  describe("createDeal", () => {
    it("builds prepayment deal payload", async () => {
      api.post.mockResolvedValue({ data: { id: 99 } });

      const store = createTestStore();
      const result = await store.dispatch(
        createDeal({
          clientId: 5,
          title: "  Сделка  ",
          statusRu: "Предоплата",
          amount: "1 000,50",
          prepayment: "200",
        }),
      );

      expect(api.post).toHaveBeenCalledWith("/main/clients/5/deals/", {
        title: "Сделка",
        kind: "prepayment",
        amount: "1000.50",
        note: "",
        client: 5,
        prepayment: "200.00",
      });
      expect(result.type).toBe("deals/create/fulfilled");
    });

    it("builds debt deal payload with schedule", async () => {
      api.post.mockResolvedValue({ data: { id: 100 } });

      const store = createTestStore();
      const result = await store.dispatch(
        createDeal({
          clientId: 5,
          title: "Долг",
          statusRu: "Долг",
          amount: "30",
          debtDays: 30,
          prepayment: "0",
          first_due_date: "2026-07-01",
        }),
      );

      expect(api.post).toHaveBeenCalledWith("/main/clients/5/deals/", {
        title: "Долг",
        kind: "debt",
        amount: "30.00",
        note: "",
        client: 5,
        debt_days: 30,
        prepayment: "0.00",
        first_due_date: "2026-07-01",
        auto_schedule: true,
      });
      expect(result.type).toBe("deals/create/fulfilled");
    });

    it("maps plain sale status to kind sale", async () => {
      api.post.mockResolvedValue({ data: { id: 1 } });

      const store = createTestStore();
      await store.dispatch(
        createDeal({
          clientId: 1,
          title: "Sale",
          statusRu: "Продажа",
          amount: 500,
        }),
      );

      expect(api.post).toHaveBeenCalledWith(
        "/main/clients/1/deals/",
        expect.objectContaining({ kind: "sale", amount: "500.00" }),
      );
    });
  });

  describe("sendBarCode", () => {
    it("rejects when no cart is selected", async () => {
      const store = createTestStore({
        sale: { posCarts: [], start: null, activeSaleId: null },
      });

      const result = await store.dispatch(
        sendBarCode({ barcode: "1234567890" }),
      );

      expect(result.type).toBe("products/sendBarcode/rejected");
      expect(result.payload).toEqual({
        message: "Не выбрана корзина для сканирования",
      });
    });

    it("scans barcode against active sale", async () => {
      api.post.mockResolvedValue({ data: { item_added: true } });

      const store = createTestStore({
        sale: {
          posCarts: [{ saleId: "10", isMain: true }],
          activeSaleId: "10",
          start: { id: 10 },
        },
      });

      const result = await store.dispatch(
        sendBarCode({ barcode: "4601234567890" }),
      );

      expect(api.post).toHaveBeenCalledWith("/main/pos/sales/10/scan/", {
        barcode: "4601234567890",
      });
      expect(result.type).toBe("products/sendBarcode/fulfilled");
    });
  });
});
