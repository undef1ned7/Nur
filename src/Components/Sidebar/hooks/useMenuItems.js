import { useMemo, useCallback } from "react";
import { MENU_CONFIG } from "../config/menuConfig";
import { HIDE_RULES } from "../config/hideRules";
import { useMenuPermissions } from "./useMenuPermissions";
import { menuIcons } from "../config/menuIcons";
import { getAdditionalServicesForMenu } from "../config/additionalServicesConfig";

/**
 * Хук для сборки финального списка пунктов меню
 */
export const useMenuItems = (company, sector, tariff, profile = null) => {
  const { hasPermission, isAllowed } = useMenuPermissions();
  /**
   * Вычисляет скрытые элементы на основе правил
   */
  const hiddenByRules = useMemo(() => {
    const result = { labels: new Set(), toIncludes: [] };

    HIDE_RULES.forEach((rule) => {
      const { when = {}, hide = {} } = rule;
      const sectorOk = !when.sector || when.sector === sector;
      const tariffOk = !when.tariff || when.tariff === tariff;
      const tariffInOk =
        !when.tariffIn || (tariff && when.tariffIn.includes(tariff));
      const tariffNotInOk =
        !when.tariffNotIn || (tariff && !when.tariffNotIn.includes(tariff));

      if (sectorOk && tariffOk && tariffInOk && tariffNotInOk) {
        (hide.labels || []).forEach((l) => result.labels.add(l));
        (hide.toIncludes || []).forEach((p) => result.toIncludes.push(p));
      }
    });

    return result;
  }, [sector, tariff, company, profile]);

  /**
   * Получает секторные пункты меню
   */
  const getSectorMenuItems = useCallback(() => {
    // Используем переданный sector или берем из company
    const currentSector = sector || company?.sector?.name;
    if (!currentSector) return [];

    const sectorName = currentSector.toLowerCase();
    const sectorKey = sectorName.replace(/\s+/g, "_");

    // Маппинг названий секторов на ключи конфигурации
    const sectorMapping = {
      строительная_компания: "building",
      ремонтные_и_отделочные_работы: "building",
      архитектура_и_дизайн: "building",
      барбершоп: "barber",
      гостиница: "hostel",
      школа: "school",
      магазин: "market",
      кафе: "cafe",
      "Цветочный магазин": "market",
      производство: "production",
      консалтинг: "consulting",
      склад: "warehouse",
      пилорама: "pilorama",
      логистика: "logistics",
    };

    const configKey = sectorMapping[sectorKey] || sectorKey;
    const sectorConfig = MENU_CONFIG.sector[configKey] || [];

    // Для тарифа "Старт" показываем только аналитику маркета
    if (tariff === "Старт") {
      const filteredItems = sectorConfig.filter((item) => {
        // Показываем только аналитику маркета
        if (item.to === "/crm/market/analytics") {
          return hasPermission(item.permission);
        }
        return false;
      });
      return filteredItems;
    }

    const filteredItems = sectorConfig.filter((item) => {
      if ('production' === configKey && item.permission === 'can_view_catalog') return true
      return hasPermission(item.permission)
    }
    );

    return filteredItems;
  }, [sector, company, hasPermission, profile, tariff]);

  /**
   * Получает дополнительные услуги
   */
  const getAdditionalServices = useCallback(() => {
    const companyAllows = (perm) => {
      if (!company) return undefined;
      if (Object.prototype.hasOwnProperty.call(company, perm)) {
        return company[perm] === true;
      }
      return undefined;
    };

    const isAllowedForPerm = (perm) => {
      const userOk = hasPermission(perm);
      const companyOk = companyAllows(perm);
      if (companyOk === false) return false;
      return userOk || companyOk === true;
    };

    // Доступ к группе
    const groupAllowed = isAllowedForPerm("can_view_additional_services");

    // Фильтруем дочерние пункты по совокупному правилу
    let children = MENU_CONFIG.additional.filter((item) => {
      // Для "Печать штрих-кодов" и "Интеграция с весами" проверяем ТОЛЬКО права пользователя (profile)
      // они должны отображаться только если can_view === true у пользователя
      if (
        item.permission === "can_view_market_label" ||
        item.permission === "can_view_market_scales"
      ) {
        // Проверяем ТОЛЬКО права пользователя (profile), игнорируя настройки компании
        return hasPermission(item.permission) === true;
      }
      // Для WhatsApp, Instagram, Telegram, Документы проверяем ТОЛЬКО права компании
      // их разрешения находятся в company, а не в profile
      if (
        item.permission === "can_view_whatsapp" ||
        item.permission === "can_view_instagram" ||
        item.permission === "can_view_telegram" ||
        item.permission === "can_view_documents"
      ) {
        // Проверяем ТОЛЬКО права компании
        return companyAllows(item.permission) === true;
      }
      // Для остальных используем стандартную проверку (пользователь ИЛИ компания)
      return isAllowedForPerm(item.permission);
    });

    // Если нет ни одного индивидуально доступного, но есть групповое право
    if (children.length === 0 && groupAllowed) {
      children = MENU_CONFIG.additional.filter((item) => {
        // Для "Печать штрих-кодов" и "Интеграция с весами" НЕ используем fallback
        // они должны проверяться только через hasPermission (profile)
        if (
          item.permission === "can_view_market_label" ||
          item.permission === "can_view_market_scales"
        ) {
          return false; // Исключаем из fallback
        }
        // Для WhatsApp, Instagram, Telegram, Документы проверяем компанию в fallback
        if (
          item.permission === "can_view_whatsapp" ||
          item.permission === "can_view_instagram" ||
          item.permission === "can_view_telegram" ||
          item.permission === "can_view_documents"
        ) {
          return companyAllows(item.permission) === true;
        }
        // Для остальных используем fallback: показываем если компания не запретила
        return companyAllows(item.permission) !== false;
      });
    }

    // Получаем динамические дополнительные услуги из конфигурации
    const dynamicServices = getAdditionalServicesForMenu({
      hasPermission,
      isAllowed: isAllowedForPerm,
      company,
      tariff,
      sector: company?.sector?.name,
    });

    // Добавляем динамические услуги, если их еще нет
    dynamicServices.forEach((service) => {
      const exists = children.some(
        (c) => c.to === service.to || c.label === service.label
      );
      if (!exists) {
        children.push(service);
      }
    });

    // Если нет прав ни на группу, ни на дочерние — ничего не показывать
    if (!groupAllowed && children.length === 0) return null;

    return {
      label: "Доп услуги",
      to: "/crm/additional-services",
      icon: menuIcons.clipboard, // Используем иконку из menuIcons
      implemented: true,
      children,
    };
  }, [hasPermission, company, tariff, profile]);

  /**
   * Собирает финальный список меню
   */
  const menuItems = useMemo(() => {
    let items = [];

    // Основные пункты меню
    let basicItems = MENU_CONFIG.basic.filter((item) =>
      hasPermission(item.permission)
    );
    if (tariff !== "Старт") {
      if (company.industry.name !== 'Парикмахерские' && company.industry.name !== 'Производство') {
        basicItems = basicItems.filter((item) => item.to !== "/crm/sell");
      }
    }
    const sectorItems = getSectorMenuItems();

    // Дополнительные услуги
    const additionalServices = getAdditionalServices();

    // Собираем все пункты
    items = [...basicItems];

    // Вставляем секторные пункты после "Обзор" (если он есть), иначе в начало
    if (sectorItems.length > 0) {
      const overviewIndex = items.findIndex((item) => item.label === "Обзор");
      if (overviewIndex !== -1) {
        items.splice(overviewIndex + 1, 0, ...sectorItems);
      } else {
        // Если "Обзор" не найден, добавляем секторные пункты в начало
        items.unshift(...sectorItems);
      }
    }

    // Добавляем дополнительные услуги перед "Настройки"
    if (additionalServices) {
      const settingsIndex = items.findIndex(
        (item) => item.label === "Настройки"
      );
      if (settingsIndex !== -1) {
        items.splice(settingsIndex, 0, additionalServices);
      } else {
        items.push(additionalServices);
      }
    }

    // Применяем правила скрытия
    const filteredItems = items.filter((item) => {
      if (!item.implemented) {
        return false;
      }

      // Скрываем "Филиалы" для пользователей-филиалов
      // Если у пользователя есть branch_ids, это означает, что он является филиалом
      if (item.label === "Филиалы") {
        const isBranchUser =
          profile?.branch_ids &&
          Array.isArray(profile.branch_ids) &&
          profile.branch_ids.length > 0;
        if (isBranchUser) {
          return false;
        }
      }

      // Гибкие правила скрытия
      if (hiddenByRules.labels.has(item.label)) {
        return false;
      }
      if (
        hiddenByRules.toIncludes.length > 0 &&
        typeof item.to === "string" &&
        hiddenByRules.toIncludes.some((p) => item.to.includes(p))
      ) {
        return false;
      }

      return true;
    });

    return filteredItems;
  }, [
    hasPermission,
    getSectorMenuItems,
    getAdditionalServices,
    hiddenByRules,
    profile,
  ]);

  return menuItems;
};
