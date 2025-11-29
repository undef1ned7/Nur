// // MastersHistory.jsx
// import React, {
//   useCallback,
//   useEffect,
//   useMemo,
//   useRef,
//   useState,
// } from "react";
// import "./MastersHistory.scss";
// import api from "../../../../../api";

// /* ===== utils ===== */
// const pad = (n) => String(n).padStart(2, "0");
// const asArray = (d) =>
//   Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
// const norm = (s) =>
//   String(s || "")
//     .trim()
//     .toLowerCase();

// const dateISO = (iso) => {
//   if (!iso) return "";
//   const d = new Date(iso);
//   if (Number.isNaN(d)) return "";
//   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// };
// const timeISO = (iso) => {
//   if (!iso) return "";
//   const d = new Date(iso);
//   if (Number.isNaN(d)) return "";
//   return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
// };
// const num = (v) => {
//   const n = Number(v);
//   return Number.isFinite(n) ? n : null;
// };
// const fmtMoney = (v) =>
//   v === null || v === undefined || v === ""
//     ? "—"
//     : `${Number(v).toLocaleString("ru-RU")} сом`;

// /* ===== name helpers ===== */
// const fullNameEmp = (e) =>
//   [e?.last_name || "", e?.first_name || ""].filter(Boolean).join(" ").trim() ||
//   e?.email ||
//   "—";

// const barberNameOf = (a, employees) => {
//   if (a?.barber_name) return a.barber_name;
//   if (a?.employee_name) return a.employee_name;
//   if (a?.master_name) return a.master_name;
//   const e = employees.find((x) => String(x.id) === String(a?.barber));
//   return e ? fullNameEmp(e) : "—";
// };

// const serviceNamesFromRecord = (r, services) => {
//   if (Array.isArray(r.services_names) && r.services_names.length)
//     return r.services_names.join(", ");
//   if (Array.isArray(r.services) && r.services.length) {
//     const m = new Map(services.map((s) => [String(s.id), s]));
//     const names = r.services.map(
//       (id) => m.get(String(id))?.service_name || m.get(String(id))?.name || id
//     );
//     return names.join(", ");
//   }
//   return r.service_name || "—";
// };

// const clientNameOf = (r, clients) => {
//   if (r.client_name) return r.client_name;
//   const c = clients.find((x) => String(x.id) === String(r.client));
//   return c?.full_name || c?.name || "—";
// };

// /* ===== price helpers ===== */
// const priceOfAppointment = (a, services) => {
//   const candidates = [
//     a.total,
//     a.total_price,
//     a.total_amount,
//     a.final_total,
//     a.payable_total,
//     a.grand_total,
//     a.sum,
//     a.amount,
//     a.service_total,
//     a.services_total,
//     a.service_price,
//     a.price,
//     a.discounted_total,
//     a.price_total,
//   ];
//   for (const c of candidates) {
//     const n = num(c);
//     if (n !== null) return n;
//   }

//   if (Array.isArray(a.services_details) && a.services_details.length) {
//     const s = a.services_details.reduce(
//       (acc, it) => acc + (num(it?.price) || 0),
//       0
//     );
//     if (s > 0) return s;
//   }

//   if (Array.isArray(a.services) && a.services.length) {
//     const m = new Map(services.map((s) => [String(s.id), s]));
//     const s = a.services.reduce(
//       (acc, id) => acc + (num(m.get(String(id))?.price) || 0),
//       0
//     );
//     if (s > 0) return s;
//   }

//   return null;
// };

// const basePriceOfAppointment = (a, services) => {
//   const candidates = [
//     a.base_price,
//     a.price_before_discount,
//     a.full_price,
//     a.sum_before_discount,
//   ];
//   for (const c of candidates) {
//     const n = num(c);
//     if (n !== null) return n;
//   }
//   return priceOfAppointment(a, services);
// };

// const discountPercentOfAppointment = (a, basePrice, totalPrice) => {
//   const direct = a.discount_percent ?? a.discount ?? a.discount_value ?? null;
//   const nDirect = num(direct);
//   if (nDirect !== null) return nDirect;

