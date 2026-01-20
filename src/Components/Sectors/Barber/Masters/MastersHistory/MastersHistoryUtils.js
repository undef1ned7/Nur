// MastersHistoryUtils.js

/* ===== базовые утилиты ===== */
export const PAGE_SIZE = 15;

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
  [e?.last_name || "", e?.first_name || ""]
    .filter(Boolean)
    .join(" ")
    .trim() ||
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

/* ===== price helpers ===== */
/**
 * Итоговая цена записи (после скидки) — то, что реально оплачено.
 * В первую очередь берём поле price, которое пишет Recorda.
 */
export const priceOfAppointment = (a, services) => {
  const candidates = [
    a.price, // главное поле из Recorda
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
    a.discounted_total,
    a.price_total,
  ];

  for (const c of candidates) {
    const n = num(c);
    if (n !== null) return n;
  }

  // если totals нет — пробуем собрать по услугам
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

/**
 * Базовая цена без скидки.
 * 1) base_price / price_before_discount / full_price / ...
 * 2) если есть скидка и итоговая цена — восстанавливаем base
 * 3) иначе — сумма цен услуг
 * 4) в крайнем случае — такая же, как итоговая
 */
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

  const totalPrice = priceOfAppointment(a, services);
  const discountRaw =
    a.discount_percent ?? a.discount ?? a.discount_value ?? null;
  const discountPct = num(discountRaw);

  // 1) если есть процент скидки и итог — восстанавливаем базовую
  if (
    discountPct !== null &&
    discountPct > 0 &&
    discountPct < 100 &&
    totalPrice !== null
  ) {
    const base = Math.round(totalPrice / (1 - discountPct / 100));
    if (base > totalPrice) return base;
  }

  // 2) пробуем по услугам (без учёта скидки)
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

  // 3) последний шанс — считаем, что скидки нет
  return totalPrice;
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

/* ===== status helper ===== */
export const statusLabel = (s) => {
  const labels = {
    booked: "Забронировано",
    confirmed: "Подтверждено",
    completed: "Завершено",
    canceled: "Отменено",
    no_show: "Не пришёл",
  };
  return labels[s] || s || "—";
};

/* ===== дата / фильтры ===== */
export const getYMD = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d)) return null;
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
