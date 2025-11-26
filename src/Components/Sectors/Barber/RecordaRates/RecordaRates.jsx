// import React, { useMemo, useState, useEffect } from "react";
// import "./RecordaRates.scss";
// import { FaSync, FaTimes } from "react-icons/fa";

// const PAGE_SIZE = 12;
// const pad2 = (n) => String(n).padStart(2, "0");
// const fmtInt = (n) => Number(n || 0).toLocaleString("ru-RU");
// const fmtMoney = (n) => `${Number(n || 0).toLocaleString("ru-RU")} сом`;

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
// const isCompleted = (s) =>
//   String(s || "")
//     .trim()
//     .toLowerCase() === "completed";
// const y_m_fromStartAt = (iso) => {
//   if (!iso) return null;
//   const t = Date.parse(String(iso));
//   if (!Number.isFinite(t)) return null;
//   const d = new Date(t + KG_OFFSET_MS);
//   return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
// };
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

// /* универсальный расчёт суммы услуги по записи */
// const makePriceOf = (services) => {
//   const byId = new Map();
//   (Array.isArray(services) ? services : []).forEach((s) => {
//     const id = String(s?.id ?? "");
//     if (!id) return;
//     const p = toNum(s?.price);
//     if (p) byId.set(id, p);
//   });

//   const pickDirect = (o) => toNum(o?.total ?? o?.sum ?? o?.amount ?? o?.price);
//   const extractId = (o) => String(o?.id ?? o?.service ?? o?.service_id ?? "");

//   return (a) => {
//     // прямые поля на самой записи
//     const direct =
//       toNum(a?.total_amount) ||
//       toNum(a?.total) ||
//       toNum(a?.paid_amount) ||
//       toNum(a?.amount) ||
//       toNum(a?.service_price) ||
//       toNum(a?.price);
//     if (direct) return direct;

//     // массивы услуг/товаров в записи
//     const arrays = [a?.services, a?.items, a?.positions];
//     for (const arr of arrays) {
//       if (!Array.isArray(arr) || !arr.length) continue;
//       let sum = 0;
//       for (const it of arr) {
//         if (it && typeof it === "object") {
//           const v = pickDirect(it);
//           if (v) sum += v;
//           else {
//             const id = extractId(it);
//             if (id && byId.has(id)) sum += toNum(byId.get(id));
//           }
//         } else {
//           const id = String(it ?? "");
//           if (id && byId.has(id)) sum += toNum(byId.get(id));
//         }
//       }
//       if (sum) return sum;
//     }

//     // одиночная услуга
//     const sid = String(a?.service ?? "");
//     if (sid && byId.has(sid)) return toNum(byId.get(sid));

//     return 0;
//   };
// };

// /* ==== Модалка "Дни" ==== */
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
//             title="Закрыть"
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

// const RecordaRates = ({
//   year,
//   month,
//   onChangeYear,
//   onChangeMonth,
//   employees = [],
//   appointments = [],
//   services = [],
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
//   const period = `${year}-${pad2(month)}`;

//   useEffect(() => {
//     setDraftRates({});
//     setPage(1);
//   }, [period]);

//   const priceOf = useMemo(() => makePriceOf(services), [services]);

//   /* начальные ставки → драфт для текущего периода */
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

//   /* агрегаты по месяцу */
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
//       map.set(key, (map.get(key) || 0) + priceOf(a));
//     }
//     return map;
//   }, [appointments, year, month, priceOf]);

//   /* разбивка по дням */
//   const daysByMaster = useMemo(() => {
//     const m = new Map(); // empId -> Map(date -> {records, revenue})
//     for (const a of Array.isArray(appointments) ? appointments : []) {
//       if (!isCompleted(a?.status)) continue;
//       const ym = y_m_fromStartAt(a?.start_at);
//       if (!ym || ym.y !== Number(year) || ym.m !== Number(month)) continue;
//       const empId = String(a?.barber ?? a?.employee ?? a?.master ?? "");
//       if (!empId) continue;
//       const day = dateKG(a?.start_at);
//       const inner = m.get(empId) || new Map();
//       const prev = inner.get(day) || { records: 0, revenue: 0 };
//       inner.set(day, {
//         records: prev.records + 1,
//         revenue: prev.revenue + priceOf(a),
//       });
//       m.set(empId, inner);
//     }
//     return m;
//   }, [appointments, year, month, priceOf]);

//   const getDraft = (draft, barberId, periodKey) =>
//     draft?.[barberId]?.[periodKey] || {};

