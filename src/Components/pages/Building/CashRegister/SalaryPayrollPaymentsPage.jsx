import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useBuildingSalary } from "@/store/slices/building/salarySlice";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import {
  fetchBuildingPayrolls,
  fetchBuildingPayrollLines,
  fetchBuildingPayrollLinePayments,
  createBuildingPayrollLinePayment,
  approveBuildingPayroll,
} from "@/store/creators/building/salaryCreators";
import { bulkStatusBuildingCashFlows } from "@/api/building";
import { fetchBuildingProjects } from "@/store/creators/building/projectsCreators";
import DataContainer from "@/Components/common/DataContainer/DataContainer";
import "./CashRegister.scss";

export default function CashRegisterSalaryPayrollPaymentsPage() {
  const { payrollId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const alert = useAlert();
  const confirm = useConfirm();

  const state = location.state || {};
  const payrollTitle = state.payrollTitle || "";
  const periodStart = state.periodStart || "";
  const periodEnd = state.periodEnd || "";
  const payrollStatusFromState = state.payrollStatus;

  const dispatch = useDispatch();
  const { linesByPayrollId, paymentsByLineId, payrolls } = useBuildingSalary();
  const { items: residentialComplexes, selectedProjectId } = useBuildingProjects();

  const [historyModalLineId, setHistoryModalLineId] = useState(null);
  const [paymentModalLineId, setPaymentModalLineId] = useState(null);
  const [payAmount, setPayAmount] = useState("");

  const linesBucket = payrollId ? linesByPayrollId?.[String(payrollId)] : null;
  const lines = useMemo(() => {
    const list = linesBucket?.list;
    return Array.isArray(list) ? list : [];
  }, [linesBucket?.list]);

  /** Выбранный ЖК в шапке раздела — его данные используем для операции выплаты */
  const selectedRc = useMemo(() => {
    if (!selectedProjectId || !Array.isArray(residentialComplexes)) return null;
    return (
      residentialComplexes.find(
        (rc) => String(rc?.id ?? rc?.uuid) === String(selectedProjectId),
      ) ?? null
    );
  }, [residentialComplexes, selectedProjectId]);

  useEffect(() => {
    dispatch(fetchBuildingProjects());
  }, [dispatch]);

  useEffect(() => {
    if (selectedProjectId) {
      dispatch(fetchBuildingPayrolls({ residential_complex: selectedProjectId }));
    }
  }, [dispatch, selectedProjectId]);

  useEffect(() => {
    if (payrollId) {
      dispatch(fetchBuildingPayrollLines(payrollId));
    }
  }, [dispatch, payrollId]);

  const currentPayroll = useMemo(() => {
    if (!payrollId || !Array.isArray(payrolls)) return null;
    return payrolls.find((p) => String(p?.id ?? p?.uuid) === String(payrollId)) ?? null;
  }, [payrolls, payrollId]);

  const isDraftPeriod = (payrollStatusFromState ?? currentPayroll?.status) === "draft";

  useEffect(() => {
    if (historyModalLineId) {
      dispatch(fetchBuildingPayrollLinePayments(historyModalLineId));
    }
  }, [dispatch, historyModalLineId]);

  const handleBack = () => {
    navigate("/crm/building/cash-register", { state: { tab: "salary" } });
  };

  const handleApprovePeriod = () => {
    if (!payrollId) return;
    confirm("Утвердить период начислений? После утверждения можно будет создавать полные выплаты.", async (ok) => {
      if (!ok) return;
      const res = await dispatch(approveBuildingPayroll(payrollId));
      if (res.meta.requestStatus === "fulfilled") {
        alert("Период утверждён");
        dispatch(fetchBuildingPayrolls({ residential_complex: selectedProjectId }));
        dispatch(fetchBuildingPayrollLines(payrollId));
      } else {
        alert(validateResErrors(res.payload || res.error, "Не удалось утвердить период"), true);
      }
    });
  };

  const handleCreatePayment = (line) => {
    const lineId = line?.id ?? line?.uuid ?? null;
    if (!lineId) return;
    setPaymentModalLineId(String(lineId));
    setPayAmount("");
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    if (!paymentModalLineId || !payAmount) {
      alert("Укажите сумму выплаты", true);
      return;
    }
    const amount = parseFloat(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Укажите корректную сумму", true);
      return;
    }
    if (!selectedRc?.salary_cashbox) {
      alert("У выбранного ЖК не настроена касса для ЗП. Настройте в карточке ЖК.", true);
      return;
    }
    const actionLabel = isDraftPeriod ? "Выдать аванс" : "Создать выплату";
    confirm(`${actionLabel} на сумму ${payAmount}?`, async (ok) => {
      if (!ok) return;
      try {
        const res = await dispatch(
          createBuildingPayrollLinePayment({
            lineId: paymentModalLineId,
            payload: {
              amount: amount.toFixed(2),
              cashbox: selectedRc.salary_cashbox,
              paid_at: new Date().toISOString(),
              status: "approved",
            },
          }),
        );
        if (res.meta.requestStatus === "fulfilled") {
          const payment = res.payload?.data;
          // Если backend создал связанное движение по кассе в статусе pending — сразу одобрим его
          try {
            const cashflowId = payment?.cashflow;
            if (cashflowId) {
              await bulkStatusBuildingCashFlows({
                items: [{ id: cashflowId, status: "approved" }],
              });
            }
          } catch (err) {
            // Если не удалось одобрить движение по кассе, просто покажем ошибку, но саму выплату не откатываем
            alert(
              validateResErrors(
                err,
                "Выплата создана, но не удалось провести расход по кассе",
              ),
              true,
            );
          }

          alert(isDraftPeriod ? "Аванс выдан" : "Выплата создана");
          setPaymentModalLineId(null);
          setPayAmount("");
          dispatch(fetchBuildingPayrollLinePayments(paymentModalLineId));
          dispatch(fetchBuildingPayrollLines(payrollId));
        } else {
          alert(
            validateResErrors(
              res.payload || res.error,
              isDraftPeriod ? "Не удалось выдать аванс" : "Не удалось создать выплату",
            ),
            true,
          );
        }
      } catch (err) {
        alert(validateResErrors(err, "Не удалось создать выплату"), true);
      }
    });
  };

  const paymentsForHistory = useMemo(() => {
    if (!historyModalLineId) return [];
    const bucket = paymentsByLineId?.[String(historyModalLineId)];
    const list = bucket?.list;
    return Array.isArray(list) ? list : [];
  }, [historyModalLineId, paymentsByLineId]);

  const historyLoading = historyModalLineId
    ? paymentsByLineId?.[String(historyModalLineId)]?.loading
    : false;

  const lineForPaymentModal = lines.find(
    (l) => String(l?.id ?? l?.uuid) === String(paymentModalLineId),
  );
  const hasSalaryCashbox = !!selectedRc?.salary_cashbox;
  const remainingToPay =
    lineForPaymentModal != null
      ? (Number(lineForPaymentModal.net_to_pay) || 0) -
        (Number(lineForPaymentModal.paid_total) || 0)
      : null;

  return (
    <div className="warehouse-page">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <button
            type="button"
            className="warehouse-view-btn"
            onClick={handleBack}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginRight: 12,
              padding: "6px 12px",
            }}
          >
            <ArrowLeft size={18} />
            К кассе
          </button>
          <div className="warehouse-header__icon-box">💰</div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">
              Выплаты по периоду
              {payrollTitle ? `: ${payrollTitle}` : ""}
              {isDraftPeriod && (
                <span style={{ fontSize: 14, fontWeight: 500, color: "#b45309", marginLeft: 8 }}>
                  (черновик)
                </span>
              )}
            </h1>
            {isDraftPeriod && (
              <button
                type="button"
                className="warehouse-view-btn bg-slate-900 text-white border-slate-900"
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid",
                  fontSize: 14,
                  fontWeight: 500,
                  marginBottom: 8,
                }}
                onClick={handleApprovePeriod}
              >
                Утвердить период
              </button>
            )}
            <p className="warehouse-header__subtitle">
              {selectedRc?.name && (
                <span style={{ marginRight: 8 }}>
                  ЖК: <strong>{selectedRc.name}</strong>
                  {selectedRc?.salary_cashbox ? " · Касса для ЗП настроена" : " · Касса для ЗП не настроена"}
                </span>
              )}
              {periodStart && periodEnd ? `${periodStart} — ${periodEnd}` : "Список сотрудников и остаток к выплате."}
            </p>
          </div>
        </div>
      </div>

      <DataContainer>
        {!payrollId ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            Не указан период.
          </div>
        ) : linesBucket?.loading && lines.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            Загрузка строк начислений...
          </div>
        ) : linesBucket?.error ? (
          <div className="text-red-500" style={{ padding: 24 }}>
            {String(
              validateResErrors(
                linesBucket.error,
                "Не удалось загрузить строки",
              ),
            )}
          </div>
        ) : lines.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            Нет строк начислений по этому периоду.
          </div>
        ) : (
          <div className="warehouse-table-container w-full">
            <table className="warehouse-table w-full">
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>К выплате</th>
                  <th>Выплачено</th>
                  <th style={{ width: 200 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const lid = line?.id ?? line?.uuid;
                  const net = Number(line?.net_to_pay) || 0;
                  const paid = Number(line?.paid_total) || 0;
                  const toPay = Math.max(0, net - paid);
                  return (
                    <tr key={lid}>
                      <td>
                        {line?.employee_display ||
                          line?.employee_name ||
                          line?.employee ||
                          "—"}
                      </td>
                      <td>{toPay.toFixed(2)}</td>
                      <td>{paid.toFixed(2)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="warehouse-view-btn bg-slate-900 text-white border-slate-900"
                            style={{
                              padding: "6px 12px",
                              borderRadius: 6,
                              border: "1px solid",
                              fontSize: 13,
                              fontWeight: 500,
                            }}
                            onClick={() => handleCreatePayment(line)}
                          >
                            {isDraftPeriod ? "Выдать аванс" : "Выплатить"}
                          </button>
                          <button
                            type="button"
                            className="warehouse-view-btn bg-white text-slate-700 border-slate-200"
                            style={{
                              padding: "6px 12px",
                              borderRadius: 6,
                              border: "1px solid",
                              fontSize: 13,
                            }}
                            onClick={() => setHistoryModalLineId(lid)}
                          >
                            История выплат
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DataContainer>

      <Modal
        wrapperId="cash-register-history-modal"
        open={Boolean(historyModalLineId)}
        onClose={() => setHistoryModalLineId(null)}
        title="История выплат"
      >
        {historyLoading ? (
          <div style={{ padding: 16 }}>Загрузка...</div>
        ) : (
          <div style={{ minWidth: 320 }}>
            {paymentsForHistory.length === 0 ? (
              <p className="salary-detail__muted" style={{ padding: 16 }}>
                Выплат по этой строке пока нет.
              </p>
            ) : (
              <table className="warehouse-table w-full">
                <thead>
                  <tr>
                    <th>Сумма</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsForHistory.map((pmt) => (
                    <tr key={pmt?.id ?? pmt?.uuid}>
                      <td>{pmt?.amount ?? "—"}</td>
                      <td>
                        {pmt?.paid_at
                          ? new Date(pmt.paid_at).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                className="warehouse-view-btn bg-slate-200 text-slate-800"
                style={{ padding: "8px 16px", borderRadius: 8 }}
                onClick={() => setHistoryModalLineId(null)}
              >
                Закрыть
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        wrapperId="cash-register-payment-modal"
        open={!!paymentModalLineId}
        onClose={() => {
          setPaymentModalLineId(null);
          setPayAmount("");
        }}
        title={isDraftPeriod ? "Выдать аванс" : "Создать выплату"}
      >
        <form
          className="add-product-page add-product-page--modal-form"
          onSubmit={submitPayment}
        >
          {!hasSalaryCashbox && (
            <div
              className="add-product-page__error"
              style={{
                marginBottom: 12,
                padding: 12,
                borderLeft: "4px solid #f97316",
                background: "#fff8f0",
              }}
            >
              У выбранного ЖК {selectedRc?.name ? `«${selectedRc.name}»` : ""} не настроена касса для ЗП. Настройте кассу в карточке ЖК (вкладка «Касса»), чтобы создавать выплаты.
            </div>
          )}
          <div className="add-product-page__form-group">
            <label className="add-product-page__label">Сумма *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="add-product-page__input"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="10000.00"
              disabled={!hasSalaryCashbox}
            />
            {remainingToPay != null && (
              <p className="add-product-page__hint" style={{ marginTop: 6 }}>
                Доступно к выплате: <b>{remainingToPay.toFixed(2)}</b>
              </p>
            )}
          </div>
          <div className="add-product-page__actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="add-product-page__cancel-btn"
              onClick={() => {
                setPaymentModalLineId(null);
                setPayAmount("");
              }}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="add-product-page__submit-btn"
              disabled={!hasSalaryCashbox}
            >
              {isDraftPeriod ? "Выдать аванс" : "Создать выплату"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
