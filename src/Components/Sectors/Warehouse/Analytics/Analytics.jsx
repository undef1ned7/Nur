import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { useUser } from "../../../../store/slices/userSlice";
import { isStartPlan } from "../../../../utils/subscriptionPlan";
import {
  getOwnerAnalytics,
  getAgentMeAnalytics,
  getOwnerAgentAnalytics,
} from "../../../../api/warehouse";
import OwnerAnalyticsContent from "./OwnerAnalyticsContent";
import { PERIODS } from "./warehouseAnalyticsShared";
import "./Analytics.scss";

const WarehouseAnalytics = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { profile, tariff, company } = useUser();
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";
  const startPlan = isStartPlan(tariff || company?.subscription_plan?.name);
  const showAgentSalesAnalytics = !startPlan;

  const agentId = searchParams.get("agent_id") || null;
  const agentName = location.state?.agentName || null;

  const [period, setPeriod] = useState("month");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() =>
    new Date().toISOString().slice(0, 10),
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

  const isAgentView = !isOwnerOrAdmin && !agentId;
  const summary = data?.summary || {};
  const salesByDate = Array.isArray(data?.charts?.sales_by_date)
    ? data.charts.sales_by_date
    : [];

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
          <OwnerAnalyticsContent
            data={data}
            showAgentSalesAnalytics={showAgentSalesAnalytics}
            showMoneyAnalytics={isOwnerOrAdmin}
            showDetailsAccordions={isOwnerOrAdmin}
            salesCountLabel={
              isAgentView
                ? "Количество моих продаж"
                : "Количество продаж агентов"
            }
            salesAmountLabel={
              isAgentView ? "Сумма моих продаж" : "Сумма продаж агентов"
            }
            idPrefix="wa"
          />

          {!isOwnerOrAdmin &&
            !isAgentView &&
            Object.keys(summary).length === 0 &&
            !salesByDate.length && (
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