//   /* строки таблицы */
//   const rows = useMemo(() => {
//     return normalizedEmployees.map((e) => {
//       const base = rates[e.id] || {};
//       const draft = getDraft(draftRates, e.id, period);
//       const perRecord =
//         draft.perRecord ??
//         (base.perRecord === "" || base.perRecord == null
//           ? 0
//           : Number(base.perRecord) || 0);
//       const percent =
//         draft.percent ??
//         (base.percent == null &&
//         base.perPercent == null &&
//         base.perMonth != null
//           ? Number(base.perMonth) || 0
//           : Number(base.percent ?? base.perPercent ?? 0) || 0);

//       const completed = Number(doneByMaster.get(String(e.id)) || 0);
//       const revenue = Number(revenueByMaster.get(String(e.id)) || 0);
//       const total =
//         completed * (Number(perRecord) || 0) +
//         Math.round((revenue * (Number(percent) || 0)) / 100);
//       return {
//         id: e.id,
//         name: e.name,
//         completed,
//         revenue,
//         perRecord,
//         percent,
//         total,
//       };
//     });
//   }, [
//     normalizedEmployees,
//     rates,
//     draftRates,
//     doneByMaster,
//     revenueByMaster,
//     period,
//   ]);

//   const totals = useMemo(
//     () => rows.reduce((acc, r) => acc + Number(r.total || 0), 0),
//     [rows]
//   );

//   const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
//   const safePage = Math.min(Math.max(1, page), totalPages);
//   const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

//   /* изменения ставок */
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

//     const nextVal = field === "percent" ? clampPercent(raw) : clampMoney(raw);
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
//         v.records * perRecord + Math.round((v.revenue * percent) / 100);
//       return { date, completed: v.records, revenue: v.revenue, payout };
//     }).sort((a, b) => a.date.localeCompare(b.date));
//     setDaysModal({ open: true, title: `${row.name} — ${period}`, rows: list });
//   };
//   const closeDays = () => setDaysModal((p) => ({ ...p, open: false }));

//   const yearOptions = useMemo(() => {
//     const set = new Set([year - 1, year, year + 1]);
//     set.delete(2024);
//     return [...set].sort((a, b) => a - b);
//   }, [year]);

//   return (
//     <section className="recordarates" aria-label="Выплаты мастерам">
//       <header className="recordarates__header">
//         <h2 className="recordarates__title">Выплаты</h2>

//         <div className="recordarates__filters" aria-label="Период">
//           <label className="recordarates__filter">
//             <span className="recordarates__filterLabel">Месяц</span>
//             <select
//               className="recordarates__select"
//               value={month}
//               onChange={(e) => {
//                 onChangeMonth?.(Number(e.target.value));
//                 setPage(1);
//               }}
//               aria-label="Месяц"
//             >
//               {MONTHS.map((m, i) => (
//                 <option key={m} value={i + 1}>
//                   {m}
//                 </option>
//               ))}
//             </select>
//           </label>

//           <label className="recordarates__filter">
//             <span className="recordarates__filterLabel">Год</span>
//             <select
//               className="recordarates__select"
//               value={year}
//               onChange={(e) => {
//                 onChangeYear?.(Number(e.target.value));
//                 setPage(1);
//               }}
//               aria-label="Год"
//             >
//               {yearOptions.map((y) => (
//                 <option key={y} value={y}>
//                   {y}
//                 </option>
//               ))}
//             </select>
//           </label>
//         </div>

//         <button
//           className="recordarates__btn recordarates__btn--primary recordarates__btn--icon"
//           onClick={handleSave}
//           disabled={ratesLoading}
//           aria-label="Сохранить ставки"
//           title="Сохранить ставки"
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
//               <th>Ставка / запись</th>
//               <th>Процент, %</th>
//               <th>Выручка</th>
//               <th>К выплате</th>
//               <th>По дням</th>
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
//                     placeholder="сом/запись"
//                     aria-label="Ставка за запись"
//                     title="Ставка за запись"
//                     disabled={ratesLoading}
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
//                     placeholder="% с услуги"
//                     aria-label="Процент с услуги"
//                     title="Процент с услуги"
//                     disabled={ratesLoading}
//                   />
//                 </td>
//                 <td>{fmtMoney(r.revenue)}</td>
//                 <td>
//                   <b>{fmtMoney(r.total)}</b>
//                 </td>
//                 <td>
//                   <button
//                     type="button"
//                     className="recordarates__link"
//                     onClick={() => openDays(r)}
//                     title="Показать по дням"
//                   >
//                     Дни
//                   </button>
//                 </td>
//               </tr>
//             ))}
//             {!visible.length && (
//               <tr>
//                 <td className="recordarates__muted" colSpan={7}>
//                   Нет мастеров.
//                 </td>
//               </tr>
//             )}
//           </tbody>

//           <tfoot>
//             <tr>
//               <td colSpan={5} style={{ textAlign: "right" }}>
//                 <b>Итого фонд выплат:</b>
//               </td>
//               <td>
//                 <b>{fmtMoney(totals)}</b>
//               </td>
//               <td />
//             </tr>
//           </tfoot>
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

