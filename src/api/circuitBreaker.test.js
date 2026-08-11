import { describe, expect, it, beforeEach } from "vitest";
import {
  _resetCircuitStateForTests,
  circuitKey,
  createCircuitRequestInterceptor,
  isDeadCatalogPath,
  noteCircuitFailure,
} from "./circuitBreaker";

describe("circuitBreaker", () => {
  beforeEach(() => {
    _resetCircuitStateForTests();
  });

  it("detects dead catalog paths", () => {
    expect(isDeadCatalogPath("main/products/catalog-meta/")).toBe(true);
    expect(isDeadCatalogPath("/main/products/meta/")).toBe(true);
    expect(isDeadCatalogPath("main/catalog/version/")).toBe(true);
    expect(isDeadCatalogPath("main/products/list/")).toBe(false);
  });

  it("blocks dead catalog paths on request", async () => {
    const intercept = createCircuitRequestInterceptor();
    await expect(
      Promise.resolve(
        intercept({ method: "get", url: "main/products/catalog-meta/" }),
      ),
    ).rejects.toMatchObject({ code: "ERR_DEAD_CATALOG" });
  });

  it("opens circuit after repeated 404", async () => {
    const intercept = createCircuitRequestInterceptor();
    const config = { method: "get", url: "cafe/orders/999/" };
    for (let i = 0; i < 3; i += 1) {
      noteCircuitFailure(config, 404);
    }
    expect(circuitKey(config)).toContain("cafe/orders/999/");
    await expect(
      Promise.resolve(intercept(config)),
    ).rejects.toMatchObject({ code: "ERR_CIRCUIT_OPEN" });
  });
});
