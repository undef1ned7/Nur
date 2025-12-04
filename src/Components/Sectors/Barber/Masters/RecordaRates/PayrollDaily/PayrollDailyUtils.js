// PayrollDailyUtils.js

const pad2 = (n) => String(n).padStart(2, "0");

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export const toDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export const monthLabelOf = (yyyyMmDd) => yyyyMmDd.slice(0, 7);

export const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

export const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const fmtInt = (n) => Number(n || 0).toLocaleString("ru-RU");

export const fmtMoney = (n) =>
  `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(toNum(n))} сом`;

export const isCompleted = (s) =>
  [
    "completed",
    "done",
    "finished",
    "завершено",
    "завершен",
    "закрыт",
    "оплачен",
  ].includes(String(s || "").trim().toLowerCase());
