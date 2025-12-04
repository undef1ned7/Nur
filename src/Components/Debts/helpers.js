export const money = (v) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(
    Math.round(Number(v) || 0)
  ) + " с";

export const num = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export const getDebtAmount = (item) =>
  num(item?.balance != null ? item.balance : item.amount);

export const phoneNorm = (p) => (p || "").replace(/[^\d+]/g, "");

export const toYMD = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${toYMD(d)} ${hh}:${mm}`;
};

export const inRange = (iso, fromStr, toStr) => {
  if (!fromStr && !toStr) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const from = fromStr ? new Date(`${fromStr}T00:00:00`).getTime() : -Infinity;
  const to = toStr
    ? new Date(`${toStr}T23:59:59.999`).getTime()
    : +Infinity;
  return t >= from && t <= to;
};

export const listFrom = (res) =>
  Array.isArray(res?.data?.results)
    ? res.data.results
    : Array.isArray(res?.data)
    ? res.data
    : [];

export const extractApiErr = (e, fallback = "Ошибка запроса") => {
  try {
    const data = e?.response?.data;
    if (!data) return fallback;
    if (typeof data === "string") return data;
    if (Array.isArray(data)) return data.join("; ");
    const parts = [];
    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v)) parts.push(`${k}: ${v.join(", ")}`);
      else parts.push(`${k}: ${String(v)}`);
    }
    return parts.join("; ");
  } catch {
    return fallback;
  }
};

export const getDebtStatus = (dueDate) => {
  if (!dueDate)
    return { status: "no-date", color: "#6b7280", text: "Без срока" };

  const today = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: "overdue",
      color: "#dc2626",
      text: `Просрочен на ${Math.abs(diffDays)} дн.`,
    };
  } else if (diffDays === 0) {
    return { status: "due-today", color: "#ea580c", text: "Срок сегодня" };
  } else if (diffDays === 1) {
    return { status: "due-tomorrow", color: "#f59e0b", text: "Срок завтра" };
  } else if (diffDays <= 3) {
    return {
      status: "due-soon",
      color: "#f59e0b",
      text: `Осталось ${diffDays} дн.`,
    };
  } else {
    return {
      status: "normal",
      color: "#059669",
      text: `Осталось ${diffDays} дн.`,
    };
  }
};

export const checkNotifications = (items) => {
  const notifications = [];
  const today = new Date();

  items.forEach((item) => {
    if (getDebtAmount(item) <= 0) return;

    if (item.due_date) {
      const due = new Date(item.due_date);
      const diffTime = due.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        notifications.push({
          type: "warning",
          message: `Долг ${item.name} должен быть возвращен завтра!`,
          item,
        });
      } else if (diffDays < 0) {
        notifications.push({
          type: "error",
          message: `Долг ${item.name} просрочен на ${Math.abs(diffDays)} дней!`,
          item,
        });
      }
    }
  });

  return notifications;
};
