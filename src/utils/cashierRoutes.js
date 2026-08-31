import { mapSectorNameToSlug } from "./sectorMapping";

/** Сферы, где касса — общий модуль продаж (/crm/sell/start). */
export const SELL_CASHIER_SECTORS = ["barber", "services", "dentistry"];

export const isMarketSector = (sectorName) =>
  mapSectorNameToSlug(sectorName) === "market";

/**
 * Маршрут интерфейса кассира по сфере компании.
 * @param {string|null|undefined} sectorName
 */
export const resolveCashierPath = (sectorName) => {
  const slug = mapSectorNameToSlug(sectorName);
  if (slug === "warehouse") return "/crm/warehouse/kassa";
  if (SELL_CASHIER_SECTORS.includes(slug)) return "/crm/sell/start";
  return "/crm/market/cashier";
};
