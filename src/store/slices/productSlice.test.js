import { describe, expect, it } from "vitest";
import {
  createProductAsync,
  fetchProductsAsync,
} from "../creators/productCreators";
import reducer from "./productSlice";

describe("productSlice product list freshness", () => {
  it("ignores an older products request that finishes last", () => {
    let state = reducer(undefined, fetchProductsAsync.pending("old", { page: 1 }));
    state = reducer(state, fetchProductsAsync.pending("new", { page: 2 }));
    state = reducer(
      state,
      fetchProductsAsync.fulfilled(
        { results: [{ id: "new" }], count: 1 },
        "new",
        { page: 2 },
      ),
    );
    state = reducer(
      state,
      fetchProductsAsync.fulfilled(
        { results: [{ id: "old" }], count: 1 },
        "old",
        { page: 1 },
      ),
    );

    expect(state.list).toEqual([{ id: "new" }]);
  });

  it("invalidates cached pages after creating a product", () => {
    const cachedState = {
      ...reducer(undefined, { type: "init" }),
      productsCache: {
        page1: {
          list: [{ id: "old" }],
          timestamp: Date.now(),
        },
      },
    };

    const state = reducer(
      cachedState,
      createProductAsync.fulfilled({ id: "created" }, "create", {}),
    );

    expect(state.productsCache).toEqual({});
    expect(state.list[0]).toEqual({ id: "created" });
  });
});
