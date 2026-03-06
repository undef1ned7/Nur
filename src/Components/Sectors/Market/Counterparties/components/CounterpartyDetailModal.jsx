import React, { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import warehouseAPI from "../../../../../api/warehouse";
import { useDispatch, useSelector } from "react-redux";
import { getWarehouseCounterpartyById } from "../../../../../store/creators/warehouseThunk";
import { clearCurrentCounterparty } from "../../../../../store/slices/counterpartySlice";
import "./CounterpartyDetailModal.scss";

const fmtMoney = (v) =>
  (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 0 }) + " с";

const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("ru-RU");
};

/**
 * Модальное окно детального просмотра контрагента: долги, общий долг, история оплат.
 */
const CounterpartyDetailModal = ({ counterparty, onClose }) => {
  const dispatch = useDispatch();
  const current = useSelector((state) => state.counterparty.current);
  const loadingCurrent = useSelector((state) => state.counterparty.loadingCurrent);

  const [debts, setDebts] = useState({ results: [], total_debt: 0 });
  const [payments, setPayments] = useState({ results: [] });
  const [loadingDebts, setLoadingDebts] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [errorDebts, setErrorDebts] = useState("");
  const [errorPayments, setErrorPayments] = useState("");

  const id = counterparty?.id;
  const name = current?.name ?? counterparty?.name ?? "—";

  // Загрузка деталей контрагента
  useEffect(() => {
    if (!id) return;
    dispatch(getWarehouseCounterpartyById(id));
    return () => dispatch(clearCurrentCounterparty());
  }, [dispatch, id]);

  // Загрузка долгов
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

  // Загрузка истории оплат
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
  const totalDebt = debts.total_debt ?? debtRows.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const paymentRows = payments.results || [];

  const [activeTab, setActiveTab] = useState("debts");
  const TABS = [
    { key: "debts", label: "Долги контрагента" },
    { key: "payments", label: "История оплат" },
  ];

  return (
    <div className="counterparty-detail-overlay" onClick={onClose}>
      <div
        className="counterparty-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="counterparty-detail-modal__header">
          <h2 className="counterparty-detail-modal__title">Контрагент: {name}</h2>
          <button
            className="counterparty-detail-modal__close"
            onClick={onClose}
            type="button"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        <div className="counterparty-detail-modal__body">
          {loadingCurrent ? (
            <div className="counterparty-detail-modal__loading">Загрузка данных контрагента...</div>
          ) : (
            <>
              {/* Общий долг — выделенный блок */}
              <section className="counterparty-detail-modal__section counterparty-detail-modal__section--total">
                <h3 className="counterparty-detail-modal__section-title">Общий долг</h3>
                <div className="counterparty-detail-modal__total-debt">
                  {loadingDebts ? "—" : fmtMoney(totalDebt)}
                </div>
              </section>

              {/* Табы: Долги контрагента / История оплат */}
              <div className="counterparty-detail-modal__tabs">
                <div className="counterparty-detail-modal__tab-list" role="tablist">
                  {TABS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === key}
                      className={`counterparty-detail-modal__tab ${activeTab === key ? "counterparty-detail-modal__tab--active" : ""}`}
                      onClick={() => setActiveTab(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="counterparty-detail-modal__tab-panel">
                  {activeTab === "debts" && (
                    <>
                      {loadingDebts ? (
                        <div className="counterparty-detail-modal__loading">Загрузка...</div>
                      ) : errorDebts ? (
                        <div className="counterparty-detail-modal__error">{errorDebts}</div>
                      ) : debtRows.length === 0 ? (
                        <div className="counterparty-detail-modal__empty">Нет данных о долгах</div>
                      ) : (
                        <div className="counterparty-detail-modal__table-wrap">
                          <table className="counterparty-detail-modal__table">
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
                        <div className="counterparty-detail-modal__loading">Загрузка...</div>
                      ) : errorPayments ? (
                        <div className="counterparty-detail-modal__error">{errorPayments}</div>
                      ) : paymentRows.length === 0 ? (
                        <div className="counterparty-detail-modal__empty">Нет данных об оплатах</div>
                      ) : (
                        <div className="counterparty-detail-modal__table-wrap">
                          <table className="counterparty-detail-modal__table">
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
    </div>
  );
};

export default CounterpartyDetailModal;