//   const base = num(basePrice);
//   const total = num(totalPrice);
//   if (base && total && base > total) {
//     const pct = Math.round((1 - total / base) * 100);
//     if (pct > 0) return pct;
//   }
//   return null;
// };

// /* ===== helpers: дата ===== */
// const getYMD = (iso) => {
//   const d = new Date(iso);
//   if (Number.isNaN(d)) return null;
//   return {
//     year: d.getFullYear(),
//     month: d.getMonth() + 1,
//     day: d.getDate(),
//   };
// };

// const monthNames = [
//   "Январь",
//   "Февраль",
//   "Март",
//   "Апрель",
//   "Май",
//   "Июнь",
//   "Июль",
//   "Август",
//   "Сентябрь",
//   "Октябрь",
//   "Ноябрь",
//   "Декабрь",
// ];

// /* ===== кастомный селект ===== */

// const MHSelect = ({
//   value,
//   onChange,
//   options,
//   placeholder = "Все",
//   disabled = false,
// }) => {
//   const [open, setOpen] = useState(false);
//   const ref = useRef(null);

//   useEffect(() => {
//     const handleClick = (e) => {
//       if (!ref.current) return;
//       if (!ref.current.contains(e.target)) setOpen(false);
//     };
//     document.addEventListener("mousedown", handleClick);
//     return () => document.removeEventListener("mousedown", handleClick);
//   }, []);

//   const current =
//     options.find((o) => String(o.value) === String(value)) || null;

//   const handleSelect = (val) => {
//     onChange(val);
//     setOpen(false);
//   };

//   return (
//     <div
//       className={`mh-select ${disabled ? "mh-select--disabled" : ""}`}
//       ref={ref}
//     >
//       <button
//         type="button"
//         className={`mh-select__control ${
//           open ? "mh-select__control--open" : ""
//         }`}
//         onClick={() => {
//           if (!disabled) setOpen((o) => !o);
//         }}
//       >
//         <span className="mh-select__value">
//           {current ? current.label : placeholder}
//         </span>
//         <span
//           className={`mh-select__arrow ${
//             open ? "mh-select__arrow--open" : ""
//           }`}
//         />
//       </button>

//       {open && !disabled && (
//         <div className="mh-select__dropdown">
//           <ul className="mh-select__list">
//             <li
//               className={`mh-select__option ${
//                 value === "" ? "mh-select__option--active" : ""
//               }`}
//               onClick={() => handleSelect("")}
//             >
//               {placeholder}
//             </li>
//             {options.map((opt) => (
//               <li
//                 key={opt.value}
//                 className={`mh-select__option ${
//                   String(opt.value) === String(value)
//                     ? "mh-select__option--active"
//                     : ""
//                 }`}
//                 onClick={() => handleSelect(opt.value)}
//               >
//                 {opt.label}
//               </li>
//             ))}
//           </ul>
//         </div>
//       )}
//     </div>
//   );
// };

// /* ===== main ===== */

// const MastersHistory = () => {
//   const [employees, setEmployees] = useState([]);
//   const [appointments, setAppointments] = useState([]);
//   const [services, setServices] = useState([]);
//   const [clients, setClients] = useState([]);

//   const [loading, setLoading] = useState(true);
//   const [err, setErr] = useState("");

//   const [employeeFilter, setEmployeeFilter] = useState("");
//   const [yearFilter, setYearFilter] = useState("");
//   const [monthFilter, setMonthFilter] = useState("");
//   const [dayFilter, setDayFilter] = useState("");

//   const fetchEmployees = useCallback(
//     async () => asArray((await api.get("/users/employees/")).data),
//     []
//   );
//   const fetchAppointments = useCallback(
//     async () => asArray((await api.get("/barbershop/appointments/")).data),
//     []
//   );
//   const fetchServices = useCallback(
//     async () => asArray((await api.get("/barbershop/services/")).data),
//     []
//   );
//   const fetchClients = useCallback(
//     async () => asArray((await api.get("/barbershop/clients/")).data),
//     []
//   );

