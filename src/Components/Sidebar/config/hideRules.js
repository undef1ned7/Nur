/**
 * Правила скрытия пунктов меню в зависимости от тарифа и сектора
 */
export const HIDE_RULES = [
  // Всегда скрываем "Отделы"
  {
    when: {}, // Пустое условие означает "всегда"
    hide: {
      labels: ["Отделы", "Обзор"],
    },
  },
  {
    when: { tariff: "Старт" },
    hide: {
      labels: [
        "Обзор",
        "Закупки",
        "Сотрудники",
        "Бронирование",
        "Клиенты",
        "Отделы",
        "Аналитика Отделов",
        "Филиалы",
      ],
    },
  },

  {
    when: { tariff: "Прайм" },
    hide: {
      toIncludes: ["/crm/debts"],
    },
  },
  {
    when: { tariff: "Стандарт" },
    hide: {
      labels: ["Филиалы"],
      toIncludes: ["/crm/debts"],
    },
  },
  {
    when: { sector: "Кафе" },
    hide: {
      toIncludes: [
        "/crm/zakaz",
        "/crm/cafe/analytics",
        "/crm/kassa",
        "/crm/cafe/reports",
        "/crm/sell",
        "/crm/cafe/payroll",
        "/crm/obzor",
        "/crm/raspisanie",
        "/crm/sklad",
        "/crm/cafe/reservation",
        "/crm/cafe/purchasing",
        "/crm/analytics",
        "/crm/debts",
      ],
    },
    show: { toIncludes: ["/crm/sklad"] },
  },
  {
    when: { sector: "Гостиница" },
    hide: {
      toIncludes: [
        "crm/analytics",
        "/crm/hostel/clients",
        "/crm/hostel/bar",
        "/crm/zakaz",
        "/crm/hostel/obzor",
        "/crm/kassa",
        "/crm/sell",
        "/crm/obzor",
        "/crm/raspisanie",
        "/crm/hostel/analytics",
        "/crm/debts",
      ],
    },
  },
  {
    when: { sector: "Барбершоп" },
    hide: {
      toIncludes: [
        "crm/employ",
        "crm/clients",
        "crm/analytics",
        "/crm/brand-category",
        "/crm/obzor",
        "/crm/zakaz",
        "crm/raspisanie",
        "/crm/debts",
        "/crm/sklad",
      ],
    },
  },
  {
    when: { sector: "Школа" },
    hide: {
      toIncludes: [
        "/crm/zakaz",
        "/crm/obzor",
        "crm/clients",
        "crm/analytics",
        "crm/employ",
        "crm/kassa",
        "crm/raspisanie",
        "/crm/debts",
      ],
    },
  },
  {
    when: { sector: "Магазин" },
    hide: {
      toIncludes: [
        "/crm/obzor",
        "/crm/zakaz",
        "/crm/market/bar",
        "/crm/market/history",
        "/crm/raspisanie",
        "/crm/analytics",
      ],
    },
  },
  {
    when: { sector: "Строительная компания" },
    hide: {
      toIncludes: ["/crm/debts", "/crm/obzor", "/crm/branch"],
    },
  },
  {
    when: { sector: "Консалтинг" },
    hide: {
      toIncludes: [
        "/crm/debts",
        "/crm/obzor",
        "/crm/brand-category",
        "/crm/clients",
        "/crm/sell",
        "/crm/employ",
        "/crm/sklad",
        "/crm/zakaz",
        "/crm/analytics",
        "/crm/consulting/kassa",
        "/crm/raspisanie",
      ],
    },
  },
  {
    when: { sector: "Склад" },
    hide: {
      toIncludes: [
        "/crm/debts",
        "/crm/obzor",
        "/crm/brand-category",
        "/crm/clients",
        "/crm/sell",
        "/crm/sklad",
        "/crm/zakaz",
        "/crm/analytics",
        "/crm/raspisanie",
      ],
    },
  },
  {
    when: { sector: "Производство" },
    hide: {
      toIncludes: [
        "/crm/debts",
        "/crm/obzor",
        "/crm/zakaz",
        "/crm/sklad",
        "/crm/raspisanie",
      ],
    },
  },
  {
    when: { sector: "Пилорама" },
    hide: {
      toIncludes: [
        "/crm/debts",
        "/crm/obzor",
        "/crm/zakaz",
        "/crm/sklad",
        "/crm/sell",
        "/crm/raspisanie",
        "/crm/brand-category",
      ],
    },
  },
  {
    when: { sector: "Логистика" },
    hide: {
      toIncludes: [
        "/crm/debts",
        "/crm/obzor",
        "/crm/zakaz",
        "/crm/sell",
        "/crm/sklad",
        "/crm/brand-category",
      ],
    },
  },
];
