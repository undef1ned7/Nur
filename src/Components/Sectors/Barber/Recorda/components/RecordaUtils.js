// RecordaUtils.js
export const pad = (n) => String(n).padStart(2, "0");
export const norm = (s) => String(s || "").trim();

export const OPEN_HOUR = 9;
export const CLOSE_HOUR = 24;

export const defaultWorkBounds = () => ({
  work_start: `${pad(OPEN_HOUR)}:00`,
  work_end: "00:00",
  startMin: OPEN_HOUR * 60,
  endMin: CLOSE_HOUR * 60,
});

export const todayStr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
};

const END_OF_DAY_MIN = 24 * 60;

const toTimelineMin = (hhmm, bounds) => {
  let m = minsOf(hhmm);
  const endMin = bounds.endMin ?? CLOSE_HOUR * 60;
  const startMin = bounds.startMin ?? OPEN_HOUR * 60;
  if (endMin > END_OF_DAY_MIN && m < startMin) m += END_OF_DAY_MIN;
  return m;
};

/** Округление текущего времени вниз до ближайшего слота (30 мин по умолчанию) */
export const getNowSlot = (slotMin = 30, bounds = defaultWorkBounds()) => {
  const now = new Date();
  let mins = now.getHours() * 60 + now.getMinutes();
  const endMin = bounds.endMin ?? CLOSE_HOUR * 60;
  const startMin = bounds.startMin ?? OPEN_HOUR * 60;
  if (endMin > END_OF_DAY_MIN && mins < startMin) mins += END_OF_DAY_MIN;
  mins = Math.floor(mins / slotMin) * slotMin;
  if (mins < startMin) mins = startMin;
  if (mins > endMin) mins = endMin;
  const display = mins >= END_OF_DAY_MIN ? mins - END_OF_DAY_MIN : mins;
  const h = Math.floor(display / 60);
  const m = display % 60;
  return `${pad(h)}:${pad(m)}`;
};

/** Время по умолчанию для записи на конкретную дату */
export const defaultTimeForDate = (dateStr, slotMin = 30, bounds = defaultWorkBounds()) => {
  if (dateStr === todayStr()) return getNowSlot(slotMin, bounds);
  return bounds.work_start || `${pad(OPEN_HOUR)}:00`;
};

export const normalizePhone = (p) => norm(p).replace(/[^\d]/g, "");
export const isValidPhone = (p) => normalizePhone(p).length >= 10;
export const normalizeName = (s) =>
  norm(s).replace(/\s+/g, " ").toLowerCase();

export const toDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d)) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const TZ = "+06:00";
export const makeISO = (date, time) => `${date}T${time}:00${TZ}`;
export const ts = (iso) => new Date(iso).getTime();

export const overlaps = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

export const minsOf = (hhmm) => {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const inRange = (hhmm, bounds = defaultWorkBounds()) => {
  const mm = toTimelineMin(hhmm, bounds);
  return mm >= bounds.startMin && mm <= bounds.endMin;
};

export const clampToRange = (hhmm, bounds = defaultWorkBounds()) => {
  const mm = toTimelineMin(hhmm, bounds);
  if (mm < bounds.startMin) return bounds.work_start || `${pad(OPEN_HOUR)}:00`;
  if (mm > bounds.endMin) return bounds.work_end || `${pad(CLOSE_HOUR)}:00`;
  return hhmm;
};

export const fmtMoney = (v) =>
  v === null || v === undefined || v === ""
    ? "—"
    : `${Number(v).toLocaleString("ru-RU")} сом`;

export const DELETED_STATUS = "deleted";

export const RECORDA_VIEW = {
  SCHEDULE: "schedule",
  DELETED: "deleted",
};

/** Режим отображения расписания на день */
export const RECORDA_LAYOUT = {
  CALENDAR: "calendar",
  LIST: "list",
};

export const RECORDA_LAYOUT_STORAGE_KEY = "barberrecorda_day_layout";

export const readRecordaLayoutPreference = () => {
  try {
    const value = localStorage.getItem(RECORDA_LAYOUT_STORAGE_KEY);
    if (value === RECORDA_LAYOUT.CALENDAR || value === RECORDA_LAYOUT.LIST) {
      return value;
    }
  } catch {
    /* ignore */
  }
  return RECORDA_LAYOUT.LIST;
};

export const writeRecordaLayoutPreference = (layout) => {
  try {
    localStorage.setItem(RECORDA_LAYOUT_STORAGE_KEY, layout);
  } catch {
    /* ignore */
  }
};

export const BLOCKING = new Set([
  "booked",
  "confirmed",
  "completed",
  "no_show",
]);

export const STATUS_LABELS = {
  booked: "Забронировано",
  confirmed: "Подтверждено",
  completed: "Завершено",
  canceled: "Отменено",
  no_show: "Не пришёл",
  [DELETED_STATUS]: "Удалено",
};

export const matchesStatusFilter = (recordStatus, filterStatus) => {
  if (!filterStatus) return true;
  if (filterStatus === "canceled") {
    return recordStatus === "canceled" || recordStatus === "cancelled";
  }
  return recordStatus === filterStatus;
};

export const isScheduleBlocking = (status) => BLOCKING.has(status);

/** Макс. повторов одной услуги в записи (процедуры: укол ×4–×10) */
export const MAX_SERVICE_QTY_PER_ITEM = 20;

const qtyFromServiceItem = (item) => {
  if (typeof item !== "object" || item === null) return 1;
  const raw = item.qty ?? item.quantity ?? item.count ?? 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), MAX_SERVICE_QTY_PER_ITEM);
};

