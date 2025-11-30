// import React, { useMemo, useState, useEffect, useRef } from "react";
// import "./RecordaRates.scss";
// import { FaSync, FaTimes } from "react-icons/fa";
// import api from "../../../../../api";

// const PAGE_SIZE = 12;
// const pad2 = (n) => String(n).padStart(2, "0");
// const fmtInt = (n) => Number(n || 0).toLocaleString("ru-RU");
// const fmtMoney = (n) => `${Number(n || 0).toLocaleString("ru-RU")}с`;

// const MONTHS = [
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

// const KG_OFFSET_MS = 6 * 60 * 60 * 1000;
// const asArray = (d) =>
//   Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

// const isCompleted = (s) =>
//   String(s || "")
//     .trim()
//     .toLowerCase() === "completed";

// const y_m_fromISO = (iso) => {
//   if (!iso) return null;
//   const t = Date.parse(String(iso));
//   if (!Number.isFinite(t)) return null;
//   const d = new Date(t + KG_OFFSET_MS);
//   return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
// };
// const y_m_fromStartAt = y_m_fromISO;

// const dateKG = (iso) => {
//   const t = Date.parse(String(iso));
//   if (!Number.isFinite(t)) return "";
//   const d = new Date(t + KG_OFFSET_MS);
//   return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
//     d.getUTCDate()
//   )}`;
// };

// const toNum = (v) => {
//   if (v === "" || v == null) return 0;
//   const n = Number(String(v).replace(/[^\d.-]/g, ""));
//   return Number.isFinite(n) ? n : 0;
// };

// /* ===== кастомный селект ===== */
// const RRSelect = ({ value, onChange, options, placeholder }) => {
//   const [open, setOpen] = useState(false);
//   const ref = useRef(null);

//   useEffect(() => {
//     const handler = (e) => {
//       if (!ref.current) return;
//       if (!ref.current.contains(e.target)) setOpen(false);
//     };
//     document.addEventListener("mousedown", handler);
//     return () => document.removeEventListener("mousedown", handler);
//   }, []);

//   const current =
//     options.find((o) => String(o.value) === String(value)) || null;

//   const handleSelect = (val) => {
//     onChange?.(val);
//     setOpen(false);
//   };

//   return (
//     <div className="rr-select" ref={ref}>
//       <button
//         type="button"
//         className={`rr-select__control ${
//           open ? "rr-select__control--open" : ""
//         }`}
//         onClick={() => setOpen((o) => !o)}
//       >
//         <span className="rr-select__value">
//           {current ? current.label : placeholder}
//         </span>
//         <span
//           className={`rr-select__arrow ${
//             open ? "rr-select__arrow--open" : ""
//           }`}
//         />
//       </button>

//       {open && (
//         <div className="rr-select__dropdown">
//           <ul className="rr-select__list">
//             {options.map((opt) => (
//               <li
//                 key={opt.value}
//                 className={`rr-select__option ${
//                   String(opt.value) === String(value)
//                     ? "rr-select__option--active"
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

// /* ===== модалка "Дни" ===== */
// const DaysModal = ({ open, onClose, title, rows }) => {
//   if (!open) return null;
//   return (
//     <div
//       className="recordarates__overlay"
//       onClick={onClose}
//       role="dialog"
//       aria-modal="true"
//     >
//       <div className="recordarates__modal" onClick={(e) => e.stopPropagation()}>
//         <div className="recordarates__modalHead">
//           <h4 className="recordarates__modalTitle">{title}</h4>
//           <button
//             type="button"
//             className="recordarates__iconBtn"
//             aria-label="Закрыть"
//             onClick={onClose}
//           >
//             <FaTimes />
//           </button>
//         </div>

//         <div className="recordarates__tableWrap recordarates__tableWrap--modal">
//           <table className="recordarates__table">
//             <thead>
//               <tr>
//                 <th>Дата</th>
//                 <th>Завершено</th>
//                 <th>Выручка</th>
//                 <th>К выплате</th>
//               </tr>
//             </thead>
//             <tbody>
//               {rows.length === 0 ? (
//                 <tr>
//                   <td className="recordarates__muted" colSpan={4}>
//                     Нет данных
//                   </td>
//                 </tr>
//               ) : (
//                 rows.map((r) => (
//                   <tr key={r.date}>
//                     <td>{r.date}</td>
//                     <td>{fmtInt(r.completed)}</td>
//                     <td>{fmtMoney(r.revenue)}</td>
//                     <td>
//                       <b>{fmtMoney(r.payout)}</b>
//                     </td>
//                   </tr>
//                 ))
//               )}
//             </tbody>
//           </table>
//         </div>

//         <div className="recordarates__modalFoot">
//           <button
//             type="button"
//             className="recordarates__btn recordarates__btn--secondary"
//             onClick={onClose}
//           >
//             Закрыть
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// /* ===== модалка "Товарные продажи" ===== */
// const ProductSaleModal = ({
//   open,
//   onClose,
//   employeeId,
//   employeeName,
//   employees,
//   products,
//   payouts,
//   loading,
//   error,
//   saving,
//   onCreate,
//   periodLabel,
// }) => {
//   const [tab, setTab] = useState("list");
//   const [form, setForm] = useState({
//     employee: "",
//     product: "",
//     percent: "",
//   });
//   const [localError, setLocalError] = useState("");

//   useEffect(() => {
//     if (!open) return;
//     setTab("list");
//     setLocalError("");

//     const defaultEmployee =
//       String(employeeId || "") ||
//       (employees.length ? String(employees[0].id) : "");

//     const firstProduct = products && products.length ? products[0] : null;
//     const defaultProductId = firstProduct ? String(firstProduct.id) : "";

//     setForm({
//       employee: defaultEmployee,
//       product: defaultProductId,
//       percent: "",
//     });
//   }, [open, employeeId, employees, products]);

//   if (!open) return null;

//   const handleChange = (field, value) => {
//     setForm((prev) => ({ ...prev, [field]: value }));
//   };

//   // текущий товар и его цена
//   const selectedProduct =
//     products.find((p) => String(p.id) === String(form.product)) || null;
//   const productPrice = selectedProduct ? Number(selectedProduct.price || 0) : 0;

//   const percentNum = Math.min(
//     100,
//     Math.max(0, toNum(form.percent || 0) || 0)
//   );
//   const payoutPreview = Math.round((productPrice * percentNum) / 100); // СКОЛЬКО ПОЛУЧАЕТ СОТРУДНИК

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setLocalError("");

//     if (!form.product || !form.employee) {
//       setLocalError("Выберите товар и сотрудника.");
//       return;
//     }
//     if (!percentNum) {
//       setLocalError("Укажите процент.");
//       return;
//     }
//     if (!productPrice) {
//       setLocalError("У выбранного товара не задана цена.");
//       return;
//     }

