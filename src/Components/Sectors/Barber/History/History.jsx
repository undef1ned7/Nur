import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./History.scss";
import api from "../../../../api";
import { useSelector } from "react-redux";
import { FaCalendarAlt } from "react-icons/fa";

import {
  PAGE_SIZE,
  asArray,
  norm,
  dateISO,
  timeISO,
  fmtMoney,
  barberNameOf,
  serviceNamesFromRecord,
  clientNameOf,
  priceOfAppointment,
  basePriceOfAppointment,
  discountPercentOfAppointment,
  statusLabel,
} from "./HistoryUtils";

import HistoryPager from "./HistoryPager";

const pluralRecords = (n) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "запись";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "записи";
  return "записей";
};

const toTsFrom = (isoDate) => {
  if (!isoDate) return null; // YYYY-MM-DD
  const t = Date.parse(`${isoDate}T00:00:00`);
  return Number.isFinite(t) ? t : null;
};

const toTsTo = (isoDate) => {
  if (!isoDate) return null; // YYYY-MM-DD
  const t = Date.parse(`${isoDate}T23:59:59`);
  return Number.isFinite(t) ? t : null;
};

const getId = (v) => (v && typeof v === "object" ? v.id : v);

const openPicker = (ref) => {
  const el = ref?.current;
  if (!el) return;
  // Chrome/Edge: showPicker()
  if (typeof el.showPicker === "function") el.showPicker();
  else el.focus();
};

