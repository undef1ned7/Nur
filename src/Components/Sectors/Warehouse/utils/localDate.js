/**
 * Дата в формате YYYY-MM-DD по локальному времени пользователя.
 *
 * `toISOString()` переводит в UTC: в Бишкеке (UTC+6) с 00:00 до 06:00
 * «сегодня» превращалось во вчера, и аналитика за день показывала не тот день.
 */
export const toLocalISODate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Та же дата месяц назад (локально). */
export const monthAgoLocalISODate = (from = new Date()) => {
  const d = new Date(from);
  d.setMonth(d.getMonth() - 1);
  return toLocalISODate(d);
};

const pad2 = (n) => String(n).padStart(2, "0");

/** Смещение часового пояса для ISO: «+06:00». */
const tzOffsetISO = (d) => {
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
};

/**
 * Локальные дата и время с часовым поясом: «2026-10-08T14:23:05+06:00».
 * `toISOString()` дал бы UTC («…T08:23:05Z»), а бэк ставит номер и день по дате.
 */
export const toLocalISODateTime = (d = new Date()) =>
  `${toLocalISODate(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(
    d.getSeconds(),
  )}${tzOffsetISO(d)}`;

/**
 * Дата из `<input type="date">` (YYYY-MM-DD) → datetime для API (QA B32).
 * Время берём текущее, а не 00:00: если дата не менялась — это текущий момент,
 * если выбрали другой день — тот день с текущим временем.
 */
export const dateInputToLocalDateTime = (dateStr, now = new Date()) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || "").trim());
  if (!m) return toLocalISODateTime(now);
  const d = new Date(now);
  d.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return toLocalISODateTime(d);
};