//     try {
//       await onCreate({
//         employeeId: form.employee,
//         productId: form.product,
//         percent: percentNum,
//         // от этой суммы считается процент (цена товара),
//         // НЕ сумма сотрудника
//         price: productPrice,
//       });
//       setForm((prev) => ({ ...prev, percent: "" }));
//       setTab("list");
//     } catch {
//       setLocalError("Не удалось сохранить продажу товара.");
//     }
//   };

//   return (
//     <div
//       className="recordarates__overlay"
//       onClick={onClose}
//       role="dialog"
//       aria-modal="true"
//     >
//       <div className="recordarates__modal" onClick={(e) => e.stopPropagation()}>
//         <div className="recordarates__modalHead">
//           <h4 className="recordarates__modalTitle">
//             Товарные продажи — {periodLabel} — {employeeName}
//           </h4>
//           <button
//             type="button"
//             className="recordarates__iconBtn"
//             aria-label="Закрыть"
//             onClick={onClose}
//           >
//             <FaTimes />
//           </button>
//         </div>

//         <div className="recordarates__productTabs">
//           <button
//             type="button"
//             className={`recordarates__productTab ${
//               tab === "list" ? "recordarates__productTab--active" : ""
//             }`}
//             onClick={() => setTab("list")}
//           >
//             Список
//           </button>
//           <button
//             type="button"
//             className={`recordarates__productTab ${
//               tab === "sale" ? "recordarates__productTab--active" : ""
//             }`}
//             onClick={() => setTab("sale")}
//           >
//             Продажа
//           </button>
//         </div>

//         {(error || localError) && (
//           <div className="recordarates__alert">
//             {localError || error}
//           </div>
//         )}

//         {tab === "list" ? (
//           <div className="recordarates__tableWrap recordarates__tableWrap--modal">
//             <table className="recordarates__table">
//               <thead>
//                 <tr>
//                   <th>Дата</th>
//                   <th>Товар</th>
//                   <th>Сотрудник</th>
//                   <th>Цена</th>
//                   <th>Процент</th>
//                   <th>К выплате</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {loading ? (
//                   <tr>
//                     <td className="recordarates__muted" colSpan={6}>
//                       Загрузка…
//                     </td>
//                   </tr>
//                 ) : payouts.length === 0 ? (
//                   <tr>
//                     <td className="recordarates__muted" colSpan={6}>
//                       Нет продаж по товарам.
//                     </td>
//                   </tr>
//                 ) : (
//                   payouts.map((p) => (
//                     <tr key={p.id}>
//                       <td>{dateKG(p.created_at)}</td>
//                       <td>{p.product_name}</td>
//                       <td>{p.employee_name}</td>
//                       <td>{fmtMoney(p.price)}</td>
//                       <td>{`${p.percent}%`}</td>
//                       <td>
//                         <b>{fmtMoney(p.payout_amount)}</b>
//                       </td>
//                     </tr>
//                   ))
//                 )}
//               </tbody>
//             </table>
//           </div>
//         ) : (
//           <form
//             className="recordarates__productForm"
//             onSubmit={handleSubmit}
//             autoComplete="off"
//           >
//             <div className="recordarates__productRow">
//               <div className="recordarates__productField">
//                 <span className="recordarates__productLabel">Товар</span>
//                 <RRSelect
//                   value={form.product}
//                   onChange={(val) => handleChange("product", val)}
//                   options={
//                     products.length
//                       ? products.map((p) => ({
//                           value: String(p.id),
//                           // здесь сразу показываем цену: dko — 500с
//                           label: `${p.name} — ${fmtMoney(p.price)}`,
//                         }))
//                       : [{ value: "", label: "Нет товаров" }]
//                   }
//                   placeholder="Выберите товар"
//                 />
//               </div>

//               <div className="recordarates__productField">
//                 <span className="recordarates__productLabel">Сотрудник</span>
//                 <RRSelect
//                   value={form.employee}
//                   onChange={(val) => handleChange("employee", val)}
//                   options={employees.map((e) => ({
//                     value: String(e.id),
//                     label: e.name,
//                   }))}
//                   placeholder="Сотрудник"
//                 />
//               </div>
//             </div>

//             <div className="recordarates__productRow">
//               <div className="recordarates__productField">
//                 <span className="recordarates__productLabel">Процент %</span>
//                 <input
//                   className="recordarates__productInput"
//                   type="text"
//                   inputMode="numeric"
//                   pattern="[0-9]*"
//                   value={form.percent}
//                   onChange={(e) => handleChange("percent", e.target.value)}
//                   placeholder="0-100"
//                   required
//                 />
//               </div>

//               <div className="recordarates__productField">
//                 <span className="recordarates__productLabel">
//                   Сумма сотруднику
//                 </span>
//                 <input
//                   className="recordarates__productInput"
//                   type="text"
//                   value={payoutPreview ? fmtInt(payoutPreview) : 0}
//                   readOnly
//                   disabled
//                 />
//               </div>
//             </div>

//             <div className="recordarates__productFooter">
//               <button
//                 type="submit"
//                 className="recordarates__btn recordarates__btn--primary"
//                 disabled={saving || loading}
//               >
//                 {saving ? "Сохранение…" : "Сохранить продажу"}
//               </button>
//             </div>
//           </form>
//         )}
//       </div>
//     </div>
//   );
// };

// /* ===== основной компонент ===== */

// const RecordaRates = ({
//   year,
//   month,
//   onChangeYear,
//   onChangeMonth,
//   employees = [],
//   appointments = [],
//   _services = [],
//   rates = {},
//   ratesLoading = false,
//   ratesError = "",
//   onChangeRate,
//   onSaveRates,
// }) => {
//   const [page, setPage] = useState(1);
//   const [draftRates, setDraftRates] = useState({});
//   const [daysModal, setDaysModal] = useState({
//     open: false,
//     title: "",
//     rows: [],
//   });

//   const [productModal, setProductModal] = useState({
//     open: false,
//     employeeId: "",
//     employeeName: "",
//   });
//   const [products, setProducts] = useState([]);
//   const [productSales, setProductSales] = useState([]);
//   const [productDataLoading, setProductDataLoading] = useState(false);
//   const [productDataError, setProductDataError] = useState("");
//   const [productSaving, setProductSaving] = useState(false);

//   const period = `${year}-${pad2(month)}`;

//   useEffect(() => {
//     setDraftRates({});
//     setPage(1);
//   }, [period]);

//   useEffect(() => {
//     setDraftRates((prev) => {
//       const next = { ...prev };
//       for (const barberId of Object.keys(rates || {})) {
//         const r = rates[barberId] || {};
//         next[barberId] = next[barberId] || {};
//         next[barberId][period] = {
//           perRecord:
//             r.perRecord === "" || r.perRecord == null
//               ? 0
//               : Number(r.perRecord) || 0,
//           fixed:
//             r.fixed === "" || r.fixed == null ? 0 : Number(r.fixed) || 0,
//           percent:
//             r.percent == null && r.perPercent == null && r.perMonth != null
//               ? Number(r.perMonth) || 0
//               : Number(r.percent ?? r.perPercent ?? 0) || 0,
//         };
//       }
//       return next;
//     });
//   }, [period, rates]);

