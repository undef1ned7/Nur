import { menuIcons } from "../menuIcons";

export const schoolMenu = [
      {
        label: "Ученики",
        to: "/crm/school/students",
        icon: menuIcons.filePerson,
        permission: "can_view_school_students",
        implemented: true,
      },
      {
        label: "Направления",
        to: "/crm/school/groups",
        icon: menuIcons.listAlt,
        permission: "can_view_school_groups",
        implemented: true,
      },
      {
        label: "Уроки",
        to: "/crm/school/lessons",
        icon: menuIcons.calendar,
        permission: "can_view_school_lessons",
        implemented: true,
      },
      {
        label: "Сотрудники",
        to: "/crm/school/teachers",
        icon: menuIcons.user,
        permission: "can_view_school_teachers",
        implemented: true,
      },
      {
        label: "Заявки",
        to: "/crm/school/leads",
        icon: menuIcons.comments,
        permission: "can_view_school_leads",
        implemented: true,
      },
      {
        label: "Аналитика",
        to: "/crm/school/invoices",
        icon: menuIcons.clipboard,
        permission: "can_view_school_invoices",
        implemented: true,
      },
    ];
