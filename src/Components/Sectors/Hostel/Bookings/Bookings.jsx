import React, { useEffect, useMemo, useState } from "react";
import {
  FaSearch,
  FaPlus,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import api from "../../../../api";
import { getAll as getAllClients, createClient } from "../Clients/clientStore";
import "./Bookings.scss";
import Sell from "../../../pages/Sell/Sell";

/* ===== helpers ===== */
const asArray = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

const toLocalInput = (iso) => (iso ? iso.slice(0, 16) : "");
const toApiDatetime = (local) =>
  !local ? "" : local.length === 16 ? `${local}:00` : local;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/* Вспомогательные форматтеры */
const pad2 = (n) => String(n).padStart(2, "0");
const hhmm = (ms) => {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const fmtHuman = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)} ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
};

/* Ночи для показов суммы */
const countNights = (startIso, endIso) => {
  if (!startIso || !endIso) return 1;
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  const diff = Math.max(0, b - a);
  const nights = Math.ceil(diff / DAY_MS);
  return Math.max(1, nights);
};
const fmtMoney = (v) => (Number(v) || 0).toLocaleString() + " с";

/* ===== Local date utils (без UTC-сдвигов) ===== */
const ymdLocal = (d) => {
  const dd = d instanceof Date ? d : new Date(d);
  const y = dd.getFullYear();
  const m = String(dd.getMonth() + 1).padStart(2, "0");
  const day = String(dd.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const dateFromYMDLocal = (key) => {
  const [y, m, d] = key.split("-").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};
const dmNoYear = (key) => {
  const d = dateFromYMDLocal(key);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;
};
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfCalendarGrid = (d) => {
  const sDate = startOfMonth(d);
  const dow = (sDate.getDay() + 6) % 7; // Monday=0
  const res = new Date(sDate);
  res.setDate(sDate.getDate() - dow);
  return res;
};
const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const floorDay = (ms) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const combineDateTime = (dateKey, hhmmStr) => `${dateKey}T${hhmmStr}`;

/* Разбиение брони по дням */
const splitBookingByDaysLocal = (startIso, endIso) => {
  const map = new Map();
  if (!startIso || !endIso) return map;
  const A = new Date(startIso).getTime();
  const B = new Date(endIso).getTime();
  if (!(A < B)) return map;

  let dayStart = floorDay(A);
  while (dayStart < B) {
    const dayEnd = dayStart + DAY_MS;
    const s = Math.max(A, dayStart);
    const e = Math.min(B, dayEnd);
    if (s < e) {
      const key = ymdLocal(new Date(dayStart));
      const arr = map.get(key) || [];
      arr.push([s, e]);
      map.set(key, arr);
    }
    dayStart = dayEnd;
  }
  return map;
};

/* Построение карты сегментов для подкраски */
const buildDailySegmentsMap = (items) => {
  const dayIntervals = new Map();
  items.forEach((b) => {
    const m = splitBookingByDaysLocal(b.start_time, b.end_time);
    m.forEach((arr, key) => {
      const cur = dayIntervals.get(key) || [];
      dayIntervals.set(key, cur.concat(arr));
    });
  });

  const res = new Map();
  dayIntervals.forEach((intervals, key) => {
    const sorted = intervals.slice().sort((a, b) => a[0] - b[0]);

    const segments = sorted.map(([s, e]) => {
      const ds = floorDay(s);
      const leftPct = Math.max(0, Math.min(100, ((s - ds) / DAY_MS) * 100));
      const rightPct = Math.max(
        0,
        Math.min(100, ((ds + DAY_MS - e) / DAY_MS) * 100)
      );
      return { leftPct, rightPct, from: s, to: e };
    });

    const isFull = segments.some(
      (seg) => Math.abs(seg.leftPct) < 0.1 && Math.abs(seg.rightPct) < 0.1
    );

    res.set(key, { intervals: sorted, segments, isFull });
  });

  return res;
};

/* Оверлап */
const intervalsOverlap = (aStart, aEnd, bStart, bEnd) =>
  new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);

/* ===== нормализация ===== */
const normalizeBooking = (b) => ({
  id: b.id,
  hotel: b.hotel ?? null,
  room: b.room ?? null,
  bed: b.bed ?? null,
  qty: Number(b.qty ?? 1) || 1,
  start_time: b.start_time ?? "",
  end_time: b.end_time ?? "",
  purpose: b.purpose ?? "",
  client: b.client ?? null,
  total: Number(b.total) || 0,
  status: b.status || "created",
  __src: "api",
});
const normalizeHotel = (h) => ({
  id: h.id,
  name: h.name ?? "",
  price: h.price ?? "",
  capacity: Number(h.capacity ?? 0),
  description: h.description ?? "",
});
const normalizeRoom = (r) => ({
  id: r.id,
  name: r.name ?? "",
  capacity: Number(r.capacity ?? 0),
  location: r.location ?? "",
  price: typeof r.price === "string" ? r.price : String(r.price ?? ""),
});
const normalizeBed = (b) => ({
  id: b.id,
  name: b.name ?? "",
  price: typeof b.price === "string" ? b.price : String(b.price ?? ""),
  capacity: Number(b.capacity ?? 0),
  description: b.description ?? "",
});

/* ===== валидация/санитайзеры клиента ===== */
const PHONE_RE = /^\+\d{10,15}$/; // + и 10-15 цифр
const sanitizePhoneInput = (raw) => {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.length ? `+${digits}` : "";
};
const isValidPhone = (p) => PHONE_RE.test(p || "");
const isValidName = (n) => {
  const s = (n || "").trim();
  if (s.length < 2) return false;
  return !/[0-9]/.test(s); // цифры запрещены
};

const Bookings = () => {
  const [items, setItems] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [beds, setBeds] = useState([]);

  const [clients, setClients] = useState([]);
  const [clientQuery, setClientQuery] = useState("");
  const [showClientAdd, setShowClientAdd] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // панель под календарём
  const [calInfo, setCalInfo] = useState(null); // {dateKey,label,isBusy,intervals:[{from,to}]}
  const [pickStartTime, setPickStartTime] = useState("12:00");
  const [pickEndTime, setPickEndTime] = useState("12:00");

  const OBJECT_TYPES = { HOTEL: "hotel", ROOM: "room", BED: "bed" };
  const [objectType, setObjectType] = useState(OBJECT_TYPES.HOTEL);

  const [form, setForm] = useState({
    hotel: null,
    room: null,
    bed: null,
    qty: 1,
    start_time: "",
    end_time: "",
    purpose: "",
    client: null, // не обязателен
  });

  /* ===== загрузка ===== */
  const loadAll = async () => {
    try {
      setLoading(true);
      setError("");

      const [bRes, hRes, rRes, bedsRes] = await Promise.all([
        api.get("/booking/bookings/"),
        api.get("/booking/hotels/"),
        api.get("/booking/rooms/"),
        api.get("/booking/beds/"),
      ]);

      const apiBookings = asArray(bRes.data).map((x) => normalizeBooking(x));
      const hotelsArr = asArray(hRes.data).map(normalizeHotel);
      const roomsArr = asArray(rRes.data).map(normalizeRoom);
      const bedsArr = asArray(bedsRes.data).map(normalizeBed);

      setItems(apiBookings);
      setHotels(hotelsArr);
      setRooms(roomsArr);
      setBeds(bedsArr);
    } catch (e) {
      console.error(e);
      setError("Не удалось загрузить данные по броням");
    } finally {
      setLoading(false);
    }
  };

  const refreshClients = async () => {
    try {
      const list = await getAllClients();
      const sorted = [...(Array.isArray(list) ? list : [])].sort((a, b) => {
        const da = new Date(a.updated_at || 0).getTime();
        const db = new Date(b.updated_at || 0).getTime();
        if (db !== da) return db - da;
        return (a.full_name || "").localeCompare(b.full_name || "");
      });
      setClients(sorted);
    } catch (e) {
      console.error("refreshClients error:", e);
      setClients([]);
    }
  };

  useEffect(() => {
    loadAll();
    refreshClients();
  }, []);

  useEffect(() => {
    const onRefresh = () => loadAll();
    window.addEventListener("bookings:refresh", onRefresh);
    return () => window.removeEventListener("bookings:refresh", onRefresh);
  }, []);

  /* ===== helpers ===== */
  const hotelName = (id) =>
    hotels.find((h) => String(h.id) === String(id))?.name || "—";
  const roomName = (id) =>
    rooms.find((r) => String(r.id) === String(id))?.name || "—";
  const bedName = (id) =>
    beds.find((b) => String(b.id) === String(id))?.name || "—";

  const hotelPriceById = (id) =>
    Number(hotels.find((h) => String(h.id) === String(id))?.price) || 0;
  const roomPriceById = (id) =>
    Number(rooms.find((r) => String(r.id) === String(id))?.price) || 0;
  const bedPriceById = (id) =>
    Number(beds.find((b) => String(b.id) === String(id))?.price) || 0;
  const bedCapacityById = (id) =>
    Number(beds.find((b) => String(b.id) === String(id))?.capacity || 0);

  /* ===== модалки ===== */
  const openCreate = () => {
    setEditingId(null);
    setObjectType(OBJECT_TYPES.HOTEL);
    setForm({
      hotel: null,
      room: null,
      bed: null,
      qty: 1,
      start_time: "",
      end_time: "",
      purpose: "",
      client: null,
    });
    setClientQuery("");
    setShowClientAdd(false);
    setCalInfo(null);
    setPickStartTime("12:00");
    setPickEndTime("12:00");
    refreshClients();
    setModalOpen(true);
  };

  const openEdit = (b) => {
    setEditingId(b.id);
    const type = b.bed
      ? OBJECT_TYPES.BED
      : b.room
      ? OBJECT_TYPES.ROOM
      : OBJECT_TYPES.HOTEL;
    setObjectType(type);

    setForm({
      hotel: b.hotel,
      room: b.room,
      bed: b.bed || null,
      qty: Number(b.qty ?? 1) || 1,
      start_time: toLocalInput(b.start_time),
      end_time: toLocalInput(b.end_time),
      purpose: b.purpose ?? "",
      client: b.client ?? null,
    });
    setPickStartTime((b.start_time || "").slice(11, 16) || "12:00");
    setPickEndTime((b.end_time || "").slice(11, 16) || "12:00");
    setClientQuery("");
    setShowClientAdd(false);
    setCalInfo(null);
    refreshClients();
    setModalOpen(true);
  };

  /* ===== клиенты (до 50, но контейнер на 3 строки с прокруткой) ===== */
  const clientList = useMemo(() => {
    const t = clientQuery.trim().toLowerCase();
    const base = clients || [];
    const list = !t
      ? base
      : base.filter((c) =>
          [c.full_name, c.phone]
            .map((x) => String(x || "").toLowerCase())
            .some((v) => v.includes(t))
        );
    return list.slice(0, 50);
  }, [clients, clientQuery]);

  const selectedClientName = useMemo(() => {
    if (!form.client) return "";
    const c = (clients || []).find((x) => x.id === form.client);
    return c?.full_name || "";
  }, [form.client, clients]);

  /* ===== занятость ===== */
  const relevantItems = useMemo(() => {
    if (!form.hotel && !form.room && !form.bed) return [];
    return items
      .filter((b) => b.id !== editingId)
      .filter(
        (b) =>
          (form.hotel && b.hotel === form.hotel) ||
          (form.room && b.room === form.room) ||
          (form.bed && b.bed === form.bed)
      );
  }, [items, form.hotel, form.room, form.bed, editingId]);

  const daySegments = useMemo(
    () => buildDailySegmentsMap(relevantItems),
    [relevantItems]
  );

  const selectedSegments = useMemo(() => {
    if (!form.start_time || !form.end_time) return new Map();
    const m = splitBookingByDaysLocal(form.start_time, form.end_time);
    const res = new Map();
    m.forEach((arr, key) => {
      const segs = arr.map(([s, e]) => {
        const ds = floorDay(s);
        const leftPct = Math.max(0, Math.min(100, ((s - ds) / DAY_MS) * 100));
        const rightPct = Math.max(
          0,
          Math.min(100, ((ds + DAY_MS - e) / DAY_MS) * 100)
        );
        return { leftPct, rightPct, from: s, to: e };
      });
      res.set(key, segs);
    });
    return res;
  }, [form.start_time, form.end_time]);

  // Почасовая доступность для коек
  const bedMinAvailable = useMemo(() => {
    if (!form.bed || !form.start_time || !form.end_time) return null;
    const cap = bedCapacityById(form.bed);
    if (!cap) return 0;

    const start = new Date(form.start_time).getTime();
    const end = new Date(form.end_time).getTime();
    let minLeft = cap;

    for (let t = start; t < end; t += HOUR_MS) {
      const slotStart = t;
      const slotEnd = Math.min(end, t + HOUR_MS);
      let used = 0;
      relevantItems.forEach((b) => {
        if (!b.bed) return;
        const bs = new Date(b.start_time).getTime();
        const be = new Date(b.end_time).getTime();
        if (slotStart < be && bs < slotEnd) {
          used += Math.max(1, Number(b.qty || 1));
        }
      });
      minLeft = Math.min(minLeft, Math.max(0, cap - used));
      if (minLeft === 0) break;
    }
    return minLeft;
  }, [form.bed, form.start_time, form.end_time, relevantItems, beds]);

  // Конфликт
  const hasConflict = useMemo(() => {
    if (
      !(
        form.start_time &&
        form.end_time &&
        (form.hotel || form.room || form.bed)
      )
    )
      return false;

    if (form.bed) {
      const cap = bedCapacityById(form.bed);
      if (!cap) return true;
      const need = Math.max(1, Number(form.qty || 1));

      const start = new Date(form.start_time).getTime();
      const end = new Date(form.end_time).getTime();

      for (let t = start; t < end; t += HOUR_MS) {
        const slotStart = t;
        const slotEnd = Math.min(end, t + HOUR_MS);
        let used = 0;
        relevantItems.forEach((b) => {
          if (!b.bed) return;
          const bs = new Date(b.start_time).getTime();
          const be = new Date(b.end_time).getTime();
          if (slotStart < be && bs < slotEnd) {
            used += Math.max(1, Number(b.qty || 1));
          }
        });
        if (used + need > cap) return true;
      }
      return false;
    }

    return relevantItems.some((b) =>
      intervalsOverlap(form.start_time, form.end_time, b.start_time, b.end_time)
    );
  }, [
    form.start_time,
    form.end_time,
    form.hotel,
    form.room,
    form.bed,
    form.qty,
    relevantItems,
  ]);

  /* ===== список ===== */
  const filtered = useMemo(() => {
    const now0 = todayStart().getTime();
    const activeOnly = items.filter((b) => {
      const st = (b.status || "").toLowerCase();
      if (["paid", "completed", "завершено", "оплачен"].includes(st))
        return false;
      const endT = b.end_time ? new Date(b.end_time).getTime() : 0;
      return endT >= now0;
    });

    const t = q.trim().toLowerCase();
    if (!t) return activeOnly;
    return activeOnly.filter((b) =>
      [
        b.purpose,
        b.start_time,
        b.end_time,
        b.hotel ? hotelName(b.hotel) : "",
        b.room ? roomName(b.room) : "",
        b.bed ? bedName(b.bed) : "",
      ].some((v) =>
        String(v || "")
          .toLowerCase()
          .includes(t)
      )
    );
  }, [q, items, hotels, rooms, beds]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) =>
        (b.start_time || "").localeCompare(a.start_time || "")
      ),
    [filtered]
  );

  /* ===== создание клиента (жёсткая валидация) ===== */
  const canSaveClient =
    isValidName(newClientName) && isValidPhone(newClientPhone);

  const onCreateClientInline = async () => {
    const name = (newClientName || "").trim();
    const phone = sanitizePhoneInput(newClientPhone);

    if (!isValidName(name)) {
      alert("Имя нужно без цифр, минимум 2 символа.");
      return;
    }
    if (!isValidPhone(phone)) {
      alert("Телефон в формате + и 10–15 цифр. Пример: +996221000953");
      return;
    }

    try {
      const created = await createClient({ name, phone });
      await refreshClients();
      setForm((f) => ({ ...f, client: created.id }));
      setShowClientAdd(false);
      setNewClientName("");
      setNewClientPhone("");
    } catch (e) {
      console.error(e);
      alert("Не удалось создать клиента");
    }
  };

  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      label: "Бронирование",
      content: (
        <>
          <header className="bookings__header">
            <div>
              <h2 className="bookings__title">Бронирования</h2>
            </div>

            <div className="bookings__actions">
              <div className="bookings__search">
                <FaSearch className="bookings__searchIcon" />
                <input
                  className="bookings__searchInput"
                  placeholder="Поиск по объекту, датам, назначению"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <button
                className="bookings__btn bookings__btn--primary"
                onClick={openCreate}
              >
                <FaPlus /> Добавить
              </button>
            </div>
          </header>
          {loading ? (
            <div className="bookings__empty">Загрузка…</div>
          ) : (
            <div className="bookings__list">
              {sorted.map((b) => {
                const nights = countNights(b.start_time, b.end_time);
                const price = b.hotel
                  ? hotelPriceById(b.hotel)
                  : b.room
                  ? roomPriceById(b.room)
                  : b.bed
                  ? bedPriceById(b.bed)
                  : 0;
                const qty = Number(b.qty ?? 1) || 1;
                const totalShow =
                  Number(b.total) || nights * price * (b.bed ? qty : 1) || 0;

                const label = b.hotel
                  ? `Комната: ${hotelName(b.hotel)}`
                  : b.room
                  ? `Зал: ${roomName(b.room)}`
                  : `Койко-место: ${bedName(b.bed)}`;

                return (
                  <div key={b.id} className="bookings__card">
                    <div>
                      <div className="bookings__name">{label}</div>
                      <div className="bookings__meta">
                        <span className="bookings__badge">
                          Начало: {toLocalInput(b.start_time)}
                        </span>
                        <span className="bookings__badge">
                          Конец: {toLocalInput(b.end_time)}
                        </span>
                        {b.purpose && (
                          <span className="bookings__badge">
                            Цель: {b.purpose}
                          </span>
                        )}
                        {b.bed && (
                          <span className="bookings__badge">Мест: {qty}</span>
                        )}
                        <span className="bookings__badge">
                          Сумма: {fmtMoney(totalShow)}
                        </span>
                      </div>
                    </div>

                    <div className="bookings__right">
                      <button
                        className="bookings__btn bookings__btn--secondary"
                        onClick={() => openEdit(b)}
                        title="Изменить бронь"
                      >
                        Изменить
                      </button>
                    </div>
                  </div>
                );
              })}
              {sorted.length === 0 && !error && (
                <div className="bookings__empty">Пока нет активных броней</div>
              )}
            </div>
          )}
        </>
      ),
    },
    { label: "Продажа", content: <Sell /> },
  ];

  return (
    <section className="bookings">
      <div className="vitrina__header" style={{ marginBottom: "15px" }}>
        <div className="vitrina__tabs">
          {tabs.map((tab, index) => (
            <span
              key={tab.label}
              className={`vitrina__tab ${
                index === activeTab ? "vitrina__tab--active" : ""
              }`}
              onClick={() => setActiveTab(index)}
            >
              {tab.label}
            </span>
          ))}
        </div>
      </div>

      {error && <div className="bookings__empty">{error}</div>}
      {tabs[activeTab].content}

      {modalOpen && (
        <div
          className="bookings__modalOverlay"
          onClick={() => setModalOpen(false)}
        >
          <div className="bookings__modal" onClick={(e) => e.stopPropagation()}>
            <div className="bookings__modalHeader">
              <div className="bookings__modalTitle">
                {editingId == null ? "Новая бронь" : "Изменить бронь"}
              </div>
              <button
                className="bookings__iconBtn"
                onClick={() => setModalOpen(false)}
              >
                <FaTimes />
              </button>
            </div>

            {hasConflict && (
              <div className="bookings__conflict">
                Выбранные даты заняты или недостаточно мест.
              </div>
            )}

            <form className="bookings__form" onSubmit={onSubmit}>
              <div className="bookings__formGrid">
                {/* ==== Тип объекта ==== */}
                <div className="bookings__field">
                  <label className="bookings__label">
                    Тип объекта <span className="bookings__req">*</span>
                  </label>
                  <select
                    className="bookings__input"
                    value={objectType}
                    onChange={(e) => {
                      const v = e.target.value;
                      setObjectType(v);
                      setForm((f) => ({
                        ...f,
                        hotel: v === OBJECT_TYPES.HOTEL ? f.hotel : null,
                        room: v === OBJECT_TYPES.ROOM ? f.room : null,
                        bed: v === OBJECT_TYPES.BED ? f.bed : null,
                        qty:
                          v === OBJECT_TYPES.BED
                            ? Math.max(1, Number(f.qty || 1))
                            : 1,
                      }));
                    }}
                  >
                    <option value={OBJECT_TYPES.HOTEL}>Комнаты</option>
                    <option value={OBJECT_TYPES.ROOM}>Залы</option>
                    <option value={OBJECT_TYPES.BED}>Койко-места</option>
                  </select>
                </div>

                {/* ==== Комната ==== */}
                {objectType === OBJECT_TYPES.HOTEL && (
                  <div className="bookings__field">
                    <label className="bookings__label">Комната</label>
                    <div className="bookings__row">
                      <select
                        className="bookings__input"
                        value={form.hotel ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            hotel: e.target.value || null,
                          }))
                        }
                        required
                      >
                        <option value="">— не выбрано —</option>
                        {hotels.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name}
                          </option>
                        ))}
                      </select>
                      {form.hotel && (
                        <button
                          type="button"
                          className="bookings__miniBtn"
                          onClick={() =>
                            setForm((f) => ({ ...f, hotel: null }))
                          }
                        >
                          Очистить
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ==== Зал ==== */}
                {objectType === OBJECT_TYPES.ROOM && (
                  <div className="bookings__field">
                    <label className="bookings__label">Зал</label>
                    <div className="bookings__row">
                      <select
                        className="bookings__input"
                        value={form.room ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            room: e.target.value || null,
                          }))
                        }
                        required
                      >
                        <option value="">— не выбрано —</option>
                        {rooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                      {form.room && (
                        <button
                          type="button"
                          className="bookings__miniBtn"
                          onClick={() => setForm((f) => ({ ...f, room: null }))}
                        >
                          Очистить
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ==== Койко-место ==== */}
                {objectType === OBJECT_TYPES.BED && (
                  <>
                    <div className="bookings__field">
                      <label className="bookings__label">Койко-место</label>
                      <div className="bookings__row">
                        <select
                          className="bookings__input"
                          value={form.bed ?? ""}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              bed: e.target.value || null,
                              qty: 1,
                            }))
                          }
                          required
                        >
                          <option value="">— не выбрано —</option>
                          {beds.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                        {form.bed && (
                          <button
                            type="button"
                            className="bookings__miniBtn"
                            onClick={() =>
                              setForm((f) => ({ ...f, bed: null, qty: 1 }))
                            }
                          >
                            Очистить
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="bookings__field">
                      <label className="bookings__label">
                        Кол-во мест <span className="bookings__req">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(
                          1,
                          bedMinAvailable ?? bedCapacityById(form.bed)
                        )}
                        className="bookings__input"
                        value={form.qty}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            qty: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        required
                      />
                      {form.bed && (
                        <div
                          className="bookings__hint"
                          style={{ marginTop: 4 }}
                        >
                          {bedMinAvailable == null
                            ? `Доступно мест: ${bedCapacityById(form.bed)}`
                            : `Осталось мест (мин. по диапазону): ${bedMinAvailable} из ${bedCapacityById(
                                form.bed
                              )}`}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ==== Назначение ==== */}
                <div
                  className="bookings__field"
                  style={{ gridColumn: "1 / -1" }}
                >
                  <label className="bookings__label">
                    Назначение (purpose)
                  </label>
                  <input
                    className="bookings__input"
                    maxLength={255}
                    placeholder="Например: командировка / конференция / встреча"
                    value={form.purpose}
                    onChange={(e) =>
                      setForm({ ...form, purpose: e.target.value })
                    }
                  />
                </div>

                {/* ==== Клиент (скролл на 3 строки) ==== */}
                <div
                  className="bookings__field"
                  style={{ gridColumn: "1 / -1" }}
                >
                  <label className="bookings__label">
                    Клиент (необязательно)
                  </label>
                  <div className="bookings__clientPicker">
                    <div className="bookings__row">
                      <input
                        className="bookings__input"
                        placeholder="Найти клиента по имени или телефону…"
                        value={clientQuery}
                        onChange={(e) => setClientQuery(e.target.value)}
                      />
                      {form.client && (
                        <button
                          type="button"
                          className="bookings__miniBtn"
                          onClick={() =>
                            setForm((f) => ({ ...f, client: null }))
                          }
                          title="Сбросить выбранного клиента"
                        >
                          Сбросить
                        </button>
                      )}
                      <button
                        type="button"
                        className="bookings__miniBtn"
                        onClick={() => setShowClientAdd((v) => !v)}
                        title="Добавить нового клиента"
                        style={{ marginLeft: 8 }}
                      >
                        + Добавить клиента
                      </button>
                    </div>

                    {clientList.length > 0 && (
                      <div className="bookings__clientList">
                        {clientList.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className={`bookings__clientItem ${
                              form.client === c.id
                                ? "bookings__clientItem--active"
                                : ""
                            }`}
                            onClick={() =>
                              setForm((f) => ({ ...f, client: c.id }))
                            }
                          >
                            <span className="bookings__clientName">
                              {c.full_name || "Без имени"}
                            </span>
                            <span className="bookings__clientPhone">
                              {c.phone || ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {showClientAdd && (
                      <div style={{ marginTop: 8 }}>
                        <div
                          className="bookings__row"
                          style={{ gap: 8, flexWrap: "wrap" }}
                        >
                          <input
                            className="bookings__input"
                            placeholder="Имя клиента *"
                            value={newClientName}
                            onChange={(e) =>
                              setNewClientName(
                                e.target.value.replace(/\d+/g, "")
                              )
                            }
                            title="Минимум 2 символа, цифры запрещены"
                            minLength={2}
                          />
                          <input
                            className="bookings__input"
                            placeholder="Телефон в формате +996221000953 *"
                            value={newClientPhone}
                            onChange={(e) =>
                              setNewClientPhone(
                                sanitizePhoneInput(e.target.value)
                              )
                            }
                            inputMode="tel"
                            pattern="^\+\d{10,15}$"
                            title="Начинается с +, далее 10–15 цифр. Пример: +996221000953"
                          />
                          <button
                            type="button"
                            className="bookings__miniBtn"
                            onClick={onCreateClientInline}
                            disabled={!canSaveClient}
                            title={
                              !canSaveClient
                                ? "Заполните корректно имя и телефон"
                                : "Сохранить клиента"
                            }
                          >
                            Сохранить
                          </button>
                          <button
                            type="button"
                            className="bookings__miniBtn"
                            onClick={() => {
                              setShowClientAdd(false);
                              setNewClientName("");
                              setNewClientPhone("");
                            }}
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    )}

                    {form.client && (
                      <div className="bookings__hint">
                        Выбран: <b>{selectedClientName || form.client}</b>
                      </div>
                    )}
                  </div>
                </div>

                {/* ==== Календарь выбора периода ==== */}
                {(form.hotel || form.room || form.bed) && (
                  <div
                    className="bookings__calendarWrap"
                    style={{ gridColumn: "1 / -1" }}
                  >
                    <AvailabilityCalendar
                      daySegments={daySegments}
                      selectedSegments={selectedSegments}
                      focusDateKey={calInfo?.dateKey || null}
                      onDayClick={(dateKey) => {
                        const entry = daySegments.get(dateKey);
                        const isBusy = !!(entry && entry.intervals.length);
                        const list = entry
                          ? entry.intervals.map(([s, e]) => ({
                              from: hhmm(s),
                              to: hhmm(e),
                            }))
                          : [];
                        setCalInfo({
                          dateKey,
                          label: dmNoYear(dateKey), // только ДД.ММ
                          isBusy,
                          intervals: list,
                        });

                        const stD = (form.start_time || "").slice(0, 10);
                        const enD = (form.end_time || "").slice(0, 10);
                        setPickStartTime(
                          stD === dateKey
                            ? (form.start_time || "").slice(11, 16)
                            : pickStartTime
                        );
                        setPickEndTime(
                          enD === dateKey
                            ? (form.end_time || "").slice(11, 16)
                            : pickEndTime
                        );
                      }}
                    />

                    {(form.start_time || form.end_time) && (
                      <div className="bookings__hint">
                        Выбрано:&nbsp;<b>Начало: {fmtHuman(form.start_time)}</b>
                        &nbsp;•&nbsp;
                        <b>Конец: {fmtHuman(form.end_time)}</b>
                      </div>
                    )}

                    {calInfo && (
                      <div className="bookings__calInfo">
                        <div className="bookings__calInfoTitle">
                          {calInfo.label}:{" "}
                          {calInfo.isBusy ? "занято" : "свободно"}
                        </div>
                        <div className="bookings__calInfoList">
                          {calInfo.intervals.length === 0 && (
                            <span>свободно весь день</span>
                          )}
                          {calInfo.intervals.map((it, i) => (
                            <span key={i}>
                              {i + 1}) {it.from} — {it.to}
                            </span>
                          ))}
                        </div>

                        <div className="bookings__timeRows">
                          <div className="bookings__timeRow">
                            <label>Начало</label>
                            <input
                              type="time"
                              className="bookings__timeInput"
                              value={pickStartTime}
                              onChange={(e) =>
                                setPickStartTime(e.target.value || "00:00")
                              }
                            />
                            <button
                              type="button"
                              className="bookings__miniBtn"
                              onClick={() => {
                                const dt = combineDateTime(
                                  calInfo.dateKey,
                                  pickStartTime
                                );
                                setForm((f) => {
                                  let end = f.end_time;
                                  if (end && new Date(end) < new Date(dt))
                                    end = dt;
                                  return {
                                    ...f,
                                    start_time: dt,
                                    end_time: end,
                                  };
                                });
                              }}
                            >
                              Поставить как начало
                            </button>
                          </div>

                          <div className="bookings__timeRow">
                            <label>Конец</label>
                            <input
                              type="time"
                              className="bookings__timeInput"
                              value={pickEndTime}
                              onChange={(e) =>
                                setPickEndTime(e.target.value || "00:00")
                              }
                            />
                            <button
                              type="button"
                              className="bookings__miniBtn"
                              onClick={() => {
                                const dt = combineDateTime(
                                  calInfo.dateKey,
                                  pickEndTime
                                );
                                setForm((f) => {
                                  let start = f.start_time;
                                  if (start && new Date(dt) < new Date(start))
                                    start = dt;
                                  return {
                                    ...f,
                                    start_time: start,
                                    end_time: dt,
                                  };
                                });
                              }}
                            >
                              Поставить как конец
                            </button>
                          </div>
                        </div>

                        <button
                          className="bookings__miniBtn"
                          onClick={() => setCalInfo(null)}
                        >
                          Закрыть
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bookings__formHint">
                Клик по дню показывает занятость и позволяет задать время
                начала/конца. Частичные дни подсвечиваются только по занятым
                часам.
              </div>

              <div className="bookings__formActions">
                {editingId != null && (
                  <button
                    type="button"
                    className="bookings__btn bookings__btn--danger"
                    onClick={onDelete}
                    disabled={saving}
                    title="Удалить бронь"
                  >
                    Удалить
                  </button>
                )}
                <button
                  type="button"
                  className="bookings__btn bookings__btn--secondary"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="bookings__btn bookings__btn--primary"
                  disabled={
                    saving ||
                    hasConflict ||
                    !form.start_time ||
                    !form.end_time ||
                    (form.end_time &&
                      form.start_time &&
                      new Date(form.end_time) < new Date(form.start_time))
                  }
                  title={
                    !form.start_time || !form.end_time
                      ? "Выберите даты на календаре"
                      : new Date(form.end_time) < new Date(form.start_time)
                      ? "Дата окончания раньше даты начала"
                      : hasConflict
                      ? "Недостаточно мест / даты заняты"
                      : undefined
                  }
                >
                  {saving ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );

  /* ===== submit ===== */
  async function onSubmit(e) {
    e.preventDefault();

    if (objectType === OBJECT_TYPES.HOTEL && !form.hotel) {
      setError("Выберите комнату");
      return;
    }
    if (objectType === OBJECT_TYPES.ROOM && !form.room) {
      setError("Выберите зал");
      return;
    }
    if (objectType === OBJECT_TYPES.BED && !form.bed) {
      setError("Выберите койко-место");
      return;
    }
    if (!form.start_time || !form.end_time) {
      setError("Выберите период на календаре");
      return;
    }
    if (new Date(form.end_time) < new Date(form.start_time)) {
      setError("Дата окончания не может быть раньше даты начала");
      return;
    }
    if (hasConflict) {
      setError(
        "Выбранные даты заняты или недостаточно мест. Измените диапазон/количество."
      );
      return;
    }

    const payloadCommon = {
      start_time: toApiDatetime(form.start_time),
      end_time: toApiDatetime(form.end_time),
      purpose: (form.purpose || "").trim(),
      client: form.client || null,
    };

    try {
      setSaving(true);
      setError("");

      const payloadApi = {
        hotel: objectType === OBJECT_TYPES.HOTEL ? form.hotel : null,
        room: objectType === OBJECT_TYPES.ROOM ? form.room : null,
        bed: objectType === OBJECT_TYPES.BED ? form.bed : null,
        qty:
          objectType === OBJECT_TYPES.BED
            ? Math.max(1, Number(form.qty || 1))
            : 1,
        ...payloadCommon,
      };

      let saved;
      if (editingId == null) {
        const { data } = await api.post("/booking/bookings/", payloadApi);
        saved = normalizeBooking({ ...data });
        setItems((prev) => [saved, ...prev]);
      } else {
        const { data } = await api.put(
          `/booking/bookings/${editingId}/`,
          payloadApi
        );
        saved = normalizeBooking({ ...data });
        setItems((prev) => prev.map((x) => (x.id === editingId ? saved : x)));
      }

      try {
        window.dispatchEvent(
          new CustomEvent("clients:booking-saved", {
            detail: { booking: saved },
          })
        );
      } catch {}

      setModalOpen(false);
      setEditingId(null);
      setCalInfo(null);
      setForm({
        hotel: null,
        room: null,
        bed: null,
        qty: 1,
        start_time: "",
        end_time: "",
        purpose: "",
        client: null,
      });
    } catch (e2) {
      console.error(e2);
      setError("Не удалось сохранить бронь");
    } finally {
      setSaving(false);
    }
  }

  /* ===== delete ===== */
  async function onDelete() {
    if (editingId == null) return;
    if (!window.confirm("Удалить эту бронь безвозвратно?")) return;
    try {
      setSaving(true);
      await api.delete(`/booking/bookings/${editingId}/`);
      setItems((prev) => prev.filter((x) => x.id !== editingId));
      try {
        window.dispatchEvent(new CustomEvent("bookings:refresh"));
      } catch {}
      setModalOpen(false);
      setEditingId(null);
      setCalInfo(null);
    } catch (e) {
      console.error(e);
      setError("Не удалось удалить бронь");
    } finally {
      setSaving(false);
    }
  }
};

/* ===== Календарь ===== */
const AvailabilityCalendar = ({
  daySegments,
  selectedSegments,
  focusDateKey,
  onDayClick,
}) => {
  const [month, setMonth] = useState(() => new Date());

  const gridDays = useMemo(() => {
    const start = startOfCalendarGrid(month);
    const list = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      list.push(d);
    }
    return list;
  }, [month]);

  const title = useMemo(
    () => month.toLocaleString(undefined, { month: "long", year: "numeric" }),
    [month]
  );

  const inMonth = (d) => d.getMonth() === month.getMonth();
  const isToday = (d) => d.toDateString() === new Date().toDateString();

  return (
    <div className="bookings__calendar">
      <div className="bookings__calHeader">
        <button
          className="bookings__calNav"
          type="button"
          onClick={() => {
            const m = new Date(month);
            m.setMonth(m.getMonth() - 1);
            setMonth(m);
          }}
          aria-label="Предыдущий месяц"
        >
          <FaChevronLeft />
        </button>
        <div className="bookings__calTitle">{title}</div>
        <button
          className="bookings__calNav"
          type="button"
          onClick={() => {
            const m = new Date(month);
            m.setMonth(m.getMonth() + 1);
            setMonth(m);
          }}
          aria-label="Следующий месяц"
        >
          <FaChevronRight />
        </button>
      </div>

      <div className="bookings__calWeekdays">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((w) => (
          <div key={w} className="bookings__calWd">
            {w}
          </div>
        ))}
      </div>

      <div className="bookings__calGrid">
        {gridDays.map((d) => {
          const key = ymdLocal(d);
          const entry = daySegments.get(key);
          const has = !!entry;
          const isFull = has && entry.isFull;
          const selSegs = selectedSegments?.get(key) || [];

          const classes = [
            "bookings__calDay",
            !inMonth(d) && "bookings__calDay--dim",
            isToday(d) && "bookings__calDay--today",
            isFull && "bookings__calDay--full",
            focusDateKey === key && "bookings__calDay--focus",
          ]
            .filter(Boolean)
            .join(" ");

          const tip =
            has && entry.intervals.length
              ? `Занято: ${entry.intervals
                  .map(([s, e]) => `${hhmm(s)}–${hhmm(e)}`)
                  .join(", ")}`
              : undefined;

          return (
            <div
              key={key}
              className={classes}
              title={tip}
              onClick={() => onDayClick && onDayClick(key)}
            >
              {/* выбранные сегменты (жёлтые) */}
              {selSegs.map((seg, i) => (
                <span
                  key={`sel-${i}`}
                  className="bookings__calSel"
                  style={{ left: `${seg.leftPct}%`, right: `${seg.rightPct}%` }}
                />
              ))}
              {/* занятые сегменты (красные) */}
              {has &&
                !isFull &&
                entry.segments.map((seg, i) => (
                  <span
                    key={`busy-${i}`}
                    className="bookings__calCover"
                    style={{
                      left: `${seg.leftPct}%`,
                      right: `${seg.rightPct}%`,
                    }}
                  />
                ))}
              <span className="bookings__calNum">{d.getDate()}</span>
            </div>
          );
        })}
      </div>

      <div className="bookings__calLegend">
        <span className="bookings__calBadge" /> — занято (частично/полностью).
        Выбранная бронь подсвечивается жёлтым.
      </div>
    </div>
  );
};

export default Bookings;
