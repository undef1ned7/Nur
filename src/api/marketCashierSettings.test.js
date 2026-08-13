import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./index", () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

import api from "./index";
import { ensureMarketDebtScheduleV2 } from "./marketCashierSettings";
import {
  debtScheduleV2MigratedKey,
  hasMigratedDebtScheduleToV2,
} from "../tools/debtScheduleVersion";

const COMPANY_ID = 7;

describe("ensureMarketDebtScheduleV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem(debtScheduleV2MigratedKey(COMPANY_ID));
  });

  it("does not PATCH when backend already returns v2", async () => {
    const data = { debt_schedule_version: "v2", max_discount_percent: null };
    await expect(
      ensureMarketDebtScheduleV2(data, COMPANY_ID, { canWrite: true }),
    ).resolves.toBe(data);
    expect(api.patch).not.toHaveBeenCalled();
    expect(hasMigratedDebtScheduleToV2(COMPANY_ID)).toBe(true);
  });

  it("PATCHes v1 / missing field to v2 on first open", async () => {
    api.patch.mockResolvedValue({
      data: { debt_schedule_version: "v2" },
    });

    await expect(
      ensureMarketDebtScheduleV2({ debt_schedule_version: "v1" }, COMPANY_ID, {
        canWrite: true,
      }),
    ).resolves.toEqual({ debt_schedule_version: "v2" });

    expect(api.patch).toHaveBeenCalledWith("/main/pos/cashier-settings/", {
      debt_schedule_version: "v2",
    });
    expect(hasMigratedDebtScheduleToV2(COMPANY_ID)).toBe(true);
  });

  it("does not PATCH again after a successful migrate, even if server is v1", async () => {
    api.patch.mockResolvedValue({ data: { debt_schedule_version: "v2" } });
    await ensureMarketDebtScheduleV2({ debt_schedule_version: "v1" }, COMPANY_ID, {
      canWrite: true,
    });
    api.patch.mockClear();

    const later = { debt_schedule_version: "v1" };
    await expect(
      ensureMarketDebtScheduleV2(later, COMPANY_ID, { canWrite: true }),
    ).resolves.toBe(later);
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("does not PATCH when the user cannot write; UI still uses v2", async () => {
    await expect(
      ensureMarketDebtScheduleV2({ debt_schedule_version: "v1" }, COMPANY_ID, {
        canWrite: false,
      }),
    ).resolves.toEqual({ debt_schedule_version: "v2" });
    expect(api.patch).not.toHaveBeenCalled();
    expect(hasMigratedDebtScheduleToV2(COMPANY_ID)).toBe(false);
  });
});