//   const normalizedEmployees = useMemo(() => {
//     const seen = new Set();
//     const arr = [];
//     for (const e of Array.isArray(employees) ? employees : []) {
//       const id = String(e?.id ?? "");
//       if (!id || seen.has(id)) continue;
//       seen.add(id);
//       arr.push({ id, name: e?.name || "—" });
//     }
//     return arr.sort((a, b) => a.name.localeCompare(b.name, "ru"));
//   }, [employees]);

//   const doneByMaster = useMemo(() => {
//     const map = new Map();
//     for (const a of Array.isArray(appointments) ? appointments : []) {
//       if (!isCompleted(a?.status)) continue;
//       const ym = y_m_fromStartAt(a?.start_at);
//       if (!ym || ym.y !== Number(year) || ym.m !== Number(month)) continue;
//       const key = String(a?.barber ?? a?.employee ?? a?.master ?? "");
//       if (!key) continue;
//       map.set(key, (map.get(key) || 0) + 1);
//     }
//     return map;
//   }, [appointments, year, month]);

//   const revenueByMaster = useMemo(() => {
//     const map = new Map();
//     for (const a of Array.isArray(appointments) ? appointments : []) {
//       if (!isCompleted(a?.status)) continue;
//       const ym = y_m_fromStartAt(a?.start_at);
//       if (!ym || ym.y !== Number(year) || ym.m !== Number(month)) continue;
//       const key = String(a?.barber ?? a?.employee ?? a?.master ?? "");
//       if (!key) continue;
//       const price = toNum(a?.price);
//       map.set(key, (map.get(key) || 0) + price);
//     }
//     return map;
//   }, [appointments, year, month]);

//   const daysByMaster = useMemo(() => {
//     const m = new Map();
//     for (const a of Array.isArray(appointments) ? appointments : []) {
//       if (!isCompleted(a?.status)) continue;
//       const ym = y_m_fromStartAt(a?.start_at);
//       if (!ym || ym.y !== Number(year) || ym.m !== Number(month)) continue;
//       const empId = String(a?.barber ?? a?.employee ?? a?.master ?? "");
//       if (!empId) continue;
//       const day = dateKG(a?.start_at);
//       const inner = m.get(empId) || new Map();
//       const prev = inner.get(day) || { records: 0, revenue: 0 };
//       const price = toNum(a?.price);
//       inner.set(day, {
//         records: prev.records + 1,
//         revenue: prev.revenue + price,
//       });
//       m.set(empId, inner);
//     }
//     return m;
//   }, [appointments, year, month]);

//   const getDraft = (draft, barberId, periodKey) =>
//     draft?.[barberId]?.[periodKey] || {};

//   const rows = useMemo(
//     () =>
//       normalizedEmployees.map((e) => {
//         const base = rates[e.id] || {};
//         const draft = getDraft(draftRates, e.id, period);

//         const perRecord =
//           draft.perRecord ??
//           (base.perRecord === "" || base.perRecord == null
//             ? 0
//             : Number(base.perRecord) || 0);

//         const fixed =
//           draft.fixed ??
//           (base.fixed === "" || base.fixed == null
//             ? 0
//             : Number(base.fixed) || 0);

//         const percent =
//           draft.percent ??
//           (base.percent == null &&
//           base.perPercent == null &&
//           base.perMonth != null
//             ? Number(base.perMonth) || 0
//             : Number(base.percent ?? base.perPercent ?? 0) || 0);

//         const completed = Number(doneByMaster.get(String(e.id)) || 0);
//         const revenue = Number(revenueByMaster.get(String(e.id)) || 0);

//         const total =
//           completed * (Number(perRecord) || 0) +
//           (Number(fixed) || 0) +
//           Math.round((revenue * (Number(percent) || 0)) / 100);

//         return {
//           id: e.id,
//           name: e.name,
//           completed,
//           revenue,
//           perRecord,
//           fixed,
//           percent,
//           total,
//         };
//       }),
//     [normalizedEmployees, rates, draftRates, doneByMaster, revenueByMaster, period]
//   );

//   const totals = useMemo(
//     () => rows.reduce((acc, r) => acc + Number(r.total || 0), 0),
//     [rows]
//   );

//   const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
//   const safePage = Math.min(Math.max(1, page), totalPages);
//   const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

//   const handleRateChange = (barberId, field, raw) => {
//     const clampMoney = (v, max = 10_000_000) => {
//       if (v === "" || v == null) return "";
//       const n = toNum(v);
//       if (!Number.isFinite(n) || n < 0) return 0;
//       return Math.min(Math.round(n), max);
//     };
//     const clampPercent = (v) => {
//       if (v === "" || v == null) return "";
//       const n = toNum(v);
//       if (!Number.isFinite(n) || n < 0) return 0;
//       return Math.min(Math.round(n), 100);
//     };

//     const nextVal =
//       field === "percent" ? clampPercent(raw) : clampMoney(raw);

//     setDraftRates((prev) => {
//       const byUser = { ...(prev[barberId] || {}) };
//       byUser[period] = { ...(byUser[period] || {}), [field]: nextVal };
//       return { ...prev, [barberId]: byUser };
//     });

//     onChangeRate?.(barberId, field, nextVal);
//   };

//   const handleSave = () => {
//     onSaveRates?.({
//       perRecordPeriod: period,
//       percentPeriods: [period],
//     });
//   };

//   const openDays = (row) => {
//     const perRecord = Number(row.perRecord) || 0;
//     const percent = Number(row.percent) || 0;
//     const map = daysByMaster.get(String(row.id)) || new Map();
//     const list = Array.from(map, ([date, v]) => {
//       const payout =
//         v.records * perRecord +
//         Math.round((v.revenue * percent) / 100);
//       return { date, completed: v.records, revenue: v.revenue, payout };
//     }).sort((a, b) => a.date.localeCompare(b.date));
//     setDaysModal({ open: true, title: `${row.name} — ${period}`, rows: list });
//   };
//   const closeDays = () =>
//     setDaysModal((p) => ({
//       ...p,
//       open: false,
//     }));

//   const loadProductData = async () => {
//     setProductDataLoading(true);
//     setProductDataError("");

//     try {
//       const prodRes = await api.get("/main/products/list/");
//       const rawProducts = asArray(prodRes.data);
//       const mapped = rawProducts.map((p) => ({
//         id: String(p.id),
//         name: p.name || p.product_name || p.title || "Без названия",
//         price: Number(p.price || 0),
//       }));
//       setProducts(mapped);
//     } catch {
//       setProductDataError("Не удалось загрузить список товаров.");
//     } finally {
//       setProductDataLoading(false);
//     }

//     try {
//       const salesRes = await api.get("/barbershop/product-sale-payouts/");
//       setProductSales(asArray(salesRes.data));
//     } catch {
//       /* просто нет продаж */
//     }
//   };

