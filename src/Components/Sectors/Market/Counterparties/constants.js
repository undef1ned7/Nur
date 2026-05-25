// Константы для компонента Counterparties
export const STORAGE_KEY = "counterparties_view_mode";
export const PAGE_SIZE = 100;
export const DEBOUNCE_DELAY = 300;

export const VIEW_MODES = {
  TABLE: "table",
  CARDS: "cards",
};

/** Вкладки по типу контрагента: клиент / поставщик */
export const TYPE_TABS = {
  CLIENT: "client",
  SUPPLIER: "supplier",
};

export const TYPE_TAB_LABELS = {
  [TYPE_TABS.CLIENT]: "Клиент",
  [TYPE_TABS.SUPPLIER]: "Поставщик",
};

/** Типы контрагента в API */
export const COUNTERPARTY_TYPES = {
  CLIENT: "CLIENT",
  SUPPLIER: "SUPPLIER",
  BOTH: "BOTH",
};

export const COUNTERPARTY_TYPE_LABELS = {
  [COUNTERPARTY_TYPES.CLIENT]: "Клиент",
  [COUNTERPARTY_TYPES.SUPPLIER]: "Поставщик",
  [COUNTERPARTY_TYPES.BOTH]: "Клиент и поставщик",
};

/** Типы API для каждой вкладки (BOTH показывается и у клиентов, и у поставщиков) */
export const TYPE_TAB_API_TYPES = {
  [TYPE_TABS.CLIENT]: [COUNTERPARTY_TYPES.CLIENT, COUNTERPARTY_TYPES.BOTH],
  [TYPE_TABS.SUPPLIER]: [COUNTERPARTY_TYPES.SUPPLIER, COUNTERPARTY_TYPES.BOTH],
};

export const getCounterpartyTypesForTab = (typeTab) =>
  TYPE_TAB_API_TYPES[typeTab] ?? TYPE_TAB_API_TYPES[TYPE_TABS.CLIENT];

export const filterCounterpartiesByTypeTab = (list, typeTab) => {
  if (!Array.isArray(list)) return [];
  const allowed = new Set(getCounterpartyTypesForTab(typeTab));
  return list.filter((c) => allowed.has(c?.type));
};

export const getCounterpartyTypeLabel = (type) =>
  COUNTERPARTY_TYPE_LABELS[type] || type || "—";

/** Реквизиты контрагента (ИНН, ОКПО, р/с, БИК, адрес) */
export const EMPTY_COUNTERPARTY_LEGAL = {
  inn: "",
  okpo: "",
  score: "",
  bik: "",
  address: "",
};

export const COUNTERPARTY_LEGAL_FIELDS = [
  { name: "inn", label: "ИНН", placeholder: "Введите ИНН" },
  { name: "okpo", label: "ОКПО", placeholder: "Введите ОКПО" },
  { name: "score", label: "Р/с", placeholder: "Введите расчётный счёт" },
  { name: "bik", label: "БИК", placeholder: "Введите БИК" },
  { name: "address", label: "Адрес", placeholder: "Введите адрес" },
];

export const getInitialViewMode = () => {
  if (typeof window === "undefined") return VIEW_MODES.TABLE;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === VIEW_MODES.TABLE || saved === VIEW_MODES.CARDS) return saved;

  const isSmall = window.matchMedia("(max-width: 1199px)").matches;
  return isSmall ? VIEW_MODES.CARDS : VIEW_MODES.TABLE;
};
