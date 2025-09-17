// import React, { useEffect, useMemo, useState } from "react";
// import api from "../../../../api";
// import "./CashReports.scss";
// import { FaFileCsv } from "react-icons/fa";

// /* ===== Доп. импорты для вкладки Аналитика (Продажи/Склад/Бренды/Категории/Касса) ===== */
// import { useDispatch, useSelector } from "react-redux";
// import { historySellProduct } from "../../../../store/creators/saleThunk";
// import {
//   fetchProductsAsync,
//   fetchBrandsAsync,
//   fetchCategoriesAsync,
// } from "../../../../store/creators/productCreators";
// import { useSale } from "../../../../store/slices/saleSlice";

// /* ================== helpers (shared) ================== */
// const num = (v) => {
//   const n = Number(v);
//   return Number.isFinite(n) ? n : 0;
// };
// const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
// const sortKeysAsc = (arr) => [...arr].sort((a, b) => (a > b ? 1 : -1));
// const listFrom = (r) => r?.data?.results || r?.data || [];
// const asArray = (d) =>
//   Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
// const pad2 = (n) => String(n).padStart(2, "0");
// const toISODate = (d) =>
//   `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
// const parseISO = (s) => {
//   const d = new Date(s);
//   return Number.isNaN(d.getTime()) ? null : d;
// };

// /* ================== tiny SVG sparkline ================== */
// const Sparkline = ({ values = [], width = 520, height = 140 }) => {
//   if (!values.length)
//     return <div className="cashrep-anal__sparkline-empty">Нет данных</div>;
//   const pad = 8;
//   const W = width - pad * 2;
//   const H = height - pad * 2;
//   const min = Math.min(...values);
//   const max = Math.max(...values);
//   const pts = values.map((v, i) => {
//     const x = pad + (i * W) / Math.max(1, values.length - 1);
//     const ratio = max === min ? 0.5 : (v - min) / (max - min);
//     const y = pad + (1 - ratio) * H;
//     return [x, y];
//   });
//   const d = pts
//     .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
//     .join(" ");
//   return (
//     <svg
//       className="cashrep-anal__sparkline"
//       viewBox={`0 0 ${width} ${height}`}
//       role="img"
//     >
//       <polyline
//         fill="none"
//         stroke="var(--border)"
//         strokeWidth="1"
//         points={`${pad},${height - pad} ${width - pad},${height - pad}`}
//       />
//       <path d={d} fill="none" stroke="var(--text)" strokeWidth="2" />
//       {pts.map(([x, y], i) => (
//         <circle key={i} cx={x} cy={y} r="2.2" fill="var(--text)" />
//       ))}
//     </svg>
//   );
// };

// /* =========================================================
//    TAB 1: Барбершоп отчёты (appointments)
//    ========================================================= */
// const BarberCashReport = () => {
//   const dateISO = (iso) => (iso ? toISODate(new Date(iso)) : "");
//   const fmtMoney = (n) =>
//     new Intl.NumberFormat("ru-RU", {
//       minimumFractionDigits: 0,
//       maximumFractionDigits: 0,
//     }).format(Number(n) || 0);
//   const clientName = (c) =>
//     c?.client_name || c?.full_name || c?.fullName || c?.name || c?.email || "—";
//   const employeeFIO = (e) =>
//     [e?.last_name, e?.first_name].filter(Boolean).join(" ").trim() ||
//     e?.full_name ||
//     e?.name ||
//     e?.email ||
//     "—";
//   const serviceName = (s) => s?.service_name || s?.name || "—";
//   const pickAmount = (appt, serviceObj) => {
//     const cand =
//       appt?.total_amount ??
//       appt?.total ??
//       appt?.price ??
//       appt?.service_price ??
//       serviceObj?.price ??
//       0;
//     const n = Number(cand);
//     return Number.isFinite(n) ? n : 0;
//   };
//   const fetchAll = async (url) => {
//     const acc = [];
//     let next = url;
//     while (next) {
//       const { data } = await api.get(next);
//       const chunk = data?.results ?? data ?? [];
//       acc.push(...chunk);
//       next = data?.next || null;
//     }
//     return acc;
//   };
//   const STATUS_LABELS = {
//     booked: "Забронировано",
//     confirmed: "Подтверждено",
//     completed: "Завершено",
//     canceled: "Отменено",
//     no_show: "Не пришёл",
//   };

//   const [appointments, setAppointments] = useState([]);
//   const [clients, setClients] = useState([]);
//   const [employees, setEmployees] = useState([]);
//   const [services, setServices] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   const [dateFrom, setDateFrom] = useState("");
//   const [dateTo, setDateTo] = useState("");
//   const [serviceId, setServiceId] = useState("");
//   const [masterId, setMasterId] = useState("");
//   const [status, setStatus] = useState("completed");

//   useEffect(() => {
//     (async () => {
//       try {
//         setLoading(true);
//         setError("");
//         const [a, c, e, s] = await Promise.all([
//           fetchAll("/barbershop/appointments/"),
//           fetchAll("/barbershop/clients/"),
//           fetchAll("/users/employees/"),
//           fetchAll("/barbershop/services/"),
//         ]);
//         setAppointments(a || []);
//         setClients(c || []);
//         setEmployees(e || []);
//         setServices(s || []);
//         const now = new Date();
//         const start = new Date(now.getFullYear(), now.getMonth(), 1);
//         const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
//         setDateFrom(toISODate(start));
//         setDateTo(toISODate(end));
//       } catch (e) {
//         setError(
//           e?.response?.data?.detail ||
//             "Не удалось загрузить данные кассы (записи/клиенты/сотрудники/услуги)"
//         );
//       } finally {
//         setLoading(false);
//       }
//     })();
//   }, []);

//   const clientMap = useMemo(() => {
//     const m = new Map();
//     clients.forEach((c) => m.set(String(c.id), c));
//     return m;
//   }, [clients]);
//   const employeeMap = useMemo(() => {
//     const m = new Map();
//     employees.forEach((u) => m.set(String(u.id), u));
//     return m;
//   }, [employees]);
//   const serviceMap = useMemo(() => {
//     const m = new Map();
//     services.forEach((s) => m.set(String(s.id), s));
//     return m;
//   }, [services]);

//   const rows = useMemo(() => {
//     return (appointments || []).map((a) => {
//       const sid = String(a?.service ?? "");
//       const mid = String(a?.barber ?? "");
//       const cid = String(a?.client ?? "");
//       const srv = serviceMap.get(sid);
//       const amount = pickAmount(a, srv);
//       const date = dateISO(a?.start_at || a?.end_at);
//       return {
//         id: a?.id ?? `${sid}-${mid}-${cid}-${a?.start_at || ""}`,
//         date,
//         serviceId: sid,
//         masterId: mid,
//         clientId: cid,
//         amount,
//         status: a?.status || "",
//       };
//     });
//   }, [appointments, serviceMap]);

//   const servicesSorted = useMemo(
//     () =>
//       [...services].sort((a, b) =>
//         (serviceName(a) || "").localeCompare(serviceName(b) || "", "ru")
//       ),
//     [services]
//   );
//   const employeesSorted = useMemo(
//     () =>
//       [...employees].sort((a, b) =>
//         (employeeFIO(a) || "").localeCompare(employeeFIO(b) || "", "ru")
//       ),
//     [employees]
//   );

//   const masterOptions = useMemo(() => {
//     const idsInData = new Set(rows.map((r) => r.masterId).filter(Boolean));
//     const list = employeesSorted.filter((u) => idsInData.has(String(u.id)));
//     return list.length ? list : employeesSorted;
//   }, [employeesSorted, rows]);

//   const [fromSafe, toSafe] = useMemo(() => {
//     let f = dateFrom;
//     let t = dateTo;
//     if (f && t && f > t) [f, t] = [t, f];
//     return [f, t];
//   }, [dateFrom, dateTo]);

//   const filtered = useMemo(() => {
//     return rows.filter((t) => {
//       const byStatus = status ? t.status === status : true;
//       const inFrom = !fromSafe || t.date >= fromSafe;
//       const inTo = !toSafe || t.date <= toSafe;
//       const byService = !serviceId || t.serviceId === serviceId;
//       const byMaster = !masterId || t.masterId === masterId;
//       return byStatus && inFrom && inTo && byService && byMaster;
//     });
//   }, [rows, fromSafe, toSafe, serviceId, masterId, status]);

//   const total = useMemo(
//     () => filtered.reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
//     [filtered]
//   );
//   const count = filtered.length;
//   const uniqueClients = useMemo(
//     () => new Set(filtered.map((t) => t.clientId)).size,
//     [filtered]
//   );
//   const avg = count ? Math.round(total / count) : 0;

//   const groupSum = (items, keyFn) =>
//     items.reduce((acc, item) => {
//       const k = keyFn(item) || "—";
//       acc[k] = (acc[k] || 0) + (Number(item.amount) || 0);
//       return acc;
//     }, {});
//   const byDate = useMemo(() => {
//     const g = groupSum(filtered, (t) => t.date);
//     return Object.fromEntries(
//       Object.entries(g).sort(([d1], [d2]) => (d1 > d2 ? 1 : d1 < d2 ? -1 : 0))
//     );
//   }, [filtered]);
//   const byService = useMemo(() => {
//     const g = groupSum(filtered, (t) => {
//       const srv = serviceMap.get(t.serviceId);
//       return srv?.service_name || srv?.name || "—";
//     });
//     return Object.fromEntries(Object.entries(g).sort(([, a], [, b]) => b - a));
//   }, [filtered, serviceMap]);
//   const byMaster = useMemo(() => {
//     const g = groupSum(filtered, (t) =>
//       employeeFIO(employeeMap.get(t.masterId))
//     );
//     return Object.fromEntries(Object.entries(g).sort(([, a], [, b]) => b - a));
//   }, [filtered, employeeMap]);

//   const exportCSV = () => {
//     const head = ["Дата", "Клиент", "Мастер", "Услуга", "Сумма", "Статус"];
//     const dataRows = filtered.map((t) => [
//       t.date,
//       clientName(clientMap.get(t.clientId)),
//       employeeFIO(employeeMap.get(t.masterId)),
//       serviceMap.get(t.serviceId)?.service_name ||
//         serviceMap.get(t.serviceId)?.name ||
//         "—",
//       String(t.amount ?? 0),
//       STATUS_LABELS[t.status] || t.status || "",
//     ]);
//     const csv = [head, ...dataRows]
//       .map((r) =>
//         r
//           .map((cell) => {
//             const v = String(cell ?? "");
//             return /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
//           })
//           .join(";")
//       )
//       .join("\n");
//     const blob = new Blob(["\uFEFF" + csv], {
//       type: "text/csv;charset=utf-8;",
//     });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     a.download = `cash_${fromSafe || "all"}_${toSafe || "all"}${
//       status ? "_" + status : ""
//     }.csv`;
//     a.click();
//     URL.revokeObjectURL(url);
//   };

//   const setPreset = (preset) => {
//     const now = new Date();
//     if (preset === "today") {
//       const d = toISODate(now);
//       setDateFrom(d);
//       setDateTo(d);
//     } else if (preset === "week") {
//       const day = now.getDay() || 7;
//       const monday = new Date(now);
//       monday.setDate(now.getDate() - (day - 1));
//       const sunday = new Date(monday);
//       sunday.setDate(monday.getDate() + 6);
//       setDateFrom(toISODate(monday));
//       setDateTo(toISODate(sunday));
//     } else if (preset === "month") {
//       const start = new Date(now.getFullYear(), now.getMonth(), 1);
//       const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
//       setDateFrom(toISODate(start));
//       setDateTo(toISODate(end));
//     }
//   };

//   return (
//     <div className="cashrep-barber">
//       <div className="cashrep-barber__header">
//         <h2 className="cashrep-barber__title">Касса · Барбершоп</h2>
//         <button
//           className="cashrep-barber__btn cashrep-barber__btn--primary"
//           onClick={exportCSV}
//           disabled={loading || filtered.length === 0}
//           aria-label="Экспорт в CSV"
//           title="Экспортировать CSV"
//         >
//           <FaFileCsv /> Экспорт CSV
//         </button>
//       </div>

//       <div className="cashrep-barber__filters">
//         <div className="cashrep-barber__filter-row">
//           <div className="cashrep-barber__field">
//             <label className="cashrep-barber__label">Дата от</label>
//             <input
//               type="date"
//               className="cashrep-barber__input"
//               value={dateFrom}
//               onChange={(e) => setDateFrom(e.target.value)}
//             />
//           </div>
//           <div className="cashrep-barber__field">
//             <label className="cashrep-barber__label">Дата до</label>
//             <input
//               type="date"
//               className="cashrep-barber__input"
//               value={dateTo}
//               onChange={(e) => setDateTo(e.target.value)}
//             />
//           </div>
//           <div className="cashrep-barber__field">
//             <label className="cashrep-barber__label">Услуга</label>
//             <select
//               className="cashrep-barber__input"
//               value={serviceId}
//               onChange={(e) => setServiceId(e.target.value)}
//             >
//               <option value="">Все</option>
//               {servicesSorted.map((s) => (
//                 <option key={s.id} value={String(s.id)}>
//                   {serviceName(s)}
//                 </option>
//               ))}
//             </select>
//           </div>
//           <div className="cashrep-barber__field">
//             <label className="cashrep-barber__label">Мастер</label>
//             <select
//               className="cashrep-barber__input"
//               value={masterId}
//               onChange={(e) => setMasterId(e.target.value)}
//             >
//               <option value="">Все</option>
//               {masterOptions.map((u) => (
//                 <option key={u.id} value={String(u.id)}>
//                   {employeeFIO(u)}
//                 </option>
//               ))}
//             </select>
//           </div>
//           <div className="cashrep-barber__field">
//             <label className="cashrep-barber__label">Статус</label>
//             <select
//               className="cashrep-barber__input"
//               value={status}
//               onChange={(e) => setStatus(e.target.value)}
//               title="Фильтр по статусу записи"
//             >
//               <option value="">Все</option>
//               <option value="booked">Забронировано</option>
//               <option value="confirmed">Подтверждено</option>
//               <option value="completed">Завершено</option>
//               <option value="canceled">Отменено</option>
//               <option value="no_show">Не пришёл</option>
//             </select>
//           </div>
//         </div>

//         <div className="cashrep-barber__presets">
//           <button
//             className="cashrep-barber__chip"
//             onClick={() => setPreset("today")}
//           >
//             Сегодня
//           </button>
//           <button
//             className="cashrep-barber__chip"
//             onClick={() => setPreset("week")}
//           >
//             Неделя
//           </button>
//           <button
//             className="cashrep-barber__chip"
//             onClick={() => setPreset("month")}
//           >
//             Месяц
//           </button>
//           <button
//             className="cashrep-barber__chip"
//             onClick={() => {
//               setServiceId("");
//               setMasterId("");
//               setStatus("completed");
//             }}
//             title="Сбросить фильтры"
//           >
//             Сброс фильтров
//           </button>
//         </div>
//       </div>

//       {error && <div className="cashrep-barber__alert">{error}</div>}

