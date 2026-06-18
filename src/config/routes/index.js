import { commonRoutes } from "./commonRoutes";
import { barberRoutes } from "./barberRoutes";
import { marketRoutes } from "./marketRoutes";
import { cafeRoutes } from "./cafeRoutes";
import { buildingRoutes } from "./buildingRoutes";
import { warehouseRoutes } from "./warehouseRoutes";
import { productionRoutes } from "./productionRoutes";
import { schoolRoutes } from "./schoolRoutes";
import { hostelRoutes } from "./hostelRoutes";
import { consultingRoutes } from "./consultingRoutes";
import { logisticsRoutes } from "./logisticsRoutes";
import { piloramaRoutes } from "./piloramaRoutes";

export const crmRoutes = (profile, sector = "") => [
  ...commonRoutes(profile, sector),
  ...barberRoutes(profile),
  ...hostelRoutes(profile),
  ...schoolRoutes(profile),
  ...marketRoutes(profile),
  ...buildingRoutes(profile),
  ...cafeRoutes(profile),
  ...consultingRoutes(profile),
  ...warehouseRoutes(profile),
  ...productionRoutes(profile),
  ...piloramaRoutes(profile),
  ...logisticsRoutes(profile),
];

export default crmRoutes;
