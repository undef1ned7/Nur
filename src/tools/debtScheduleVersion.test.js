import { beforeEach, describe, expect, it } from "vitest";
import {
  debtScheduleV2MigratedKey,
  hasMigratedDebtScheduleToV2,
  isDebtScheduleV2,
  markMigratedDebtScheduleToV2,
  parseDebtScheduleVersion,
  shouldUpgradeDebtScheduleToV2,
} from "./debtScheduleVersion";

describe("parseDebtScheduleVersion", () => {
  it("defaults this frontend to v2 when the field is missing", () => {
    expect(parseDebtScheduleVersion(undefined)).toBe("v2");
    expect(parseDebtScheduleVersion(null)).toBe("v2");
    expect(parseDebtScheduleVersion("")).toBe("v2");
    expect(isDebtScheduleV2(undefined)).toBe(true);
  });

  it("treats only explicit v1 as classic", () => {
    expect(parseDebtScheduleVersion("v1")).toBe("v1");
    expect(parseDebtScheduleVersion("1")).toBe("v1");
    expect(isDebtScheduleV2("v1")).toBe(false);
  });

  it("treats v2 aliases as the schedule UI", () => {
    expect(parseDebtScheduleVersion("v2")).toBe("v2");
    expect(parseDebtScheduleVersion("V2")).toBe("v2");
    expect(parseDebtScheduleVersion("2")).toBe("v2");
    expect(isDebtScheduleV2("v2")).toBe(true);
  });
});

describe("shouldUpgradeDebtScheduleToV2", () => {
  it("upgrades missing and v1, leaves explicit v2", () => {
    expect(shouldUpgradeDebtScheduleToV2(undefined)).toBe(true);
    expect(shouldUpgradeDebtScheduleToV2(null)).toBe(true);
    expect(shouldUpgradeDebtScheduleToV2("")).toBe(true);
    expect(shouldUpgradeDebtScheduleToV2("v1")).toBe(true);
    expect(shouldUpgradeDebtScheduleToV2("1")).toBe(true);
    expect(shouldUpgradeDebtScheduleToV2("v2")).toBe(false);
    expect(shouldUpgradeDebtScheduleToV2("2")).toBe(false);
  });
});

describe("debt schedule v2 migration flag", () => {
  const companyId = 11;

  beforeEach(() => {
    localStorage.removeItem(debtScheduleV2MigratedKey(companyId));
  });

  it("stores a one-time migrate marker per company", () => {
    expect(hasMigratedDebtScheduleToV2(companyId)).toBe(false);
    markMigratedDebtScheduleToV2(companyId);
    expect(hasMigratedDebtScheduleToV2(companyId)).toBe(true);
  });
});