//       <div className="cashrep-barber__summary">
//         <div className="cashrep-barber__card">
//           <span className="cashrep-barber__card-label">Выручка</span>
//           <span className="cashrep-barber__card-value">
//             {fmtMoney(total)} сом
//           </span>
//         </div>
//         <div className="cashrep-barber__card">
//           <span className="cashrep-barber__card-label">Транзакций</span>
//           <span className="cashrep-barber__card-value">{count}</span>
//         </div>
//         <div className="cashrep-barber__card">
//           <span className="cashrep-barber__card-label">Средний чек</span>
//           <span className="cashrep-barber__card-value">
//             {fmtMoney(avg)} сом
//           </span>
//         </div>
//         <div className="cashrep-barber__card">
//           <span className="cashrep-barber__card-label">
//             Уникальных клиентов
//           </span>
//           <span className="cashrep-barber__card-value">{uniqueClients}</span>
//         </div>
//       </div>

//       <div className="cashrep-barber__table-wrap">
//         <table className="cashrep-barber__table">
//           <thead>
//             <tr>
//               <th>Дата</th>
//               <th>Клиент</th>
//               <th>Мастер</th>
//               <th>Услуга</th>
//               <th className="cashrep-barber__table-amount">Сумма</th>
//             </tr>
//           </thead>
//           <tbody>
//             {loading ? (
//               <tr>
//                 <td className="cashrep-barber__loading" colSpan="5">
//                   Загрузка...
//                 </td>
//               </tr>
//             ) : filtered.length === 0 ? (
//               <tr>
//                 <td className="cashrep-barber__loading" colSpan="5">
//                   Нет данных
//                 </td>
//               </tr>
//             ) : (
//               filtered.map((t) => (
//                 <tr key={t.id}>
//                   <td>{t.date || "—"}</td>
//                   <td>{clientName(clientMap.get(t.clientId))}</td>
//                   <td>{employeeFIO(employeeMap.get(t.masterId))}</td>
//                   <td>
//                     {serviceMap.get(t.serviceId)?.service_name ||
//                       serviceMap.get(t.serviceId)?.name ||
//                       "—"}
//                   </td>
//                   <td className="cashrep-barber__table-amount">
//                     {fmtMoney(t.amount)} сом
//                   </td>
//                 </tr>
//               ))
//             )}
//           </tbody>
//         </table>
//       </div>

//       <div className="cashrep-barber__reports">
//         <div className="cashrep-barber__report">
//           <h3 className="cashrep-barber__h3">По дням</h3>
//           <ul className="cashrep-barber__list">
//             {Object.entries(byDate).map(([date, amount]) => (
//               <li key={date || "none"} className="cashrep-barber__list-item">
//                 <span>{date || "—"}</span>
//                 <span className="cashrep-barber__list-amount">
//                   {fmtMoney(amount)} сом
//                 </span>
//               </li>
//             ))}
//           </ul>
//         </div>

//         <div className="cashrep-barber__report">
//           <h3 className="cashrep-barber__h3">По услугам</h3>
//           <ul className="cashrep-barber__list">
//             {Object.entries(byService).map(([service, amount]) => (
//               <li key={service || "none"} className="cashrep-barber__list-item">
//                 <span>{service || "—"}</span>
//                 <span className="cashrep-barber__list-amount">
//                   {fmtMoney(amount)} сом
//                 </span>
//               </li>
//             ))}
//           </ul>
//         </div>

//         <div className="cashrep-barber__report">
//           <h3 className="cashrep-barber__h3">По мастерам</h3>
//           <ul className="cashrep-barber__list">
//             {Object.entries(byMaster).map(([master, amount]) => (
//               <li key={master || "none"} className="cashrep-barber__list-item">
//                 <span>{master || "—"}</span>
//                 <span className="cashrep-barber__list-amount">
//                   {fmtMoney(amount)} сом
//                 </span>
//               </li>
//             ))}
//           </ul>
//         </div>
//       </div>
//     </div>
//   );
// };

// /* =========================================================
//    TAB 2: Кассы (список / детали) — без оплаты
//    ========================================================= */
// const CashboxTab = () => {
//   const [view, setView] = useState("list"); // list | detail
//   const [detailId, setDetailId] = useState(null);

//   /* ---------- LIST ---------- */
//   const CashboxListInline = ({ onOpen }) => {
//     const [rows, setRows] = useState([]);
//     const [q, setQ] = useState("");
//     const [loading, setLoading] = useState(true);
//     const [err, setErr] = useState("");
//     const [createOpen, setCreateOpen] = useState(false);
//     const [name, setName] = useState("");

//     const money = (v) =>
//       (Number(v) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 0 }) +
//       " c";

//     const load = async () => {
//       try {
//         setErr("");
//         setLoading(true);
//         const { data } = await api.get("/construction/cashboxes/");
//         setRows(asArray(data));
//       } catch {
//         setErr("Не удалось загрузить кассы");
//       } finally {
//         setLoading(false);
//       }
//     };

//     useEffect(() => {
//       load();
//     }, []);

//     const filtered = useMemo(() => {
//       const t = q.trim().toLowerCase();
//       if (!t) return rows;
//       return rows.filter((r) =>
//         [r.department_name, r.name].some((x) =>
//           String(x || "").toLowerCase().includes(t)
//         )
//       );
//     }, [rows, q]);

//     const onCreate = async () => {
//       const title = (name || "").trim();
//       if (!title) return alert("Введите название кассы");
//       try {
//         await api.post("/construction/cashboxes/", { name: title });
//         setCreateOpen(false);
//         setName("");
//         load();
//       } catch {
//         alert("Не удалось создать кассу");
//       }
//     };

//     return (
//       <div className="cashrep-cbox">
//         <div className="cashrep-cbox__toolbar">
//           <div className="cashrep-cbox__toolbar-side">
//             <span className="cashrep-cbox__total">Всего: {filtered.length}</span>
//           </div>
//           <div className="cashrep-cbox__controls">
//             <input
//               className="cashrep-cbox__search"
//               type="text"
//               placeholder="Поиск…"
//               value={q}
//               onChange={(e) => setQ(e.target.value)}
//             />
//             <button
//               className="cashrep-cbox__btn"
//               onClick={() => setCreateOpen(true)}
//             >
//               Создать кассу
//             </button>
//           </div>
//         </div>

//         {err && <div className="cashrep-cbox__error">{err}</div>}

//         <div className="cashrep-cbox__table-wrap">
//           <table className="cashrep-cbox__table">
//             <thead>
//               <tr>
//                 <th>#</th>
//                 <th>Название</th>
//                 <th>Приход</th>
//                 <th>Расход</th>
//                 <th>Действия</th>
//               </tr>
//             </thead>
//             <tbody>
//               {loading ? (
//                 <tr>
//                   <td colSpan={5}>Загрузка…</td>
//                 </tr>
//               ) : filtered.length ? (
//                 filtered.map((r, i) => (
//                   <tr
//                     key={r.id}
//                     className="cashrep-cbox__row"
//                     onClick={() => onOpen(r.id)}
//                   >
//                     <td>{i + 1}</td>
//                     <td>
//                       <b>{r.department_name || r.name || "—"}</b>
//                     </td>
//                     <td>{money(r.analytics?.income?.total || 0)}</td>
//                     <td>{money(r.analytics?.expense?.total || 0)}</td>
//                     <td>
//                       <button
//                         className="cashrep-cbox__btn"
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           onOpen(r.id);
//                         }}
//                       >
//                         Открыть
//                       </button>
//                     </td>
//                   </tr>
//                 ))
//               ) : (
//                 <tr>
//                   <td colSpan={5} className="cashrep-cbox__muted">
//                     Нет данных
//                   </td>
//                 </tr>
//               )}
//             </tbody>
//           </table>
//         </div>

//         {createOpen && (
//           <div className="cashrep-cbox-modal">
//             <div
//               className="cashrep-cbox-modal__overlay"
//               onClick={() => setCreateOpen(false)}
//             />
//             <div
//               className="cashrep-cbox-modal__content"
//               onClick={(e) => e.stopPropagation()}
//             >
//               <div className="cashrep-cbox-modal__header">
//                 <h3 className="cashrep-cbox-modal__title">Создать кассу</h3>
//                 <button
//                   className="cashrep-cbox-modal__close"
//                   onClick={() => setCreateOpen(false)}
//                 >
//                   ×
//                 </button>
//               </div>
//               <div className="cashrep-cbox-modal__section">
//                 <label className="cashrep-cbox-modal__label">
//                   Название кассы *
//                 </label>
//                 <input
//                   className="cashrep-cbox-modal__input"
//                   type="text"
//                   placeholder="Например: касса №1"
//                   value={name}
//                   onChange={(e) => setName(e.target.value)}
//                   required
//                 />
//               </div>
//               <div className="cashrep-cbox-modal__footer">
//                 <button className="cashrep-cbox__btn" onClick={onCreate}>
//                   Сохранить
//                 </button>
//               </div>
//             </div>
//           </div>
//         )}
//       </div>
//     );
//   };

//   /* ---------- DETAIL ---------- */
//   const CashboxDetailInline = ({ id, onBack }) => {
//     const [box, setBox] = useState(null);
//     const [ops, setOps] = useState([]);
//     const [tab, setTab] = useState("all");
//     const [loading, setLoading] = useState(true);
//     const [err, setErr] = useState("");

//     const when = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");
//     const money = (v) =>
//       (Number(v) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 0 }) +
//       " c";

//     const fromAny = (res) => {
//       const d = res?.data ?? res ?? [];
//       if (Array.isArray(d?.results)) return d.results;
//       if (Array.isArray(d)) return d;
//       return [];
//     };

//     const load = async () => {
//       setErr("");
//       setLoading(true);
//       try {
//         let detail = null;
//         try {
//           detail = (
//             await api.get(`/construction/cashboxes/${id}/detail/owner/`)
//           ).data;
//         } catch {}
//         if (!detail) {
//           try {
//             detail = (await api.get(`/construction/cashboxes/${id}/detail/`))
//               .data;
//           } catch {}
//         }
//         if (!detail) {
//           detail = (await api.get(`/construction/cashboxes/${id}/`)).data;
//         }
//         setBox(detail);

//         let flows =
//           fromAny({ data: detail?.operations }) ||
//           fromAny({ data: detail?.flows }) ||
//           fromAny({ data: detail?.transactions });

//         if (!flows.length) {
//           try {
//             const r1 = await api.get(`/construction/cashflows/`, {
//               params: { cashbox: id },
//             });
//             flows = fromAny(r1);
//           } catch {}
//         }
//         if (!flows.length && detail?.uuid) {
//           try {
//             const r2 = await api.get(`/construction/cashflows/`, {
//               params: { cashbox: detail.uuid },
//             });
//             flows = fromAny(r2);
//           } catch {}
//         }

//         const mapped = (flows || []).map((x, i) => {
//           const amt = Number(x.amount ?? x.sum ?? x.value ?? x.total ?? 0) || 0;
//           let type = String(
//             x.type ?? x.kind ?? x.direction ?? ""
//           ).toLowerCase();
//           if (type !== "income" && type !== "expense")
//             type = amt >= 0 ? "income" : "expense";
//           return {
//             id: x.id || x.uuid || `${i}`,
//             type,
//             title:
//               x.title ||
//               x.name ||
//               x.description ||
//               x.note ||
//               (type === "income" ? "Приход" : "Расход"),
//             amount: Math.abs(amt),
//             created_at:
//               x.created_at ||
//               x.created ||
//               x.date ||
//               x.timestamp ||
//               x.createdAt ||
//               null,
//           };
//         });

//         setOps(mapped);
//       } catch {
//         setErr("Не удалось загрузить детали кассы");
//       } finally {
//         setLoading(false);
//       }
//     };

//     useEffect(() => {
//       if (id) load();
//     }, [id]);

//     const shown = useMemo(() => {
//       if (tab === "income") return ops.filter((o) => o.type === "income");
//       if (tab === "expense") return ops.filter((o) => o.type === "expense");
//       return ops;
//     }, [ops, tab]);

//     return (
//       <div className="cashrep-cbox">
//         <div className="cashrep-cbox__header">
//           <div className="cashrep-cbox__tabs">
//             <button className="cashrep-cbox__tab" onClick={onBack}>
//               ← Назад
//             </button>
//             <span className="cashrep-cbox__tab is-active">
//               {box?.department_name || box?.name || "Касса"}
//             </span>
//           </div>
//         </div>

//         <div className="cashrep-cbox__seg">
//           <button
//             className={`cashrep-cbox__seg-btn ${
//               tab === "expense" ? "is-active" : ""
//             }`}
//             onClick={() => setTab("expense")}
//           >
//             Расход
//           </button>
//           <button
//             className={`cashrep-cbox__seg-btn ${
//               tab === "income" ? "is-active" : ""
//             }`}
//             onClick={() => setTab("income")}
//           >
//             Приход
//           </button>
//           <button
//             className={`cashrep-cbox__seg-btn ${
//               tab === "all" ? "is-active" : ""
//             }`}
//             onClick={() => setTab("all")}
//           >
//             Все
//           </button>
//           <div className="cashrep-cbox__seg-grow" />
//         </div>

//         <div className="cashrep-cbox__table-wrap">
//           <table className="cashrep-cbox__table">
//             <thead>
//               <tr>
//                 <th>Тип</th>
//                 <th>Наименование</th>
//                 <th>Сумма</th>
//                 <th>Дата</th>
//               </tr>
//             </thead>
//             <tbody>
//               {loading ? (
//                 <tr>
//                   <td colSpan={4}>Загрузка…</td>
//                 </tr>
//               ) : err ? (
//                 <tr>
//                   <td colSpan={4} className="cashrep-cbox__error">
//                     {err}
//                   </td>
//                 </tr>
//               ) : shown.length ? (
//                 shown.map((o) => (
//                   <tr key={o.id}>
//                     <td>{o.type === "income" ? "Приход" : "Расход"}</td>
//                     <td>{o.title}</td>
//                     <td>{money(o.amount)}</td>
//                     <td>{when(o.created_at)}</td>
//                   </tr>
//                 ))
//               ) : (
//                 <tr>
//                   <td colSpan={4} className="cashrep-cbox__muted">
//                     Нет операций
//                   </td>
//                 </tr>
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     );
//   };

//   return (
//     <div className="cashrep-cbox">
//       {view === "list" && (
//         <CashboxListInline
//           onOpen={(id) => {
//             setDetailId(id);
//             setView("detail");
//           }}
//         />
//       )}
//       {view === "detail" && (
//         <CashboxDetailInline id={detailId} onBack={() => setView("list")} />
//       )}
//     </div>
//   );
// };

// /* =========================================================
//    TAB 3: АНАЛИТИКА — 4 саб-вкладки (Продажи/Склад/Бренды/Категории/Касса)
//    ========================================================= */
// const AnalyticsTab = () => {
//   const dispatch = useDispatch();

//   /* ---- из saleSlice ---- */
//   const { history = [], loading: salesLoading, error: salesError } = useSale();

//   /* ---- из productSlice ---- */
//   const {
//     list: products = [],
//     brands = [],
//     categories = [],
//     loading: productsLoading,
//   } = useSelector((s) => s.product || {});

