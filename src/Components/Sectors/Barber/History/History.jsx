// import React, { useEffect, useMemo, useState } from "react";
// import api from "../../../../api";
// import "./History.scss";
// import { FaFileCsv } from "react-icons/fa";

// /* ===== Имя из разных возможных полей ===== */
// const clientName = (c) =>
//   c?.client_name || c?.full_name || c?.fullName || c?.name || "—";

// const employeeFIO = (e) =>
//   [e?.last_name, e?.first_name].filter(Boolean).join(" ").trim() ||
//   e?.full_name ||
//   e?.name ||
//   e?.email ||
//   "—";

// const serviceName = (s) => s?.service_name || s?.name || "—";

// /* ===== Форматирование даты/денег ===== */
// const pad = (n) => String(n).padStart(2, "0");
// const dateISO = (iso) => {
//   if (!iso) return "";
//   const d = new Date(iso);
//   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// };
// const formatMoney = (n) =>
//   new Intl.NumberFormat("ru-RU", {
//     minimumFractionDigits: 0,
//     maximumFractionDigits: 0,
//   }).format(Number(n) || 0);

// /* ===== Надёжная сумма из записи/услуги ===== */
// const pickAmount = (appt, serviceObj) => {
//   const cand =
//     appt?.total_amount ??
//     appt?.total ??
//     appt?.price ??
//     appt?.service_price ??
//     serviceObj?.price ??
//     0;
//   const n = Number(cand);
//   return Number.isFinite(n) ? n : 0;
// };

// /* Забираем все страницы пагинированного эндпоинта */
// const fetchAll = async (url) => {
//   const acc = [];
//   let next = url;
//   while (next) {
//     const { data } = await api.get(next);
//     const chunk = data?.results ?? data ?? [];
//     acc.push(...chunk);
//     next = data?.next || null;
//   }
//   return acc;
// };

// const History = () => {
//   const [appointments, setAppointments] = useState([]);
//   const [clients, setClients] = useState([]);
//   const [employees, setEmployees] = useState([]); // мастера = сотрудники
//   const [services, setServices] = useState([]);

//   const [filterDate, setFilterDate] = useState("");
//   const [filterClient, setFilterClient] = useState("");
//   const [filterMaster, setFilterMaster] = useState("");

//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   /* ===== Загрузка данных ===== */
//   useEffect(() => {
//     (async () => {
//       try {
//         setLoading(true);
//         setError("");
//         const [aRes, cRes, eRes, sRes] = await Promise.all([
//           fetchAll("/barbershop/appointments/"),
//           fetchAll("/barbershop/clients/"),
//           fetchAll("/users/employees/"),
//           fetchAll("/barbershop/services/"),
//         ]);
//         setAppointments(aRes || []);
//         setClients(cRes || []);
//         setEmployees(eRes || []);
//         setServices(sRes || []);
//       } catch (e) {
//         setError(e?.response?.data?.detail || "Не удалось загрузить историю");
//       } finally {
//         setLoading(false);
//       }
//     })();
//   }, []);

//   /* ===== Карты по id ===== */
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

//   /* ===== Только завершённые ===== */
//   const completed = useMemo(
//     () => appointments.filter((a) => a?.status === "completed"),
//     [appointments]
//   );

//   /* ===== Фильтрация ===== */
//   const filtered = useMemo(() => {
//     return completed.filter((h) => {
//       const byDate = !filterDate || dateISO(h.start_at) === filterDate;
//       const byClient = !filterClient || String(h.client) === filterClient;
//       const byMaster = !filterMaster || String(h.barber) === filterMaster;
//       return byDate && byClient && byMaster;
//     });
//   }, [completed, filterDate, filterClient, filterMaster]);

//   const totalAmount = useMemo(() => {
//     return filtered.reduce((sum, h) => {
//       const srv = serviceMap.get(String(h.service));
//       return sum + pickAmount(h, srv);
//     }, 0);
//   }, [filtered, serviceMap]);

