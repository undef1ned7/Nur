// RecordaUtils.js
export const pad = (n) => String(n).padStart(2, "0");
export const norm = (s) => String(s || "").trim();

export const normalizePhone = (p) => norm(p).replace(/[^\d]/g, "");
export const isValidPhone = (p) => normalizePhone(p).length >= 10;
export const normalizeName = (s) =>
  norm(s).replace(/\s+/g, " ").toLowerCase();

export const toDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d)) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const TZ = "+06:00";
export const makeISO = (date, time) => `${date}T${time}:00${TZ}`;
export const ts = (iso) => new Date(iso).getTime();

export const overlaps = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

export const OPEN_HOUR = 9;
export const CLOSE_HOUR = 21;

export const minsOf = (hhmm) => {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const inRange = (hhmm) => {
  const mm = minsOf(hhmm);
  return mm >= OPEN_HOUR * 60 && mm <= CLOSE_HOUR * 60;
};

export const clampToRange = (hhmm) => {
  const mm = minsOf(hhmm);
  if (mm < OPEN_HOUR * 60) return `${pad(OPEN_HOUR)}:00`;
  if (mm > CLOSE_HOUR * 60) return `${pad(CLOSE_HOUR)}:00`;
  return hhmm;
};

export const fmtMoney = (v) =>
  v === null || v === undefined || v === ""
    ? "—"
    : `${Number(v).toLocaleString("ru-RU")} сом`;

export const BLOCKING = new Set([
  "booked",
  "confirmed",
  "completed",
  "no_show",
]);

export const STATUS_LABELS = {
  booked: "Забронировано",
  confirmed: "Подтверждено",
  completed: "Завершено",
  canceled: "Отменено",
  no_show: "Не пришёл",
};

/* парсинг процента скидки */
export const parsePercent = (raw) => {
  if (raw == null || raw === "") return null;
  const s = String(raw).replace(",", ".").replace(/[^\d.\-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/* финальная цена */
export const calcFinalPrice = (base, discountPercent) => {
  if (!Number.isFinite(base) || base <= 0) return null;
  if (!Number.isFinite(discountPercent) || discountPercent === 0) {
    return base;
  }
  const val = Math.round(base * (1 - discountPercent / 100));
  return val < 0 ? 0 : val;
};
