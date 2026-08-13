export const MAX_DAY_INSTALLMENTS = 90;
export const MAX_MONTH_INSTALLMENTS = 24;
export const MAX_DAY_INTERVAL = 30;
export const MAX_MONTH_INTERVAL = 12;
export const DEFAULT_DAY_INTERVAL = 1;
export const DEFAULT_MONTH_INTERVAL = 1;
export const DAY_SCHEDULE_PRESETS = [1, 7, 10, 14, 30];
export const MONTH_SCHEDULE_PRESETS = [1, 2, 3, 6, 12];
export const DAY_INTERVAL_PRESETS = [1, 2, 3, 7];
export const MONTH_INTERVAL_PRESETS = [1, 2, 3, 6];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function pad2(value) {
  return String(value).padStart(2, "0");
}

export function formatIsoDate(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function todayIsoDate() {
  const now = new Date();
  return formatIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function parseIsoDate(iso) {
  const match = ISO_DATE.exec(String(iso || "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function addDaysToIso(iso, days) {
  const parsed = parseIsoDate(iso);
  if (!parsed) return "";
  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  date.setDate(date.getDate() + Number(days || 0));
  return formatIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export function addMonthsToIso(iso, months) {
  const parsed = parseIsoDate(iso);
  if (!parsed) return "";
  const totalMonths = parsed.year * 12 + (parsed.month - 1) + Number(months || 0);
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  const day = Math.min(parsed.day, daysInMonth(year, month));
  return formatIsoDate(year, month, day);
}

export function defaultFirstDueDate(unit) {
  const today = todayIsoDate();
  return unit === "month" ? addMonthsToIso(today, 1) : addDaysToIso(today, 1);
}

export function defaultScheduleCount(unit) {
  return unit === "month" ? 3 : 7;
}

export function maxInstallmentsForUnit(unit) {
  return unit === "month" ? MAX_MONTH_INSTALLMENTS : MAX_DAY_INSTALLMENTS;
}

export function moneyToCents(value) {
  return Math.round((Number(value) || 0) * 100);
}

export function centsToMoney(cents) {
  return Math.round(cents) / 100;
}

export function formatMoneyAmount(value) {
  return centsToMoney(moneyToCents(value)).toFixed(2);
}

/** Equal split in cents; remainder goes to the last installment. */
export function splitMoneyEvenly(total, count) {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  if (safeCount < 1) return [];
  const cents = moneyToCents(total);
  const base = Math.floor(cents / safeCount);
  const remainder = cents - base * safeCount;
  return Array.from({ length: safeCount }, (_, index) =>
    centsToMoney(base + (index === safeCount - 1 ? remainder : 0)),
  );
}

export function normalizeDayInterval(value) {
  const n = Math.floor(Number(value) || 0);
  if (n < 1) return DEFAULT_DAY_INTERVAL;
  return Math.min(MAX_DAY_INTERVAL, n);
}

export function normalizeMonthInterval(value) {
  const n = Math.floor(Number(value) || 0);
  if (n < 1) return DEFAULT_MONTH_INTERVAL;
  return Math.min(MAX_MONTH_INTERVAL, n);
}

export function normalizeScheduleInterval(unit, value) {
  return unit === "month"
    ? normalizeMonthInterval(value)
    : normalizeDayInterval(value);
}

export function maxIntervalForUnit(unit) {
  return unit === "month" ? MAX_MONTH_INTERVAL : MAX_DAY_INTERVAL;
}

export function defaultIntervalForUnit(unit) {
  return unit === "month" ? DEFAULT_MONTH_INTERVAL : DEFAULT_DAY_INTERVAL;
}

export function buildDebtSchedule({
  remainingAmount,
  unit,
  count,
  firstDueDate,
  intervalDays = DEFAULT_DAY_INTERVAL,
  intervalMonths = DEFAULT_MONTH_INTERVAL,
}) {
  const safeCount = Math.floor(Number(count) || 0);
  const remaining = Number(remainingAmount);
  const step =
    unit === "day"
      ? normalizeDayInterval(intervalDays)
      : normalizeMonthInterval(intervalMonths);
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  if (safeCount < 1) return null;
  if (safeCount > maxInstallmentsForUnit(unit)) return null;
  if (!parseIsoDate(firstDueDate)) return null;

  const amounts = splitMoneyEvenly(remaining, safeCount);
  const installments = amounts.map((amount, index) => {
    const dueDate =
      unit === "month"
        ? addMonthsToIso(firstDueDate, index * step)
        : addDaysToIso(firstDueDate, index * step);
    return {
      number: index + 1,
      amount,
      amountStr: formatMoneyAmount(amount),
      dueDate,
    };
  });

  if (installments.some((item) => !item.dueDate)) return null;

  return {
    unit,
    count: safeCount,
    intervalDays: unit === "day" ? step : DEFAULT_DAY_INTERVAL,
    intervalMonths: unit === "month" ? step : DEFAULT_MONTH_INTERVAL,
    remainingAmount: centsToMoney(moneyToCents(remaining)),
    perPeriod: installments[0]?.amount ?? 0,
    lastAmount: installments[installments.length - 1]?.amount ?? 0,
    firstDueDate: installments[0]?.dueDate ?? firstDueDate,
    lastDueDate: installments[installments.length - 1]?.dueDate ?? firstDueDate,
    installments,
  };
}

export function toDealInstallments(schedule) {
  if (!schedule) return [];
  return schedule.installments.map((item) => ({
    number: item.number,
    amount: item.amountStr,
    due_date: item.dueDate,
  }));
}

export function scheduleCountLabel(unit, count) {
  const n = Math.floor(Number(count) || 0);
  if (unit === "month") {
    if (n === 1) return "месяц";
    if (n >= 2 && n <= 4) return "месяца";
    return "месяцев";
  }
  if (n === 1) return "день";
  if (n >= 2 && n <= 4) return "дня";
  return "дней";
}

export function paymentCountLabel(count) {
  const abs = Math.abs(Math.floor(Number(count) || 0));
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 14) return "платежей";
  if (mod10 === 1) return "платёж";
  if (mod10 >= 2 && mod10 <= 4) return "платежа";
  return "платежей";
}

export function dayIntervalLabel(interval) {
  const n = normalizeDayInterval(interval);
  if (n === 1) return "каждый день";
  if (n === 2) return "через день";
  return `каждые ${n} ${scheduleCountLabel("day", n)}`;
}

export function dayIntervalPresetLabel(interval) {
  if (interval === 1) return "Каждый день";
  if (interval === 2) return "Через день";
  if (interval === 3) return "Через 3 дня";
  if (interval === 7) return "Раз в неделю";
  return `Каждые ${interval} дн.`;
}

export function monthIntervalLabel(interval) {
  const n = normalizeMonthInterval(interval);
  if (n === 1) return "каждый месяц";
  return `каждые ${n} ${scheduleCountLabel("month", n)}`;
}

export function monthIntervalPresetLabel(interval) {
  if (interval === 1) return "Каждый месяц";
  if (interval === 2) return "Раз в 2 месяца";
  if (interval === 3) return "Раз в 3 месяца";
  if (interval === 6) return "Раз в полгода";
  return `Каждые ${interval} мес.`;
}

export function formatIsoDateRu(iso) {
  const parsed = parseIsoDate(iso);
  if (!parsed) return "—";
  return `${pad2(parsed.day)}.${pad2(parsed.month)}.${parsed.year}`;
}
