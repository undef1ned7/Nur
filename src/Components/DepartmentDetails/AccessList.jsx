// AccessList.jsx
import { useEffect, useState, useMemo } from "react";
import { FaCheckCircle, FaRegCircle, FaSearch, FaTimes } from "react-icons/fa";
import { MENU_CONFIG } from "../Sidebar/config/menuConfig";
import { HIDE_RULES } from "../Sidebar/config/hideRules";
import { getAdditionalServicesForMenu, ADDITIONAL_SERVICES_CONFIG } from "../Sidebar/config/additionalServicesConfig";

// Базовые permissions (общие для всех секторов)
const BASIC_ACCESS_TYPES = [
  { value: "Касса", label: "Касса", backendKey: "can_view_cashbox" },
  { value: "Отделы", label: "Отделы", backendKey: "can_view_departments" },
  { value: "Филиалы", label: "Филиалы", backendKey: "can_view_branch" },
  { value: "Долги", label: "Долги", backendKey: "can_view_debts" },
  { value: "Заказы", label: "Заказы", backendKey: "can_view_orders" },
  { value: "Аналитика", label: "Аналитика", backendKey: "can_view_analytics" },
  {
    value: "Аналитика Отделов",
    label: "Аналитика Отделов",
    backendKey: "can_view_department_analytics",
  },
  { value: "Склад", label: "Склад", backendKey: "can_view_products" },
  { value: "Продажа", label: "Продажа", backendKey: "can_view_sale" },
  {
    value: "Бронирование",
    label: "Бронирование",
    backendKey: "can_view_booking",
  },
  { value: "Клиенты", label: "Клиенты", backendKey: "can_view_clients" },
  {
    value: "Бренд,Категория",
    label: "Бренд,Категория",
    backendKey: "can_view_brand_category",
  },
  {
    value: "Сотрудники",
    label: "Сотрудники",
    backendKey: "can_view_employees",
  },
  { value: "Настройки", label: "Настройки", backendKey: "can_view_settings" },
];

