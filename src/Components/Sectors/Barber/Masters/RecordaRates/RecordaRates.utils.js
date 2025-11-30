// RecordaRates.utils.js
export const PAGE_SIZE = 12;

export const pad2 = (n) => String(n).padStart(2, "0");

export const fmtInt = (n) => Number(n || 0).toLocaleString("ru-RU");

export const fmtMoney = (n) => `${Number(n || 0).toLocaleString("ru-RU")}с`;

export const KG_OFFSET_MS = 6 * 60 * 60 * 1000;

export const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

export const isCompleted = (s) =>
  String(s || "")
    .trim()
    .toLowerCase() === "completed";

export const y_m_fromISO = (iso) => {
  if (!iso) return null;
  const t = Date.parse(String(iso));
  if (!Number.isFinite(t)) return null;
  const d = new Date(t + KG_OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
};

export const y_m_fromStartAt = y_m_fromISO;

export const dateKG = (iso) => {
  const t = Date.parse(String(iso));
  if (!Number.isFinite(t)) return "";
  const d = new Date(t + KG_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
    d.getUTCDate()
  )}`;
};

export const toNum = (v) => {
  if (v === "" || v == null) return 0;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
