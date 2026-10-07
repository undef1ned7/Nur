import { describe, it, expect, vi } from "vitest";
import { dedupeRequest } from "./dedupeRequest";

describe("dedupeRequest", () => {
  it("параллельные вызовы с одним ключом делают один запрос", async () => {
    const request = vi.fn(() => Promise.resolve({ data: 1 }));
    const [a, b] = await Promise.all([
      dedupeRequest("k", request),
      dedupeRequest("k", request),
    ]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("после завершения ключ освобождается", async () => {
    const request = vi.fn(() => Promise.resolve(1));
    await dedupeRequest("k2", request);
    await dedupeRequest("k2", request);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("ошибку получают все ожидающие, ключ освобождается", async () => {
    const request = vi.fn(() => Promise.reject(new Error("fail")));
    const results = await Promise.allSettled([
      dedupeRequest("k3", request),
      dedupeRequest("k3", request),
    ]);
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    await dedupeRequest("k3", () => Promise.resolve(2));
  });
});
