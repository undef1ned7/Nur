import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Banknote, FileText, Package, Percent, RefreshCw, Search } from "lucide-react";
import {
  isEndpointMissing,
  listPartnerSales,
} from "../../../../api/warehousePartnership";
import { extractPartnershipError } from "../Warehouses/partnership/partnershipHelpers";
import Pagination from "../Warehouses/components/Pagination";
import { useSearch } from "../Warehouses/hooks/useSearch";
import { formatNum, formatShortDate } from "./warehouseAnalyticsShared";
import { AnalyticsPeriodControls, KpiCard } from "./warehouseAnalyticsUi";
import { useAnalyticsPeriod } from "./useAnalyticsPeriod";
import {
  PARTNER_SALES_DOC_TYPES,
  PARTNER_SALES_PAGE_SIZE,
  PARTNER_SALES_STATUS_FILTERS,
  buildPartnerSalesParams,
  normalizePartnerSalesResponse,
  saleStatusMeta,
} from "./partnerSalesModel";
import PartnerSaleDetailModal from "./PartnerSaleDetailModal";
import "./Analytics.scss";

const fmtDateTime = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

/**
 * История продаж (и возвратов) компании-партнёра.
 * /crm/warehouse/partners/:partnerId/sales[?partner_branch=<uuid>]
 */
