/**
 * Тариф «Старт» — ограниченный набор функций (см. useMenuItems, hideRules).
 */
export function isStartPlan(tariffName) {
  const t = String(tariffName || "")
    .trim()
    .toLowerCase();
  return t === "старт" || t === "start";
}

const isMarketSectorName = (sectorName) => {
  const sector = String(sectorName || "")
    .trim()
    .toLowerCase();
  return (
    sector === "магазин" ||
    sector === "цветочный магазин" ||
    sector.includes("магазин")
  );
};

/** Онлайн-витрина на «Старт» в Магазине — только после заявки (can_view_showcase). */
export function isMarketStartShowcaseRequestOnly(tariffName, sectorName) {
  return isStartPlan(tariffName) && isMarketSectorName(sectorName);
}

export function canAccessOnlineShowcase({
  tariffName,
  sectorName,
  isOwner = false,
  canViewShowcase = false,
} = {}) {
  if (isMarketStartShowcaseRequestOnly(tariffName, sectorName)) {
    return Boolean(canViewShowcase);
  }
  return Boolean(isOwner || canViewShowcase);
}
