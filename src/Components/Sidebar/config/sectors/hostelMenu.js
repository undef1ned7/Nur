import { menuIcons } from "../menuIcons";

export const hostelMenu = [
      {
        label: "Комнаты",
        to: "/crm/hostel/rooms",
        icon: menuIcons.listAlt,
        permission: "can_view_hostel_rooms",
        implemented: true,
      },
      {
        label: "Бронирования",
        to: "/crm/hostel/bookings",
        icon: menuIcons.calendar,
        permission: "can_view_hostel_booking",
        implemented: true,
      },
      {
        label: "Бар",
        to: "/crm/hostel/bar",
        icon: menuIcons.clipboard,
        permission: "can_view_booking",
        implemented: true,
      },
      {
        label: "Клиенты",
        to: "/crm/hostel/clients",
        icon: menuIcons.filePerson,
        permission: "can_view_hostel_clients",
        implemented: true,
      },
      {
        label: "Аналитика",
        to: "/crm/hostel/analytics",
        icon: menuIcons.chartBar,
        permission: "can_view_hostel_analytics",
        implemented: true,
      },
      {
        label: "Касса",
        to: "/crm/hostel/kassa",
        icon: menuIcons.landmark,
        permission: "can_view_cashbox",
        implemented: true,
      },
    ];
