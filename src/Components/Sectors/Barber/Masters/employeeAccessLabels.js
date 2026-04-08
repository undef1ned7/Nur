// Shared: метки доступов для AccessList (Masters, карточка сотрудника кафе)
export function convertEmployeeAccessesToLabels(employee, sectorName) {
  const labelsArray = [];
  // Используем те же константы, что и в DepartmentDetails
  const BASIC_ACCESS_TYPES = [
    { value: "Касса", label: "Касса", backendKey: "can_view_cashbox" },
    {
      value: "Отделы",
      label: "Отделы",
      backendKey: "can_view_departments",
    },
    { value: "Филиалы", label: "Филиалы", backendKey: "can_view_branch" },
    { value: "Долги", label: "Долги", backendKey: "can_view_debts" },
    { value: "Заказы", label: "Заказы", backendKey: "can_view_orders" },
    {
      value: "Аналитика",
      label: "Аналитика",
      backendKey: "can_view_analytics",
    },
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
    {
      value: "Настройки",
      label: "Настройки",
      backendKey: "can_view_settings",
    },
  ];
  
  const MARKET_ACCESS_TYPES = [
      {
        value: "Интерфейс кассира",
        label: "Интерфейс кассира",
        backendKey: "can_view_cashier",
      },
      {
        value: "Скидка в кассе",
        label: "Скидка в кассе",
        backendKey: "can_view_market_discount",
      },
      {
        value: "Изменение цены в кассе",
        label: "Изменение цены в кассе",
        backendKey: "can_view_market_edit_price",
      },
      {
        value: "Удаление позиций из корзины",
        label: "Удаление позиций из корзины",
        backendKey: "can_view_market_delete_cart_item",
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
    ];

  const SECTOR_ACCESS_TYPES = {
    Магазин: MARKET_ACCESS_TYPES,
    Маркет: MARKET_ACCESS_TYPES,
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
      {
        value: "Записи",
        label: "Записи",
        backendKey: "can_view_barber_records",
      },
    ],
    Гостиница: [
      {
        value: "Комнаты",
        label: "Комнаты",
        backendKey: "can_view_hostel_rooms",
      },
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
      {
        value: "Группы",
        label: "Группы",
        backendKey: "can_view_school_groups",
      },
      {
        value: "Уроки",
        label: "Уроки",
        backendKey: "can_view_school_lessons",
      },
      {
        value: "Учителя",
        label: "Учителя",
        backendKey: "can_view_school_teachers",
      },
      { value: "Лиды", label: "Лиды", backendKey: "can_view_school_leads" },
      {
        value: "Счета",
        label: "Счета",
        backendKey: "can_view_school_invoices",
      },
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
      {
        value: "Бронь",
        label: "Бронь",
        backendKey: "can_view_cafe_booking",
      },
      {
        value: "Клиенты Кафе",
        label: "Клиенты Кафе",
        backendKey: "can_view_cafe_clients",
      },
      {
        value: "Столы",
        label: "Столы",
        backendKey: "can_view_cafe_tables",
      },
      { value: "Кухня", label: "Кухня", backendKey: "can_view_cafe_cook" },
      {
        value: "Инвентаризация",
        label: "Инвентаризация",
        backendKey: "can_view_cafe_inventory",
      },
    ],
    "Строительная компания": [
      {
        value: "Аналитика",
        label: "Аналитика",
        backendKey: "can_view_building_analytics",
      },
      {
        value: "Касса",
        label: "Касса",
        backendKey: "can_view_building_cash_register",
      },
      {
        value: "Клиенты",
        label: "Клиенты",
        backendKey: "can_view_building_clients",
      },
      {
        value: "Отделы",
        label: "Отделы",
        backendKey: "can_view_building_department",
      },
      {
        value: "Сотрудники",
        label: "Сотрудники",
        backendKey: "can_view_building_employess",
      },
      {
        value: "Напоминания",
        label: "Напоминания",
        backendKey: "can_view_building_notification",
      },
      {
        value: "Закупки",
        label: "Закупки",
        backendKey: "can_view_building_procurement",
      },
      {
        value: "ЖК",
        label: "ЖК",
        backendKey: "can_view_building_projects",
      },
      {
        value: "Зарплата",
        label: "Зарплата",
        backendKey: "can_view_building_salary",
      },
      {
        value: "Продажи",
        label: "Продажи",
        backendKey: "can_view_building_sell",
      },
      {
        value: "Склад",
        label: "Склад",
        backendKey: "can_view_building_stock",
      },
      {
        value: "Договора",
        label: "Договора",
        backendKey: "can_view_building_treaty",
      },
      {
        value: "Процесс работ",
        label: "Процесс работ",
        backendKey: "can_view_building_work_process",
      },
      {
        value: "Квартиры/объекты",
        label: "Квартиры/объекты",
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
      {
        value: "Клиенты",
        label: "Клиенты",
        backendKey: "can_view_clients",
      },
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
      {
        value: "Зарплата",
        label: "Зарплата",
        backendKey: "can_view_salary",
      },
      { value: "Продажи", label: "Продажи", backendKey: "can_view_sale" },
      { value: "Услуги", label: "Услуги", backendKey: "can_view_services" },
    ],
    Склад: [
      {
        value: "Контрагенты",
        label: "Контрагенты",
        backendKey: "can_view_clients",
      },
      {
        value: "Аналитика",
        label: "Аналитика",
        backendKey: "can_view_analytics",
      },
      { value: "Товары", label: "Товары", backendKey: "can_view_products" },
      {
        value: "Документы",
        label: "Документы",
        backendKey: "can_view_document",
      },
      { value: "Агенты", label: "Агенты", backendKey: "can_view_agent" },
      // {
      //   value: "Контрагенты",
      //   label: "Контрагенты",
      //   backendKey: "can_view_clients",
      // },
    ],
    Производство: [
      {
        value: "Передача",
        label: "Передача",
        backendKey: "can_view_agent",
      },
      {
        value: "Каталог",
        label: "Каталог",
        backendKey: "can_view_catalog",
      },
      {
        value: "Запросы",
        label: "Запросы",
        backendKey: "can_view_request",
      },
    ],
    Логистика: [
      {
        value: "Логистика",
        label: "Логистика",
        backendKey: "can_view_logistics",
      },
    ],
  };
  
  const getAllAccessTypes = (sectorName) => {
    const basicAccess = [...BASIC_ACCESS_TYPES];
    const sectorAccess = SECTOR_ACCESS_TYPES[sectorName] || [];
    return [...basicAccess, ...sectorAccess];
  };
  
  const availableAccessTypes = sectorName
    ? getAllAccessTypes(sectorName)
    : BASIC_ACCESS_TYPES;
  
  availableAccessTypes.forEach((type) => {
    if (employee && employee[type.backendKey] === true) {
      labelsArray.push(type.value);
    }
  });
  return labelsArray;
}
