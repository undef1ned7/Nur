import { Warehouse } from "lucide-react";
import {
  FaBarcode,
  FaCashRegister,
  FaConciergeBell,
  FaInstagram,
  FaReceipt,
  FaStore,
  FaTelegram,
  FaUtensils,
  FaUsers,
  FaWarehouse,
  FaWhatsapp,
} from "react-icons/fa";
import { MdDocumentScanner } from "react-icons/md";
import { SERVICE_IDS } from "../../../config/additionalServiceIds";
import { menuIcons } from "./menuIcons";

const normalizeString = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const matchConditionValue = (currentValue, expectedValue) => {
  if (!expectedValue) return true;
  if (Array.isArray(expectedValue)) {
    return expectedValue.some(
      (expected) => normalizeString(expected) === normalizeString(currentValue),
    );
  }
  return normalizeString(expectedValue) === normalizeString(currentValue);
};

const checkPermissionAccess = ({
  permission,
  permissionModel = "mixed",
  company,
  hasPermission,
  isAllowed,
  companyAllows,
}) => {
  if (!permission) return true;
  if (permissionModel === "user") {
    return typeof hasPermission === "function"
      ? hasPermission(permission) === true
      : false;
  }
  if (permissionModel === "company") {
    if (typeof companyAllows === "function") {
      return companyAllows(permission) === true;
    }
    return company && Object.prototype.hasOwnProperty.call(company, permission)
      ? company[permission] === true
      : false;
  }
  if (typeof isAllowed === "function") {
    return isAllowed.length >= 2
      ? isAllowed(company, permission)
      : isAllowed(permission);
  }
  return false;
};

const checkConditions = (conditions, params) => {
  if (!conditions || Object.keys(conditions).length === 0) return true;
  const { tariff, sector } = params;

  if (!matchConditionValue(tariff, conditions.tariff)) return false;
  if (!matchConditionValue(sector, conditions.sector)) return false;
  if (
    conditions.permission &&
    !checkPermissionAccess({ ...params, permission: conditions.permission })
  ) {
    return false;
  }
  if (
    typeof conditions.customCheck === "function" &&
    !conditions.customCheck(params)
  ) {
    return false;
  }

  return true;
};

