/**
 * Консалтинг: чистые утилиты списков — склонения, форматирование, периоды.
 * Вынесены из ListControls.jsx, чтобы файл компонентов экспортировал только
 * компоненты (иначе ломается hot-reload).
 */

const pick = (n, one, few, many) => {
  const abs = Math.abs(Number(n) || 0) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
};

export const plural = {
  records: (n) => pick(n, "запись", "записи", "записей"),
  leads: (n) => pick(n, "лид", "лида", "лидов"),
  clients: (n) => pick(n, "клиент", "клиента", "клиентов"),
  sales: (n) => pick(n, "продажа", "продажи", "продаж"),
  services: (n) => pick(n, "услуга", "услуги", "услуг"),
  employees: (n) => pick(n, "сотрудник", "сотрудника", "сотрудников"),
  requests: (n) => pick(n, "запрос", "запроса", "запросов"),
  operations: (n) => pick(n, "операция", "операции", "операций"),
  rules: (n) => pick(n, "правило", "правила", "правил"),
};

/** Быстрые пресеты периода — одинаковые во всех отчётах сектора. */
export const PERIOD_PRESETS = [
  { value: "today", label: "Сегодня" },
  { value: "yesterday", label: "Вчера" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
];

/** Date → YYYY-MM-DD в местной зоне (не UTC: иначе «сегодня» уезжает). */
export const toISODate = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const tz = dt.getTimezoneOffset() * 60000;
  return new Date(dt.getTime() - tz).toISOString().slice(0, 10);
};

/**
 * Границы периода по пресету. Вызывать только из обработчиков и эффектов:
 * функция читает текущее время и потому непригодна для расчёта в рендере.
 */
export function periodRange(preset, nowTs = Date.now()) {
  const now = new Date(nowTs);
  const today = toISODate(now);
  switch (preset) {
    case "today":
      return { date_from: today, date_to: today };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { date_from: toISODate(y), date_to: toISODate(y) };
    }
    case "week": {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { date_from: toISODate(from), date_to: today };
    }
    case "month": {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { date_from: toISODate(from), date_to: today };
    }
    default:
      return { date_from: "", date_to: "" };
  }
}

/** Текущий месяц в формате YYYY-MM. */
export const currentMonth = (nowTs = Date.now()) =>
  toISODate(new Date(nowTs)).slice(0, 7);

/* --------------------------- форматирование --------------------------- */

export const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const fmtInt = (v) => num(v).toLocaleString("ru-RU");

export const fmtMoney = (v, currency = "с") =>
  `${num(v).toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${currency}`.trim();

export const fmtPercent = (v, digits = 1) =>
  `${num(v).toLocaleString("ru-RU", { maximumFractionDigits: digits })}%`;

export const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("ru-RU");
};

export const fmtDateTime = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

/** Минуты → «12 мин» / «2 ч 30 мин» / «3.5 дн.». */
export const fmtDuration = (minutes) => {
  const m = num(minutes);
  if (!m) return "—";
  if (m < 60) return `${Math.round(m)} мин`;
  if (m < 60 * 24) {
    const h = Math.floor(m / 60);
    const rest = Math.round(m % 60);
    return rest ? `${h} ч ${rest} мин` : `${h} ч`;
  }
  return `${(m / 1440).toFixed(1)} дн.`;
};

/** ФИО сотрудника из объекта пользователя. */
export const employeeName = (e) =>
  [e?.last_name || "", e?.first_name || ""].filter(Boolean).join(" ").trim() ||
  e?.email ||
  "—";
