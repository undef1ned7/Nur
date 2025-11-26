// // PayrollDaily.jsx
// import React, { useEffect, useMemo, useRef, useState } from "react";
// import "./PayrollDaily.scss";
// import api from "../../../../api";
// import { FaCalendarAlt, FaChevronDown, FaDownload, FaSearch, FaTimes } from "react-icons/fa";

// /* ===================== helpers ===================== */
// const pad2 = (n) => String(n).padStart(2, "0");
// const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; };
// const toDate = (iso) => { if (!iso) return ""; const d = new Date(iso); if (Number.isNaN(d.getTime())) return ""; return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; };
// const monthLabelOf = (yyyyMmDd) => yyyyMmDd.slice(0, 7);
// const asArray = (d) => Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
// const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
// const fmtInt = (n) => Number(n || 0).toLocaleString("ru-RU");
// const fmtMoney = (n) => `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(toNum(n))} сом`;
// const isCompleted = (s) => ["completed","done","finished","завершено","завершен","закрыт","оплачен"].includes(String(s||"").trim().toLowerCase());

// /* ===================== ComboBox ===================== */
// const ComboBox = ({ items, value, onChange, placeholder = "Выберите", popupMaxHeight = 280 }) => {
//   const [open, setOpen] = useState(false);
//   const [q, setQ] = useState("");
//   const wrapRef = useRef(null);
//   const inputRef = useRef(null);

//   const selected = items.find((i) => String(i.id) === String(value));
//   const filtered = useMemo(() => {
//     const text = q.trim().toLowerCase();
//     if (!text) return items;
//     return items.filter((i) => (i.search || i.label || "").toLowerCase().includes(text));
//   }, [items, q]);

//   useEffect(() => {
//     const onDoc = (e) => { if (!wrapRef.current) return; if (!wrapRef.current.contains(e.target)) setOpen(false); };
//     const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
//     document.addEventListener("mousedown", onDoc);
//     document.addEventListener("keydown", onEsc);
//     return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
//   }, []);
//   useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus?.(), 0); }, [open]);

//   return (
//     <div className={`pd-combo ${open ? "pd-combo--open" : ""}`} ref={wrapRef}>
//       <button type="button" className="pd-combo__trigger" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} title={selected?.label || placeholder}>
//         <span className={`pd-combo__text ${selected ? "" : "pd-combo__text--ph"}`}>{selected?.label || placeholder}</span>
//         <FaChevronDown className="pd-combo__caret" />
//       </button>
//       {open && (
//         <div className="pd-combo__popup" role="listbox" style={{ maxHeight: popupMaxHeight }}>
//           <div className="pd-combo__search">
//             <FaSearch className="pd-combo__searchIcon" />
//             <input ref={inputRef} className="pd-combo__searchInput" placeholder="Поиск..." value={q} onChange={(e) => setQ(e.target.value)} />
//           </div>
//           <div className="pd-combo__list">
//             {filtered.length === 0 ? <div className="pd-combo__empty">Ничего не найдено</div> :
//               filtered.map((it) => (
//                 <button key={it.id} type="button" className="pd-combo__option" onClick={() => { onChange?.(it.id, it); setOpen(false); setQ(""); }} title={it.label}>
//                   {it.label}
//                 </button>
//               ))}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// /* ===================== Modal ===================== */
// const DetailsModal = ({ open, title, rows, onClose }) => {
//   const bodyRef = useRef(null);
//   useEffect(() => { const onEsc = (e) => e.key === "Escape" && onClose?.(); if (open) document.addEventListener("keydown", onEsc); return () => document.removeEventListener("keydown", onEsc); }, [open, onClose]);
//   if (!open) return null;
//   return (
//     <div className="payrolldaily__overlay" onClick={onClose} role="dialog" aria-modal="true">
//       <div className="payrolldaily__modal" onClick={(e) => e.stopPropagation()}>
//         <div className="payrolldaily__modalHead">
//           <h4 className="payrolldaily__modalTitle">{title}</h4>
//           <button type="button" className="payrolldaily__iconBtn" aria-label="Закрыть" onClick={onClose} title="Закрыть"><FaTimes /></button>
//         </div>
//         <div className="payrolldaily__modalBody" ref={bodyRef}>
//           <div className="payrolldaily__tableWrap payrolldaily__tableWrap--modal">
//             <table className="payrolldaily__table">
//               <thead>
//                 <tr>
//                   <th>Время</th>
//                   <th>Клиент</th>
//                   <th>Услуги</th>
//                   <th className="is-money">Сумма</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {rows.length === 0 ? (
//                   <tr><td colSpan={4} className="payrolldaily__empty">Нет данных</td></tr>
//                 ) : rows.map((r) => (
//                   <tr key={r.id}>
//                     <td>{r.time}</td>
//                     <td>{r.client}</td>
//                     <td className="payrolldaily__ellipsis" title={r.services}>{r.services}</td>
//                     <td className="is-money">{fmtMoney(r.amount)}</td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </div>
//         <div className="payrolldaily__modalFoot">
//           <button type="button" className="payrolldaily__btn payrolldaily__btn--secondary" onClick={onClose}>Закрыть</button>
//         </div>
//       </div>
//     </div>
//   );
// };

