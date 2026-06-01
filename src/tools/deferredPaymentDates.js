export const getTodayIsoDate = () => new Date().toISOString().split("T")[0];

export const addCalendarDaysToIso = (days) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + (Number(days) || 0));
  return d.toISOString().split("T")[0];
};

export const calcDaysUntilIsoDate = (isoDate) => {
  if (!isoDate) return 30;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return 30;
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
};

export const formatDaysLabel = (days) => {
  const n = Number(days);
  if (!Number.isFinite(n)) return "дней";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
};