export const ADDITIONAL_SERVICES_CONFIG = [
  {
    id: SERVICE_IDS.WHATSAPP,
    type: "navigational",
    label: "WhatsApp",
    to: "/crm/",
    icon: menuIcons.comments,
    permission: "can_view_whatsapp",
    permissionModel: "company",
    implemented: true,
    conditions: {},
    displayMeta: {
      title: "WhatsApp",
      description:
        "Подключите чаты для удобного общения, быстрых автоматических ответов и полной интеграции с CRM.",
      icon: FaWhatsapp,
    },
  },
  {
    id: SERVICE_IDS.TELEGRAM,
    type: "navigational",
    label: "Telegram",
    to: "/crm/",
    icon: menuIcons.comments,
    permission: "can_view_telegram",
    permissionModel: "company",
    implemented: true,
    conditions: {},
    displayMeta: {
      title: "Telegram",
      description:
        "Подключите чаты для удобного общения, быстрых автоматических ответов и полной интеграции с CRM.",
      icon: FaTelegram,
    },
  },
  {
    id: SERVICE_IDS.INSTAGRAM,
    type: "navigational",
    label: "Instagram",
    to: "/crm/instagram",
    icon: menuIcons.instagramIcon,
    permission: "can_view_instagram",
    permissionModel: "company",
    implemented: true,
    conditions: {},
    displayMeta: {
      title: "Instagram",
      description:
        "Подключите Instagram для переписки с клиентами и централизованной обработки диалогов в CRM.",
      icon: FaInstagram,
    },
  },
  {
    id: SERVICE_IDS.DOCUMENTS,
    type: "navigational",
    label: "Документы",
    to: "/crm/documents",
    icon: menuIcons.documentScanner,
    permission: "can_view_documents",
    permissionModel: "company",
    implemented: true,
    conditions: {},
    displayMeta: {
      title: "Документы",
      description:
        "Создание и хранение договоров, счетов и актов. Шаблоны, статусы и быстрые отправки клиентам.",
      icon: MdDocumentScanner,
    },
  },
  {
    id: SERVICE_IDS.BARCODE_PRINT,
    type: "navigational",
    label: "Печать штрих-кодов",
    to: "/crm/barcodes",
    icon: menuIcons.documentScanner,
    permission: "can_view_market_label",
    permissionModel: "user",
    implemented: true,
    conditions: {},
    displayMeta: {
      title: "Печать штрих-кодов",
      description:
        "Установка 2000 + абонентская плата 300. Печать штрих-кодов для товаров со склада с предпросмотром.",
      icon: FaBarcode,
    },
  },
  {
    id: SERVICE_IDS.SCALES,
    type: "navigational",
    label: "Интеграция с весами",
    to: "/crm/scales",
    icon: menuIcons.scale,
    permission: "can_view_market_scales",
    permissionModel: "user",
    implemented: true,
    conditions: {},
    displayMeta: {
      title: "Интеграция с весами",
      description:
        "Установка 5000 + абонентская плата 500. Отправка товарной номенклатуры на торговые весы.",
      icon: FaBarcode,
    },
  },
  {
    id: SERVICE_IDS.CASHIER,
    type: "navigational",
    label: "Интерфейс кассира",
    to: "/crm/market/cashier",
    icon: menuIcons.cashRegister,
    implemented: true,
    conditions: {
      customCheck: ({ tariff, sector }) => {
        const isStart = normalizeString(tariff) === "старт";
        const normalizedSector = normalizeString(sector);
        const isMarket =
          normalizedSector === "магазин" ||
          normalizedSector === "цветочный магазин";
        // На тарифе "Старт" в "Маркете" эта услуга не должна отображаться.
        return !(isStart && isMarket);
      },
    },
    displayMeta: {
      title: "Интерфейс кассира",
      description:
        "Подключение интерфейса кассира для быстрой продажи, оформления оплат и работы с чеками.",
      icon: FaCashRegister,
    },
  },
  {
    id: SERVICE_IDS.EXTRA_EMPLOYEES,
    type: "extension",
    label: "Сотрудники (больше 3)",
    to: null,
    icon: menuIcons.user,
    permission: null,
    implemented: true,
    conditions: {
      tariff: "Старт",
      sector: ["Магазин", "Цветочный магазин"],
    },
    displayMeta: {
      title: "Сотрудники (больше 3)",
      description:
        "На тарифе Старт для Маркета лимит 3 сотрудника, включая владельца. Расширение: установка 2000 + абонентская плата 200.",
      icon: FaUsers,
    },
  },
  {
    id: SERVICE_IDS.DOUBLE_WAREHOUSE,
    type: "extension",
    label: "Двойной склад",
    to: null,
    icon: menuIcons.warehouse,
    permission: null,
    implemented: true,
    conditions: {
      tariff: "Старт",
      sector: ["Магазин", "Цветочный магазин"],
    },
    displayMeta: {
      title: "Двойной склад",
      description:
        "Установка 5000 + абонентская плата 500. Добавляет работу с двойным складом.",
      icon: FaWarehouse,
    },
  },
  {
    id: SERVICE_IDS.ONLINE_SHOWCASE,
    type: "extension",
    label: "Онлайн витрина",
    to: null,
    icon: menuIcons.store,
    permission: null,
    implemented: true,
    conditions: {
      tariff: "Старт",
      sector: ["Магазин", "Цветочный магазин"],
    },
    displayMeta: {
      title: "Онлайн витрина",
      description:
        "Установка 3000 + абонентская плата 300. Публикация товаров в онлайн витрине.",
      icon: FaStore,
    },
  },
  {
    id: SERVICE_IDS.WAITER,
    type: "extension",
    label: "Официант",
    to: null,
    icon: menuIcons.user,
    implemented: true,
    conditions: {
      tariff: "Старт",
      sector: "Кафе",
    },
    displayMeta: {
      title: "Официант",
      description: "Установка 2000с + абонентская плата 200с.",
      icon: FaUsers,
    },
  },
  {
    id: SERVICE_IDS.KITCHEN,
    type: "extension",
    label: "Кухня",
    to: null,
    icon: menuIcons.chefHat,
    implemented: true,
    conditions: {
      tariff: "Старт",
      sector: "Кафе",
    },
    displayMeta: {
      title: "Кухня",
      description: "Установка 2000с + абонентская плата 200с.",
      icon: FaUtensils,
    },
  },
  {
    id: SERVICE_IDS.EXTRA_RECEIPT_PRINTER,
    type: "extension",
    label: "Чековый аппарат (больше двух)",
    to: null,
    icon: menuIcons.receiptText,
    implemented: true,
    conditions: {
      tariff: "Старт",
      sector: "Кафе",
    },
    displayMeta: {
      title: "Чековый аппарат (больше двух)",
      description: "Установка 1000с + абонентская плата 100с.",
      icon: FaReceipt,
    },
  },
  {
    id: SERVICE_IDS.COSTING,
    type: "extension",
    label: "Калькуляция",
    to: null,
    icon: menuIcons.scale,
    implemented: true,
    conditions: {
      tariff: "Старт",
      sector: "Кафе",
    },
    displayMeta: {
      title: "Калькуляция",
      description: "Установка 2000с + абонентская плата 200с.",
      icon: FaConciergeBell,
    },
  },
  {
    id: SERVICE_IDS.ONLINE_MENU,
    type: "extension",
    label: "Онлайн меню",
    to: null,
    icon: menuIcons.bookOpenText,
    implemented: true,
    conditions: {
      tariff: "Старт",
      sector: "Кафе",
    },
    displayMeta: {
      title: "Онлайн меню",
      description: "Установка 3000с + абонентская плата 300с.",
      icon: FaStore,
    },
  },
  {
    id: SERVICE_IDS.WAREHOUSE,
    type: "navigational",
    label: "Склад",
    to: "/crm/sklad",
    icon: () => <Warehouse className="sidebar__menu-icon" />,
    permission: "can_view_products",
    permissionModel: "mixed",
    implemented: true,
    conditions: {
      sector: "Консалтинг",
      permission: "can_view_products",
    },
    displayMeta: {
      title: "Склад",
      description:
        "Учет услуг и материалов для консалтинга: приход/расход, партии, остатки и связь с продажами.",
      icon: FaWarehouse,
    },
  },
];