const History = () => {
  const { isAuthenticated, currentUser } = useSelector((s) => s.user) || {};
  const userEmail =
    (currentUser?.email && String(currentUser.email)) ||
    (currentUser?.user?.email && String(currentUser.user.email)) ||
    "";
  const userId = currentUser?.id || currentUser?.user?.id || null;

  const [employees, setEmployees] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [clients, setClients] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // YYYY-MM-DD (native date input)
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [page, setPage] = useState(1);

  const fromRef = useRef(null);
  const toRef = useRef(null);

  const fetchEmployees = useCallback(async () => asArray((await api.get("/users/employees/")).data), []);
  const fetchAppointments = useCallback(async () => asArray((await api.get("/barbershop/appointments/")).data), []);
  const fetchServices = useCallback(async () => asArray((await api.get("/barbershop/services/")).data), []);
  const fetchClients = useCallback(async () => asArray((await api.get("/barbershop/clients/")).data), []);

  useEffect(() => {
    let alive = true;

    if (!isAuthenticated) {
      setEmployees([]);
      setAppointments([]);
      setServices([]);
      setClients([]);
      setErr("");
      setLoading(false);
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        setLoading(true);
        setErr("");
        const [emps, appts, svcs, cls] = await Promise.all([
          fetchEmployees(),
          fetchAppointments(),
          fetchServices(),
          fetchClients(),
        ]);
        if (!alive) return;
        setEmployees(emps);
        setAppointments(appts);
        setServices(svcs);
        setClients(cls);
      } catch {
        if (!alive) return;
        setErr("Не удалось загрузить историю.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [fetchEmployees, fetchAppointments, fetchServices, fetchClients, isAuthenticated]);

  const myEmployeeIds = useMemo(() => {
    if (!isAuthenticated) return new Set();
    const email = norm(userEmail);
    const ids = new Set();

    employees.forEach((e) => {
      const em = norm(e?.email);
      if (email && em && em === email) ids.add(String(e.id));

      const eu = getId(e?.user) ?? e?.user_id;
      if (userId && eu === userId) ids.add(String(e.id));
    });

    return ids;
  }, [employees, isAuthenticated, userEmail, userId]);

  const myAppointments = useMemo(() => {
    if (!isAuthenticated) return [];
    const email = norm(userEmail);

    const belongs = (a) => {
      const barberId =
        getId(a?.barber) ??
        a?.barber_id ??
        getId(a?.employee) ??
        a?.employee_id ??
        getId(a?.master) ??
        a?.master_id;

      if (barberId && myEmployeeIds.has(String(barberId))) return true;

      const createdById = getId(a?.created_by) ?? a?.created_by_id ?? a?.created_by;
      if (userId && createdById === userId) return true;

      const emails = [
        a?.barber_email,
        a?.employee_email,
        a?.master_email,
        a?.user_email,
        a?.created_by_email,
        a?.user?.email,
        a?.created_by?.email,
        a?.barber?.email,
        a?.employee?.email,
        a?.master?.email,
      ]
        .filter(Boolean)
        .map(norm);

      return email && emails.some((x) => x === email);
    };

    return appointments
      .filter(belongs)
      .slice()
      .sort((a, b) => (Date.parse(b?.start_at) || 0) - (Date.parse(a?.start_at) || 0));
  }, [appointments, isAuthenticated, myEmployeeIds, userEmail, userId]);

  const range = useMemo(() => {
    const fromTs = toTsFrom(from);
    const toTs = toTsTo(to);
    return { fromTs, toTs };
  }, [from, to]);

  const invalidRange = useMemo(() => {
    const { fromTs, toTs } = range;
    return fromTs !== null && toTs !== null && fromTs > toTs;
  }, [range]);

  const filtered = useMemo(() => {
    if (!isAuthenticated) return [];
    if (invalidRange) return [];

    let arr = myAppointments;

    if (range.fromTs !== null) {
      arr = arr.filter((x) => {
        const t = Date.parse(x?.start_at);
        return Number.isFinite(t) && t >= range.fromTs;
      });
    }

    if (range.toTs !== null) {
      arr = arr.filter((x) => {
        const t = Date.parse(x?.start_at);
        return Number.isFinite(t) && t <= range.toTs;
      });
    }

    return arr;
  }, [myAppointments, range, invalidRange, isAuthenticated]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [from, to]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totalLabel = loading
    ? "Загрузка…"
    : `${filtered.length} ${pluralRecords(filtered.length)}${
        filtered.length > PAGE_SIZE ? ` · стр. ${safePage}/${totalPages}` : ""
      }`;

  const handleReset = () => {
    setFrom("");
    setTo("");
    setPage(1);
  };

  const handlePrevPage = () => setPage((p) => Math.max(1, p - 1));
  const handleNextPage = () => setPage((p) => Math.min(totalPages, p + 1));

  return (
    <section className="barberhistory">
      <header className="barberhistory__header">
        <span className="barberhistory__subtitle">{totalLabel}</span>

        <div className="barberhistory__filters">
          <label className={`barberhistory__field ${invalidRange ? "barberhistory__field--invalid" : ""}`}>
            <span className="barberhistory__label">От</span>
            <div className="barberhistory__control">
              <input
                ref={fromRef}
                type="date"
                className="barberhistory__input barberhistory__input--date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                onKeyDown={(e) => e.preventDefault()} // не печатать
              />
              <button
                type="button"
                className="barberhistory__iconBtn"
                onClick={() => openPicker(fromRef)}
                aria-label="Выбрать дату (От)"
              >
                <FaCalendarAlt />
              </button>
            </div>
          </label>

          <label className={`barberhistory__field ${invalidRange ? "barberhistory__field--invalid" : ""}`}>
            <span className="barberhistory__label">До</span>
            <div className="barberhistory__control">
              <input
                ref={toRef}
                type="date"
                className="barberhistory__input barberhistory__input--date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                onKeyDown={(e) => e.preventDefault()} // не печатать
              />
              <button
                type="button"
                className="barberhistory__iconBtn"
                onClick={() => openPicker(toRef)}
                aria-label="Выбрать дату (До)"
              >
                <FaCalendarAlt />
              </button>
            </div>
          </label>

          <button
            type="button"
            className="barberhistory__btn barberhistory__btn--secondary"
            onClick={handleReset}
          >
            Сброс
          </button>
        </div>
      </header>

      {!!err && <div className="barberhistory__alert">{err}</div>}
      {invalidRange && <div className="barberhistory__alert">Диапазон дат неверен.</div>}
      {!isAuthenticated && <div className="barberhistory__alert">Войдите, чтобы увидеть ваши записи.</div>}

      <div className="barberhistory__list">
        {loading ? (
          <div className="barberhistory__alert">Загрузка…</div>
        ) : rows.length === 0 ? (
          <div className="barberhistory__alert">Записей нет</div>
        ) : (
          rows.map((a) => {
            const date = dateISO(a?.start_at);
            const time = timeISO(a?.start_at);
            const client = clientNameOf(a, clients);
            const service = serviceNamesFromRecord(a, services);

            const totalPrice = priceOfAppointment(a, services);
            const basePrice = basePriceOfAppointment(a, services);
            const discountPct = discountPercentOfAppointment(a, basePrice, totalPrice);

            const statusKey = String(a?.status || "").toLowerCase();
            const statusText = a?.status_display || statusLabel(statusKey);

            const statusClass =
              statusKey === "completed"
                ? "barberhistory__status barberhistory__status--completed"
                : statusKey === "canceled"
                ? "barberhistory__status barberhistory__status--canceled"
                : "barberhistory__status";

            const barber = barberNameOf(a, employees);
            const discountLabel = discountPct !== null ? `${discountPct}%` : "0%";

            return (
              <article
                key={a?.id ?? `${a?.start_at}-${client}-${service}`}
                className="barberhistory__card"
              >
                <div className="barberhistory__cardHead">
                  <h4 className="barberhistory__name">
                    {date} • {time}
                  </h4>
                  <span className={statusClass}>{statusText}</span>
                </div>

                <div className="barberhistory__meta">
                  <div className="barberhistory__metaRow">
                    <span className="bh-item">Сотрудник: {barber}</span>
                    <span className="bh-item">Клиент: {client}</span>
                  </div>

                  <div className="barberhistory__metaRow">
                    <span className="bh-item">Услуга: {service}</span>
                  </div>

                  <div className="barberhistory__metaRow barberhistory__metaRow--summary">
                    <span className="bh-item">Цена без скидки: {fmtMoney(basePrice)}</span>
                    <span className="bh-item">Скидка: {discountLabel}</span>
                    <span className="bh-item bh-item--bold">Итого: {fmtMoney(totalPrice)}</span>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      <HistoryPager
        filteredCount={filtered.length}
        safePage={safePage}
        totalPages={totalPages}
        onPrev={handlePrevPage}
        onNext={handleNextPage}
      />
    </section>
  );
};

export default History;
