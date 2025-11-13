// // CashReports.jsx
// import React, { useEffect, useMemo, useState, lazy, Suspense } from "react";
// import "./CashReports.scss";
// import api from "../../../../api";
// import RecordaRates from "../RecordaRates/RecordaRates";
// import { useUser } from "../../../../store/slices/userSlice";

// const BarberAnalitikaLazy = lazy(() => import("../BarberAnalitika/BarberAnalitika"));

// const asArray = (d) => (Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : []);
// const pad2 = (n) => String(n).padStart(2, "0");

// const RATES_EP = "/education/teacher-rates/"; // teacher, period YYYY-MM, mode: lesson|percent (fallback month), rate

// const CashReports = () => {
//   const now = new Date();

//   const [tab, setTab] = useState("barber"); // barber | payouts

//   const [appointments, setAppointments] = useState([]);
//   const [employees, setEmployees] = useState([]);
//   const [services, setServices] = useState([]);

//   const [month, setMonth] = useState(now.getMonth() + 1);
//   const [year, setYear] = useState(now.getFullYear());

//   const periodLabel = `${year}-${pad2(month)}`;
//   const [ratesLoading, setRatesLoading] = useState(false);
//   const [ratesError, setRatesError] = useState("");
//   // { [barberId]: { id_lesson?, id_percent?, perRecord, percent } }
//   const [rates, setRates] = useState({});

//   const loadRates = async () => {
//     setRatesLoading(true);
//     setRatesError("");
//     try {
//       const safeGet = async (params) => {
//         try {
//           return await api.get(RATES_EP, {
//             params: { period: periodLabel, page_size: 1000, ...params },
//           });
//         } catch {
//           return null;
//         }
//       };

//       const lessonRes = await safeGet({ mode: "lesson" });
//       // Основной режим — percent; если его нет на бэке, пробуем старый month
//       let percentRes = await safeGet({ mode: "percent" });
//       if (!percentRes) percentRes = await safeGet({ mode: "month" });

//       if (!lessonRes && !percentRes) {
//         throw new Error("rates fetch failed");
//       }

//       const map = {};
//       const take = (resp, kind) => {
//         if (!resp?.data) return;
//         (asArray(resp.data) || []).forEach((r) => {
//           const tId = r.teacher || r.teacher_id || r.user || r.employee || r.master;
//           if (!tId) return;
//           map[tId] = map[tId] || {};
//           if (kind === "lesson") {
//             map[tId].id_lesson = r.id;
//             map[tId].perRecord = Number(r.rate ?? 0) || 0;
//           } else {
//             map[tId].id_percent = r.id;
//             map[tId].percent = Number(r.rate ?? 0) || 0;
//           }
//         });
//       };
//       take(lessonRes, "lesson");
//       take(percentRes, "percent");
//       const takeLesson = (resp) => {
//    if (!resp?.data) return;
//    (asArray(resp.data) || []).forEach((r) => {
//      const tId = r.teacher || r.teacher_id || r.user || r.employee || r.master;
//      if (!tId) return;
//      map[tId] = map[tId] || {};
//      map[tId].id_lesson = r.id;
//      map[tId].perRecord = Number(r.rate ?? 0) || 0;
//    });
//  };
//  const takePercentOrMonth = (resp) => {
//    if (!resp?.data) return;
//    const mode = resp?.config?.params?.mode; // 'percent' или 'month'
//    (asArray(resp.data) || []).forEach((r) => {
//      const tId = r.teacher || r.teacher_id || r.user || r.employee || r.master;
//      if (!tId) return;
//      map[tId] = map[tId] || {};
//      map[tId].percent = Number(r.rate ?? 0) || 0;
//      if (mode === "month") map[tId].id_month = r.id;
//      else map[tId].id_percent = r.id;
//    });
//  };
//  takeLesson(lessonRes);
//  takePercentOrMonth(percentRes);

//       setRates(map);
//     } catch (e) {
//       console.error(e);
//       setRates({});
//       setRatesError("Не удалось загрузить ставки мастеров.");
//     } finally {
//       setRatesLoading(false);
//     }
//   };

//   const setRateValue = (barberId, field, value) => {
//     const raw = String(value).trim();
//     if (raw === "") {
//       setRates((prev) => ({ ...prev, [barberId]: { ...(prev[barberId] || {}), [field]: "" } }));
//       return;
//     }
//     const num = Number(raw);
//     if (!Number.isFinite(num) || num < 0) return;
//     setRates((prev) => ({ ...prev, [barberId]: { ...(prev[barberId] || {}), [field]: num } }));
//   };

