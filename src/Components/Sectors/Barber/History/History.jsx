import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  parseUserDate,
  statusLabel,
} from "./HistoryUtils";

import HistoryPager from "./HistoryPager";

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

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fromRaw, setFromRaw] = useState("");
  const [toRaw, setToRaw] = useState("");

  const [page, setPage] = useState(1);

  const fromRef = useRef(null);
  const toRef = useRef(null);

  const invalidRange = useMemo(
    () => from && to && from > to,
    [from, to]
  );

  const fetchEmployees = useCallback(
    async () => asArray((await api.get("/users/employees/")).data),
    []
  );
  const fetchAppointments = useCallback(
    async () => asArray((await api.get("/barbershop/appointments/")).data),
    []
  );
  const fetchServices = useCallback(
    async () => asArray((await api.get("/barbershop/services/")).data),
    []
  );
  const fetchClients = useCallback(
    async () => asArray((await api.get("/barbershop/clients/")).data),
    []
  );

  useEffect(() => {
    let alive = true;
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
  }, [
    fetchEmployees,
    fetchAppointments,
    fetchServices,
    fetchClients,
    isAuthenticated,
  ]);

  const myEmployeeIds = useMemo(() => {
    if (!isAuthenticated) return new Set();
    const email = norm(userEmail);
    const ids = new Set();
    employees.forEach((e) => {
      const em = norm(e?.email);
      if (email && em && em === email) ids.add(String(e.id));
      if (userId && (e?.user_id === userId || e?.user?.id === userId))
        ids.add(String(e.id));
    });
    return ids;
  }, [employees, isAuthenticated, userEmail, userId]);

  const myAppointments = useMemo(() => {
    if (!isAuthenticated) return [];
    const email = norm(userEmail);
    const belongs = (a) => {
      if (myEmployeeIds.has(String(a.barber))) return true;
      if (userId && (a?.created_by === userId || a?.created_by?.id === userId))
        return true;
      const emails = [
        a?.barber_email,
        a?.employee_email,
        a?.master_email,
        a?.user_email,
        a?.created_by_email,
        a?.user?.email,
        a?.created_by?.email,
      ]
        .filter(Boolean)
        .map(norm);
      return email && emails.some((x) => x === email);
    };
    return appointments
      .filter(belongs)
      .slice()
      .sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
  }, [appointments, isAuthenticated, myEmployeeIds, userEmail, userId]);

  const filtered = useMemo(() => {
    if (invalidRange) return [];
    let arr = myAppointments;
    if (from) {
      const t = new Date(
        from.includes("T") ? from : `${from}T00:00:00`
      ).getTime();
      arr = arr.filter((x) => new Date(x.start_at).getTime() >= t);
    }
    if (to) {
      const t = new Date(
        to.includes("T") ? to : `${to}T23:59:59`
      ).getTime();
      arr = arr.filter((x) => new Date(x.start_at).getTime() <= t);
    }
    return arr;
  }, [myAppointments, from, to, invalidRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [from, to, filtered.length]);

  const totalLabel = loading
    ? "Загрузка…"
    : `${filtered.length} записей${
        filtered.length > PAGE_SIZE ? ` · стр. ${safePage}/${totalPages}` : ""
      }`;

  const handleReset = () => {
    setFrom("");
    setTo("");
    setFromRaw("");
    setToRaw("");
  };

  const handlePrevPage = () =>
    setPage((p) => Math.max(1, p - 1));
  const handleNextPage = () =>
    setPage((p) => Math.min(totalPages, p + 1));

  return (
    <section className="barberhistory">
      <header className="barberhistory__header">
        <span className="barberhistory__subtitle">{totalLabel}</span>

        <div className="barberhistory__filters">
          <label
            className={`barberhistory__field ${
              invalidRange ? "barberhistory__field--invalid" : ""
            }`}
          >
            <span className="barberhistory__label">От</span>
            <div className="barberhistory__control">
              <input
                ref={fromRef}
                type="text"
                className="barberhistory__input"
                placeholder="ДД.ММ.ГГГГ  --:--"
                value={fromRaw}
                onChange={(e) => {
                  const val = e.target.value;
                  setFromRaw(val);
                  const iso = parseUserDate(val);
                  setFrom(iso || "");
                }}
              />
              <button
                type="button"
                className="barberhistory__iconBtn"
                onClick={() =>
                  fromRef.current && fromRef.current.focus()
                }
              >
                <FaCalendarAlt />
              </button>
            </div>
          </label>

          <label
            className={`barberhistory__field ${
              invalidRange ? "barberhistory__field--invalid" : ""
            }`}
          >
            <span className="barberhistory__label">До</span>
            <div className="barberhistory__control">
              <input
                ref={toRef}
                type="text"
                className="barberhistory__input"
                placeholder="ДД.ММ.ГГГГ  --:--"
                value={toRaw}
                onChange={(e) => {
                  const val = e.target.value;
                  setToRaw(val);
                  const iso = parseUserDate(val);
                  setTo(iso || "");
                }}
              />
              <button
                type="button"
                className="barberhistory__iconBtn"
                onClick={() =>
                  toRef.current && toRef.current.focus()
                }
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
      {invalidRange && (
        <div className="barberhistory__alert">
          Диапазон дат неверен.
        </div>
      )}
      {!isAuthenticated && (
        <div className="barberhistory__alert">
          Войдите, чтобы увидеть ваши записи.
        </div>
      )}

      <div className="barberhistory__list">
        {loading ? (
          <div className="barberhistory__alert">Загрузка…</div>
        ) : rows.length === 0 ? (
          <div className="barberhistory__alert">Записей нет</div>
        ) : (
          rows.map((a) => {
            const date = dateISO(a.start_at);
            const time = timeISO(a.start_at);
            const client = clientNameOf(a, clients);
            const service = serviceNamesFromRecord(a, services);

            const totalPrice = priceOfAppointment(a, services);
            const basePrice = basePriceOfAppointment(a, services);
            const discountPct = discountPercentOfAppointment(
              a,
              basePrice,
              totalPrice
            );

            const statusKey = String(a.status || "").toLowerCase();
            const statusText = a.status_display || statusLabel(a.status);

            const statusClass =
              statusKey === "completed"
                ? "barberhistory__status barberhistory__status--completed"
                : statusKey === "canceled"
                ? "barberhistory__status barberhistory__status--canceled"
                : "barberhistory__status";

            const barber = barberNameOf(a, employees);
            const discountLabel =
              discountPct !== null ? `${discountPct}%` : "0%";

            return (
              <article
                key={a.id ?? `${a.start_at}-${client}-${service}`}
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
                    <span className="bh-item">
                      Сотрудник: {barber}
                    </span>
                    <span className="bh-item">
                      Клиент: {client}
                    </span>
                  </div>

                  <div className="barberhistory__metaRow">
                    <span className="bh-item">
                      Услуга: {service}
                    </span>
                  </div>

                  <div className="barberhistory__metaRow barberhistory__metaRow--summary">
                    <span className="bh-item">
                      Цена без скидки: {fmtMoney(basePrice)}
                    </span>
                    <span className="bh-item">
                      Скидка: {discountLabel}
                    </span>
                    <span className="bh-item bh-item--bold">
                      Итого: {fmtMoney(totalPrice)}
                    </span>
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
