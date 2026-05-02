import { useMemo, useCallback } from "react";
import { MENU_CONFIG } from "../config/menuConfig";
import { menuIcons } from "../config/menuIcons";
import { HIDE_RULES } from "../config/hideRules";
import { useMenuPermissions } from "./useMenuPermissions";
import { getAdditionalServicesForMenu } from "../config/additionalServicesConfig";
import { isStartPlan } from "../../../utils/subscriptionPlan";

/**
 * Хук для сборки финального списка пунктов меню
 */
export const useMenuItems = (company, sector, tariff, profile = null) => {
  const { hasPermission, isAllowed, companyAllows } = useMenuPermissions();
  const hasMenuAccess = useCallback(
    (item) => {
      if (!item?.permission) return true;
      switch (item.permissionModel) {
        case "user":
          return hasPermission(item.permission) === true;
        case "company":
          return companyAllows(company, item.permission) === true;
        case "mixed":
          return isAllowed(company, item.permission);
        default:
          return hasPermission(item.permission) === true;
      }
    },
    [company, hasPermission, isAllowed, companyAllows],
  );
  /**
   * Вычисляет скрытые элементы на основе правил
   */
  const hiddenByRules = useMemo(() => {
    const result = { labels: new Set(), toIncludes: [] };

    HIDE_RULES.forEach((rule) => {
      const { when = {}, hide = {} } = rule;
      const sectorOk = !when.sector || when.sector === sector;
      const sectorNotInOk =
        !when.sectorNotIn ||
        !sector ||
        !when.sectorNotIn.includes(sector);
      const tariffOk = !when.tariff || when.tariff === tariff;
      const tariffInOk =
        !when.tariffIn || (tariff && when.tariffIn.includes(tariff));
      const tariffNotInOk =
        !when.tariffNotIn || (tariff && !when.tariffNotIn.includes(tariff));

      if (
        sectorOk &&
        sectorNotInOk &&
        tariffOk &&
        tariffInOk &&
        tariffNotInOk
      ) {
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
      услуги: "services",
      services: "services",
      стоматология: "dentistry",
      dentistry: "dentistry",
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

    // Для тарифа "Старт": магазин — только аналитика маркета; кафе — все пункты кроме кухни (повар/KDS); производство — без агента (передача, каталог, запросы); склад — без агента (заявки агентов)
    if (isStartPlan(tariff || company?.subscription_plan?.name)) {
      if (configKey === "cafe") {
        return sectorConfig.filter((item) => {
          if (item.to === "/crm/cafe/cook") return false;
          return hasPermission(item.permission);
        });
      }
      if (configKey === "production") {
        const skip = new Set([
          "/crm/production/agents",
          "/crm/production/catalog",
          "/crm/production/request",
        ]);
        return sectorConfig.filter(
          (item) => !skip.has(item.to) && hasPermission(item.permission),
        );
      }
      if (configKey === "warehouse") {
        const skip = new Set(["/crm/warehouse/agents"]);
        return sectorConfig.filter(
          (item) => !skip.has(item.to) && hasPermission(item.permission),
        );
      }
      const filteredItems = sectorConfig.filter((item) => {
        if (item.to === "/crm/market/analytics") {
          return hasPermission(item.permission);
        }
        return false;
      });
      return filteredItems;
    }

    const filteredItems = sectorConfig.filter((item) => {
      if ('production' === configKey && item.permission === 'can_view_catalog' && profile?.role === 'owner') return true
      return hasPermission(item.permission)
    }
    );

    return filteredItems;
  }, [sector, company, hasPermission, profile, tariff]);

  /**
   * Получает дополнительные услуги
   */
  const getAdditionalServices = useCallback(() => {
    /** Для сайдбара: company-флаги сами по себе не открывают пункт — нужно явное право у профиля (кроме mixed через isAllowed). */
    const additionalSidebarAccess = (item) => {
      if (!item?.permission) return false;
      if (profile?.role === "owner") {
        return isAllowed(company, item.permission);
      }
      const userOk = hasPermission(item.permission) === true;
      const companyFlag = companyAllows(company, item.permission);
      const companyOk = companyFlag === true;
      const model = item.permissionModel || "mixed";
      if (model === "company") {
        return userOk && companyOk;
      }
      if (model === "user") {
        return userOk;
      }
      return isAllowed(company, item.permission);
    };

    const baseItems = MENU_CONFIG.additional.filter(additionalSidebarAccess);

    // Получаем динамические дополнительные услуги из конфигурации
    const dynamicServicesRaw = getAdditionalServicesForMenu({
      hasPermission,
      isAllowed: (perm) => isAllowed(company, perm),
      companyAllows: (perm) => companyAllows(company, perm),
      company,
      tariff,
      sector: company?.sector?.name,
      profile,
    });
    const dynamicServices = dynamicServicesRaw.map((service) => {
      if (service?.id && service?.to === "/crm/additional-services") {
        return {
          ...service,
          to: `/crm/additional-services?service=${service.id}`,
        };
      }
      return service;
    });

    const merged = [...baseItems];
    dynamicServices.forEach((service) => {
      const exists = merged.some((item) => item.to === service.to);
      if (!exists) {
        merged.push(service);
      }
    });

    return merged
      .filter((item) => item.implemented !== false)
      .filter(additionalSidebarAccess);
  }, [hasPermission, company, tariff, profile, isAllowed, companyAllows]);

  /**
   * Собирает финальный список меню
   */
  const menuItems = useMemo(() => {
    let items = [];

    // Основные пункты меню
    let basicItems = MENU_CONFIG.basic.filter(hasMenuAccess);
    // if (tariff !== "Старт") {
    //   if (company.industry.name !== 'Парикмахерские' && company.industry.name !== 'Производство') {
    //   }
    //   basicItems = basicItems.filter((item) => item.to !== "/crm/sell");

    // }

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

    // «Доп услуги»: один пункт с подменю (children), как раньше; без услуг — ссылка на хаб
    const settingsIndex = items.findIndex((item) => item.label === "Настройки");
    const passesHideRules = (entry) => {
      if (!entry?.implemented) return false;
      if (hiddenByRules.labels.has(entry.label)) return false;
      if (
        hiddenByRules.toIncludes.length > 0 &&
        typeof entry.to === "string" &&
        hiddenByRules.toIncludes.some((p) => entry.to.includes(p))
      ) {
        return false;
      }
      return true;
    };
    const additionalChildren = additionalServices.filter(passesHideRules);
    // Показываем «Доп услуги» только при наличии хотя бы одной услуги с доступом (не хаб «вслепую»)
    if (additionalChildren.length > 0) {
      const additionalServicesItem = {
        label: "Доп услуги",
        to: "/crm/additional-services",
        icon: menuIcons.clipboard,
        implemented: true,
        children: additionalChildren,
      };
      if (settingsIndex !== -1) {
        items.splice(settingsIndex, 0, additionalServicesItem);
      } else {
        items.push(additionalServicesItem);
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
