/**
 * Maps backend company.sector.name to route/menu config slug.
 * Mirrors mapping in useMenuItems.js.
 */
export const mapSectorNameToSlug = (sectorName) => {
  if (!sectorName) return null;

  const sectorKey = String(sectorName).toLowerCase().replace(/\s+/g, "_");

  const sectorMapping = {
    строительная_компания: "building",
    ремонтные_и_отделочные_работы: "building",
    архитектура_и_дизайн: "building",
    барбершоп: "barber",
    услуги: "services",
    services: "services",
    стоматология: "dentistry",
    dentistry: "dentistry",
    гостиница: "hostel",
    школа: "school",
    магазин: "market",
    кафе: "cafe",
    цветочный_магазин: "market",
    производство: "production",
    консалтинг: "consulting",
    склад: "warehouse",
    пилорама: "pilorama",
    логистика: "logistics",
  };

  return sectorMapping[sectorKey] || sectorKey;
};

export const isBuildingSector = (sectorName) =>
  mapSectorNameToSlug(sectorName) === "building";
