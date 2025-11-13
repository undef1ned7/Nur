import React from "react";
import {
  FaCalendarAlt,
  FaCut,
  FaUserTie,
  FaBed,
  FaBook,
  FaUsers,
  FaClipboardList,
  FaCheckSquare,
} from "react-icons/fa";
export function getSectorMenu(sector) {
  if (sector === "barber") {
    return [
      {
        label: "Запись",
        to: "/crm/barber/appointments",
        icon: <FaCalendarAlt className="sidebar__menu-icon" />,
      },
      {
        label: "Услуги",
        to: "/crm/barber/services",
        icon: <FaCut className="sidebar__menu-icon" />,
      },
      {
        label: "Мастера",
        to: "/crm/barber/masters",
        icon: <FaUserTie className="sidebar__menu-icon" />,
      },
    ];
  }
  if (sector === "hostel") {
    return [
      {
        label: "Комнаты",
        to: "/crm/hostel/rooms",
        icon: <FaBed className="sidebar__menu-icon" />,
      },
      {
        label: "Заезды",
        to: "/crm/hostel/bookings",
        icon: <FaClipboardList className="sidebar__menu-icon" />,
      },
    ];
  }
  if (sector === "school") {
    return [
      {
        label: "Ученики",
        to: "/crm/school/students",
        icon: <FaUsers className="sidebar__menu-icon" />,
      },
      {
        label: "Группы",
        to: "/crm/school/groups",
        icon: <FaUsers className="sidebar__menu-icon" />,
      },
      {
        label: "Уроки",
        to: "/crm/school/lessons",
        icon: <FaBook className="sidebar__menu-icon" />,
      },
      {
        label: "Посещаемость",
        to: "/crm/school/attendance",
        icon: <FaCheckSquare className="sidebar__menu-icon" />,
      },
    ];
  }
  return [];
}
