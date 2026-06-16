import { ArrowRight, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getOwnerPartnersAnalytics,
  listActiveStockPartners,
} from "../../../../api/warehouse";
import { isStartPlan } from "../../../../utils/subscriptionPlan";
import { useUser } from "../../../../store/slices/userSlice";
import {
  extractWarehouseApiError,
  formatNum,
  formatShortDate,
} from "./warehouseAnalyticsShared";
import { AnalyticsPeriodControls } from "./warehouseAnalyticsUi";
import { useAnalyticsPeriod } from "./useAnalyticsPeriod";
import "./Analytics.scss";

const PartnerAnalyticsList = () => {
  const navigate = useNavigate();
  const { tariff, company } = useUser();
  const showAgentSalesAnalytics = !isStartPlan(
    tariff || company?.subscription_plan?.name,
  );

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

  const [partnersLoading, setPartnersLoading] = useState(true);
  const [partners, setPartners] = useState([]);
  const [partnersError, setPartnersError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const loadPartners = useCallback(async () => {
    setPartnersLoading(true);
    setPartnersError("");
    try {
      const res = await listActiveStockPartners();
      setPartners(res?.partners || []);
    } catch (e) {
      setPartners([]);
      setPartnersError(
        extractWarehouseApiError(e, "Не удалось загрузить список партнёров"),
      );
    } finally {
      setPartnersLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    if (!partners.length) {
      setData(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await getOwnerPartnersAnalytics(periodParams());
      setData(result);
    } catch (e) {
      console.error(e);
      setError(
        extractWarehouseApiError(e, "Не удалось загрузить аналитику партнёров"),
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [partners.length, periodParams]);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  useEffect(() => {
    if (!partnersLoading && partners.length > 0) {
      loadAnalytics();
    }
  }, [partnersLoading, partners.length, loadAnalytics]);

  const openPartner = (row) => {
    navigate(`/crm/warehouse/partners/${row.id}/analytics`, {
      state: { partnerName: row.name },
    });
  };

  const periodLabel =
    data?.date_from && data?.date_to
      ? `${formatShortDate(data.date_from)} — ${formatShortDate(data.date_to)}`
      : null;

  const summaryRows = (data?.partners || []).map((p) => {
    const s = p.summary || {};
    return {
      id: p.partner_company_id,
      name: p.partner_company_name || "—",
      summary: s,
    };
  });

  return (
    <div className="warehouse-analytics partner-analytics">
      <div className="warehouse-analytics__header">
        <div>
          <h2 className="warehouse-analytics__title">Аналитика партнёров</h2>
          {periodLabel && (
            <p className="warehouse-analytics__subtitle">{periodLabel}</p>
          )}
        </div>
        <div className="warehouse-analytics__header-actions">
          <button
            type="button"
            className="warehouse-analytics__refresh"
            onClick={() => {
              loadPartners();
              loadAnalytics();
            }}
            disabled={loading || partnersLoading}
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

      {partnersError && (
        <div className="warehouse-analytics__error">{partnersError}</div>
      )}
      {error && <div className="warehouse-analytics__error">{error}</div>}

      {partnersLoading ? (
        <div className="warehouse-analytics__loading">Загрузка партнёров…</div>
      ) : partners.length === 0 ? (
        <div className="warehouse-analytics__card">
          <div className="warehouse-analytics-table__empty">
            Нет активных партнёров. Примите заявку на партнёрство в разделе
            складов.
          </div>
          <p style={{ marginTop: 12 }}>
            <Link to="/crm/warehouse/warehouses?tab=partnerships">
              Перейти к партнёрствам
            </Link>
          </p>
        </div>
      ) : loading ? (
        <div className="warehouse-analytics__loading">Загрузка аналитики…</div>
      ) : data ? (
        <div className="warehouse-analytics__card warehouse-analytics__accCard">
          <div className="warehouse-analytics-tableWrap">
            <div className="warehouse-analytics-tableScroll">
              <table className="warehouse-analytics-table partner-analytics__table">
                <thead>
                  <tr>
                    <th scope="col">Партнёр</th>
                    <th scope="col">Заявок</th>
                    <th scope="col">Позиций</th>
                    {showAgentSalesAnalytics && (
                      <>
                        <th scope="col">Продаж</th>
                        <th scope="col">Сумма продаж</th>
                      </>
                    )}
                    <th scope="col">Остаток, шт</th>
                    <th scope="col">Остаток, сом</th>
                    <th scope="col">Приход</th>
                    <th scope="col">Расход</th>
                    <th scope="col">Сальдо</th>
                    <th scope="col">Контрагенты</th>
                    <th scope="col" aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row) => {
                    const s = row.summary;
                    return (
                      <tr
                        key={row.id}
                        className="partner-analytics__row--clickable"
                        onClick={() => openPartner(row)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openPartner(row);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                      >
                        <td>{row.name}</td>
                        <td className="is-num">
                          {formatNum(s.requests_approved)}
                        </td>
                        <td className="is-num">{formatNum(s.items_approved)}</td>
                        {showAgentSalesAnalytics && (
                          <>
                            <td className="is-num">
                              {formatNum(s.sales_count)}
                            </td>
                            <td className="is-num">
                              {formatNum(s.sales_amount)} сом
                            </td>
                          </>
                        )}
                        <td className="is-num">{formatNum(s.on_hand_qty)}</td>
                        <td className="is-num">
                          {formatNum(s.on_hand_amount)} сом
                        </td>
                        <td className="is-num">
                          {formatNum(s.money_receipt_amount)} сом
                        </td>
                        <td className="is-num">
                          {formatNum(s.money_expense_amount)} сом
                        </td>
                        <td className="is-num">
                          {formatNum(s.money_net_amount)} сом
                        </td>
                        <td className="is-num">
                          {formatNum(s.money_counterparty_net_amount)} сом
                        </td>
                        <td className="partner-analytics__arrow">
                          <ArrowRight size={16} aria-hidden="true" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!summaryRows.length && (
              <div className="warehouse-analytics-table__empty">
                Нет данных за выбранный период.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PartnerAnalyticsList;
