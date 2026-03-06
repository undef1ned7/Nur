// HistoryUtils.js
export const PAGE_SIZE = 50;

export const pad = (n) => String(n).padStart(2, "0");

export const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

export const norm = (s) =>
  String(s || "")
    .trim()
    .toLowerCase();

export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const dateISO = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const t = d.getTime();
  if (!Number.isFinite(t)) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const timeISO = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const t = d.getTime();
  if (!Number.isFinite(t)) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const fmtMoney = (v) => {
  const n = num(v);
  if (n === null) return "—";
  return `${n.toLocaleString("ru-RU")} сом`;
};

/* ===== name helpers ===== */
export const fullNameEmp = (e) =>
  [e?.last_name || "", e?.first_name || ""].filter(Boolean).join(" ").trim() ||
  e?.email ||
  "—";

export const barberNameOf = (a, employees) => {
  if (a?.barber_name) return a.barber_name;
  if (a?.employee_name) return a.employee_name;
  if (a?.master_name) return a.master_name;

  const barberId = (a?.barber && typeof a.barber === "object" ? a.barber.id : a?.barber) ?? a?.barber_id;
  const e = employees.find((x) => String(x.id) === String(barberId));
  return e ? fullNameEmp(e) : "—";
};

export const serviceNamesFromRecord = (r, services) => {
  if (Array.isArray(r?.services_names) && r.services_names.length)
    return r.services_names.join(", ");

  if (Array.isArray(r?.services) && r.services.length) {
    const m = new Map(services.map((s) => [String(s.id), s]));
    const names = r.services.map((id) => {
      const s = m.get(String(id));
      return s?.service_name || s?.name || id;
    });
    return names.join(", ");
  }

  return r?.service_name || "—";
};

export const clientNameOf = (r, clients) => {
  if (r?.client_name) return r.client_name;
  const clientId = (r?.client && typeof r.client === "object" ? r.client.id : r?.client) ?? r?.client_id;
  const c = clients.find((x) => String(x.id) === String(clientId));
  return c?.full_name || c?.name || "—";
};

// NOTE: не используется в History.jsx прямо сейчас (может пригодиться в другом месте)
export const clientPhoneOf = (r, clients) => {
  if (r?.client_phone) return r.client_phone;
  const clientId = (r?.client && typeof r.client === "object" ? r.client.id : r?.client) ?? r?.client_id;
  const c = clients.find((x) => String(x.id) === String(clientId));
  return c?.phone || c?.phone_number || "";
};

/* ===== price helpers ===== */
export const priceOfAppointment = (a, services) => {
  const candidates = [
    a?.price,
    a?.total,
    a?.total_price,
    a?.total_amount,
    a?.final_total,
    a?.payable_total,
    a?.grand_total,
    a?.sum,
    a?.amount,
    a?.service_total,
    a?.services_total,
    a?.service_price,
    a?.discounted_total,
    a?.price_total,
  ];

  for (const c of candidates) {
    const n = num(c);
    if (n !== null) return n;
  }

  if (Array.isArray(a?.services_details) && a.services_details.length) {
    const s = a.services_details.reduce((acc, it) => acc + (num(it?.price) || 0), 0);
    if (s > 0) return s;
  }

  if (Array.isArray(a?.services) && a.services.length) {
    const m = new Map(services.map((s) => [String(s.id), s]));
    const s = a.services.reduce((acc, id) => acc + (num(m.get(String(id))?.price) || 0), 0);
    if (s > 0) return s;
  }

  return null;
};

export const basePriceOfAppointment = (a, services) => {
  const candidates = [
    a?.base_price,
    a?.price_before_discount,
    a?.full_price,
    a?.sum_before_discount,
  ];

  for (const c of candidates) {
    const n = num(c);
    if (n !== null) return n;
  }

  const totalPrice = priceOfAppointment(a, services);
  const discountRaw = a?.discount_percent ?? a?.discount ?? a?.discount_value ?? null;
  const discountPct = num(discountRaw);

  if (
    discountPct !== null &&
    discountPct > 0 &&
    discountPct < 100 &&
    totalPrice !== null
  ) {
    const base = Math.round(totalPrice / (1 - discountPct / 100));
    if (base > totalPrice) return base;
  }

  if (Array.isArray(a?.services_details) && a.services_details.length) {
    const s = a.services_details.reduce((acc, it) => acc + (num(it?.price) || 0), 0);
    if (s > 0) return s;
  }

  if (Array.isArray(a?.services) && a.services.length) {
    const m = new Map(services.map((s) => [String(s.id), s]));
    const s = a.services.reduce((acc, id) => acc + (num(m.get(String(id))?.price) || 0), 0);
    if (s > 0) return s;
  }

  return totalPrice;
};

export const discountPercentOfAppointment = (a, basePrice, totalPrice) => {
  const direct = a?.discount_percent ?? a?.discount ?? a?.discount_value ?? null;
  const nDirect = num(direct);
  if (nDirect !== null) {
    const x = Math.round(nDirect);
    return Math.max(0, Math.min(100, x));
  }

  const base = num(basePrice);
  const total = num(totalPrice);
  if (base && total && base > total) {
    const pct = Math.round((1 - total / base) * 100);
    if (pct > 0) return Math.max(0, Math.min(100, pct));
  }

  return null;
};

/* ===== парсим ввод ДД.ММ.ГГГГ (опц. время) ===== */
export const parseUserDate = (str) => {
  const txt = String(str || "").trim();
  if (!txt) return "";

  const m = txt.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!m) return "";

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const hasTime = m[4] !== undefined && m[5] !== undefined;
  const hh = hasTime ? Number(m[4]) : 0;
  const mi = hasTime ? Number(m[5]) : 0;

  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return "";
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return "";
  if (yyyy < 1900 || yyyy > 2500) return "";

  if (hasTime) {
    if (!Number.isFinite(hh) || !Number.isFinite(mi)) return "";
    if (hh < 0 || hh > 23 || mi < 0 || mi > 59) return "";
  }

  // валидация реальной даты (например 31.02)
  const dt = new Date(yyyy, mm - 1, dd, hh, mi, 0);
  if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return "";

  const MM = pad(mm);
  const DD = pad(dd);

  if (hasTime) return `${yyyy}-${MM}-${DD}T${pad(hh)}:${pad(mi)}:00`;
  return `${yyyy}-${MM}-${DD}`;
};

/* ===== статус ===== */
export const statusLabel = (s) =>
  s === "booked"
    ? "Забронировано"
    : s === "confirmed"
    ? "Подтверждено"
    : s === "completed"
    ? "Завершено"
    : s === "canceled"
    ? "Отменено"
    : s === "no_show"
    ? "Не пришёл"
    : s || "—";

/* ===== дата / фильтры ===== */
export const getYMD = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  };
};

export const monthNames = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];