//   const handleCreateProductSale = async ({
//     employeeId,
//     productId,
//     percent,
//     price,
//   }) => {
//     try {
//       setProductSaving(true);
//       setProductDataError("");
//       const payload = {
//         employee: employeeId,
//         product: productId,
//         percent: String(percent),
//         // цена товара, от которой бэкенд посчитает payout_amount
//         price: String(price),
//       };
//       const { data } = await api.post(
//         "/barbershop/product-sale-payouts/",
//         payload
//       );
//       setProductSales((prev) => [data, ...prev]);
//     } catch {
//       setProductDataError("Не удалось сохранить продажу товара.");
//       throw new Error("save error");
//     } finally {
//       setProductSaving(false);
//     }
//   };

//   const openProductModal = (row) => {
//     setProductModal({
//       open: true,
//       employeeId: row.id,
//       employeeName: row.name,
//     });
//     if (!products.length && !productSales.length) {
//       loadProductData();
//     }
//   };
//   const closeProductModal = () =>
//     setProductModal((p) => ({
//       ...p,
//       open: false,
//     }));

//   const productPayoutsForModal = useMemo(() => {
//     if (!productModal.employeeId) return [];
//     return productSales
//       .filter((p) => {
//         if (String(p.employee) !== String(productModal.employeeId)) return false;
//         const ym = y_m_fromISO(p.created_at);
//         if (!ym) return false;
//         return ym.y === Number(year) && ym.m === Number(month);
//       })
//       .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
//   }, [productSales, productModal.employeeId, year, month]);

//   const yearOptions = useMemo(() => {
//     const set = new Set([year - 1, year, year + 1]);
//     set.delete(2024);
//     return [...set].sort((a, b) => a - b);
//   }, [year]);

//   return (
//     <section className="recordarates" aria-label="Выплаты мастерам">
//       <header className="recordarates__header">
//         <div className="recordarates__filters">
//           <label className="recordarates__filter">
//             <span className="recordarates__filterLabel">Месяц</span>
//             <RRSelect
//               value={String(month)}
//               onChange={(val) => {
//                 onChangeMonth?.(Number(val));
//                 setPage(1);
//               }}
//               options={MONTHS.map((m, i) => ({
//                 value: String(i + 1),
//                 label: m,
//               }))}
//               placeholder="Месяц"
//             />
//           </label>

//           <label className="recordarates__filter">
//             <span className="recordarates__filterLabel">Год</span>
//             <RRSelect
//               value={String(year)}
//               onChange={(val) => {
//                 onChangeYear?.(Number(val));
//                 setPage(1);
//               }}
//               options={yearOptions.map((y) => ({
//                 value: String(y),
//                 label: String(y),
//               }))}
//               placeholder="Год"
//             />
//           </label>
//         </div>

//         <button
//           className="recordarates__btn recordarates__btn--primary"
//           onClick={handleSave}
//           disabled={ratesLoading}
//           type="button"
//         >
//           <FaSync />
//           <span className="recordarates__btnText">
//             {ratesLoading ? "Сохранение…" : "Сохранить ставки"}
//           </span>
//         </button>
//       </header>

//       {ratesError && <div className="recordarates__alert">{ratesError}</div>}

//       <div className="recordarates__tableWrap">
//         <table className="recordarates__table">
//           <thead>
//             <tr>
//               <th>Мастер</th>
//               <th>Завершено</th>
//               <th>Запись</th>
//               <th>Фикс.</th>
//               <th>%</th>
//               <th>Выручка</th>
//               <th>К выплате</th>
//               <th>Действия</th>
//             </tr>
//           </thead>
//           <tbody>
//             {visible.map((r) => (
//               <tr key={r.id}>
//                 <td>{r.name}</td>
//                 <td>{fmtInt(r.completed)}</td>
//                 <td>
//                   <input
//                     className="recordarates__numInput"
//                     type="text"
//                     inputMode="numeric"
//                     pattern="[0-9]*"
//                     value={r.perRecord}
//                     onChange={(e) =>
//                       handleRateChange(r.id, "perRecord", e.target.value)
//                     }
//                   />
//                 </td>
//                 <td>
//                   <input
//                     className="recordarates__numInput"
//                     type="text"
//                     inputMode="numeric"
//                     pattern="[0-9]*"
//                     value={r.fixed}
//                     onChange={(e) =>
//                       handleRateChange(r.id, "fixed", e.target.value)
//                     }
//                   />
//                 </td>
//                 <td>
//                   <input
//                     className="recordarates__numInput"
//                     type="text"
//                     inputMode="numeric"
//                     pattern="[0-9]*"
//                     value={r.percent}
//                     onChange={(e) =>
//                       handleRateChange(r.id, "percent", e.target.value)
//                     }
//                   />
//                 </td>
//                 <td>{fmtMoney(r.revenue)}</td>
//                 <td>
//                   <b>{fmtMoney(r.total)}</b>
//                 </td>
//                 <td>
//                   <div className="recordarates__actions">
//                     <button
//                       type="button"
//                       className="recordarates__link"
//                       onClick={() => openDays(r)}
//                     >
//                       Дни
//                     </button>
//                     <button
//                       type="button"
//                       className="recordarates__link"
//                       onClick={() => openProductModal(r)}
//                     >
//                       Товар
//                     </button>
//                   </div>
//                 </td>
//               </tr>
//             ))}
//             {!visible.length && (
//               <tr>
//                 <td className="recordarates__muted" colSpan={8}>
//                   Нет мастеров.
//                 </td>
//               </tr>
//             )}
//           </tbody>
//         </table>
//       </div>

//       {rows.length > PAGE_SIZE && (
//         <nav className="recordarates__pager" aria-label="Пагинация">
//           <button
//             className="recordarates__pageBtn"
//             onClick={() => setPage((p) => Math.max(1, p - 1))}
//             disabled={safePage === 1}
//             type="button"
//           >
//             Назад
//           </button>
//           <span className="recordarates__pageInfo">
//             Стр. {safePage}/{totalPages}
//           </span>
//           <button
//             className="recordarates__pageBtn"
//             onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
//             disabled={safePage === totalPages}
//             type="button"
//           >
//             Далее
//           </button>
//         </nav>
//       )}

//       <div className="recordarates__summary">
//         <span className="recordarates__summaryLabel">
//           Итого фонд выплат:
//         </span>
//         <span className="recordarates__summaryValue">
//           {fmtMoney(totals)}
//         </span>
//       </div>

//       <DaysModal
//         open={daysModal.open}
//         onClose={closeDays}
//         title={daysModal.title}
//         rows={daysModal.rows}
//       />

//       <ProductSaleModal
//         open={productModal.open}
//         onClose={closeProductModal}
//         employeeId={productModal.employeeId}
//         employeeName={productModal.employeeName}
//         employees={normalizedEmployees}
//         products={products}
//         payouts={productPayoutsForModal}
//         loading={productDataLoading}
//         error={productDataError}
//         saving={productSaving}
//         onCreate={handleCreateProductSale}
//         periodLabel={`${year}-${pad2(month)}`}
//       />
//     </section>
//   );
// };

