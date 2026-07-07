import React, { useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { registerLeadPayment } from "../../../../store/creators/funnelThunk";

const PAYMENT_MODES = [
  { value: "cash", label: "Наличными" },
  { value: "transfer", label: "Переводом" },
  { value: "debt", label: "В долг" },
  { value: "installment", label: "Рассрочка" },
];

function errToText(e, fallback) {
  if (typeof e === "string") return e;
  const d = e?.detail || e?.message;
  if (typeof d === "string") return d;
  if (typeof e === "object" && e) {
    const k = Object.keys(e)[0];
    const v = Array.isArray(e[k]) ? e[k][0] : e[k];
    if (v) return String(v);
  }
  return fallback;
}

export default function LeadPaymentModal({ lead, onClose, onSuccess }) {
  const dispatch = useDispatch();
  const defaultAmount = useMemo(() => {
    const v = Number(lead?.estimated_value);
    return Number.isFinite(v) && v > 0 ? String(v) : "";
  }, [lead?.estimated_value]);

  const [form, setForm] = useState({
    payment_mode: "cash",
    amount: defaultAmount,
    debt_months: "",
    prepayment: "",
    note: "",
  });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const needsSchedule =
    form.payment_mode === "debt" || form.payment_mode === "installment";

  const submit = async (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErr("Укажите сумму больше нуля.");
      return;
    }
    if (needsSchedule && !form.debt_months) {
      setErr("Укажите срок (месяцев).");
      return;
    }
    setErr("");
    setSaving(true);
    try {
      const result = await dispatch(
        registerLeadPayment({
          leadId: lead.id,
          payment_mode: form.payment_mode,
          amount,
          debt_months: needsSchedule ? Number(form.debt_months) : undefined,
          prepayment:
            form.payment_mode === "installment" && form.prepayment !== ""
              ? Number(form.prepayment)
              : undefined,
          note: form.note.trim(),
        }),
      ).unwrap();
      onSuccess?.(result);
      onClose?.();
    } catch (e2) {
      setErr(errToText(e2, "Не удалось оформить оплату."));
    } finally {
      setSaving(false);
    }
  };

  const clientId = lead?.client || lead?.client_id;

  return (
    <div className="funnel__overlay" onClick={onClose}>
      <div
        className="funnel__modal funnel__modal--wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="lead-pay-title"
      >
        <div className="funnel__modalHead">
          <div className="funnel__modalTitle" id="lead-pay-title">Оформить оплату по лиду</div>
          <button
            type="button"
            className="funnel__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <form className="funnel__form" onSubmit={submit}>
          {!clientId && (
            <div className="funnel__error">
              Сначала создайте клиента из лида — оплата привязывается к карточке
              клиента и попадёт в аналитику.
            </div>
          )}
          {!!err && <div className="funnel__error">{err}</div>}
          <div className="funnel__grid2">
            <div className="funnel__field">
              <label className="funnel__label">Способ оплаты *</label>
              <select
                className="funnel__input"
                value={form.payment_mode}
                onChange={set("payment_mode")}
                disabled={!clientId || saving}
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="funnel__field">
              <label className="funnel__label">Сумма, с *</label>
              <input
                className="funnel__input"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={set("amount")}
                disabled={!clientId || saving}
              />
            </div>
          </div>
          {needsSchedule && (
            <div className="funnel__grid2">
              <div className="funnel__field">
                <label className="funnel__label">Срок, мес.</label>
                <input
                  className="funnel__input"
                  type="number"
                  min="1"
                  step="1"
                  value={form.debt_months}
                  onChange={set("debt_months")}
                  placeholder="6"
                  disabled={!clientId || saving}
                />
              </div>
              {form.payment_mode === "installment" && (
                <div className="funnel__field">
                  <label className="funnel__label">Первый платёж, с</label>
                  <input
                    className="funnel__input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.prepayment}
                    onChange={set("prepayment")}
                    disabled={!clientId || saving}
                  />
                </div>
              )}
            </div>
          )}
          <div className="funnel__field">
            <label className="funnel__label">Комментарий</label>
            <input
              className="funnel__input"
              value={form.note}
              onChange={set("note")}
              disabled={!clientId || saving}
            />
          </div>
          <div className="funnel__formActions">
            <button
              type="button"
              className="funnel__btn"
              onClick={onClose}
              disabled={saving}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="funnel__btn funnel__btn--primary"
              disabled={!clientId || saving}
            >
              {saving ? "…" : "Оформить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
