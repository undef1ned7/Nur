/** Общие хелперы Deals API (/main/clients/{id}/deals/) */

export const listFrom = (res) => res?.data?.results || res?.data || [];

export const toDecimalString = (v) => {
  const s = String(v ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/,/g, ".");
  if (s === "" || s === "-") return "0.00";
  const n = Number(s);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

export const kindLabel = (v) =>
  ({
    sale: "Продажа",
    debt: "Долг",
    prepayment: "Предоплата",
    amount: "Сумма",
  }[v] || v || "—");

export const ruStatusToKind = (s) => {
  if (!s) return "sale";
  const t = String(s).toLowerCase();
  if (t.startsWith("долг")) return "debt";
  if (t.startsWith("аванс") || t.startsWith("предоплат")) return "prepayment";
  if (t.startsWith("сумм")) return "amount";
  return "sale";
};

export const kindToRu = (k) =>
  ({
    sale: "Продажа",
    debt: "Долг",
    prepayment: "Предоплата",
    amount: "Сумма",
  }[k] || "Продажа");

export const typeLabel = (t) => {
  const v = String(t || "").toLowerCase();
  if (v === "client") return "Клиент";
  if (v === "suppliers") return "Поставщик";
  if (v === "implementers") return "Реализатор";
  return "—";
};

export const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const getInstallmentRemaining = (installment) => {
  if (installment?.paid_on) return 0;
  const amount = Number(installment?.amount || 0);
  const paid = Number(installment?.paid_amount || 0);
  const legacy = Number(installment?.remaining_for_period);
  if (Number.isFinite(legacy) && legacy >= 0 && !installment?.paid_amount) {
    return legacy;
  }
  return Math.max(0, amount - paid);
};

export const getInstallmentStatus = (installment) => {
  const paidAmount = Number(installment?.paid_amount || 0);
  const amount = Number(installment?.amount || 0);

  if (installment?.paid_on) {
    return { key: "paid", label: "Полностью оплачен" };
  }
  if (paidAmount > 0 && paidAmount < amount) {
    return { key: "partial", label: "Частично оплачен" };
  }
  const due = installment?.due_date
    ? String(installment.due_date).slice(0, 10)
    : "";
  if (due && due < todayISO()) {
    return { key: "overdue", label: "Просрочен" };
  }
  return { key: "unpaid", label: "Не оплачен" };
};

export const dealHasPayments = (deal) => {
  if (Array.isArray(deal?.payments) && deal.payments.length > 0) return true;
  if (!Array.isArray(deal?.installments)) return false;
  return deal.installments.some(
    (item) => item.paid_on || Number(item.paid_amount || 0) > 0,
  );
};

export const resolveDebtFromDeals = (deals) => {
  const list = Array.isArray(deals) ? deals : [];
  return list.reduce((sum, deal) => {
    if (String(deal?.kind || "").toLowerCase() !== "debt") return sum;
    const remaining = Number(deal?.remaining_debt);
    if (Number.isFinite(remaining)) return sum + Math.max(remaining, 0);
    const amount = Number(deal?.amount || 0);
    const prepayment = Number(deal?.prepayment || 0);
    return sum + Math.max(amount - prepayment, 0);
  }, 0);
};

export function normalizeDealFromApi(resOrObj) {
  const d = resOrObj?.data ?? resOrObj;
  return {
    id: d.id,
    title: d.title || "",
    kind: d.kind || "sale",
    amount: Number(d.amount ?? 0),
    prepayment: Number(d.prepayment ?? 0),
    remaining_debt: Number(d.remaining_debt ?? 0),
    debt_amount: Number(d.debt_amount ?? d.amount ?? 0),
    debt_days: d.debt_days ?? null,
    debt_months: d.debt_months ?? null,
    daily_payment: Number(d.daily_payment ?? 0),
    monthly_payment: Number(d.monthly_payment ?? d.daily_payment ?? 0),
    first_due_date: d.first_due_date ?? null,
    installments: Array.isArray(d.installments) ? d.installments : [],
    payments: Array.isArray(d.payments) ? d.payments : [],
    note: d.note || "",
    client: d.client || null,
    client_full_name: d.client_full_name || "",
    created_at: d.created_at || null,
    updated_at: d.updated_at || null,
  };
}

export function buildDealPayload({
  title,
  statusRu,
  amount,
  debt_days,
  first_due_date,
  prepayment,
  note,
  clientId,
  forCreate = false,
  paymentsExist = false,
}) {
  const kind = ruStatusToKind(statusRu);

  if (paymentsExist) {
    return {
      title: String(title || "").trim(),
      note: String(note || "").trim(),
    };
  }

  const payload = {
    title: String(title || "").trim(),
    kind,
    amount: toDecimalString(amount),
    note: String(note || "").trim(),
  };

  if (forCreate && clientId) {
    payload.client = clientId;
  }

  if (kind === "debt") {
    const days = parseInt(debt_days, 10);
    if (Number.isFinite(days) && days > 0) {
      payload.debt_days = days;
    }
    if (first_due_date && toYYYYMMDD(first_due_date)) {
      payload.first_due_date = toYYYYMMDD(first_due_date);
    }
    if (prepayment !== undefined && prepayment !== null && prepayment !== "") {
      payload.prepayment = toDecimalString(prepayment);
    }
    if (forCreate) {
      payload.auto_schedule = true;
    }
  }

  if (kind === "prepayment" && prepayment !== undefined && prepayment !== "") {
    payload.prepayment = toDecimalString(prepayment || amount);
  }

  return payload;
}

/** Нормализация входа для createDeals / createDeal */
export function normalizeDealCreateInput({ clientId, ...data }) {
  const kind = data.kind || ruStatusToKind(data.statusRu);
  const statusRu =
    data.statusRu ||
    (kind === "debt"
      ? "Долг"
      : kind === "prepayment"
        ? "Предоплата"
        : "Продажа");

  let debt_days = data.debt_days;
  if (
    (debt_days === undefined || debt_days === null || debt_days === "") &&
    data.debtMonths !== undefined &&
    data.debtMonths !== null &&
    data.debtMonths !== ""
  ) {
    debt_days = Math.round(Number(data.debtMonths) * 30);
  }
  if (
    (debt_days === undefined || debt_days === null || debt_days === "") &&
    data.debt_months !== undefined &&
    data.debt_months !== null &&
    data.debt_months !== ""
  ) {
    debt_days = Math.round(Number(data.debt_months) * 30);
  }

  return buildDealPayload({
    title: data.title,
    statusRu: data.statusRu || statusRu,
    amount: data.amount,
    debt_days,
    first_due_date: data.first_due_date,
    prepayment: data.prepayment,
    note: data.note ?? "",
    clientId,
    forCreate: true,
  });
}

export function msgFromError(e, fallback) {
  const data = e?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    try {
      const k = Object.keys(data)[0];
      const v = Array.isArray(data[k]) ? data[k][0] : data[k];
      return String(v || fallback);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export const toIsoDate10 = (v) => {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(v);
  if (isNaN(d)) return "";
  const y = d.getFullYear();
  const m2 = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m2}-${day}`;
};

export function toYYYYMMDD(input) {
  if (input == null) return "";

  if (typeof input === "string") {
    const s = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }

  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";

  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function formatDateDDMMYYYY(input) {
  if (!input) return "—";
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split("-");
    return `${d}.${m}.${y}`;
  }
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return String(input);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