// export default RecordaRates;




// // RecordaRates.jsx
// import React, { useEffect, useMemo, useState } from "react";
// import "./RecordaRates.scss";
// import { FaSync } from "react-icons/fa";
// import api from "../../../../../api";

// import { RRSelect } from "./RecordaRatesSelect";
// import DaysModal from "./RecordaRatesDaysModal";
// import ProductSaleModal from "./RecordaRatesProductSaleModal";

// import {
//   PAGE_SIZE,
//   pad2,
//   fmtInt,
//   fmtMoney,
//   asArray,
//   toNum,
//   y_m_fromISO,
//   dateKG,
// } from "./RecordaRates.utils";
// import { useMasterAggregates, useYearOptions } from "./RecordaRates.hooks";

// const MONTHS = [
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

// const getDraft = (draft, barberId, periodKey) =>
//   draft?.[barberId]?.[periodKey] || {};

// const RecordaRates = ({
//   year,
//   month,
//   onChangeYear,
//   onChangeMonth,
//   employees = [],
//   appointments = [],
//   _services = [],
//   rates = {},
//   ratesLoading = false,
//   ratesError = "",
//   onChangeRate,
//   onSaveRates,
// }) => {
//   const [page, setPage] = useState(1);
//   const [draftRates, setDraftRates] = useState({});
//   const [daysModal, setDaysModal] = useState({
//     open: false,
//     title: "",
//     rows: [],
//   });

//   const [productModal, setProductModal] = useState({
//     open: false,
//     employeeId: "",
//     employeeName: "",
//   });
//   const [products, setProducts] = useState([]);
//   const [productSales, setProductSales] = useState([]);
//   const [productDataLoading, setProductDataLoading] = useState(false);
//   const [productDataError, setProductDataError] = useState("");
//   const [productSaving, setProductSaving] = useState(false);

//   const period = `${year}-${pad2(month)}`;

//   useEffect(() => {
//     setDraftRates({});
//     setPage(1);
//   }, [period]);

//   useEffect(() => {
//     setDraftRates((prev) => {
//       const next = { ...prev };
//       for (const barberId of Object.keys(rates || {})) {
//         const r = rates[barberId] || {};
//         next[barberId] = next[barberId] || {};
//         next[barberId][period] = {
//           perRecord:
//             r.perRecord === "" || r.perRecord == null
//               ? 0
//               : Number(r.perRecord) || 0,
//           fixed:
//             r.fixed === "" || r.fixed == null ? 0 : Number(r.fixed) || 0,
//           percent:
//             r.percent == null && r.perPercent == null && r.perMonth != null
//               ? Number(r.perMonth) || 0
//               : Number(r.percent ?? r.perPercent ?? 0) || 0,
//         };
//       }
//       return next;
//     });
//   }, [period, rates]);

//   const normalizedEmployees = useMemo(() => {
//     const seen = new Set();
//     const arr = [];
//     for (const e of Array.isArray(employees) ? employees : []) {
//       const id = String(e?.id ?? "");
//       if (!id || seen.has(id)) continue;
//       seen.add(id);
//       arr.push({ id, name: e?.name || "—" });
//     }
//     return arr.sort((a, b) => a.name.localeCompare(b.name, "ru"));
//   }, [employees]);

//   const { doneByMaster, revenueByMaster, daysByMaster } =
//     useMasterAggregates(appointments, year, month);

//   const rows = useMemo(
//     () =>
//       normalizedEmployees.map((e) => {
//         const base = rates[e.id] || {};
//         const draft = getDraft(draftRates, e.id, period);

//         const perRecord =
//           draft.perRecord ??
//           (base.perRecord === "" || base.perRecord == null
//             ? 0
//             : Number(base.perRecord) || 0);

//         const fixed =
//           draft.fixed ??
//           (base.fixed === "" || base.fixed == null
//             ? 0
//             : Number(base.fixed) || 0);

//         const percent =
//           draft.percent ??
//           (base.percent == null &&
//           base.perPercent == null &&
//           base.perMonth != null
//             ? Number(base.perMonth) || 0
//             : Number(base.percent ?? base.perPercent ?? 0) || 0);

//         const completed = Number(doneByMaster.get(String(e.id)) || 0);
//         const revenue = Number(revenueByMaster.get(String(e.id)) || 0);

//         const total =
//           completed * (Number(perRecord) || 0) +
//           (Number(fixed) || 0) +
//           Math.round((revenue * (Number(percent) || 0)) / 100);

//         return {
//           id: e.id,
//           name: e.name,
//           completed,
//           revenue,
//           perRecord,
//           fixed,
//           percent,
//           total,
//         };
//       }),
//     [normalizedEmployees, rates, draftRates, doneByMaster, revenueByMaster, period]
//   );

//   const totals = useMemo(
//     () => rows.reduce((acc, r) => acc + Number(r.total || 0), 0),
//     [rows]
//   );

//   const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
//   const safePage = Math.min(Math.max(1, page), totalPages);
//   const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

//   const handleRateChange = (barberId, field, raw) => {
//     const clampMoney = (v, max = 10_000_000) => {
//       if (v === "" || v == null) return "";
//       const n = toNum(v);
//       if (!Number.isFinite(n) || n < 0) return 0;
//       return Math.min(Math.round(n), max);
//     };
//     const clampPercent = (v) => {
//       if (v === "" || v == null) return "";
//       const n = toNum(v);
//       if (!Number.isFinite(n) || n < 0) return 0;
//       return Math.min(Math.round(n), 100);
//     };

//     const nextVal =
//       field === "percent" ? clampPercent(raw) : clampMoney(raw);

//     setDraftRates((prev) => {
//       const byUser = { ...(prev[barberId] || {}) };
//       byUser[period] = { ...(byUser[period] || {}), [field]: nextVal };
//       return { ...prev, [barberId]: byUser };
//     });

//     onChangeRate?.(barberId, field, nextVal);
//   };

//   const handleSave = () => {
//     onSaveRates?.({
//       perRecordPeriod: period,
//       percentPeriods: [period],
//     });
//   };

//   const openDays = (row) => {
//     const perRecord = Number(row.perRecord) || 0;
//     const percent = Number(row.percent) || 0;
//     const map = daysByMaster.get(String(row.id)) || new Map();
//     const list = Array.from(map, ([date, v]) => {
//       const payout =
//         v.records * perRecord +
//         Math.round((v.revenue * percent) / 100);
//       return { date, completed: v.records, revenue: v.revenue, payout };
//     }).sort((a, b) => a.date.localeCompare(b.date));
//     setDaysModal({ open: true, title: `${row.name} — ${period}`, rows: list });
//   };

