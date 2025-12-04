// barberClientUtils.js

const pad = (n) => String(n).padStart(2, "0");

export const todayStr = () => new Date().toISOString().slice(0, 10);

export const normalizePhone = (p) => (p || "").replace(/[^\d]/g, "");

export const isValidPhone = (p) => normalizePhone(p).length >= 10;

export const normalizeName = (s) =>
  String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

export const getInitials = (fullName = "") =>
  fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");

export const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

/* парсер ошибок API для понятных сообщений */
export const parseApiError = (e, fallback = "Ошибка запроса.") => {
  const data = e?.response?.data;
  if (typeof data === "string") return data;

  if (data && typeof data === "object") {
    const arr = [];
    try {
      Object.values(data).forEach((v) =>
        arr.push(String(Array.isArray(v) ? v[0] : v))
      );
    } catch {
      // ignore
    }
    if (arr.length) return arr.join("; ");
  }

  const status = e?.response?.status;
  if (status) return `Ошибка ${status}`;
  return fallback;
};
