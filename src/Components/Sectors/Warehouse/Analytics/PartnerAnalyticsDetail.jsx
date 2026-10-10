import { ArrowLeft, ReceiptText, RefreshCw } from "lucide-react";
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
import { useLatestRequest } from "./useLatestRequest";
import "./Analytics.scss";

const PartnerAnalyticsDetail = () => {
  const { partnerId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const { begin, isLatest } = useLatestRequest();

  const load = useCallback(async () => {
    if (!partnerId) return;
    const token = begin();
    setLoading(true);
    setError("");
    try {
      const extra = {};
      if (partnerBranch) extra.partner_branch = partnerBranch;
      const result = await getOwnerPartnerAnalytics(
        partnerId,
        periodParams(extra),
      );
      if (!isLatest(token)) return;
      setData(result);
    } catch (e) {
      if (!isLatest(token)) return;
      console.error(e);
      setError(
        extractWarehouseApiError(
          e,
          "Не удалось загрузить аналитику партнёра",
        ),
      );
      setData(null);
    } finally {
      if (isLatest(token)) setLoading(false);
    }
  }, [partnerId, partnerBranch, periodParams, begin, isLatest]);

  useEffect(() => {
    load();
  }, [load]);

  const partnerName =
    data?.partner_company?.name || partnerNameFromState || "Партнёр";
  // Список филиалов партнёра отдаёт новый бэк (partner_branches); на старом
  // выбора нет, а вместо UUID показываем название, если оно пришло.
  const partnerBranches = Array.isArray(data?.partner_branches)
    ? data.partner_branches
    : [];
  const selectedBranchName =
    data?.branch_name ||
    partnerBranches.find((b) => String(b.id) === String(data?.branch_id))?.name;
  const branchHint = data?.all_branches
    ? "Все филиалы партнёра"
    : data?.branch_id
      ? `Филиал: ${selectedBranchName || "выбранный филиал"}`
      : null;

  const handleBranchChange = (branchId) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (branchId) next.set("partner_branch", branchId);
        else next.delete("partner_branch");
        return next;
      },
      { replace: true },
    );
  };
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
          <Link
            to={`/crm/warehouse/partners/${partnerId}/sales${
              partnerBranch ? `?partner_branch=${partnerBranch}` : ""
            }`}
            state={{ partnerName }}
            className="warehouse-analytics__refresh"
          >
            <ReceiptText size={18} />
            История продаж
          </Link>
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
          {loading && data && (
            <span className="warehouse-analytics__refreshing" role="status">
              Загрузка…
            </span>
          )}
          {partnerBranches.length > 1 && (
            <select
              className="warehouse-analytics__input"
              value={partnerBranch || ""}
              onChange={(e) => handleBranchChange(e.target.value)}
              disabled={loading}
              aria-label="Филиал партнёра"
            >
              <option value="">Все филиалы</option>
              {partnerBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || "Филиал"}
                </option>
              ))}
            </select>
          )}
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

      {/* Старые данные остаются на экране, пока грузятся новые (см. Analytics.jsx). */}
      {loading && !data ? (
        <div className="warehouse-analytics__loading">Загрузка…</div>
      ) : data ? (
        <div
          className={`warehouse-analytics__content${loading ? " is-refreshing" : ""}`}
          aria-busy={loading}
        >
          <OwnerAnalyticsContent
            data={data}
            showAgentSalesAnalytics={showAgentSalesAnalytics}
            idPrefix="pa"
          />
        </div>
      ) : null}
    </div>
  );
};

export default PartnerAnalyticsDetail;
