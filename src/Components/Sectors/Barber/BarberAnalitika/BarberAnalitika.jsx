// // BarberAnalitika.jsx
// import React, { useMemo, useState } from "react";
// import {
//   RefreshCcw,
//   Users2,
//   PackageSearch,
//   Wallet,
//   Boxes,
//   CalendarDays,
//   Scissors,
// } from "lucide-react";
// import "./BarberAnalitika.scss";
// import BarberAnalitikaDetailsModal from "./BarberAnalitikaDetailsModal.jsx";
// import BarberAnalitikaCard from "./BarberAnalitikaCard.jsx";
// import { fmt, fmtInt, fmtMoney, months } from "./BarberAnalitikaUtils";
// import { useBarberAnalitikaData } from "./BarberAnalitikaData";

// const BarberAnalitika = () => {
//   const now = useMemo(() => new Date(), []);
//   const [year, setYear] = useState(now.getFullYear());
//   const [monthIdx, setMonthIdx] = useState(now.getMonth());

//   const {
//     loading,
//     errorMsg,
//     totalApps,
//     totalServices,
//     totalClientsBarber,
//     totalClientsMarket,
//     completedCount,
//     completedSum,
//     canceledCount,
//     noShowCount,
//     rankBarbers,
//     rankServices,
//     rankClientsVisits,
//     stockKpis,
//     cashRows,
//     loadingCash,
//     cashTotals,
//     productsRowsAgg,
//     loadingProducts,
//     suppliersRows,
//     clientsSalesRows,
//     unifiedIncome,
//     unifiedExpense,
//   } = useBarberAnalitikaData({ year, monthIdx });

//   const [modal, setModal] = useState({
//     open: false,
//     title: "",
//     columns: [],
//     rows: [],
//   });
//   const openModal = (payload) => setModal({ open: true, ...payload });
//   const closeModal = () => setModal((m) => ({ ...m, open: false }));

//   const years = useMemo(() => {
//     const cur = new Date().getFullYear();
//     return [cur, cur - 1, cur - 2, cur - 3, cur - 4];
//   }, []);

//   return (
//     <div className="barber-analitika">
//       <header className="ba-head">
//         <h2 className="ba-title">Аналитика</h2>

//         <div className="ba-filters">
//           <select
//             className="ba-select"
//             value={year}
//             onChange={(e) => setYear(Number(e.target.value))}
//             aria-label="Год"
//           >
//             {years.map((y) => (
//               <option key={y} value={y}>
//                 {y}
//               </option>
//             ))}
//           </select>
//           <select
//             className="ba-select"
//             value={monthIdx}
//             onChange={(e) => setMonthIdx(Number(e.target.value))}
//             aria-label="Месяц"
//           >
//             {months.map((m, i) => (
//               <option key={m} value={i}>
//                 {m}
//               </option>
//             ))}
//           </select>
//           <button
//             className="ba-refresh"
//             onClick={() => setYear((y) => y)}
//             aria-label="Обновить"
//             title="Обновить"
//             type="button"
//           >
//             <RefreshCcw size={16} />
//           </button>
//         </div>
//       </header>

//       {errorMsg && <div className="ba-alert">{errorMsg}</div>}

//       {/* KPI (барбер + кассы) */}
//       <section className="ba-kpis">
//         <div className="kpi">
//           <div className="kpi__icon">
//             <CalendarDays size={18} />
//           </div>
//           <div className="kpi__name">Записей (месяц)</div>
//           <div className="kpi__val">{fmtInt(totalApps)}</div>
//         </div>
//         <div className="kpi">
//           <div className="kpi__icon">
//             <Scissors size={18} />
//           </div>
//           <div className="kpi__name">Услуг (всего)</div>
//           <div className="kpi__val">{fmtInt(totalServices)}</div>
//         </div>
//         <div className="kpi">
//           <div className="kpi__icon">
//             <Users2 size={18} />
//           </div>
//           <div className="kpi__name">Клиенты барбершоп</div>
//           <div className="kpi__val">{fmtInt(totalClientsBarber)}</div>
//         </div>
//         <div className="kpi">
//           <div className="kpi__icon">
//             <Users2 size={18} />
//           </div>
//           <div className="kpi__name">Клиенты продаж</div>
//           <div className="kpi__val">{fmtInt(totalClientsMarket)}</div>
//         </div>
//         <div className="kpi kpi--accent">
//           <div className="kpi__icon">
//             <Wallet size={18} />
//           </div>
//           <div className="kpi__name">Приход (месяц, общий)</div>
//           <div className="kpi__val">{fmtMoney(unifiedIncome)}</div>
//         </div>
//         <div className="kpi kpi--accent">
//           <div className="kpi__icon">
//             <Wallet size={18} />
//           </div>
//           <div className="kpi__name">Расход (месяц, общий)</div>
//           <div className="kpi__val">{fmtMoney(unifiedExpense)}</div>
//         </div>
//       </section>