// /* ===================== Main ===================== */
// const PayrollDaily = () => {
//   const [date, setDate] = useState(todayStr());
//   const [employees, setEmployees] = useState([]);
//   const [services, setServices] = useState([]);
//   const [appointments, setAppointments] = useState([]);
//   const [rates, setRates] = useState({}); // { [empId]: { perRecord, percent } }
//   const [fltEmployee, setFltEmployee] = useState("");
//   const [loading, setLoading] = useState(true);
//   const [errMsg, setErrMsg] = useState("");
//   const [modal, setModal] = useState({ open: false, title: "", rows: [] });

//   const fetchPaged = async (url) => {
//     const acc = [];
//     let next = url;
//     const seen = new Set();
//     while (next && !seen.has(next)) {
//       try {
//         seen.add(next);
//         const { data } = await api.get(next);
//         acc.push(...asArray(data));
//         next = data?.next;
//       } catch { break; }
//     }
//     return acc;
//   };

//   const loadAll = async (curDate) => {
//     setLoading(true); setErrMsg("");
//     try {
//       const [emps, svcs, apps] = await Promise.all([
//         fetchPaged("/users/employees/"),
//         fetchPaged("/barbershop/services/"),
//         fetchPaged("/barbershop/appointments/"),
//       ]);
//       const normEmp = emps
//         .map((e) => {
//           const first = e.first_name ?? ""; const last = e.last_name ?? "";
//           const name = [last, first].filter(Boolean).join(" ").trim() || e.email || "—";
//           return { id: e.id, label: name, search: name };
//         })
//         .sort((a, b) => a.label.localeCompare(b.label, "ru"));
//       const normSvc = svcs.map((s) => ({ id: s.id, name: s.service_name || s.name || "", price: toNum(s.price) }));
//       setEmployees(normEmp); setServices(normSvc);
//       const dStr = curDate || date;
//       setAppointments(asArray(apps).filter((a) => toDate(a.start_at) === dStr));
//     } catch {
//       setErrMsg("Не удалось загрузить данные."); setEmployees([]); setServices([]); setAppointments([]);
//     } finally { setLoading(false); }
//   };

//   const loadRates = async (period) => {
//     try {
//       const RATES_EP = "/education/teacher-rates/";
//       const safeGet = async (mode) => { try { return await api.get(RATES_EP, { params: { period, mode, page_size: 1000 } }); } catch { return null; } };
//       const resLesson = await safeGet("lesson");
//       let resPercent = await safeGet("percent"); if (!resPercent) resPercent = await safeGet("month");
//       const map = {};
//       const put = (resp, kind) => (asArray(resp?.data) || []).forEach((r) => {
//         const id = r.teacher || r.teacher_id || r.user || r.employee || r.master; if (!id) return;
//         map[id] = map[id] || {};
//         if (kind === "lesson") map[id].perRecord = toNum(r.rate);
//         else map[id].percent = Math.min(100, Math.max(0, toNum(r.rate)));
//       });
//       if (resLesson) put(resLesson, "lesson");
//       if (resPercent) put(resPercent, "percent");
//       setRates(map);
//     } catch { setRates({}); }
//   };

//   useEffect(() => { const period = monthLabelOf(date); loadAll(date); loadRates(period); }, [date]);

