/** Хелперы для консультанта на POS-продаже (маркет). */

export const listFrom = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

export function employeeUserId(emp) {
  if (!emp || typeof emp !== "object") return null;
  const id = emp.user_id ?? emp.user ?? emp.id;
  return id != null && id !== "" ? String(id) : null;
}

export function employeeDisplayName(emp) {
  if (!emp || typeof emp !== "object") return "—";
  if (emp.full_name) return String(emp.full_name).trim();
  if (emp.name && !emp.first_name && !emp.last_name) {
    return String(emp.name).trim();
  }
  const first = emp.first_name ?? "";
  const last = emp.last_name ?? "";
  const composed = [last, first].filter(Boolean).join(" ").trim();
  return composed || emp.email || emp.username || "—";
}

export function mapEmployeeOption(emp) {
  const id = employeeUserId(emp);
  if (!id) return null;
  return {
    id,
    name: employeeDisplayName(emp),
    raw: emp,
  };
}

export function parseCommissionPercent(raw) {
  if (raw === "" || raw == null) return null;
  const n = Number(String(raw).replace(",", ".").replace(/\s/g, ""));
  if (!Number.isFinite(n)) return null;
  return n;
}

export function isValidCommissionPercent(n) {
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

export function calcCommissionPreview(total, percent) {
  const t = Number(total) || 0;
  const p = Number(percent);
  if (!Number.isFinite(p) || p <= 0 || t <= 0) return 0;
  return Math.round((t * p) / 100 * 100) / 100;
}

export function formatCommissionMoney(amount) {
  const n = Number(amount) || 0;
  return n.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Берёт sales_percent из профилей оплаты консультанта
 * (схемы percent / salary_plus_percent).
 */
export function pickDefaultSalesPercentFromProfiles(profiles) {
  const list = Array.isArray(profiles) ? profiles : [];
  const preferred = list.find((p) => {
    const scheme = String(p?.pay_scheme || "");
    return scheme === "percent" || scheme === "salary_plus_percent";
  });
  const candidate = preferred || list[0];
  if (!candidate) return null;
  const n = parseCommissionPercent(candidate.sales_percent);
  if (n == null || n <= 0) return null;
  return String(n);
}

/**
 * Поля для checkout. null → не отправлять (продажа без консультанта).
 */
export function buildConsultantCheckoutFields({
  enabled,
  consultantId,
  commissionEnabled,
  commissionPercent,
}) {
  if (!enabled || !consultantId) return null;
  const pctRaw = commissionEnabled
    ? parseCommissionPercent(commissionPercent)
    : 0;
  const pct = commissionEnabled
    ? isValidCommissionPercent(pctRaw)
      ? pctRaw
      : null
    : 0;

  return {
    consultant_id: String(consultantId),
    consultant_commission_enabled: Boolean(commissionEnabled),
    consultant_commission_percent:
      pct == null ? null : Number(pct).toFixed(2),
  };
}