//       {/* KPI склада */}
//       <section className="ba-kpis ba-kpis--secondary">
//         <div className="kpi">
//           <div className="kpi__icon">
//             <Boxes size={18} />
//           </div>
//           <div className="kpi__name">Позиции</div>
//           <div className="kpi__val">{stockKpis.positions}</div>
//         </div>
//         <div className="kpi">
//           <div className="kpi__icon">
//             <PackageSearch size={18} />
//           </div>
//           <div className="kpi__name">Штук на складе</div>
//           <div className="kpi__val">
//             {fmt(stockKpis.totalQty)}
//           </div>
//         </div>
//         <div className="kpi">
//           <div className="kpi__icon">
//             <Wallet size={18} />
//           </div>
//           <div className="kpi__name">Оценка запасов</div>
//           <div className="kpi__val">
//             {fmtMoney(stockKpis.stockValueRetail)}
//           </div>
//         </div>
//       </section>

//       {/* Статусы записей */}
//       <section className="ba-panel">
//         <h3 className="ba-panel__title">Статусы записей</h3>
//         <div className="ba-statusList">
//           {[
//             {
//               code: "completed",
//               label: "Завершено",
//               count: completedCount,
//               sum: completedSum,
//             },
//             {
//               code: "aborted",
//               label: "Отмены и не пришёл",
//               count: canceledCount + noShowCount,
//               sum: 0,
//             },
//           ].map((row) => {
//             const share = totalApps
//               ? Math.round((row.count / totalApps) * 100)
//               : 0;
//             return (
//               <div key={row.code} className="ba-statusRow">
//                 <div className="ba-statusHead">
//                   <span className={`ba-badge ba-badge--${row.code}`}>
//                     {row.label}
//                   </span>
//                   <span className="ba-statusNum">
//                     {fmtInt(row.count)}
//                   </span>
//                 </div>
//                 <div
//                   className="ba-progress"
//                   aria-label={`${row.label} ${share}%`}
//                 >
//                   <div
//                     className="ba-progress__fill"
//                     style={{ width: `${share}%` }}
//                   />
//                 </div>
//                 {row.code === "completed" && (
//                   <div className="ba-statusMoney">
//                     Сумма: {fmtMoney(row.sum)}
//                   </div>
//                 )}
//               </div>
//             );
//           })}
//           {!totalApps && (
//             <div className="ba-muted">Нет данных за месяц.</div>
//           )}
//         </div>
//       </section>

//       {/* Рейтинги барбера */}
//       <section className="ba-grid">
//         <div className="ba-panel">
//           <div className="ba-panel__head">
//             <h3 className="ba-panel__title">Мастера — записи</h3>
//           </div>
//           <ol className="ba-rankList">
//             {rankBarbers.slice(0, 6).map((r) => (
//               <li key={r.id} className="ba-rankItem">
//                 <span className="ba-rankName">{r.name}</span>
//                 <span className="ba-rankCount">{fmtInt(r.count)}</span>
//               </li>
//             ))}
//             {!loading && !rankBarbers.length && (
//               <div className="ba-muted">Нет записей.</div>
//             )}
//           </ol>
//         </div>

//         <div className="ba-panel">
//           <div className="ba-panel__head">
//             <h3 className="ba-panel__title">Услуги — использование</h3>
//           </div>
//           <ol className="ba-rankList">
//             {rankServices.slice(0, 6).map((r) => (
//               <li key={r.id} className="ba-rankItem">
//                 <span className="ba-rankName">{r.name}</span>
//                 <span className="ba-rankCount">{fmtInt(r.count)}</span>
//               </li>
//             ))}
//             {!loading && !rankServices.length && (
//               <div className="ba-muted">Нет данных.</div>
//             )}
//           </ol>
//         </div>
//       </section>

