import { useMemo, useCallback } from "react";
import { MENU_CONFIG } from "../config/menuConfig";
import { HIDE_RULES } from "../config/hideRules";
import { useMenuPermissions } from "./useMenuPermissions";
import { Warehouse } from "lucide-react";
import { menuIcons } from "../config/menuIcons";

/**
 * Хук для сборки финального списка пунктов меню
 */
export const useMenuItems = (company, sector, tariff) => {
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
  }, [sector, tariff]);

  /**
   * Получает секторные пункты меню
   */
  const getSectorMenuItems = useCallback(() => {
    if (!sector || !company?.sector?.name) return [];

    // Для тарифа "Старт" не показываем секторные пункты меню
    if (tariff === "Старт") {
      return [];
    }

    const sectorName = company.sector.name.toLowerCase();
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
    };

    const configKey = sectorMapping[sectorKey] || sectorKey;
    const sectorConfig = MENU_CONFIG.sector[configKey] || [];

    const filteredItems = sectorConfig.filter((item) =>
      hasPermission(item.permission)
    );

    return filteredItems;
  }, [sector, company, hasPermission, tariff]);

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
    let children = MENU_CONFIG.additional.filter((item) =>
      isAllowedForPerm(item.permission)
    );

    // Если нет ни одного индивидуально доступного, но есть групповое право
    if (children.length === 0 && groupAllowed) {
      children = MENU_CONFIG.additional.filter(
        (item) => companyAllows(item.permission) !== false
      );
    }

    // Специальный пункт для сектора "Консалтинг": добавить "Склад" в Доп. услуги
    const sectorName = company?.sector?.name?.toLowerCase?.() || "";
    if (sectorName === "консалтинг" && hasPermission("can_view_products")) {
      const stockItem = {
        label: "Склад",
        to: "/crm/sklad",
        icon: () => <Warehouse className="sidebar__menu-icon" />,
        permission: "can_view_products",
        implemented: true,
      };
      const exists = children.some(
        (c) => c.to === stockItem.to || c.label === stockItem.label
      );
      if (!exists) children.push(stockItem);
    }

    // Если нет прав ни на группу, ни на дочерние — ничего не показывать
    if (!groupAllowed && children.length === 0) return null;

    return {
      label: "Доп услуги",
      to: "/crm/additional-services",
      icon: menuIcons.clipboard, // Используем иконку из menuIcons
      implemented: true,
      children,
    };
  }, [hasPermission, company]);

  /**
   * Собирает финальный список меню
   */
  const menuItems = useMemo(() => {
    let items = [];

    // Основные пункты меню
    const basicItems = MENU_CONFIG.basic.filter((item) =>
      hasPermission(item.permission)
    );

    // Секторные пункты меню
    const sectorItems = getSectorMenuItems();

    // Дополнительные услуги
    const additionalServices = getAdditionalServices();

    // Собираем все пункты
    items = [...basicItems];

    // Вставляем секторные пункты после "Обзор"
    const overviewIndex = items.findIndex((item) => item.label === "Обзор");
    if (overviewIndex !== -1 && sectorItems.length > 0) {
      items.splice(overviewIndex + 1, 0, ...sectorItems);
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
  }, [hasPermission, getSectorMenuItems, getAdditionalServices, hiddenByRules]);

  return menuItems;
};