//   /* ===== Экспорт CSV (Клиент/Мастер/Услуга/Сумма) ===== */
//   const exportCSV = () => {
//     const rows = [
//       ["Клиент", "Мастер", "Услуга", "Сумма"],
//       ...filtered.map((h) => {
//         const srv = serviceMap.get(String(h.service));
//         const amount = pickAmount(h, srv);
//         return [
//           h.client_name || clientName(clientMap.get(String(h.client))) || "",
//           h.barber_name || employeeFIO(employeeMap.get(String(h.barber))) || "",
//           h.service_name || serviceName(srv) || "",
//           String(amount),
//         ];
//       }),
//     ];

//     const csv = rows
//       .map((r) =>
//         r
//           .map((cell) => {
//             const val = String(cell ?? "");
//             return /[",;\n]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val;
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
//     a.download = `history_${filterDate || "all"}.csv`;
//     a.click();
//     URL.revokeObjectURL(url);
//   };

//   return (
//     <div className="barberhistory">
//       {/* Header */}
//       <div className="barberhistory__header">
//         <div className="barberhistory__titleWrap">
//           <h2 className="barberhistory__title">История</h2>
//           <span className="barberhistory__subtitle">
//             {loading ? "Загрузка…" : `${filtered.length}/${completed.length} записей`}
//           </span>
//         </div>

//         <div className="barberhistory__actions">
//       {/* резиновая строка фильтров сверху на широких, вниз на узких */}
//           <div className="barberhistory__filters">
//             <input
//               className="barberhistory__input"
//               type="date"
//               value={filterDate}
//               onChange={(e) => setFilterDate(e.target.value)}
//               aria-label="Дата"
//             />
//             <select
//               className="barberhistory__input"
//               value={filterClient}
//               onChange={(e) => setFilterClient(e.target.value)}
//               aria-label="Клиент"
//             >
//               <option value="">Все клиенты</option>
//               {clients.map((c) => (
//                 <option key={c.id} value={String(c.id)}>
//                   {clientName(c)}
//                 </option>
//               ))}
//             </select>
//             <select
//               className="barberhistory__input"
//               value={filterMaster}
//               onChange={(e) => setFilterMaster(e.target.value)}
//               aria-label="Мастер"
//             >
//               <option value="">Все мастера</option>
//               {employees.map((u) => (
//                 <option key={u.id} value={String(u.id)}>
//                   {employeeFIO(u)}
//                 </option>
//               ))}
//             </select>
//           </div>

//           <div className="barberhistory__export">
//             <div className="barberhistory__total" aria-live="polite">
//               Итого: <b>{formatMoney(totalAmount)} сом</b>
//             </div>
//             <button
//               className="barberhistory__btn barberhistory__btn--primary"
//               onClick={exportCSV}
//               disabled={loading || filtered.length === 0}
//               title="Экспортировать CSV"
//             >
//               <FaFileCsv /> <span className="barberhistory__btnText">Экспорт CSV</span>
//             </button>
//           </div>
//         </div>
//       </div>

//       {error && <div className="barberhistory__alert">{error}</div>}

//       {/* Table with inner scroll */}
//       <div className="barberhistory__tableWrap">
//         <table className="barberhistory__table">
//           <thead>
//             <tr>
//               <th>Клиент</th>
//               <th>Мастер</th>
//               <th>Услуга</th>
//               <th className="barberhistory__th--right">Сумма</th>
//             </tr>
//           </thead>
//           <tbody>
//             {loading ? (
//               <tr>
//                 <td colSpan="4" className="barberhistory__loading">
//                   Загрузка…
//                 </td>
//               </tr>
//             ) : filtered.length === 0 ? (
//               <tr>
//                 <td colSpan="4" className="barberhistory__loading">
//                   Нет данных
//                 </td>
//               </tr>
//             ) : (
//               filtered.map((h) => {
//                 const srv = serviceMap.get(String(h.service));
//                 const amount = pickAmount(h, srv);
//                 return (
//                   <tr key={h.id}>
//                     <td>{h.client_name || clientName(clientMap.get(String(h.client)))}</td>
//                     <td>{h.barber_name || employeeFIO(employeeMap.get(String(h.barber)))}</td>
//                     <td>{h.service_name || serviceName(srv)}</td>
//                     <td className="barberhistory__td--right">
//                       {formatMoney(amount)} сом
//                     </td>
//                   </tr>
//                 );
//               })
//             )}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// };