//   const serviceById = (id) => services.find((s) => String(s.id) === String(id));
//   const priceOfAppointment = (a) => {
//     const svcSum = Array.isArray(a.services) ? a.services.reduce((s, it) => s + toNum(it?.price ?? it?.amount ?? it?.total), 0) : 0;
//     const itemsSum = Array.isArray(a.items) ? a.items.reduce((s, it) => s + toNum(it?.price ?? it?.amount ?? it?.total), 0) : 0;
//     const fallbacks = [a.total_amount, a.total, svcSum, itemsSum, a.paid_amount, a.amount, a.service_price, a.price];
//     for (const v of fallbacks) { const n = toNum(v); if (n) return n; }
//     if (a.service) { const meta = serviceById(a.service); const n = toNum(meta?.price); if (n) return n; }
//     return 0;
//   };
//   const clientName = (a) => a.client_name || a.client || a.customer || a.client_id || "—";
//   const serviceNames = (a) => Array.isArray(a.services) && a.services.length
//       ? a.services.map((s) => (typeof s === "object" ? (s.name || s.service_name) : serviceById(s)?.name)).filter(Boolean).join(", ")
//       : (a.service_name || serviceById(a.service)?.name || "—");
//   const timeRange = (a) => {
//     const t = (iso) => { const d = new Date(iso); if (Number.isNaN(d.getTime())) return "—"; return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
//     return `${t(a.start_at)}–${t(a.end_at)}`;
//   };

//   const completedByEmp = useMemo(() => {
//     const map = new Map();
//     appointments.filter((a) => isCompleted(a?.status)).forEach((a) => {
//       const key = String(a.barber || a.employee || a.master || ""); if (!key) return;
//       const row = map.get(key) || {
//         id: key,
//         name: employees.find((e) => String(e.id) === key)?.label || `ID ${key}`,
//         records: 0, revenue: 0, details: [],
//       };
//       row.records += 1;
//       const amount = priceOfAppointment(a);
//       row.revenue += amount;
//       row.details.push({ id: a.id, time: timeRange(a), client: clientName(a), services: serviceNames(a), amount });
//       map.set(key, row);
//     });
//     return [...map.values()];
//   }, [appointments, employees, services]);

//   const withPayout = useMemo(() => {
//     return completedByEmp
//       .map((row) => {
//         const r = rates[row.id] || {};
//         const percent = Math.min(100, Math.max(0, toNum(r.percent)));
//         const perRecord = toNum(r.perRecord);
//         const mode = percent > 0 ? "percent" : "lesson";
//         const rateLabel = percent > 0 ? `${percent}%` : `${fmtMoney(perRecord)}`;
//         const payout = percent > 0 ? Math.round((row.revenue * percent) / 100) : perRecord * row.records;
//         return { ...row, mode, rateLabel, payout };
//       })
//       .filter((r) => (fltEmployee ? String(r.id) === String(fltEmployee) : true))
//       .sort((a, b) => b.payout - a.payout || b.revenue - a.revenue);
//   }, [completedByEmp, rates, fltEmployee]);

//   const totals = useMemo(() => ({
//     records: withPayout.reduce((s, r) => s + r.records, 0),
//     revenue: withPayout.reduce((s, r) => s + r.revenue, 0),
//     payout:  withPayout.reduce((s, r) => s + r.payout, 0),
//   }), [withPayout]);

//   const openDetails = (row) => setModal({ open: true, title: `${row.name} — ${date}`, rows: row.details.sort((a, b) => (a.time > b.time ? 1 : -1)) });
//   const closeDetails = () => setModal((m) => ({ ...m, open: false }));

//   const exportCsv = () => {
//     try {
//       const header = ["Дата","Мастер","Записей","Выручка","Режим","Ставка/Процент","К выплате"];
//       const lines = [header.join(",")];
//       withPayout.forEach((r) => lines.push([date, `"${r.name.replace(/"/g,'""')}"`, r.records, r.revenue, r.mode === "percent" ? "Процент" : "Ставка", `"${r.rateLabel}"`, r.payout].join(",")));
//       lines.push(["ИТОГО","", totals.records, totals.revenue, "", "", totals.payout].join(","));
//       const csv = "\uFEFF" + lines.join("\n");
//       const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
//       const url = URL.createObjectURL(blob); const a = document.createElement("a");
//       a.href = url; a.download = `payroll_${date}.csv`; document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); a.remove();
//     } catch {}
//   };

