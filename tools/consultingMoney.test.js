import { describe, expect, it, vi } from "vitest";
import {
  isConsultingCashV2,
  mapDealStatusToPaymentMode,
  TENANT_PROVISION_LABELS,
} from "../src/utils/consultingMoney.js";

describe("consultingMoney", () => {
  it("defaults cash v2 to enabled", () => {
    vi.stubEnv("VITE_CONSULTING_CASH_V2", "");
    expect(isConsultingCashV2()).toBe(true);
    vi.unstubAllEnvs();
  });

  it("respects explicit false for cash v2", () => {
    vi.stubEnv("VITE_CONSULTING_CASH_V2", "false");
    expect(isConsultingCashV2()).toBe(false);
    vi.unstubAllEnvs();
  });

  it("maps deal status ru to payment_mode", () => {
    expect(mapDealStatusToPaymentMode("Долги")).toBe("debt");
    expect(mapDealStatusToPaymentMode("Предоплата")).toBe("installment");
    expect(mapDealStatusToPaymentMode("Продажа")).toBe("cash");
  });

  it("exposes tenant provision labels", () => {
    expect(TENANT_PROVISION_LABELS.created).toBe("Аккаунт создан");
  });
});
