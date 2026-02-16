/**
 * Аналитика владельца/админа склада.
 *
 * Ожидаемый ответ API (getOwnerAnalytics):
 *
 * GET /api/warehouse/owner/analytics/?period=month&date=2026-02-05
 *
 * {
 *   "period": "month",
 *   "date_from": "2026-01-07",
 *   "date_to": "2026-02-05",
 *   "summary": {
 *     "requests_approved": 8,
 *     "items_approved": "20.000",
 *     "sales_count": 0,
 *     "sales_amount": "0.00",
 *     "on_hand_qty": "20.000",
 *     "on_hand_amount": "3709.08000"
 *   },
 *   "charts": {
 *     "sales_by_date": []
 *   },
 *   "top_agents": {
 *     "by_sales": [],
 *     "by_received": [
 *       {
 *         "agent_id": "4478407d-660b-4683-a0af-ceb15c25b507",
 *         "agent_name": "agentt agentt",
 *         "items_approved": "16.000"
 *       },
 *       {
 *         "agent_id": "062ca63c-0fe5-4070-ab01-a9ef554fce1e",
 *         "agent_name": "agent agent",
 *         "items_approved": "2.000"
 *       },
 *       {
 *         "agent_id": "fab742f8-66ca-48fa-b318-9ac8a48fceab",
 *         "agent_name": "warehouse warehouse",
 *         "items_approved": "2.000"
 *       }
 *     ]
 *   },
 *   "details": {
 *     "warehouses": [
 *       {
 *         "warehouse_id": "8f5d5f2c-6de6-4e2b-9747-273bc5aa3a19",
 *         "warehouse_name": "new склад",
 *         "carts_approved": 5,
 *         "items_approved": "8.000",
 *         "sales_count": 0,
 *         "sales_amount": "0.00",
 *         "on_hand_qty": "8.000",
 *         "on_hand_amount": "589.08000"
 *       },
 *       {
 *         "warehouse_id": "4cf95f0e-e72e-4621-8c4c-e5c88bafb09e",
 *         "warehouse_name": "JAY",
 *         "carts_approved": 3,
 *         "items_approved": "12.000",
 *         "sales_count": 0,
 *         "sales_amount": "0.00",
 *         "on_hand_qty": "12.000",
 *         "on_hand_amount": "3120.00000"
 *       }
 *     ],
 *     "sales_by_product": []
 *   }
 * }
 */
