export const TREATY_TYPE_LABELS = {
  construction_department: "Строительный отдел",
  sale: "Продажа",
  booking: "Бронь",
  procurement: "Закупки",
  other: "Прочее",
};

export const TREATY_TYPE_OPTIONS = Object.entries(TREATY_TYPE_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  }),
);

export const WORK_PROCUREMENT_PAYMENT_MODE_LABELS = {
  cash: "Наличные",
  debt: "В долг",
  barter: "Бартер",
  mixed: "Смешанная",
};

export const WORK_PROCUREMENT_PAYMENT_MODE_OPTIONS = Object.entries(
  WORK_PROCUREMENT_PAYMENT_MODE_LABELS,
).map(([value, label]) => ({
  value,
  label,
}));
