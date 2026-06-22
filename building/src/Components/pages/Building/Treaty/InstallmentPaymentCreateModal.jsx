import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert } from "@/hooks/useDialog";
import { getBuildingCashboxes } from "@/api/building";
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
  const [cashboxes, setCashboxes] = useState([]);
  const [cashLoading, setCashLoading] = useState(false);
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
    let cancelled = false;
    setCashLoading(true);
    getBuildingCashboxes()
      .then((list) => {
        if (!cancelled) {
          setCashboxes(Array.isArray(list) ? list : []);
          const first = Array.isArray(list) ? list[0] : null;
          const firstId = first?.id ?? first?.uuid ?? "";
          if (firstId) setCashbox(firstId);
        }
      })
      .catch(() => {
        if (!cancelled) setCashboxes([]);
      })
      .finally(() => {
        if (!cancelled) setCashLoading(false);
      });
    return () => { cancelled = true; };
  }, [open]);

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
    if (!cashbox) {
      setLocalError("Выберите кассу");
      return;
    }

    const payload = {
      amount: value.toFixed(2),
      cashbox,
      shift: null, // смены пока не обязательны
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
        const applied = Array.isArray(res.payload?.data?.applied)
          ? res.payload.data.applied
          : [];
        const unusedAmount = Number(res.payload?.data?.unused_amount || 0);
        const carriedToNextInstallments = applied.length > 1;

        let successMessage = "Оплата внесена";
        if (carriedToNextInstallments) {
          successMessage = `Оплата внесена и распределена на ${applied.length} взноса`;
        } else if (unusedAmount > 0) {
          successMessage = `Оплата внесена. Неиспользованный остаток: ${unusedAmount.toFixed(2)}`;
        }

        alert(successMessage);
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
          <div className="building-page__muted" style={{ marginTop: 6 }}>
            Можно указать сумму больше остатка текущего взноса. Переплата
            автоматически перенесётся на следующие взносы.
          </div>
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

