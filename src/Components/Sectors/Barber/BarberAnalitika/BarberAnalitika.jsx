// BarberAnalitika.jsx
import React, { useMemo, useState } from "react";
import {
  RefreshCcw,
  Users2,
  PackageSearch,
  Boxes,
  CalendarDays,
  Scissors,
  ShoppingCart,
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
      iconMod: "yellow",
    },
    {
      key: "expense",
      title: "Расход (месяц, общий)",
      value: fmtMoney(unifiedExpense),
      icon: <TrendingDown size={20} />,
      iconMod: "red",
    },
    {
      key: "apps",
      title: "Записей (месяц)",
      value: fmtInt(totalApps),
      icon: <CalendarDays size={20} />,
      iconMod: "blue",
    },
    {
      key: "services",
      title: "Услуг (всего)",
      value: fmtInt(totalServices),
      icon: <Scissors size={20} />,
      iconMod: "purple",
    },
    {
      key: "clientsBarber",
      title: "Клиенты барбершоп (всего)",
      value: fmtInt(totalClientsBarber),
      icon: <Users2 size={20} />,
      iconMod: "green",
    },
    {
      key: "clientsMarket",
      title: "Клиенты продаж (всего)",
      value: fmtInt(totalClientsMarket),
      icon: <ShoppingCart size={20} />,
      iconMod: "orange",
    },

    // ❌ УБРАЛИ "Кассы (месяц, общий)"

    {
      key: "positions",
      title: "Позиции (всего)",
      value: fmtInt(stockKpis.positions),
      icon: <Boxes size={20} />,
      iconMod: "pink",
    },
    {
      key: "qty",
      title: "Штук на складе (всего)",
      value: fmtInt(stockKpis.totalQty),
      icon: <PackageSearch size={20} />,
      iconMod: "indigo",
    },
    {
      key: "stockValue",
      title: "Оценка запасов (всего)",
      value: fmtMoney(stockKpis.stockValueRetail),
      icon: <DollarSign size={20} />,
      iconMod: "cyan",
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
      x: { grid: { display: false } },
      y: {
        beginAtZero: true,
        grid: { color: "#e5e7eb" },
        ticks: { stepSize: 2 },
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
          label: (ctx) => `${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y || 0)}`,
        },
      },
    },
    interaction: { mode: "index", intersect: false },
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, grid: { color: "#e5e7eb" } },
    },
  };

  return (
    <div className="barber-analitika">
      <header className="barber-analitika__head">
        <h2 className="barber-analitika__title">Аналитика</h2>

        <div className="barber-analitika__filters">
          <select
            className="barber-analitika__select"
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
            className="barber-analitika__select"
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
            className="barber-analitika__refresh"
            onClick={() => setYear((y) => y)}
            aria-label="Обновить"
            title="Обновить"
            type="button"
          >
            <RefreshCcw size={16} />
          </button>
        </div>
      </header>

      {errorMsg && <div className="barber-analitika__alert">{errorMsg}</div>}

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
                    <Scissors size={18} />
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
                    <Users2 size={18} />
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

      {/* Карточки: товары и клиенты продаж */}
      <section className="barber-analitika__grid barber-analitika__grid--cards">
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
