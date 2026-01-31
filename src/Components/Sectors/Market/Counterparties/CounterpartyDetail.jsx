import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import warehouseAPI from "../../../../api/warehouse";
import { useDispatch, useSelector } from "react-redux";
import { getWarehouseCounterpartyById } from "../../../../store/creators/warehouseThunk";
import { clearCurrentCounterparty } from "../../../../store/slices/counterpartySlice";
import "./CounterpartyDetail.scss";

const fmtMoney = (v) =>
  (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 0 }) + " с";

const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("ru-RU");
};

/**
 * Страница детального просмотра контрагента: долги, общий долг, история оплат.
 */
const CounterpartyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const current = useSelector((state) => state.counterparty.current);
  const loadingCurrent = useSelector((state) => state.counterparty.loadingCurrent);

  const [debts, setDebts] = useState({ results: [], total_debt: 0 });
  const [payments, setPayments] = useState({ results: [] });
  const [loadingDebts, setLoadingDebts] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [errorDebts, setErrorDebts] = useState("");
  const [errorPayments, setErrorPayments] = useState("");

  const name = current?.name ?? "—";

  useEffect(() => {
    if (!id) return;
    dispatch(getWarehouseCounterpartyById(id));
    return () => dispatch(clearCurrentCounterparty());
  }, [dispatch, id]);

  const loadDebts = useCallback(async () => {
    if (!id) return;
    setLoadingDebts(true);
    setErrorDebts("");
    try {
      const data = await warehouseAPI.getCounterpartyDebts(id);
      setDebts({
        results: data?.results ?? [],
        total_debt: data?.total_debt ?? 0,
      });
    } catch (e) {
      setErrorDebts("Не удалось загрузить долги");
      setDebts({ results: [], total_debt: 0 });
    } finally {
      setLoadingDebts(false);
    }
  }, [id]);

  useEffect(() => {
    loadDebts();
  }, [loadDebts]);

  const loadPayments = useCallback(async () => {
    if (!id) return;
    setLoadingPayments(true);
    setErrorPayments("");
    try {
      const data = await warehouseAPI.getCounterpartyPayments(id);
      setPayments({ results: data?.results ?? [] });
    } catch (e) {
      setErrorPayments("Не удалось загрузить историю оплат");
      setPayments({ results: [] });
    } finally {
      setLoadingPayments(false);
    }
  }, [id]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const debtRows = debts.results || [];
  const totalDebt =
    debts.total_debt ?? debtRows.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const paymentRows = payments.results || [];

  const [activeTab, setActiveTab] = useState("debts");
  const TABS = [
    { key: "debts", label: "Долги контрагента" },
    { key: "payments", label: "История оплат" },
  ];

  const goBack = () => navigate("/crm/warehouse/counterparties");

  if (!id) {
    return (
      <div className="counterparty-detail-page">
        <div className="counterparty-detail-page__error">Контрагент не найден</div>
        <button type="button" className="counterparty-detail-page__back" onClick={goBack}>
          <ArrowLeft size={20} /> Назад
        </button>
      </div>
    );
  }

  return (
    <div className="counterparty-detail-page">
      <header className="counterparty-detail-page__header">
        <button
          type="button"
          className="counterparty-detail-page__back"
          onClick={goBack}
          aria-label="Назад к списку"
        >
          <ArrowLeft size={20} /> Назад
        </button>
        <h1 className="counterparty-detail-page__title">Контрагент: {name}</h1>
      </header>

      <div className="counterparty-detail-page__body">
        {loadingCurrent ? (
          <div className="counterparty-detail-page__loading">Загрузка данных контрагента...</div>
        ) : (
          <>
            <section className="counterparty-detail-page__section counterparty-detail-page__section--total">
              <h2 className="counterparty-detail-page__section-title">Общий долг</h2>
              <div className="counterparty-detail-page__total-debt">
                {loadingDebts ? "—" : fmtMoney(totalDebt)}
              </div>
            </section>

            <div className="counterparty-detail-page__tabs">
              <div className="counterparty-detail-page__tab-list" role="tablist">
                {TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === key}
                    className={`counterparty-detail-page__tab ${activeTab === key ? "counterparty-detail-page__tab--active" : ""}`}
                    onClick={() => setActiveTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="counterparty-detail-page__tab-panel">
                {activeTab === "debts" && (
                  <>
                    {loadingDebts ? (
                      <div className="counterparty-detail-page__loading">Загрузка...</div>
                    ) : errorDebts ? (
                      <div className="counterparty-detail-page__error">{errorDebts}</div>
                    ) : debtRows.length === 0 ? (
                      <div className="counterparty-detail-page__empty">Нет данных о долгах</div>
                    ) : (
                      <div className="counterparty-detail-page__table-wrap">
                        <table className="counterparty-detail-page__table">
                          <thead>
                            <tr>
                              <th>Документ / Описание</th>
                              <th>Сумма</th>
                              <th>Дата</th>
                            </tr>
                          </thead>
                          <tbody>
                            {debtRows.map((row) => (
                              <tr key={row.id || row.document_id || Math.random()}>
                                <td>{row.document_number ?? row.description ?? row.title ?? "—"}</td>
                                <td>{fmtMoney(row.amount)}</td>
                                <td>{fmtDate(row.date ?? row.created_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
                {activeTab === "payments" && (
                  <>
                    {loadingPayments ? (
                      <div className="counterparty-detail-page__loading">Загрузка...</div>
                    ) : errorPayments ? (
                      <div className="counterparty-detail-page__error">{errorPayments}</div>
                    ) : paymentRows.length === 0 ? (
                      <div className="counterparty-detail-page__empty">Нет данных об оплатах</div>
                    ) : (
                      <div className="counterparty-detail-page__table-wrap">
                        <table className="counterparty-detail-page__table">
                          <thead>
                            <tr>
                              <th>Дата</th>
                              <th>Сумма</th>
                              <th>Комментарий</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentRows.map((row) => (
                              <tr key={row.id || Math.random()}>
                                <td>{fmtDate(row.date ?? row.created_at ?? row.paid_at)}</td>
                                <td>{fmtMoney(row.amount)}</td>
                                <td>{row.comment ?? row.description ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CounterpartyDetail;
