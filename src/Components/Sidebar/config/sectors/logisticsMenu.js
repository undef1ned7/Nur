import { menuIcons } from "../menuIcons";

export const logisticsMenu = [
      {
        label: "Логистика",
        to: "/crm/logistics",
        icon: menuIcons.logistics,
        permission: "can_view_logistics",
        implemented: true,
      },
      {
        label: "Аналитика",
        to: "/crm/logistics-analytics",
        icon: menuIcons.chartLine,
        permission: "can_view_analytics",
        implemented: true,
      },
      // {
      //   label: "Магазин",
      //   to: "/crm/logistics-shop",
      //   icon: menuIcons.shopLogistics,
      //   permission: "can_view_catalog",
      //   implemented: true,
      // },
    ];
