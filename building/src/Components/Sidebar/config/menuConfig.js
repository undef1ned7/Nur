/**
 * Конфигурация меню на основе backend permissions
 * Каждый пункт меню привязан к конкретному permission из backend
 */
import { commonMenu } from "./commonMenu";
import { buildingMenu } from "./sectors/buildingMenu";
import { barberSectorMenus } from "./sectors/barberMenu";
import { hostelMenu } from "./sectors/hostelMenu";
import { schoolMenu } from "./sectors/schoolMenu";
import { marketMenu } from "./sectors/marketMenu";
import { cafeMenu } from "./sectors/cafeMenu";
import { consultingMenu } from "./sectors/consultingMenu";
import { warehouseMenu } from "./sectors/warehouseMenu";
import { productionMenu } from "./sectors/productionMenu";
import { piloramaMenu } from "./sectors/piloramaMenu";
import { logisticsMenu } from "./sectors/logisticsMenu";
import { additionalMenu } from "./sectors/additionalMenu";

export const MENU_CONFIG = {
  basic: commonMenu,
  sector: {
    building: buildingMenu,
    ...barberSectorMenus,
    hostel: hostelMenu,
    school: schoolMenu,
    market: marketMenu,
    cafe: cafeMenu,
    consulting: consultingMenu,
    warehouse: warehouseMenu,
    production: productionMenu,
    pilorama: piloramaMenu,
    logistics: logisticsMenu,
  },
  additional: additionalMenu,
};
