import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import api from "../../../../api";
import {
  cancellationOfPayment,
  deleteDebt,
  getClientDealDetail,
  getClientDeals,
  payDebtDeal,
  updateDealDetail,
} from "../../../../store/creators/clientCreators";
import { useClient } from "../../../../store/slices/ClientSlice";
import "./ClientDetails.scss";
import { useUser } from "../../../../store/slices/userSlice";
import {
  addCashFlows,
  useCash,
  getCashBoxes,
} from "../../../../store/slices/cashSlice";
import AlertModal from "../../../common/AlertModal/AlertModal";

/* ===== helpers ===== */
const listFrom = (res) => res?.data?.results || res?.data || [];

const toDecimalString = (v) => {
  const s = String(v ?? "")
    .replace(",", ".")
    .trim();
  if (s === "" || s === "-") return "0.00";
  const n = Number(s);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

const kindLabel = (v) =>
  ({ sale: "Продажа", debt: "Долг", prepayment: "Предоплата" }[v] || v || "—");

const ruStatusToKind = (s) => {
  if (!s) return "sale";
  const t = s.toLowerCase();
  if (t.startsWith("долг")) return "debt"; // "Долг"/"Долги" и т.п.
  if (t.startsWith("аванс")) return "prepayment";
  if (t.startsWith("предоплат")) return "prepayment";
  return "sale";
};

const kindToRu = (k) =>
  ({ sale: "Продажа", debt: "Долг", prepayment: "Предоплата" }[k] || "Продажа");

// отображение типа по новому enum: client / suppliers / implementers
const typeLabel = (t) => {
  const v = String(t || "").toLowerCase();
  if (v === "client") return "Клиент";
  if (v === "suppliers") return "Поставщик";
  if (v === "implementers") return "Реализатор";
  return "—";
};

function normalizeDealFromApi(resOrObj) {
  const d = resOrObj?.data ?? resOrObj;
  return {
    id: d.id,
    title: d.title || "",
    kind: d.kind || "sale",

    // суммы с сервера (строки -> числа)
    amount: Number(d.amount ?? 0),

    // НОВОЕ: тянем предоплату и остаток долга прямо из API
    prepayment: Number(d.prepayment ?? 0),
    remaining_debt: Number(d.remaining_debt ?? 0),
    debt_amount: Number(d.debt_amount ?? d.amount ?? 0),
    monthly_payment: Number(d.monthly_payment ?? 0),
    debt_months: d.debt_months ?? null,

    note: d.note || "",
    client: d.client || null,
    created_at: d.created_at || null,
    updated_at: d.updated_at || null,
  };
}

function msgFromError(e, fallback) {
  const data = e?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    try {
      const k = Object.keys(data)[0];
      const v = Array.isArray(data[k]) ? data[k][0] : data[k];
      return String(v || fallback);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

// безопасно взять YYYY-MM-DD из чего угодно
const toIsoDate10 = (v) => {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v; // YYYY-MM-DD
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v); // DD.MM.YYYY
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(v);
  if (isNaN(d)) return "";
  const y = d.getFullYear();
  const m2 = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m2}-${day}`;
};

// helpers
function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export function toYYYYMMDD(input) {
  if (input == null) return "";

  if (typeof input === "string") {
    const s = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // Уже в нужном формате
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s); // DD.MM.YYYY -> YYYY-MM-DD
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }

  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";

  // Нормализуем к локальной дате без сдвига на таймзону
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatDateDDMMYYYY(input) {
  if (!input) return "—";
  // сервер отдаёт YYYY-MM-DD
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split("-");
    return `${d}.${m}.${y}`;
  }
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return String(input);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/* ========================================================================
   Modal: DebtModal
   - можно редактировать:
     - общую сумму долга / месяцы / дату первого платежа
     - СУММУ каждого платежа (installments[].amount)
     - СРОК ОПЛАТЫ каждого платежа (installments[].due_date)
   ======================================================================== */
const DebtModal = ({ id, onClose, onChanged }) => {
  const dispatch = useDispatch();
  const { dealDetail } = useClient();
  const { list: cashBoxes } = useCash();
  const { id: clientId } = useParams();

  const [state, setState] = useState({
    amount: "",
    debt_months: "",
    first_due_date: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [cashData, setCashData] = useState({
    cashbox: "",
    type: "income",
    name: "",
    amount: "",
  });
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

  // Локальные правки для installments: { [number]: { amount?, due_date? } }
  const [installmentEdits, setInstallmentEdits] = useState({});
  // Суммы платежей (оплаты) по каждому взносу
  const [paymentAmounts, setPaymentAmounts] = useState({});

  // грузим детали сделки и кассы
  useEffect(() => {
    dispatch(getClientDealDetail({ clientId, dealId: id }));
    dispatch(getCashBoxes());
  }, [id, dispatch, clientId]);

  // Автоматически выбираем первую кассу по индексу
  useEffect(() => {
    if (cashBoxes && cashBoxes.length > 0 && !cashData.cashbox) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setCashData((prev) => ({ ...prev, cashbox: firstCashBoxId }));
      }
    }
  }, [cashBoxes, cashData.cashbox]);

  // когда детали приехали — заполняем форму из СЕРВЕРА
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
      // сбрасываем правки по графику
      setInstallmentEdits({});
      setPaymentAmounts({});
    }
  }, [dealDetail]);

  const installments = useMemo(() => {
    return Array.isArray(dealDetail?.installments)
      ? dealDetail.installments
      : [];
  }, [dealDetail]);

  const firstDueDate =
    dealDetail?.first_due_date ?? installments[0]?.due_date ?? null;

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      amount: dealDetail?.debt_amount,
    }));
  }, [dealDetail]);

  // источники значений (форма/сервер)
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

  // ===== Сохранение (общие поля + installments) =====
  const onSubmit = async () => {
    try {
      const amount = Number(state.amount);
      const months = Number(state.debt_months);

      // готовим payload для графика платежей
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
            // ВАЖНО: поле "number" как в ответе сервера
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
        ...(installmentsPayload && installmentsPayload.length
          ? { installments: installmentsPayload }
          : {}),
      };

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
      const alreadyPaid = installments.some(
        (i) => i.number === data.installment_number && i.paid_on
      );
      if (alreadyPaid) return;

      await dispatch(payDebtDeal({ id, data })).unwrap();
      onChanged?.();
      dispatch(getClientDealDetail({ clientId, dealId: id }));
    } catch (e) {
      console.error(e);
    }
  };

  const onDeleteDebts = async (id) => {
    setConfirmDialog({
      open: true,
      message: "Удалить сделку?",
      onConfirm: async () => {
        try {
          await dispatch(deleteDebt(id)).unwrap();
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal clientModal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3>Долг клиента</h3>

        <div className="row">
          <div className="label">ФИО</div>
          <div className="value">{dealDetail?.client_full_name ?? "—"}</div>
        </div>

        <div className="row">
          <div className="label">Название сделки</div>
          <div className="value">{dealDetail?.title ?? "—"}</div>
        </div>

        <div className="row">
          <label className="label" htmlFor="amount">
            Размер долга
          </label>
          {isEditing ? (
            <input
              id="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              name="amount"
              className="debt__input"
              value={state.amount}
              onChange={onChange}
            />
          ) : (
            <div className="value">
              {dealDetail?.debt_amount ?? dealDetail?.amount ?? "—"}
            </div>
          )}
        </div>

        <div className="row">
          <label className="label" htmlFor="debt_months">
            Срок продления (мес.)
          </label>
          {isEditing ? (
            <input
              id="debt_months"
              type="number"
              inputMode="numeric"
              className="debt__input"
              step="1"
              min="1"
              name="debt_months"
              value={state.debt_months}
              onChange={onChange}
            />
          ) : (
            <div className="value">{dealDetail?.debt_months ?? "—"}</div>
          )}
        </div>

        <div className="row">
          <label className="label" htmlFor="first_due_date">
            Дата первого платежа
          </label>
          {isEditing ? (
            <input
              id="first_due_date"
              type="date"
              className="debt__input"
              name="first_due_date"
              value={state.first_due_date}
              onChange={onChange}
            />
          ) : (
            <div className="value">
              {dealDetail?.first_due_date
                ? formatDateDDMMYYYY(dealDetail.first_due_date)
                : "—"}
            </div>
          )}
        </div>

        {dealDetail?.prepayment !== "0.00" && (
          <div className="row">
            <div className="label">Предоплата</div>
            <div className="value">{dealDetail?.prepayment ?? "—"}</div>
          </div>
        )}
        <div className="row">
          <div className="label">Ежемесячный платёж</div>
          <div className="value">{monthly}</div>
        </div>

        <div className="row">
          <div className="label">Остаток долга</div>
          <div className="value">{dealDetail?.remaining_debt ?? "—"}</div>
        </div>

        {dealDetail?.note && (
          <div className="row">
            <div className="label">Заметки</div>
            <div className="value">{dealDetail.note}</div>
          </div>
        )}

        {/* ===== График платежей (с сервера) ===== */}
        {installments.length > 0 && (
          <section className="schedule">
            <div className="row3">
              <div className="label">График платежей</div>
              <div className="value" aria-live="polite">
                <table className="schedule__table" role="table">
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
                          className={paid ? "schedule__row--paid" : undefined}
                          aria-checked={paid}
                        >
                          <td style={{ textAlign: "left" }}>{p.number}</td>

                          {/* Срок оплаты (редактируемый) */}
                          <td style={{ textAlign: "left" }}>
                            {isEditing ? (
                              <input
                                type="date"
                                className="debt__input"
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
                                className="debt__input"
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
                                className="schedule__pay-btn"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                }}
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
                                        installment_number: p.number,
                                        date: toYYYYMMDD(new Date()),
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
                  <p className="schedule__hint">
                    Первый платёж: {formatDateDDMMYYYY(firstDueDate)}.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {!isEditing ? (
          <div className="actions">
            <button className="btn edit-btn" onClick={() => setIsEditing(true)}>
              Редактировать
            </button>
            <button
              className="btn edit-btn"
              onClick={() => onDeleteDebts(dealDetail?.id)}
            >
              Удалить
            </button>
            <button className="btn edit-btn" onClick={onClose}>
              Отмена
            </button>
          </div>
        ) : (
          <div className="actions">
            <button className="btn edit-btn" onClick={onSubmit}>
              Сохранить
            </button>
            <button
              className="btn edit-btn"
              onClick={() => {
                setState({
                  amount:
                    dealDetail?.amount != null ? String(dealDetail.amount) : "",
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
          </div>
        )}

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

/* ========================================================================
   MarketClientDetails
   ======================================================================== */
export default function MarketClientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { company } = useUser();
  const { clients = [], setClients = () => {} } = useOutletContext() || {};

  const initialClient = useMemo(() => {
    return (
      clients.find((c) => String(c.id) === String(id)) ||
      (state && String(state?.id) === String(id) ? state : null)
    );
  }, [clients, state, id]);

  const [client, setClient] = useState(initialClient);

  // modal states
  const [isDealFormOpen, setIsDealFormOpen] = useState(false);
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [showDebtModal, setShowDebtModal] = useState(false);

  // quick add deal fields
  const [dealName, setDealName] = useState("");
  const [dealBudget, setDealBudget] = useState("");
  const [dealStatus, setDealStatus] = useState("Продажа");
  const [dealDebtMonths, setDealDebtMonths] = useState(""); // срок долга (мес.)
  const [dealFirstDueDate, setDealFirstDueDate] = useState(""); // дата первого платежа

  // client edit fields
  const [editFio, setEditFio] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editDate, setEditDate] = useState("");
  const [saveClientErr, setSaveClientErr] = useState("");
  const [savingClient, setSavingClient] = useState(false);

  // deals
  const [deals, setDeals] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [dealsErr, setDealsErr] = useState("");
  const [clientErr, setClientErr] = useState("");
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [reconciliationData, setReconciliationData] = useState(null);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);
  const [reconciliationErr, setReconciliationErr] = useState("");
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
  const dispatch = useDispatch();

  // ====== состояние фильтра дат ======
  const [dateFrom, setDateFrom] = useState(""); // 'YYYY-MM-DD'
  const [dateTo, setDateTo] = useState(""); // 'YYYY-MM-DD'

  // ====== Reconciliation filters ======
  const [reconciliationFilters, setReconciliationFilters] = useState({
    start: "",
    end: "",
  });

  useEffect(() => {
    setClient(initialClient);
  }, [initialClient]);

  // если клиента нет в состоянии — подгружаем по id
  useEffect(() => {
    const fetchClient = async () => {
      if (client || !id) return;
      try {
        setClientErr("");
        const res = await api.get(`/main/clients/${id}/`);
        const loaded = res?.data || null;
        if (loaded) {
          setClient(loaded);
          setClients((prev) => {
            const arr = Array.isArray(prev) ? prev : [];
            const exists = arr.some((c) => String(c.id) === String(id));
            return exists
              ? arr.map((c) => (String(c.id) === String(id) ? loaded : c))
              : [loaded, ...arr];
          });
        }
      } catch (e) {
        console.error(e);
        setClientErr("Не удалось загрузить клиента");
      }
    };
    fetchClient();
  }, [client, id, setClients]);

  // загрузка сделок клиента
  const loadDeals = async (clientId) => {
    setDealsLoading(true);
    setDealsErr("");
    try {
      const res = await api.get(`/main/clients/${clientId}/deals/`);
      const list = listFrom(res).map(normalizeDealFromApi);
      setDeals(list);
    } catch (e) {
      console.error(e);
      setDealsErr(msgFromError(e, "Не удалось загрузить сделки"));
    } finally {
      setDealsLoading(false);
    }
  };

  // при появлении клиента — грузим сделки
  useEffect(() => {
    if (client?.id) loadDeals(client.id);
  }, [client?.id]);

  // обновить клиента локально
  const persistClient = (patch) => {
    if (!client) return;
    const next = { ...client, ...patch };
    setClient(next);
    setClients((prev) =>
      Array.isArray(prev)
        ? prev.map((c) => (c.id === next.id ? next : c))
        : prev
    );
  };

  const openDealForm = (deal = null) => {
    setEditingDeal(deal);
    setDealName(deal?.title || "");
    setDealBudget(
      deal?.amount !== undefined && deal?.amount !== null
        ? String(deal.amount)
        : ""
    );
    setDealStatus(deal ? kindToRu(deal.kind) : "Продажа");
    setDealDebtMonths(
      deal?.debt_months !== undefined && deal?.debt_months !== null
        ? String(deal.debt_months)
        : ""
    );
    setDealFirstDueDate(
      deal?.first_due_date ? toYYYYMMDD(deal.first_due_date) : ""
    );
    setIsDealFormOpen(true);
    loadDeals(client.id);
  };

  const openClientForm = () => {
    setEditFio(client?.fio || client?.full_name || "");
    setEditPhone(client?.phone || "");
    setEditEmail(client?.email || "");
    setEditDate(toIsoDate10(client?.date) || "");
    setSaveClientErr("");
    setIsClientFormOpen(true);
  };

  /* ===== API: Deals ===== */
  const createDealApi = async (
    clientId,
    { title, statusRu, amount, debt_months, first_due_date }
  ) => {
    const payload = {
      title: String(title || "").trim(),
      kind: ruStatusToKind(statusRu),
      amount: toDecimalString(amount),
      note: "",
      client: clientId,
      ...(ruStatusToKind(statusRu) === "debt" && Number(debt_months) > 0
        ? { debt_months: parseInt(debt_months, 10) }
        : {}),
      ...(ruStatusToKind(statusRu) === "debt" &&
      first_due_date &&
      toYYYYMMDD(first_due_date)
        ? { first_due_date: toYYYYMMDD(first_due_date) }
        : {}),
    };
    const res = await api.post(`/main/clients/${clientId}/deals/`, payload);
    return normalizeDealFromApi(res);
  };

  const updateDealApi = async (
    dealId,
    { clientId, title, statusRu, amount, debt_months, first_due_date }
  ) => {
    const payload = {
      title: String(title || "").trim(),
      kind: ruStatusToKind(statusRu),
      amount: toDecimalString(amount),
      note: "",
      client: clientId,
      ...(ruStatusToKind(statusRu) === "debt" && Number(debt_months) > 0
        ? { debt_months: parseInt(debt_months, 10) }
        : {}),
      ...(ruStatusToKind(statusRu) === "debt" &&
      first_due_date &&
      toYYYYMMDD(first_due_date)
        ? { first_due_date: toYYYYMMDD(first_due_date) }
        : {}),
    };
    const res = await api.patch(
      `/main/clients/${clientId}/deals/${dealId}/`,
      payload
    );
    return normalizeDealFromApi(res);
  };

  const deleteDealApi = async (dealId, clientId) => {
    await api.delete(`/main/clients/${clientId}/deals/${dealId}/`);
  };

  // ====== Reconciliation API (акт сверки) ======
  const fetchReconciliation = async (clientId, filters) => {
    setReconciliationLoading(true);
    setReconciliationErr("");

    const downloadBlob = (blob, suggestedName = "reconciliation.pdf") => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = suggestedName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const nameFromCD = (cd, fallback) => {
      if (!cd) return fallback;
      const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(cd);
      const plain = /filename="?([^"]+)"?/i.exec(cd);
      const raw = (star?.[1] || plain?.[1] || "").trim();
      if (!raw) return fallback;
      try {
        return decodeURIComponent(raw.replace(/^['"]|['"]$/g, ""));
      } catch {
        return raw || fallback;
      }
    };

    try {
      const params = new URLSearchParams();
      if (filters.start) params.append("start", filters.start);
      if (filters.end) params.append("end", filters.end);

      const res = await api.get(`/main/clients/${clientId}/reconciliation/`, {
        params,
        responseType: "blob",
        headers: { Accept: "application/pdf, application/json" },
      });

      const ct = (res.headers?.["content-type"] || "").toLowerCase();

      if (ct.includes("application/pdf")) {
        const filename = nameFromCD(
          res.headers?.["content-disposition"],
          `reconciliation_${clientId}_${filters.start || ""}_${
            filters.end || ""
          }.pdf`
        );
        downloadBlob(res.data, filename);
        setReconciliationData(null);
        return;
      }

      if (ct.includes("application/json") || ct.includes("text/json")) {
        const text = await res.data.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error("Неверный формат ответа при загрузке акта сверки");
        }

        if (json.url) {
          const pdfResp = await fetch(json.url);
          const pdfBlob = await pdfResp.blob();
          downloadBlob(
            pdfBlob,
            `reconciliation_${clientId}_${filters.start || ""}_${
              filters.end || ""
            }.pdf`
          );
          setReconciliationData(json);
          return;
        }

        if (json.pdf_base64) {
          const byteChars = atob(json.pdf_base64);
          const byteNums = new Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteNums[i] = byteChars.charCodeAt(i);
          }
          const pdfBlob = new Blob([new Uint8Array(byteNums)], {
            type: "application/pdf",
          });
          downloadBlob(
            pdfBlob,
            `reconciliation_${clientId}_${filters.start || ""}_${
              filters.end || ""
            }.pdf`
          );
          setReconciliationData(json);
          return;
        }

        setReconciliationData(json);
        return;
      }

      const fallbackBlob = new Blob([res.data], { type: "application/pdf" });
      downloadBlob(
        fallbackBlob,
        `reconciliation_${clientId}_${filters.start || ""}_${
          filters.end || ""
        }.pdf`
      );
      setReconciliationData(null);
    } catch (e) {
      console.error(e);
      setReconciliationErr(msgFromError(e, "Не удалось загрузить акт сверки"));
    } finally {
      setReconciliationLoading(false);
    }
  };

  const isDebtSelected = ruStatusToKind(dealStatus) === "debt";

  const canSaveDeal =
    String(dealName).trim().length >= 1 &&
    Number(toDecimalString(dealBudget)) >= 0 &&
    !!client?.id &&
    (!isDebtSelected || Number(dealDebtMonths) >= 1);

  const handleDealSave = async () => {
    if (!client?.id) return;
    if (!canSaveDeal) {
      setAlert({
        open: true,
        type: "error",
        message: isDebtSelected
          ? "Заполните название, сумму и срок долга"
          : "Заполните название и корректную сумму",
      });
      return;
    }
    try {
      if (editingDeal) {
        const updated = await updateDealApi(editingDeal.id, {
          clientId: client.id,
          title: dealName,
          statusRu: dealStatus,
          amount: dealBudget,
          debt_months: dealDebtMonths,
          first_due_date: dealFirstDueDate,
        });
        setDeals((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d))
        );
        closeDealForm();
        return;
      }
      const created = await createDealApi(client.id, {
        title: dealName,
        statusRu: dealStatus,
        amount: dealBudget,
        debt_months: dealDebtMonths,
        first_due_date: dealFirstDueDate,
      });
      setDeals((prev) => [created, ...prev]);
      closeDealForm();
    } catch (e) {
      console.error(e);
      setAlert({
        open: true,
        type: "error",
        message: msgFromError(e, "Не удалось сохранить сделку"),
      });
    }
  };

  /* ===== API: Client (без статуса и без type) ===== */
  const updateClientApi = async (
    clientId,
    { full_name, phone, email, date }
  ) => {
    const payload = {
      full_name: String(full_name || "").trim(),
      phone: String(phone || "").trim(),
      ...(email ? { email: String(email).trim() } : {}),
      ...(date ? { date: toIsoDate10(date) } : {}),
    };
    const res = await api.put(`/main/clients/${clientId}/`, payload);
    return res?.data || payload;
  };

  const deleteClientApi = async (clientId) => {
    await api.delete(`/main/clients/${clientId}/`);
  };

  const requiredOk =
    String(editFio).trim().length > 0 && String(editPhone).trim().length > 0;

  const handleClientSave = async () => {
    if (!client?.id) return;
    if (!requiredOk) {
      setSaveClientErr("Заполните обязательные поля");
      return;
    }
    try {
      setSavingClient(true);
      setSaveClientErr("");
      const updated = await updateClientApi(client.id, {
        full_name: editFio,
        phone: editPhone,
        email: editEmail,
        date: editDate,
      });
      persistClient({
        ...updated,
        fio: updated.full_name || editFio,
        full_name: updated.full_name || editFio,
        phone: updated.phone || editPhone,
        email: updated.email ?? editEmail,
        date: toIsoDate10(updated.date || editDate),
      });
      closeClientForm();
    } catch (e) {
      console.error(e);
      setSaveClientErr(msgFromError(e, "Не удалось сохранить клиента"));
    } finally {
      setSavingClient(false);
    }
  };

  const handleClientDelete = async () => {
    if (!client?.id) return;
    setConfirmDialog({
      open: true,
      message: "Удалить клиента? Действие необратимо.",
      onConfirm: async () => {
        try {
          await deleteClientApi(client.id);
          setClients((prev) =>
            Array.isArray(prev) ? prev.filter((c) => c.id !== client.id) : prev
          );
          navigate("/crm/clients", { replace: true });
          setConfirmDialog({ open: false, message: "", onConfirm: null });
        } catch (e) {
          console.error(e);
          setSaveClientErr(msgFromError(e, "Не удалось удалить клиента"));
          setConfirmDialog({ open: false, message: "", onConfirm: null });
        }
      },
    });
  };

  const handleDealDelete = async () => {
    if (!editingDeal) return;
    try {
      await deleteDealApi(editingDeal.id, client.id);
      setDeals((prev) => prev.filter((d) => d.id !== editingDeal.id));
      closeDealForm();
    } catch (e) {
      console.error(e);
      setAlert({
        open: true,
        type: "error",
        message: msgFromError(e, "Не удалось удалить сделку"),
      });
    }
  };

  const closeDealForm = () => {
    setDealName("");
    setDealBudget("");
    setDealStatus("Продажа");
    setDealDebtMonths("");
    setDealFirstDueDate("");
    setEditingDeal(null);
    setIsDealFormOpen(false);
  };

  const closeClientForm = () => setIsClientFormOpen(false);

  const totals = useMemo(() => {
    const agg = { debt: 0, prepayment: 0, sale: 0 };
    for (const d of deals) {
      const kind = d.kind || "sale";
      if (kind === "debt") {
        agg.debt += Number(d.remaining_debt || 0);
        agg.prepayment += Number(d.prepayment || 0);
      } else if (kind === "prepayment") {
        agg.prepayment += Number(d.amount || 0);
      } else {
        agg.sale += Number(d.amount || 0);
      }
    }
    return { ...agg, amount: agg.sale };
  }, [deals]);

  const dataTransmission = (id) => {
    setSelectedRowId(id);
    setShowDebtModal(true);
  };
  const sectorName = company?.sector?.name;

  const kindTranslate = {
    new: "Новый",
  };

  const clientName = client?.fio || client?.full_name || "—";

  // ====== датка сделки для фильтра ======
  const getDealDateISO = (deal) => {
    const raw = deal?.date || deal?.created_at || deal?.updated_at || null;
    if (!raw) return null;

    try {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      }
    } catch {}
    const m = String(raw).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  };

  const inRange = (iso, fromISO, toISO) => {
    if (!iso) return false;
    if (fromISO && iso < fromISO) return false;
    if (toISO && iso > toISO) return false;
    return true;
  };

  const filteredDeals = useMemo(() => {
    if (!dateFrom && !dateTo) return deals;
    return deals.filter((d) => inRange(getDealDateISO(d), dateFrom, dateTo));
  }, [deals, dateFrom, dateTo]);

  const applyPreset = (preset) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const today = `${y}-${m}-${d}`;

    if (preset === "today") {
      setDateFrom(today);
      setDateTo(today);
      return;
    }
    if (preset === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      const y1 = start.getFullYear();
      const m1 = String(start.getMonth() + 1).padStart(2, "0");
      const d1 = String(start.getDate()).padStart(2, "0");
      setDateFrom(`${y1}-${m1}-${d1}`);
      setDateTo(today);
      return;
    }
    if (preset === "month") {
      const start = new Date(now);
      start.setMonth(now.getMonth() - 1);
      const y1 = start.getFullYear();
      const m1 = String(start.getMonth() + 1).padStart(2, "0");
      const d1 = String(start.getDate()).padStart(2, "0");
      setDateFrom(`${y1}-${m1}-${d1}`);
      setDateTo(today);
      return;
    }
    if (preset === "clear") {
      setDateFrom("");
      setDateTo("");
      return;
    }
  };
  console.log(company);

  return (
    <div className="client-details">
      <div className="details-top">
        <button
          onClick={() =>
            navigate(
              company.sector.name === "Консалтинг"
                ? "/crm/consulting/client"
                : "/crm/clients"
            )
          }
          className="btn btn--ghost"
        >
          ← Назад
        </button>
        <div>
          <button className="primary" onClick={() => openDealForm()}>
            Быстрое добавление сделки
          </button>
          <button
            className="btn btn--secondary"
            onClick={() => setShowReconciliation(true)}
            style={{ marginLeft: 10 }}
          >
            Акт сверки
          </button>
        </div>
      </div>

      <div className="panel">
        <h2 className="title">{clientName}</h2>
        {clientErr && (
          <div className="alert alert--error" style={{ marginTop: 8 }}>
            {clientErr}
          </div>
        )}
        <div className="divider"></div>

        <div className="content-wrapper">
          <div className="rows">
            <div className="row">
              <div className="label">ФИО</div>
              <div className="value">{clientName}</div>
            </div>

            <div className="row">
              <div className="label">Телефон</div>
              <div className="value">
                {client?.phone ? (
                  <a href={`tel:${String(client.phone).replace(/\D/g, "")}`}>
                    {client.phone}
                  </a>
                ) : (
                  "—"
                )}
              </div>
            </div>

            <div className="row">
              <div className="label">Тип</div>
              <div className="value">{typeLabel(client?.type)}</div>
            </div>

            <div className="row">
              <div className="label">Статус</div>
              <div className="value">
                {kindTranslate[client?.status] || client?.status}
              </div>
              <button className="btn edit-btn" onClick={openClientForm}>
                Редактировать
              </button>
            </div>
          </div>

          <div className="debts-wrapper">
            <div className="debts debts--red">
              <div className="debts-title">
                {sectorName === "Строительная компания"
                  ? "Сумма договора"
                  : "Долг"}
              </div>
              <div className="debts-amount">
                {sectorName === "Строительная компания"
                  ? (totals.sale ?? 0).toFixed(2)
                  : (totals.debt ?? 0).toFixed(2)}{" "}
                сом
              </div>
            </div>

            <div className="debts debts--green">
              <div className="debts-title">
                {sectorName === "Строительная компания"
                  ? "Предоплата"
                  : "Аванс"}
              </div>
              <div className="debts-amount">
                {(totals.prepayment ?? 0).toFixed(2)} сом
              </div>
            </div>

            <div className="debts debts--orange">
              <div className="debts-title">
                {sectorName === "Строительная компания"
                  ? "Остаток долга"
                  : "Продажа"}
              </div>
              <div className="debts-amount">
                {sectorName === "Строительная компания"
                  ? (totals.debt ?? 0).toFixed(2)
                  : (totals.sale ?? 0).toFixed(2)}{" "}
                сом
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Панель фильтра дат по сделкам */}
      <div className="filters panel" style={{ marginTop: 12 }}>
        <div className="rows">
          <div className="row">
            <div className="label">Дата с</div>
            <div className="value">
              <input
                className="analytics-sales__input"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
          </div>
          <div className="row">
            <div className="label">Дата по</div>
            <div className="value">
              <input
                className="analytics-sales__input"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          <div className="row">
            <div className="label">Быстрый выбор</div>
            <div
              className="value"
              style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
            >
              <button
                className="btn btn--ghost"
                onClick={() => applyPreset("today")}
              >
                Сегодня
              </button>
              <button
                className="btn btn--ghost"
                onClick={() => applyPreset("week")}
              >
                Неделя
              </button>
              <button
                className="btn btn--ghost"
                onClick={() => applyPreset("month")}
              >
                Месяц
              </button>
              <button className="btn" onClick={() => applyPreset("clear")}>
                Очистить
              </button>
            </div>
          </div>
        </div>
        <div className="muted">
          Показано: <b>{filteredDeals.length}</b> из {deals.length}
        </div>
      </div>

      <div className="deals-list">
        <h3>Сделки</h3>
        {dealsLoading && (
          <div className="muted" style={{ padding: "8px 0" }}>
            Загрузка…
          </div>
        )}
        {dealsErr && (
          <div className="alert alert--error" style={{ marginBottom: 8 }}>
            {dealsErr}
          </div>
        )}
        {!dealsLoading && filteredDeals.length === 0 && (
          <div className="muted">Сделок нет</div>
        )}

        {filteredDeals.map((deal) => (
          <div
            key={deal.id}
            onClick={() => {
              deal.kind === "debt" && dataTransmission(deal.id);
            }}
            className="deal-item"
          >
            <span className="deal-name">{deal.title}</span>
            <span className="deal-budget">
              {Number(deal.amount || 0).toFixed(2)}
            </span>
            <span className="deal-status">
              {deal.kind === "debt" && Number(deal.prepayment || 0) !== 0
                ? "Предоплата"
                : kindLabel(deal.kind)}
            </span>
            <span className="deal-tasks">Нет задач</span>
            <div onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => openDealForm(deal)}
                className="btn edit-btn"
              >
                Редактировать
              </button>
            </div>
          </div>
        ))}
      </div>

      {showDebtModal && (
        <DebtModal
          id={selectedRowId}
          onClose={() => setShowDebtModal(false)}
          onChanged={() => loadDeals(client.id)}
        />
      )}

      {/* Модалка: Редактировать клиента */}
      {isClientFormOpen && (
        <div className="modal-overlay">
          <div className="modal" role="dialog" aria-modal="true">
            <h3>Редактировать клиента</h3>

            {saveClientErr && (
              <div className="alert alert--error">Ошибка</div>
            )}

            <label className="field">
              <span>
                ФИО <b className="req">*</b>
              </span>
              <input
                type="text"
                value={editFio}
                onChange={(e) => setEditFio(e.target.value)}
                placeholder="Иванов Иван"
                autoFocus
                required
              />
            </label>

            <label className="field">
              <span>
                Телефон <b className="req">*</b>
              </span>
              <input
                type="text"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+996 700 00-00-00"
                required
              />
            </label>

            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="user@mail.com"
              />
            </label>

            <label className="field">
              <span>Дата</span>
              <input
                type="date"
                value={editDate || ""}
                onChange={(e) => setEditDate(e.target.value)}
              />
              <div className="hint">
                Например: <b>21.08.2025</b> (сохранится как 2025-08-21)
              </div>
            </label>

            <div
              className="modal-actions"
              style={{ justifyContent: "space-between" }}
            >
              <button className="btn btn--red" onClick={handleClientDelete}>
                Удалить
              </button>
              <div>
                <button
                  className="btn btn--yellow"
                  onClick={handleClientSave}
                  disabled={!requiredOk || savingClient}
                  title={!requiredOk ? "Заполните обязательные поля" : ""}
                >
                  {savingClient ? "Сохранение…" : "Сохранить"}
                </button>
                <button
                  className="btn btn--ghost"
                  onClick={() => setIsClientFormOpen(false)}
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модалка: Сделка */}
      {isDealFormOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editingDeal ? "Редактировать сделку" : "Новая сделка"}</h3>

            <label className="field">
              <span>
                Название сделки <b className="req">*</b>
              </span>
              <input
                type="text"
                value={dealName}
                onChange={(e) => setDealName(e.target.value)}
                placeholder="Например: Продажа напитков"
              />
            </label>

            <label className="field">
              <span>
                Сумма <b className="req">*</b>
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={dealBudget}
                onChange={(e) => setDealBudget(e.target.value)}
                onBlur={() => setDealBudget(toDecimalString(dealBudget))}
                placeholder="0.00"
              />
            </label>

            <label className="field">
              <span>
                Статус <b className="req">*</b>
              </span>
              <select
                value={dealStatus}
                onChange={(e) => setDealStatus(e.target.value)}
              >
                <option>Продажа</option>
                <option>Долг</option>
                <option>Аванс</option>
                <option>Предоплата</option>
              </select>
            </label>

            {isDebtSelected && (
              <>
                <label className="field">
                  <span>
                    Срок долга (мес.) <b className="req">*</b>
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="1"
                    value={dealDebtMonths}
                    onChange={(e) => setDealDebtMonths(e.target.value)}
                    onBlur={() => {
                      const n = parseInt(dealDebtMonths || "0", 10);
                      setDealDebtMonths(
                        Number.isFinite(n) && n > 0 ? String(n) : ""
                      );
                    }}
                    placeholder="Например: 6"
                  />
                </label>
                <label className="field">
                  <span>Дата первого платежа</span>
                  <input
                    type="date"
                    value={dealFirstDueDate}
                    onChange={(e) => setDealFirstDueDate(e.target.value)}
                    placeholder="Выберите дату"
                  />
                  <div className="hint">
                    График платежей будет формироваться с этой даты (того же
                    числа каждого месяца)
                  </div>
                </label>
              </>
            )}

            <div className="modal-actions" style={{ flexWrap: "wrap" }}>
              <button
                className="btn btn--yellow"
                onClick={handleDealSave}
                disabled={!canSaveDeal}
                title={
                  !canSaveDeal
                    ? isDebtSelected
                      ? "Заполните название, сумму и срок долга"
                      : "Заполните название и сумму"
                    : ""
                }
              >
                {editingDeal ? "Сохранить" : "Добавить"}
              </button>
              {editingDeal && (
                <button className="btn btn--red" onClick={handleDealDelete}>
                  Удалить
                </button>
              )}
              <button className="btn btn--ghost" onClick={closeDealForm}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка: Акт сверки */}
      {showReconciliation && (
        <div className="modal-overlay">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            style={{ maxWidth: "90vw", maxHeight: "90vh", overflow: "auto" }}
          >
            <h3>Акт сверки с клиентом</h3>

            <div className="filters panel" style={{ marginBottom: 20 }}>
              <div className="rows">
                <div className="row">
                  <div className="label">Дата с</div>
                  <div className="value">
                    <input
                      className="analytics-sales__input"
                      type="date"
                      value={reconciliationFilters.start}
                      onChange={(e) =>
                        setReconciliationFilters((prev) => ({
                          ...prev,
                          start: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="row">
                  <div className="label">Дата по</div>
                  <div className="value">
                    <input
                      className="analytics-sales__input"
                      type="date"
                      value={reconciliationFilters.end}
                      onChange={(e) =>
                        setReconciliationFilters((prev) => ({
                          ...prev,
                          end: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="row">
                  <div className="label">Действия</div>
                  <div className="value">
                    <button
                      className="btn btn--primary"
                      onClick={() =>
                        fetchReconciliation(client.id, reconciliationFilters)
                      }
                      disabled={reconciliationLoading}
                    >
                      {reconciliationLoading ? "Загрузка..." : "Загрузить акт"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {reconciliationErr && (
              <div className="alert alert--error" style={{ marginBottom: 16 }}>
                {reconciliationErr}
              </div>
            )}

            <div className="modal-actions">
              <button
                className="btn btn--ghost"
                onClick={() => setShowReconciliation(false)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

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
  );
}
