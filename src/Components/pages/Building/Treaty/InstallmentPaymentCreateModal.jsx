import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert } from "@/hooks/useDialog";
import { useCash, getCashBoxes } from "@/store/slices/cashSlice";
import { useBuildingTreatyInstallments } from "@/store/slices/building/treatyInstallmentsSlice";
import { createBuildingInstallmentPayment } from "@/store/creators/building/treatyInstallmentsCreators";
import { validateResErrors } from "../../../../../tools/validateResErrors";

export default function InstallmentPaymentCreateModal({
  open,
  onClose,
  installment,
  treaty,
  onSuccess,
}) {
  const dispatch = useDispatch();
  const alert = useAlert();
  const { list: cashboxes, loading: cashLoading } = useCash();
  const installmentsState = useBuildingTreatyInstallments();

  const installmentId = installment?.id ?? installment?.uuid ?? null;
  const treatyId = treaty?.id ?? treaty?.uuid ?? null;
  const installmentKey = installmentId != null ? String(installmentId) : "";

  const creating =
    installmentsState.creatingByInstallmentId?.[installmentKey] || false;
  const createError =
    installmentsState.createErrorByInstallmentId?.[installmentKey] || null;

  const [amount, setAmount] = useState("");
  const [cashbox, setCashbox] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [localError, setLocalError] = useState(null);

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

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    setAmount("");
    setPaidAt("");
    if (!cashboxes || cashboxes.length === 0) {
      dispatch(getCashBoxes());
    } else if (!cashbox) {
      const first = cashboxes[0];
      const firstId = first?.id ?? first?.uuid ?? "";
      if (firstId) setCashbox(firstId);
    }
  }, [open, cashboxes, cashbox, dispatch]);

  useEffect(() => {
    if (!open || cashbox) return;
    if (cashboxes && cashboxes.length > 0) {
      const first = cashboxes[0];
      const firstId = first?.id ?? first?.uuid ?? "";
      if (firstId) setCashbox(firstId);
    }
  }, [open, cashboxes, cashbox]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!installmentId || !treatyId) {
      setLocalError("Данные взноса или договора недоступны");
      return;
    }

    const value = Number(amount || 0);
    if (!Number.isFinite(value) || value <= 0) {
      setLocalError("Сумма должна быть больше 0");
      return;
    }
    if (remaining > 0 && value > remaining + 1e-6) {
      setLocalError(
        `Сумма не может превышать остаток ${remaining.toFixed(2)}`,
      );
      return;
    }
    if (!cashbox) {
      setLocalError("Выберите кассу");
      return;
    }

    const payload = {
      amount: value.toFixed(2),
      cashbox,
    };
    if (paidAt && String(paidAt).trim() !== "") {
      const base = String(paidAt).trim(); // YYYY-MM-DDTHH:MM
      payload.paid_at = `${base}:00+06:00`;
    }

    setLocalError(null);

    try {
      const res = await dispatch(
        createBuildingInstallmentPayment({
          installmentId,
          treatyId,
          payload,
        }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        alert("Оплата внесена");
        onSuccess?.();
        onClose?.();
      } else {
        const msg = validateResErrors(
          res.payload || res.error,
          "Не удалось внести оплату",
        );
        setLocalError(String(msg));
        alert(msg, true);
      }
    } catch (err) {
      const msg = validateResErrors(err, "Не удалось внести оплату");
      setLocalError(String(msg));
      alert(msg, true);
    }
  };

  const effectiveError = localError || createError || null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новый платёж по рассрочке"
    >
      <form className="building-page" onSubmit={handleSubmit}>
        <div className="building-page__muted" style={{ marginBottom: 8 }}>
          Взнос №{installment?.order ?? "—"} на сумму{" "}
          <b>{installment?.amount ?? "0.00"}</b>, оплачено{" "}
          <b>{installment?.paid_amount ?? "0.00"}</b>, остаток{" "}
          <b>{remaining.toFixed(2)}</b>
        </div>

        <label>
          <div className="building-page__label">Сумма платежа *</div>
          <input
            type="number"
            min="0"
            step="0.01"
            className="building-page__input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={remaining > 0 ? remaining.toFixed(2) : "0.00"}
          />
        </label>

        <label>
          <div className="building-page__label">Касса *</div>
          <select
            className="building-page__select"
            value={cashbox}
            onChange={(e) => setCashbox(e.target.value)}
            disabled={cashLoading && (!cashboxes || cashboxes.length === 0)}
          >
            <option value="">Выберите кассу</option>
            {(cashboxes || []).map((c) => {
              const id = c.id ?? c.uuid ?? "";
              if (!id) return null;
              return (
                <option key={id} value={id}>
                  {c.name || "Касса"}
                </option>
              );
            })}
          </select>
        </label>

        <label>
          <div className="building-page__label">
            Дата и время оплаты (опционально)
          </div>
          <input
            type="datetime-local"
            className="building-page__input"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
          />
        </label>

        {effectiveError && (
          <div className="building-page__error" style={{ marginTop: 8 }}>
            {String(effectiveError)}
          </div>
        )}

        <div className="building-page__actions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="building-btn"
            onClick={onClose}
            disabled={creating}
          >
            Отмена
          </button>
          <button
            type="submit"
            className="building-btn building-btn--primary"
            disabled={creating || remaining <= 0}
          >
            {creating ? "Сохранение..." : "Оплатить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

