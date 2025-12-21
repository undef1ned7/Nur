import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import api from "../../../api";
import { useUser } from "../../../store/slices/userSlice";
import AgentAnalytics from "../../Sectors/Production/Analytics/AgentAnalytics";

import "./Analytics.scss";

/* -------------------- helpers -------------------- */
const parseISO = (s) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* -------------------- Export helpers -------------------- */
const exportToCSV = (data, filename) => {
  if (!data || !data.length) {
    alert("Нет данных для экспорта");
    return;
  }
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (value === null || value === undefined) return "";
          if (typeof value === "object") return JSON.stringify(value);
          return String(value).replace(/"/g, '""');
        })
        .map((v) => `"${v}"`)
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `${filename}_${new Date().toISOString().split("T")[0]}.csv`
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/* -------------------- tiny SVG sparkline -------------------- */
/* -------------------- tiny SVG sparkline -------------------- */
const Sparkline = ({ values = [], width = 520, height = 140 }) => {
  if (!values.length) {
    return <div className="analytics-sales__sparkline-empty">Нет данных</div>;
  }
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
      className="analytics-sales__sparkline"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="График динамики"
    >
      {/* ось X */}
      <polyline
        fill="none"
        stroke="var(--c-border)"
        strokeWidth="1"
        points={`${pad},${height - pad} ${width - pad},${height - pad}`}
      />
      {/* линия — жёлтая */}
      <path d={d} fill="none" stroke="var(--c-accent)" strokeWidth="2.5" />
      {/* точки — жёлтые */}
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.6" fill="var(--c-accent)" />
      ))}
    </svg>
  );
};

/* ============================================================= */