//   useEffect(() => {
//     let alive = true;
//     (async () => {
//       try {
//         setLoading(true);
//         setErr("");
//         const [emps, appts, svcs, cls] = await Promise.all([
//           fetchEmployees(),
//           fetchAppointments(),
//           fetchServices(),
//           fetchClients(),
//         ]);
//         if (!alive) return;
//         setEmployees(emps);
//         setAppointments(appts);
//         setServices(svcs);
//         setClients(cls);
//       } catch {
//         if (!alive) return;
//         setErr("Не удалось загрузить историю.");
//       } finally {
//         if (alive) setLoading(false);
//       }
//     })();
//     return () => {
//       alive = false;
//     };
//   }, [fetchEmployees, fetchAppointments, fetchServices, fetchClients]);

//   /* фиксированные годы 2025–2026 */
//   const yearOptions = useMemo(() => [2025, 2026], []);

//   const daysInMonth = useMemo(() => {
//     if (!yearFilter || !monthFilter) return 31;
//     const y = Number(yearFilter);
//     const m = Number(monthFilter);
//     if (!Number.isFinite(y) || !Number.isFinite(m)) return 31;
//     return new Date(y, m, 0).getDate();
//   }, [yearFilter, monthFilter]);

//   /* фильтрация */
//   const filtered = useMemo(() => {
//     let arr = appointments.slice();

//     if (employeeFilter) {
//       const idStr = String(employeeFilter);
//       arr = arr.filter((a) => String(a.barber) === idStr);
//     }

//     if (yearFilter) {
//       const yStr = String(yearFilter);
//       const mStr = monthFilter ? pad(Number(monthFilter)) : "";
//       const dStr = dayFilter ? pad(Number(dayFilter)) : "";

//       arr = arr.filter((a) => {
//         const ymd = getYMD(a.start_at);
//         if (!ymd) return false;
//         if (String(ymd.year) !== yStr) return false;
//         if (mStr && pad(ymd.month) !== mStr) return false;
//         if (dStr && pad(ymd.day) !== dStr) return false;
//         return true;
//       });
//     }

//     return arr.sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
//   }, [appointments, employeeFilter, yearFilter, monthFilter, dayFilter]);

//   const rows = filtered;

//   const statusLabel = (s) => {
//     if (s === "booked") return "Забронировано";
//     if (s === "confirmed") return "Подтверждено";
//     if (s === "completed") return "Завершено";
//     if (s === "canceled") return "Отменено";
//     if (s === "no_show") return "Не пришёл";
//     return s || "—";
//   };

//   const statusKeyFromAppointment = (a) => {
//     const raw = norm(a.status || "");
//     if (raw === "booked") return "booked";
//     if (raw === "confirmed") return "confirmed";
//     if (raw === "completed") return "completed";
//     if (raw === "canceled") return "canceled";
//     if (raw === "no_show" || raw === "no-show") return "no-show";
//     return "other";
//   };

//   const totalLabel = loading
//     ? "Загрузка…"
//     : `${filtered.length} записей`;

//   return (
//     <section className="mastershistory">
//       <header className="mastershistory__header">
//         <span className="mastershistory__subtitle">{totalLabel}</span>

//         <div className="mastershistory__filters">
//           <label className="mastershistory__field">
//             <span className="mastershistory__label">Сотрудник</span>
//             <MHSelect
//               value={employeeFilter}
//               onChange={setEmployeeFilter}
//               options={employees.map((e) => ({
//                 value: String(e.id),
//                 label: fullNameEmp(e),
//               }))}
//               placeholder="Все"
//             />
//           </label>

//           <label className="mastershistory__field">
//             <span className="mastershistory__label">Год</span>
//             <MHSelect
//               value={yearFilter}
//               onChange={(val) => {
//                 setYearFilter(val);
//                 setMonthFilter("");
//                 setDayFilter("");
//               }}
//               options={yearOptions.map((y) => ({
//                 value: String(y),
//                 label: String(y),
//               }))}
//               placeholder="Все"
//             />
//           </label>

