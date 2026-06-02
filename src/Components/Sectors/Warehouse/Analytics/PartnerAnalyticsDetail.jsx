import { ArrowLeft, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { getOwnerPartnerAnalytics } from "../../../../api/warehouse";
import { isStartPlan } from "../../../../utils/subscriptionPlan";
import { useUser } from "../../../../store/slices/userSlice";
import OwnerAnalyticsContent from "./OwnerAnalyticsContent";
import {
  extractWarehouseApiError,
  formatShortDate,
} from "./warehouseAnalyticsShared";
import { AnalyticsPeriodControls } from "./warehouseAnalyticsUi";
import { useAnalyticsPeriod } from "./useAnalyticsPeriod";
import "./Analytics.scss";

const PartnerAnalyticsDetail = () => {
  const { partnerId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { tariff, company } = useUser();
  const showAgentSalesAnalytics = !isStartPlan(
    tariff || company?.subscription_plan?.name,
  );

  const partnerBranch = searchParams.get("partner_branch") || undefined;
  const partnerNameFromState = location.state?.partnerName;

  const {
    period,
    setPeriod,
    date,
    setDate,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    periodParams,
  } = useAnalyticsPeriod("month");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    if (!partnerId) return;
    setLoading(true);
    setError("");
    try {
      const extra = {};
      if (partnerBranch) extra.partner_branch = partnerBranch;
      const result = await getOwnerPartnerAnalytics(
        partnerId,
        periodParams(extra),
      );
      setData(result);
    } catch (e) {
      console.error(e);
      setError(
        extractWarehouseApiError(
          e,
          "Не удалось загрузить аналитику партнёра",
        ),
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [partnerId, partnerBranch, periodParams]);

  useEffect(() => {
    load();
  }, [load]);

  const partnerName =
    data?.partner_company?.name || partnerNameFromState || "Партнёр";
  const branchHint = data?.all_branches
    ? "Все филиалы партнёра"
    : data?.branch_id
      ? `Филиал: ${data.branch_id}`
      : null;
  const periodLabel =
    data?.date_from && data?.date_to
      ? `${formatShortDate(data.date_from)} — ${formatShortDate(data.date_to)}`
      : null;

  return (
    <div className="warehouse-analytics partner-analytics">
      <div className="warehouse-analytics__header">
        <div>
          <Link
            to="/crm/warehouse/partners/analytics"
            className="partner-analytics__back"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            К списку партнёров
          </Link>
          <h2 className="warehouse-analytics__title">
            Аналитика: {partnerName}
          </h2>
          {branchHint && (
            <p className="warehouse-analytics__subtitle">{branchHint}</p>
          )}
          {periodLabel && (
            <p className="warehouse-analytics__subtitle">{periodLabel}</p>
          )}
        </div>
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
          <AnalyticsPeriodControls
            period={period}
            onPeriodChange={setPeriod}
            date={date}
            onDateChange={setDate}
            dateFrom={dateFrom}
            onDateFromChange={setDateFrom}
            dateTo={dateTo}
            onDateToChange={setDateTo}
          />
        </div>
      </div>

      {error && <div className="warehouse-analytics__error">{error}</div>}

      {loading ? (
        <div className="warehouse-analytics__loading">Загрузка…</div>
      ) : data ? (
        <OwnerAnalyticsContent
          data={data}
          showAgentSalesAnalytics={showAgentSalesAnalytics}
          idPrefix="pa"
        />
      ) : null}
    </div>
  );
};

export default PartnerAnalyticsDetail;
