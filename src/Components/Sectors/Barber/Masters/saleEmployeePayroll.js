/** Секторы, где ЗП считается по оплаченным чекам main.Sale (поле user). */
export function isSaleEmployeePayrollSector(sectorName) {
  const s = String(sectorName || "").trim();
  return s === "Маркет" || s === "Магазин" || s === "Производство";
}

export function employPayrollDetailPath(sectorName, employeeId) {
  if (!employeeId) return null;
  const s = String(sectorName || "").trim();
  if (s === "Производство") return `/crm/employ/production/${employeeId}`;
  if (s === "Маркет" || s === "Магазин") return `/crm/employ/market/${employeeId}`;
  return null;
}

export function salePayrollSectorEmoji(sectorName) {
  const s = String(sectorName || "").trim();
  if (s === "Производство") return "🏭";
  return "🛒";
}
