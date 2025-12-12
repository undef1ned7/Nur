
export const listFrom = (res) => res?.data?.results || res?.data || [];

export const toDecimalString = (v) => {
  const s = String(v ?? "")
    .replace(",", ".")
    .trim();
  if (s === "" || s === "-") return "0.00";
  const n = Number(s);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

export const kindLabel = (v) =>
  ({ sale: "Продажа", debt: "Долг", prepayment: "Предоплата" }[v] || v || "—");

export const ruStatusToKind = (s) => {
  if (!s) return "sale";
  const t = s.toLowerCase();
  if (t.startsWith("долг")) return "debt"; 
  if (t.startsWith("аванс")) return "prepayment";
  if (t.startsWith("предоплат")) return "prepayment";
  return "sale";
};

export const kindToRu = (k) =>
  ({ sale: "Продажа", debt: "Долг", prepayment: "Предоплата" }[k] || "Продажа");

export const typeLabel = (t) => {
  const v = String(t || "").toLowerCase();
  if (v === "client") return "Клиент";
  if (v === "suppliers") return "Поставщик";
  if (v === "implementers") return "Реализатор";
  return "—";
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
    monthly_payment: Number(d.monthly_payment ?? 0),
    debt_months: d.debt_months ?? null,

    note: d.note || "",
    client: d.client || null,
    created_at: d.created_at || null,
    updated_at: d.updated_at || null,
  };
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