//   const employeeItems = useMemo(() => [{ id: "", label: "Все сотрудники", search: "все" }, ...employees], [employees]);

//   return (
//     <div className="payrolldaily">
//       <header className="payrolldaily__head">
//         <div className="payrolldaily__titleWrap">
//           <h2 className="payrolldaily__title">Ежедневные выплаты</h2>
//           <span className="payrolldaily__subtitle" aria-live="polite">
//             {loading ? "Загрузка…" : `${fmtInt(withPayout.length)} мастеров · ${fmtInt(totals.records)} записей · ${fmtMoney(totals.payout)} к выплате`}
//           </span>
//         </div>
//         <div className="payrolldaily__filters">
//           <div className="payrolldaily__date">
//             <FaCalendarAlt className="payrolldaily__dateIcon" />
//             <input type="date" className="payrolldaily__dateInput" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Дата" />
//           </div>
//           <ComboBox items={employeeItems} value={fltEmployee} onChange={(id) => setFltEmployee(String(id))} placeholder="Все сотрудники" />
//           <button type="button" className="payrolldaily__btn payrolldaily__btn--secondary" onClick={() => { loadAll(date); loadRates(monthLabelOf(date)); }} title="Обновить данные">Обновить</button>
//           <button type="button" className="payrolldaily__btn payrolldaily__btn--primary payrolldaily__btn--icon" onClick={exportCsv} title="Экспорт CSV" aria-label="Экспорт CSV">
//             <FaDownload /><span className="payrolldaily__btnText">Экспорт</span>
//           </button>
//         </div>
//       </header>

//       {errMsg && <div className="payrolldaily__alert">{errMsg}</div>}

//       <div className="payrolldaily__tableWrap">
//         <table className="payrolldaily__table">
//           <thead>
//             <tr>
//               <th>Мастер</th><th>Записей</th><th className="is-money">Выручка</th><th>Режим</th><th>Ставка/Процент</th><th className="is-money">К выплате</th><th />
//             </tr>
//           </thead>
//           <tbody>
//             {loading ? (
//               <tr><td colSpan={7} className="payrolldaily__muted">Загрузка…</td></tr>
//             ) : withPayout.length === 0 ? (
//               <tr><td colSpan={7} className="payrolldaily__muted">Нет данных за выбранную дату.</td></tr>
//             ) : withPayout.map((r) => (
//               <tr key={r.id}>
//                 <td className="payrolldaily__ellipsis" title={r.name}>{r.name}</td>
//                 <td>{fmtInt(r.records)}</td>
//                 <td className="is-money">{fmtMoney(r.revenue)}</td>
//                 <td>{r.mode === "percent" ? "Процент" : "Ставка"}</td>
//                 <td>{r.rateLabel}</td>
//                 <td className="is-money">{fmtMoney(r.payout)}</td>
//                 <td className="payrolldaily__actions">
//                   <button type="button" className="payrolldaily__link" onClick={() => openDetails(r)} title="Показать записи">Записи</button>
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//           <tfoot>
//             <tr>
//               <th>Итого</th>
//               <th>{fmtInt(totals.records)}</th>
//               <th className="is-money">{fmtMoney(totals.revenue)}</th>
//               <th /><th /><th className="is-money">{fmtMoney(totals.payout)}</th><th />
//             </tr>
//           </tfoot>
//         </table>
//       </div>

//       <DetailsModal open={modal.open} title={modal.title} rows={modal.rows} onClose={closeDetails} />
//     </div>
//   );
// };

// export default PayrollDaily;




// PayrollDaily.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./PayrollDaily.scss";
import api from "../../../../api";
import { FaCalendarAlt, FaChevronDown, FaDownload, FaSearch, FaTimes } from "react-icons/fa";

/* ===================== helpers ===================== */
const pad2 = (n) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; };
const toDate = (iso) => { if (!iso) return ""; const d = new Date(iso); if (Number.isNaN(d.getTime())) return ""; return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; };
const monthLabelOf = (yyyyMmDd) => yyyyMmDd.slice(0, 7);
const asArray = (d) => Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const fmtInt = (n) => Number(n || 0).toLocaleString("ru-RU");
const fmtMoney = (n) => `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(toNum(n))} сом`;
const isCompleted = (s) => ["completed","done","finished","завершено","завершен","закрыт","оплачен"].includes(String(s||"").trim().toLowerCase());