import {
  Check,
  Package,
  RefreshCw,
  ShoppingCart,
  ChevronDown,
  Warehouse,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { useUser } from "../../../../store/slices/userSlice";
import {
  getOwnerAnalytics,
  getAgentMeAnalytics,
  getOwnerAgentAnalytics,
} from "../../../../api/warehouse";
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

const formatDate = (s) => {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return String(s);
  }
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

const WarehouseAnalytics = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { profile } = useUser();
  const isOwnerOrAdmin =
    profile?.role === "owner" || profile?.role === "admin";

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
      let result;
      if (agentId && isOwnerOrAdmin) {
        result = await getOwnerAgentAnalytics(agentId, params);
      } else if (isOwnerOrAdmin) {
        result = await getOwnerAnalytics(params);
      } else {
        result = await getAgentMeAnalytics(params);
      }
      setData(result);
    } catch (e) {
      console.error(e);
      setError(e?.detail || e?.message || "Не удалось загрузить аналитику");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isOwnerOrAdmin, period, date, dateFrom, dateTo, agentId]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = data?.summary || {};
  const charts = data?.charts || {};
  const topAgents = data?.top_agents || {};
  const details = data?.details || {};
  const salesByDate = Array.isArray(charts?.sales_by_date)
    ? charts.sales_by_date
    : [];
  const requestsByDate = Array.isArray(charts?.requests_by_date)
    ? charts.requests_by_date
    : [];
  const issuanceByDate = Array.isArray(charts?.issuance_by_date)
    ? charts.issuance_by_date
    : [];
  const bySales = Array.isArray(topAgents?.by_sales) ? topAgents.by_sales : [];
  const byReceived = Array.isArray(topAgents?.by_received)
    ? topAgents.by_received
    : [];
  const warehouses = Array.isArray(details?.warehouses)
    ? details.warehouses
    : [];

  const totalSalesAmount = bySales.reduce(
    (acc, a) => acc + Number(a.sales_amount ?? a.amount ?? 0),
    0
  );
  const totalReceivedItems = byReceived.reduce(
    (acc, a) =>
      acc +
      Number(
        a.items_approved ?? a.items_received ?? a.items ?? a.count ?? 0
      ),
    0
  );

  const bySalesRows = bySales.map((a, i) => {
    const amount = Number(a.sales_amount ?? a.amount ?? 0);
    const count = formatNum(a.sales_count ?? a.count);
    const share =
      totalSalesAmount > 0
        ? `${Math.round((amount / totalSalesAmount) * 100)}%`
        : "—";
    return [
      a.agent_name || a.name || a.agent_display || a.id || "—",
      `${formatNum(amount)} сом`,
      `${count} шт`,
      share,
    ];
  });
  const byReceivedRows = byReceived.map((a, i) => {
    const items = Number(
      a.items_approved ?? a.items_received ?? a.items ?? a.count ?? 0
    );
    const requests = formatNum(
      a.carts_approved ?? a.requests_count ?? a.requests ?? a.count ?? 0
    );
    const share =
      totalReceivedItems > 0
        ? `${Math.round((items / totalReceivedItems) * 100)}%`
        : "—";
    return [
      a.agent_name || a.name || a.agent_display || a.id || "—",
      `${formatNum(items)} шт`,
      requests,
      share,
    ];
  });

  const salesChartData = salesByDate.map((d) => ({
    date: d.date ? formatShortDate(d.date) : d.label || "—",
    sum: Number(d.sum ?? d.amount ?? d.sales_amount ?? 0),
    count: Number(d.count ?? d.sales_count ?? 0),
  }));

  const requestsChartData = requestsByDate.map((d) => ({
    date: d.date ? formatShortDate(d.date) : d.label || "—",
    approved: Number(d.approved ?? d.approved_count ?? 0),
    rejected: Number(d.rejected ?? d.rejected_count ?? 0),
  }));

  const issuanceChartData = issuanceByDate.map((d) => ({
    date: d.date ? formatShortDate(d.date) : d.label || "—",
    items: Number(d.items ?? d.count ?? d.qty ?? 0),
  }));

  const requestsApproved = Number(summary.requests_approved ?? 0);
  const itemsApproved = Number(summary.items_approved ?? 0);
  const salesCount = Number(summary.sales_count ?? 0);
  const salesAmount = Number(summary.sales_amount ?? 0);
  const onHandQty = Number(summary.on_hand_qty ?? 0);
  const onHandAmount = Number(summary.on_hand_amount ?? 0);

  // Агент: заявки по статусам, выданные товары, продажи/возвраты/списания, остатки (поля API: write_off_*)
  const requestsSubmitted = Number(summary.requests_submitted ?? 0);
  const requestsRejected = Number(summary.requests_rejected ?? 0);
  const issuedItemsCount = Number(
    summary.issued_items_count ?? summary.items_approved ?? 0
  );
  const returnsCount = Number(summary.returns_count ?? 0);
  const returnsAmount = Number(summary.returns_amount ?? 0);
  const writeoffsCount = Number(
    summary.write_off_count ?? summary.writeoffs_count ?? 0
  );
  const writeoffsAmount = Number(
    summary.write_off_amount ?? summary.writeoffs_amount ?? 0
  );

  const isAgentView = !isOwnerOrAdmin && !agentId;
  const agentRequests = Array.isArray(data?.requests) ? data.requests : [];
  const agentIssuedProducts = Array.isArray(data?.issued_products)
    ? data.issued_products
    : [];
  const agentSalesReturnsWriteoffs = Array.isArray(data?.sales_returns_writeoffs)
    ? data.sales_returns_writeoffs
    : [];
  const agentOnHand = Array.isArray(data?.on_hand) ? data.on_hand : [];

  // API агента: requests_by_date с carts_approved, items_approved (без submitted/rejected по датам)
  const requestsChartDataAgent = requestsByDate.map((d) => ({
    date: d.date ? formatShortDate(d.date) : d.label || "—",
    approved: Number(
      d.carts_approved ?? d.approved ?? d.approved_count ?? 0
    ),
    items: Number(d.items_approved ?? d.items ?? d.items_count ?? 0),
  }));

  // Выданные товары по датам: у агента нет issuance_by_date — берём из requests_by_date (items_approved)
  const issuanceChartDataAgent =
    issuanceChartData.length > 0
      ? issuanceChartData
      : requestsByDate.map((d) => ({
          date: d.date ? formatShortDate(d.date) : d.label || "—",
          items: Number(d.items_approved ?? d.items ?? d.qty ?? 0),
        }));

  return (
    <div className="warehouse-analytics">
      <div className="warehouse-analytics__header">
        <h2 className="warehouse-analytics__title">
          {agentId && isOwnerOrAdmin
            ? `Аналитика агента: ${agentName || agentId}`
            : isOwnerOrAdmin
              ? "Аналитика склада"
              : "Моя аналитика"}
        </h2>
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
          <div className="warehouse-analytics__seg" role="tablist" aria-label="Период">
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
            {isAgentView ? (
              <>
                <KpiCard
                  label="Заявки"
                  value={`${formatNum(requestsSubmitted)} / ${formatNum(requestsApproved)} / ${formatNum(requestsRejected)}`}
                  description="Отправлено / Одобрено / Отклонено"
                  icon={Check}
                />
                <KpiCard
                  label="Выданные товары"
                  value={formatNum(issuedItemsCount)}
                  description="Позиций выдано за период"
                  icon={Package}
                />
                <KpiCard
                  label="Продажи / Возвраты / Списания"
                  value={`${formatNum(salesAmount)} / ${formatNum(returnsAmount)} / ${formatNum(writeoffsAmount)} сом`}
                  description={`${formatNum(salesCount)} продаж, ${formatNum(returnsCount)} возвратов, ${formatNum(writeoffsCount)} списаний`}
                  icon={ShoppingCart}
                />
                <KpiCard
                  label="Остатки на руках"
                  value={`${formatNum(onHandAmount)} сом`}
                  description={`${formatNum(onHandQty)} шт`}
                  icon={Package}
                />
              </>
            ) : (
              <>
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
                  label="Продажи агентов"
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
              </>
            )}
          </div>

          <div className="warehouse-analytics__chartsRow">
            <div className="warehouse-analytics__card warehouse-analytics__card--chart">
              <div className="warehouse-analytics__cardTitle">
                {isAgentView ? "Динамика продаж" : "Динамика продаж агентов"}
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
                            id="warehouseAnalyticsAreaFill"
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
                          formatter={(value) => [formatNum(value), "Продажи (сом)"]}
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
                          fill="url(#warehouseAnalyticsAreaFill)"
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
            <div className="warehouse-analytics__card warehouse-analytics__card--chart">
              <div className="warehouse-analytics__cardTitle">
                {isAgentView
                  ? "Динамика заявок (одобрено заявок / одобрено позиций)"
                  : "Динамика заявок"}
              </div>
              <div className="warehouse-analytics__chartWrap">
                {(isAgentView
                  ? requestsChartDataAgent
                  : requestsChartData
                ).length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart
                      data={
                        isAgentView
                          ? requestsChartDataAgent
                          : requestsChartData
                      }
                      margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                    >
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
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value, name) => [
                          formatNum(value),
                          isAgentView
                            ? name === "approved"
                              ? "Одобрено заявок"
                              : name === "items"
                                ? "Одобрено позиций"
                                : name
                            : name === "approved"
                              ? "Одобрено"
                              : name === "rejected"
                                ? "Отклонено"
                                : name,
                        ]}
                        labelFormatter={(l) => `Дата: ${l}`}
                      />
                      <Legend
                        formatter={(v) =>
                          isAgentView
                            ? v === "approved"
                              ? "Одобрено заявок"
                              : v === "items"
                                ? "Одобрено позиций"
                                : v
                            : v === "approved"
                              ? "Одобрено"
                              : v === "rejected"
                                ? "Отклонено"
                                : v
                        }
                        wrapperStyle={{ fontSize: 12 }}
                      />
                      {isAgentView ? (
                        <>
                          <Bar
                            dataKey="approved"
                            stackId="a"
                            fill="var(--wa-primary)"
                            radius={[0, 0, 0, 0]}
                            name="approved"
                          />
                          <Bar
                            dataKey="items"
                            stackId="a"
                            fill="#94a3b8"
                            radius={[0, 0, 0, 0]}
                            name="items"
                          />
                        </>
                      ) : (
                        <>
                          <Bar
                            dataKey="approved"
                            stackId="a"
                            fill="var(--wa-primary)"
                            radius={[0, 0, 0, 0]}
                            name="approved"
                          />
                          <Bar
                            dataKey="rejected"
                            stackId="a"
                            fill="var(--wa-rejected)"
                            radius={[0, 0, 0, 0]}
                            name="rejected"
                          />
                        </>
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="warehouse-analytics__chartWrap--empty">
                    Нет данных за период.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="warehouse-analytics__card warehouse-analytics__card--chart">
            <div className="warehouse-analytics__cardTitle">
              {isAgentView ? "Выданные мне товары" : "Выдача товаров агентам"}
            </div>
            <div className="warehouse-analytics__chartWrap">
              {(isAgentView ? issuanceChartDataAgent : issuanceChartData).length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={isAgentView ? issuanceChartDataAgent : issuanceChartData}
                    margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                  >
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
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value) => [formatNum(value), "Позиций выдано"]}
                      labelFormatter={(l) => `Дата: ${l}`}
                    />
                    <Legend
                      formatter={() => "Позиций выдано"}
                      iconType="square"
                      iconSize={10}
                      wrapperStyle={{ fontSize: 12 }}
                    />
                    <Bar
                      dataKey="items"
                      fill="var(--wa-primary)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="warehouse-analytics__chartWrap--empty">
                  Нет данных за период.
                </div>
              )}
            </div>
          </div>

          {isOwnerOrAdmin && (
            <>
              <div className="warehouse-analytics__accordion">
                <AccordionItem
                  id="wa-top-sales"
                  title="Топ агентов по продажам"
                  icon={ShoppingCart}
                  badge={bySalesRows.length ? `${bySalesRows.length}` : "0"}
                  defaultOpen
                >
                  <div className="warehouse-analytics__card warehouse-analytics__accCard">
                    {bySalesRows.length > 0 ? (
                      <PaginatedTable
                        head={["Агент", "Продажи", "Кол-во", "Доля"]}
                        rows={bySalesRows}
                        colTemplate="1fr 120px 90px 70px"
                        numeric={[1, 2, 3]}
                      />
                    ) : (
                      <div className="warehouse-analytics-table__empty">
                        Нет данных за период.
                      </div>
                    )}
                  </div>
                </AccordionItem>

                <AccordionItem
                  id="wa-top-received"
                  title="Топ агентов по полученным товарам"
                  icon={Package}
                  badge={byReceivedRows.length ? `${byReceivedRows.length}` : "0"}
                  defaultOpen={false}
                >
                  <div className="warehouse-analytics__card warehouse-analytics__accCard">
                    {byReceivedRows.length > 0 ? (
                      <PaginatedTable
                        head={["Агент", "Позиций", "Заявок", "Доля"]}
                        rows={byReceivedRows}
                        colTemplate="1fr 100px 80px 70px"
                        numeric={[1, 2, 3]}
                      />
                    ) : (
                      <div className="warehouse-analytics-table__empty">
                        Нет данных за период.
                      </div>
                    )}
                  </div>
                </AccordionItem>

                <AccordionItem
                  id="wa-warehouses"
                  title="Склады"
                  icon={Warehouse}
                  badge={warehouses.length ? `${warehouses.length}` : "0"}
                  defaultOpen={false}
                >
                  <div className="warehouse-analytics__card warehouse-analytics__accCard">
                    {warehouses.length > 0 ? (
                      <PaginatedTable
                        head={[
                          "Склад",
                          "Заявок одобрено",
                          "Позиций одобрено",
                          "Продаж",
                          "Сумма продаж",
                          "Остаток, шт",
                          "Остаток, сом",
                        ]}
                        rows={warehouses.map((w) => [
                          w.warehouse_name ?? w.name ?? "—",
                          formatNum(w.carts_approved ?? w.requests_approved ?? 0),
                          formatNum(w.items_approved ?? 0),
                          formatNum(w.sales_count ?? 0),
                          `${formatNum(w.sales_amount ?? 0)} сом`,
                          formatNum(w.on_hand_qty ?? 0),
                          `${formatNum(w.on_hand_amount ?? 0)} сом`,
                        ])}
                        colTemplate="1.2fr 130px 150px 90px 130px 110px 130px"
                        numeric={[1, 2, 3, 4, 5, 6]}
                      />
                    ) : (
                      <div className="warehouse-analytics-table__empty">
                        Нет данных по складам за период.
                      </div>
                    )}
                  </div>
                </AccordionItem>
              </div>
            </>
          )}

          {isAgentView && (
            <div className="warehouse-analytics__agentTables">
              <div className="warehouse-analytics__card">
                <div className="warehouse-analytics__cardTitle">Заявки (отправлено / одобрено / отклонено)</div>
                {agentRequests.length > 0 ? (
                  <PaginatedTable
                    head={["№", "Дата", "Статус", "Примечание"]}
                    rows={agentRequests.map((r, i) => [
                      r.number ?? r.id ?? i + 1,
                      formatDate(r.date ?? r.submitted_at ?? r.updated_date),
                      r.status === "submitted" ? "Отправлено" : r.status === "approved" ? "Одобрено" : r.status === "rejected" ? "Отклонено" : String(r.status ?? "—"),
                      r.note ?? "—",
                    ])}
                    colTemplate="80px 1fr 120px 1fr"
                    numeric={[0]}
                  />
                ) : (
                  <div className="warehouse-analytics-table__empty">Нет заявок за период.</div>
                )}
              </div>
              <div className="warehouse-analytics__card">
                <div className="warehouse-analytics__cardTitle">Выданные товары</div>
                {agentIssuedProducts.length > 0 ? (
                  <PaginatedTable
                    head={["Товар", "Кол-во", "Ед.", "Дата"]}
                    rows={agentIssuedProducts.map((r) => [
                      r.product_name ?? r.name ?? r.product ?? "—",
                      formatNum(r.qty ?? r.quantity ?? r.count),
                      r.unit ?? "—",
                      formatDate(r.date ?? r.issued_at ?? r.created_at),
                    ])}
                    colTemplate="1fr 80px 60px 100px"
                    numeric={[1]}
                  />
                ) : (
                  <div className="warehouse-analytics-table__empty">Нет выданных товаров за период.</div>
                )}
              </div>
              <div className="warehouse-analytics__card">
                <div className="warehouse-analytics__cardTitle">Продажи / Возвраты / Списания</div>
                {agentSalesReturnsWriteoffs.length > 0 ? (
                  <PaginatedTable
                    head={["Тип", "Дата", "Сумма", "Кол-во"]}
                    rows={agentSalesReturnsWriteoffs.map((r) => [
                      r.type === "sale" ? "Продажа" : r.type === "return" ? "Возврат" : r.type === "writeoff" ? "Списание" : String(r.type ?? "—"),
                      formatDate(r.date ?? r.created_at),
                      `${formatNum(r.amount ?? r.sum ?? 0)} сом`,
                      formatNum(r.count ?? r.qty ?? r.quantity),
                    ])}
                    colTemplate="100px 100px 120px 80px"
                    numeric={[2, 3]}
                  />
                ) : (
                  <div className="warehouse-analytics-table__empty">Нет операций за период.</div>
                )}
              </div>
              <div className="warehouse-analytics__card">
                <div className="warehouse-analytics__cardTitle">Остатки на руках</div>
                {agentOnHand.length > 0 ? (
                  <PaginatedTable
                    head={["Товар", "Кол-во", "Ед.", "Сумма"]}
                    rows={agentOnHand.map((r) => [
                      r.product_name ?? r.name ?? r.product ?? "—",
                      formatNum(r.qty ?? r.quantity ?? r.count),
                      r.unit ?? "—",
                      `${formatNum(r.amount ?? r.sum ?? 0)} сом`,
                    ])}
                    colTemplate="1fr 80px 60px 100px"
                    numeric={[1, 3]}
                  />
                ) : (
                  <div className="warehouse-analytics-table__empty">Нет остатков на руках.</div>
                )}
              </div>
            </div>
          )}

          {!isOwnerOrAdmin &&
            !isAgentView &&
            Object.keys(summary).length === 0 &&
            !salesChartData.length &&
            !requestsChartData.length &&
            !issuanceChartData.length && (
              <div className="warehouse-analytics__card">
                <div className="warehouse-analytics-table__empty">
                  Нет данных за выбранный период.
                </div>
              </div>
            )}
        </>
      ) : null}
    </div>
  );
};

export default WarehouseAnalytics;