const resolveFilterParams = (params) => ({
  ...params,
  tariff: params?.tariff || params?.company?.subscription_plan?.name,
  sector: params?.sector || params?.company?.sector?.name,
});

const filterAdditionalServices = (params) => {
  const resolvedParams = resolveFilterParams(params);
  return ADDITIONAL_SERVICES_CONFIG.filter((service) =>
    checkConditions(service.conditions, resolvedParams),
  );
};

export const getAdditionalServicesForMenu = (params) =>
  filterAdditionalServices(params)
    .filter((service) => service.type === "navigational")
    .filter((service) =>
      checkPermissionAccess({
        ...resolveFilterParams(params),
        permission: service.permission,
        permissionModel: service.permissionModel,
      }),
    )
    .map((service) => ({
      id: service.id,
      type: service.type,
      label: service.label,
      to: service.to,
      icon: service.icon,
      permission: service.permission,
      permissionModel: service.permissionModel,
      implemented: service.implemented,
    }));

export const getAdditionalServicesForPage = (params) =>
  filterAdditionalServices(params)
    .filter((service) => service.displayMeta)
    .map((service) => ({
      id: service.id,
      type: service.type,
      title: service.displayMeta.title,
      description: service.displayMeta.description,
      icon: service.displayMeta.icon,
      to: service.to || null,
      isConnected: checkPermissionAccess({
        ...resolveFilterParams(params),
        permission: service.permission,
        permissionModel: service.permissionModel,
      }),
    }));