// Секторные permissions
const SECTOR_ACCESS_TYPES = {
  Барбершоп: [
    {
      value: "Клиенты Барбершопа",
      label: "Клиенты Барбершопа",
      backendKey: "can_view_barber_clients",
    },
    {
      value: "Услуги",
      label: "Услуги",
      backendKey: "can_view_barber_services",
    },
    {
      value: "История",
      label: "История",
      backendKey: "can_view_barber_history",
    },
    { value: "Записи", label: "Записи", backendKey: "can_view_barber_records" },
  ],
  Гостиница: [
    { value: "Комнаты", label: "Комнаты", backendKey: "can_view_hostel_rooms" },
    {
      value: "Бронирования",
      label: "Бронирования",
      backendKey: "can_view_hostel_booking",
    },
    {
      value: "Клиенты Гостиницы",
      label: "Клиенты Гостиницы",
      backendKey: "can_view_hostel_clients",
    },
    {
      value: "Аналитика Гостиницы",
      label: "Аналитика Гостиницы",
      backendKey: "can_view_hostel_analytics",
    },
  ],
  Школа: [
    {
      value: "Ученики",
      label: "Ученики",
      backendKey: "can_view_school_students",
    },
    { value: "Группы", label: "Группы", backendKey: "can_view_school_groups" },
    { value: "Уроки", label: "Уроки", backendKey: "can_view_school_lessons" },
    {
      value: "Учителя",
      label: "Учителя",
      backendKey: "can_view_school_teachers",
    },
    { value: "Лиды", label: "Лиды", backendKey: "can_view_school_leads" },
    { value: "Счета", label: "Счета", backendKey: "can_view_school_invoices" },
  ],
  Кафе: [
    { value: "Меню", label: "Меню", backendKey: "can_view_cafe_menu" },
    {
      value: "Заказы Кафе",
      label: "Заказы Кафе",
      backendKey: "can_view_cafe_orders",
    },
    {
      value: "Закупки",
      label: "Закупки",
      backendKey: "can_view_cafe_purchasing",
    },
    { value: "Бронь", label: "Бронь", backendKey: "can_view_cafe_booking" },
    {
      value: "Клиенты Кафе",
      label: "Клиенты Кафе",
      backendKey: "can_view_cafe_clients",
    },
    { value: "Столы", label: "Столы", backendKey: "can_view_cafe_tables" },
    { value: "Кухня", label: "Кухня", backendKey: "can_view_cafe_cook" },
    {
      value: "Инвентаризация",
      label: "Инвентаризация",
      backendKey: "can_view_cafe_inventory",
    },
  ],
  Магазин: [
    {
      value: "Интерфейс кассира",
      label: "Интерфейс кассира",
      backendKey: "can_view_cashier",
    },
    {
      value: "Смены",
      label: "Смены",
      backendKey: "can_view_shifts",
    },
    {
      value: "Документы",
      label: "Документы",
      backendKey: "can_view_document",
    },
  ],
  "Строительная компания": [
    {
      value: "Процесс работы",
      label: "Процесс работы",
      backendKey: "can_view_building_work_process",
    },
    {
      value: "Квартиры",
      label: "Квартиры",
      backendKey: "can_view_building_objects",
    },
  ],
  "Ремонтные и отделочные работы": [
    {
      value: "Процесс работы",
      label: "Процесс работы",
      backendKey: "can_view_building_work_process",
    },
    {
      value: "Квартиры",
      label: "Квартиры",
      backendKey: "can_view_building_objects",
    },
  ],
  "Архитектура и дизайн": [
    {
      value: "Процесс работы",
      label: "Процесс работы",
      backendKey: "can_view_building_work_process",
    },
    {
      value: "Квартиры",
      label: "Квартиры",
      backendKey: "can_view_building_objects",
    },
  ],
  Консалтинг: [
    { value: "Клиенты", label: "Клиенты", backendKey: "can_view_clients" },
    // { value: "Клиенты", label: "Клиенты", backendKey: "can_view_clients" },
    {
      value: "Запросы клиентов",
      label: "Запросы клиентов",
      backendKey: "can_view_client_requests",
    },
    { value: "Касса", label: "Касса", backendKey: "can_view_cashbox" },
    {
      value: "Сотрудники",
      label: "Сотрудники",
      backendKey: "can_view_employees",
    },
    { value: "Зарплата", label: "Зарплата", backendKey: "can_view_salary" },
    { value: "Продажи", label: "Продажи", backendKey: "can_view_sale" },
    { value: "Услуги", label: "Услуги", backendKey: "can_view_services" },
  ],
  Производство: [
    { value: "Передача", label: "Передача", backendKey: "can_view_agent" },
    { value: "Каталог", label: "Каталог", backendKey: "can_view_catalog" },
    { value: "Запросы", label: "Запросы", backendKey: "can_view_request" },
  ],
  Логистика: [
    {
      value: "Логистика",
      label: "Логистика",
      backendKey: "can_view_logistics",
    },
  ],
  Склад: [
    {
      value: "Аналитика",
      label: "Аналитика",
      backendKey: "can_view_analytics",
    },
    { value: "Документы", label: "Документы", backendKey: "can_view_document" },
  ],
};

// Функция для получения всех доступных permissions на основе сектора
const getAllAccessTypes = (sectorName, tariff = null) => {
  const basicAccess = [...BASIC_ACCESS_TYPES];

  // Для тарифа "Старт" возвращаем только базовые доступы
  if (tariff === "Старт") {
    return basicAccess;
  }

  const sectorAccess = SECTOR_ACCESS_TYPES[sectorName] || [];
  return [...basicAccess, ...sectorAccess];
};

// Для обратной совместимости
export const ALL_ACCESS_TYPES = BASIC_ACCESS_TYPES;

