import { describe, expect, it, vi, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import {
  fetchOrdersAsync,
  createOrderAsync,
  deleteOrderAsync,
} from "./orderCreators";
import orderReducer from "../slices/orderSlice";

vi.mock("../../api/orders", () => ({
  fetchOrdersApi: vi.fn(),
  fetchOrderByIdApi: vi.fn(),
  createOrderApi: vi.fn(),
  deleteOrderApi: vi.fn(),
  updateOrderApi: vi.fn(),
  fetchSalesHistoryApi: vi.fn(),
}));

import {
  fetchOrdersApi,
  createOrderApi,
  deleteOrderApi,
} from "../../api/orders";

const createTestStore = () =>
  configureStore({
    reducer: { order: orderReducer },
  });

describe("orderCreators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchOrdersAsync", () => {
    it("returns orders on success", async () => {
      const orders = { results: [{ id: 1 }], count: 1 };
      fetchOrdersApi.mockResolvedValue(orders);

      const store = createTestStore();
      const result = await store.dispatch(fetchOrdersAsync({ page: 1 }));

      expect(result.type).toBe("orders/fetchOrders/fulfilled");
      expect(result.payload).toEqual(orders);
      expect(fetchOrdersApi).toHaveBeenCalledWith({ page: 1 });
    });

    it("rejects with error message on failure", async () => {
      fetchOrdersApi.mockRejectedValue({
        response: { data: { detail: "Network error" } },
      });

      const store = createTestStore();
      const result = await store.dispatch(fetchOrdersAsync());

      expect(result.type).toBe("orders/fetchOrders/rejected");
      expect(result.payload).toBe("Network error");
    });
  });

  describe("createOrderAsync", () => {
    it("returns created order on success", async () => {
      const newOrder = { id: 42, status: "new" };
      createOrderApi.mockResolvedValue(newOrder);

      const store = createTestStore();
      const result = await store.dispatch(createOrderAsync({ items: [] }));

      expect(result.type).toBe("orders/createOrder/fulfilled");
      expect(result.payload).toEqual(newOrder);
    });
  });

  describe("deleteOrderAsync", () => {
    it("returns deleted order id on success", async () => {
      deleteOrderApi.mockResolvedValue(undefined);

      const store = createTestStore();
      const result = await store.dispatch(deleteOrderAsync(7));

      expect(result.type).toBe("orders/deleteOrder/fulfilled");
      expect(result.payload).toBe(7);
    });
  });
});