const Analytics = () => {
  // из userSlice
  const { profile, sector, company } = useUser();

  /* ---------- controls ---------- */
  // По умолчанию: месяц (последние 30 дней)
  const [period, setPeriod] = useState("month"); // day | week | month | custom
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [dateFrom, setDateFrom] = useState(() => {
    const n = new Date();
    const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [groupBy, setGroupBy] = useState("day"); // day | week | month

  /* ---------- data state ---------- */
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* ---------- fetch analytics ---------- */
  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        period,
        group_by: groupBy,
      };

      // Добавляем даты в зависимости от period
      if (period === "day") {
        if (date) params.date = date;
        else if (dateFrom) params.date_from = dateFrom;
        else if (dateTo) params.date_to = dateTo;
      } else if (period === "week") {
        if (dateTo) params.date_to = dateTo;
        if (dateFrom) params.date_from = dateFrom;
      } else if (period === "month" || period === "custom") {
        if (dateTo) params.date_to = dateTo;
        if (dateFrom) params.date_from = dateFrom;
      }

      const response = await api.get("/main/owners/analytics/", { params });
      setAnalyticsData(response.data);
    } catch (err) {
      console.error("Ошибка при загрузке аналитики:", err);
      if (err.response?.status === 403) {
        setError("Доступ запрещен. Требуются права owner/admin.");
      } else if (err.response?.status === 400) {
        setError(err.response?.data?.detail || "Ошибка запроса");
      } else {
        setError("Не удалось загрузить аналитику");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, date, dateFrom, dateTo, groupBy]);

  /* ---------- formatters ---------- */
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

  /* ---------- quick presets ---------- */
  const quickPreset = (preset) => {
    const now = new Date();
    if (preset === "day") {
      setPeriod("day");
      setDate(now.toISOString().slice(0, 10));
      setGroupBy("day");
    } else if (preset === "week") {
      setPeriod("week");
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 6);
      setDateFrom(weekAgo.toISOString().slice(0, 10));
      setDateTo(now.toISOString().slice(0, 10));
      setGroupBy("day");
    } else if (preset === "month") {
      setPeriod("month");
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 29);
      setDateFrom(monthAgo.toISOString().slice(0, 10));
      setDateTo(now.toISOString().slice(0, 10));
      setGroupBy("day");
    } else if (preset === "custom") {
      setPeriod("custom");
      // Оставляем текущие даты
    }
  };

  /* ---------- format date by group_by ---------- */
  const formatDateLabel = (dateStr, groupBy) => {
    if (!dateStr) return "—";
    const d = parseISO(dateStr);
    if (!d) return dateStr;

    if (groupBy === "day") {
      return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
    } else if (groupBy === "week") {
      const weekStart = new Date(d);
      const dayOfWeek = weekStart.getDay();
      const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      weekStart.setDate(diff);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return `Неделя от ${weekStart.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
      })}`;
    } else if (groupBy === "month") {
      return d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
    }
    return dateStr;
  };

  /* ====================== Data extraction ====================== */
  const summary = analyticsData?.summary || {};
  const charts = analyticsData?.charts || {};
  const periodInfo = analyticsData?.period || {};

  // Sales by date chart
  const salesByDate = charts?.sales_by_date || [];
  const salesChartData = useMemo(() => {
    return {
      labels: salesByDate.map((item) => formatDateLabel(item.date, groupBy)),
      values: salesByDate.map((item) => num(item.sales_amount)),
      counts: salesByDate.map((item) => item.sales_count),
    };
  }, [salesByDate, groupBy]);

  // Transfers by date chart
  const transfersByDate = charts?.transfers_by_date || [];
  const transfersChartData = useMemo(() => {
        return {
      labels: transfersByDate.map((item) =>
        formatDateLabel(item.date, groupBy)
      ),
      values: transfersByDate.map((item) => item.items_transferred),
      counts: transfersByDate.map((item) => item.transfers_count),
    };
  }, [transfersByDate, groupBy]);

  /* ====================== Export functions ====================== */
  const exportAnalytics = () => {
    if (!analyticsData) {
      alert("Нет данных для экспорта");
      return;
    }

    const data = [
      {
        Период: `${periodInfo.date_from} - ${periodInfo.date_to}`,
        Пользователей: summary.users_count || 0,
        Передач: summary.transfers_count || 0,
        Принятий: summary.acceptances_count || 0,
        "Товаров передано": summary.items_transferred || 0,
        "Продаж": summary.sales_count || 0,
        "Сумма продаж": summary.sales_amount || "0.00",
      },
    ];
    exportToCSV(data, "analytics_summary");
  };

  /* ====================== UI ====================== */
  // Проверяем, является ли пользователь филиалом
  // Если у пользователя есть branch_ids, это означает, что он является филиалом
  const isBranchUser =
    profile?.branch_ids &&
    Array.isArray(profile.branch_ids) &&
    profile.branch_ids.length > 0;

  // Проверяем, является ли пользователь сотрудником в сфере "Производство"
  const isProductionEmployee = useMemo(() => {
    const currentSector = sector || company?.sector?.name || "";
    const sectorLower = currentSector.toLowerCase();
    const isProduction =
      sectorLower === "производство" || sectorLower === "production";
    const isEmployee =
      profile?.role_display && profile.role_display !== "Владелец";
    return isProduction && isEmployee;
  }, [sector, company, profile]);

  // Если пользователь - сотрудник в сфере Производство, показываем AgentAnalytics
  if (isProductionEmployee) {
    return <AgentAnalytics />;
  }

  return (
    <div className="analytics">
      {/* Header with actions */}
      <div className="analytics__header">
        <h2 className="analytics__title">Аналитика владельца</h2>
        <div className="analytics__actions">
          <button
            onClick={fetchAnalytics}
            className="analytics__refresh-btn"
            title="Обновить данные"
            disabled={loading}
          >
            <RefreshCw size={16} />
            <span className="analytics__refresh-text">Обновить</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "#fee",
            border: "1px solid #fcc",
            borderRadius: 8,
            color: "#c33",
            marginBottom: 20,
          }}
        >
          {error}
      </div>
      )}

      {/* Filters */}
          <div className="analytics-sales__controls">
            <div
              className="analytics-sales__presets"
              role="group"
              aria-label="Быстрые периоды"
            >
          <button
            onClick={() => quickPreset("day")}
            className={period === "day" ? "is-active" : ""}
          >
            День
              </button>
          <button
            onClick={() => quickPreset("week")}
            className={period === "week" ? "is-active" : ""}
          >
            Неделя
              </button>
          <button
            onClick={() => quickPreset("month")}
            className={period === "month" ? "is-active" : ""}
          >
            Месяц
          </button>
          <button
            onClick={() => quickPreset("custom")}
            className={period === "custom" ? "is-active" : ""}
          >
            Произвольный
              </button>
            </div>
            <div className="analytics-sales__range">
          {period === "day" && (
            <label className="analytics-sales__label">
              Дата
              <input
                type="date"
                className="analytics-sales__input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
              />
            </label>
          )}
          {(period === "week" || period === "month" || period === "custom") && (
            <>
              <label className="analytics-sales__label">
                С
                <input
                  type="date"
                  className="analytics-sales__input"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  max={dateTo || new Date().toISOString().slice(0, 10)}
                />
              </label>
              <label className="analytics-sales__label">
                До
                <input
                  type="date"
                  className="analytics-sales__input"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </label>
            </>
          )}

              <div
                className="analytics-sales__segmented"
                role="group"
            aria-label="Группировка"
              >
                <button
              className={groupBy === "day" ? "is-active" : ""}
              onClick={() => setGroupBy("day")}
                >
                  Дни
                </button>
                <button
              className={groupBy === "week" ? "is-active" : ""}
              onClick={() => setGroupBy("week")}
                >
              Недели
                </button>
                <button
              className={groupBy === "month" ? "is-active" : ""}
              onClick={() => setGroupBy("month")}
                >
              Месяцы
                </button>
              </div>
            </div>
          </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="analytics-sales__note">Загрузка данных…</div>
      ) : analyticsData ? (
        <>
          <div className="analytics-sales__kpis">
            <div className="analytics-sales__kpi">
              <div className="analytics-sales__kpi-label">Пользователей</div>
              <div className="analytics-sales__kpi-value">
                {nfInt.format(summary.users_count || 0)}
              </div>
            </div>
            <div className="analytics-sales__kpi">
              <div className="analytics-sales__kpi-label">Передач</div>
              <div className="analytics-sales__kpi-value">
                {nfInt.format(summary.transfers_count || 0)}
              </div>
            </div>
            <div className="analytics-sales__kpi">
              <div className="analytics-sales__kpi-label">Принятий</div>
              <div className="analytics-sales__kpi-value">
                {nfInt.format(summary.acceptances_count || 0)}
              </div>
            </div>
            <div className="analytics-sales__kpi">
              <div className="analytics-sales__kpi-label">Товаров передано</div>
              <div className="analytics-sales__kpi-value">
                {nfInt.format(summary.items_transferred || 0)}
              </div>
            </div>
            <div className="analytics-sales__kpi">
              <div className="analytics-sales__kpi-label">Продаж</div>
              <div className="analytics-sales__kpi-value">
                {nfInt.format(summary.sales_count || 0)}
              </div>
            </div>
            <div className="analytics-sales__kpi">
              <div className="analytics-sales__kpi-label">Сумма продаж</div>
              <div className="analytics-sales__kpi-value">
                {nfMoney.format(num(summary.sales_amount || "0"))}
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="analytics-sales__card">
                <div className="analytics-sales__card-title">
              Динамика продаж ({groupBy === "day" ? "дни" : groupBy === "week" ? "недели" : "месяцы"})
                </div>
            {salesChartData.values.length > 0 ? (
              <>
                <Sparkline values={salesChartData.values} />
                <div className="analytics-sales__legend">
                  {salesChartData.labels.map((l, i) => (
                    <span className="analytics-sales__legend-item" key={i}>
                      {l}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="analytics-sales__note">Нет данных</div>
            )}
          </div>

          <div className="analytics-sales__card">
              <div className="analytics-sales__card-title">
              Динамика передач ({groupBy === "day" ? "дни" : groupBy === "week" ? "недели" : "месяцы"})
              </div>
            {transfersChartData.values.length > 0 ? (
              <>
                <Sparkline values={transfersChartData.values} />
                <div className="analytics-sales__legend">
                  {transfersChartData.labels.map((l, i) => (
                      <span className="analytics-sales__legend-item" key={i}>
                        {l}
                      </span>
                    ))}
                  </div>
                </>
            ) : (
              <div className="analytics-sales__note">Нет данных</div>
              )}
            </div>

          {/* Tables */}
          <div className="analytics-sales__card">
            <div className="analytics-sales__card-title">
              Топ товаров по продажам
              </div>
            {charts?.top_products_by_sales?.length > 0 ? (
              <div className="analytics-sales__table-wrap">
                <table className="analytics-sales__table">
                  <thead>
                    <tr>
                      <th>Товар</th>
                      <th>Количество</th>
                      <th>Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {charts.top_products_by_sales.map((item, i) => (
                      <tr key={item.product_id || i}>
                        <td>{item.product_name || "—"}</td>
                        <td>{nfInt.format(item.qty || 0)}</td>
                        <td>{nfMoney.format(num(item.amount || "0"))}</td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="analytics-sales__note">Нет данных</div>
            )}
          </div>

          <div className="analytics-sales__card">
            <div className="analytics-sales__card-title">
              Топ пользователей по продажам
              </div>
            {charts?.top_users_by_sales?.length > 0 ? (
              <div className="analytics-sales__table-wrap">
              <table className="analytics-sales__table">
                <thead>
                  <tr>
                      <th>Пользователь</th>
                      <th>Роль</th>
                      <th>Продаж</th>
                    <th>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                    {charts.top_users_by_sales.map((item, i) => (
                      <tr key={item.user_id || i}>
                        <td>{item.user_name || "—"}</td>
                        <td>{item.role || "—"}</td>
                        <td>{nfInt.format(item.sales_count || 0)}</td>
                        <td>{nfMoney.format(num(item.sales_amount || "0"))}</td>
                    </tr>
                    ))}
                </tbody>
              </table>
                  </div>
            ) : (
              <div className="analytics-sales__note">Нет данных</div>
                )}
          </div>

          <div className="analytics-sales__card">
            <div className="analytics-sales__card-title">
              Топ пользователей по передачам
          </div>
            {charts?.top_users_by_transfers?.length > 0 ? (
              <div className="analytics-sales__table-wrap">
                <table className="analytics-sales__table">
                  <thead>
                    <tr>
                      <th>Пользователь</th>
                      <th>Роль</th>
                      <th>Передач</th>
                      <th>Товаров передано</th>
                    </tr>
                  </thead>
                  <tbody>
                    {charts.top_users_by_transfers.map((item, i) => (
                      <tr key={item.user_id || i}>
                        <td>{item.user_name || "—"}</td>
                        <td>{item.role || "—"}</td>
                        <td>{nfInt.format(item.transfers_count || 0)}</td>
                        <td>{nfInt.format(item.items_transferred || 0)}</td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="analytics-sales__note">Нет данных</div>
            )}
              </div>

          {/* Pie Chart for Sales Distribution */}
          {charts?.sales_distribution_by_product?.length > 0 && (
            <div className="analytics-sales__card">
              <div className="analytics-sales__card-title">
                Распределение продаж по товарам
          </div>
              <div style={{ padding: "20px" }}>
                {charts.sales_distribution_by_product.map((item, i) => {
                  const percent = num(item.percent || 0);
                  return (
                    <div
                      key={item.product_id || i}
                        style={{
                        marginBottom: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div
                          style={{
                          width: `${percent}%`,
                          height: 24,
                          background: "var(--c-accent)",
                          borderRadius: 4,
                          display: "flex",
                          alignItems: "center",
                          padding: "0 8px",
                          color: "#000",
                          fontWeight: 500,
                          minWidth: "fit-content",
                        }}
                      >
                        {percent > 5 ? `${percent.toFixed(1)}%` : ""}
                      </div>
                      <span style={{ flex: 1, fontSize: 14 }}>
                        {item.product_name || "—"}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>
                        {nfMoney.format(num(item.amount || "0"))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="analytics-sales__note">
          {error || "Нет данных для отображения"}
        </div>
      )}
    </div>
  );
};

export default Analytics;
