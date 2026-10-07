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
