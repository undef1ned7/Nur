/**
 * Тариф «Старт» — ограниченный набор функций (см. useMenuItems, hideRules).
 */
export function isStartPlan(tariffName) {
  const t = String(tariffName || "")
    .trim()
    .toLowerCase();
  return t === "старт" || t === "start";
}
