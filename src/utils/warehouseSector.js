// Определение сектора «Склад» по названию сектора компании
// (company.sector.name / state.user.sector).
export const isWarehouseSectorName = (sectorName) => {
  const name = String(sectorName || "")
    .toLowerCase()
    .trim();
  if (!name) return false;
  return name.includes("склад") || name.includes("warehouse");
};