//   const closeDays = () =>
//     setDaysModal((p) => ({
//       ...p,
//       open: false,
//     }));

//   const loadProductData = async () => {
//     setProductDataLoading(true);
//     setProductDataError("");

//     try {
//       const prodRes = await api.get("/main/products/list/");
//       const rawProducts = asArray(prodRes.data);
//       const mapped = rawProducts.map((p) => ({
//         id: String(p.id),
//         name: p.name || p.product_name || p.title || "Без названия",
//         price: Number(p.price || 0),
//       }));
//       setProducts(mapped);
//     } catch {
//       setProductDataError("Не удалось загрузить список товаров.");
//     }

//     try {
//       const salesRes = await api.get("/barbershop/product-sale-payouts/");
//       setProductSales(asArray(salesRes.data));
//     } catch {
//       // просто нет продаж или ошибка — покажем пустой список
//     } finally {
//       setProductDataLoading(false);
//     }
//   };

//   const handleCreateProductSale = async ({
//     employeeId,
//     productId,
//     percent,
//     price,
//   }) => {
//     try {
//       setProductSaving(true);
//       setProductDataError("");
//       const payload = {
//         employee: employeeId,
//         product: productId,
//         percent: String(percent),
//         price: String(price),
//       };
//       const { data } = await api.post(
//         "/barbershop/product-sale-payouts/",
//         payload
//       );
//       setProductSales((prev) => [data, ...prev]);
//     } catch {
//       setProductDataError("Не удалось сохранить продажу товара.");
//       throw new Error("save error");
//     } finally {
//       setProductSaving(false);
//     }
//   };

//   const openProductModal = (row) => {
//     setProductModal({
//       open: true,
//       employeeId: row.id,
//       employeeName: row.name,
//     });
//     // ВСЕГДА грузим актуальные данные по товарам и продажам
//     loadProductData();
//   };

//   const closeProductModal = () =>
//     setProductModal((p) => ({
//       ...p,
//       open: false,
//     }));

//   const productPayoutsForModal = useMemo(() => {
//     if (!productSales.length) return [];

//     return productSales
//       .filter((p) => {
//         const ym = y_m_fromISO(p.created_at);
//         if (!ym) return false;
//         const samePeriod =
//           ym.y === Number(year) && ym.m === Number(month);
//         if (!samePeriod) return false;

//         if (!productModal.employeeId) return true;

//         // Пытаемся сопоставить и по id, и по имени,
//         // чтобы избежать расхождений типов id.
//         const sameEmployeeId =
//           String(p.employee) === String(productModal.employeeId);
//         const sameEmployeeName =
//           String(p.employee_name || "").trim() ===
//           String(productModal.employeeName || "").trim();

//         return sameEmployeeId || sameEmployeeName;
//       })
//       .sort((a, b) =>
//         String(b.created_at).localeCompare(String(a.created_at))
//       )
//       .map((p) => ({
//         ...p,
//         dateFormatted: dateKG(p.created_at),
//       }));
//   }, [productSales, productModal.employeeId, productModal.employeeName, year, month]);

//   const yearOptions = useYearOptions(year);

//   return (
//     <section className="recordarates" aria-label="Выплаты мастерам">
//       <header className="recordarates__header">
//         <div className="recordarates__filters">
//           <label className="recordarates__filter">
//             <span className="recordarates__filterLabel">Месяц</span>
//             <RRSelect
//               value={String(month)}
//               onChange={(val) => {
//                 onChangeMonth?.(Number(val));
//                 setPage(1);
//               }}
//               options={MONTHS.map((m, i) => ({
//                 value: String(i + 1),
//                 label: m,
//               }))}
//               placeholder="Месяц"
//             />
//           </label>

//           <label className="recordarates__filter">
//             <span className="recordarates__filterLabel">Год</span>
//             <RRSelect
//               value={String(year)}
//               onChange={(val) => {
//                 onChangeYear?.(Number(val));
//                 setPage(1);
//               }}
//               options={yearOptions.map((y) => ({
//                 value: String(y),
//                 label: String(y),
//               }))}
//               placeholder="Год"
//             />
//           </label>
//         </div>

//         <button
//           className="recordarates__btn recordarates__btn--primary"
//           onClick={handleSave}
//           disabled={ratesLoading}
//           type="button"
//         >
//           <FaSync />
//           <span className="recordarates__btnText">
//             {ratesLoading ? "Сохранение…" : "Сохранить ставки"}
//           </span>
//         </button>
//       </header>

//       {ratesError && <div className="recordarates__alert">{ratesError}</div>}

//       <div className="recordarates__tableWrap">
//         <table className="recordarates__table">
//           <thead>
//             <tr>
//               <th>Мастер</th>
//               <th>Завершено</th>
//               <th>Запись</th>
//               <th>Фикс.</th>
//               <th>%</th>
//               <th>Выручка</th>
//               <th>К выплате</th>
//               <th>Действия</th>
//             </tr>
//           </thead>
//           <tbody>
//             {visible.map((r) => (
//               <tr key={r.id}>
//                 <td>{r.name}</td>
//                 <td>{fmtInt(r.completed)}</td>
//                 <td>
//                   <input
//                     className="recordarates__numInput"
//                     type="text"
//                     inputMode="numeric"
//                     pattern="[0-9]*"
//                     value={r.perRecord}
//                     onChange={(e) =>
//                       handleRateChange(r.id, "perRecord", e.target.value)
//                     }
//                   />
//                 </td>
//                 <td>
//                   <input
//                     className="recordarates__numInput"
//                     type="text"
//                     inputMode="numeric"
//                     pattern="[0-9]*"
//                     value={r.fixed}
//                     onChange={(e) =>
//                       handleRateChange(r.id, "fixed", e.target.value)
//                     }
//                   />
//                 </td>
//                 <td>
//                   <input
//                     className="recordarates__numInput"
//                     type="text"
//                     inputMode="numeric"
//                     pattern="[0-9]*"
//                     value={r.percent}
//                     onChange={(e) =>
//                       handleRateChange(r.id, "percent", e.target.value)
//                     }
//                   />
//                 </td>
//                 <td>{fmtMoney(r.revenue)}</td>
//                 <td>
//                   <b>{fmtMoney(r.total)}</b>
//                 </td>
//                 <td>
//                   <div className="recordarates__actions">
//                     <button
//                       type="button"
//                       className="recordarates__link"
//                       onClick={() => openDays(r)}
//                     >
//                       Дни
//                     </button>
//                     <button
//                       type="button"
//                       className="recordarates__link"
//                       onClick={() => openProductModal(r)}
//                     >
//                       Товар
//                     </button>
//                   </div>
//                 </td>
//               </tr>
//             ))}
//             {!visible.length && (
//               <tr>
//                 <td className="recordarates__muted" colSpan={8}>
//                   Нет мастеров.
//                 </td>
//               </tr>
//             )}
//           </tbody>
//         </table>
//       </div>

