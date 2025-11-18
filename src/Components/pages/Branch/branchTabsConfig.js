/**
 * Конфигурация табов для страницы деталей филиала
 * Позволяет управлять отображением табов в зависимости от сферы и тарифа
 */

// Базовые табы (всегда доступны)
export const BASE_TABS = [
  { id: "kassa", label: "Касса", icon: "cashRegister" },
  { id: "warehouse", label: "Склад", icon: "warehouse" },
  { id: "sales", label: "Продажи", icon: "shoppingCart" },
  { id: "analytics", label: "Аналитика", icon: "chartLine" },
  { id: "employees", label: "Сотрудники", icon: "users" },
  { id: "clients", label: "Клиенты", icon: "userFriends" },
];

/**
 * Правила скрытия/показа табов в зависимости от сферы и тарифа
 *
 * Структура правил:
 * - when: условия (sector, tariff)
 * - hide: что скрыть
 *   - tabIds: ID базовых табов для скрытия
 *   - sectorTabRoutes: маршруты секторных табов для скрытия (например, "/crm/barber/clients")
 * - show: что показать (приоритет над hide)
 *   - tabIds: ID базовых табов для показа
 *   - sectorTabRoutes: маршруты секторных табов для показа
 */
export const BRANCH_TABS_RULES = [
  {
    when: { tariff: "Старт" },
    hide: {
      tabIds: ["analytics", "employees"],
    },
  },
  {
    when: { sector: "Кафе" },
    hide: {
      tabIds: ["sales", "warehouse"],
      sectorTabRoutes: [
        // Пример: скрыть конкретные секторные табы кафе
        // "/crm/cafe/analytics",
      ],
    },
  },
  {
    when: { sector: "Гостиница" },
    hide: {
      tabIds: ["sales"],
      sectorTabRoutes: [
        "/crm/hostel/bar",
        "/crm/hostel/kassa",
        "/crm/hostel/analytics",
        // Пример: скрыть таб "Бар" для гостиницы
        // "/crm/hostel/bar",
      ],
    },
  },
  {
    when: { sector: "Барбершоп" },
    hide: {
      tabIds: ["warehouse"],
      sectorTabRoutes: [
        "/crm/barber/masters",
        "/crm/clients",
        // Пример: скрыть конкретные табы барбершопа
        // "/crm/barber/history",
      ],
    },
  },
  {
    when: { sector: "Школа" },
    hide: {
      tabIds: ["sales", "warehouse", "kassa"],
      sectorTabRoutes: [],
    },
  },
  {
    when: { sector: "Магазин" },
    hide: {
      tabIds: [],
      sectorTabRoutes: [
        "/crm/market/analytics",
        "/crm/market/bar",
        "/crm/market/history",
      ],
    },
  },
  {
    when: { sector: "Строительная компания" },
    hide: {
      tabIds: [],
      sectorTabRoutes: [],
    },
  },
  {
    when: { sector: "Консалтинг" },
    hide: {
      tabIds: ["sales", "warehouse"],
      sectorTabRoutes: ["/crm/consulting/kassa"],
    },
  },
  {
    when: { sector: "Склад" },
    hide: {
      tabIds: ["sales", "kassa"],
      sectorTabRoutes: [],
    },
  },
  {
    when: { sector: "Производство" },
    hide: {
      tabIds: ["sales", "warehouse"],
      sectorTabRoutes: [],
    },
  },
  {
    when: { sector: "Пилорама" },
    hide: {
      tabIds: ["sales"],
      sectorTabRoutes: [],
    },
  },
];

/**
 * Дополнительные табы для конкретных сфер (если нужно добавить специфичные табы)
 */
export const SECTOR_EXTRA_TABS = {
  // Пример: если нужно добавить дополнительные табы для конкретной сферы
  // Кафе: [
  //   { id: "cafe-special", label: "Специальный таб", icon: "special" },
  // ],
};

/**
 * Применяет правила к списку базовых табов
 * @param {Array} tabs - Список базовых табов
 * @param {string} sector - Сфера компании
 * @param {string} tariff - Тариф компании
 * @returns {Array} Отфильтрованный список табов
 */
export const applyBranchTabsRules = (tabs, sector, tariff) => {
  let filteredTabs = [...tabs];

  // Применяем правила скрытия
  BRANCH_TABS_RULES.forEach((rule) => {
    const matchesSector = !rule.when.sector || rule.when.sector === sector;
    const matchesTariff = !rule.when.tariff || rule.when.tariff === tariff;

    if (matchesSector && matchesTariff) {
      if (rule.hide?.tabIds) {
        filteredTabs = filteredTabs.filter(
          (tab) => !rule.hide.tabIds.includes(tab.id)
        );
      }
      if (rule.show?.tabIds) {
        // Показываем только указанные табы
        filteredTabs = filteredTabs.filter((tab) =>
          rule.show.tabIds.includes(tab.id)
        );
      }
    }
  });

  return filteredTabs;
};

/**
 * Применяет правила к списку секторных табов
 * @param {Array} sectorTabs - Список секторных табов
 * @param {string} sector - Сфера компании
 * @param {string} tariff - Тариф компании
 * @returns {Array} Отфильтрованный список секторных табов
 */
export const applySectorTabsRules = (sectorTabs, sector, tariff) => {
  let filteredTabs = [...sectorTabs];

  // Применяем правила скрытия
  BRANCH_TABS_RULES.forEach((rule) => {
    const matchesSector = !rule.when.sector || rule.when.sector === sector;
    const matchesTariff = !rule.when.tariff || rule.when.tariff === tariff;

    if (matchesSector && matchesTariff) {
      if (rule.hide?.sectorTabRoutes) {
        filteredTabs = filteredTabs.filter(
          (tab) => !rule.hide.sectorTabRoutes.includes(tab.route)
        );
      }
      if (rule.show?.sectorTabRoutes) {
        // Показываем только указанные табы
        filteredTabs = filteredTabs.filter((tab) =>
          rule.show.sectorTabRoutes.includes(tab.route)
        );
      }
    }
  });

  return filteredTabs;
};
