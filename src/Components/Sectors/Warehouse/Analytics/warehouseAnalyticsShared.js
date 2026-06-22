export const PERIODS = [
  { value: "day", label: "День" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "custom", label: "Период" },
];

export const formatNum = (v) => {
  const n = Number(v);
  if (v == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(n);
};

export const formatShortDate = (s) => {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return String(s);
  }
};

export const cashRegisterRowLabel = (row) => {
  if (row.account_name) return row.account_name;
  if (row.kind === "warehouse_legacy" || row.cash_register == null) {
    return (
      row.warehouse_name ??
      row.warehouse?.name ??
      row.warehouse?.warehouse_name ??
      "Склад (без кассы)"
    );
  }
  return (
    row.cash_register?.name ??
    row.register_name ??
    row.cash_register_name ??
    "—"
  );
};

export const cashRegisterAmounts = (row) => ({
  receipt: row.receipt_amount ?? row.money_receipt_amount ?? 0,
  expense: row.expense_amount ?? row.money_expense_amount ?? 0,
  net: row.net_amount ?? row.money_net_amount ?? 0,
  debtReceipt: row.money_debt_receipt_amount ?? 0,
  debtExpense: row.money_debt_expense_amount ?? 0,
  debtNet: row.money_debt_net_amount ?? 0,
  counterpartyReceipt: row.money_counterparty_receipt_amount ?? 0,
  counterpartyExpense: row.money_counterparty_expense_amount ?? 0,
  counterpartyNet: row.money_counterparty_net_amount ?? 0,
});

export const moneyCategoryLabel = (row) => {
  const name =
    row.category_title ??
    row.category_name ??
    row.name ??
    row.category?.name;
  if (name != null && String(name).trim() !== "") return String(name);
  return "Без категории";
};

export const buildAnalyticsPeriodParams = ({
  period,
  date,
  dateFrom,
  dateTo,
  extra = {},
}) => {
  const params = { period, ...extra };
  if (period === "custom") {
    params.date_from = dateFrom;
    params.date_to = dateTo;
  } else {
    params.date = date;
  }
  return params;
};

export const extractWarehouseApiError = (
  e,
  fallback = "Не удалось загрузить данные",
) => {
  if (!e) return fallback;
  if (typeof e === "string") return e;
  const d = e.detail ?? e.message;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.length) return String(d[0]);
  return fallback;
};
