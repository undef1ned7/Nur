// AccessList.jsx
import { useEffect, useState } from "react";
import { FaCheckCircle, FaRegCircle } from "react-icons/fa";

// Базовые permissions (общие для всех секторов)
const BASIC_ACCESS_TYPES = [
  { value: "Касса", label: "Касса", backendKey: "can_view_cashbox" },
  { value: "Отделы", label: "Отделы", backendKey: "can_view_departments" },
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
  ],
  "Строительная компания": [
    {
      value: "Процесс работы",
      label: "Процесс работы",
      backendKey: "can_view_building_work_process",
    },
    {
      value: "Объекты",
      label: "Объекты",
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
      value: "Объекты",
      label: "Объекты",
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
      value: "Объекты",
      label: "Объекты",
      backendKey: "can_view_building_objects",
    },
  ],
};

// Функция для получения всех доступных permissions на основе сектора
const getAllAccessTypes = (sectorName) => {
  const basicAccess = [...BASIC_ACCESS_TYPES];
  const sectorAccess = SECTOR_ACCESS_TYPES[sectorName] || [];
  return [...basicAccess, ...sectorAccess];
};

// Для обратной совместимости
export const ALL_ACCESS_TYPES = BASIC_ACCESS_TYPES;

// const LOCAL_STORAGE_KEY = "userSelectedAccesses";

const AccessList = ({
  employeeAccesses,
  onSaveAccesses,
  role,
  sectorName,
  profile,
  tariff,
}) => {
  // console.log(employeeAccesses, "employeeAccesses in AccessList");
  console.log("AccessList - Tariff:", tariff);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedAccess, setSelectedAccess] = useState(() => {
    const availableAccessTypes = (() => {
      if (!sectorName) return ALL_ACCESS_TYPES;

      // Для тарифа "Старт" всегда показываем только базовые permissions
      if (tariff === "Старт") {
        return getAllAccessTypes(sectorName, tariff);
      }

      const allTypes = getAllAccessTypes(sectorName, tariff);

      // Если пользователь не владелец, показываем только базовые permissions
      if (profile?.role_display !== "Владелец") {
        return ALL_ACCESS_TYPES;
      }

      return allTypes;
    })();

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
    const availableAccessTypes = (() => {
      if (!sectorName) return ALL_ACCESS_TYPES;

      // Для тарифа "Старт" всегда показываем только базовые permissions
      if (tariff === "Старт") {
        return getAllAccessTypes(sectorName, tariff);
      }

      const allTypes = getAllAccessTypes(sectorName, tariff);

      // Если пользователь не владелец, показываем только базовые permissions
      if (profile?.role_display !== "Владелец") {
        return ALL_ACCESS_TYPES;
      }

      return allTypes;
    })();

    const newAccessState = {};
    availableAccessTypes.forEach((accessType) => {
      newAccessState[accessType.backendKey] = employeeAccesses?.includes(
        accessType.value
      );
    });
    setSelectedAccess(newAccessState);
  }, [employeeAccesses, sectorName, profile?.role_display, tariff]);

  const toggleAccess = (backendKey) => {
    setSelectedAccess((prev) => ({
      ...prev,
      [backendKey]: !prev[backendKey],
    }));
  };

  const handleSave = () => {
    const availableAccessTypes = (() => {
      if (!sectorName) return ALL_ACCESS_TYPES;

      // Для тарифа "Старт" всегда показываем только базовые permissions
      if (tariff === "Старт") {
        return getAllAccessTypes(sectorName, tariff);
      }

      const allTypes = getAllAccessTypes(sectorName, tariff);

      // Если пользователь не владелец, показываем только базовые permissions
      if (profile?.role_display !== "Владелец") {
        return ALL_ACCESS_TYPES;
      }

      return allTypes;
    })();

    const payloadForBackend = {};
    availableAccessTypes.forEach((accessType) => {
      payloadForBackend[accessType.backendKey] =
        !!selectedAccess[accessType.backendKey];
    });

    onSaveAccesses(payloadForBackend);
    setIsOpen(false);
  };

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