//   /* ---- UI: саб-вкладки ---- */
//   const [activeTab, setActiveTab] = useState("sales"); // sales | inventory | taxonomy | cashbox

//   /* ---- общие контролы дат/гранулярности ---- */
//   const [startDate, setStartDate] = useState(() => {
//     const n = new Date();
//     return `${n.getFullYear()}-01-01`;
//   });
//   const [endDate, setEndDate] = useState(() =>
//     new Date().toISOString().slice(0, 10)
//   );
//   const [granularity, setGranularity] = useState("month"); // day | month | year

//   const lan =
//     (typeof localStorage !== "undefined" &&
//       localStorage.getItem("i18nextLng")) ||
//     "ru";
//   const nfMoney = useMemo(() => {
//     try {
//       return new Intl.NumberFormat(lan === "en" ? "en-US" : "ru-RU", {
//         style: "currency",
//         currency: "KGS",
//         maximumFractionDigits: 0,
//       });
//     } catch {
//       return { format: (n) => `${Number(n).toLocaleString("ru-RU")} сом` };
//     }
//   }, [lan]);
//   const nfInt = useMemo(
//     () => new Intl.NumberFormat(lan === "en" ? "en-US" : "ru-RU"),
//     [lan]
//   );

//   const parseISO2 = (s) => {
//     const d = new Date(s);
//     return isNaN(d.getTime()) ? null : d;
//   };
//   const keyByGranularity = (date, g) => {
//     const y = date.getFullYear();
//     const m = String(date.getMonth() + 1).padStart(2, "0");
//     const d = String(date.getDate()).padStart(2, "0");
//     if (g === "day") return `${y}-${m}-${d}`;
//     if (g === "year") return `${y}`;
//     return `${y}-${m}`;
//   };
//   const inRange = (d) => {
//     const sd = parseISO2(startDate);
//     const ed = parseISO2(endDate);
//     if (!d || !sd || !ed) return false;
//     const from = new Date(
//       sd.getFullYear(),
//       sd.getMonth(),
//       sd.getDate(),
//       0,
//       0,
//       0
//     );
//     const to = new Date(
//       ed.getFullYear(),
//       ed.getMonth(),
//       ed.getDate(),
//       23,
//       59,
//       59
//     );
//     return d >= from && d <= to;
//   };
//   const quickPreset = (preset) => {
//     const now = new Date();
//     if (preset === "thisMonth") {
//       const sd = new Date(now.getFullYear(), now.getMonth(), 1);
//       const ed = new Date(now.getFullYear(), now.getMonth() + 1, 0);
//       setStartDate(sd.toISOString().slice(0, 10));
//       setEndDate(ed.toISOString().slice(0, 10));
//       setGranularity("day");
//     }
//     if (preset === "lastMonth") {
//       const sd = new Date(now.getFullYear(), now.getMonth() - 1, 1);
//       const ed = new Date(now.getFullYear(), now.getMonth(), 0);
//       setStartDate(sd.toISOString().slice(0, 10));
//       setEndDate(ed.toISOString().slice(0, 10));
//       setGranularity("day");
//     }
//     if (preset === "ytd") {
//       const sd = new Date(now.getFullYear(), 0, 1);
//       setStartDate(sd.toISOString().slice(0, 10));
//       setEndDate(now.toISOString().slice(0, 10));
//       setGranularity("month");
//     }
//     if (preset === "thisYear") {
//       const sd = new Date(now.getFullYear(), 0, 1);
//       const ed = new Date(now.getFullYear(), 11, 31);
//       setStartDate(sd.toISOString().slice(0, 10));
//       setEndDate(ed.toISOString().slice(0, 10));
//       setGranularity("month");
//     }
//   };

//   /* ---- загрузка данных (продажи + товары/бренды/категории) ---- */
//   useEffect(() => {
//     dispatch(historySellProduct({ search: "" }));
//     dispatch(fetchProductsAsync({ page: 1, page_size: 1000 }));
//     dispatch(fetchBrandsAsync());
//     dispatch(fetchCategoriesAsync());
//   }, [dispatch]);

//   /* ====================== SALES ====================== */
//   const salesFiltered = useMemo(
//     () => (history || []).filter((r) => inRange(parseISO2(r?.created_at))),
//     [history, startDate, endDate]
//   );

//   const salesTotals = useMemo(() => {
//     const count = salesFiltered.length;
//     const revenue = salesFiltered.reduce((acc, r) => acc + num(r?.total), 0);
//     return { count, revenue, avg: count ? revenue / count : 0 };
//   }, [salesFiltered]);

//   const salesSeries = useMemo(() => {
//     const bucket = new Map();
//     for (const r of salesFiltered) {
//       const d = parseISO2(r?.created_at);
//       if (!d) continue;
//       const key = keyByGranularity(d, granularity);
//       bucket.set(key, num(bucket.get(key)) + num(r?.total));
//     }
//     const keys = sortKeysAsc(Array.from(bucket.keys()));
//     return {
//       labels: keys,
//       values: keys.map((k) => Math.round(num(bucket.get(k)))),
//     };
//   }, [salesFiltered, granularity]);

//   /* ====================== INVENTORY ====================== */
//   const LOW_STOCK_THRESHOLD = 5;

//   const inventoryKPIs = useMemo(() => {
//     const totalSkus = products.length;
//     const lowStock = products.filter(
//       (p) => num(p?.quantity) <= LOW_STOCK_THRESHOLD
//     ).length;

//     const stockValueByPrice = products.reduce(
//       (acc, p) => acc + num(p?.price) * num(p?.quantity),
//       0
//     );

//     const stockValueByCost = products.some((p) => "cost_price" in p)
//       ? products.reduce(
//           (acc, p) => acc + num(p?.cost_price) * num(p?.quantity),
//           0
//         )
//       : null;

//     return { totalSkus, lowStock, stockValueByPrice, stockValueByCost };
//   }, [products]);

//   const topCategories = useMemo(() => {
//     const m = new Map();
//     products.forEach((p) => {
//       const key = p?.category || p?.category_name || "Без категории";
//       m.set(key, num(m.get(key)) + 1);
//     });
//     return Array.from(m.entries())
//       .sort((a, b) => b[1] - a[1])
//       .slice(0, 10);
//   }, [products]);

//   const lowStockList = useMemo(
//     () =>
//       [...products]
//         .sort((a, b) => num(a?.quantity) - num(b?.quantity))
//         .slice(0, 10),
//     [products]
//   );

//   // ABC по стоимости запаса
//   const abcStats = useMemo(() => {
//     if (!products.length) return { A: 0, B: 0, C: 0, list: [] };
//     const items = products.map((p) => {
//       const value =
//         "cost_price" in p
//           ? num(p.cost_price) * num(p.quantity)
//           : num(p.price) * num(p.quantity);
//       return { id: p.id, name: p.name, value };
//     });
//     items.sort((a, b) => b.value - a.value);
//     const total = items.reduce((s, x) => s + x.value, 0) || 1;
//     let acc = 0;
//     let A = 0,
//       B = 0,
//       C = 0;
//     const tagged = items.map((it) => {
//       acc += it.value;
//       const share = acc / total;
//       let tag = "C";
//       if (share <= 0.8) tag = "A";
//       else if (share <= 0.95) tag = "B";
//       if (tag === "A") A += 1;
//       else if (tag === "B") B += 1;
//       else C += 1;
//       return { ...it, tag };
//     });
//     return { A, B, C, list: tagged.slice(0, 10) };
//   }, [products]);

//   /* ====================== TAXONOMY ====================== */
//   const brandStats = useMemo(() => {
//     const m = new Map();
//     products.forEach((p) => {
//       const key = p?.brand || p?.brand_name || "Без бренда";
//       m.set(key, num(m.get(key)) + 1);
//     });
//     const pairs = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
//     return { total: brands.length || pairs.length, top: pairs.slice(0, 10) };
//   }, [products, brands]);

//   const categoryStats = useMemo(() => {
//     const m = new Map();
//     products.forEach((p) => {
//       const key = p?.category || p?.category_name || "Без категории";
//       m.set(key, num(m.get(key)) + 1);
//     });
//     const pairs = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
//     return {
//       total: categories.length || pairs.length,
//       top: pairs.slice(0, 10),
//     };
//   }, [products, categories]);

//   /* ====================== CASHBOX (flows) ====================== */
//   const [boxes, setBoxes] = useState([]);
//   const [flows, setFlows] = useState([]);
//   const [boxId, setBoxId] = useState("all");
//   const [cashLoading, setCashLoading] = useState(false);
//   const [cashError, setCashError] = useState("");

//   // подгружаем кассы только при заходе на вкладку cashbox
//   useEffect(() => {
//     if (activeTab !== "cashbox" || boxes.length) return;
//     (async () => {
//       try {
//         const res = await api.get("/construction/cashboxes/", {
//           params: { page_size: 1000 },
//         });
//         setBoxes(listFrom(res));
//       } catch {
//         setBoxes([]);
//       }
//     })();
//   }, [activeTab, boxes.length]);

//   const loadFlows = async () => {
//     setCashError("");
//     setCashLoading(true);
//     try {
//       const params = { page_size: 1000 };
//       if (boxId !== "all") params.cashbox = boxId;
//       const r = await api.get("/construction/cashflows/", { params });
//       const raw = listFrom(r) || [];
//       const normalized = raw.map((x, i) => {
//         const amt = num(x.amount ?? x.sum ?? x.value ?? x.total ?? 0);
//         let type = String(x.type ?? x.kind ?? x.direction ?? "").toLowerCase();
//         if (type !== "income" && type !== "expense")
//           type = amt >= 0 ? "income" : "expense";
//         const cashboxId = x.cashbox?.id || x.cashbox || x.cashbox_uuid || null;
//         const cashboxName =
//           x.cashbox?.department_name ||
//           x.cashbox?.name ||
//           x.cashbox_name ||
//           null;
//         return {
//           id: x.id || x.uuid || `${i}`,
//           type,
//           amount: Math.abs(amt),
//           title:
//             x.title ||
//             x.name ||
//             x.description ||
//             x.note ||
//             (type === "income" ? "Приход" : "Расход"),
//           created_at:
//             x.created_at ||
//             x.created ||
//             x.date ||
//             x.timestamp ||
//             x.createdAt ||
//             null,
//           cashboxId,
//           cashboxName,
//         };
//       });
//       setFlows(normalized);
//     } catch {
//       setCashError("Не удалось загрузить операции кассы");
//       setFlows([]);
//     } finally {
//       setCashLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (activeTab !== "cashbox") return;
//     loadFlows();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [activeTab, boxId]);

//   const flowsFiltered = useMemo(() => {
//     return flows.filter((f) => {
//       const d = parseISO2(f.created_at);
//       return inRange(d);
//     });
//   }, [flows, startDate, endDate]);

//   const cashTotals = useMemo(() => {
//     let income = 0,
//       expense = 0;
//     for (const f of flowsFiltered) {
//       if (f.type === "income") income += f.amount;
//       else expense += f.amount;
//     }
//     return { income, expense, net: income - expense };
//   }, [flowsFiltered]);

//   const cashSeries = useMemo(() => {
//     const inc = new Map();
//     const exp = new Map();
//     for (const f of flowsFiltered) {
//       const d = parseISO2(f.created_at);
//       if (!d) continue;
//       const k = keyByGranularity(d, granularity);
//       if (f.type === "income") inc.set(k, num(inc.get(k)) + f.amount);
//       else exp.set(k, num(exp.get(k)) + f.amount);
//     }
//     const keys = sortKeysAsc(
//       Array.from(new Set([...inc.keys(), ...exp.keys()]))
//     );
//     const incomeVals = keys.map((k) => Math.round(num(inc.get(k))));
//     const expenseVals = keys.map((k) => Math.round(num(exp.get(k))));
//     const netVals = keys.map((_, i) =>
//       Math.round(num(incomeVals[i]) - num(expenseVals[i]))
//     );
//     return { labels: keys, incomeVals, expenseVals, netVals };
//   }, [flowsFiltered, granularity]);

//   const perBox = useMemo(() => {
//     const map = new Map();
//     for (const f of flowsFiltered) {
//       const id = f.cashboxId || "—";
//       const name =
//         f.cashboxName ||
//         boxes.find((b) => (b.id || b.uuid) === id)?.department_name ||
//         boxes.find((b) => (b.id || b.uuid) === id)?.name ||
//         "—";
//       const cur = map.get(id) || { name, income: 0, expense: 0 };
//       if (f.type === "income") cur.income += f.amount;
//       else cur.expense += f.amount;
//       map.set(id, cur);
//     }
//     const rows = Array.from(map.entries()).map(([id, v]) => ({
//       id,
//       name: v.name,
//       income: v.income,
//       expense: v.expense,
//       net: v.income - v.expense,
//     }));
//     rows.sort((a, b) => b.net - a.net);
//     return rows;
//   }, [flowsFiltered, boxes]);

//   const topExpenseByTitle = useMemo(() => {
//     const m = new Map();
//     for (const f of flowsFiltered) {
//       if (f.type !== "expense") continue;
//       const key = (f.title || "Расход").toString();
//       m.set(key, num(m.get(key)) + f.amount);
//     }
//     return Array.from(m.entries())
//       .sort((a, b) => b[1] - a[1])
//       .slice(0, 10);
//   }, [flowsFiltered]);

//   /* ---------- RENDER ---------- */
//   return (
//     <div className="cashrep-anal">
//       {/* саб-вкладки */}
//       <div className="cashrep-anal__tabs">
//         <button
//           className={`cashrep-anal__tab ${
//             activeTab === "sales" ? "is-active" : ""
//           }`}
//           onClick={() => setActiveTab("sales")}
//         >
//           Продажи
//         </button>
//         <button
//           className={`cashrep-anal__tab ${
//             activeTab === "inventory" ? "is-active" : ""
//           }`}
//           onClick={() => setActiveTab("inventory")}
//         >
//           Склад
//         </button>
//         <button
//           className={`cashrep-anal__tab ${
//             activeTab === "taxonomy" ? "is-active" : ""
//           }`}
//           onClick={() => setActiveTab("taxonomy")}
//         >
//           Бренды/Категории
//         </button>
//         <button
//           className={`cashrep-anal__tab ${
//             activeTab === "cashbox" ? "is-active" : ""
//           }`}
//           onClick={() => setActiveTab("cashbox")}
//         >
//           Касса
//         </button>
//       </div>

//       {/* ---- общие контролы для табов, где нужен период/гранулярность ---- */}
//       {(activeTab === "sales" || activeTab === "cashbox") && (
//         <div className="cashrep-anal__controls">
//           <div className="cashrep-anal__presets">
//             <button onClick={() => quickPreset("thisMonth")}>Этот месяц</button>
//             <button onClick={() => quickPreset("lastMonth")}>
//               Прошлый месяц
//             </button>
//             <button onClick={() => quickPreset("ytd")}>Год-к-дате</button>
//             <button onClick={() => quickPreset("thisYear")}>Весь год</button>
//           </div>
//           <div className="cashrep-anal__range">
//             <label className="cashrep-anal__label">
//               С
//               <input
//                 type="date"
//                 className="cashrep-anal__input"
//                 value={startDate}
//                 onChange={(e) => setStartDate(e.target.value)}
//               />
//             </label>
//             <label className="cashrep-anal__label">
//               До
//               <input
//                 type="date"
//                 className="cashrep-anal__input"
//                 value={endDate}
//                 onChange={(e) => setEndDate(e.target.value)}
//               />
//             </label>

