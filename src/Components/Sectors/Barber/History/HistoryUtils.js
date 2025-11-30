/* ===== utils ===== */
export const PAGE_SIZE = 12;

export const pad = (n) => String(n).padStart(2, "0");

export const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

export const norm = (s) =>
  String(s || "")
    .trim()
    .toLowerCase();

export const dateISO = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d)) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const timeISO = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d)) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const fmtMoney = (v) =>
  v === null || v === undefined || v === ""
    ? "—"
    : `${Number(v).toLocaleString("ru-RU")} сом`;

/* ===== name helpers ===== */
export const fullNameEmp = (e) =>
  [e?.last_name || "", e?.first_name || ""].filter(Boolean).join(" ").trim() ||
  e?.email ||
  "—";

export const barberNameOf = (a, employees) => {
  if (a?.barber_name) return a.barber_name;
  if (a?.employee_name) return a.employee_name;
  if (a?.master_name) return a.master_name;
  const e = employees.find((x) => String(x.id) === String(a?.barber));
  return e ? fullNameEmp(e) : "—";
};

export const serviceNamesFromRecord = (r, services) => {
  if (Array.isArray(r.services_names) && r.services_names.length)
    return r.services_names.join(", ");
  if (Array.isArray(r.services) && r.services.length) {
    const m = new Map(services.map((s) => [String(s.id), s]));
    const names = r.services.map(
      (id) => m.get(String(id))?.service_name || m.get(String(id))?.name || id
    );
    return names.join(", ");
  }
  return r.service_name || "—";
};

export const clientNameOf = (r, clients) => {
  if (r.client_name) return r.client_name;
  const c = clients.find((x) => String(x.id) === String(r.client));
  return c?.full_name || c?.name || "—";
};

export const clientPhoneOf = (r, clients) => {
  if (r.client_phone) return r.client_phone;
  const c = clients.find((x) => String(x.id) === String(r.client));
  return c?.phone || c?.phone_number || "";
};

/* ===== price resolver ===== */
export const priceOfAppointment = (a, services) => {
  const candidates = [
    a.total,
    a.total_price,
    a.total_amount,
    a.final_total,
    a.payable_total,
    a.grand_total,
    a.sum,
    a.amount,
    a.service_total,
    a.services_total,
    a.service_price,
    a.price,
    a.discounted_total,
    a.price_total,
  ];
  for (const c of candidates) {
    const n = num(c);
    if (n !== null) return n;
  }

  if (Array.isArray(a.services_details) && a.services_details.length) {
    const s = a.services_details.reduce(
      (acc, it) => acc + (num(it?.price) || 0),
      0
    );
    if (s > 0) return s;
  }

  if (Array.isArray(a.services) && a.services.length) {
    const m = new Map(services.map((s) => [String(s.id), s]));
    const s = a.services.reduce(
      (acc, id) => acc + (num(m.get(String(id))?.price) || 0),
      0
    );
    if (s > 0) return s;
  }

  return null;
};

/* базовая цена без скидки, как в MastersHistory */
export const basePriceOfAppointment = (a, services) => {
  const candidates = [
    a.base_price,
    a.price_before_discount,
    a.full_price,
    a.sum_before_discount,
  ];
  for (const c of candidates) {
    const n = num(c);
    if (n !== null) return n;
  }
  return priceOfAppointment(a, services);
};

export const discountPercentOfAppointment = (a, basePrice, totalPrice) => {
  const direct = a.discount_percent ?? a.discount ?? a.discount_value ?? null;
  const nDirect = num(direct);
  if (nDirect !== null) return nDirect;

  const base = num(basePrice);
  const total = num(totalPrice);
  if (base && total && base > total) {
    const pct = Math.round((1 - total / base) * 100);
    if (pct > 0) return pct;
  }
  return null;
};

/* ===== парсим ввод ДД.ММ.ГГГГ (опц. время) ===== */
export const parseUserDate = (str) => {
  const txt = String(str || "").trim();
  if (!txt) return "";
  const m =
    txt.match(
      /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$/
    ) || txt.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return "";
  const dd = m[1];
  const mm = m[2];
  const yyyy = m[3];
  const hh = m[4];
  const mi = m[5];
  if (hh && mi) {
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:00`;
  }
  return `${yyyy}-${mm}-${dd}`;
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