//       {rows.length > PAGE_SIZE && (
//         <nav className="recordarates__pager" aria-label="Пагинация">
//           <button
//             className="recordarates__pageBtn"
//             onClick={() => setPage((p) => Math.max(1, p - 1))}
//             disabled={safePage === 1}
//             type="button"
//           >
//             Назад
//           </button>
//           <span className="recordarates__pageInfo">
//             Стр. {safePage}/{totalPages}
//           </span>
//           <button
//             className="recordarates__pageBtn"
//             onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
//             disabled={safePage === totalPages}
//             type="button"
//           >
//             Далее
//           </button>
//         </nav>
//       )}

//       <div className="recordarates__summary">
//         <span className="recordarates__summaryLabel">
//           Итого фонд выплат:
//         </span>
//         <span className="recordarates__summaryValue">
//           {fmtMoney(totals)}
//         </span>
//       </div>

//       <DaysModal
//         open={daysModal.open}
//         onClose={closeDays}
//         title={daysModal.title}
//         rows={daysModal.rows}
//       />

//       <ProductSaleModal
//         open={productModal.open}
//         onClose={closeProductModal}
//         employeeId={productModal.employeeId}
//         employeeName={productModal.employeeName}
//         employees={normalizedEmployees}
//         products={products}
//         payouts={productPayoutsForModal}
//         loading={productDataLoading}
//         error={productDataError}
//         saving={productSaving}
//         onCreate={handleCreateProductSale}
//         periodLabel={period}
//       />
//     </section>
//   );
// };

// export default RecordaRates;



// RecordaRates.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./RecordaRates.scss";
import { FaSync } from "react-icons/fa";
import api from "../../../../../api";

import { RRSelect } from "./RecordaRatesSelect";
import DaysModal from "./RecordaRatesDaysModal";
import ProductSaleModal from "./RecordaRatesProductSaleModal";

import {
  PAGE_SIZE,
  pad2,
  fmtInt,
  fmtMoney,
  asArray,
  toNum,
  y_m_fromISO,
  dateKG,
} from "./RecordaRates.utils";
import { useMasterAggregates, useYearOptions } from "./RecordaRates.hooks";