//           <label className="mastershistory__field">
//             <span className="mastershistory__label">Месяц</span>
//             <MHSelect
//               value={monthFilter}
//               onChange={(val) => {
//                 setMonthFilter(val);
//                 setDayFilter("");
//               }}
//               options={monthNames.map((label, idx) => ({
//                 value: String(idx + 1),
//                 label,
//               }))}
//               placeholder="Все"
//               disabled={!yearFilter}
//             />
//           </label>

//           <label className="mastershistory__field">
//             <span className="mastershistory__label">День</span>
//             <MHSelect
//               value={dayFilter}
//               onChange={setDayFilter}
//               options={Array.from({ length: daysInMonth }).map((_, i) => ({
//                 value: String(i + 1),
//                 label: pad(i + 1),
//               }))}
//               placeholder="Все"
//               disabled={!yearFilter || !monthFilter}
//             />
//           </label>
//         </div>
//       </header>

//       {!!err && <div className="mastershistory__alert">{err}</div>}

//       <div className="mastershistory__list">
//         {loading ? (
//           <div className="mastershistory__alert">Загрузка…</div>
//         ) : rows.length === 0 ? (
//           <div className="mastershistory__alert">Записей нет</div>
//         ) : (
//           rows.map((a) => {
//             const date = dateISO(a.start_at);
//             const time = timeISO(a.start_at);
//             const client = clientNameOf(a, clients);
//             const service = serviceNamesFromRecord(a, services);
//             const totalPrice = priceOfAppointment(a, services);
//             const basePrice = basePriceOfAppointment(a, services);
//             const discountPct = discountPercentOfAppointment(
//               a,
//               basePrice,
//               totalPrice
//             );

//             const statusText = a.status_display || statusLabel(a.status);
//             const statusKey = statusKeyFromAppointment(a);
//             const barber = barberNameOf(a, employees);
//             const discountLabel =
//               discountPct !== null ? `${discountPct}%` : "0%";

//             return (
//               <article
//                 key={a.id ?? `${a.start_at}-${client}-${service}`}
//                 className={`mastershistory__card mastershistory__card--${statusKey}`}
//               >
//                 <div className="mastershistory__cardHead">
//                   <h4 className="mastershistory__name">
//                     {date} • {time}
//                   </h4>
//                   <span
//                     className={`mastershistory__status mastershistory__status--${statusKey}`}
//                   >
//                     {statusText}
//                   </span>
//                 </div>

//                 <div className="mastershistory__body">
//                   <div className="mastershistory__line">
//                     <span className="mastershistory__key">Сотрудник:</span>
//                     <span className="mastershistory__value">{barber}</span>
//                   </div>
//                   <div className="mastershistory__line">
//                     <span className="mastershistory__key">Клиент:</span>
//                     <span className="mastershistory__value">{client}</span>
//                   </div>
//                   <div className="mastershistory__line">
//                     <span className="mastershistory__key">Услуга:</span>
//                     <span className="mastershistory__value">{service}</span>
//                   </div>
//                   <div className="mastershistory__line mastershistory__line--summary">
//                     <span className="mastershistory__key">
//                       Цена без скидки:
//                     </span>
//                     <span className="mastershistory__value">
//                       {fmtMoney(basePrice)}
//                     </span>

//                     <span className="mastershistory__key">Скидка:</span>
//                     <span className="mastershistory__value">
//                       {discountLabel}
//                     </span>

//                     <span className="mastershistory__key mastershistory__key--bold">
//                       Итого:
//                     </span>
//                     <span className="mastershistory__value mastershistory__value--bold">
//                       {fmtMoney(totalPrice)}
//                     </span>
//                   </div>
//                 </div>
//               </article>
//             );
//           })
//         )}
//       </div>
//     </section>
//   );
// };

// export default MastersHistory;



