// BarberAnalitika.jsx
import React, { useMemo, useState } from "react";
import {
  FiRefreshCcw,
  FiUsers,
  FiPackage,
  FiBox,
  FiCalendar,
  FiScissors,
  FiShoppingCart,
  FiDollarSign,
  FiTrendingUp,
  FiTrendingDown,
  FiLoader,
  FiCreditCard,
  FiTruck,
  FiTarget,
  FiActivity,
  FiStar,
} from "react-icons/fi";
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
import { BarberAnalitikaDetailsModal, BarberAnalitikaCard } from "./components";
import { fmt, fmtInt, fmtMoney, months } from "./BarberAnalitikaUtils";
import { useBarberAnalitikaData } from "./BarberAnalitikaData";
import BarberSelect from "../common/BarberSelect";

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
    productsRowsAgg,
    loadingProducts,
    suppliersRows,
    clientsSalesRows,
    unifiedIncome,
    unifiedExpense,
    weekChart,
    dayLineChart,
    bookingsStatusesData,
    topServicesByBookings,
  } = useBarberAnalitikaData({ year, monthIdx });

  const [modal, setModal] = useState({
    open: false,
    title: "",
    columns: [],
    rows: [],
  });

  const openModal = (payload) => setModal({ open: true, ...payload });
  const closeModal = () => setModal((m) => ({ ...m, open: false }));

  const years = useMemo(() => [2025, 2026, 2027], []);

  /* ===== опции для комбобоксов ===== */
  const yearOptions = useMemo(
    () => years.map((y) => ({ value: String(y), label: String(y) })),
    [years]
  );

  const monthOptions = useMemo(
    () => months.map((m, i) => ({ value: String(i), label: m })),
    []
  );

  /* ===== вычисляемые метрики ===== */
  const avgCheck = completedCount > 0 ? completedSum / completedCount : 0;
  const netProfit = unifiedIncome - unifiedExpense;
  const conversionRate = totalApps > 0 ? (completedCount / totalApps) * 100 : 0;

  // Самый загруженный день недели
  const weekDayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const busiestDayIdx = weekChart.indexOf(Math.max(...weekChart));
  const busiestDay = weekChart[busiestDayIdx] > 0 
    ? { name: weekDayNames[busiestDayIdx], count: weekChart[busiestDayIdx] }
    : null;

  /* ===== KPI карточки ===== */
  const kpiCards = [
    {
      key: "income",
      title: "Приход (месяц)",
      value: fmtMoney(unifiedIncome),
      icon: <FiTrendingUp size={20} />,
      iconMod: "yellow",
    },
    {
      key: "expense",
      title: "Расход (месяц)",
      value: fmtMoney(unifiedExpense),
      icon: <FiTrendingDown size={20} />,
      iconMod: "red",
    },
    {
      key: "profit",
      title: "Прибыль (месяц)",
      value: fmtMoney(netProfit),
      icon: <FiActivity size={20} />,
      iconMod: netProfit >= 0 ? "green" : "red",
    },
    {
      key: "avgCheck",
      title: "Средний чек",
      value: fmtMoney(avgCheck),
      icon: <FiDollarSign size={20} />,
      iconMod: "cyan",
    },
    {
      key: "conversion",
      title: "Конверсия записей",
      value: `${fmtInt(Math.round(conversionRate))}%`,
      icon: <FiTarget size={20} />,
      iconMod: conversionRate >= 70 ? "green" : conversionRate >= 50 ? "orange" : "red",
    },
    {
      key: "apps",
      title: "Записей (месяц)",
      value: fmtInt(totalApps),
      icon: <FiCalendar size={20} />,
      iconMod: "blue",
    },
    {
      key: "services",
      title: "Услуг (всего)",
      value: fmtInt(totalServices),
      icon: <FiScissors size={20} />,
      iconMod: "purple",
    },
    {
      key: "clientsBarber",
      title: "Клиенты барбершоп",
      value: fmtInt(totalClientsBarber),
      icon: <FiUsers size={20} />,
      iconMod: "green",
    },
    {
      key: "clientsMarket",
      title: "Клиенты продаж",
      value: fmtInt(totalClientsMarket),
      icon: <FiShoppingCart size={20} />,
      iconMod: "orange",
    },
    {
      key: "busiestDay",
      title: "Загруженный день",
      value: busiestDay ? `${busiestDay.name} (${busiestDay.count})` : "—",
      icon: <FiStar size={20} />,
      iconMod: "pink",
    },
  ];

  /* ===== диаграммы ===== */

  // Популярные услуги
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
        backgroundColor: "#facc15",
        hoverBackgroundColor: "#eab308",
        borderRadius: 8,
        borderSkipped: false,
        barThickness: 32,
      },
    ],
  };

  const weekOptions = {
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.9)",
        titleFont: { size: 13, weight: 500 },
        bodyFont: { size: 12, weight: 400 },
        padding: 10,
        borderRadius: 8,
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
        ticks: { font: { size: 12, weight: 400 }, color: "#6b7280" },
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(0, 0, 0, 0.04)", drawBorder: false },
        ticks: { stepSize: 2, font: { size: 11, weight: 400 }, color: "#9ca3af" },
      },
    },
  };

  // Линия доходы / расходы
  const lineData = {
    labels: dayLineChart.labels,
    datasets: [
      {
        label: "Приход",
        data: dayLineChart.income,
        borderColor: "#eab308",
        backgroundColor: "rgba(250, 204, 21, 0.15)",
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHitRadius: 12,
        borderWidth: 2,
      },
      {
        label: "Расход",
        data: dayLineChart.expense,
        borderColor: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.08)",
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHitRadius: 12,
        borderWidth: 2,
      },
    ],
  };

  const lineOptions = {
    plugins: {
      legend: {
        display: true,
        position: "bottom",
        labels: { 
          boxWidth: 10,
          boxHeight: 10,
          borderRadius: 5,
          useBorderRadius: true,
          padding: 16,
          font: { size: 12, weight: 400 },
        },
      },
      tooltip: {
        mode: "index",
        intersect: false,
        backgroundColor: "rgba(15, 23, 42, 0.9)",
        titleFont: { size: 13, weight: 500 },
        bodyFont: { size: 12, weight: 400 },
        padding: 12,
        borderRadius: 8,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y || 0)}`,
        },
      },
    },
    interaction: { mode: "index", intersect: false },
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { 
        grid: { display: false },
        ticks: { font: { size: 11, weight: 400 }, color: "#9ca3af" },
      },
      y: { 
        beginAtZero: true, 
        grid: { color: "rgba(0, 0, 0, 0.04)", drawBorder: false },
        ticks: { font: { size: 11, weight: 400 }, color: "#9ca3af" },
      },
    },
  };

  return (
    <div className="barber-analitika">
      <header className="barber-analitika__head">
        <h2 className="barber-analitika__title">Аналитика</h2>

        <div className="barber-analitika__filters">
          <div className="barber-analitika__combo">
            <BarberSelect
              value={String(year)}
              onChange={(val) => setYear(Number(val))}
              options={yearOptions}
              placeholder="Год"
              hideClear
            />
          </div>

          <div className="barber-analitika__combo">
            <BarberSelect
              value={String(monthIdx)}
              onChange={(val) => setMonthIdx(Number(val))}
              options={monthOptions}
              placeholder="Месяц"
              hideClear
            />
          </div>
        </div>
      </header>

      {errorMsg && <div className="barber-analitika__alert">{errorMsg}</div>}

      {/* Индикатор загрузки */}
      {loading && (
        <div className="barber-analitika__loading">
          <FiLoader className="barber-analitika__spinner" size={32} />
          <span>Загрузка данных...</span>
        </div>
      )}

      {/* KPI карточки */}
      <section className="barber-analitika__kpis">
        {kpiCards.map((card) => (
          <div key={card.key} className="barber-analitika__kpi">
            <div
              className={`barber-analitika__kpi-icon barber-analitika__kpi-icon--${card.iconMod}`}
            >
              {card.icon}
            </div>
            <div className="barber-analitika__kpi-name">{card.title}</div>
            <div className="barber-analitika__kpi-val">{card.value}</div>
          </div>
        ))}
      </section>

      {/* Статусы записей */}
      <section className="barber-analitika__panel barber-analitika__panel--statuses">
        <h3 className="barber-analitika__panel-title">
          Статусы записей (месяц, общий)
        </h3>

        <div className="barber-analitika__status-list">
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
              <div key={row.code} className="barber-analitika__status-row">
                <div className="barber-analitika__status-head">
                  <span
                    className={`barber-analitika__badge barber-analitika__badge--${row.color}`}
                  >
                    {row.label}
                  </span>
                  <span className="barber-analitika__status-headRight">
                    <span className="barber-analitika__status-count">
                      {fmtInt(row.count)} записей
                    </span>
                    <span className="barber-analitika__status-percent">
                      {share}%
                    </span>
                  </span>
                </div>

                <div className="barber-analitika__progress">
                  <div
                    className="barber-analitika__progress-fill"
                    style={{ width: `${share}%` }}
                  />
                </div>

                {row.code === "completed" && (
                  <div className="barber-analitika__status-money">
                    Сумма: {fmtMoney(row.sum)}
                  </div>
                )}
              </div>
            );
          })}

          {!totalApps && (
            <div className="barber-analitika__muted">Нет данных за месяц.</div>
          )}
        </div>
      </section>

      {/* Статусы заявок (кроме новых) */}
      {bookingsStatusesData && bookingsStatusesData.length > 0 && (
        <section className="barber-analitika__panel barber-analitika__panel--request-statuses">
          <h3 className="barber-analitika__panel-title">
            Статусы заявок
          </h3>
          <div className="barber-analitika__request-statuses-list">
            {bookingsStatusesData.map((item) => (
              <div
                key={item.status}
                className="barber-analitika__request-status-badge-item"
              >
                <span className="barber-analitika__request-status-label">
                  {item.label}
                </span>
                <span className="barber-analitika__request-status-badge-count">
                  {fmtInt(item.count)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Топ 5 услуг по заявкам */}
      {topServicesByBookings && topServicesByBookings.length > 0 && (
        <section className="barber-analitika__panel barber-analitika__panel--top-services">
          <h3 className="barber-analitika__panel-title">Топ 5 услуг по заявкам</h3>
          <div className="barber-analitika__top-services-list">
            {topServicesByBookings.map((service, idx) => (
              <div key={service.id || idx} className="barber-analitika__top-service-item">
                <div className="barber-analitika__top-service-left">
                  <div className="barber-analitika__top-service-rank">
                    {idx + 1}
                  </div>
                  <div className="barber-analitika__top-service-info">
                    <div className="barber-analitika__top-service-name">
                      {service.name}
                    </div>
                    <div className="barber-analitika__top-service-details">
                      {fmtInt(service.count)} заявок
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Линейный график */}
      <section className="barber-analitika__panel barber-analitika__panel--line">
        <h3 className="barber-analitika__panel-title">
          Динамика доходов и расходов
        </h3>
        <div className="barber-analitika__line-chart">
          <Line data={lineData} options={lineOptions} />
        </div>
      </section>

      {/* Популярные услуги и дни недели */}
      <section className="barber-analitika__grid barber-analitika__grid--charts">
        <div className="barber-analitika__panel barber-analitika__panel--chart">
          <h3 className="barber-analitika__panel-title">Популярные услуги</h3>
          <div className="barber-analitika__chart">
            {popularServices.length ? (
              <Doughnut
                data={popularServicesData}
                options={popularServicesOptions}
              />
            ) : (
              <div className="barber-analitika__muted">Нет данных.</div>
            )}
          </div>
        </div>

        <div className="barber-analitika__panel barber-analitika__panel--chart">
          <h3 className="barber-analitika__panel-title">
            Записи по дням недели
          </h3>
          <div className="barber-analitika__chart barber-analitika__chart--bar">
            <Bar data={weekData} options={weekOptions} />
          </div>
        </div>
      </section>

      {/* Топ мастеров / Топ клиентов */}
      <section className="barber-analitika__grid barber-analitika__grid--tops">
        <div className="barber-analitika__panel barber-analitika__panel--list">
          <h3 className="barber-analitika__panel-title">Топ мастеров</h3>
          <ul className="barber-analitika__top-list">
            {rankBarbers.slice(0, 5).map((r) => (
              <li key={r.id} className="barber-analitika__top-item">
                <div className="barber-analitika__top-item-left">
                  <div className="barber-analitika__top-icon barber-analitika__top-icon--barber">
                    <FiScissors size={18} />
                  </div>
                  <div className="barber-analitika__top-item-text">
                    <div className="barber-analitika__top-item-name">
                      {r.name}
                    </div>
                    <div className="barber-analitika__top-item-sub">
                      {fmtInt(r.count)} записей
                    </div>
                  </div>
                </div>
                <div className="barber-analitika__top-item-sum">
                  {fmtMoney(r.sum)}
                </div>
              </li>
            ))}
            {!rankBarbers.length && (
              <li className="barber-analitika__top-empty">Нет данных.</li>
            )}
          </ul>
        </div>

        <div className="barber-analitika__panel barber-analitika__panel--list">
          <h3 className="barber-analitika__panel-title">Топ клиентов</h3>
          <ul className="barber-analitika__top-list">
            {rankClientsVisits.slice(0, 5).map((r) => (
              <li key={r.id} className="barber-analitika__top-item">
                <div className="barber-analitika__top-item-left">
                  <div className="barber-analitika__top-icon barber-analitika__top-icon--client">
                    <FiUsers size={18} />
                  </div>
                  <div className="barber-analitika__top-item-text">
                    <div className="barber-analitika__top-item-name">
                      {r.name}
                    </div>
                    <div className="barber-analitika__top-item-sub">
                      {fmtInt(r.count)} визитов
                    </div>
                  </div>
                </div>
                <div className="barber-analitika__top-item-sum">
                  {fmtMoney(r.sum)}
                </div>
              </li>
            ))}
            {!rankClientsVisits.length && (
              <li className="barber-analitika__top-empty">Нет данных.</li>
            )}
          </ul>
        </div>
      </section>

      {/* Карточки: услуги, товары, клиенты, кассы, поставщики */}
      <section className="barber-analitika__grid barber-analitika__grid--cards">
        <BarberAnalitikaCard
          icon={<FiScissors size={16} />}
          title="Топ услуг (месяц)"
          columns={[
            { key: "name", title: "Услуга", className: "barber-analitika-table__ellipsis" },
            { key: "count", title: "Кол-во" },
            {
              key: "sum",
              title: "Выручка",
              className: "barber-analitika-table__money",
              render: (r) => `${fmt(r.sum)} c`,
            },
          ]}
          rows={rankServices}
          onOpenModal={openModal}
        />

        <BarberAnalitikaCard
          icon={<FiPackage size={16} />}
          title="Товары (продажи)"
          columns={[
            { key: "name", title: "Товар", className: "barber-analitika-table__ellipsis" },
            { key: "qty", title: "Кол-во" },
            {
              key: "revenue",
              title: "Выручка",
              className: "barber-analitika-table__money",
              render: (r) => `${fmt(r.revenue)} c`,
            },
          ]}
          rows={loadingProducts ? [] : productsRowsAgg}
          onOpenModal={openModal}
        />

        <BarberAnalitikaCard
          icon={<FiUsers size={16} />}
          title="Клиенты (продажи)"
          columns={[
            { key: "name", title: "Клиент", className: "barber-analitika-table__ellipsis" },
            { key: "orders", title: "Заказы" },
            {
              key: "revenue",
              title: "Выручка",
              className: "barber-analitika-table__money",
              render: (r) => `${fmt(r.revenue)} c`,
            },
          ]}
          rows={clientsSalesRows}
          onOpenModal={openModal}
        />

        <BarberAnalitikaCard
          icon={<FiCreditCard size={16} />}
          title="Кассы (месяц)"
          columns={[
            { key: "name", title: "Касса", className: "barber-analitika-table__ellipsis" },
            { key: "ops", title: "Операций" },
            {
              key: "income",
              title: "Приход",
              className: "barber-analitika-table__money",
              render: (r) => `${fmt(r.income)} c`,
            },
            {
              key: "expense",
              title: "Расход",
              className: "barber-analitika-table__money",
              render: (r) => `${fmt(r.expense)} c`,
            },
          ]}
          rows={loadingCash ? [] : cashRows}
          onOpenModal={openModal}
        />

        <BarberAnalitikaCard
          icon={<FiTruck size={16} />}
          title="Поставщики (месяц)"
          columns={[
            { key: "name", title: "Поставщик", className: "barber-analitika-table__ellipsis" },
            { key: "items", title: "Позиций" },
            {
              key: "amount",
              title: "Сумма",
              className: "barber-analitika-table__money",
              render: (r) => `${fmt(r.amount)} c`,
            },
          ]}
          rows={suppliersRows}
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
