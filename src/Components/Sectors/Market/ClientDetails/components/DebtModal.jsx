import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useParams } from "react-router-dom";

import {
  toYYYYMMDD,
  formatDateDDMMYYYY,
  toNumber,
} from "../clientDetails.helpers";
import { useClient } from "../../../../../store/slices/ClientSlice";
import { addCashFlows, getCashBoxes, useCash } from "../../../../../store/slices/cashSlice";
import { deleteDebt, getClientDealDetail, payDebtDeal, updateDealDetail } from "../../../../../store/creators/clientCreators";
import AlertModal from "../../../../common/AlertModal/AlertModal";
import api from "../../../../../api";

const DebtModal = ({ id, onClose, onChanged, clientType }) => {
  const dispatch = useDispatch();
  const { dealDetail } = useClient();
  const { list: cashBoxes } = useCash();
  const { id: clientId } = useParams();

  const isSupplier = String(clientType || "").toLowerCase() === "suppliers";

  const [state, setState] = useState({
    amount: "",
    debt_months: "",
    first_due_date: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [cashData, setCashData] = useState(() => ({
    cashbox: "",
    type: isSupplier ? "expense" : "income",
    name: "",
    amount: "",
  }));
  const [alert, setAlert] = useState({
    open: false,
    type: "error",
    message: "",
  });
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    message: "",
    onConfirm: null,
  });

  const [installmentEdits, setInstallmentEdits] = useState({});
  const [paymentAmounts, setPaymentAmounts] = useState({});

  useEffect(() => {
    dispatch(getClientDealDetail({ clientId, dealId: id }));
    dispatch(getCashBoxes());
  }, [id, dispatch, clientId]);

  // Для поставщиков оплата долга должна идти как расход, для клиентов — как приход
  useEffect(() => {
    setCashData((prev) => ({
      ...prev,
      type: isSupplier ? "expense" : "income",
    }));
  }, [isSupplier]);

  useEffect(() => {
    if (cashBoxes && cashBoxes.length > 0 && !cashData.cashbox) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setCashData((prev) => ({ ...prev, cashbox: firstCashBoxId }));
      }
    }
  }, [cashBoxes, cashData.cashbox]);

  useEffect(() => {
    if (dealDetail) {
      setState({
        amount: dealDetail.amount != null ? String(dealDetail.amount) : "",
        debt_months:
          dealDetail.debt_months != null ? String(dealDetail.debt_months) : "",
        first_due_date: dealDetail.first_due_date
          ? toYYYYMMDD(dealDetail.first_due_date)
          : "",
      });
      setInstallmentEdits({});
      setPaymentAmounts({});
    }
  }, [dealDetail]);

  const installments = useMemo(
    () =>
      Array.isArray(dealDetail?.installments)
        ? dealDetail.installments
        : [],
    [dealDetail]
  );

  const firstDueDate =
    dealDetail?.first_due_date ?? installments[0]?.due_date ?? null;

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      amount: dealDetail?.debt_amount,
    }));
  }, [dealDetail]);

  const amountNum = toNumber(isEditing ? state.amount : dealDetail?.amount);
  const monthsNum = toNumber(
    isEditing ? state.debt_months : dealDetail?.debt_months
  );

  const monthly = isEditing
    ? Number.isFinite(amountNum) && Number.isFinite(monthsNum) && monthsNum > 0
      ? (amountNum / monthsNum).toFixed(2)
      : "—"
    : dealDetail?.monthly_payment ?? "—";

  const onChange = (e) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async () => {
    try {
        const amount = Number(state.amount);
        const months = Number(state.debt_months);

        let installmentsPayload = null;
        if (Array.isArray(installments) && installments.length) {
        installmentsPayload = installments.map((p) => {
            const edit = installmentEdits[p.number] || {};

            const rawAmount =
            edit.amount !== undefined && edit.amount !== null
                ? edit.amount
                : p.amount;

            const rawDate =
            edit.due_date !== undefined && edit.due_date !== null
                ? edit.due_date
                : p.due_date;

            const parsedAmount = Number(
            String(rawAmount).toString().replace(",", ".")
            );

            return {
            number: p.number,
            amount: Number.isFinite(parsedAmount)
                ? parsedAmount.toFixed(2)
                : Number(p.amount || 0).toFixed(2),
            due_date: toYYYYMMDD(rawDate),
            };
        });
        }

        const payload = {
        amount: Number.isFinite(amount) ? amount : 0,
        debt_months: Number.isFinite(months) ? months : 0,
        ...(state.first_due_date
            ? { first_due_date: toYYYYMMDD(state.first_due_date) }
            : {}),
        };

        if (installmentsPayload && installmentsPayload.length) {
        payload.auto_schedule = true;       
        payload.installments = installmentsPayload;
        }

        await dispatch(
        updateDealDetail({
            id,
            data: payload,
            clientId,
        })
        ).unwrap();

        onChanged?.();
        dispatch(getClientDealDetail({ clientId, dealId: id }));

        setIsEditing(false);
        setInstallmentEdits({});
    } catch (e) {
        console.error(e);
        setAlert({
        open: true,
        type: "error",
        message: "Не удалось сохранить изменения",
        });
    }
    };



  const onPayDeal = async (data) => {
    try {
      // Проверяем, не оплачен ли уже взнос
      if (data.installment_id) {
        const installment = installments.find((i) => i.id === data.installment_id);
        if (installment && installment.paid_on) {
          return; // Взнос уже полностью оплачен
        }
      }

      // Добавляем idempotency_key если его нет
      if (!data.idempotency_key) {
        data.idempotency_key = crypto.randomUUID();
      }

      await dispatch(
        payDebtDeal({ id, clientId, data })
      ).unwrap();
      onChanged?.();
      dispatch(getClientDealDetail({ clientId, dealId: id }));
    } catch (e) {
      console.error(e);
    }
  };

  const onDeleteDebts = async (debtId) => {
    setConfirmDialog({
      open: true,
      message: "Удалить сделку?",
      onConfirm: async () => {
        try {
          await dispatch(deleteDebt(debtId)).unwrap();
          onClose();
          onChanged?.();
          setConfirmDialog({ open: false, message: "", onConfirm: null });
        } catch (e) {
          console.log(e);
          setConfirmDialog({ open: false, message: "", onConfirm: null });
        }
      },
    });
  };

  if (!id) return null;

  return (
    <div
      className="debt-modal__overlay modal-overlay"
      onClick={onClose}
    >
      <div
        className="debt-modal modal clientModal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="debt-modal__header">
          <h3 className="debt-modal__title">Долг клиента</h3>
          <button
            className="debt-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="debt-modal__content">

          <div className="debt-modal__info-grid">
            <div className="debt-modal__info-item">
              <div className="debt-modal__info-label">ФИО</div>
              <div className="debt-modal__info-value">
                {dealDetail?.client_full_name ?? "—"}
              </div>
            </div>

            <div className="debt-modal__info-item">
              <div className="debt-modal__info-label">Название сделки</div>
              <div className="debt-modal__info-value">
                {dealDetail?.title ?? "—"}
              </div>
            </div>

            <div className="debt-modal__info-item">
              <label
                className="debt-modal__info-label"
                htmlFor="debt-modal-amount"
              >
                Размер долга
              </label>
              {isEditing ? (
                <input
                  id="debt-modal-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  name="amount"
                  className="debt-modal__input debt__input"
                  value={state.amount}
                  onChange={onChange}
                />
              ) : (
                <div className="debt-modal__info-value">
                  {dealDetail?.debt_amount ?? dealDetail?.amount ?? "—"}
                </div>
              )}
            </div>

            <div className="debt-modal__info-item">
              <label
                className="debt-modal__info-label"
                htmlFor="debt-modal-debt_months"
              >
                Срок продления (мес.)
              </label>
              {isEditing ? (
                <input
                  id="debt-modal-debt_months"
                  type="number"
                  inputMode="numeric"
                  className="debt-modal__input debt__input"
                  step="1"
                  min="1"
                  name="debt_months"
                  value={state.debt_months}
                  onChange={onChange}
                />
              ) : (
                <div className="debt-modal__info-value">
                  {dealDetail?.debt_months ?? "—"}
                </div>
              )}
            </div>

            <div className="debt-modal__info-item">
              <label
                className="debt-modal__info-label"
                htmlFor="debt-modal-first_due_date"
              >
                Дата первого платежа
              </label>
              {isEditing ? (
                <input
                  id="debt-modal-first_due_date"
                  type="date"
                  className="debt-modal__input debt__input"
                  name="first_due_date"
                  value={state.first_due_date}
                  onChange={onChange}
                />
              ) : (
                <div className="debt-modal__info-value">
                  {dealDetail?.first_due_date
                    ? formatDateDDMMYYYY(dealDetail.first_due_date)
                    : "—"}
                </div>
              )}
            </div>

            {dealDetail?.prepayment !== "0.00" && (
              <div className="debt-modal__info-item">
                <div className="debt-modal__info-label">Предоплата</div>
                <div className="debt-modal__info-value">
                  {dealDetail?.prepayment ?? "—"}
                </div>
              </div>
            )}

            <div className="debt-modal__info-item">
              <div className="debt-modal__info-label">Ежемесячный платёж</div>
              <div className="debt-modal__info-value">{monthly}</div>
            </div>

            <div className="debt-modal__info-item">
              <div className="debt-modal__info-label">Остаток долга</div>
              <div className="debt-modal__info-value">
                {dealDetail?.remaining_debt ?? "—"}
              </div>
            </div>

            {dealDetail?.note && (
              <div className="debt-modal__info-item">
                <div className="debt-modal__info-label">Заметки</div>
                <div className="debt-modal__info-value">{dealDetail.note}</div>
              </div>
            )}
          </div>

          {/* ===== График платежей (с сервера) ===== */}
          {installments.length > 0 && (
            <section className="debt-modal__schedule schedule">
              <div className="debt-modal__schedule-header">
                <div className="debt-modal__schedule-title">График платежей</div>
              </div>
              <div className="debt-modal__schedule-content" aria-live="polite">
                <div className="debt-modal__schedule-table-wrapper">
                  <table className="debt-modal__schedule-table schedule__table" role="table">
                    <thead>
                    <tr>
                        <th style={{ textAlign: "left" }}>№</th>
                        <th style={{ textAlign: "left" }}>Срок оплаты</th>
                        <th style={{ textAlign: "right" }}>Сумма</th>
                        <th style={{ textAlign: "right" }}>Остаток</th>
                        <th style={{ textAlign: "right" }}>Оплачен</th>
                        <th style={{ textAlign: "right" }}>Сумма оплаты</th>
                        <th></th>
                    </tr>
                    </thead>
                    <tbody>
                    {installments.map((p) => {
                        const paid = Boolean(p.paid_on);
                        const edit = installmentEdits[p.number] || {};

                        const amountInputValue =
                        edit.amount !== undefined && edit.amount !== null
                            ? edit.amount
                            : p.amount;

                        const dueDateInputValue =
                        edit.due_date !== undefined && edit.due_date !== null
                            ? edit.due_date
                            : toYYYYMMDD(p.due_date);

                        return (
                        <tr
                            key={p.number}
                            className={
                              paid
                                ? "debt-modal__schedule-row--paid schedule__row--paid"
                                : undefined
                            }
                            aria-checked={paid}
                        >
                            <td style={{ textAlign: "left" }}>{p.number}</td>

                            {/* Срок оплаты (редактируемый) */}
                            <td style={{ textAlign: "left" }}>
                            {isEditing ? (
                                <input
                                type="date"
                                className="debt-modal__input debt__input"
                                value={dueDateInputValue || ""}
                                onChange={(e) =>
                                    setInstallmentEdits((prev) => ({
                                    ...prev,
                                    [p.number]: {
                                        ...prev[p.number],
                                        due_date: e.target.value,
                                    },
                                    }))
                                }
                                />
                            ) : (
                                formatDateDDMMYYYY(p.due_date)
                            )}

                            </td>

                            {/* Сумма (редактируемая) */}
                            <td style={{ textAlign: "right" }}>
                            {isEditing ? (
                                <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="debt-modal__input debt__input"
                                value={amountInputValue}
                                onChange={(e) =>
                                    setInstallmentEdits((prev) => ({
                                    ...prev,
                                    [p.number]: {
                                        ...prev[p.number],
                                        amount: e.target.value,
                                    },
                                    }))
                                }
                                />
                            ) : (
                                p.amount
                            )}
                            </td>

                            {/* Остаток после платежа (сервера) */}
                            <td style={{ textAlign: "right" }}>
                            {p.balance_after}
                            </td>

                            <td style={{ textAlign: "right" }}>
                            {p.paid_on ? formatDateDDMMYYYY(p.paid_on) : "—"}
                            </td>

                            {/* Сумма оплаты (фактический платеж сейчас) */}
                            <td style={{ textAlign: "right" }}>
                            {paid ? (
                                <span title="Платёж уже проведён">—</span>
                            ) : (
                                <>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={
                                    paymentAmounts[p.number] !== undefined
                                        ? paymentAmounts[p.number]
                                        : ""
                                    }
                                    onChange={(e) => {
                                    const value = e.target.value;
                                    setPaymentAmounts((prev) => ({
                                        ...prev,
                                        [p.number]: value,
                                    }));
                                    }}
                                    placeholder={
                                    p.paid_amount
                                        ? `${(
                                            Number(p.amount) -
                                            Number(p.paid_amount || 0)
                                        ).toFixed(2)} (остаток)`
                                        : `${p.amount} (полная сумма)`
                                    }
                                    style={{
                                    width: "120px",
                                    padding: "4px 8px",
                                    border: "1px solid #ddd",
                                    borderRadius: "4px",
                                    textAlign: "right",
                                    fontSize: "14px",
                                    }}
                                />
                                {p.paid_amount && Number(p.paid_amount) > 0 && (
                                    <div
                                    style={{
                                        fontSize: "11px",
                                        color: "#666",
                                        marginTop: "2px",
                                    }}
                                    >
                                    Уже оплачено:{" "}
                                    {Number(p.paid_amount).toFixed(2)}
                                    </div>
                                )}
                                </>
                            )}
                            </td>
                            <td style={{ textAlign: "right" }}>
                            {paid ? (
                                <span title="Платёж уже проведён">
                                Оплачено ✓
                                </span>
                            ) : (
                                <button
                                className="debt-modal__pay-btn schedule__pay-btn"
                                onClick={() => {
                                    const userEnteredAmount =
                                    paymentAmounts[p.number] !== undefined &&
                                    paymentAmounts[p.number] !== ""
                                        ? Number(paymentAmounts[p.number])
                                        : null;

                                    const fullAmount = Number(p.amount);
                                    const alreadyPaid = Number(
                                    p.paid_amount || 0
                                    );
                                    const remaining = fullAmount - alreadyPaid;

                                    if (remaining <= 0) {
                                    setAlert({
                                        open: true,
                                        type: "error",
                                        message: "Взнос уже полностью оплачен",
                                    });
                                    return;
                                    }

                                    let paymentAmount;
                                    let shouldSendAmount = false;

                                    if (userEnteredAmount !== null) {
                                    if (
                                        !Number.isFinite(userEnteredAmount) ||
                                        userEnteredAmount <= 0
                                    ) {
                                        setAlert({
                                        open: true,
                                        type: "error",
                                        message:
                                            "Введите корректную сумму оплаты",
                                        });
                                        return;
                                    }
                                    if (userEnteredAmount > remaining) {
                                        setAlert({
                                        open: true,
                                        type: "error",
                                        message: `Сумма оплаты не может превышать остаток (${remaining.toFixed(
                                            2
                                        )} сом)`,
                                        });
                                        return;
                                    }
                                    paymentAmount = userEnteredAmount;
                                    shouldSendAmount =
                                        paymentAmount < remaining;
                                    } else {
                                    paymentAmount = remaining;
                                    shouldSendAmount = false;
                                    }

                                    setConfirmDialog({
                                    open: true,
                                    message: `Подтверждаете оплату ${paymentAmount.toFixed(
                                        2
                                    )} сом?`,
                                    onConfirm: () => {
                                        const paymentData = {
                                        idempotency_key: crypto.randomUUID(),
                                        installment_id: p.id, // Используем ID взноса
                                        date: toYYYYMMDD(new Date()),
                                        note: "",
                                        };

                                        if (shouldSendAmount) {
                                        paymentData.amount =
                                            paymentAmount.toFixed(2);
                                        }

                                        onPayDeal(paymentData);
                                        dispatch(
                                        addCashFlows({
                                            ...cashData,
                                            amount: paymentAmount.toFixed(2),
                                            name: `оплата долга №${p.number}`,
                                            source_cashbox_flow_id: p.number,
                                            source_business_operation_id:
                                            "Оплата долга",
                                        })
                                        );
                                        setPaymentAmounts((prev) => {
                                        const next = { ...prev };
                                        delete next[p.number];
                                        return next;
                                        });
                                        setConfirmDialog({
                                        open: false,
                                        message: "",
                                        onConfirm: null,
                                        });
                                    },
                                    });
                                }}
                                >
                                Оплатить
                                </button>
                            )}
                            </td>
                        </tr>
                        );
                    })}
                    </tbody>

                    <tfoot>
                    <tr>
                        <td colSpan={2} style={{ fontWeight: 600 }}>
                        Итого
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {dealDetail?.debt_amount ?? "—"}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {installments[installments.length - 1]?.balance_after ??
                            "0.00"}
                        </td>
                        <td />
                    </tr>
                    </tfoot>
                </table>
                {firstDueDate && (
                  <p className="debt-modal__schedule-hint schedule__hint">
                    Первый платёж: {formatDateDDMMYYYY(firstDueDate)}.
                  </p>
                )}
              </div>
            </div>
          </section>
          )}
        </div>

        <div className="debt-modal__actions">
          {!isEditing ? (
            <>
              <button
                className="debt-modal__btn debt-modal__btn--primary btn edit-btn"
                onClick={() => setIsEditing(true)}
              >
                Редактировать
              </button>
              <button
                className="debt-modal__btn debt-modal__btn--danger btn edit-btn"
                onClick={() => onDeleteDebts(dealDetail?.id)}
              >
                Удалить
              </button>
              <button
                className="debt-modal__btn debt-modal__btn--secondary btn edit-btn"
                onClick={onClose}
              >
                Отмена
              </button>
            </>
          ) : (
            <>
              <button
                className="debt-modal__btn debt-modal__btn--primary btn edit-btn"
                onClick={onSubmit}
              >
                Сохранить
              </button>
              <button
                className="debt-modal__btn debt-modal__btn--secondary btn edit-btn"
                onClick={() => {
                  setState({
                    amount:
                      dealDetail?.amount != null
                        ? String(dealDetail.amount)
                        : "",
                    debt_months:
                      dealDetail?.debt_months != null
                        ? String(dealDetail.debt_months)
                        : "",
                    first_due_date: dealDetail?.first_due_date
                      ? toYYYYMMDD(dealDetail.first_due_date)
                      : "",
                  });
                  setInstallmentEdits({});
                  setIsEditing(false);
                }}
              >
                Отмена
              </button>
            </>
          )}
        </div>

        <AlertModal
          open={alert.open}
          type={alert.type}
          message={alert.message}
          okText="Ok"
          onClose={() => setAlert((a) => ({ ...a, open: false }))}
        />
        <AlertModal
          open={confirmDialog.open}
          type="info"
          message={confirmDialog.message}
          okText="Подтвердить"
          onClose={() =>
            setConfirmDialog({ open: false, message: "", onConfirm: null })
          }
          onConfirm={() => {
            if (confirmDialog.onConfirm) {
              confirmDialog.onConfirm();
            }
          }}
        />
      </div>
    </div>
  );
};

export default DebtModal;