// Маппинг для доп. услуг
const additionalServicesMapping = {
  can_view_whatsapp: { value: "WhatsApp", label: "WhatsApp", backendKey: "can_view_whatsapp" },
  can_view_instagram: { value: "Instagram", label: "Instagram", backendKey: "can_view_instagram" },
  can_view_telegram: { value: "Telegram", label: "Telegram", backendKey: "can_view_telegram" },
  can_view_documents: { value: "Документы", label: "Документы", backendKey: "can_view_documents" },
  can_view_market_label: { value: "Печать штрих-кодов", label: "Печать штрих-кодов", backendKey: "can_view_market_label" },
  can_view_market_scales: { value: "Интеграция с весами", label: "Интеграция с весами", backendKey: "can_view_market_scales" },
};

// const LOCAL_STORAGE_KEY = "userSelectedAccesses";

const AccessList = ({
  employeeAccesses,
  onSaveAccesses,
  role,
  sectorName,
  profile,
  tariff,
  company, // Добавляем company для использования в логике меню
  isModalMode = false, // Новый проп для режима модального окна
}) => {
  const [isOpen, setIsOpen] = useState(isModalMode); // В модальном режиме сразу открыт
  const [searchQuery, setSearchQuery] = useState("");

  // Получаем доступы, которые реально показываются в сайдбаре
  const sidebarAccessTypes = useMemo(() => {
    // Определяем функции проверки прав до использования
    const companyAllows = (perm) => {
      if (!company) return undefined;
      if (Object.prototype.hasOwnProperty.call(company, perm)) {
        return company[perm] === true;
      }
      return undefined;
    };

    // Вычисляем скрытые элементы на основе правил (как в useMenuItems)
    const hiddenByRules = (() => {
      const result = { labels: new Set(), toIncludes: [] };

      HIDE_RULES.forEach((rule) => {
        const { when = {}, hide = {} } = rule;
        const sectorOk = !when.sector || when.sector === sectorName;
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
    })();

    // Получаем базовые пункты меню
    const basicItems = MENU_CONFIG.basic.filter((item) => {
      if (!item.implemented) return false;
      if (hiddenByRules.labels.has(item.label)) return false;
      if (
        hiddenByRules.toIncludes.length > 0 &&
        typeof item.to === "string" &&
        hiddenByRules.toIncludes.some((p) => item.to.includes(p))
      ) {
        return false;
      }
      return true;
    });

    // Получаем секторные пункты меню
    let sectorItems = [];
    if (sectorName && company?.sector?.name && tariff !== "Старт") {
      const sectorNameLower = company.sector.name.toLowerCase();
      const sectorKey = sectorNameLower.replace(/\s+/g, "_");

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

      sectorItems = sectorConfig.filter((item) => {
        if (!item.implemented) return false;
        if (hiddenByRules.labels.has(item.label)) return false;
        if (
          hiddenByRules.toIncludes.length > 0 &&
          typeof item.to === "string" &&
          hiddenByRules.toIncludes.some((p) => item.to.includes(p))
        ) {
          return false;
        }
        return true;
      });
    }

    // Собираем все permissions из меню
    const allMenuPermissions = new Set();
    [...basicItems, ...sectorItems].forEach((item) => {
      if (item.permission) {
        // "Филиалы" должны добавляться только если у компании есть активная доп. услуга
        if (item.permission === "can_view_branch") {
          if (companyAllows("can_view_branch") === true) {
            allMenuPermissions.add(item.permission);
          }
        } else {
          allMenuPermissions.add(item.permission);
        }
      }
      // Обрабатываем children для дополнительных услуг
      if (item.children && Array.isArray(item.children)) {
        item.children.forEach((child) => {
          if (child.permission) {
            // "Филиалы" должны добавляться только если у компании есть активная доп. услуга
            if (child.permission === "can_view_branch") {
              if (companyAllows("can_view_branch") === true) {
                allMenuPermissions.add(child.permission);
              }
            } else {
              allMenuPermissions.add(child.permission);
            }
          }
        });
      }
    });

    // Для сектора "Магазин" явно добавляем permission интерфейса кассира,
    // так как он может не иметь собственного пункта меню, но должен отображаться в списке доступов
    if (sectorName) {
      const sectorNameLower = sectorName.toLowerCase().trim();
      if (
        sectorNameLower === "магазин" ||
        sectorNameLower === "цветочный магазин" ||
        sectorNameLower.includes("магазин")
      ) {
        allMenuPermissions.add("can_view_cashier");
      }
    }

    // Добавляем активные доп. услуги компании и профиля владельца
    const profileAllows = (perm) => {
      if (!profile) return undefined;
      if (Object.prototype.hasOwnProperty.call(profile, perm)) {
        return profile[perm] === true;
      }
      return undefined;
    };

    if (company || profile) {
      // Проверяем базовые доп. услуги из MENU_CONFIG.additional
      MENU_CONFIG.additional.forEach((service) => {
        if (!service.permission) return;

        // Для WhatsApp, Instagram, Telegram, Документы проверяем ТОЛЬКО права компании
        if (
          service.permission === "can_view_whatsapp" ||
          service.permission === "can_view_instagram" ||
          service.permission === "can_view_telegram" ||
          service.permission === "can_view_documents"
        ) {
          if (companyAllows(service.permission) === true) {
            allMenuPermissions.add(service.permission);
          }
        }
        // Для "Печать штрих-кодов" и "Интеграция с весами" проверяем ТОЛЬКО права профиля владельца
        else if (
          service.permission === "can_view_market_label" ||
          service.permission === "can_view_market_scales"
        ) {
          // Проверяем права в профиле владельца
          if (profileAllows(service.permission) === true) {
            allMenuPermissions.add(service.permission);
          }
        }
        // Для остальных проверяем права компании или профиля
        else {
          if (companyAllows(service.permission) === true || profileAllows(service.permission) === true) {
            allMenuPermissions.add(service.permission);
          }
        }
      });

      // Проверяем динамические доп. услуги из additionalServicesConfig
      const hasPermission = (perm) => {
        // Проверяем и в компании, и в профиле
        return companyAllows(perm) === true || profileAllows(perm) === true;
      };

      const isAllowed = (comp, perm) => {
        // Проверяем и в компании, и в профиле
        return companyAllows(perm) === true || profileAllows(perm) === true;
      };

      const dynamicServices = getAdditionalServicesForMenu({
        hasPermission,
        isAllowed,
        company,
        tariff,
        sector: company?.sector?.name || sectorName,
      });

      dynamicServices.forEach((service) => {
        if (service.permission) {
          // "Филиалы" должны добавляться только если у компании есть активная доп. услуга
          if (service.permission === "can_view_branch") {
            if (companyAllows("can_view_branch") === true) {
              allMenuPermissions.add(service.permission);
            }
          } else {
            allMenuPermissions.add(service.permission);
          }
        }
      });
    }

    // Маппим permissions обратно в доступы из BASIC_ACCESS_TYPES и SECTOR_ACCESS_TYPES
    const result = [];

    // Базовые доступы
    BASIC_ACCESS_TYPES.forEach((accessType) => {
      // "Филиалы" должны отображаться только если у компании есть активная доп. услуга
      if (accessType.backendKey === "can_view_branch") {
        // Проверяем, есть ли активная доп. услуга у компании
        if (companyAllows("can_view_branch") === true && allMenuPermissions.has(accessType.backendKey)) {
          result.push(accessType);
        }
      } else if (allMenuPermissions.has(accessType.backendKey)) {
        result.push(accessType);
      }
    });

    // Секторные доступы
    const sectorAccess = SECTOR_ACCESS_TYPES[sectorName] || [];
    sectorAccess.forEach((accessType) => {
      if (allMenuPermissions.has(accessType.backendKey)) {
        result.push(accessType);
      }
    });

    // Добавляем доп. услуги, которые активны у компании или профиля, но еще не добавлены
    allMenuPermissions.forEach((permission) => {
      // Проверяем, что это доп. услуга и её еще нет в результате
      if (additionalServicesMapping[permission]) {
        const exists = result.some((r) => r.backendKey === permission);
        if (!exists) {
          result.push(additionalServicesMapping[permission]);
        }
      } else {
        // Проверяем динамические доп. услуги из конфигурации
        // Если permission есть в allMenuPermissions, но нет в маппинге,
        // это может быть динамическая услуга (например, "Склад", "Филиалы")
        let dynamicService = MENU_CONFIG.additional.find(
          (s) => s.permission === permission
        );
        if (!dynamicService) {
          dynamicService = ADDITIONAL_SERVICES_CONFIG.find(
            (s) => s.permission === permission
          );
        }
        if (dynamicService && !result.some((r) => r.backendKey === permission)) {
          result.push({
            value: dynamicService.label,
            label: dynamicService.label,
            backendKey: dynamicService.permission,
          });
        }
      }
    });

    return result;
  }, [sectorName, tariff, company, profile]);

  const [selectedAccess, setSelectedAccess] = useState(() => {
    // Используем доступы из сайдбара
    const availableAccessTypes = sidebarAccessTypes;

    const initialAccess = {};
    availableAccessTypes.forEach((accessType) => {
      initialAccess[accessType.backendKey] = employeeAccesses?.includes(
        accessType.value
      );
    });

    return initialAccess;
  });

  useEffect(() => {
    // localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(selectedAccess));
  }, [selectedAccess]);

  useEffect(() => {
    // Используем доступы из сайдбара
    const availableAccessTypes = sidebarAccessTypes;

    const newAccessState = {};
    availableAccessTypes.forEach((accessType) => {
      newAccessState[accessType.backendKey] = employeeAccesses?.includes(
        accessType.value
      );
    });
    setSelectedAccess(newAccessState);
  }, [employeeAccesses, sidebarAccessTypes]);

  const toggleAccess = (backendKey) => {
    setSelectedAccess((prev) => ({
      ...prev,
      [backendKey]: !prev[backendKey],
    }));
  };

  // Используем доступы из сайдбара
  const availableAccessTypes = sidebarAccessTypes;

  // Разделяем на базовые, секторные и доп. услуги
  const basicAccessTypes = useMemo(() => {
    return availableAccessTypes.filter((type) =>
      BASIC_ACCESS_TYPES.some((basic) => basic.backendKey === type.backendKey)
    );
  }, [availableAccessTypes]);

  const sectorAccessTypes = useMemo(() => {
    return availableAccessTypes.filter(
      (type) =>
        !BASIC_ACCESS_TYPES.some(
          (basic) => basic.backendKey === type.backendKey
        ) &&
        !additionalServicesMapping[type.backendKey]
    );
  }, [availableAccessTypes]);

  // Доп. услуги (отдельная категория)
  const additionalServicesTypes = useMemo(() => {
    return availableAccessTypes.filter((type) => {
      // Проверяем, есть ли это в маппинге базовых доп. услуг
      if (additionalServicesMapping[type.backendKey]) {
        return true;
      }
      // Проверяем, есть ли это в MENU_CONFIG.additional
      const inMenuConfig = MENU_CONFIG.additional.some(
        (s) => s.permission === type.backendKey
      );
      if (inMenuConfig) {
        return true;
      }
      // Проверяем, есть ли это в динамических услугах
      const inDynamicServices = ADDITIONAL_SERVICES_CONFIG.some(
        (s) => s.permission === type.backendKey
      );
      return inDynamicServices;
    });
  }, [availableAccessTypes]);

  // Фильтрация по поисковому запросу
  const filteredBasic = useMemo(() => {
    if (!searchQuery.trim()) return basicAccessTypes;
    const query = searchQuery.toLowerCase();
    return basicAccessTypes.filter((type) =>
      type.label.toLowerCase().includes(query)
    );
  }, [basicAccessTypes, searchQuery]);

  const filteredSector = useMemo(() => {
    if (!searchQuery.trim()) return sectorAccessTypes;
    const query = searchQuery.toLowerCase();
    return sectorAccessTypes.filter((type) =>
      type.label.toLowerCase().includes(query)
    );
  }, [sectorAccessTypes, searchQuery]);

  const filteredAdditional = useMemo(() => {
    if (!searchQuery.trim()) return additionalServicesTypes;
    const query = searchQuery.toLowerCase();
    return additionalServicesTypes.filter((type) =>
      type.label.toLowerCase().includes(query)
    );
  }, [additionalServicesTypes, searchQuery]);

  const handleSave = () => {
    const payloadForBackend = {};
    // Сохраняем только те доступы, которые есть в сайдбаре
    sidebarAccessTypes.forEach((accessType) => {
      payloadForBackend[accessType.backendKey] =
        !!selectedAccess[accessType.backendKey];
    });

    onSaveAccesses(payloadForBackend);
    if (!isModalMode) {
      setIsOpen(false);
    }
  };

  const handleSelectAll = (types, select = true) => {
    const newAccess = { ...selectedAccess };
    types.forEach((type) => {
      newAccess[type.backendKey] = select;
    });
    setSelectedAccess(newAccess);
  };

  // Если режим модального окна, рендерим полную версию
  if (isModalMode) {
    return (
      <div className="access-list-modal">
        {/* Поиск */}
        <div
          style={{
            position: "relative",
            marginBottom: "20px",
          }}
        >
          <FaSearch
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#999",
              fontSize: "14px",
            }}
          />
          <input
            type="text"
            placeholder="Поиск доступов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px 10px 36px",
              border: "1px solid #ddd",
              borderRadius: "6px",
              fontSize: "14px",
              outline: "none",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#999",
                padding: "4px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <FaTimes size={14} />
            </button>
          )}
        </div>

        {/* Базовые доступы */}
        {filteredBasic.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
                paddingBottom: "8px",
                borderBottom: "2px solid #e0e0e0",
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#333",
                }}
              >
                Базовые доступы
              </h4>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => handleSelectAll(filteredBasic, true)}
                  style={{
                    padding: "4px 8px",
                    fontSize: "12px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  Выбрать все
                </button>
                <button
                  onClick={() => handleSelectAll(filteredBasic, false)}
                  style={{
                    padding: "4px 8px",
                    fontSize: "12px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  Снять все
                </button>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "8px",
                maxHeight: "300px",
                overflowY: "auto",
                padding: "8px",
                background: "#f9f9f9",
                borderRadius: "6px",
              }}
            >
              {filteredBasic.map((accessType) => (
                <label
                  key={accessType.backendKey}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    cursor: "pointer",
                    borderRadius: "4px",
                    background: selectedAccess[accessType.backendKey]
                      ? "#e8f5e9"
                      : "white",
                    border: `1px solid ${
                      selectedAccess[accessType.backendKey] ? "#4caf50" : "#ddd"
                    }`,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (!selectedAccess[accessType.backendKey]) {
                      e.currentTarget.style.background = "#f5f5f5";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedAccess[accessType.backendKey]) {
                      e.currentTarget.style.background = "white";
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!selectedAccess[accessType.backendKey]}
                    onChange={() => toggleAccess(accessType.backendKey)}
                    style={{
                      width: "18px",
                      height: "18px",
                      cursor: "pointer",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "14px",
                      color: "#333",
                      userSelect: "none",
                    }}
                  >
                    {accessType.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Секторные доступы */}
        {filteredSector.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
                paddingBottom: "8px",
                borderBottom: "2px solid #e0e0e0",
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#333",
                }}
              >
                Секторные доступы
              </h4>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => handleSelectAll(filteredSector, true)}
                  style={{
                    padding: "4px 8px",
                    fontSize: "12px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  Выбрать все
                </button>
                <button
                  onClick={() => handleSelectAll(filteredSector, false)}
                  style={{
                    padding: "4px 8px",
                    fontSize: "12px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  Снять все
                </button>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "8px",
                maxHeight: "300px",
                overflowY: "auto",
                padding: "8px",
                background: "#f9f9f9",
                borderRadius: "6px",
              }}
            >
              {filteredSector.map((accessType) => (
                <label
                  key={accessType.backendKey}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    cursor: "pointer",
                    borderRadius: "4px",
                    background: selectedAccess[accessType.backendKey]
                      ? "#e3f2fd"
                      : "white",
                    border: `1px solid ${
                      selectedAccess[accessType.backendKey] ? "#2196f3" : "#ddd"
                    }`,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (!selectedAccess[accessType.backendKey]) {
                      e.currentTarget.style.background = "#f5f5f5";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedAccess[accessType.backendKey]) {
                      e.currentTarget.style.background = "white";
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!selectedAccess[accessType.backendKey]}
                    onChange={() => toggleAccess(accessType.backendKey)}
                    style={{
                      width: "18px",
                      height: "18px",
                      cursor: "pointer",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "14px",
                      color: "#333",
                      userSelect: "none",
                    }}
                  >
                    {accessType.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Дополнительные услуги */}
        {filteredAdditional.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
                paddingBottom: "8px",
                borderBottom: "2px solid #e0e0e0",
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#333",
                }}
              >
                Дополнительные услуги
              </h4>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => handleSelectAll(filteredAdditional, true)}
                  style={{
                    padding: "4px 8px",
                    fontSize: "12px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  Выбрать все
                </button>
                <button
                  onClick={() => handleSelectAll(filteredAdditional, false)}
                  style={{
                    padding: "4px 8px",
                    fontSize: "12px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  Снять все
                </button>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "8px",
                maxHeight: "300px",
                overflowY: "auto",
                padding: "8px",
                background: "#fff3e0",
                borderRadius: "6px",
              }}
            >
              {filteredAdditional.map((accessType) => (
                <label
                  key={accessType.backendKey}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    cursor: "pointer",
                    borderRadius: "4px",
                    background: selectedAccess[accessType.backendKey]
                      ? "#ffe0b2"
                      : "white",
                    border: `1px solid ${
                      selectedAccess[accessType.backendKey] ? "#ff9800" : "#ddd"
                    }`,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (!selectedAccess[accessType.backendKey]) {
                      e.currentTarget.style.background = "#f5f5f5";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedAccess[accessType.backendKey]) {
                      e.currentTarget.style.background = "white";
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!selectedAccess[accessType.backendKey]}
                    onChange={() => toggleAccess(accessType.backendKey)}
                    style={{
                      width: "18px",
                      height: "18px",
                      cursor: "pointer",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "14px",
                      color: "#333",
                      userSelect: "none",
                    }}
                  >
                    {accessType.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Кнопка сохранения */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            marginTop: "24px",
            paddingTop: "16px",
            borderTop: "1px solid #e0e0e0",
          }}
        >
          <button
            onClick={handleSave}
            style={{
              padding: "10px 24px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "#007bff",
              color: "white",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#0056b3";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#007bff";
            }}
          >
            Сохранить доступы
          </button>
        </div>
      </div>
    );
  }

  // Старый режим (для использования в таблице)
  return (
    <div className={"accessList"} style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={role === "owner"}
        className={"accessButton"}
        style={{
          width: "100%",
          padding: "8px 12px",
          border: "1px solid #ccc",
          borderRadius: "4px",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        Доступы сотрудника ▾
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "40px",
            width: "100%",
            background: "white",
            border: "1px solid #ddd",
            borderRadius: "6px",
            boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
            zIndex: 10,
            padding: "8px",
            maxHeight: 150,
            overflow: "auto",
          }}
        >
          {(sectorName ? getAllAccessTypes(sectorName) : ALL_ACCESS_TYPES).map(
            (accessType) => (
              <div
                key={accessType.backendKey}
                onClick={() => toggleAccess(accessType.backendKey)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 0",
                  cursor: "pointer",
                }}
              >
                <span>{accessType.label}</span>
                {selectedAccess[accessType.backendKey] ? (
                  <FaCheckCircle color="#2ecc71" />
                ) : (
                  <FaRegCircle color="#ccc" />
                )}
              </div>
            )
          )}

          <button
            onClick={handleSave}
            className={"saveButton"}
            style={{
              marginTop: "10px",
              width: "100%",
              padding: "10px",
              borderRadius: "4px",
              border: "none",
              backgroundColor: "#007bff",
              color: "white",
              cursor: "pointer",
            }}
          >
            Сохранить доступы
          </button>
        </div>
      )}
    </div>
  );
};

export default AccessList;