/** Развернуть услуги записи в плоский список id (с повторами) */
export const expandServiceIds = (items) => {
  const result = [];
  (items || []).forEach((item) => {
    if (typeof item === "object" && item !== null) {
      const id = String(item.service_id ?? item.service ?? item.id ?? "").trim();
      if (!id) return;
      const qty = qtyFromServiceItem(item);
      for (let i = 0; i < qty; i += 1) result.push(id);
      return;
    }
    const id = String(item ?? "").trim();
    if (id) result.push(id);
  });
  return result;
};

export const getServiceQty = (serviceIds, serviceId) =>
  (serviceIds || []).filter((id) => String(id) === String(serviceId)).length;

export const incrementServiceId = (serviceIds, serviceId) => {
  const sid = String(serviceId);
  const current = getServiceQty(serviceIds, sid);
  if (current >= MAX_SERVICE_QTY_PER_ITEM) return serviceIds || [];
  return [...(serviceIds || []), sid];
};

export const setServiceQty = (serviceIds, serviceId, qty) => {
  const sid = String(serviceId);
  const target = Math.max(
    0,
    Math.min(MAX_SERVICE_QTY_PER_ITEM, Math.floor(Number(qty) || 0)),
  );
  const rest = (serviceIds || []).filter((id) => String(id) !== sid);
  if (target === 0) return rest;
  return [...rest, ...Array.from({ length: target }, () => sid)];
};

export const decrementServiceId = (serviceIds, serviceId) => {
  const sid = String(serviceId);
  const list = Array.isArray(serviceIds) ? [...serviceIds] : [];
  const index = list.findIndex((id) => String(id) === sid);
  if (index === -1) return list;
  list.splice(index, 1);
  return list;
};

export const groupServiceIds = (serviceIds) => {
  const order = [];
  const counts = new Map();
  (serviceIds || []).forEach((rawId) => {
    const id = String(rawId);
    if (!counts.has(id)) order.push(id);
    counts.set(id, (counts.get(id) || 0) + 1);
  });
  return order.map((id) => ({ id, qty: counts.get(id) || 0 }));
};