//             <div className="cashrep-anal__seg">
//               <button
//                 className={granularity === "day" ? "is-active" : ""}
//                 onClick={() => setGranularity("day")}
//               >
//                 Дни
//               </button>
//               <button
//                 className={granularity === "month" ? "is-active" : ""}
//                 onClick={() => setGranularity("month")}
//               >
//                 Месяцы
//               </button>
//               <button
//                 className={granularity === "year" ? "is-active" : ""}
//                 onClick={() => setGranularity("year")}
//               >
//                 Годы
//               </button>
//             </div>

//             {activeTab === "cashbox" && (
//               <label className="cashrep-anal__label">
//                 Касса
//                 <select
//                   className="cashrep-anal__input"
//                   value={boxId}
//                   onChange={(e) => setBoxId(e.target.value)}
//                 >
//                   <option value="all">Все кассы</option>
//                   {boxes.map((b) => (
//                     <option key={b.id || b.uuid} value={b.id || b.uuid}>
//                       {b.department_name || b.name || b.id || b.uuid}
//                     </option>
//                   ))}
//                 </select>
//               </label>
//             )}
//           </div>
//         </div>
//       )}

//       {/* ---- SALES ---- */}
//       {activeTab === "sales" && (
//         <>
//           <div className="cashrep-anal__kpis">
//             <div className="cashrep-anal__kpi">
//               <div className="cashrep-anal__kpi-label">Число продаж</div>
//               <div className="cashrep-anal__kpi-value">
//                 {nfInt.format(salesTotals.count)}
//               </div>
//             </div>
//             <div className="cashrep-anal__kpi">
//               <div className="cashrep-anal__kpi-label">Выручка</div>
//               <div className="cashrep-anal__kpi-value">
//                 {nfMoney.format(salesTotals.revenue)}
//               </div>
//             </div>
//             <div className="cashrep-anal__kpi">
//               <div className="cashrep-anal__kpi-label">Средний чек</div>
//               <div className="cashrep-anal__kpi-value">
//                 {nfMoney.format(salesTotals.avg)}
//               </div>
//             </div>
//           </div>

//           <div className="cashrep-anal__card">
//             {salesLoading ? (
//               <div className="cashrep-anal__note">Загрузка истории продаж…</div>
//             ) : salesError ? (
//               <div className="cashrep-anal__error">
//                 Ошибка: {String(salesError)}
//               </div>
//             ) : (
//               <>
//                 <div className="cashrep-anal__card-title">
//                   Динамика выручки (
//                   {granularity === "day"
//                     ? "дни"
//                     : granularity === "month"
//                     ? "месяцы"
//                     : "годы"}
//                   )
//                 </div>
//                 <Sparkline values={salesSeries.values} />
//                 <div className="cashrep-anal__legend">
//                   {salesSeries.labels.map((l, i) => (
//                     <span className="cashrep-anal__legend-item" key={i}>
//                       {l}
//                     </span>
//                   ))}
//                 </div>
//               </>
//             )}
//           </div>

//           <div className="cashrep-anal__card">
//             <div className="cashrep-anal__card-title">Последние продажи</div>
//             {salesFiltered.length ? (
//               <div className="cashrep-anal__table-wrap">
//                 <table className="cashrep-anal__table">
//                   <thead>
//                     <tr>
//                       <th>#</th>
//                       <th>Пользователь</th>
//                       <th>Сумма</th>
//                       <th>Статус</th>
//                       <th>Дата</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {salesFiltered.slice(0, 10).map((r, i) => (
//                       <tr key={r?.id ?? i}>
//                         <td>{i + 1}</td>
//                         <td>{r?.user_display || "—"}</td>
//                         <td>{nfMoney.format(num(r?.total))}</td>
//                         <td>{r?.status || "—"}</td>
//                         <td>
//                           {r?.created_at
//                             ? new Date(r.created_at).toLocaleString()
//                             : "—"}
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             ) : (
//               <div className="cashrep-anal__note">
//                 Нет продаж в выбранном периоде.
//               </div>
//             )}
//           </div>
//         </>
//       )}

//       {/* ---- INVENTORY ---- */}
//       {activeTab === "inventory" && (
//         <>
//           <div className="cashrep-anal__kpis">
//             <div className="cashrep-anal__kpi">
//               <div className="cashrep-anal__kpi-label">Всего SKU</div>
//               <div className="cashrep-anal__kpi-value">
//                 {nfInt.format(products.length)}
//               </div>
//             </div>
//             <div className="cashrep-anal__kpi">
//               <div className="cashrep-anal__kpi-label">Стоимость склада</div>
//               <div className="cashrep-anal__kpi-value">
//                 {inventoryKPIs.stockValueByCost != null
//                   ? nfMoney.format(inventoryKPIs.stockValueByCost)
//                   : nfMoney.format(inventoryKPIs.stockValueByPrice)}
//               </div>
//             </div>
//             <div className="cashrep-anal__kpi">
//               <div className="cashrep-anal__kpi-label">Низкие остатки (≤5)</div>
//               <div className="cashrep-anal__kpi-value">
//                 {nfInt.format(inventoryKPIs.lowStock)}
//               </div>
//             </div>
//           </div>

//           <div className="cashrep-anal__grid">
//             <div className="cashrep-anal__card">
//               <div className="cashrep-anal__card-title">
//                 Топ-10 категорий по кол-ву SKU
//               </div>
//               <ul className="cashrep-anal__bars">
//                 {topCategories.length ? (
//                   topCategories.map(([name, count], i) => {
//                     const max = topCategories[0][1] || 1;
//                     const width = clamp(
//                       Math.round((count / max) * 100),
//                       5,
//                       100
//                     );
//                     return (
//                       <li className="cashrep-anal__bar" key={i}>
//                         <span className="cashrep-anal__bar-name" title={name}>
//                           {name}
//                         </span>
//                         <span className="cashrep-anal__bar-track">
//                           <span
//                             className="cashrep-anal__bar-fill"
//                             style={{ width: `${width}%` }}
//                           />
//                         </span>
//                         <span className="cashrep-anal__bar-value">
//                           {nfInt.format(count)}
//                         </span>
//                       </li>
//                     );
//                   })
//                 ) : (
//                   <li className="cashrep-anal__empty">Нет данных</li>
//                 )}
//               </ul>
//             </div>

//             <div className="cashrep-anal__card">
//               <div className="cashrep-anal__card-title">
//                 Топ-10 с минимальными остатками
//               </div>
//               <ul className="cashrep-anal__list">
//                 {lowStockList.length ? (
//                   lowStockList.map((p, i) => (
//                     <li className="cashrep-anal__row" key={p?.id ?? i}>
//                       <span
//                         className="cashrep-anal__row-name"
//                         title={p?.name || "—"}
//                       >
//                         {p?.name || "—"}
//                       </span>
//                       <span className="cashrep-anal__row-qty">
//                         Остаток: {nfInt.format(num(p?.quantity))}
//                       </span>
//                     </li>
//                   ))
//                 ) : (
//                   <li className="cashrep-anal__empty">Нет данных</li>
//                 )}
//               </ul>
//             </div>
//           </div>

//           <div className="cashrep-anal__card">
//             <div className="cashrep-anal__card-title">
//               ABC по стоимости запаса
//             </div>
//             <div className="cashrep-anal__abc">
//               <div className="cashrep-anal__abc-badge cashrep-anal__abc-badge--a">
//                 A: {nfInt.format(abcStats.A)}
//               </div>
//               <div className="cashrep-anal__abc-badge cashrep-anal__abc-badge--b">
//                 B: {nfInt.format(abcStats.B)}
//               </div>
//               <div className="cashrep-anal__abc-badge cashrep-anal__abc-badge--c">
//                 C: {nfInt.format(abcStats.C)}
//               </div>
//             </div>
//             <ul className="cashrep-anal__list">
//               {abcStats.list.length ? (
//                 abcStats.list.map((it, i) => (
//                   <li className="cashrep-anal__row" key={it.id ?? i}>
//                     <span className="cashrep-anal__row-name" title={it.name}>
//                       {it.name}
//                     </span>
//                     <span className="cashrep-anal__row-qty">
//                       {it.tag} · {nfMoney.format(it.value)}
//                     </span>
//                   </li>
//                 ))
//               ) : (
//                 <li className="cashrep-anal__empty">Нет данных</li>
//               )}
//             </ul>
//             <p className="cashrep-anal__note">
//               * Если есть <code>cost_price</code>, используем его. Иначе считаем
//               по <code>price</code>.
//             </p>
//           </div>
//         </>
//       )}

//       {/* ---- TAXONOMY ---- */}
//       {activeTab === "taxonomy" && (
//         <div className="cashrep-anal__grid">
//           <div className="cashrep-anal__card">
//             <div className="cashrep-anal__card-title">
//               Бренды{" "}
//               <span className="cashrep-anal__muted">
//                 (всего: {nfInt.format(brandStats.total)})
//               </span>
//             </div>
//             <ul className="cashrep-anal__bars">
//               {brandStats.top.length ? (
//                 brandStats.top.map(([name, count], i) => {
//                   const max = brandStats.top[0][1] || 1;
//                   const width = clamp(Math.round((count / max) * 100), 5, 100);
//                   return (
//                     <li className="cashrep-anal__bar" key={i}>
//                       <span className="cashrep-anal__bar-name" title={name}>
//                         {name}
//                       </span>
//                       <span className="cashrep-anal__bar-track">
//                         <span
//                           className="cashrep-anal__bar-fill"
//                           style={{ width: `${width}%` }}
//                         />
//                       </span>
//                       <span className="cashrep-anal__bar-value">
//                         {nfInt.format(count)}
//                       </span>
//                     </li>
//                   );
//                 })
//               ) : (
//                 <li className="cashrep-anal__empty">Нет данных</li>
//               )}
//             </ul>
//           </div>

//           <div className="cashrep-anal__card">
//             <div className="cashrep-anal__card-title">
//               Категории{" "}
//               <span className="cashrep-anal__muted">
//                 (всего: {nfInt.format(categoryStats.total)})
//               </span>
//             </div>
//             <ul className="cashrep-anal__bars">
//               {categoryStats.top.length ? (
//                 categoryStats.top.map(([name, count], i) => {
//                   const max = categoryStats.top[0][1] || 1;
//                   const width = clamp(Math.round((count / max) * 100), 5, 100);
//                   return (
//                     <li className="cashrep-anal__bar" key={i}>
//                       <span className="cashrep-anal__bar-name" title={name}>
//                         {name}
//                       </span>
//                       <span className="cashrep-anal__bar-track">
//                         <span
//                           className="cashrep-anal__bar-fill"
//                           style={{ width: `${width}%` }}
//                         />
//                       </span>
//                       <span className="cashrep-anal__bar-value">
//                         {nfInt.format(count)}
//                       </span>
//                     </li>
//                   );
//                 })
//               ) : (
//                 <li className="cashrep-anal__empty">Нет данных</li>
//               )}
//             </ul>
//           </div>
//         </div>
//       )}

//       {/* ---- CASHBOX ---- */}
//       {activeTab === "cashbox" && (
//         <>
//           <div className="cashrep-anal__kpis">
//             <div className="cashrep-anal__kpi">
//               <div className="cashrep-anal__kpi-label">Приход</div>
//               <div className="cashrep-anal__kpi-value">
//                 {nfMoney.format(cashTotals.income)}
//               </div>
//             </div>
//             <div className="cashrep-anal__kpi">
//               <div className="cashrep-anal__kpi-label">Расход</div>
//               <div className="cashrep-anal__kpi-value">
//                 {nfMoney.format(cashTotals.expense)}
//               </div>
//             </div>
//             <div className="cashrep-anal__kpi">
//               <div className="cashrep-anal__kpi-label">Сальдо</div>
//               <div className="cashrep-anal__kpi-value">
//                 {nfMoney.format(cashTotals.net)}
//               </div>
//             </div>
//           </div>

//           <div className="cashrep-anal__grid">
//             <div className="cashrep-anal__card">
//               <div className="cashrep-anal__card-title">
//                 Динамика чистого потока (
//                 {granularity === "day"
//                   ? "дни"
//                   : granularity === "month"
//                   ? "месяцы"
//                   : "годы"}
//                 )
//               </div>
//               {cashLoading ? (
//                 <div className="cashrep-anal__note">Загрузка операций…</div>
//               ) : cashError ? (
//                 <div className="cashrep-anal__error">{cashError}</div>
//               ) : (
//                 <>
//                   <Sparkline values={cashSeries.netVals} />
//                   <div className="cashrep-anal__legend">
//                     {cashSeries.labels.map((l, i) => (
//                       <span className="cashrep-anal__legend-item" key={i}>
//                         {l}
//                       </span>
//                     ))}
//                   </div>
//                 </>
//               )}
//             </div>

//             <div className="cashrep-anal__card">
//               <div className="cashrep-anal__card-title">Срез по кассам</div>
//               <div className="cashrep-anal__table-wrap">
//                 <table className="cashrep-anal__table">
//                   <thead>
//                     <tr>
//                       <th>Касса</th>
//                       <th>Приход</th>
//                       <th>Расход</th>
//                       <th>Сальдо</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {perBox.length ? (
//                       perBox.map((r) => (
//                         <tr key={r.id}>
//                           <td>{r.name}</td>
//                           <td>{nfMoney.format(r.income)}</td>
//                           <td>{nfMoney.format(r.expense)}</td>
//                           <td>{nfMoney.format(r.net)}</td>
//                         </tr>
//                       ))
//                     ) : (
//                       <tr>
//                         <td colSpan={4} className="cashrep-anal__empty">
//                           Нет данных
//                         </td>
//                       </tr>
//                     )}
//                   </tbody>
//                 </table>
//               </div>
//             </div>

//             <div className="cashrep-anal__card">
//               <div className="cashrep-anal__card-title">
//                 Топ-10 статей расхода
//               </div>
//               <ul className="cashrep-anal__bars">
//                 {topExpenseByTitle.length ? (
//                   topExpenseByTitle.map(([title, sum], i) => {
//                     const max = topExpenseByTitle[0][1] || 1;
//                     const width = clamp(Math.round((sum / max) * 100), 5, 100);
//                     return (
//                       <li className="cashrep-anal__bar" key={i}>
//                         <span className="cashrep-anal__bar-name" title={title}>
//                           {title}
//                         </span>
//                         <span className="cashrep-anal__bar-track">
//                           <span
//                             className="cashrep-anal__bar-fill"
//                             style={{ width: `${width}%` }}
//                           />
//                         </span>
//                         <span className="cashrep-anal__bar-value">
//                           {nfMoney.format(sum)}
//                         </span>
//                       </li>
//                     );
//                   })
//                 ) : (
//                   <li className="cashrep-anal__empty">Нет данных</li>
//                 )}
//               </ul>
//             </div>
//           </div>

//           <div className="cashrep-anal__card cashrep-anal__card--scroll">
//             <div className="cashrep-anal__card-title">Последние операции</div>
//             <div className="cashrep-anal__table-wrap">
//               <table className="cashrep-anal__table">
//                 <thead>
//                   <tr>
//                     <th>Тип</th>
//                     <th>Статья</th>
//                     <th>Сумма</th>
//                     <th>Касса</th>
//                     <th>Дата</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {cashLoading ? (
//                     <tr>
//                       <td colSpan={5}>Загрузка…</td>
//                     </tr>
//                   ) : flowsFiltered.length ? (
//                     flowsFiltered
//                       .slice()
//                       .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
//                       .slice(0, 50)
//                       .map((f, i) => (
//                         <tr key={f.id ?? i}>
//                           <td>{f.type === "income" ? "Приход" : "Расход"}</td>
//                           <td>{f.title}</td>
//                           <td>{nfMoney.format(f.amount)}</td>
//                           <td>{f.cashboxName || "—"}</td>
//                           <td>
//                             {f.created_at
//                               ? new Date(f.created_at).toLocaleString()
//                               : "—"}
//                           </td>
//                         </tr>
//                       ))
//                   ) : (
//                     <tr>
//                       <td colSpan={5} className="cashrep-anal__empty">
//                         Нет операций
//                       </td>
//                     </tr>
//                   )}
//                 </tbody>
//               </table>
//             </div>
//           </div>

//           {cashLoading && (
//             <div className="cashrep-anal__loading">Обновляем операции…</div>
//           )}
//         </>
//       )}

//       {(productsLoading || salesLoading) && activeTab !== "cashbox" && (
//         <div className="cashrep-anal__loading">Обновляем данные…</div>
//       )}
//     </div>
//   );
// };

// /* =========================================================
//    HOST: CashReports (верхние вкладки)
//    ========================================================= */
// const CashReports = () => {
//   const [tab, setTab] = useState("report"); // report | cashbox | analytics
//   return (
//     <div className="cashrep">
//       <div className="cashrep__switch">
//         <button
//           className={`cashrep__btn ${tab === "report" ? "is-active" : ""}`}
//           onClick={() => setTab("report")}
//         >
//           Отчёты-Записи
//         </button>
//         <button
//           className={`cashrep__btn ${tab === "cashbox" ? "is-active" : ""}`}
//           onClick={() => setTab("cashbox")}
//         >
//           Касса
//         </button>
//         <button
//           className={`cashrep__btn ${tab === "analytics" ? "is-active" : ""}`}
//           onClick={() => setTab("analytics")}
//         >
//           Продажа-Склад
//         </button>
//       </div>

//       <div className="cashrep__panel">
//         {tab === "report" && <BarberCashReport />}
//         {tab === "cashbox" && <CashboxTab />}
//         {tab === "analytics" && <AnalyticsTab />}
//       </div>
//     </div>
//   );
// };

// export default CashReports;



// CashReports.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../../../api";
import "./CashReports.scss";
import { FaFileCsv } from "react-icons/fa";

/* ===== Доп. импорты для вкладки Аналитика (Продажи/Склад/Бренды/Категории/Касса) ===== */
import { useDispatch, useSelector } from "react-redux";
import { historySellProduct } from "../../../../store/creators/saleThunk";
import {
  fetchProductsAsync,
  fetchBrandsAsync,
  fetchCategoriesAsync,
} from "../../../../store/creators/productCreators";
import { useSale } from "../../../../store/slices/saleSlice";

/* ================== helpers (shared) ================== */
const PER_PAGE = 15;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const sortKeysAsc = (arr) => [...arr].sort((a, b) => (a > b ? 1 : -1));
const listFrom = (r) => r?.data?.results || r?.data || [];
const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseISO = (s) => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

/* ================== Pagination (reusable) ================== */
const Pager = ({ total = 0, page = 1, perPage = PER_PAGE, onPage }) => {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;

  const goto = (p) => onPage && onPage(clamp(p, 1, pages));

  const windowSize = 7;
  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, page - half);
  let end = Math.min(pages, start + windowSize - 1);
  if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);

  const items = [];
  for (let p = start; p <= end; p += 1) items.push(p);

  const firstShown = (page - 1) * perPage + 1;
  const lastShown = Math.min(total, page * perPage);

  return (
    <div className="cashrep-pager" role="navigation" aria-label="Пагинация">
      <div className="cashrep-pager__info">
        Показано {firstShown}–{lastShown} из {total}
      </div>
      <div className="cashrep-pager__controls">
        <button
          type="button"
          className="cashrep-pager__btn"
          onClick={() => goto(1)}
          disabled={page === 1}
          aria-label="Первая страница"
          title="Первая"
        >
          «
        </button>
        <button
          type="button"
          className="cashrep-pager__btn"
          onClick={() => goto(page - 1)}
          disabled={page === 1}
          aria-label="Предыдущая страница"
          title="Назад"
        >
          ‹
        </button>

        {start > 1 && (
          <>
            <button
              type="button"
              className={`cashrep-pager__btn ${page === 1 ? "is-active" : ""}`}
              onClick={() => goto(1)}
              aria-label="Страница 1"
            >
              1
            </button>
            {start > 2 && <span className="cashrep-pager__ellipsis">…</span>}
          </>
        )}

        {items.map((p) => (
          <button
            type="button"
            key={p}
            className={`cashrep-pager__btn ${p === page ? "is-active" : ""}`}
            onClick={() => goto(p)}
            aria-label={`Страница ${p}`}
          >
            {p}
          </button>
        ))}

        {end < pages && (
          <>
            {end < pages - 1 && (
              <span className="cashrep-pager__ellipsis">…</span>
            )}
            <button
              type="button"
              className={`cashrep-pager__btn ${
                page === pages ? "is-active" : ""
              }`}
              onClick={() => goto(pages)}
              aria-label={`Страница ${pages}`}
            >
              {pages}
            </button>
          </>
        )}

        <button
          type="button"
          className="cashrep-pager__btn"
          onClick={() => goto(page + 1)}
          disabled={page === pages}
          aria-label="Следующая страница"
          title="Вперёд"
        >
          ›
        </button>
        <button
          type="button"
          className="cashrep-pager__btn"
          onClick={() => goto(pages)}
          disabled={page === pages}
          aria-label="Последняя страница"
          title="Последняя"
        >
          »
        </button>
      </div>
    </div>
  );
};