//       {/* Топ-10 клиентов (барбер) */}
//       <section className="ba-panel">
//         <h3 className="ba-panel__title">Топ-10 клиентов</h3>
//         <div className="ba-tableWrap">
//           <table className="ba-table">
//             <thead>
//               <tr>
//                 <th>Клиент</th>
//                 <th>Приходов</th>
//                 <th>Сумма</th>
//               </tr>
//             </thead>
//             <tbody>
//               {rankClientsVisits.slice(0, 10).map((r) => (
//                 <tr key={r.id}>
//                   <td>{r.name}</td>
//                   <td>{fmtInt(r.count)}</td>
//                   <td className="ba-money">{fmtMoney(r.sum)}</td>
//                 </tr>
//               ))}
//               {!rankClientsVisits.length && (
//                 <tr>
//                   <td colSpan="3" className="ba-muted">
//                     Нет данных.
//                   </td>
//                 </tr>
//               )}
//             </tbody>
//           </table>
//         </div>
//       </section>

//       {/* Сетка каталога */}
//       <section className="ba-grid">
//         <BarberAnalitikaCard
//           icon={<Users2 size={16} />}
//           title="Поставщики"
//           columns={[
//             { key: "name", title: "Поставщик", className: "ba-ellipsis" },
//             { key: "items", title: "Позиции" },
//             {
//               key: "amount",
//               title: "Сумма",
//               className: "ba-money",
//               render: (r) => `${fmt(r.amount)} c`,
//             },
//           ]}
//           rows={suppliersRows}
//           onOpenModal={openModal}
//         />

//         <BarberAnalitikaCard
//           icon={<Wallet size={16} />}
//           title="Кассы"
//           columns={[
//             { key: "name", title: "Касса", className: "ba-ellipsis" },
//             { key: "ops", title: "Операции" },
//             {
//               key: "income",
//               title: "Приход",
//               className: "ba-money",
//               render: (r) => `${fmt(r.income)} c`,
//             },
//             {
//               key: "expense",
//               title: "Расход",
//               className: "ba-money",
//               render: (r) => `${fmt(r.expense)} c`,
//             },
//           ]}
//           rows={loadingCash ? [] : cashRows}
//           onOpenModal={openModal}
//         />

//         <BarberAnalitikaCard
//           icon={<PackageSearch size={16} />}
//           title="Товары (продажи)"
//           columns={[
//             { key: "name", title: "Товар", className: "ba-ellipsis" },
//             { key: "qty", title: "Кол-во" },
//             {
//               key: "revenue",
//               title: "Выручка",
//               className: "ba-money",
//               render: (r) => `${fmt(r.revenue)} c`,
//             },
//           ]}
//           rows={loadingProducts ? [] : productsRowsAgg}
//           onOpenModal={openModal}
//         />

//         <BarberAnalitikaCard
//           icon={<Users2 size={16} />}
//           title="Клиенты (продажи)"
//           columns={[
//             { key: "name", title: "Клиент", className: "ba-ellipsis" },
//             { key: "orders", title: "Заказы" },
//             {
//               key: "revenue",
//               title: "Выручка",
//               className: "ba-money",
//               render: (r) => `${fmt(r.revenue)} c`,
//             },
//           ]}
//           rows={clientsSalesRows}
//           onOpenModal={openModal}
//         />
//       </section>

//       {modal.open && (
//         <BarberAnalitikaDetailsModal
//           title={modal.title}
//           columns={modal.columns}
//           rows={modal.rows}
//           getKey={(r, i) => `${modal.title}-${i}`}
//           onClose={closeModal}
//           pageSize={12}
//         />
//       )}
//     </div>
//   );
// };

// export default BarberAnalitika;




