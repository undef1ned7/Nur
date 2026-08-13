import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./index", () => ({
  default: {
    get: vi.fn(),
  },
}));

import api from "./index";
import { CLIENT_KPIS_URL, fetchClientKpis } from "./clients";

describe("fetchClientKpis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests GET /main/clients/{id}/kpis/ and maps nested buckets", async () => {
    api.get.mockResolvedValue({
      data: {
        debt: { amount: "1200.50", count: 2 },
        prepayment: { amount: "300.00", count: 1 },
        sale: { amount: "4500.00", count: 4 },
      },
    });

    await expect(fetchClientKpis(42)).resolves.toEqual({
      debt: { amount: 1200.5, count: 2 },
      prepayment: { amount: 300, count: 1 },
      sale: { amount: 4500, count: 4 },
    });
    expect(api.get).toHaveBeenCalledWith(CLIENT_KPIS_URL(42));
    expect(CLIENT_KPIS_URL(42)).toBe("/main/clients/42/kpis/");
  });

  it("unwraps { kpis: ... } payloads", async () => {
    api.get.mockResolvedValue({
      data: {
        kpis: {
          remaining_debt: "10.00",
          debt_count: 3,
          prepayment_amount: "4.5",
          prepayment_count: 1,
          sales_total: "99",
          sales_count: 8,
        },
      },
    });

    await expect(fetchClientKpis("abc")).resolves.toEqual({
      debt: { amount: 10, count: 3 },
      prepayment: { amount: 4.5, count: 1 },
      sale: { amount: 99, count: 8 },
    });
  });
});