const PartnerSalesHistory = () => {
  const { partnerId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const partnerBranch = searchParams.get("partner_branch") || undefined;

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
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useSearch();

  const [docType, setDocType] = useState("SALE");
  const [status, setStatus] = useState("");

  // Любой новый фильтр начинает с первой страницы: номер страницы привязан к
  // «подписи» фильтров и сбрасывается сам, без эффекта.
  const filtersKey = JSON.stringify([
    periodParams(),
    docType,
    status,
    debouncedSearchTerm.trim(),
    partnerBranch,
  ]);
  const [pageState, setPageState] = useState({ key: filtersKey, page: 1 });
  const page = pageState.key === filtersKey ? pageState.page : 1;
  const setPage = (next) => setPageState({ key: filtersKey, page: next });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unsupported, setUnsupported] = useState(false);
  const [data, setData] = useState(() => normalizePartnerSalesResponse(null));
  const [openedRow, setOpenedRow] = useState(null);

  const requestParams = useMemo(
    () =>
      buildPartnerSalesParams({
        periodParams: periodParams(),
        docType,
        status,
        search: debouncedSearchTerm,
        partnerBranch,
        page,
      }),
    [periodParams, docType, status, debouncedSearchTerm, partnerBranch, page],
  );

  const load = useCallback(async () => {
    if (!partnerId) return;
    setLoading(true);
    setError("");
    try {
      const result = await listPartnerSales(partnerId, requestParams);
      setData(normalizePartnerSalesResponse(result));
      setUnsupported(false);
    } catch (e) {
      if (isEndpointMissing(e)) {
        setUnsupported(true);
      } else {
        console.error(e);
        setError(extractPartnershipError(e));
      }
      setData(normalizePartnerSalesResponse(null));
    } finally {
      setLoading(false);
    }
  }, [partnerId, requestParams]);

  useEffect(() => {
    load();
  }, [load]);

  const partnerName = data.partnerName || location.state?.partnerName || "Партнёр";
  const isReturns = docType === "SALE_RETURN";
  const periodLabel =
    data.dateFrom && data.dateTo
      ? `${formatShortDate(data.dateFrom)} — ${formatShortDate(data.dateTo)}`
      : null;
  const totalPages = Math.max(1, Math.ceil((data.count || 0) / PARTNER_SALES_PAGE_SIZE));
  const analyticsLink = `/crm/warehouse/partners/${partnerId}/analytics${
    partnerBranch ? `?partner_branch=${partnerBranch}` : ""
  }`;

  const segment = (options, value, onChange, label) => (
    <div className="warehouse-analytics__seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value || "all"}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={`warehouse-analytics__segBtn ${value === o.value ? "is-active" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  const renderBody = () => {
    if (unsupported) {
      return (
        <div className="warehouse-analytics__card">
          <div className="warehouse-analytics-table__empty">
            История продаж партнёра станет доступна после обновления сервера.
            Пока можно посмотреть итоги в{" "}
            <Link to={analyticsLink} state={{ partnerName }}>
              аналитике партнёра
            </Link>
            .
          </div>
        </div>
      );
    }
    if (error) return <div className="warehouse-analytics__error">{error}</div>;

    return (
      <>
        <div className="warehouse-analytics__kpis">
          <KpiCard
            label={isReturns ? "Возвратов" : "Продаж"}
            value={loading ? "…" : formatNum(data.summary.count ?? data.count)}
            icon={FileText}
          />
          <KpiCard
            label={isReturns ? "Сумма возвратов" : "Сумма продаж"}
            value={loading ? "…" : `${formatNum(data.summary.amount)} сом`}
            description="После скидок"
            icon={Banknote}
          />
          <KpiCard
            label="Скидки"
            value={loading ? "…" : `${formatNum(data.summary.discountAmount)} сом`}
            icon={Percent}
          />
          <KpiCard
            label="Товаров"
            value={loading ? "…" : formatNum(data.summary.itemsQty)}
            description="Единиц во всех документах"
            icon={Package}
          />
        </div>

        <div className="warehouse-analytics__card warehouse-analytics__accCard">
          <div className="warehouse-analytics-tableWrap">
            <div className="warehouse-analytics-tableScroll">
              <table className="warehouse-analytics-table partner-sales__table">
                <thead>
                  <tr>
                    <th scope="col">№</th>
                    <th scope="col">Номер</th>
                    <th scope="col">Дата</th>
                    <th scope="col">Склад</th>
                    <th scope="col">Покупатель</th>
                    <th scope="col">Агент</th>
                    <th scope="col">Позиций</th>
                    <th scope="col">Сумма</th>
                    <th scope="col">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="warehouse-analytics-table__empty">
                        Загрузка…
                      </td>
                    </tr>
                  ) : (
                    data.rows.map((row, idx) => {
                      const meta = saleStatusMeta(row.status);
                      const open = () => setOpenedRow(row);
                      return (
                        <tr
                          key={row.id}
                          className="partner-analytics__row--clickable"
                          onClick={open}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              open();
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`Документ ${row.number || ""}`}
                        >
                          <td>{(page - 1) * PARTNER_SALES_PAGE_SIZE + idx + 1}</td>
                          <td>{row.number || "—"}</td>
                          <td>{fmtDateTime(row.date)}</td>
                          <td>
                            {row.warehouse_from_name || "—"}
                            {row.branch_name ? ` (${row.branch_name})` : ""}
                          </td>
                          <td>{row.counterparty_display_name || "—"}</td>
                          <td>{row.agent_display || "—"}</td>
                          <td className="is-num">{formatNum(row.items_count)}</td>
                          <td className="is-num">{formatNum(row.total)} сом</td>
                          <td>
                            <span className={`partner-sales__status ${meta.className}`}>
                              {meta.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {!loading && data.rows.length === 0 && (
              <div className="warehouse-analytics-table__empty">
                {isReturns
                  ? "Нет возвратов за выбранный период."
                  : "Нет продаж за выбранный период."}
              </div>
            )}
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            count={data.count}
            countLabel="документов"
            loading={loading}
            hasNextPage={Boolean(data.next)}
            hasPrevPage={Boolean(data.previous)}
            onPageChange={setPage}
          />
        </div>
      </>
    );
  };

  return (
    <div className="warehouse-analytics partner-analytics partner-sales">
      <div className="warehouse-analytics__header">
        <div>
          <Link to={analyticsLink} state={{ partnerName }} className="partner-analytics__back">
            <ArrowLeft size={16} aria-hidden="true" />
            К аналитике партнёра
          </Link>
          <h2 className="warehouse-analytics__title">История продаж: {partnerName}</h2>
          {periodLabel && <p className="warehouse-analytics__subtitle">{periodLabel}</p>}
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

      {!unsupported && (
        <div className="partner-sales__filters">
          {segment(PARTNER_SALES_DOC_TYPES, docType, setDocType, "Тип документов")}
          {segment(PARTNER_SALES_STATUS_FILTERS, status, setStatus, "Статус")}
          <label className="partner-sales__search">
            <Search size={16} aria-hidden="true" />
            <input
              className="warehouse-analytics__input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Номер или покупатель"
              aria-label="Поиск по номеру или покупателю"
            />
          </label>
        </div>
      )}

      {renderBody()}

      {openedRow && (
        <PartnerSaleDetailModal
          partnerId={partnerId}
          summaryRow={openedRow}
          onClose={() => setOpenedRow(null)}
        />
      )}
    </div>
  );
};

export default PartnerSalesHistory;
