import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert } from "@/hooks/useDialog";
import { useBuildingTreatyInstallments } from "@/store/slices/building/treatyInstallmentsSlice";
import { fetchBuildingInstallmentPayments } from "@/store/creators/building/treatyInstallmentsCreators";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import InstallmentPaymentCreateModal from "./InstallmentPaymentCreateModal";

const STATUS_LABELS = {
  planned: "Запланирован",
  paid: "Оплачен",
};

export default function InstallmentPaymentsModal({
  open,
  onClose,
  installment,
  treaty,
}) {
  const dispatch = useDispatch();
  const alert = useAlert();
  const installmentsState = useBuildingTreatyInstallments();
  const [createOpen, setCreateOpen] = useState(false);

  const installmentId = installment?.id ?? installment?.uuid ?? null;
  const installmentKey = installmentId != null ? String(installmentId) : "";

  const paymentsBucket =
    installmentsState.paymentsByInstallmentId?.[installmentKey] || [];
  const loading =
    installmentsState.loadingByInstallmentId?.[installmentKey] || false;
  const error = installmentsState.errorByInstallmentId?.[installmentKey] || null;

  const totalAmount = useMemo(
    () => Number(installment?.amount || 0),
    [installment?.amount],
  );
  const paidAmount = useMemo(
    () => Number(installment?.paid_amount || 0),
    [installment?.paid_amount],
  );
  const remaining = useMemo(() => {
    const remain = totalAmount - paidAmount;
    return Number.isFinite(remain) ? Math.max(0, remain) : 0;
  }, [totalAmount, paidAmount]);

  const statusKey =
    installment?.status ||
    (remaining <= 0 && totalAmount > 0 ? "paid" : "planned");
  const statusLabel = STATUS_LABELS[statusKey] || installment?.status || "—";

  useEffect(() => {
    if (!open || !installmentId) return;
    dispatch(fetchBuildingInstallmentPayments(installmentId)).catch((err) => {
      const msg = validateResErrors(
        err,
        "Не удалось загрузить платежи по взносу",
      );
      alert(msg, true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, installmentId, dispatch]);

  const effectiveError = useMemo(() => {
    if (!error) return null;
    return validateResErrors(
      error,
      "Не удалось загрузить платежи по взносу",
    );
  }, [error]);

  const handleClose = () => {
    setCreateOpen(false);
    onClose?.();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title="Платежи по взносу рассрочки"
      >
        {!installment ? (
          <div className="building-page__muted">
            Данные по взносу недоступны.
          </div>
        ) : (
          <div className="building-page">
            <div className="building-page__muted" style={{ marginBottom: 8 }}>
              Взнос №{installment.order ?? "—"} от{" "}
              {installment.due_date || "—"} на сумму{" "}
              <b>{installment.amount ?? "0.00"}</b>. Оплачено{" "}
              <b>{installment.paid_amount ?? "0.00"}</b>, остаток{" "}
              <b>{remaining.toFixed(2)}</b>. Статус:{" "}
              <b>{statusLabel}</b>
              {installment.paid_at && (
                <>
                  {" "}
                  (оплачен {installment.paid_at})
                </>
              )}
            </div>

            {loading ? (
              <div className="building-page__muted">
                Загрузка платежей по взносу...
              </div>
            ) : paymentsBucket.length === 0 ? (
              <div className="building-page__muted">
                Платежи по этому взносу ещё не вносились.
              </div>
            ) : (
              <div className="building-table building-table--shadow">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Дата оплаты</th>
                      <th>Сумма</th>
                      <th>Касса</th>
                      <th>Смена</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentsBucket.map((p, idx) => {
                      const key =
                        p.id ?? p.uuid ?? `${installmentKey}-${idx}`;
                      const paidAt =
                        p.paid_at || p.created_at || p.created || "—";
                      const cashboxName =
                        p.cashbox_display ||
                        p.cashbox_name ||
                        p.cashbox_title ||
                        p.cashbox ||
                        "—";
                      const shiftDisplay =
                        p.shift_display || p.shift || "—";
                      return (
                        <tr key={key}>
                          <td>{idx + 1}</td>
                          <td>{paidAt}</td>
                          <td>{p.amount ?? "0.00"}</td>
                          <td>{cashboxName}</td>
                          <td>{shiftDisplay}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {effectiveError && (
              <div className="building-page__error" style={{ marginTop: 8 }}>
                {String(effectiveError)}
              </div>
            )}

            <div className="building-page__actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="building-btn"
                onClick={handleClose}
              >
                Закрыть
              </button>
              {remaining > 0 && (
                <button
                  type="button"
                  className="building-btn building-btn--primary"
                  onClick={() => setCreateOpen(true)}
                >
                  Новый платёж
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {installment && (
        <InstallmentPaymentCreateModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          installment={installment}
          treaty={treaty}
          onSuccess={() => {
            if (installmentId) {
              dispatch(fetchBuildingInstallmentPayments(installmentId));
            }
          }}
        />
      )}
    </>
  );
}

