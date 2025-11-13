// src/components/Education/History.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./History.scss";
import api from "../../../../api";
import { useSelector } from "react-redux";

/* ===== utils ===== */
const pad = (n) => String(n).padStart(2, "0");
const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
const norm = (s) =>
  String(s || "")
    .trim()
    .toLowerCase();

const dateISO = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d)) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const timeISO = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d)) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const fmtMoney = (v) =>
  v === null || v === undefined || v === ""
    ? "—"
    : `${Number(v).toLocaleString("ru-RU")} сом`;

/* ===== name helpers ===== */
const fullNameEmp = (e) =>
  [e?.last_name || "", e?.first_name || ""].filter(Boolean).join(" ").trim() ||
  e?.email ||
  "—";

const barberNameOf = (a, employees) => {
  if (a?.barber_name) return a.barber_name;
  if (a?.employee_name) return a.employee_name;
  if (a?.master_name) return a.master_name;
  const e = employees.find((x) => String(x.id) === String(a?.barber));
  return e ? fullNameEmp(e) : "—";
};

const serviceNamesFromRecord = (r, services) => {
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

const clientNameOf = (r, clients) => {
  if (r.client_name) return r.client_name;
  const c = clients.find((x) => String(x.id) === String(r.client));
  return c?.full_name || c?.name || "—";
};
const clientPhoneOf = (r, clients) => {
  if (r.client_phone) return r.client_phone;
  const c = clients.find((x) => String(x.id) === String(r.client));
  return c?.phone || c?.phone_number || "";
};

/* ===== price resolver ===== */
const priceOfAppointment = (a, services) => {
  // 1) любые числовые поля, которые часто встречаются в API
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

  // 2) детальные услуги с ценой
  if (Array.isArray(a.services_details) && a.services_details.length) {
    const s = a.services_details.reduce(
      (acc, it) => acc + (num(it?.price) || 0),
      0
    );
    if (s > 0) return s;
  }

  // 3) список id услуг → суммируем цены из справочника услуг
  if (Array.isArray(a.services) && a.services.length) {
    const m = new Map(services.map((s) => [String(s.id), s]));
    const s = a.services.reduce(
      (acc, id) => acc + (num(m.get(String(id))?.price) || 0),
      0
    );
    if (s > 0) return s;
  }

  return null; // не нашли
};

/* ===== main ===== */
const PAGE_SIZE = 12;

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

  const [from, setFrom] = useState(""); // YYYY-MM-DD
  const [to, setTo] = useState(""); // YYYY-MM-DD
  const [page, setPage] = useState(1);

  const invalidRange = useMemo(() => from && to && from > to, [from, to]);

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
      const t = new Date(`${from}T00:00:00`).getTime();
      arr = arr.filter((x) => new Date(x.start_at).getTime() >= t);
    }
    if (to) {
      const t = new Date(`${to}T23:59:59`).getTime();
      arr = arr.filter((x) => new Date(x.start_at).getTime() <= t);
    }
    return arr;
  }, [myAppointments, from, to, invalidRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [from, to, filtered.length]);

  const statusLabel = (s) =>
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

  return (
    <section className="barberhistory">
      <header className="barberhistory__header">
        <div className="barberhistory__titleWrap">
          <h2 className="barberhistory__title">Моя история</h2>
          <span className="barberhistory__subtitle">
            {loading
              ? "Загрузка…"
              : `${filtered.length} записей${
                  filtered.length > PAGE_SIZE
                    ? ` · стр. ${safePage}/${totalPages}`
                    : ""
                }`}
          </span>
        </div>

        <div className="barberhistory__filters">
          <label
            className={`barberhistory__field ${
              invalidRange ? "barberhistory__field--invalid" : ""
            }`}
          >
            <span className="barberhistory__label">От</span>
            <input
              type="date"
              className="barberhistory__input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label
            className={`barberhistory__field ${
              invalidRange ? "barberhistory__field--invalid" : ""
            }`}
          >
            <span className="barberhistory__label">До</span>
            <input
              type="date"
              className="barberhistory__input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="barberhistory__btn barberhistory__btn--secondary"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
          >
            Сброс
          </button>
        </div>
      </header>

      {!!err && <div className="barberhistory__alert">{err}</div>}
      {invalidRange && (
        <div className="barberhistory__alert">Диапазон дат неверен.</div>
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
            const phone = clientPhoneOf(a, clients);
            const service = serviceNamesFromRecord(a, services);
            const price = priceOfAppointment(a, services);
            const status = a.status_display || statusLabel(a.status);
            const barber = barberNameOf(a, employees);

            return (
              <article
                key={a.id ?? `${a.start_at}-${client}-${service}`}
                className="barberhistory__card"
              >
                <div className="barberhistory__cardHead">
                  <h4 className="barberhistory__name">
                    {date} • {time}
                  </h4>
                  <span className="barberhistory__status">{status}</span>
                </div>

                <div className="barberhistory__meta">
                  <span className="bh-item">Сотрудник: {barber}</span>
                  <span className="bh-item">Клиент: {client}</span>
                  {phone ? <span className="bh-item">{phone}</span> : null}
                  <span className="bh-item">Услуга: {service}</span>
                  <span className="bh-item">Цена: {fmtMoney(price)}</span>
                </div>
              </article>
            );
          })
        )}
      </div>

      {filtered.length > PAGE_SIZE && (
        <nav className="barberhistory__pager" aria-label="Пагинация">
          <button
            className="barberhistory__pageBtn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
          >
            Назад
          </button>
          <span className="barberhistory__pageInfo">
            Стр. {safePage}/{totalPages}
          </span>
          <button
            className="barberhistory__pageBtn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
          >
            Далее
          </button>
        </nav>
      )}
    </section>
  );
};

export default History;
