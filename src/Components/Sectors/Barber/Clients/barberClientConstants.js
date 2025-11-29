// barberClientConstants.js

export const UI_TO_API_STATUS = {
  Активен: "active",
  Неактивен: "inactive",
  VIP: "vip",
  "В черном списке": "blacklist",
};

export const API_TO_UI_STATUS = {
  active: "Активен",
  inactive: "Неактивен",
  vip: "VIP",
  blacklist: "В черном списке",
};

export const STATUS_OPTIONS_UI = Object.keys(UI_TO_API_STATUS);

export const STATUS_FILTER_ALL = "Все статусы";
export const STATUS_FILTER_OPTIONS = [STATUS_FILTER_ALL, ...STATUS_OPTIONS_UI];

/*
  ранги групп для сортировки:
   0 — верх: Активен и VIP
   1 — середина: Неактивен
   2 — низ: В черном списке
*/
const STATUS_RANK = {
  Активен: 0,
  VIP: 0,
  Неактивен: 1,
  "В черном списке": 2,
};

export const rankOf = (ui) => STATUS_RANK[ui] ?? 1;

export const PAGE_SIZE = 15;