export const formatGroupedServiceNames = (names) => {
  const order = [];
  const counts = new Map();
  (names || []).forEach((raw) => {
    const name = String(raw || "").trim();
    if (!name) return;
    if (!counts.has(name)) order.push(name);
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  return order
    .map((name) => {
      const qty = counts.get(name) || 0;
      return qty > 1 ? `${name} ×${qty}` : name;
    })
    .join(", ");
};

/** Записи, которые учитываются в ожидаемой выручке за день */
export const EXPECTED_REVENUE_STATUSES = new Set([
  "booked",
  "confirmed",
  "completed",
]);

export const serviceIdsFromRecord = (record) => {
  if (!record) return [];
  if (Array.isArray(record.services)) {
    return expandServiceIds(record.services);
  }
  if (Array.isArray(record.services_public)) {
    return expandServiceIds(record.services_public);
  }
  if (record.service) return [String(record.service)];
  return [];
};

/** Ожидаемая сумма одной записи: price из API или сумма услуг со скидкой */
export const appointmentExpectedPrice = (record, services = []) => {
  const raw = record?.price;
  if (raw != null && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }

  let base = 0;
  serviceIdsFromRecord(record).forEach((id) => {
    const svc = services.find((s) => String(s.id) === String(id));
    if (svc && Number.isFinite(Number(svc.price))) {
      base += Number(svc.price);
    }
  });

  if (base <= 0) return 0;

  const discount = parsePercent(record?.discount);
  const finalPrice = calcFinalPrice(base, discount);
  return Number.isFinite(finalPrice) ? finalPrice : base;
};

export const pluralRecordsLabel = (n) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "запись";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "записи";
  return "записей";
};

export const formatDaySummaryDate = (dateStr, isTodayDate = false) => {
  if (isTodayDate) return "Сегодня";
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
};

export const computeDayExpectedSummary = ({
  records = [],
  services = [],
  dateLabel = "",
} = {}) => {
  const revenueRecords = records.filter((r) =>
    EXPECTED_REVENUE_STATUSES.has(r.status),
  );
  const expectedTotal = revenueRecords.reduce(
    (sum, r) => sum + appointmentExpectedPrice(r, services),
    0,
  );

  return {
    dateLabel,
    count: revenueRecords.length,
    expectedTotal,
  };
};

/** Разбивка ожидаемой суммы за день по клиентам */
export const computeDaySummaryByClient = ({
  records = [],
  services = [],
  clients = [],
} = {}) => {
  const map = new Map();

  records
    .filter((r) => EXPECTED_REVENUE_STATUSES.has(r.status))
    .forEach((record) => {
      const clientId =
        record?.client_id ??
        (typeof record?.client === "object" && record.client
          ? record.client.id
          : record?.client);
      const name = clientNameOfRecord(record, clients) || "Без клиента";
      const phone = clientPhoneOfRecord(record, clients) || "";
      const key = clientId ? String(clientId) : `anon:${name}:${phone}`;
      const amount = appointmentExpectedPrice(record, services);

      const entry = map.get(key) || {
        key,
        name,
        phone,
        count: 0,
        total: 0,
      };
      entry.count += 1;
      entry.total += amount;
      map.set(key, entry);
    });

  return Array.from(map.values()).sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name, "ru"),
  );
};

/** Ответ GET /barbershop/appointments/summary/ → UI-сводка */
export const normalizeAppointmentsSummary = (data, { dateLabel = "" } = {}) => {
  if (!data || typeof data !== "object") return null;

  const scope = data.scope === "deleted" ? "deleted" : "day";
  const countRaw =
    scope === "deleted"
      ? data.records_count ?? data.expected_count
      : data.expected_count ?? data.records_count;
  const totalRaw = data.expected_total ?? data.total ?? data.amount;

  const count = Number(countRaw);
  const expectedTotal = Number(totalRaw);

  return {
    scope,
    dateLabel,
    count: Number.isFinite(count) ? count : 0,
    expectedTotal: Number.isFinite(expectedTotal) ? expectedTotal : 0,
    fromApi: true,
  };
};

export const clientNameOfRecord = (record, clients = []) => {
  if (record?.client_name) return String(record.client_name).trim();
  if (record?.client && typeof record.client === "object") {
    return (
      record.client.full_name ||
      record.client.name ||
      ""
    ).trim();
  }
  const clientId = record?.client ?? record?.client_id;
  if (!clientId) return "";
  const c = clients.find((x) => String(x.id) === String(clientId));
  return (c?.name || c?.full_name || "").trim();
};

export const clientPhoneOfRecord = (record, clients = []) => {
  if (record?.client_phone) return String(record.client_phone).trim();
  if (record?.client && typeof record.client === "object") {
    return (record.client.phone || record.client.phone_number || "").trim();
  }
  const clientId = record?.client ?? record?.client_id;
  if (!clientId) return "";
  const c = clients.find((x) => String(x.id) === String(clientId));
  return (c?.phone || c?.phone_number || "").trim();
};

/* парсинг процента скидки */
export const parsePercent = (raw) => {
  if (raw == null || raw === "") return null;
  const s = String(raw).replace(",", ".").replace(/[^\d.\-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/* финальная цена */
export const calcFinalPrice = (base, discountPercent) => {
  if (!Number.isFinite(base) || base <= 0) return null;
  if (!Number.isFinite(discountPercent) || discountPercent === 0) {
    return base;
  }
  const val = Math.round(base * (1 - discountPercent / 100));
  return val < 0 ? 0 : val;
};