//   const persistRates = async ({ perRecordPeriod, percentPeriods } = {}) => {
//     setRatesLoading(true);
//     setRatesError("");
//     try {
//       const tasks = [];
//       Object.entries(rates).forEach(([barberId, rec]) => {
//         const send = async (mode, amount, idKey, period = periodLabel) => {
//           if (amount === "" || amount == null) return;
//           const num = Number(amount);
//           if (!Number.isFinite(num) || num < 0) return;
//           const payload = { teacher: barberId, period, mode, rate: String(num) };
//           const id = rec[idKey];
//           try {
//             if (id) await api.put(`${RATES_EP}${id}/`, payload);
//             else await api.post(RATES_EP, payload);
//           } catch (err) {
//             // fallback: если percent не поддержан — пишем в старый режим month
//             if (mode === "percent") {
//               const payloadOld = { teacher: barberId, period, mode: "month", rate: String(num) };
//               const oldId = rec.id_month;
//               if (oldId) await api.put(`${RATES_EP}${oldId}/`, payloadOld);
//               else await api.post(RATES_EP, payloadOld);
//             } else {
//               throw err;
//             }
//           }
//         };

//         tasks.push(
//           send("lesson", rec.perRecord, "id_lesson", perRecordPeriod || periodLabel)
//         );

//         const periods = percentPeriods?.length ? percentPeriods : [periodLabel];
//         periods.forEach((p) => tasks.push(send("percent", rec.percent, "id_percent", p)));
//       });

//       await Promise.allSettled(tasks);
//       await loadRates();
//     } catch (e) {
//       console.error(e);
//       setRatesError("Не удалось сохранить ставки мастеров.");
//     } finally {
//       setRatesLoading(false);
//     }
//   };

//   const fetchPaged = async (url) => {
//     const acc = [];
//     let next = url;
//     while (next) {
//       const { data } = await api.get(next);
//       acc.push(...asArray(data));
//       next = data?.next;
//     }
//     return acc;
//   };

//   const loadAll = async () => {
//     try {
//       const [apps, emps, svcs] = await Promise.all([
//         fetchPaged("/barbershop/appointments/"),
//         fetchPaged("/users/employees/"),
//         fetchPaged("/barbershop/services/"),
//       ]);

//       const normEmp = emps
//         .map((e) => {
//           const first = e.first_name ?? "";
//           const last = e.last_name ?? "";
//           const disp = [last, first].filter(Boolean).join(" ").trim() || e.email || "—";
//           return { id: e.id, name: disp };
//         })
//         .sort((a, b) => a.name.localeCompare(b.name, "ru"));

//       const normSvc = svcs.map((s) => ({
//         id: s.id,
//         name: s.service_name || s.name || "—",
//         price: s.price,
//       }));

//       setAppointments(apps);
//       setEmployees(normEmp);
//       setServices(normSvc);

//       await loadRates();
//     } catch (e) {
//       console.error(e);
//     }
//   };

//   useEffect(() => {
//     loadAll();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   useEffect(() => {
//     setRates({});
//     setRatesError("");
//     loadRates();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [year, month]);

//   const { company } = useUser();

//   return (
//     <div className="barbercashreports">
//       {company?.sector?.name === "Барбершоп" && (
//         <div className="barbercashreports__tabs">
//           <button
//             className={`barbercashreports__tab ${tab === "barber" ? "is-active" : ""}`}
//             onClick={() => setTab("barber")}
//           >
//             Аналитика
//           </button>
//           <button
//             className={`barbercashreports__tab ${tab === "payouts" ? "is-active" : ""}`}
//             onClick={() => setTab("payouts")}
//           >
//             Выплаты
//           </button>
//         </div>
//       )}

//       {tab === "barber" && (
//         <div className="barbercashreports__kassaWrap">
//           <Suspense fallback={<div className="barbercashreports__muted">Загрузка…</div>}>
//             <BarberAnalitikaLazy
//               year={year}
//               month={month}
//               onChangeYear={setYear}
//               onChangeMonth={setMonth}
//               appointments={appointments}
//               employees={employees}
//               services={services}
//             />
//           </Suspense>
//         </div>
//       )}