/* ===================== ComboBox ===================== */
const ComboBox = ({ items, value, onChange, placeholder = "Выберите", popupMaxHeight = 280 }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const selected = items.find((i) => String(i.id) === String(value));
  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    if (!text) return items;
    return items.filter((i) => (i.search || i.label || "").toLowerCase().includes(text));
  }, [items, q]);

  useEffect(() => {
    const onDoc = (e) => { if (!wrapRef.current) return; if (!wrapRef.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, []);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus?.(), 0); }, [open]);

  return (
    <div className={`pd-combo ${open ? "pd-combo--open" : ""}`} ref={wrapRef}>
      <button type="button" className="pd-combo__trigger" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} title={selected?.label || placeholder}>
        <span className={`pd-combo__text ${selected ? "" : "pd-combo__text--ph"}`}>{selected?.label || placeholder}</span>
        <FaChevronDown className="pd-combo__caret" />
      </button>
      {open && (
        <div className="pd-combo__popup" role="listbox" style={{ maxHeight: popupMaxHeight }}>
          <div className="pd-combo__search">
            <FaSearch className="pd-combo__searchIcon" />
            <input ref={inputRef} className="pd-combo__searchInput" placeholder="Поиск..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="pd-combo__list">
            {filtered.length === 0 ? <div className="pd-combo__empty">Ничего не найдено</div> :
              filtered.map((it) => (
                <button key={it.id} type="button" className="pd-combo__option" onClick={() => { onChange?.(it.id, it); setOpen(false); setQ(""); }} title={it.label}>
                  {it.label}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ===================== Modal ===================== */
const DetailsModal = ({ open, title, rows, onClose }) => {
  const bodyRef = useRef(null);
  useEffect(() => { const onEsc = (e) => e.key === "Escape" && onClose?.(); if (open) document.addEventListener("keydown", onEsc); return () => document.removeEventListener("keydown", onEsc); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="payrolldaily__overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="payrolldaily__modal" onClick={(e) => e.stopPropagation()}>
        <div className="payrolldaily__modalHead">
          <h4 className="payrolldaily__modalTitle">{title}</h4>
          <button type="button" className="payrolldaily__iconBtn" aria-label="Закрыть" onClick={onClose} title="Закрыть"><FaTimes /></button>
        </div>
        <div className="payrolldaily__modalBody" ref={bodyRef}>
          <div className="payrolldaily__tableWrap payrolldaily__tableWrap--modal">
            <table className="payrolldaily__table">
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Клиент</th>
                  <th>Услуги</th>
                  <th className="is-money">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={4} className="payrolldaily__empty">Нет данных</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.time}</td>
                    <td>{r.client}</td>
                    <td className="payrolldaily__ellipsis" title={r.services}>{r.services}</td>
                    <td className="is-money">{fmtMoney(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="payrolldaily__modalFoot">
          <button type="button" className="payrolldaily__btn payrolldaily__btn--secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
};

/* ===================== Main ===================== */
const PayrollDaily = () => {
  const [date, setDate] = useState(todayStr());
  const [employees, setEmployees] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [rates, setRates] = useState({}); // { [empId]: { perRecord, percent } }
  const [fltEmployee, setFltEmployee] = useState("");
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const [modal, setModal] = useState({ open: false, title: "", rows: [] });

  const fetchPaged = async (url) => {
    const acc = [];
    let next = url;
    const seen = new Set();
    while (next && !seen.has(next)) {
      try {
        seen.add(next);
        const { data } = await api.get(next);
        acc.push(...asArray(data));
        next = data?.next;
      } catch { break; }
    }
    return acc;
  };

  const loadAll = async (curDate) => {
    setLoading(true); setErrMsg("");
    try {
      const [emps, svcs, apps] = await Promise.all([
        fetchPaged("/users/employees/"),
        fetchPaged("/barbershop/services/"),
        fetchPaged("/barbershop/appointments/"),
      ]);
      const normEmp = emps
        .map((e) => {
          const first = e.first_name ?? ""; const last = e.last_name ?? "";
          const name = [last, first].filter(Boolean).join(" ").trim() || e.email || "—";
          return { id: e.id, label: name, search: name };
        })
        .sort((a, b) => a.label.localeCompare(b.label, "ru"));
      const normSvc = svcs.map((s) => ({ id: s.id, name: s.service_name || s.name || "", price: toNum(s.price) }));
      setEmployees(normEmp); setServices(normSvc);
      const dStr = curDate || date;
      setAppointments(asArray(apps).filter((a) => toDate(a.start_at) === dStr));
    } catch {
      setErrMsg("Не удалось загрузить данные."); setEmployees([]); setServices([]); setAppointments([]);
    } finally { setLoading(false); }
  };

  const loadRates = async (period) => {
    try {
      const RATES_EP = "/education/teacher-rates/";
      const safeGet = async (mode) => { try { return await api.get(RATES_EP, { params: { period, mode, page_size: 1000 } }); } catch { return null; } };
      const resLesson = await safeGet("lesson");
      let resPercent = await safeGet("percent"); if (!resPercent) resPercent = await safeGet("month");
      const map = {};
      const put = (resp, kind) => (asArray(resp?.data) || []).forEach((r) => {
        const id = r.teacher || r.teacher_id || r.user || r.employee || r.master; if (!id) return;
        map[id] = map[id] || {};
        if (kind === "lesson") map[id].perRecord = toNum(r.rate);
        else map[id].percent = Math.min(100, Math.max(0, toNum(r.rate)));
      });
      if (resLesson) put(resLesson, "lesson");
      if (resPercent) put(resPercent, "percent");
      setRates(map);
    } catch { setRates({}); }
  };

  useEffect(() => { const period = monthLabelOf(date); loadAll(date); loadRates(period); }, [date]);

  const serviceById = (id) => services.find((s) => String(s.id) === String(id));

  // ВАЖНО: выручка только из поля price самой записи
  const priceOfAppointment = (a) => toNum(a.price);

  const clientName = (a) => a.client_name || a.client || a.customer || a.client_id || "—";
  const serviceNames = (a) => Array.isArray(a.services) && a.services.length
      ? a.services.map((s) => (typeof s === "object" ? (s.name || s.service_name) : serviceById(s)?.name)).filter(Boolean).join(", ")
      : (a.service_name || serviceById(a.service)?.name || "—");
  const timeRange = (a) => {
    const t = (iso) => { const d = new Date(iso); if (Number.isNaN(d.getTime())) return "—"; return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
    return `${t(a.start_at)}–${t(a.end_at)}`;
  };

  const completedByEmp = useMemo(() => {
    const map = new Map();
    appointments.filter((a) => isCompleted(a?.status)).forEach((a) => {
      const key = String(a.barber || a.employee || a.master || ""); if (!key) return;
      const row = map.get(key) || {
        id: key,
        name: employees.find((e) => String(e.id) === key)?.label || `ID ${key}`,
        records: 0, revenue: 0, details: [],
      };
      row.records += 1;
      const amount = priceOfAppointment(a);
      row.revenue += amount;
      row.details.push({ id: a.id, time: timeRange(a), client: clientName(a), services: serviceNames(a), amount });
      map.set(key, row);
    });
    return [...map.values()];
  }, [appointments, employees, services]);

  const withPayout = useMemo(() => {
    return completedByEmp
      .map((row) => {
        const r = rates[row.id] || {};
        const percent = Math.min(100, Math.max(0, toNum(r.percent)));
        const perRecord = toNum(r.perRecord);
        const mode = percent > 0 ? "percent" : "lesson";
        const rateLabel = percent > 0 ? `${percent}%` : `${fmtMoney(perRecord)}`;
        const payout = percent > 0 ? Math.round((row.revenue * percent) / 100) : perRecord * row.records;
        return { ...row, mode, rateLabel, payout };
      })
      .filter((r) => (fltEmployee ? String(r.id) === String(fltEmployee) : true))
      .sort((a, b) => b.payout - a.payout || b.revenue - a.revenue);
  }, [completedByEmp, rates, fltEmployee]);

  const totals = useMemo(() => ({
    records: withPayout.reduce((s, r) => s + r.records, 0),
    revenue: withPayout.reduce((s, r) => s + r.revenue, 0),
    payout:  withPayout.reduce((s, r) => s + r.payout, 0),
  }), [withPayout]);

  const openDetails = (row) => setModal({ open: true, title: `${row.name} — ${date}`, rows: row.details.sort((a, b) => (a.time > b.time ? 1 : -1)) });
  const closeDetails = () => setModal((m) => ({ ...m, open: false }));

  const exportCsv = () => {
    try {
      const header = ["Дата","Мастер","Записей","Выручка","Режим","Ставка/Процент","К выплате"];
      const lines = [header.join(",")];
      withPayout.forEach((r) => lines.push([date, `"${r.name.replace(/"/g,'""')}"`, r.records, r.revenue, r.mode === "percent" ? "Процент" : "Ставка", `"${r.rateLabel}"`, r.payout].join(",")));
      lines.push(["ИТОГО","", totals.records, totals.revenue, "", "", totals.payout].join(","));
      const csv = "\uFEFF" + lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = `payroll_${date}.csv`; document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); a.remove();
    } catch {}
  };

  const employeeItems = useMemo(() => [{ id: "", label: "Все сотрудники", search: "все" }, ...employees], [employees]);

  return (
    <div className="payrolldaily">
      <header className="payrolldaily__head">
        <div className="payrolldaily__titleWrap">
          <h2 className="payrolldaily__title">Ежедневные выплаты</h2>
          <span className="payrolldaily__subtitle" aria-live="polite">
            {loading ? "Загрузка…" : `${fmtInt(withPayout.length)} мастеров · ${fmtInt(totals.records)} записей · ${fmtMoney(totals.payout)} к выплате`}
          </span>
        </div>
        <div className="payrolldaily__filters">
          <div className="payrolldaily__date">
            <FaCalendarAlt className="payrolldaily__dateIcon" />
            <input type="date" className="payrolldaily__dateInput" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Дата" />
          </div>
          <ComboBox items={employeeItems} value={fltEmployee} onChange={(id) => setFltEmployee(String(id))} placeholder="Все сотрудники" />
          <button type="button" className="payrolldaily__btn payrolldaily__btn--secondary" onClick={() => { loadAll(date); loadRates(monthLabelOf(date)); }} title="Обновить данные">Обновить</button>
          <button type="button" className="payrolldaily__btn payrolldaily__btn--primary payrolldaily__btn--icon" onClick={exportCsv} title="Экспорт CSV" aria-label="Экспорт CSV">
            <FaDownload /><span className="payrolldaily__btnText">Экспорт</span>
          </button>
        </div>
      </header>

      {errMsg && <div className="payrolldaily__alert">{errMsg}</div>}

      <div className="payrolldaily__tableWrap">
        <table className="payrolldaily__table">
          <thead>
            <tr>
              <th>Мастер</th><th>Записей</th><th className="is-money">Выручка</th><th>Режим</th><th>Ставка/Процент</th><th className="is-money">К выплате</th><th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="payrolldaily__muted">Загрузка…</td></tr>
            ) : withPayout.length === 0 ? (
              <tr><td colSpan={7} className="payrolldaily__muted">Нет данных за выбранную дату.</td></tr>
            ) : withPayout.map((r) => (
              <tr key={r.id}>
                <td className="payrolldaily__ellipsis" title={r.name}>{r.name}</td>
                <td>{fmtInt(r.records)}</td>
                <td className="is-money">{fmtMoney(r.revenue)}</td>
                <td>{r.mode === "percent" ? "Процент" : "Ставка"}</td>
                <td>{r.rateLabel}</td>
                <td className="is-money">{fmtMoney(r.payout)}</td>
                <td className="payrolldaily__actions">
                  <button type="button" className="payrolldaily__link" onClick={() => openDetails(r)} title="Показать записи">Записи</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>Итого</th>
              <th>{fmtInt(totals.records)}</th>
              <th className="is-money">{fmtMoney(totals.revenue)}</th>
              <th /><th /><th className="is-money">{fmtMoney(totals.payout)}</th><th />
            </tr>
          </tfoot>
        </table>
      </div>

      <DetailsModal open={modal.open} title={modal.title} rows={modal.rows} onClose={closeDetails} />
    </div>
  );
};

export default PayrollDaily;

