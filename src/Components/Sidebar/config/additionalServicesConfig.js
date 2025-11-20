/**
 * Универсальная конфигурация для динамических дополнительных услуг
 * Позволяет добавлять услуги в меню и на страницу AdditionalServices
 */

import { Warehouse, Store } from "lucide-react";
import { FaWarehouse, FaStore } from "react-icons/fa";
import { menuIcons } from "./menuIcons";

/**
 * Условия показа услуги
 * @param {object} params - Параметры для проверки условий
 * @param {string} params.tariff - Текущий тариф
 * @param {string} params.sector - Текущий сектор
 * @param {function} params.hasPermission - Функция проверки прав
 * @param {function} params.isAllowed - Функция проверки доступа (пользователь + компания)
 * @returns {boolean} - Показывать ли услугу
 */
const checkConditions = (conditions, params) => {
  if (!conditions) return true;

  const { tariff, sector, hasPermission, isAllowed, company } = params;

  // Проверка тарифа
  if (conditions.tariff) {
    if (Array.isArray(conditions.tariff)) {
      if (!conditions.tariff.includes(tariff)) return false;
    } else if (conditions.tariff !== tariff) {
      return false;
    }
  }

  // Проверка сектора
  if (conditions.sector) {
    const sectorName = (sector || "").toLowerCase();
    if (Array.isArray(conditions.sector)) {
      if (!conditions.sector.some((s) => s.toLowerCase() === sectorName))
        return false;
    } else if (conditions.sector.toLowerCase() !== sectorName) {
      return false;
    }
  }

  // Проверка прав
  if (conditions.permission) {
    if (!isAllowed(company, conditions.permission)) return false;
  }

  // Пользовательская функция проверки
  if (conditions.customCheck && typeof conditions.customCheck === "function") {
    if (!conditions.customCheck(params)) return false;
  }

  return true;
};

/**
 * Конфигурация динамических дополнительных услуг
 * Каждая услуга может иметь условия показа и метаданные для отображения
 */
export const ADDITIONAL_SERVICES_CONFIG = [
  // Склад для консалтинга
  {
    id: "warehouse",
    label: "Склад",
    to: "/crm/sklad",
    icon: () => <Warehouse className="sidebar__menu-icon" />,
    permission: "can_view_products",
    implemented: true,
    // Условия показа в меню
    conditions: {
      sector: "консалтинг",
      permission: "can_view_products",
    },
    // Метаданные для страницы AdditionalServices
    displayMeta: {
      name: "Склад",
      icon: FaWarehouse,
      description:
        "Учет услуг и материалов для консалтинга: приход/расход, партии, остатки и связь с продажами.",
    },
  },
  // Филиалы для тарифа Стандарт
  {
    id: "branch",
    label: "Филиалы",
    to: "/crm/branch",
    icon: menuIcons.store,
    permission: "can_view_branch",
    implemented: true,
    // Условия показа в меню
    conditions: {
      tariff: "Стандарт",
      permission: "can_view_branch",
    },
    // Метаданные для страницы AdditionalServices
    displayMeta: {
      name: "Филиалы",
      icon: FaStore,
      description:
        "Управление филиалами компании: создание, настройка, мониторинг и аналитика работы филиалов.",
    },
  },
];

/**
 * Получает список услуг для меню на основе условий
 * @param {object} params - Параметры для проверки условий
 * @returns {array} - Массив услуг для меню
 */
export const getAdditionalServicesForMenu = (params) => {
  const { hasPermission, isAllowed, company, tariff, sector } = params;

  return ADDITIONAL_SERVICES_CONFIG.filter((service) => {
    // Проверяем условия показа
    if (
      !checkConditions(service.conditions, {
        tariff,
        sector,
        hasPermission,
        isAllowed,
        company,
      })
    ) {
      return false;
    }

    // Проверяем права доступа
    if (service.permission) {
      if (!isAllowed(company, service.permission)) return false;
    }

    return true;
  }).map((service) => ({
    label: service.label,
    to: service.to,
    icon: service.icon,
    permission: service.permission,
    implemented: service.implemented,
  }));
};

/**
 * Получает список услуг для страницы AdditionalServices
 * @param {object} params - Параметры для проверки условий
 * @returns {array} - Массив услуг с метаданными для отображения
 */
export const getAdditionalServicesForPage = (params) => {
  const { hasPermission, isAllowed, company, tariff, sector } = params;

  return ADDITIONAL_SERVICES_CONFIG.filter((service) => {
    // Проверяем условия показа
    if (
      !checkConditions(service.conditions, {
        tariff,
        sector,
        hasPermission,
        isAllowed,
        company,
      })
    ) {
      return false;
    }

    // Проверяем права доступа
    if (service.permission) {
      if (!isAllowed(company, service.permission)) return false;
    }

    // Должны быть метаданные для отображения
    if (!service.displayMeta) return false;

    return true;
  }).map((service) => ({
    id: service.id,
    name: service.displayMeta.name,
    icon: service.displayMeta.icon,
    description: service.displayMeta.description,
  }));
};
