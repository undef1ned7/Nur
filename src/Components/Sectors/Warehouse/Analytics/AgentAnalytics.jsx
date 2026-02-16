/**
 * Аналитика агента склада.
 * Ожидаемый ответ API (getAgentMeAnalytics):
 * {
 *   period, date_from, date_to,
 *   summary: { requests_approved, items_approved, sales_count, sales_amount, on_hand_qty, on_hand_amount },
 *   charts: { sales_by_date: [] },
 *   top_agents: { by_sales: [], by_received: [{ agent_id, agent_name, items_approved }] }
 * }
 */
import {
  Check,
  Package,
  RefreshCw,
  ShoppingCart,
  ChevronDown,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { getAgentMeAnalytics, getOwnerAgentAnalytics } from "../../../../api/warehouse";
import "./Analytics.scss";

const PERIODS = [
  { value: "day", label: "День" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "custom", label: "Период" },
];

const formatNum = (v) => {
  const n = Number(v);
  if (v == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(n);
};

const formatShortDate = (s) => {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return String(s);
  }
};

const PaginatedTable = ({
  head,
  rows,
  pageSize = 10,
  colTemplate,
  numeric = [],
}) => {
  const [page, setPage] = useState(1);
  const total = Math.max(1, Math.ceil(rows.length / pageSize));
  const cur = Math.max(1, Math.min(page, total));
  const slice = rows.slice((cur - 1) * pageSize, cur * pageSize);
  useEffect(() => {
    if (page > total) setPage(total);
  }, [page, total]);

  // Optional fixed column sizes (we only support CSS lengths like 120px/20%/10rem).
  const colSizes = (colTemplate || "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, head.length);
  const getColStyle = (idx) => {
    const s = colSizes[idx];
    if (!s) return undefined;
    if (/^\d+(\.\d+)?(px|%|rem|em|vw)$/.test(s)) return { width: s };
    return undefined;
  };

  return (
    <div className="warehouse-analytics-tableWrap">
      <div className="warehouse-analytics-tableScroll">
        <table className="warehouse-analytics-table">
          <colgroup>
            {head.map((_, i) => (
              <col key={i} style={getColStyle(i)} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={i} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className={numeric.includes(j) ? "is-num" : ""}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!slice.length && (
        <div className="warehouse-analytics-table__empty">Нет данных.</div>
      )}

      {rows.length > pageSize && (
        <div className="warehouse-analytics__pager" aria-label="Пагинация">
          <ul className="warehouse-analytics__pageList">
            {Array.from({ length: total }).map((_, i) => {
              const p = i + 1;
              return (
                <li key={p}>
                  <button
                    type="button"
                    className={`warehouse-analytics__pageBtn ${
                      p === cur ? "is-active" : ""
                    }`}
                    onClick={() => setPage(p)}
                    aria-current={p === cur ? "page" : undefined}
                  >
                    {p}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

const KpiCard = ({ label, value, description, icon: Icon }) => (
  <div className="warehouse-analytics__kpi">
    {Icon && (
      <div className="warehouse-analytics__kpiIcon">
        <Icon size={24} strokeWidth={2} />
      </div>
    )}
    <div className="warehouse-analytics__kpiLabel">{label}</div>
    <div className="warehouse-analytics__kpiValue">{value}</div>
    {description && (
      <div className="warehouse-analytics__kpiDesc">{description}</div>
    )}
  </div>
);

const AccordionItem = ({
  id,
  title,
  icon: Icon,
  badge,
  defaultOpen = true,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `${id}-panel`;
  const btnId = `${id}-button`;

  return (
    <div className={`warehouse-analytics__accItem ${open ? "is-open" : ""}`}>
      <button
        id={btnId}
        type="button"
        className="warehouse-analytics__accBtn"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="warehouse-analytics__accLeft">
          {Icon && (
            <span className="warehouse-analytics__accIcon" aria-hidden="true">
              <Icon size={18} />
            </span>
          )}
          <span className="warehouse-analytics__accTitle">{title}</span>
        </span>

        <span className="warehouse-analytics__accRight">
          {badge != null && badge !== "" && (
            <span className="warehouse-analytics__accBadge">{badge}</span>
          )}
          <ChevronDown
            size={18}
            className="warehouse-analytics__accChevron"
            aria-hidden="true"
          />
        </span>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={btnId}
        className="warehouse-analytics__accBody"
        hidden={!open}
      >
        {children}
      </div>
    </div>
  );
};

const AgentAnalytics = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const agentId = searchParams.get("agent_id") || null;
  const agentName = location.state?.agentName || null;

  const [period, setPeriod] = useState("month");
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = { period };
    if (period === "custom") {
      params.date_from = dateFrom;
      params.date_to = dateTo;
    } else {
      params.date = date;
    }
    try {
      const result = agentId
        ? await getOwnerAgentAnalytics(agentId, params)
        : await getAgentMeAnalytics(params);
      setData(result);
    } catch (e) {
      console.error(e);
      setError(e?.detail || e?.message || "Не удалось загрузить аналитику");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [agentId, period, date, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = data?.summary || {};
  const charts = data?.charts || {};
  const topAgents = data?.top_agents || {};
  const salesByDate = Array.isArray(charts.sales_by_date)
    ? charts.sales_by_date
    : [];
  const bySales = Array.isArray(topAgents.by_sales) ? topAgents.by_sales : [];
  const byReceived = Array.isArray(topAgents.by_received)
    ? topAgents.by_received
    : [];

  const requestsApproved = Number(summary.requests_approved ?? 0);
  const itemsApproved = Number(summary.items_approved ?? 0);
  const salesCount = Number(summary.sales_count ?? 0);
  const salesAmount = Number(summary.sales_amount ?? 0);
  const onHandQty = Number(summary.on_hand_qty ?? 0);
  const onHandAmount = Number(summary.on_hand_amount ?? 0);

  const salesChartData = salesByDate.map((d) => ({
    date: d.date ? formatShortDate(d.date) : d.label || "—",
    sum: Number(d.sum ?? d.amount ?? d.sales_amount ?? 0),
    count: Number(d.count ?? d.sales_count ?? 0),
  }));

  const bySalesRows = bySales.map((a) => [
    a.agent_name || a.name || a.agent_display || a.agent_id || "—",
    `${formatNum(a.sales_amount ?? a.amount ?? 0)} сом`,
    formatNum(a.sales_count ?? a.count),
  ]);
  const byReceivedRows = byReceived.map((a) => [
    a.agent_name || a.name || a.agent_display || a.agent_id || "—",
    formatNum(a.items_approved ?? a.items ?? a.count),
  ]);

  const pageTitle = agentId
    ? `Аналитика агента: ${agentName || agentId}`
    : "Моя аналитика";

  return (
    <div className="warehouse-analytics agent-analytics">
      <div className="warehouse-analytics__header">
        <h2 className="warehouse-analytics__title">{pageTitle}</h2>
        <div className="warehouse-analytics__header-actions">
          <button
            type="button"
            className="warehouse-analytics__refresh"
            onClick={load}
            disabled={loading}
            title="Обновить"
          >
            <RefreshCw size={18} />
            Обновить
          </button>
          <div
            className="warehouse-analytics__seg"
            role="tablist"
            aria-label="Период"
          >
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                role="tab"
                aria-selected={period === p.value}
                className={`warehouse-analytics__segBtn ${period === p.value ? "is-active" : ""}`}
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {period === "custom" && (
        <div className="warehouse-analytics__range">
          <label>
            С
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="warehouse-analytics__input"
            />
          </label>
          <label>
            По
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="warehouse-analytics__input"
            />
          </label>
        </div>
      )}

      {error && <div className="warehouse-analytics__error">{error}</div>}

      {loading ? (
        <div className="warehouse-analytics__loading">Загрузка…</div>
      ) : data ? (
        <>
          <div className="warehouse-analytics__kpis">
            <KpiCard
              label="Одобрено заявок"
              value={formatNum(requestsApproved)}
              description="За период"
              icon={Check}
            />
            <KpiCard
              label="Одобрено позиций"
              value={formatNum(itemsApproved)}
              description="Товаров выдано"
              icon={Package}
            />
            <KpiCard
              label="Продажи"
              value={`${formatNum(salesAmount)} сом`}
              description={`${formatNum(salesCount)} продаж`}
              icon={ShoppingCart}
            />
            <KpiCard
              label="Остатки на руках"
              value={`${formatNum(onHandAmount)} сом`}
              description={`${formatNum(onHandQty)} шт`}
              icon={Package}
            />
          </div>

          <div className="warehouse-analytics__card warehouse-analytics__card--chart">
            <div className="warehouse-analytics__cardTitle">
              Динамика продаж
            </div>
            <div className="warehouse-analytics__chartWrap">
              {salesChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart
                    data={salesChartData}
                    margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                  >
                    <defs>
                      <linearGradient
                        id="agentAnalyticsAreaFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--wa-primary)"
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--wa-primary)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--wa-border)"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) =>
                        v && v.length > 6 ? v.slice(0, 6) : v
                      }
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => formatNum(v)}
                    />
                    <Tooltip
                      formatter={(value) => [
                        formatNum(value),
                        "Продажи (сом)",
                      ]}
                      labelFormatter={(l) => `Дата: ${l}`}
                    />
                    <Legend
                      formatter={() => "Продажи (сом)"}
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="sum"
                      stroke="var(--wa-primary)"
                      strokeWidth={2}
                      fill="url(#agentAnalyticsAreaFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="warehouse-analytics__chartWrap--empty">
                  Нет данных за период.
                </div>
              )}
            </div>
          </div>

          <div className="warehouse-analytics__accordion">
            <AccordionItem
              id="wa-agent-top-sales"
              title="Топ по продажам"
              icon={ShoppingCart}
              badge={bySalesRows.length ? `${bySalesRows.length}` : "0"}
              defaultOpen
            >
              <div className="warehouse-analytics__card warehouse-analytics__accCard">
                {bySalesRows.length > 0 ? (
                  <PaginatedTable
                    head={["Агент", "Продажи", "Кол-во"]}
                    rows={bySalesRows}
                    colTemplate="1fr 120px 90px"
                    numeric={[1, 2]}
                  />
                ) : (
                  <div className="warehouse-analytics-table__empty">
                    Нет данных за период.
                  </div>
                )}
              </div>
            </AccordionItem>

            <AccordionItem
              id="wa-agent-top-received"
              title="Топ по полученным товарам"
              icon={Package}
              badge={byReceivedRows.length ? `${byReceivedRows.length}` : "0"}
              defaultOpen={false}
            >
              <div className="warehouse-analytics__card warehouse-analytics__accCard">
                {byReceivedRows.length > 0 ? (
                  <PaginatedTable
                    head={["Агент", "Одобрено позиций"]}
                    rows={byReceivedRows}
                    colTemplate="1fr 140px"
                    numeric={[1]}
                  />
                ) : (
                  <div className="warehouse-analytics-table__empty">
                    Нет данных за период.
                  </div>
                )}
              </div>
            </AccordionItem>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default AgentAnalytics;