/* ================== tiny SVG sparkline ================== */
const Sparkline = ({ values = [], width = 520, height = 140 }) => {
  if (!values.length)
    return <div className="cashrep-anal__sparkline-empty">Нет данных</div>;
  const pad = 8;
  const W = width - pad * 2;
  const H = height - pad * 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => {
    const x = pad + (i * W) / Math.max(1, values.length - 1);
    const ratio = max === min ? 0.5 : (v - min) / (max - min);
    const y = pad + (1 - ratio) * H;
    return [x, y];
  });
  const d = pts
    .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
    .join(" ");
  return (
    <svg
      className="cashrep-anal__sparkline"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Мини-график значений"
    >
      <polyline
        fill="none"
        stroke="var(--border)"
        strokeWidth="1"
        points={`${pad},${height - pad} ${width - pad},${height - pad}`}
      />
      <path d={d} fill="none" stroke="var(--text)" strokeWidth="2" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.2" fill="var(--text)" />
      ))}
    </svg>
  );
};

/* =========================================================
   TAB 1: Барбершоп отчёты (appointments)
   ========================================================= */
const BarberCashReport = () => {
  const dateISO = (iso) => (iso ? toISODate(new Date(iso)) : "");
  const fmtMoney = (n) =>
    new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(n) || 0);
  const clientName = (c) =>
    c?.client_name || c?.full_name || c?.fullName || c?.name || c?.email || "—";
  const employeeFIO = (e) =>
    [e?.last_name, e?.first_name].filter(Boolean).join(" ").trim() ||
    e?.full_name ||
    e?.name ||
    e?.email ||
    "—";
  const serviceName = (s) => s?.service_name || s?.name || "—";
  const pickAmount = (appt, serviceObj) => {
    const cand =
      appt?.total_amount ??
      appt?.total ??
      appt?.price ??
      appt?.service_price ??
      serviceObj?.price ??
      0;
    const n = Number(cand);
    return Number.isFinite(n) ? n : 0;
  };
  const fetchAll = async (url) => {
    const acc = [];
    let next = url;
    while (next) {
      const { data } = await api.get(next);
      const chunk = data?.results ?? data ?? [];
      acc.push(...chunk);
      next = data?.next || null;
    }
    return acc;
  };
  const STATUS_LABELS = {
    booked: "Забронировано",
    confirmed: "Подтверждено",
    completed: "Завершено",
    canceled: "Отменено",
    no_show: "Не пришёл",
  };

  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [masterId, setMasterId] = useState("");
  const [status, setStatus] = useState("completed");

  /* pagination (main table) */
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");
        const [a, c, e, s] = await Promise.all([
          fetchAll("/barbershop/appointments/"),
          fetchAll("/barbershop/clients/"),
          fetchAll("/users/employees/"),
          fetchAll("/barbershop/services/"),
        ]);
        setAppointments(a || []);
        setClients(c || []);
        setEmployees(e || []);
        setServices(s || []);
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        setDateFrom(toISODate(start));
        setDateTo(toISODate(end));
      } catch (e) {
        setError(
          e?.response?.data?.detail ||
            "Не удалось загрузить данные кассы (записи/клиенты/сотрудники/услуги)"
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const clientMap = useMemo(() => {
    const m = new Map();
    clients.forEach((c) => m.set(String(c.id), c));
    return m;
  }, [clients]);
  const employeeMap = useMemo(() => {
    const m = new Map();
    employees.forEach((u) => m.set(String(u.id), u));
    return m;
  }, [employees]);
  const serviceMap = useMemo(() => {
    const m = new Map();
    services.forEach((s) => m.set(String(s.id), s));
    return m;
  }, [services]);

  const rows = useMemo(() => {
    return (appointments || []).map((a) => {
      const sid = String(a?.service ?? "");
      const mid = String(a?.barber ?? "");
      const cid = String(a?.client ?? "");
      const srv = serviceMap.get(sid);
      const amount = pickAmount(a, srv);
      const date = dateISO(a?.start_at || a?.end_at);
      return {
        id: a?.id ?? `${sid}-${mid}-${cid}-${a?.start_at || ""}`,
        date,
        serviceId: sid,
        masterId: mid,
        clientId: cid,
        amount,
        status: a?.status || "",
      };
    });
  }, [appointments, serviceMap]);

  const servicesSorted = useMemo(
    () =>
      [...services].sort((a, b) =>
        (serviceName(a) || "").localeCompare(serviceName(b) || "", "ru")
      ),
    [services]
  );
  const employeesSorted = useMemo(
    () =>
      [...employees].sort((a, b) =>
        (employeeFIO(a) || "").localeCompare(employeeFIO(b) || "", "ru")
      ),
    [employees]
  );

  const masterOptions = useMemo(() => {
    const idsInData = new Set(rows.map((r) => r.masterId).filter(Boolean));
    const list = employeesSorted.filter((u) => idsInData.has(String(u.id)));
    return list.length ? list : employeesSorted;
  }, [employeesSorted, rows]);

  const [fromSafe, toSafe] = useMemo(() => {
    let f = dateFrom;
    let t = dateTo;
    if (f && t && f > t) [f, t] = [t, f];
    return [f, t];
  }, [dateFrom, dateTo]);

  const filtered = useMemo(() => {
    const res = rows.filter((t) => {
      const byStatus = status ? t.status === status : true;
      const inFrom = !fromSafe || t.date >= fromSafe;
      const inTo = !toSafe || t.date <= toSafe;
      const byService = !serviceId || t.serviceId === serviceId;
      const byMaster = !masterId || t.masterId === masterId;
      return byStatus && inFrom && inTo && byService && byMaster;
    });
    return res;
  }, [rows, fromSafe, toSafe, serviceId, masterId, status]);

  /* reset page when filter changes */
  useEffect(() => setPage(1), [fromSafe, toSafe, serviceId, masterId, status]);

  const total = useMemo(
    () => filtered.reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    [filtered]
  );
  const count = filtered.length;
  const uniqueClients = useMemo(
    () => new Set(filtered.map((t) => t.clientId)).size,
    [filtered]
  );
  const avg = count ? Math.round(total / count) : 0;

  const groupSum = (items, keyFn) =>
    items.reduce((acc, item) => {
      const k = keyFn(item) || "—";
      acc[k] = (acc[k] || 0) + (Number(item.amount) || 0);
      return acc;
    }, {});
  const byDate = useMemo(() => {
    const g = groupSum(filtered, (t) => t.date);
    return Object.fromEntries(
      Object.entries(g).sort(([d1], [d2]) => (d1 > d2 ? 1 : d1 < d2 ? -1 : 0))
    );
  }, [filtered]);
  const byService = useMemo(() => {
    const g = groupSum(filtered, (t) => {
      const srv = serviceMap.get(t.serviceId);
      return srv?.service_name || srv?.name || "—";
    });
    return Object.fromEntries(Object.entries(g).sort(([, a], [, b]) => b - a));
  }, [filtered, serviceMap]);
  const byMaster = useMemo(() => {
    const g = groupSum(filtered, (t) =>
      employeeFIO(employeeMap.get(t.masterId))
    );
    return Object.fromEntries(Object.entries(g).sort(([, a], [, b]) => b - a));
  }, [filtered, employeeMap]);

  const paged = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return filtered.slice(start, start + PER_PAGE);
  }, [filtered, page]);

  const exportCSV = () => {
    const head = ["Дата", "Клиент", "Мастер", "Услуга", "Сумма", "Статус"];
    const dataRows = filtered.map((t) => [
      t.date,
      clientName(clientMap.get(t.clientId)),
      employeeFIO(employeeMap.get(t.masterId)),
      serviceMap.get(t.serviceId)?.service_name ||
        serviceMap.get(t.serviceId)?.name ||
        "—",
      String(t.amount ?? 0),
      STATUS_LABELS[t.status] || t.status || "",
    ]);
    const csv = [head, ...dataRows]
      .map((r) =>
        r
          .map((cell) => {
            const v = String(cell ?? "");
            return /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
          })
          .join(";")
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cash_${fromSafe || "all"}_${toSafe || "all"}${
      status ? "_" + status : ""
    }.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const setPreset = (preset) => {
    const now = new Date();
    if (preset === "today") {
      const d = toISODate(now);
      setDateFrom(d);
      setDateTo(d);
    } else if (preset === "week") {
      const day = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - (day - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setDateFrom(toISODate(monday));
      setDateTo(toISODate(sunday));
    } else if (preset === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setDateFrom(toISODate(start));
      setDateTo(toISODate(end));
    }
  };

  return (
    <div className="cashrep-barber">
      <div className="cashrep-barber__header">
        <h2 className="cashrep-barber__title">Касса · Барбершоп</h2>
        <button
          className="cashrep-barber__btn cashrep-barber__btn--primary"
          onClick={exportCSV}
          disabled={loading || filtered.length === 0}
          aria-label="Экспорт в CSV"
          title="Экспортировать CSV"
        >
          <FaFileCsv /> Экспорт CSV
        </button>
      </div>

      <div className="cashrep-barber__filters">
        <div className="cashrep-barber__filter-row">
          <div className="cashrep-barber__field">
            <label className="cashrep-barber__label">Дата от</label>
            <input
              type="date"
              className="cashrep-barber__input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="cashrep-barber__field">
            <label className="cashrep-barber__label">Дата до</label>
            <input
              type="date"
              className="cashrep-barber__input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="cashrep-barber__field">
            <label className="cashrep-barber__label">Услуга</label>
            <select
              className="cashrep-barber__input"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            >
              <option value="">Все</option>
              {servicesSorted.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {serviceName(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="cashrep-barber__field">
            <label className="cashrep-barber__label">Мастер</label>
            <select
              className="cashrep-barber__input"
              value={masterId}
              onChange={(e) => setMasterId(e.target.value)}
            >
              <option value="">Все</option>
              {masterOptions.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {employeeFIO(u)}
                </option>
              ))}
            </select>
          </div>
          <div className="cashrep-barber__field">
            <label className="cashrep-barber__label">Статус</label>
            <select
              className="cashrep-barber__input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              title="Фильтр по статусу записи"
            >
              <option value="">Все</option>
              <option value="booked">Забронировано</option>
              <option value="confirmed">Подтверждено</option>
              <option value="completed">Завершено</option>
              <option value="canceled">Отменено</option>
              <option value="no_show">Не пришёл</option>
            </select>
          </div>
        </div>

        <div className="cashrep-barber__presets">
          <button
            className="cashrep-barber__chip"
            onClick={() => setPreset("today")}
          >
            Сегодня
          </button>
          <button
            className="cashrep-barber__chip"
            onClick={() => setPreset("week")}
          >
            Неделя
          </button>
          <button
            className="cashrep-barber__chip"
            onClick={() => setPreset("month")}
          >
            Месяц
          </button>
          <button
            className="cashrep-barber__chip"
            onClick={() => {
              setServiceId("");
              setMasterId("");
              setStatus("completed");
            }}
            title="Сбросить фильтры"
          >
            Сброс фильтров
          </button>
        </div>
      </div>

      {error && <div className="cashrep-barber__alert">{error}</div>}

      <div className="cashrep-barber__summary">
        <div className="cashrep-barber__card">
          <span className="cashrep-barber__card-label">Выручка</span>
          <span className="cashrep-barber__card-value">
            {fmtMoney(total)} сом
          </span>
        </div>
        <div className="cashrep-barber__card">
          <span className="cashrep-barber__card-label">Транзакций</span>
          <span className="cashrep-barber__card-value">{count}</span>
        </div>
        <div className="cashrep-barber__card">
          <span className="cashrep-barber__card-label">Средний чек</span>
          <span className="cashrep-barber__card-value">
            {fmtMoney(avg)} сом
          </span>
        </div>
        <div className="cashrep-barber__card">
          <span className="cashrep-barber__card-label">
            Уникальных клиентов
          </span>
          <span className="cashrep-barber__card-value">{uniqueClients}</span>
        </div>
      </div>

      <div className="cashrep-barber__table-wrap">
        <table className="cashrep-barber__table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Клиент</th>
              <th>Мастер</th>
              <th>Услуга</th>
              <th className="cashrep-barber__table-amount">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="cashrep-barber__loading" colSpan="5">
                  Загрузка...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="cashrep-barber__loading" colSpan="5">
                  Нет данных
                </td>
              </tr>
            ) : (
              paged.map((t) => (
                <tr key={t.id}>
                  <td>{t.date || "—"}</td>
                  <td>{clientName(clientMap.get(t.clientId))}</td>
                  <td>{employeeFIO(employeeMap.get(t.masterId))}</td>
                  <td>
                    {serviceMap.get(t.serviceId)?.service_name ||
                      serviceMap.get(t.serviceId)?.name ||
                      "—"}
                  </td>
                  <td className="cashrep-barber__table-amount">
                    {fmtMoney(t.amount)} сом
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pager
        total={filtered.length}
        page={page}
        perPage={PER_PAGE}
        onPage={setPage}
      />

      <div className="cashrep-barber__reports">
        <div className="cashrep-barber__report">
          <h3 className="cashrep-barber__h3">По дням</h3>
          <ul className="cashrep-barber__list">
            {Object.entries(byDate).map(([date, amount]) => (
              <li key={date || "none"} className="cashrep-barber__list-item">
                <span>{date || "—"}</span>
                <span className="cashrep-barber__list-amount">
                  {fmtMoney(amount)} сом
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="cashrep-barber__report">
          <h3 className="cashrep-barber__h3">По услугам</h3>
          <ul className="cashrep-barber__list">
            {Object.entries(byService).map(([service, amount]) => (
              <li key={service || "none"} className="cashrep-barber__list-item">
                <span>{service || "—"}</span>
                <span className="cashrep-barber__list-amount">
                  {fmtMoney(amount)} сом
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="cashrep-barber__report">
          <h3 className="cashrep-barber__h3">По мастерам</h3>
          <ul className="cashrep-barber__list">
            {Object.entries(byMaster).map(([master, amount]) => (
              <li key={master || "none"} className="cashrep-barber__list-item">
                <span>{master || "—"}</span>
                <span className="cashrep-barber__list-amount">
                  {fmtMoney(amount)} сом
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   TAB 2: Кассы (список / детали) — без оплаты
   ========================================================= */
const CashboxTab = () => {
  const [view, setView] = useState("list"); // list | detail
  const [detailId, setDetailId] = useState(null);

  /* ---------- LIST ---------- */
  const CashboxListInline = ({ onOpen }) => {
    const [rows, setRows] = useState([]);
    const [q, setQ] = useState("");
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState("");
    const [saveErr, setSaveErr] = useState("");
    const [saving, setSaving] = useState(false);
    const [page, setPage] = useState(1);

    const money = (v) =>
      (Number(v) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 0 }) +
      " c";

    const load = async () => {
      try {
        setErr("");
        setLoading(true);
        const { data } = await api.get("/construction/cashboxes/", {
          params: { page_size: 1000 },
        });
        setRows(asArray(data));
      } catch {
        setErr("Не удалось загрузить кассы");
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      load();
    }, []);

    const filtered = useMemo(() => {
      const t = q.trim().toLowerCase();
      if (!t) return rows;
      return rows.filter((r) =>
        [r.department_name, r.name].some((x) =>
          String(x || "").toLowerCase().includes(t)
        )
      );
    }, [rows, q]);

    useEffect(() => setPage(1), [q, rows.length]);

    const paged = useMemo(() => {
      const start = (page - 1) * PER_PAGE;
      return filtered.slice(start, start + PER_PAGE);
    }, [filtered, page]);

    const normalized = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

    const onCreate = async () => {
      const title = (name || "").trim();
      setSaveErr("");
      if (!title) return setSaveErr("Укажите название кассы.");
      if (title.length < 2) return setSaveErr("Название должно быть не короче 2 символов.");
      const duplicate = rows.some(
        (r) =>
          normalized(r?.department_name || r?.name) === normalized(title)
      );
      if (duplicate) return setSaveErr("Касса с таким названием уже существует.");

      try {
        setSaving(true);
        await api.post("/construction/cashboxes/", { name: title });
        setCreateOpen(false);
        setName("");
        await load();
      } catch {
        setSaveErr("Не удалось создать кассу.");
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="cashrep-cbox">
        <div className="cashrep-cbox__toolbar">
          <div className="cashrep-cbox__toolbar-side">
            <span className="cashrep-cbox__total">Всего: {filtered.length}</span>
          </div>
          <div className="cashrep-cbox__controls">
            <input
              className="cashrep-cbox__search"
              type="text"
              placeholder="Поиск…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Поиск по кассам"
            />
            <button
              className="cashrep-cbox__btn"
              onClick={() => {
                setSaveErr("");
                setCreateOpen(true);
              }}
            >
              Создать кассу
            </button>
          </div>
        </div>

        {err && <div className="cashrep-cbox__error">{err}</div>}

        <div className="cashrep-cbox__table-wrap">
          <table className="cashrep-cbox__table">
            <thead>
              <tr>
                <th>#</th>
                <th>Название</th>
                <th>Приход</th>
                <th>Расход</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>Загрузка…</td>
                </tr>
              ) : filtered.length ? (
                paged.map((r, i) => (
                  <tr
                    key={r.id}
                    className="cashrep-cbox__row"
                    onClick={() => onOpen(r.id)}
                  >
                    <td>{(page - 1) * PER_PAGE + i + 1}</td>
                    <td>
                      <b>{r.department_name || r.name || "—"}</b>
                    </td>
                    <td>{money(r.analytics?.income?.total || 0)}</td>
                    <td>{money(r.analytics?.expense?.total || 0)}</td>
                    <td>
                      <button
                        className="cashrep-cbox__btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(r.id);
                        }}
                      >
                        Открыть
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="cashrep-cbox__muted">
                    Нет данных
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pager
          total={filtered.length}
          page={page}
          perPage={PER_PAGE}
          onPage={setPage}
        />

        {createOpen && (
          <div className="cashrep-cbox-modal" role="dialog" aria-modal="true">
            <div
              className="cashrep-cbox-modal__overlay"
              onClick={() => !saving && setCreateOpen(false)}
              aria-label="Закрыть модалку"
            />
            <div
              className="cashrep-cbox-modal__content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="cashrep-cbox-modal__header">
                <h3 className="cashrep-cbox-modal__title">Создать кассу</h3>
                <button
                  className="cashrep-cbox-modal__close"
                  onClick={() => !saving && setCreateOpen(false)}
                  aria-label="Закрыть"
                >
                  ×
                </button>
              </div>
              <div className="cashrep-cbox-modal__section">
                <label className="cashrep-cbox-modal__label">
                  Название кассы *
                </label>
                <input
                  className="cashrep-cbox-modal__input"
                  type="text"
                  placeholder="Например: Касса №1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  aria-invalid={saveErr ? "true" : "false"}
                />
                {saveErr && <div className="cashrep-cbox__error">{saveErr}</div>}
              </div>
              <div className="cashrep-cbox-modal__footer">
                <button
                  className="cashrep-cbox__btn"
                  onClick={onCreate}
                  disabled={saving}
                >
                  {saving ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ---------- DETAIL ---------- */
  const CashboxDetailInline = ({ id, onBack }) => {
    const [box, setBox] = useState(null);
    const [ops, setOps] = useState([]);
    const [tab, setTab] = useState("all");
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [page, setPage] = useState(1);

    const when = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");
    const money = (v) =>
      (Number(v) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 0 }) +
      " c";

    const fromAny = (res) => {
      const d = res?.data ?? res ?? [];
      if (Array.isArray(d?.results)) return d.results;
      if (Array.isArray(d)) return d;
      return [];
    };

    const load = async () => {
      setErr("");
      setLoading(true);
      try {
        let detail = null;
        try {
          detail = (
            await api.get(`/construction/cashboxes/${id}/detail/owner/`)
          ).data;
        } catch {}
        if (!detail) {
          try {
            detail = (await api.get(`/construction/cashboxes/${id}/detail/`))
              .data;
          } catch {}
        }
        if (!detail) {
          detail = (await api.get(`/construction/cashboxes/${id}/`)).data;
        }
        setBox(detail);

        let flows =
          fromAny({ data: detail?.operations }) ||
          fromAny({ data: detail?.flows }) ||
          fromAny({ data: detail?.transactions });

        if (!flows.length) {
          try {
            const r1 = await api.get(`/construction/cashflows/`, {
              params: { cashbox: id, page_size: 1000 },
            });
            flows = fromAny(r1);
          } catch {}
        }
        if (!flows.length && detail?.uuid) {
          try {
            const r2 = await api.get(`/construction/cashflows/`, {
              params: { cashbox: detail.uuid, page_size: 1000 },
            });
            flows = fromAny(r2);
          } catch {}
        }

        const mapped = (flows || []).map((x, i) => {
          const amt = Number(x.amount ?? x.sum ?? x.value ?? x.total ?? 0) || 0;
          let type = String(
            x.type ?? x.kind ?? x.direction ?? ""
          ).toLowerCase();
          if (type !== "income" && type !== "expense")
            type = amt >= 0 ? "income" : "expense";
          return {
            id: x.id || x.uuid || `${i}`,
            type,
            title:
              x.title ||
              x.name ||
              x.description ||
              x.note ||
              (type === "income" ? "Приход" : "Расход"),
            amount: Math.abs(amt),
            created_at:
              x.created_at ||
              x.created ||
              x.date ||
              x.timestamp ||
              x.createdAt ||
              null,
          };
        });

        setOps(mapped);
      } catch {
        setErr("Не удалось загрузить детали кассы");
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      if (id) load();
    }, [id]);

    const shown = useMemo(() => {
      if (tab === "income") return ops.filter((o) => o.type === "income");
      if (tab === "expense") return ops.filter((o) => o.type === "expense");
      return ops;
    }, [ops, tab]);

    useEffect(() => setPage(1), [tab, ops.length]);

    const paged = useMemo(() => {
      const start = (page - 1) * PER_PAGE;
      return shown.slice(start, start + PER_PAGE);
    }, [shown, page]);

    return (
      <div className="cashrep-cbox">
        <div className="cashrep-cbox__header">
          <div className="cashrep-cbox__tabs">
            <button className="cashrep-cbox__tab" onClick={onBack}>
              ← Назад
            </button>
            <span className="cashrep-cbox__tab is-active">
              {box?.department_name || box?.name || "Касса"}
            </span>
          </div>
        </div>

        <div className="cashrep-cbox__seg">
          <button
            className={`cashrep-cbox__seg-btn ${
              tab === "expense" ? "is-active" : ""
            }`}
            onClick={() => setTab("expense")}
          >
            Расход
          </button>
          <button
            className={`cashrep-cbox__seg-btn ${
              tab === "income" ? "is-active" : ""
            }`}
            onClick={() => setTab("income")}
          >
            Приход
          </button>
          <button
            className={`cashrep-cbox__seg-btn ${
              tab === "all" ? "is-active" : ""
            }`}
            onClick={() => setTab("all")}
          >
            Все
          </button>
          <div className="cashrep-cbox__seg-grow" />
        </div>

        <div className="cashrep-cbox__table-wrap">
          <table className="cashrep-cbox__table">
            <thead>
              <tr>
                <th>Тип</th>
                <th>Наименование</th>
                <th>Сумма</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4}>Загрузка…</td>
                </tr>
              ) : err ? (
                <tr>
                  <td colSpan={4} className="cashrep-cbox__error">
                    {err}
                  </td>
                </tr>
              ) : shown.length ? (
                paged.map((o) => (
                  <tr key={o.id}>
                    <td>{o.type === "income" ? "Приход" : "Расход"}</td>
                    <td>{o.title}</td>
                    <td>{money(o.amount)}</td>
                    <td>{when(o.created_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="cashrep-cbox__muted">
                    Нет операций
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pager
          total={shown.length}
          page={page}
          perPage={PER_PAGE}
          onPage={setPage}
        />
      </div>
    );
  };

  return (
    <div className="cashrep-cbox">
      {view === "list" && (
        <CashboxListInline
          onOpen={(id) => {
            setDetailId(id);
            setView("detail");
          }}
        />
      )}
      {view === "detail" && (
        <CashboxDetailInline id={detailId} onBack={() => setView("list")} />
      )}
    </div>
  );
};

/* =========================================================
   TAB 3: АНАЛИТИКА — 4 саб-вкладки (Продажи/Склад/Бренды/Категории/Касса)
   ========================================================= */
const AnalyticsTab = () => {
  const dispatch = useDispatch();

  /* ---- из saleSlice ---- */
  const { history = [], loading: salesLoading, error: salesError } = useSale();

  /* ---- из productSlice ---- */
  const {
    list: products = [],
    brands = [],
    categories = [],
    loading: productsLoading,
  } = useSelector((s) => s.product || {});

  /* ---- UI: саб-вкладки ---- */
  const [activeTab, setActiveTab] = useState("sales"); // sales | inventory | taxonomy | cashbox

  /* ---- общие контролы дат/гранулярности ---- */
  const [startDate, setStartDate] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-01-01`;
  });
  const [endDate, setEndDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [granularity, setGranularity] = useState("month"); // day | month | year

  /* ---- пагинация списков (продажи/операции кассы) ---- */
  const [salesPage, setSalesPage] = useState(1);
  const [cashOpsPage, setCashOpsPage] = useState(1);

  const lan =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("i18nextLng")) ||
    "ru";
  const nfMoney = useMemo(() => {
    try {
      return new Intl.NumberFormat(lan === "en" ? "en-US" : "ru-RU", {
        style: "currency",
        currency: "KGS",
        maximumFractionDigits: 0,
      });
    } catch {
      return { format: (n) => `${Number(n).toLocaleString("ru-RU")} сом` };
    }
  }, [lan]);
  const nfInt = useMemo(
    () => new Intl.NumberFormat(lan === "en" ? "en-US" : "ru-RU"),
    [lan]
  );

  const parseISO2 = (s) => {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };
  const keyByGranularity = (date, g) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    if (g === "day") return `${y}-${m}-${d}`;
    if (g === "year") return `${y}`;
    return `${y}-${m}`;
  };
  const inRange = (d) => {
    const sd = parseISO2(startDate);
    const ed = parseISO2(endDate);
    if (!d || !sd || !ed) return false;
    const from = new Date(
      sd.getFullYear(),
      sd.getMonth(),
      sd.getDate(),
      0,
      0,
      0
    );
    const to = new Date(
      ed.getFullYear(),
      ed.getMonth(),
      ed.getDate(),
      23,
      59,
      59
    );
    return d >= from && d <= to;
  };
  const quickPreset = (preset) => {
    const now = new Date();
    if (preset === "thisMonth") {
      const sd = new Date(now.getFullYear(), now.getMonth(), 1);
      const ed = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(sd.toISOString().slice(0, 10));
      setEndDate(ed.toISOString().slice(0, 10));
      setGranularity("day");
    }
    if (preset === "lastMonth") {
      const sd = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const ed = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(sd.toISOString().slice(0, 10));
      setEndDate(ed.toISOString().slice(0, 10));
      setGranularity("day");
    }
    if (preset === "ytd") {
      const sd = new Date(now.getFullYear(), 0, 1);
      setStartDate(sd.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
      setGranularity("month");
    }
    if (preset === "thisYear") {
      const sd = new Date(now.getFullYear(), 0, 1);
      const ed = new Date(now.getFullYear(), 11, 31);
      setStartDate(sd.toISOString().slice(0, 10));
      setEndDate(ed.toISOString().slice(0, 10));
      setGranularity("month");
    }
  };

  /* ---- загрузка данных (продажи + товары/бренды/категории) ---- */
  useEffect(() => {
    dispatch(historySellProduct({ search: "" }));
    dispatch(fetchProductsAsync({ page: 1, page_size: 1000 }));
    dispatch(fetchBrandsAsync());
    dispatch(fetchCategoriesAsync());
  }, [dispatch]);

  /* ====================== SALES ====================== */
  const salesFiltered = useMemo(
    () => (history || []).filter((r) => inRange(parseISO2(r?.created_at))),
    [history, startDate, endDate]
  );

  useEffect(() => setSalesPage(1), [startDate, endDate, history.length]);

  const salesTotals = useMemo(() => {
    const count = salesFiltered.length;
    const revenue = salesFiltered.reduce((acc, r) => acc + num(r?.total), 0);
    return { count, revenue, avg: count ? revenue / count : 0 };
  }, [salesFiltered]);

  const salesSeries = useMemo(() => {
    const bucket = new Map();
    for (const r of salesFiltered) {
      const d = parseISO2(r?.created_at);
      if (!d) continue;
      const key = keyByGranularity(d, granularity);
      bucket.set(key, num(bucket.get(key)) + num(r?.total));
    }
    const keys = sortKeysAsc(Array.from(bucket.keys()));
    return {
      labels: keys,
      values: keys.map((k) => Math.round(num(bucket.get(k)))),
    };
  }, [salesFiltered, granularity]);

  const salesPaged = useMemo(() => {
    const start = (salesPage - 1) * PER_PAGE;
    return salesFiltered
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(start, start + PER_PAGE);
  }, [salesFiltered, salesPage]);

  /* ====================== INVENTORY ====================== */
  const LOW_STOCK_THRESHOLD = 5;

  const inventoryKPIs = useMemo(() => {
    const totalSkus = products.length;
    const lowStock = products.filter(
      (p) => num(p?.quantity) <= LOW_STOCK_THRESHOLD
    ).length;

    const stockValueByPrice = products.reduce(
      (acc, p) => acc + num(p?.price) * num(p?.quantity),
      0
    );

    const stockValueByCost = products.some((p) => "cost_price" in p)
      ? products.reduce(
          (acc, p) => acc + num(p?.cost_price) * num(p?.quantity),
          0
        )
      : null;

    return { totalSkus, lowStock, stockValueByPrice, stockValueByCost };
  }, [products]);

  const topCategories = useMemo(() => {
    const m = new Map();
    products.forEach((p) => {
      const key = p?.category || p?.category_name || "Без категории";
      m.set(key, num(m.get(key)) + 1);
    });
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [products]);

  const lowStockList = useMemo(
    () =>
      [...products]
        .sort((a, b) => num(a?.quantity) - num(b?.quantity))
        .slice(0, 10),
    [products]
  );

  // ABC по стоимости запаса
  const abcStats = useMemo(() => {
    if (!products.length) return { A: 0, B: 0, C: 0, list: [] };
    const items = products.map((p) => {
      const value =
        "cost_price" in p
          ? num(p.cost_price) * num(p.quantity)
          : num(p.price) * num(p.quantity);
      return { id: p.id, name: p.name, value };
    });
    items.sort((a, b) => b.value - a.value);
    const total = items.reduce((s, x) => s + x.value, 0) || 1;
    let acc = 0;
    let A = 0,
      B = 0,
      C = 0;
    const tagged = items.map((it) => {
      acc += it.value;
      const share = acc / total;
      let tag = "C";
      if (share <= 0.8) tag = "A";
      else if (share <= 0.95) tag = "B";
      if (tag === "A") A += 1;
      else if (tag === "B") B += 1;
      else C += 1;
      return { ...it, tag };
    });
    return { A, B, C, list: tagged.slice(0, 10) };
  }, [products]);

  /* ====================== TAXONOMY ====================== */
  const brandStats = useMemo(() => {
    const m = new Map();
    products.forEach((p) => {
      const key = p?.brand || p?.brand_name || "Без бренда";
      m.set(key, num(m.get(key)) + 1);
    });
    const pairs = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    return { total: brands.length || pairs.length, top: pairs.slice(0, 10) };
  }, [products, brands]);

  const categoryStats = useMemo(() => {
    const m = new Map();
    products.forEach((p) => {
      const key = p?.category || p?.category_name || "Без категории";
      m.set(key, num(m.get(key)) + 1);
    });
    const pairs = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    return {
      total: categories.length || pairs.length,
      top: pairs.slice(0, 10),
    };
  }, [products, categories]);

  /* ====================== CASHBOX (flows) ====================== */
  const [boxes, setBoxes] = useState([]);
  const [flows, setFlows] = useState([]);
  const [boxId, setBoxId] = useState("all");
  const [cashLoading, setCashLoading] = useState(false);
  const [cashError, setCashError] = useState("");

  // подгружаем кассы только при заходе на вкладку cashbox
  useEffect(() => {
    if (activeTab !== "cashbox" || boxes.length) return;
    (async () => {
      try {
        const res = await api.get("/construction/cashboxes/", {
          params: { page_size: 1000 },
        });
        setBoxes(listFrom(res));
      } catch {
        setBoxes([]);
      }
    })();
  }, [activeTab, boxes.length]);

  const loadFlows = async () => {
    setCashError("");
    setCashLoading(true);
    try {
      const params = { page_size: 1000 };
      if (boxId !== "all") params.cashbox = boxId;
      const r = await api.get("/construction/cashflows/", { params });
      const raw = listFrom(r) || [];
      const normalized = raw.map((x, i) => {
        const amt = num(x.amount ?? x.sum ?? x.value ?? x.total ?? 0);
        let type = String(x.type ?? x.kind ?? x.direction ?? "").toLowerCase();
        if (type !== "income" && type !== "expense")
          type = amt >= 0 ? "income" : "expense";
        const cashboxId = x.cashbox?.id || x.cashbox || x.cashbox_uuid || null;
        const cashboxName =
          x.cashbox?.department_name ||
          x.cashbox?.name ||
          x.cashbox_name ||
          null;
        return {
          id: x.id || x.uuid || `${i}`,
          type,
          amount: Math.abs(amt),
          title:
            x.title ||
            x.name ||
            x.description ||
            x.note ||
            (type === "income" ? "Приход" : "Расход"),
          created_at:
            x.created_at ||
            x.created ||
            x.date ||
            x.timestamp ||
            x.createdAt ||
            null,
          cashboxId,
          cashboxName,
        };
      });
      setFlows(normalized);
    } catch {
      setCashError("Не удалось загрузить операции кассы");
      setFlows([]);
    } finally {
      setCashLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "cashbox") return;
    loadFlows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, boxId]);

  const flowsFiltered = useMemo(() => {
    return flows.filter((f) => {
      const d = parseISO2(f.created_at);
      return inRange(d);
    });
  }, [flows, startDate, endDate]);

  useEffect(() => setCashOpsPage(1), [flowsFiltered.length, startDate, endDate]);

  const cashTotals = useMemo(() => {
    let income = 0,
      expense = 0;
    for (const f of flowsFiltered) {
      if (f.type === "income") income += f.amount;
      else expense += f.amount;
    }
    return { income, expense, net: income - expense };
  }, [flowsFiltered]);

  const cashSeries = useMemo(() => {
    const inc = new Map();
    const exp = new Map();
    for (const f of flowsFiltered) {
      const d = parseISO2(f.created_at);
      if (!d) continue;
      const k = keyByGranularity(d, granularity);
      if (f.type === "income") inc.set(k, num(inc.get(k)) + f.amount);
      else exp.set(k, num(exp.get(k)) + f.amount);
    }
    const keys = sortKeysAsc(
      Array.from(new Set([...inc.keys(), ...exp.keys()]))
    );
    const incomeVals = keys.map((k) => Math.round(num(inc.get(k))));
    const expenseVals = keys.map((k) => Math.round(num(exp.get(k))));
    const netVals = keys.map((_, i) =>
      Math.round(num(incomeVals[i]) - num(expenseVals[i]))
    );
    return { labels: keys, incomeVals, expenseVals, netVals };
  }, [flowsFiltered, granularity]);

  const perBox = useMemo(() => {
    const map = new Map();
    for (const f of flowsFiltered) {
      const id = f.cashboxId || "—";
      const name =
        f.cashboxName ||
        boxes.find((b) => (b.id || b.uuid) === id)?.department_name ||
        boxes.find((b) => (b.id || b.uuid) === id)?.name ||
        "—";
      const cur = map.get(id) || { name, income: 0, expense: 0 };
      if (f.type === "income") cur.income += f.amount;
      else cur.expense += f.amount;
      map.set(id, cur);
    }
    const rows = Array.from(map.entries()).map(([id, v]) => ({
      id,
      name: v.name,
      income: v.income,
      expense: v.expense,
      net: v.income - v.expense,
    }));
    rows.sort((a, b) => b.net - a.net);
    return rows;
  }, [flowsFiltered, boxes]);

  const topExpenseByTitle = useMemo(() => {
    const m = new Map();
    for (const f of flowsFiltered) {
      if (f.type !== "expense") continue;
      const key = (f.title || "Расход").toString();
      m.set(key, num(m.get(key)) + f.amount);
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [flowsFiltered]);

  const cashOpsPaged = useMemo(() => {
    const start = (cashOpsPage - 1) * PER_PAGE;
    return flowsFiltered
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(start, start + PER_PAGE);
  }, [flowsFiltered, cashOpsPage]);

  /* ---------- RENDER ---------- */
  return (
    <div className="cashrep-anal">
      {/* саб-вкладки */}
      <div className="cashrep-anal__tabs">
        <button
          className={`cashrep-anal__tab ${
            activeTab === "sales" ? "is-active" : ""
          }`}
          onClick={() => setActiveTab("sales")}
        >
          Продажи
        </button>
        <button
          className={`cashrep-anal__tab ${
            activeTab === "inventory" ? "is-active" : ""
          }`}
          onClick={() => setActiveTab("inventory")}
        >
          Склад
        </button>
        <button
          className={`cashrep-anal__tab ${
            activeTab === "taxonomy" ? "is-active" : ""
          }`}
          onClick={() => setActiveTab("taxonomy")}
        >
          Бренды/Категории
        </button>
        <button
          className={`cashrep-anal__tab ${
            activeTab === "cashbox" ? "is-active" : ""
          }`}
          onClick={() => setActiveTab("cashbox")}
        >
          Касса
        </button>
      </div>

      {/* ---- общие контролы для табов, где нужен период/гранулярность ---- */}
      {(activeTab === "sales" || activeTab === "cashbox") && (
        <div className="cashrep-anal__controls">
          <div className="cashrep-anal__presets">
            <button onClick={() => quickPreset("thisMonth")}>Этот месяц</button>
            <button onClick={() => quickPreset("lastMonth")}>
              Прошлый месяц
            </button>
            <button onClick={() => quickPreset("ytd")}>
              С начала года (YTD)
            </button>
            <button onClick={() => quickPreset("thisYear")}>Весь год</button>
          </div>
          <div className="cashrep-anal__range">
            <label className="cashrep-anal__label">
              С
              <input
                type="date"
                className="cashrep-anal__input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="cashrep-anal__label">
              До
              <input
                type="date"
                className="cashrep-anal__input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>

            <div className="cashrep-anal__seg">
              <button
                className={granularity === "day" ? "is-active" : ""}
                onClick={() => setGranularity("day")}
              >
                Дни
              </button>
              <button
                className={granularity === "month" ? "is-active" : ""}
                onClick={() => setGranularity("month")}
              >
                Месяцы
              </button>
              <button
                className={granularity === "year" ? "is-active" : ""}
                onClick={() => setGranularity("year")}
              >
                Годы
              </button>
            </div>

            {activeTab === "cashbox" && (
              <label className="cashrep-anal__label">
                Касса
                <select
                  className="cashrep-anal__input"
                  value={boxId}
                  onChange={(e) => setBoxId(e.target.value)}
                >
                  <option value="all">Все кассы</option>
                  {boxes.map((b) => (
                    <option key={b.id || b.uuid} value={b.id || b.uuid}>
                      {b.department_name || b.name || b.id || b.uuid}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      )}

      {/* ---- SALES ---- */}
      {activeTab === "sales" && (
        <>
          <div className="cashrep-anal__kpis">
            <div className="cashrep-anal__kpi">
              <div className="cashrep-anal__kpi-label">Число продаж</div>
              <div className="cashrep-anal__kpi-value">
                {nfInt.format(salesTotals.count)}
              </div>
            </div>
            <div className="cashrep-anal__kpi">
              <div className="cashrep-anal__kpi-label">Выручка</div>
              <div className="cashrep-anal__kpi-value">
                {nfMoney.format(salesTotals.revenue)}
              </div>
            </div>
            <div className="cashrep-anal__kpi">
              <div className="cashrep-anal__kpi-label">Средний чек</div>
              <div className="cashrep-anal__kpi-value">
                {nfMoney.format(salesTotals.avg)}
              </div>
            </div>
          </div>

          <div className="cashrep-anal__card">
            {salesLoading ? (
              <div className="cashrep-anal__note">Загрузка истории продаж…</div>
            ) : salesError ? (
              <div className="cashrep-anal__error">
                Ошибка: {String(salesError)}
              </div>
            ) : (
              <>
                <div className="cashrep-anal__card-title">
                  Динамика выручки (
                  {granularity === "day"
                    ? "дни"
                    : granularity === "month"
                    ? "месяцы"
                    : "годы"}
                  )
                </div>
                <Sparkline values={salesSeries.values} />
                <div className="cashrep-anal__legend">
                  {salesSeries.labels.map((l, i) => (
                    <span className="cashrep-anal__legend-item" key={i}>
                      {l}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="cashrep-anal__card">
            <div className="cashrep-anal__card-title">Последние продажи</div>
            {salesFiltered.length ? (
              <>
                <div className="cashrep-anal__table-wrap">
                  <table className="cashrep-anal__table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Пользователь</th>
                        <th>Сумма</th>
                        <th>Статус</th>
                        <th>Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesPaged.map((r, i) => (
                        <tr key={r?.id ?? `${(salesPage - 1) * PER_PAGE + i}`}>
                          <td>{(salesPage - 1) * PER_PAGE + i + 1}</td>
                          <td>{r?.user_display || "—"}</td>
                          <td>{nfMoney.format(num(r?.total))}</td>
                          <td>{r?.status || "—"}</td>
                          <td>
                            {r?.created_at
                              ? new Date(r.created_at).toLocaleString()
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager
                  total={salesFiltered.length}
                  page={salesPage}
                  perPage={PER_PAGE}
                  onPage={setSalesPage}
                />
              </>
            ) : (
              <div className="cashrep-anal__note">
                Нет продаж в выбранном периоде.
              </div>
            )}
          </div>
        </>
      )}

      {/* ---- INVENTORY ---- */}
      {activeTab === "inventory" && (
        <>
          <div className="cashrep-anal__kpis">
            <div className="cashrep-anal__kpi">
              <div className="cashrep-anal__kpi-label">Всего SKU</div>
              <div className="cashrep-anal__kpi-value">
                {nfInt.format(products.length)}
              </div>
            </div>
            <div className="cashrep-anal__kpi">
              <div className="cashrep-anal__kpi-label">Стоимость склада</div>
              <div className="cashrep-anal__kpi-value">
                {inventoryKPIs.stockValueByCost != null
                  ? nfMoney.format(inventoryKPIs.stockValueByCost)
                  : nfMoney.format(inventoryKPIs.stockValueByPrice)}
              </div>
            </div>
            <div className="cashrep-anal__kpi">
              <div className="cashrep-anal__kpi-label">Низкие остатки (≤5)</div>
              <div className="cashrep-anal__kpi-value">
                {nfInt.format(inventoryKPIs.lowStock)}
              </div>
            </div>
          </div>

          <div className="cashrep-anal__grid">
            <div className="cashrep-anal__card">
              <div className="cashrep-anal__card-title">
                Топ-10 категорий по кол-ву SKU
              </div>
              <ul className="cashrep-anal__bars">
                {topCategories.length ? (
                  topCategories.map(([name, count], i) => {
                    const max = topCategories[0][1] || 1;
                    const width = clamp(
                      Math.round((count / max) * 100),
                      5,
                      100
                    );
                    return (
                      <li className="cashrep-anal__bar" key={i}>
                        <span className="cashrep-anal__bar-name" title={name}>
                          {name}
                        </span>
                        <span className="cashrep-anal__bar-track">
                          <span
                            className="cashrep-anal__bar-fill"
                            style={{ width: `${width}%` }}
                          />
                        </span>
                        <span className="cashrep-anal__bar-value">
                          {nfInt.format(count)}
                        </span>
                      </li>
                    );
                  })
                ) : (
                  <li className="cashrep-anal__empty">Нет данных</li>
                )}
              </ul>
            </div>

            <div className="cashrep-anal__card">
              <div className="cashrep-anal__card-title">
                Топ-10 с минимальными остатками
              </div>
              <ul className="cashrep-anal__list">
                {lowStockList.length ? (
                  lowStockList.map((p, i) => (
                    <li className="cashrep-anal__row" key={p?.id ?? i}>
                      <span
                        className="cashrep-anal__row-name"
                        title={p?.name || "—"}
                      >
                        {p?.name || "—"}
                      </span>
                      <span className="cashrep-anal__row-qty">
                        Остаток: {nfInt.format(num(p?.quantity))}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="cashrep-anal__empty">Нет данных</li>
                )}
              </ul>
            </div>
          </div>

          <div className="cashrep-anal__card">
            <div className="cashrep-anal__card-title">
              ABC по стоимости запаса
            </div>
            <div className="cashrep-anal__abc">
              <div className="cashrep-anal__abc-badge cashrep-anal__abc-badge--a">
                A: {nfInt.format(abcStats.A)}
              </div>
              <div className="cashrep-anal__abc-badge cashrep-anal__abc-badge--b">
                B: {nfInt.format(abcStats.B)}
              </div>
              <div className="cashrep-anal__abc-badge cashrep-anal__abc-badge--c">
                C: {nfInt.format(abcStats.C)}
              </div>
            </div>
            <ul className="cashrep-anal__list">
              {abcStats.list.length ? (
                abcStats.list.map((it, i) => (
                  <li className="cashrep-anal__row" key={it.id ?? i}>
                    <span className="cashrep-anal__row-name" title={it.name}>
                      {it.name}
                    </span>
                    <span className="cashrep-anal__row-qty">
                      {it.tag} · {nfMoney.format(it.value)}
                    </span>
                  </li>
                ))
              ) : (
                <li className="cashrep-anal__empty">Нет данных</li>
              )}
            </ul>
            <p className="cashrep-anal__note">
              * Если есть <code>cost_price</code>, используем его. Иначе считаем
              по <code>price</code>.
            </p>
          </div>
        </>
      )}

      {/* ---- TAXONOMY ---- */}
      {activeTab === "taxonomy" && (
        <div className="cashrep-anal__grid">
          <div className="cashrep-anal__card">
            <div className="cashrep-anal__card-title">
              Бренды{" "}
              <span className="cashrep-anal__muted">
                (всего: {nfInt.format(brandStats.total)})
              </span>
            </div>
            <ul className="cashrep-anal__bars">
              {brandStats.top.length ? (
                brandStats.top.map(([name, count], i) => {
                  const max = brandStats.top[0][1] || 1;
                  const width = clamp(Math.round((count / max) * 100), 5, 100);
                  return (
                    <li className="cashrep-anal__bar" key={i}>
                      <span className="cashrep-anal__bar-name" title={name}>
                        {name}
                      </span>
                      <span className="cashrep-anal__bar-track">
                        <span
                          className="cashrep-anal__bar-fill"
                          style={{ width: `${width}%` }}
                        />
                      </span>
                      <span className="cashrep-anal__bar-value">
                        {nfInt.format(count)}
                      </span>
                    </li>
                  );
                })
              ) : (
                <li className="cashrep-anal__empty">Нет данных</li>
              )}
            </ul>
          </div>

          <div className="cashrep-anal__card">
            <div className="cashrep-anal__card-title">
              Категории{" "}
              <span className="cashrep-anal__muted">
                (всего: {nfInt.format(categoryStats.total)})
              </span>
            </div>
            <ul className="cashrep-anal__bars">
              {categoryStats.top.length ? (
                categoryStats.top.map(([name, count], i) => {
                  const max = categoryStats.top[0][1] || 1;
                  const width = clamp(Math.round((count / max) * 100), 5, 100);
                  return (
                    <li className="cashrep-anal__bar" key={i}>
                      <span className="cashrep-anal__bar-name" title={name}>
                        {name}
                      </span>
                      <span className="cashrep-anal__bar-track">
                        <span
                          className="cashrep-anal__bar-fill"
                          style={{ width: `${width}%` }}
                        />
                      </span>
                      <span className="cashrep-anal__bar-value">
                        {nfInt.format(count)}
                      </span>
                    </li>
                  );
                })
              ) : (
                <li className="cashrep-anal__empty">Нет данных</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* ---- CASHBOX ---- */}
      {activeTab === "cashbox" && (
        <>
          <div className="cashrep-anal__kpis">
            <div className="cashrep-anal__kpi">
              <div className="cashrep-anal__kpi-label">Приход</div>
              <div className="cashrep-anal__kpi-value">
                {nfMoney.format(cashTotals.income)}
              </div>
            </div>
            <div className="cashrep-anal__kpi">
              <div className="cashrep-anal__kpi-label">Расход</div>
              <div className="cashrep-anal__kpi-value">
                {nfMoney.format(cashTotals.expense)}
              </div>
            </div>
            <div className="cashrep-anal__kpi">
              <div className="cashrep-anal__kpi-label">Сальдо</div>
              <div className="cashrep-anal__kpi-value">
                {nfMoney.format(cashTotals.net)}
              </div>
            </div>
          </div>

          <div className="cashrep-anal__grid">
            <div className="cashrep-anal__card">
              <div className="cashrep-anal__card-title">
                Динамика чистого потока (
                {granularity === "day"
                  ? "дни"
                  : granularity === "month"
                  ? "месяцы"
                  : "годы"}
                )
              </div>
              {cashLoading ? (
                <div className="cashrep-anal__note">Загрузка операций…</div>
              ) : cashError ? (
                <div className="cashrep-anal__error">{cashError}</div>
              ) : (
                <>
                  <Sparkline values={cashSeries.netVals} />
                  <div className="cashrep-anal__legend">
                    {cashSeries.labels.map((l, i) => (
                      <span className="cashrep-anal__legend-item" key={i}>
                        {l}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="cashrep-anal__card">
              <div className="cashrep-anal__card-title">Срез по кассам</div>
              <div className="cashrep-anal__table-wrap">
                <table className="cashrep-anal__table">
                  <thead>
                    <tr>
                      <th>Касса</th>
                      <th>Приход</th>
                      <th>Расход</th>
                      <th>Сальдо</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perBox.length ? (
                      perBox.map((r) => (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td>{nfMoney.format(r.income)}</td>
                          <td>{nfMoney.format(r.expense)}</td>
                          <td>{nfMoney.format(r.net)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="cashrep-anal__empty">
                          Нет данных
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="cashrep-anal__card">
              <div className="cashrep-anal__card-title">
                Топ-10 статей расхода
              </div>
              <ul className="cashrep-anal__bars">
                {topExpenseByTitle.length ? (
                  topExpenseByTitle.map(([title, sum], i) => {
                    const max = topExpenseByTitle[0][1] || 1;
                    const width = clamp(Math.round((sum / max) * 100), 5, 100);
                    return (
                      <li className="cashrep-anal__bar" key={i}>
                        <span className="cashrep-anal__bar-name" title={title}>
                          {title}
                        </span>
                        <span className="cashrep-anal__bar-track">
                          <span
                            className="cashrep-anal__bar-fill"
                            style={{ width: `${width}%` }}
                          />
                        </span>
                        <span className="cashrep-anal__bar-value">
                          {nfMoney.format(sum)}
                        </span>
                      </li>
                    );
                  })
                ) : (
                  <li className="cashrep-anal__empty">Нет данных</li>
                )}
              </ul>
            </div>
          </div>

          <div className="cashrep-anal__card cashrep-anal__card--scroll">
            <div className="cashrep-anal__card-title">Последние операции</div>
            <div className="cashrep-anal__table-wrap">
              <table className="cashrep-anal__table">
                <thead>
                  <tr>
                    <th>Тип</th>
                    <th>Статья</th>
                    <th>Сумма</th>
                    <th>Касса</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {cashLoading ? (
                    <tr>
                      <td colSpan={5}>Загрузка…</td>
                    </tr>
                  ) : flowsFiltered.length ? (
                    cashOpsPaged.map((f, i) => (
                      <tr key={f.id ?? `${(cashOpsPage - 1) * PER_PAGE + i}`}>
                        <td>{f.type === "income" ? "Приход" : "Расход"}</td>
                        <td>{f.title}</td>
                        <td>{nfMoney.format(f.amount)}</td>
                        <td>{f.cashboxName || "—"}</td>
                        <td>
                          {f.created_at
                            ? new Date(f.created_at).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="cashrep-anal__empty">
                        Нет операций
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pager
              total={flowsFiltered.length}
              page={cashOpsPage}
              perPage={PER_PAGE}
              onPage={setCashOpsPage}
            />
          </div>

          {cashLoading && (
            <div className="cashrep-anal__loading">Обновляем операции…</div>
          )}
        </>
      )}

      {(productsLoading || salesLoading) && activeTab !== "cashbox" && (
        <div className="cashrep-anal__loading">Обновляем данные…</div>
      )}
    </div>
  );
};

/* =========================================================
   HOST: CashReports (верхние вкладки)
   ========================================================= */
const CashReports = () => {
  const [tab, setTab] = useState("report"); // report | cashbox | analytics
  return (
    <div className="cashrep">
      <div className="cashrep__switch">
        <button
          className={`cashrep__btn ${tab === "report" ? "is-active" : ""}`}
          onClick={() => setTab("report")}
        >
          Записи/Отчёты
        </button>
        <button
          className={`cashrep__btn ${tab === "cashbox" ? "is-active" : ""}`}
          onClick={() => setTab("cashbox")}
        >
          Касса
        </button>
        <button
          className={`cashrep__btn ${tab === "analytics" ? "is-active" : ""}`}
          onClick={() => setTab("analytics")}
        >
          Продажи/Склад
        </button>
      </div>

      <div className="cashrep__panel">
        {tab === "report" && <BarberCashReport />}
        {tab === "cashbox" && <CashboxTab />}
        {tab === "analytics" && <AnalyticsTab />}
      </div>
    </div>
  );
};

export default CashReports;
