import { menuIcons } from "../menuIcons";

export const productionMenu = [
      {
        label: "Аналитика",
        to: "/crm/production/analytics",
        icon: menuIcons.chartBar,
        permission: "can_view_analytics",
        implemented: true,
      },
      {
        label: "Склад",
        to: "/crm/production/warehouse",
        icon: menuIcons.warehouse,
        permission: "can_view_products",
        implemented: true,
      },
      {
        label: "Продажи",
        to: "/crm/production/sell",
        icon: menuIcons.shoppingCart,
        permission: "can_view_sale",
        implemented: true,
      },

      {
        label: "Передача",
        to: "/crm/production/agents",
        icon: menuIcons.filePerson,
        permission: "can_view_agent",
        implemented: true,
      },
      {
        label: "Поставщики",
        to: "/crm/production/suppliers",
        icon: menuIcons.filePerson,
        permission: "can_view_market_supplier",
        implemented: true,
      },
      {
        label: "Каталог",
        to: "/crm/production/catalog",
        icon: menuIcons.layers,
        permission: "can_view_catalog",
        implemented: true,
      },
      {
        label: "Запросы",
        to: "/crm/production/request",
        icon: menuIcons.clipboardList,
        permission: "can_view_request",
        implemented: true,
      },
    ];