// export default History;



import React, { useEffect, useMemo, useState } from "react";
import api from "../../../../api";
import "./History.scss";
import { FaFileCsv } from "react-icons/fa";

/* ===== Константы ===== */
const PAGE_SIZE = 15;

/* ===== Имя из разных возможных полей ===== */
const clientName = (c) =>
  c?.client_name || c?.full_name || c?.fullName || c?.name || "—";

const employeeFIO = (e) =>
  [e?.last_name, e?.first_name].filter(Boolean).join(" ").trim() ||
  e?.full_name ||
  e?.name ||
  e?.email ||
  "—";

const serviceName = (s) => s?.service_name || s?.name || "—";

/* ===== Форматирование даты/денег ===== */
const pad = (n) => String(n).padStart(2, "0");
const dateISO = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const formatMoney = (n) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

/* ===== Надёжная сумма из записи/услуги ===== */
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

/* Забираем все страницы пагинированного эндпоинта */
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

const History = () => {
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]); // мастера = сотрудники
  const [services, setServices] = useState([]);

  const [filterDate, setFilterDate] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterMaster, setFilterMaster] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // пагинация
  const [page, setPage] = useState(1);

  /* ===== Загрузка данных ===== */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");
        const [aRes, cRes, eRes, sRes] = await Promise.all([
          fetchAll("/barbershop/appointments/"),
          fetchAll("/barbershop/clients/"),
          fetchAll("/users/employees/"),
          fetchAll("/barbershop/services/"),
        ]);
        setAppointments(aRes || []);
        setClients(cRes || []);
        setEmployees(eRes || []);
        setServices(sRes || []);
      } catch (e) {
        setError(e?.response?.data?.detail || "Не удалось загрузить историю.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ===== Карты по id ===== */
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

  /* ===== Только завершённые ===== */
  const completed = useMemo(
    () => appointments.filter((a) => a?.status === "completed"),
    [appointments]
  );

  /* ===== Фильтрация ===== */
  const filtered = useMemo(() => {
    return completed.filter((h) => {
      const byDate = !filterDate || dateISO(h.start_at) === filterDate;
      const byClient = !filterClient || String(h.client) === filterClient;
      const byMaster = !filterMaster || String(h.barber) === filterMaster;
      return byDate && byClient && byMaster;
    });
  }, [completed, filterDate, filterClient, filterMaster]);

  // сбрасываем страницу при смене фильтров/данных
  useEffect(() => {
    setPage(1);
  }, [filterDate, filterClient, filterMaster, filtered.length]);

  const totalAmount = useMemo(() => {
    return filtered.reduce((sum, h) => {
      const srv = serviceMap.get(String(h.service));
      return sum + pickAmount(h, srv);
    }, 0);
  }, [filtered, serviceMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const startIdx = (pageSafe - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  /* ===== Экспорт CSV (Клиент/Мастер/Услуга/Сумма) ===== */
  const exportCSV = () => {
    const rows = [
      ["Клиент", "Мастер", "Услуга", "Сумма"],
      ...filtered.map((h) => {
        const srv = serviceMap.get(String(h.service));
        const amount = pickAmount(h, srv);
        return [
          h.client_name || clientName(clientMap.get(String(h.client))) || "",
          h.barber_name || employeeFIO(employeeMap.get(String(h.barber))) || "",
          h.service_name || serviceName(srv) || "",
          String(amount),
        ];
      }),
    ];

    const csv = rows
      .map((r) =>
        r
          .map((cell) => {
            const val = String(cell ?? "");
            return /[",;\n]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val;
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
    a.download = `history_${filterDate || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const Pager = () => {
    if (filtered.length <= PAGE_SIZE) return null;
    const onPrev = () => setPage((p) => Math.max(1, p - 1));
    const onNext = () => setPage((p) => Math.min(totalPages, p + 1));

    const pages = new Set([1, pageSafe - 1, pageSafe, pageSafe + 1, totalPages]);
    const list = [...pages].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);

    return (
      <nav className="barberhistory__pager" aria-label="Пагинация">
        <button
          className="barberhistory__pageBtn"
          onClick={onPrev}
          disabled={pageSafe === 1}
        >
          Назад
        </button>
        <ul className="barberhistory__pageList">
          {list.map((n, i) => {
            const prev = list[i - 1];
            const needDots = prev && n - prev > 1;
            return (
              <React.Fragment key={n}>
                {needDots && <li className="barberhistory__dots">…</li>}
                <li>
                  <button
                    className={`barberhistory__pageBtn ${
                      n === pageSafe ? "is-active" : ""
                    }`}
                    aria-current={n === pageSafe ? "page" : undefined}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                </li>
              </React.Fragment>
            );
          })}
        </ul>
        <button
          className="barberhistory__pageBtn"
          onClick={onNext}
          disabled={pageSafe === totalPages}
        >
          Далее
        </button>
      </nav>
    );
  };

  return (
    <div className="barberhistory">
      {/* Header */}
      <div className="barberhistory__header">
        <div className="barberhistory__titleWrap">
          <h2 className="barberhistory__title">История</h2>
          <span className="barberhistory__subtitle" aria-live="polite">
            {loading
              ? "Загрузка…"
              : `${filtered.length}/${completed.length} записей${
                  filtered.length > PAGE_SIZE
                    ? ` · страница ${pageSafe}/${totalPages}`
                    : ""
                }`}
          </span>
        </div>

        <div className="barberhistory__actions">
          {/* резиновая строка фильтров сверху на широких, вниз на узких */}
          <div className="barberhistory__filters">
            <input
              className="barberhistory__input"
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              aria-label="Дата"
            />
            <select
              className="barberhistory__input"
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              aria-label="Клиент"
            >
              <option value="">Все клиенты</option>
              {clients.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {clientName(c)}
                </option>
              ))}
            </select>
            <select
              className="barberhistory__input"
              value={filterMaster}
              onChange={(e) => setFilterMaster(e.target.value)}
              aria-label="Мастер"
            >
              <option value="">Все мастера</option>
              {employees.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {employeeFIO(u)}
                </option>
              ))}
            </select>
          </div>

          <div className="barberhistory__export">
            <div className="barberhistory__total" aria-live="polite">
              Итого: <b>{formatMoney(totalAmount)} сом</b>
            </div>
            <button
              className="barberhistory__btn barberhistory__btn--primary"
              onClick={exportCSV}
              disabled={loading || filtered.length === 0}
              title="Экспортировать CSV"
            >
              <FaFileCsv />{" "}
              <span className="barberhistory__btnText">Экспорт CSV</span>
            </button>
          </div>
        </div>
      </div>

      {error && <div className="barberhistory__alert">{error}</div>}

      {/* Table with inner scroll */}
      <div className="barberhistory__tableWrap">
        <table className="barberhistory__table">
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Мастер</th>
              <th>Услуга</th>
              <th className="barberhistory__th--right">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" className="barberhistory__loading">
                  Загрузка…
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan="4" className="barberhistory__loading">
                  Нет данных
                </td>
              </tr>
            ) : (
              pageRows.map((h) => {
                const srv = serviceMap.get(String(h.service));
                const amount = pickAmount(h, srv);
                return (
                  <tr key={h.id}>
                    <td>
                      {h.client_name ||
                        clientName(clientMap.get(String(h.client)))}
                    </td>
                    <td>
                      {h.barber_name ||
                        employeeFIO(employeeMap.get(String(h.barber)))}
                    </td>
                    <td>{h.service_name || serviceName(srv)}</td>
                    <td className="barberhistory__td--right">
                      {formatMoney(amount)} сом
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pager />
    </div>
  );
};

export default History;
