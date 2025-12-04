// Recorda.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../../../api";
import "./Recorda.scss";

import RecordaHeader from "./RecordaHeader.jsx";
import RecordaCalendar from "./RecordaCalendar.jsx";
import RecordaModal from "./RecordaModal.jsx";

/* ===== utils ===== */
const pad = (n) => String(n).padStart(2, "0");

const toDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d)) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const toTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d)) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

const ts = (iso) => new Date(iso).getTime();

const SLOT_MIN = 30;
const SLOT_PX = 56;
const COL_HEADER_H = 56;
const SAFE_PAD = 72;

const OPEN_HOUR = 9;
const CLOSE_HOUR = 21;

/* строка времени услуги -> минуты */
const parseDurationMin = (raw) => {
  if (raw == null) return 0;
  const s = String(raw).trim().toLowerCase();
  const hm = s.match(/^(\d{1,2})\s*:\s*(\d{1,2})$/);
  if (hm) {
    const h = +hm[1] || 0;
    const m = +hm[2] || 0;
    return Math.max(0, h * 60 + m);
  }
  const m2 = s.match(
    /(?:(\d+)\s*(?:час|ч|h)[а-я]*)?\s*(?:(\d+)\s*(?:мин|m|min)?)?/
  );
  if (m2 && (m2[1] || m2[2])) {
    return (+m2[1] || 0) * 60 + (+m2[2] || 0);
  }
  const n = Number(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
};

const Recorda = () => {
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const todayStr = () => {
    const n = new Date();
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
  };

  const [fltDate, setFltDate] = useState(todayStr());
  const [fltBarber, setFltBarber] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);

  /* загрузка всех данных */
  const fetchAll = async () => {
    try {
      setLoading(true);
      setPageError("");
      const [cl, em, sv, ap] = await Promise.all([
        api.get("/barbershop/clients/"),
        api.get("/users/employees/"),
        api.get("/barbershop/services/"),
        api.get("/barbershop/appointments/"),
      ]);

      const cls = asArray(cl.data)
        .filter((c) =>
          ["active", "vip", ""].includes(String(c.status || "").toLowerCase())
        )
        .map((c) => ({
          id: c.id,
          name: c.full_name || c.name || "",
          phone: c.phone || c.phone_number || "",
          status: c.status || "active",
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));

      const emps = asArray(em.data)
        .map((e) => {
          const first = e.first_name ?? "";
          const last = e.last_name ?? "";
          const name =
            ([last, first].filter(Boolean).join(" ").trim()) ||
            e.email ||
            "—";
          return { id: e.id, name };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));

      const svcs = asArray(sv.data)
        .filter((s) => s.is_active !== false)
        .map((s) => ({
          id: s.id,
          name: s.service_name || s.name || "",
          price: s.price == null ? null : Number(s.price),
          time: s.time || "",
          minutes: parseDurationMin(s.time || ""),
          active: s.is_active !== false,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));

      setClients(cls);
      setBarbers(emps);
      setServices(svcs);
      setAppointments(asArray(ap.data));
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        "Не удалось загрузить данные. Попробуйте обновить страницу.";
      setPageError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  /* записи за выбранный день */
  const dayRecords = useMemo(
    () => appointments.filter((r) => toDate(r.start_at) === fltDate),
    [appointments, fltDate]
  );

  /* временная шкала для календаря */
  const timesAll = useMemo(() => {
    const arr = [];
    for (let m = OPEN_HOUR * 60; m <= CLOSE_HOUR * 60; m += SLOT_MIN) {
      arr.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
    }
    return arr;
  }, []);

  const calendarHeight = useMemo(
    () => (timesAll.length - 1) * SLOT_PX + COL_HEADER_H + SAFE_PAD,
    [timesAll]
  );

  const timeBounds = useMemo(
    () => ({ startH: OPEN_HOUR, endH: CLOSE_HOUR }),
    []
  );

  const totalSlots =
    (timeBounds.endH - timeBounds.startH) * (60 / SLOT_MIN);

  /* подсветка "занятых" слотов в левой колонке */
  const busySlots = useMemo(() => {
    const set = new Set();
    for (let i = 0; i < totalSlots; i++) {
      const slotStart = timeBounds.startH * 60 + i * SLOT_MIN;
      const slotEnd = slotStart + SLOT_MIN;
      const busy = dayRecords.some((r) => {
        const s = new Date(r.start_at);
        const e = new Date(r.end_at);
        const rs = s.getHours() * 60 + s.getMinutes();
        const re = e.getHours() * 60 + e.getMinutes();
        return rs < slotEnd && slotStart < re;
      });
      if (busy) set.add(i);
    }
    return set;
  }, [dayRecords, timeBounds, totalSlots]);

  /* группировка записей по мастерам */
  const recordsByBarber = useMemo(() => {
    const map = new Map();
    barbers.forEach((b) => map.set(String(b.id), []));
    dayRecords.forEach((r) => {
      const key = String(r.barber);
      const list = map.get(key) || [];
      list.push(r);
      map.set(key, list);
    });
    map.forEach((list) =>
      list.sort((a, b) => ts(a.start_at) - ts(b.start_at))
    );
    return map;
  }, [dayRecords, barbers]);

  const serviceNamesFromRecord = (r) => {
    if (Array.isArray(r.services_names) && r.services_names.length) {
      return r.services_names.join(", ");
    }
    if (Array.isArray(r.services) && r.services.length) {
      const names = r.services.map(
        (id) =>
          services.find((s) => String(s.id) === String(id))?.name || id
      );
      return names.join(", ");
    }
    return r.service_name || "—";
  };

  const clientName = (r) =>
    r.client_name ||
    clients.find((c) => String(c.id) === String(r.client))?.name ||
    "—";

  const clientPhone = (r) =>
    r.client_phone ||
    clients.find((c) => String(c.id) === String(r.client))?.phone ||
    "";

  const handleOpenNew = () => {
    setCurrentRecord(null);
    setModalOpen(true);
  };

  const handleOpenExisting = (rec) => {
    setCurrentRecord(rec);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  return (
    <div className="barberrecorda">
      <RecordaHeader
        fltDate={fltDate}
        fltBarber={fltBarber}
        barbers={barbers}
        onDateChange={setFltDate}
        onBarberChange={setFltBarber}
        onAddClick={handleOpenNew}
      />

      {pageError && (
        <div className="barberrecorda__alert barberrecorda__alert--danger">
          {pageError}
        </div>
      )}

      <RecordaCalendar
        barbers={barbers}
        fltBarber={fltBarber}
        recordsByBarber={recordsByBarber}
        timesAll={timesAll}
        calendarHeight={calendarHeight}
        busySlots={busySlots}
        loading={loading}
        toTime={toTime}
        serviceNamesFromRecord={serviceNamesFromRecord}
        clientName={clientName}
        clientPhone={clientPhone}
        COL_HEADER_H={COL_HEADER_H}
        SLOT_PX={SLOT_PX}
        onRecordClick={handleOpenExisting}
      />

      {modalOpen && (
        <RecordaModal
          isOpen={modalOpen}
          onClose={handleCloseModal}
          currentRecord={currentRecord}
          clients={clients}
          barbers={barbers}
          services={services}
          appointments={appointments}
          defaultDate={fltDate || todayStr()}
          onReload={fetchAll}
          onClientsChange={setClients}
        />
      )}
    </div>
  );
};

export default Recorda;
