export const PROCUREMENT_STATUS_LABELS = {
  draft: "Черновик",
  submitted_to_cash: "На согласовании в кассе",
  cash_approved: "Одобрено кассой",
  cash_rejected: "Отклонено кассой",
  transfer_created: "Передача создана",
  transferred: "Передано на склад",
  partially_transferred: "Передача отклонена складом",
};

export const TRANSFER_STATUS_LABELS = {
  pending_receipt: "Ожидает решения склада",
  accepted: "Принято складом",
  rejected: "Отклонено складом",
};

export const statusLabel = (status, map) => map?.[status] || status || "—";

export const asCurrency = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KGS",
    maximumFractionDigits: 2,
  }).format(num);
};

export const asDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};
