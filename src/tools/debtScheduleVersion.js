/** Это приложение — v2. v1 только если настройки явно говорят «v1». */
export const DEFAULT_DEBT_SCHEDULE_VERSION = "v2";

const MIGRATED_KEY_PREFIX = "nur_market_debt_schedule_v2_migrated:";

export function parseDebtScheduleVersion(raw) {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (value === "v1" || value === "1") return "v1";
  return "v2";
}

export function isDebtScheduleV2(version) {
  return parseDebtScheduleVersion(version) === "v2";
}

/** Явный v2 с бэка — не трогаем. Нет поля / v1 / мусор — нужно проставить v2. */
export function shouldUpgradeDebtScheduleToV2(raw) {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (value === "v2" || value === "2") return false;
  return true;
}

export function debtScheduleV2MigratedKey(companyId) {
  return `${MIGRATED_KEY_PREFIX}${companyId || "unknown"}`;
}

export function hasMigratedDebtScheduleToV2(companyId) {
  if (!companyId) return false;
  try {
    return localStorage.getItem(debtScheduleV2MigratedKey(companyId)) === "1";
  } catch {
    return false;
  }
}

export function markMigratedDebtScheduleToV2(companyId) {
  if (!companyId) return;
  try {
    localStorage.setItem(debtScheduleV2MigratedKey(companyId), "1");
  } catch {
    /* ignore quota / private mode */
  }
}