//       <DaysModal
//         open={daysModal.open}
//         onClose={closeDays}
//         title={daysModal.title}
//         rows={daysModal.rows}
//       />
//     </section>
//   );
// };

// export default RecordaRates;





import React, { useMemo, useState, useEffect } from "react";
import "./RecordaRates.scss";
import { FaSync, FaTimes } from "react-icons/fa";

const PAGE_SIZE = 12;
const pad2 = (n) => String(n).padStart(2, "0");
const fmtInt = (n) => Number(n || 0).toLocaleString("ru-RU");
const fmtMoney = (n) => `${Number(n || 0).toLocaleString("ru-RU")} сом`;

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

const KG_OFFSET_MS = 6 * 60 * 60 * 1000;
const isCompleted = (s) =>
  String(s || "")
    .trim()
    .toLowerCase() === "completed";

const y_m_fromStartAt = (iso) => {
  if (!iso) return null;
  const t = Date.parse(String(iso));
  if (!Number.isFinite(t)) return null;
  const d = new Date(t + KG_OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
};

const dateKG = (iso) => {
  const t = Date.parse(String(iso));
  if (!Number.isFinite(t)) return "";
  const d = new Date(t + KG_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
    d.getUTCDate()
  )}`;
};

const toNum = (v) => {
  if (v === "" || v == null) return 0;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/* ==== Модалка "Дни" ==== */
const DaysModal = ({ open, onClose, title, rows }) => {
  if (!open) return null;
  return (
    <div
      className="recordarates__overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="recordarates__modal" onClick={(e) => e.stopPropagation()}>
        <div className="recordarates__modalHead">
          <h4 className="recordarates__modalTitle">{title}</h4>
          <button
            type="button"
            className="recordarates__iconBtn"
            aria-label="Закрыть"
            onClick={onClose}
            title="Закрыть"
          >
            <FaTimes />
          </button>
        </div>
        <div className="recordarates__tableWrap recordarates__tableWrap--modal">
          <table className="recordarates__table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Завершено</th>
                <th>Выручка</th>
                <th>К выплате</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="recordarates__muted" colSpan={4}>
                    Нет данных
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.date}>
                    <td>{r.date}</td>
                    <td>{fmtInt(r.completed)}</td>
                    <td>{fmtMoney(r.revenue)}</td>
                    <td>
                      <b>{fmtMoney(r.payout)}</b>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="recordarates__modalFoot">
          <button
            type="button"
            className="recordarates__btn recordarates__btn--secondary"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

const RecordaRates = ({
  year,
  month,
  onChangeYear,
  onChangeMonth,
  employees = [],
  appointments = [],
  _services = [], // на будущее, чтобы eslint не ругался
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
  const period = `${year}-${pad2(month)}`;

  useEffect(() => {
    setDraftRates({});
    setPage(1);
  }, [period]);

  /* начальные ставки → драфт для текущего периода */
  useEffect(() => {
    setDraftRates((prev) => {
      const next = { ...prev };
      for (const barberId of Object.keys(rates || {})) {
        const r = rates[barberId] || {};
        next[barberId] = next[barberId] || {};
        next[barberId][period] = {
          // ставка за запись
          perRecord:
            r.perRecord === "" || r.perRecord == null
              ? 0
              : Number(r.perRecord) || 0,
          // фиксированная сумма за период
          fixed:
            r.fixed === "" || r.fixed == null ? 0 : Number(r.fixed) || 0,
          // процент
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

  /* завершённые по месяцу */
  const doneByMaster = useMemo(() => {
    const map = new Map();
    for (const a of Array.isArray(appointments) ? appointments : []) {
      if (!isCompleted(a?.status)) continue;
      const ym = y_m_fromStartAt(a?.start_at);
      if (!ym || ym.y !== Number(year) || ym.m !== Number(month)) continue;
      const key = String(a?.barber ?? a?.employee ?? a?.master ?? "");
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [appointments, year, month]);

  /* ВЫРУЧКА: ТОЛЬКО ИЗ appointment.price */
  const revenueByMaster = useMemo(() => {
    const map = new Map();
    for (const a of Array.isArray(appointments) ? appointments : []) {
      if (!isCompleted(a?.status)) continue;
      const ym = y_m_fromStartAt(a?.start_at);
      if (!ym || ym.y !== Number(year) || ym.m !== Number(month)) continue;
      const key = String(a?.barber ?? a?.employee ?? a?.master ?? "");
      if (!key) continue;
      const price = toNum(a?.price); // только price
      map.set(key, (map.get(key) || 0) + price);
    }
    return map;
  }, [appointments, year, month]);

  /* разбивка по дням (для модалки, без распределения fixed по дням) */
  const daysByMaster = useMemo(() => {
    const m = new Map(); // empId -> Map(date -> {records, revenue})
    for (const a of Array.isArray(appointments) ? appointments : []) {
      if (!isCompleted(a?.status)) continue;
      const ym = y_m_fromStartAt(a?.start_at);
      if (!ym || ym.y !== Number(year) || ym.m !== Number(month)) continue;
      const empId = String(a?.barber ?? a?.employee ?? a?.master ?? "");
      if (!empId) continue;
      const day = dateKG(a?.start_at);
      const inner = m.get(empId) || new Map();
      const prev = inner.get(day) || { records: 0, revenue: 0 };
      const price = toNum(a?.price);
      inner.set(day, {
        records: prev.records + 1,
        revenue: prev.revenue + price,
      });
      m.set(empId, inner);
    }
    return m;
  }, [appointments, year, month]);

  const getDraft = (draft, barberId, periodKey) =>
    draft?.[barberId]?.[periodKey] || {};

  /* строки таблицы */
  const rows = useMemo(() => {
    return normalizedEmployees.map((e) => {
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

      // К выплате = записи * ставка + фикс + процент от выручки
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
    });
  }, [
    normalizedEmployees,
    rates,
    draftRates,
    doneByMaster,
    revenueByMaster,
    period,
  ]);

  const totals = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.total || 0), 0),
    [rows]
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  /* изменения ставок */
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
      // fixed можно тоже передавать в этом объекте, если нужно
    });
  };

  const openDays = (row) => {
    const perRecord = Number(row.perRecord) || 0;
    const percent = Number(row.percent) || 0;
    const map = daysByMaster.get(String(row.id)) || new Map();
    const list = Array.from(map, ([date, v]) => {
      // В разбивке по дням учитываем только переменную часть
      const payout =
        v.records * perRecord +
        Math.round((v.revenue * percent) / 100);
      return { date, completed: v.records, revenue: v.revenue, payout };
    }).sort((a, b) => a.date.localeCompare(b.date));
    setDaysModal({ open: true, title: `${row.name} — ${period}`, rows: list });
  };
  const closeDays = () => setDaysModal((p) => ({ ...p, open: false }));

  const yearOptions = useMemo(() => {
    const set = new Set([year - 1, year, year + 1]);
    set.delete(2024);
    return [...set].sort((a, b) => a - b);
  }, [year]);

  return (
    <section className="recordarates" aria-label="Выплаты мастерам">
      <header className="recordarates__header">
        <h2 className="recordarates__title">Выплаты</h2>

        <div className="recordarates__filters" aria-label="Период">
          <label className="recordarates__filter">
            <span className="recordarates__filterLabel">Месяц</span>
            <select
              className="recordarates__select"
              value={month}
              onChange={(e) => {
                onChangeMonth?.(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Месяц"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className="recordarates__filter">
            <span className="recordarates__filterLabel">Год</span>
            <select
              className="recordarates__select"
              value={year}
              onChange={(e) => {
                onChangeYear?.(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Год"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          className="recordarates__btn recordarates__btn--primary recordarates__btn--icon"
          onClick={handleSave}
          disabled={ratesLoading}
          aria-label="Сохранить ставки"
          title="Сохранить ставки"
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
              <th>Фиксированный</th>
              <th>Процент, %</th>
              <th>Выручка</th>
              <th>К выплате</th>
              <th>По дням</th>
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
                    placeholder="сом/запись"
                    aria-label="Ставка за запись"
                    title="Ставка за запись"
                    disabled={ratesLoading}
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
                    placeholder="фикс/месяц"
                    aria-label="Фиксированная ставка"
                    title="Фиксированная ставка"
                    disabled={ratesLoading}
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
                    placeholder="% с услуги"
                    aria-label="Процент с услуги"
                    title="Процент с услуги"
                    disabled={ratesLoading}
                  />
                </td>
                <td>{fmtMoney(r.revenue)}</td>
                <td>
                  <b>{fmtMoney(r.total)}</b>
                </td>
                <td>
                  <button
                    type="button"
                    className="recordarates__link"
                    onClick={() => openDays(r)}
                    title="Показать по дням"
                  >
                    Дни
                  </button>
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

          <tfoot>
            <tr>
              <td colSpan={6} style={{ textAlign: "right" }}>
                <b>Итого фонд выплат:</b>
              </td>
              <td>
                <b>{fmtMoney(totals)}</b>
              </td>
              <td />
            </tr>
          </tfoot>
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

      <DaysModal
        open={daysModal.open}
        onClose={closeDays}
        title={daysModal.title}
        rows={daysModal.rows}
      />
    </section>
  );
};

export default RecordaRates;