//       {tab === "payouts" && (
//         <RecordaRates
//           year={year}
//           month={month}
//           onChangeYear={setYear}
//           onChangeMonth={setMonth}
//           employees={employees}
//           appointments={appointments}
//           services={services}
//           rates={rates}
//           ratesLoading={ratesLoading}
//           ratesError={ratesError}
//           onChangeRate={setRateValue}
//           onSaveRates={persistRates}
//         />
//       )}
//     </div>
//   );
// };

// export default CashReports;



import React, { useEffect, useMemo, useState, lazy, Suspense } from "react";
import "./CashReports.scss";
import api from "../../../../api";
import RecordaRates from "../RecordaRates/RecordaRates";
import { useUser } from "../../../../store/slices/userSlice";

const BarberAnalitikaLazy = lazy(() => import("../BarberAnalitika/BarberAnalitika"));

/* ===== helpers ===== */
const asArray = (d) => (Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : []);
const pad2 = (n) => String(n).padStart(2, "0");
const toNum = (v) => {
  if (v === "" || v == null) return 0;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const isCompleted = (s) => String(s || "").trim().toLowerCase() === "completed";
const y_m_fromStartAt = (iso) => {
  if (!iso) return null;
  const t = Date.parse(String(iso));
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
};

/* строим функцию расчёта цены записи по справочнику услуг */
const makePriceOf = (services) => {
  const byId = new Map();
  (Array.isArray(services) ? services : []).forEach((s) => {
    const id = String(s?.id ?? "");
    if (!id) return;
    const p = toNum(s?.price);
    if (p) byId.set(id, p);
  });

  const pickDirect = (o) => toNum(o?.total ?? o?.sum ?? o?.amount ?? o?.price);
  const extractId = (o) => String(o?.id ?? o?.service ?? o?.service_id ?? "");

  return (a) => {
    const direct =
      toNum(a?.total_amount) ||
      toNum(a?.total) ||
      toNum(a?.paid_amount) ||
      toNum(a?.amount) ||
      toNum(a?.service_price) ||
      toNum(a?.price);
    if (direct) return direct;

    const arrays = [a?.services, a?.items, a?.positions];
    for (const arr of arrays) {
      if (!Array.isArray(arr) || !arr.length) continue;
      let sum = 0;
      for (const it of arr) {
        if (it && typeof it === "object") {
          const v = pickDirect(it);
          if (v) sum += v;
          else {
            const id = extractId(it);
            if (id && byId.has(id)) sum += toNum(byId.get(id));
          }
        } else {
          const id = String(it ?? "");
          if (id && byId.has(id)) sum += toNum(byId.get(id));
        }
      }
      if (sum) return sum;
    }

    const sid = String(a?.service ?? "");
    if (sid && byId.has(sid)) return toNum(byId.get(sid));

    return 0;
  };
};

const RATES_EP = "/education/teacher-rates/";
const CASHFLOWS_EP = "/construction/cashflows/";
const CASHBOXES_EP = "/construction/cashboxes/";

const CashReports = () => {
  const now = new Date();

  const [tab, setTab] = useState("barber"); // barber | payouts

  const [appointments, setAppointments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [services, setServices] = useState([]);

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const periodLabel = `${year}-${pad2(month)}`;

  /* ===== ставки ===== */
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState("");
  // { [barberId]: { id_lesson?, id_percent?, id_month?, perRecord, percent } }
  const [rates, setRates] = useState({});

  const loadRates = async () => {
    setRatesLoading(true);
    setRatesError("");
    try {
      const safeGet = async (params) => {
        try {
          return await api.get(RATES_EP, {
            params: { period: periodLabel, page_size: 1000, ...params },
          });
        } catch {
          return null;
        }
      };

      const lessonRes = await safeGet({ mode: "lesson" });
      let percentRes = await safeGet({ mode: "percent" });
      if (!percentRes) percentRes = await safeGet({ mode: "month" });

      if (!lessonRes && !percentRes) throw new Error("rates fetch failed");

      const map = {};
      if (lessonRes?.data) {
        (asArray(lessonRes.data) || []).forEach((r) => {
          const tId = r.teacher || r.teacher_id || r.user || r.employee || r.master;
          if (!tId) return;
          map[tId] = map[tId] || {};
          map[tId].id_lesson = r.id;
          map[tId].perRecord = toNum(r.rate);
        });
      }
      if (percentRes?.data) {
        const mode = percentRes?.config?.params?.mode;
        (asArray(percentRes.data) || []).forEach((r) => {
          const tId = r.teacher || r.teacher_id || r.user || r.employee || r.master;
          if (!tId) return;
          map[tId] = map[tId] || {};
          map[tId].percent = toNum(r.rate);
          if (mode === "month") map[tId].id_month = r.id;
          else map[tId].id_percent = r.id;
        });
      }

      setRates(map);
    } catch (e) {
      console.error(e);
      setRates({});
      setRatesError("Не удалось загрузить ставки мастеров.");
    } finally {
      setRatesLoading(false);
    }
  };

  const setRateValue = (barberId, field, value) => {
    const raw = String(value).trim();
    if (raw === "") {
      setRates((prev) => ({ ...prev, [barberId]: { ...(prev[barberId] || {}), [field]: "" } }));
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    setRates((prev) => ({ ...prev, [barberId]: { ...(prev[barberId] || {}), [field]: n } }));
  };

  /* ==== расчёт выплат за период ==== */
  const calcPayoutTotalForPeriod = () => {
    const priceOf = makePriceOf(services);
    const doneBy = new Map();
    const revenueBy = new Map();

    for (const a of Array.isArray(appointments) ? appointments : []) {
      if (!isCompleted(a?.status)) continue;
      const ym = y_m_fromStartAt(a?.start_at);
      if (!ym || ym.y !== Number(year) || ym.m !== Number(month)) continue;
      const key = String(a?.barber ?? a?.employee ?? a?.master ?? "");
      if (!key) continue;
      doneBy.set(key, (doneBy.get(key) || 0) + 1);
      revenueBy.set(key, (revenueBy.get(key) || 0) + priceOf(a));
    }

    let total = 0;
    for (const e of Array.isArray(employees) ? employees : []) {
      const id = String(e?.id ?? "");
      if (!id) continue;
      const r = rates[id] || {};
      const perRecord = toNum(r.perRecord);
      const percent = toNum(r.percent ?? r.perPercent ?? r.perMonth ?? 0);
      const done = toNum(doneBy.get(id) || 0);
      const rev = toNum(revenueBy.get(id) || 0);
      total += done * perRecord + Math.round((rev * percent) / 100);
    }
    return total;
  };

  /* ==== запись расхода в кассу ==== */
  const upsertPayoutExpense = async (amountSom) => {
    if (!amountSom || amountSom <= 0) return;

    // берём первую кассу, если есть; если нет — создаём без cashbox
    let cashboxId = null;
    try {
      const { data } = await api.get(CASHBOXES_EP, { params: { page_size: 200 } });
      const boxes = asArray(data);
      if (boxes.length) cashboxId = boxes[0]?.id || boxes[0]?.uuid || null;
    } catch (e) {
      console.error(e);
    }

    // проверим, есть ли уже расход за этот период
    let existing = null;
    try {
      const { data } = await api.get(CASHFLOWS_EP, { params: { page_size: 200 } });
      const flows = asArray(data);
      const label = `Выплаты мастерам ${periodLabel}`;
      existing = flows.find((cf) => {
        const type = String(cf?.type ?? cf?.kind ?? cf?.direction ?? "").toLowerCase();
        const desc = String(cf?.description ?? cf?.note ?? cf?.comment ?? "");
        const amt = toNum(cf?.amount ?? cf?.value ?? cf?.sum);
        // совпадение по метке и направлению
        return desc.includes(label) && (type === "expense" || amt < 0);
      });
    } catch (e) {
      console.error(e);
    }

    const payload = {
      type: "expense",
      amount: String(amountSom),        // положительное число
      description: `Выплаты мастерам ${periodLabel}`,
      date: `${periodLabel}-01`,
      ...(cashboxId ? { cashbox: cashboxId } : {}),
    };

    try {
      if (existing?.id) {
        await api.put(`${CASHFLOWS_EP}${existing.id}/`, payload);
      } else {
        await api.post(CASHFLOWS_EP, payload);
      }
    } catch (e) {
      // фолбэк на альтернативные ключи
      try {
        const alt = {
          kind: "expense",
          value: String(amountSom),
          comment: `Выплаты мастерам ${periodLabel}`,
          datetime: `${periodLabel}-01T00:00:00`,
          ...(cashboxId ? { cashbox: cashboxId } : {}),
        };
        if (existing?.id) await api.put(`${CASHFLOWS_EP}${existing.id}/`, alt);
        else await api.post(CASHFLOWS_EP, alt);
      } catch (e2) {
        console.error(e2);
      }
    }
  };

  const persistRates = async ({ perRecordPeriod, percentPeriods } = {}) => {
    setRatesLoading(true);
    setRatesError("");
    try {
      // 1) сохраняем ставки
      const tasks = [];
      Object.entries(rates).forEach(([barberId, rec]) => {
        const send = async (mode, amount, idKey, period = periodLabel) => {
          if (amount === "" || amount == null) return;
          const num = Number(amount);
          if (!Number.isFinite(num) || num < 0) return;
          const payload = { teacher: barberId, period, mode, rate: String(num) };
          const id = rec[idKey];
          try {
            if (id) await api.put(`${RATES_EP}${id}/`, payload);
            else await api.post(RATES_EP, payload);
          } catch (err) {
            // fallback: если percent не поддержан — пишем в старый режим month
            if (mode === "percent") {
              const payloadOld = { teacher: barberId, period, mode: "month", rate: String(num) };
              const oldId = rec.id_month;
              if (oldId) await api.put(`${RATES_EP}${oldId}/`, payloadOld);
              else await api.post(RATES_EP, payloadOld);
            } else {
              throw err;
            }
          }
        };

        tasks.push(
          send("lesson", rec.perRecord, "id_lesson", perRecordPeriod || periodLabel)
        );
        const periods = percentPeriods?.length ? percentPeriods : [periodLabel];
        periods.forEach((p) => tasks.push(send("percent", rec.percent, "id_percent", p)));
      });

      await Promise.allSettled(tasks);

      // 2) считаем сумму «К выплате» и создаём/обновляем расход в кассах
      const payoutTotalSom = calcPayoutTotalForPeriod();
      await upsertPayoutExpense(payoutTotalSom);

      // 3) перезагружаем ставки
      await loadRates();
    } catch (e) {
      console.error(e);
      setRatesError("Не удалось сохранить ставки мастеров.");
    } finally {
      setRatesLoading(false);
    }
  };

  /* ===== данные барбершопа ===== */
  const fetchPaged = async (url) => {
    const acc = [];
    let next = url;
    const seen = new Set();
    while (next && !seen.has(next)) {
      seen.add(next);
      const { data } = await api.get(next);
      acc.push(...asArray(data));
      next = data?.next;
    }
    return acc;
  };

  const loadAll = async () => {
    try {
      const [apps, emps, svcs] = await Promise.all([
        fetchPaged("/barbershop/appointments/"),
        fetchPaged("/users/employees/"),
        fetchPaged("/barbershop/services/"),
      ]);

      const normEmp = emps
        .map((e) => {
          const first = e.first_name ?? "";
          const last = e.last_name ?? "";
          const disp = [last, first].filter(Boolean).join(" ").trim() || e.email || "—";
          return { id: e.id, name: disp };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));

      const normSvc = svcs.map((s) => ({
        id: s.id,
        name: s.service_name || s.name || "—",
        price: s.price,
      }));

      setAppointments(apps);
      setEmployees(normEmp);
      setServices(normSvc);

      await loadRates();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setRates({});
    setRatesError("");
    loadRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const { company } = useUser();

  return (
    <div className="barbercashreports">
      {company?.sector?.name === "Барбершоп" && (
        <div className="barbercashreports__tabs">
          <button
            className={`barbercashreports__tab ${tab === "barber" ? "is-active" : ""}`}
            onClick={() => setTab("barber")}
          >
            Аналитика
          </button>
          <button
            className={`barbercashreports__tab ${tab === "payouts" ? "is-active" : ""}`}
            onClick={() => setTab("payouts")}
          >
            Выплаты
          </button>
        </div>
      )}

      {tab === "barber" && (
        <div className="barbercashreports__kassaWrap">
          <Suspense fallback={<div className="barbercashreports__muted">Загрузка…</div>}>
            <BarberAnalitikaLazy
              year={year}
              month={month}
              onChangeYear={setYear}
              onChangeMonth={setMonth}
              appointments={appointments}
              employees={employees}
              services={services}
            />
          </Suspense>
        </div>
      )}

      {tab === "payouts" && (
        <RecordaRates
          year={year}
          month={month}
          onChangeYear={setYear}
          onChangeMonth={setMonth}
          employees={employees}
          appointments={appointments}
          services={services}
          rates={rates}
          ratesLoading={ratesLoading}
          ratesError={ratesError}
          onChangeRate={setRateValue}
          onSaveRates={persistRates}
        />
      )}
    </div>
  );
};

export default CashReports;