const MONTHS = [
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

const getDraft = (draft, barberId, periodKey) =>
  draft?.[barberId]?.[periodKey] || {};

const RecordaRates = ({
  year,
  month,
  onChangeYear,
  onChangeMonth,
  employees = [],
  appointments = [],
  _services = [],
  rates = {},
  ratesLoading = false,
  ratesError = "",
  onChangeRate,
  onSaveRates,
}) => {
  const [page, setPage] = useState(1);
  const [draftRates, setDraftRates] = useState({});
  const [daysModal, setDaysModal] = useState({
    open: false,
    title: "",
    rows: [],
  });

  const [productModal, setProductModal] = useState({
    open: false,
    employeeId: "",
    employeeName: "",
  });
  const [products, setProducts] = useState([]);
  const [productSales, setProductSales] = useState([]);
  const [productDataLoading, setProductDataLoading] = useState(false);
  const [productDataError, setProductDataError] = useState("");
  const [productSaving, setProductSaving] = useState(false);

  const period = `${year}-${pad2(month)}`;

  useEffect(() => {
    setDraftRates({});
    setPage(1);
  }, [period]);

  useEffect(() => {
    setDraftRates((prev) => {
      const next = { ...prev };
      for (const barberId of Object.keys(rates || {})) {
        const r = rates[barberId] || {};
        next[barberId] = next[barberId] || {};
        next[barberId][period] = {
          perRecord:
            r.perRecord === "" || r.perRecord == null
              ? 0
              : Number(r.perRecord) || 0,
          fixed:
            r.fixed === "" || r.fixed == null ? 0 : Number(r.fixed) || 0,
          percent:
            r.percent == null && r.perPercent == null && r.perMonth != null
              ? Number(r.perMonth) || 0
              : Number(r.percent ?? r.perPercent ?? 0) || 0,
        };
      }
      return next;
    });
  }, [period, rates]);

  const normalizedEmployees = useMemo(() => {
    const seen = new Set();
    const arr = [];
    for (const e of Array.isArray(employees) ? employees : []) {
      const id = String(e?.id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      arr.push({ id, name: e?.name || "—" });
    }
    return arr.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [employees]);

  const { doneByMaster, revenueByMaster, daysByMaster } =
    useMasterAggregates(appointments, year, month);

  const rows = useMemo(
    () =>
      normalizedEmployees.map((e) => {
        const base = rates[e.id] || {};
        const draft = getDraft(draftRates, e.id, period);

        const perRecord =
          draft.perRecord ??
          (base.perRecord === "" || base.perRecord == null
            ? 0
            : Number(base.perRecord) || 0);

        const fixed =
          draft.fixed ??
          (base.fixed === "" || base.fixed == null
            ? 0
            : Number(base.fixed) || 0);

        const percent =
          draft.percent ??
          (base.percent == null &&
          base.perPercent == null &&
          base.perMonth != null
            ? Number(base.perMonth) || 0
            : Number(base.percent ?? base.perPercent ?? 0) || 0);

        const completed = Number(doneByMaster.get(String(e.id)) || 0);
        const revenue = Number(revenueByMaster.get(String(e.id)) || 0);

        const total =
          completed * (Number(perRecord) || 0) +
          (Number(fixed) || 0) +
          Math.round((revenue * (Number(percent) || 0)) / 100);

        return {
          id: e.id,
          name: e.name,
          completed,
          revenue,
          perRecord,
          fixed,
          percent,
          total,
        };
      }),
    [normalizedEmployees, rates, draftRates, doneByMaster, revenueByMaster, period]
  );

  const totals = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.total || 0), 0),
    [rows]
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleRateChange = (barberId, field, raw) => {
    const clampMoney = (v, max = 10_000_000) => {
      if (v === "" || v == null) return "";
      const n = toNum(v);
      if (!Number.isFinite(n) || n < 0) return 0;
      return Math.min(Math.round(n), max);
    };
    const clampPercent = (v) => {
      if (v === "" || v == null) return "";
      const n = toNum(v);
      if (!Number.isFinite(n) || n < 0) return 0;
      return Math.min(Math.round(n), 100);
    };

    const nextVal =
      field === "percent" ? clampPercent(raw) : clampMoney(raw);

    setDraftRates((prev) => {
      const byUser = { ...(prev[barberId] || {}) };
      byUser[period] = { ...(byUser[period] || {}), [field]: nextVal };
      return { ...prev, [barberId]: byUser };
    });

    onChangeRate?.(barberId, field, nextVal);
  };

  const handleSave = () => {
    onSaveRates?.({
      perRecordPeriod: period,
      percentPeriods: [period],
      totalFund: totals, // <-- главное: отдаем наружу UI-фонд
    });
  };

  const openDays = (row) => {
    const perRecord = Number(row.perRecord) || 0;
    const percent = Number(row.percent) || 0;
    const map = daysByMaster.get(String(row.id)) || new Map();
    const list = Array.from(map, ([date, v]) => {
      const payout =
        v.records * perRecord +
        Math.round((v.revenue * percent) / 100);
      return { date, completed: v.records, revenue: v.revenue, payout };
    }).sort((a, b) => a.date.localeCompare(b.date));
    setDaysModal({ open: true, title: `${row.name} — ${period}`, rows: list });
  };

  const closeDays = () =>
    setDaysModal((p) => ({
      ...p,
      open: false,
    }));

  const loadProductData = async () => {
    setProductDataLoading(true);
    setProductDataError("");

    try {
      const prodRes = await api.get("/main/products/list/");
      const rawProducts = asArray(prodRes.data);
      const mapped = rawProducts.map((p) => ({
        id: String(p.id),
        name: p.name || p.product_name || p.title || "Без названия",
        price: Number(p.price || 0),
      }));
      setProducts(mapped);
    } catch {
      setProductDataError("Не удалось загрузить список товаров.");
    }

    try {
      const salesRes = await api.get("/barbershop/product-sale-payouts/");
      setProductSales(asArray(salesRes.data));
    } catch {
      // просто нет продаж или ошибка — покажем пустой список
    } finally {
      setProductDataLoading(false);
    }
  };

  const handleCreateProductSale = async ({
    employeeId,
    productId,
    percent,
    price,
  }) => {
    try {
      setProductSaving(true);
      setProductDataError("");
      const payload = {
        employee: employeeId,
        product: productId,
        percent: String(percent),
        price: String(price),
      };
      const { data } = await api.post(
        "/barbershop/product-sale-payouts/",
        payload
      );
      setProductSales((prev) => [data, ...prev]);
    } catch {
      setProductDataError("Не удалось сохранить продажу товара.");
      throw new Error("save error");
    } finally {
      setProductSaving(false);
    }
  };

  const openProductModal = (row) => {
    setProductModal({
      open: true,
      employeeId: row.id,
      employeeName: row.name,
    });
    // ВСЕГДА грузим актуальные данные по товарам и продажам
    loadProductData();
  };

  const closeProductModal = () =>
    setProductModal((p) => ({
      ...p,
      open: false,
    }));

  const productPayoutsForModal = useMemo(() => {
    if (!productSales.length) return [];

    return productSales
      .filter((p) => {
        const ym = y_m_fromISO(p.created_at);
        if (!ym) return false;
        const samePeriod =
          ym.y === Number(year) && ym.m === Number(month);
        if (!samePeriod) return false;

        if (!productModal.employeeId) return true;

        const sameEmployeeId =
          String(p.employee) === String(productModal.employeeId);
        const sameEmployeeName =
          String(p.employee_name || "").trim() ===
          String(productModal.employeeName || "").trim();

        return sameEmployeeId || sameEmployeeName;
      })
      .sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at))
      )
      .map((p) => ({
        ...p,
        dateFormatted: dateKG(p.created_at),
      }));
  }, [productSales, productModal.employeeId, productModal.employeeName, year, month]);

  const yearOptions = useYearOptions(year);

  return (
    <section className="recordarates" aria-label="Выплаты мастерам">
      <header className="recordarates__header">
        <div className="recordarates__filters">
          <label className="recordarates__filter">
            <span className="recordarates__filterLabel">Месяц</span>
            <RRSelect
              value={String(month)}
              onChange={(val) => {
                onChangeMonth?.(Number(val));
                setPage(1);
              }}
              options={MONTHS.map((m, i) => ({
                value: String(i + 1),
                label: m,
              }))}
              placeholder="Месяц"
            />
          </label>

          <label className="recordarates__filter">
            <span className="recordarates__filterLabel">Год</span>
            <RRSelect
              value={String(year)}
              onChange={(val) => {
                onChangeYear?.(Number(val));
                setPage(1);
              }}
              options={yearOptions.map((y) => ({
                value: String(y),
                label: String(y),
              }))}
              placeholder="Год"
            />
          </label>
        </div>

        <button
          className="recordarates__btn recordarates__btn--primary"
          onClick={handleSave}
          disabled={ratesLoading}
          type="button"
        >
          <FaSync />
          <span className="recordarates__btnText">
            {ratesLoading ? "Сохранение…" : "Сохранить ставки"}
          </span>
        </button>
      </header>

      {ratesError && <div className="recordarates__alert">{ratesError}</div>}

      <div className="recordarates__tableWrap">
        <table className="recordarates__table">
          <thead>
            <tr>
              <th>Мастер</th>
              <th>Завершено</th>
              <th>Запись</th>
              <th>Фикс.</th>
              <th>%</th>
              <th>Выручка</th>
              <th>К выплате</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{fmtInt(r.completed)}</td>
                <td>
                  <input
                    className="recordarates__numInput"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={r.perRecord}
                    onChange={(e) =>
                      handleRateChange(r.id, "perRecord", e.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    className="recordarates__numInput"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={r.fixed}
                    onChange={(e) =>
                      handleRateChange(r.id, "fixed", e.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    className="recordarates__numInput"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={r.percent}
                    onChange={(e) =>
                      handleRateChange(r.id, "percent", e.target.value)
                    }
                  />
                </td>
                <td>{fmtMoney(r.revenue)}</td>
                <td>
                  <b>{fmtMoney(r.total)}</b>
                </td>
                <td>
                  <div className="recordarates__actions">
                    <button
                      type="button"
                      className="recordarates__link"
                      onClick={() => openDays(r)}
                    >
                      Дни
                    </button>
                    <button
                      type="button"
                      className="recordarates__link"
                      onClick={() => openProductModal(r)}
                    >
                      Товар
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td className="recordarates__muted" colSpan={8}>
                  Нет мастеров.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length > PAGE_SIZE && (
        <nav className="recordarates__pager" aria-label="Пагинация">
          <button
            className="recordarates__pageBtn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            type="button"
          >
            Назад
          </button>
          <span className="recordarates__pageInfo">
            Стр. {safePage}/{totalPages}
          </span>
          <button
            className="recordarates__pageBtn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            type="button"
          >
            Далее
          </button>
        </nav>
      )}

      <div className="recordarates__summary">
        <span className="recordarates__summaryLabel">
          Итого фонд выплат:
        </span>
        <span className="recordarates__summaryValue">
          {fmtMoney(totals)}
        </span>
      </div>

      <DaysModal
        open={daysModal.open}
        onClose={closeDays}
        title={daysModal.title}
        rows={daysModal.rows}
      />

      <ProductSaleModal
        open={productModal.open}
        onClose={closeProductModal}
        employeeId={productModal.employeeId}
        employeeName={productModal.employeeName}
        employees={normalizedEmployees}
        products={products}
        payouts={productPayoutsForModal}
        loading={productDataLoading}
        error={productDataError}
        saving={productSaving}
        onCreate={handleCreateProductSale}
        periodLabel={period}
      />
    </section>
  );
};

export default RecordaRates;