// BarberAnalitika.jsx
import React, { useMemo, useState } from "react";
import {
  RefreshCcw,
  Users2,
  PackageSearch,
  Wallet,
  Boxes,
  CalendarDays,
  Scissors,
  ShoppingCart,
  Building2,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";

import "./BarberAnalitika.scss";
import BarberAnalitikaDetailsModal from "./BarberAnalitikaDetailsModal.jsx";
import BarberAnalitikaCard from "./BarberAnalitikaCard.jsx";
import { fmt, fmtInt, fmtMoney, months } from "./BarberAnalitikaUtils";
import { useBarberAnalitikaData } from "./BarberAnalitikaData";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

const BarberAnalitika = () => {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [monthIdx, setMonthIdx] = useState(now.getMonth());

  const {
    loading,
    errorMsg,
    totalApps,
    totalServices,
    totalClientsBarber,
    totalClientsMarket,
    completedCount,
    completedSum,
    canceledCount,
    noShowCount,
    rankBarbers,
    rankServices,
    rankClientsVisits,
    stockKpis,
    cashRows,
    loadingCash,
    cashTotals,
    productsRowsAgg,
    loadingProducts,
    suppliersRows,
    clientsSalesRows,
    unifiedIncome,
    unifiedExpense,
    weekChart,
    dayLineChart,
  } = useBarberAnalitikaData({ year, monthIdx });

  const [modal, setModal] = useState({
    open: false,
    title: "",
    columns: [],
    rows: [],
  });

  const openModal = (payload) => setModal({ open: true, ...payload });
  const closeModal = () => setModal((m) => ({ ...m, open: false }));

  const years = useMemo(() => {
    const cur = new Date().getFullYear();
    return [cur, cur - 1, cur - 2, cur - 3, cur - 4];
  }, []);

  /* ===== KPI карточки ===== */
  const kpiCards = [
    {
      key: "income",
      title: "Приход (месяц, общий)",
      value: fmtMoney(unifiedIncome),
      icon: <TrendingUp size={20} />,
      iconClass: "kpi__icon--yellow",
    },
    {
      key: "expense",
      title: "Расход (месяц, общий)",
      value: fmtMoney(unifiedExpense),
      icon: <TrendingDown size={20} />,
      iconClass: "kpi__icon--red",
    },
    {
      key: "apps",
      title: "Записей (месяц)",
      value: fmtInt(totalApps),
      icon: <CalendarDays size={20} />,
      iconClass: "kpi__icon--blue",
    },
    {
      key: "services",
      title: "Услуг (всего)",
      value: fmtInt(totalServices),
      icon: <Scissors size={20} />,
      iconClass: "kpi__icon--purple",
    },
    {
      key: "clientsBarber",
      title: "Клиенты барбершоп (всего)",
      value: fmtInt(totalClientsBarber),
      icon: <Users2 size={20} />,
      iconClass: "kpi__icon--green",
    },
    {
      key: "clientsMarket",
      title: "Клиенты продаж (всего)",
      value: fmtInt(totalClientsMarket),
      icon: <ShoppingCart size={20} />,
      iconClass: "kpi__icon--orange",
    },
    {
      key: "cashCount",
      title: "Кассы (месяц, общий)",
      value: fmtInt(cashRows.length),
      icon: <Wallet size={20} />,
      iconClass: "kpi__icon--teal",
    },
    {
      key: "positions",
      title: "Позиции (всего)",
      value: fmtInt(stockKpis.positions),
      icon: <Boxes size={20} />,
      iconClass: "kpi__icon--pink",
    },
    {
      key: "qty",
      title: "Штук на складе (всего)",
      value: fmtInt(stockKpis.totalQty),
      icon: <PackageSearch size={20} />,
      iconClass: "kpi__icon--indigo",
    },
    {
      key: "stockValue",
      title: "Оценка запасов (всего)",
      value: fmtMoney(stockKpis.stockValueRetail),
      icon: <DollarSign size={20} />,
      iconClass: "kpi__icon--cyan",
    },
  ];

  /* ===== диаграммы ===== */

  // Популярные услуги (по реальным rankServices)
  const popularServices = rankServices.slice(0, 5);
  const popularServicesData = {
    labels: popularServices.map((s) => s.name),
    datasets: [
      {
        data: popularServices.map((s) => s.count || 0),
        backgroundColor: ["#f7d74f", "#22c55e", "#3b82f6", "#a855f7", "#9ca3af"],
        borderWidth: 0,
      },
    ],
  };

  const popularServicesOptions = {
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0) || 1;
            const cnt = ctx.parsed || 0;
            const percent = Math.round((cnt / total) * 100);
            return `${ctx.label} – ${cnt} (${percent}%)`;
          },
        },
      },
    },
    cutout: "60%",
    responsive: true,
    maintainAspectRatio: false,
  };

  // Записи по дням недели
  const weekLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const weekData = {
    labels: weekLabels,
    datasets: [
      {
        data: weekChart,
        backgroundColor: "#f7d74f",
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };

  const weekOptions = {
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => items[0]?.label || "",
          label: (ctx) => `Записей: ${fmtInt(ctx.parsed.y || 0)}`,
        },
      },
    },
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        grid: { color: "#e5e7eb" },
        ticks: { stepSize: 2 },
      },
    },
  };

  // Динамика доходов и расходов (по кэшфлоу)
  const lineData = {
    labels: dayLineChart.labels,
    datasets: [
      {
        label: "Приход",
        data: dayLineChart.income,
        borderColor: "#f7d74f",
        backgroundColor: "rgba(247, 215, 79, 0.35)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHitRadius: 12,
      },
      {
        label: "Расход",
        data: dayLineChart.expense,
        borderColor: "#ef4444",
        backgroundColor: "rgba(248, 113, 113, 0.25)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHitRadius: 12,
      },
    ],
  };

  const lineOptions = {
    plugins: {
      legend: {
        display: true,
        position: "bottom",
        labels: { boxWidth: 12 },
      },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          label: (ctx) =>
            `${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y || 0)}`,
        },
      },
    },
    interaction: {
      mode: "index",
      intersect: false,
    },
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        grid: { color: "#e5e7eb" },
      },
    },
  };

  return (
    <div className="barber-analitika">
      <header className="ba-head">
        <h2 className="ba-title">Аналитика</h2>

        <div className="ba-filters">
          <select
            className="ba-select"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label="Год"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            className="ba-select"
            value={monthIdx}
            onChange={(e) => setMonthIdx(Number(e.target.value))}
            aria-label="Месяц"
          >
            {months.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
          <button
            className="ba-refresh"
            onClick={() => setYear((y) => y)}
            aria-label="Обновить"
            title="Обновить"
            type="button"
          >
            <RefreshCcw size={16} />
          </button>
        </div>
      </header>

      {errorMsg && <div className="ba-alert">{errorMsg}</div>}

      {/* KPI 10 карточек */}
      <section className="ba-kpis">
        {kpiCards.map((card) => (
          <div key={card.key} className="kpi">
            <div className={`kpi__icon ${card.iconClass || ""}`}>
              {card.icon}
            </div>
            <div className="kpi__name">{card.title}</div>
            <div className="kpi__val">{card.value}</div>
          </div>
        ))}
      </section>

      {/* Статусы записей (месяц, общий) */}
      <section className="ba-panel ba-panel--statuses">
        <h3 className="ba-panel__title">
          Статусы записей (месяц, общий)
        </h3>
        <div className="ba-statusList">
          {[
            {
              code: "completed",
              label: "Завершено",
              count: completedCount,
              sum: completedSum,
              color: "completed",
            },
            {
              code: "aborted",
              label: "Отменены и не пришёл",
              count: canceledCount + noShowCount,
              sum: 0,
              color: "aborted",
            },
          ].map((row) => {
            const share = totalApps
              ? Math.round((row.count / totalApps) * 100)
              : 0;
            return (
              <div key={row.code} className="ba-statusRow">
                <div className="ba-statusHead">
                  <span
                    className={`ba-badge ba-badge--${row.color}`}
                  >
                    {row.label}
                  </span>
                  <span className="ba-statusHeadRight">
                    <span className="ba-statusCount">
                      {fmtInt(row.count)} записей
                    </span>
                    <span className="ba-statusPercent">
                      {share}%
                    </span>
                  </span>
                </div>
                <div className="ba-progress">
                  <div
                    className="ba-progress__fill"
                    style={{ width: `${share}%` }}
                  />
                </div>
                {row.code === "completed" && (
                  <div className="ba-statusMoney">
                    Сумма: {fmtMoney(row.sum)}
                  </div>
                )}
              </div>
            );
          })}
          {!totalApps && (
            <div className="ba-muted">Нет данных за месяц.</div>
          )}
        </div>
      </section>

      {/* Линейный график доходы/расходы */}
      <section className="ba-panel ba-panel--lineChart">
        <h3 className="ba-panel__title">
          Динамика доходов и расходов
        </h3>
        <div className="ba-lineChart">
          <Line data={lineData} options={lineOptions} />
        </div>
      </section>

      {/* Популярные услуги и записи по дням недели */}
      <section className="ba-grid ba-grid--charts">
        <div className="ba-panel ba-panel--chart">
          <h3 className="ba-panel__title">Популярные услуги</h3>
          <div className="ba-chart">
            {popularServices.length ? (
              <Doughnut
                data={popularServicesData}
                options={popularServicesOptions}
              />
            ) : (
              <div className="ba-muted">Нет данных.</div>
            )}
          </div>
        </div>

        <div className="ba-panel ba-panel--chart">
          <h3 className="ba-panel__title">Записи по дням недели</h3>
          <div className="ba-chart ba-chart--bar">
            <Bar data={weekData} options={weekOptions} />
          </div>
        </div>
      </section>

      {/* Топ мастеров / Топ клиентов */}
      <section className="ba-grid ba-grid--tops">
        <div className="ba-panel ba-panel--list">
          <h3 className="ba-panel__title">Топ мастеров</h3>
          <ul className="ba-topList">
            {rankBarbers.slice(0, 5).map((r) => (
              <li key={r.id} className="ba-topItem">
                <div className="ba-topItem__left">
                  <div className="ba-topIcon ba-topIcon--barber">
                    <Scissors size={18} />
                  </div>
                  <div className="ba-topItem__text">
                    <div className="ba-topItem__name">{r.name}</div>
                    <div className="ba-topItem__sub">
                      {fmtInt(r.count)} записей
                    </div>
                  </div>
                </div>
                <div className="ba-topItem__sum">
                  {fmtMoney(r.sum)}
                </div>
              </li>
            ))}
            {!rankBarbers.length && (
              <li className="ba-topEmpty">Нет данных.</li>
            )}
          </ul>
        </div>

        <div className="ba-panel ba-panel--list">
          <h3 className="ba-panel__title">Топ клиентов</h3>
          <ul className="ba-topList">
            {rankClientsVisits.slice(0, 5).map((r) => (
              <li key={r.id} className="ba-topItem">
                <div className="ba-topItem__left">
                  <div className="ba-topIcon ba-topIcon--client">
                    <Users2 size={18} />
                  </div>
                  <div className="ba-topItem__text">
                    <div className="ba-topItem__name">{r.name}</div>
                    <div className="ba-topItem__sub">
                      {fmtInt(r.count)} визитов
                    </div>
                  </div>
                </div>
                <div className="ba-topItem__sum">
                  {fmtMoney(r.sum)}
                </div>
              </li>
            ))}
            {!rankClientsVisits.length && (
              <li className="ba-topEmpty">Нет данных.</li>
            )}
          </ul>
        </div>
      </section>

      {/* Товары (продажи) и Клиенты (продажи) — как на 3-ей фотке */}
      <section className="ba-grid ba-grid--cards">
        <BarberAnalitikaCard
          icon={<PackageSearch size={16} />}
          title="Товары (продажи)"
          columns={[
            { key: "name", title: "Товар", className: "ba-ellipsis" },
            { key: "qty", title: "Кол-во" },
            {
              key: "revenue",
              title: "Выручка",
              className: "ba-money",
              render: (r) => `${fmt(r.revenue)} c`,
            },
          ]}
          rows={loadingProducts ? [] : productsRowsAgg}
          onOpenModal={openModal}
        />

        <BarberAnalitikaCard
          icon={<Users2 size={16} />}
          title="Клиенты (продажи)"
          columns={[
            { key: "name", title: "Клиент", className: "ba-ellipsis" },
            { key: "orders", title: "Заказы" },
            {
              key: "revenue",
              title: "Выручка",
              className: "ba-money",
              render: (r) => `${fmt(r.revenue)} c`,
            },
          ]}
          rows={clientsSalesRows}
          onOpenModal={openModal}
        />
      </section>

      {modal.open && (
        <BarberAnalitikaDetailsModal
          title={modal.title}
          columns={modal.columns}
          rows={modal.rows}
          getKey={(r, i) => `${modal.title}-${i}`}
          onClose={closeModal}
          pageSize={12}
        />
      )}
    </div>
  );
};

export default BarberAnalitika;
