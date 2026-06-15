import { menuIcons } from "../menuIcons";

export const consultingMenu = [
      {
        label: "Аналитика",
        to: "/crm/consulting/analytics",
        icon: menuIcons.chartBar,
        permission: "can_view_analytics",
        implemented: true,
      },
      {
        label: "Клиенты",
        to: "/crm/consulting/client",
        icon: menuIcons.users,
        permission: "can_view_clients",
        implemented: true,
      },
      {
        label: "Запросы клиентов",
        to: "/crm/consulting/client-requests",
        icon: menuIcons.clipboardList,
        permission: "can_view_client_requests",
        implemented: true,
      },
      {
        label: "Касса",
        to: "/crm/consulting/kassa",
        icon: menuIcons.cashRegister,
        permission: "can_view_cashbox",
        implemented: true,
      },
      {
        label: "Сотрудники",
        to: "/crm/consulting/teachers",
        icon: menuIcons.chalkboard,
        permission: "can_view_employees",
        implemented: true,
      },
      {
        label: "Зарплата",
        to: "/crm/consulting/salary",
        icon: menuIcons.moneyBill,
        permission: "can_view_salary",
        implemented: true,
      },
      {
        label: "Воронка продаж",
        to: "/crm/consulting/funnel",
        icon: menuIcons.layers,
        permission: "can_view_sale",
        implemented: true,
      },
      {
        label: "Продажи",
        to: "/crm/consulting/sale",
        icon: menuIcons.shoppingCart,
        permission: "can_view_sale",
        implemented: true,
      },
      {
        label: "Услуги",
        to: "/crm/consulting/services",
        icon: menuIcons.cogs,
        permission: "can_view_services",
        implemented: true,
      },
      {
        label: "Бронирование",
        to: "/crm/consulting/bookings",
        icon: menuIcons.calendar,
        permission: "can_view_booking",
        implemented: true,
      },
    ];
