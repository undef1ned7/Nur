import { describe, expect, it, vi } from "vitest";
import { mapLimited } from "./mapLimited";

describe("mapLimited", () => {
  it("returns empty array for empty input", async () => {
    const mapper = vi.fn();
    await expect(mapLimited([], 5, mapper)).resolves.toEqual([]);
    expect(mapper).not.toHaveBeenCalled();
  });

  it("maps all items preserving order", async () => {
    const result = await mapLimited([1, 2, 3, 4], 2, async (n) => n * 10);
    expect(result).toEqual([10, 20, 30, 40]);
  });

  it("respects concurrency limit", async () => {
    let inflight = 0;
    let maxInflight = 0;
    const result = await mapLimited([1, 2, 3, 4, 5, 6], 2, async (n) => {
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 20));
      inflight -= 1;
      return n;
    });
    expect(result).toEqual([1, 2, 3, 4, 5, 6]);
    expect(maxInflight).toBeLessThanOrEqual(2);
  });
});
