/**
 * Консалтинг: единый денежный контур (V2).
 * @see docs/consulting/backend-money-tenant/00-money-flow.md
 */

/** @returns {boolean} Использовать /consalting/cashbox/* вместо legacy construction/deals. */
export function isConsultingCashV2() {
  const raw = import.meta.env?.VITE_CONSULTING_CASH_V2;
  if (raw === undefined || raw === "") return true;
  return raw === "true" || raw === "1";
}

/** Русский статус сделки из sale.jsx → payment_mode API. */
export function mapDealStatusToPaymentMode(statusRu) {
  switch (String(statusRu || "").trim()) {
    case "Долги":
      return "debt";
    case "Предоплата":
      return "installment";
    case "Продажа":
    default:
      return "cash";
  }
}

export const TENANT_PROVISION_STATUS = {
  NONE: "none",
  PENDING: "pending",
  CREATED: "created",
  FAILED: "failed",
};

export const TENANT_PROVISION_LABELS = {
  [TENANT_PROVISION_STATUS.NONE]: "Не требуется",
  [TENANT_PROVISION_STATUS.PENDING]: "Ожидает кассы",
  [TENANT_PROVISION_STATUS.CREATED]: "Аккаунт создан",
  [TENANT_PROVISION_STATUS.FAILED]: "Ошибка создания",
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Счётчики кассовых заявок.
 * Бэк может отдать pending или pending_count.
 */
export function normalizeCashRequestCounters(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  const pending = num(d.pending ?? d.pending_count);
  const confirmed = num(d.confirmed ?? d.confirmed_count);
  const rejected = num(d.rejected ?? d.rejected_count);
  const all = num(d.all ?? d.total) || pending + confirmed + rejected;
  return {
    ...d,
    pending,
    pending_count: pending,
    confirmed,
    rejected,
    all,
    pending_amount: num(d.pending_amount),
  };
}

/** Приход/расход/баланс кассы: плоские поля бэка или analytics. */
export function cashboxTotals(row) {
  const income = num(
    row?.income_total ?? row?.analytics?.income?.total ?? row?.income,
  );
  const expense = num(
    row?.expense_total ??
      row?.analytics?.expense?.total ??
      row?.outcome_total ??
      row?.expense,
  );
  const balance = num(row?.balance ?? income - expense);
  return {
    income,
    expense,
    balance,
    pending_amount: num(row?.pending_amount),
  };
}

/**
 * Режим подтверждения кассы. Канон (см. backend-money-tenant/09-frontend-contract.md):
 *   required  — каждая продажа/абонплата создаёт заявку кассиру;
 *   cash_only — заявка только для наличных, перевод проводится сразу;
 *   off       — деньги сразу в остаток, tenant создаётся без кассира.
 * Легаси-алиасы: always → required, auto → off.
 */
export const CASH_CONFIRM_MODES = ["required", "cash_only", "off"];

export function normalizeCashConfirmMode(mode) {
  const m = String(mode || "").toLowerCase();
  if (m === "required" || m === "always") return "required";
  if (m === "cash_only") return "cash_only";
  if (m === "off" || m === "auto") return "off";
  return "cash_only";
}

export const CASH_CONFIRM_MODE_OPTIONS = [
  {
    value: "required",
    label: "Кассир подтверждает вручную",
    hint: "Каждая продажа и абонплата создаёт заявку в кассу.",
  },
  {
    value: "cash_only",
    label: "Только наличные",
    hint: "Переводы проводятся сразу, наличные ждут подтверждения кассира.",
  },
  {
    value: "off",
    label: "Автоподтверждение",
    hint: "Деньги сразу в остаток, CRM-аккаунт создаётся без кассира.",
  },
];

/** Расход: expense | outcome | out. */
export function isCashExpenseType(raw) {
  const t = String(raw || "").toLowerCase();
  return t === "expense" || t === "outcome" || t === "out";
}

/** Ответ register-payment: funnel может быть на корне или в lead. */
export function paymentMovedFunnelId(result) {
  if (!result || typeof result !== "object") return null;
  const lead = result.lead && typeof result.lead === "object" ? result.lead : null;
  const raw =
    result.funnel_id ??
    result.funnel ??
    lead?.funnel_id ??
    lead?.funnel ??
    null;
  if (raw && typeof raw === "object") {
    return raw.id != null ? String(raw.id) : null;
  }
  return raw != null && raw !== "" ? String(raw) : null;
}

/** Ответ create-client: client_id / client / merged. */
export function normalizeCreatedClient(data) {
  if (!data || typeof data !== "object") return data;
  const nested = data.client && typeof data.client === "object" ? data.client : null;
  const id = data.client_id ?? nested?.id ?? data.id;
  return {
    ...nested,
    ...data,
    id: id ?? nested?.id,
    client_id: id,
    merged: Boolean(data.merged),
    duplicate_warning: data.duplicate_warning || null,
    full_name: data.client_display || nested?.full_name || data.full_name,
  };
}