// MastersHistory.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./MastersHistory.scss";
import api from "../../../../../api";

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

/* ===== price helpers ===== */
/**
 * Итоговая цена записи (после скидки) — то, что реально оплачено.
 * В первую очередь берём поле price, которое пишет Recorda.
 */
const priceOfAppointment = (a, services) => {
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
const basePriceOfAppointment = (a, services) => {
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

const discountPercentOfAppointment = (a, basePrice, totalPrice) => {
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

/* ===== helpers: дата ===== */
const getYMD = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d)) return null;
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  };
};

const monthNames = [
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

/* ===== кастомный селект ===== */

const MHSelect = ({
  value,
  onChange,
  options,
  placeholder = "Все",
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current =
    options.find((o) => String(o.value) === String(value)) || null;

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div
      className={`mh-select ${disabled ? "mh-select--disabled" : ""}`}
      ref={ref}
    >
      <button
        type="button"
        className={`mh-select__control ${
          open ? "mh-select__control--open" : ""
        }`}
        onClick={() => {
          if (!disabled) setOpen((o) => !o);
        }}
      >
        <span className="mh-select__value">
          {current ? current.label : placeholder}
        </span>
        <span
          className={`mh-select__arrow ${
            open ? "mh-select__arrow--open" : ""
          }`}
        />
      </button>

      {open && !disabled && (
        <div className="mh-select__dropdown">
          <ul className="mh-select__list">
            <li
              className={`mh-select__option ${
                value === "" ? "mh-select__option--active" : ""
              }`}
              onClick={() => handleSelect("")}
            >
              {placeholder}
            </li>
            {options.map((opt) => (
              <li
                key={opt.value}
                className={`mh-select__option ${
                  String(opt.value) === String(value)
                    ? "mh-select__option--active"
                    : ""
                }`}
                onClick={() => handleSelect(opt.value)}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/* ===== main ===== */

const MastersHistory = () => {
  const [employees, setEmployees] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [clients, setClients] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [employeeFilter, setEmployeeFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");

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
  }, [fetchEmployees, fetchAppointments, fetchServices, fetchClients]);

  /* фиксированные годы 2025–2026 */
  const yearOptions = useMemo(() => [2025, 2026], []);

  const daysInMonth = useMemo(() => {
    if (!yearFilter || !monthFilter) return 31;
    const y = Number(yearFilter);
    const m = Number(monthFilter);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return 31;
    return new Date(y, m, 0).getDate();
  }, [yearFilter, monthFilter]);

  /* фильтрация */
  const filtered = useMemo(() => {
    let arr = appointments.slice();

    if (employeeFilter) {
      const idStr = String(employeeFilter);
      arr = arr.filter((a) => String(a.barber) === idStr);
    }

    if (yearFilter) {
      const yStr = String(yearFilter);
      const mStr = monthFilter ? pad(Number(monthFilter)) : "";
      const dStr = dayFilter ? pad(Number(dayFilter)) : "";

      arr = arr.filter((a) => {
        const ymd = getYMD(a.start_at);
        if (!ymd) return false;
        if (String(ymd.year) !== yStr) return false;
        if (mStr && pad(ymd.month) !== mStr) return false;
        if (dStr && pad(ymd.day) !== dStr) return false;
        return true;
      });
    }

    return arr.sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
  }, [appointments, employeeFilter, yearFilter, monthFilter, dayFilter]);

  const rows = filtered;

  const statusLabel = (s) => {
    if (s === "booked") return "Забронировано";
    if (s === "confirmed") return "Подтверждено";
    if (s === "completed") return "Завершено";
    if (s === "canceled") return "Отменено";
    if (s === "no_show") return "Не пришёл";
    return s || "—";
  };

  const statusKeyFromAppointment = (a) => {
    const raw = norm(a.status || "");
    if (raw === "booked") return "booked";
    if (raw === "confirmed") return "confirmed";
    if (raw === "completed") return "completed";
    if (raw === "canceled") return "canceled";
    if (raw === "no_show" || raw === "no-show") return "no-show";
    return "other";
  };

  const totalLabel = loading ? "Загрузка…" : `${filtered.length} записей`;

  return (
    <section className="mastershistory">
      <header className="mastershistory__header">
        <span className="mastershistory__subtitle">{totalLabel}</span>

        <div className="mastershistory__filters">
          <label className="mastershistory__field">
            <span className="mastershistory__label">Сотрудник</span>
            <MHSelect
              value={employeeFilter}
              onChange={setEmployeeFilter}
              options={employees.map((e) => ({
                value: String(e.id),
                label: fullNameEmp(e),
              }))}
              placeholder="Все"
            />
          </label>

          <label className="mastershistory__field">
            <span className="mastershistory__label">Год</span>
            <MHSelect
              value={yearFilter}
              onChange={(val) => {
                setYearFilter(val);
                setMonthFilter("");
                setDayFilter("");
              }}
              options={yearOptions.map((y) => ({
                value: String(y),
                label: String(y),
              }))}
              placeholder="Все"
            />
          </label>

          <label className="mastershistory__field">
            <span className="mastershistory__label">Месяц</span>
            <MHSelect
              value={monthFilter}
              onChange={(val) => {
                setMonthFilter(val);
                setDayFilter("");
              }}
              options={monthNames.map((label, idx) => ({
                value: String(idx + 1),
                label,
              }))}
              placeholder="Все"
              disabled={!yearFilter}
            />
          </label>

          <label className="mastershistory__field">
            <span className="mastershistory__label">День</span>
            <MHSelect
              value={dayFilter}
              onChange={setDayFilter}
              options={Array.from({ length: daysInMonth }).map((_, i) => ({
                value: String(i + 1),
                label: pad(i + 1),
              }))}
              placeholder="Все"
              disabled={!yearFilter || !monthFilter}
            />
          </label>
        </div>
      </header>

      {!!err && <div className="mastershistory__alert">{err}</div>}

      <div className="mastershistory__list">
        {loading ? (
          <div className="mastershistory__alert">Загрузка…</div>
        ) : rows.length === 0 ? (
          <div className="mastershistory__alert">Записей нет</div>
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

            const statusText = a.status_display || statusLabel(a.status);
            const statusKey = statusKeyFromAppointment(a);
            const barber = barberNameOf(a, employees);
            const discountLabel =
              discountPct !== null ? `${discountPct}%` : "0%";

            return (
              <article
                key={a.id ?? `${a.start_at}-${client}-${service}`}
                className={`mastershistory__card mastershistory__card--${statusKey}`}
              >
                <div className="mastershistory__cardHead">
                  <h4 className="mastershistory__name">
                    {date} • {time}
                  </h4>
                  <span
                    className={`mastershistory__status mastershistory__status--${statusKey}`}
                  >
                    {statusText}
                  </span>
                </div>

                <div className="mastershistory__body">
                  <div className="mastershistory__line">
                    <span className="mastershistory__key">Сотрудник:</span>
                    <span className="mastershistory__value">{barber}</span>
                  </div>
                  <div className="mastershistory__line">
                    <span className="mastershistory__key">Клиент:</span>
                    <span className="mastershistory__value">{client}</span>
                  </div>
                  <div className="mastershistory__line">
                    <span className="mastershistory__key">Услуга:</span>
                    <span className="mastershistory__value">{service}</span>
                  </div>
                  <div className="mastershistory__line mastershistory__line--summary">
                    <span className="mastershistory__key">
                      Цена без скидки:
                    </span>
                    <span className="mastershistory__value">
                      {fmtMoney(basePrice)}
                    </span>

                    <span className="mastershistory__key">Скидка:</span>
                    <span className="mastershistory__value">
                      {discountLabel}
                    </span>

                    <span className="mastershistory__key mastershistory__key--bold">
                      Итого:
                    </span>
                    <span className="mastershistory__value mastershistory__value--bold">
                      {fmtMoney(totalPrice)}
                    </span>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
};

export default MastersHistory;
