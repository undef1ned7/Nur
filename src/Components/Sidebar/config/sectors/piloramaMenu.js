import { menuIcons } from "../menuIcons";

export const piloramaMenu = [
      {
        label: "Склад",
        to: "/crm/pilorama/warehouse",
        icon: menuIcons.warehouse,
        permission: "can_view_products",
        implemented: true,
      },
      {
        label: "Водители",
        to: "/crm/production/agents",
        icon: menuIcons.filePerson,
        permission: "can_view_agent",
        implemented: true,
      },
    ];
