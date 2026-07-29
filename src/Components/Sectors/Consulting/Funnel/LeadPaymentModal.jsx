import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { registerLeadPayment } from "../../../../store/creators/funnelThunk";
import api from "../../../../api";
import { toISODate } from "../common/listUtils";

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

  /* ---------------- абонентская плата (ТЗ №5) ---------------- */
  // Тариф лида может нести абонплату. Раньше она нигде не подтверждалась и
  // после продажи не появлялась у клиента — теперь менеджер видит и
  // подтверждает сумму, период и дату старта списаний.
  const [services, setServices] = useState([]);
  const [subEnabled, setSubEnabled] = useState(true);
  const [subStart, setSubStart] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setSubStart(toISODate(new Date()));
    if (!lead?.service) return () => controller.abort();
    api
      .get("/consalting/services/", { signal: controller.signal })
      .then((res) => {
        const data = res?.data;
        setServices(Array.isArray(data?.results) ? data.results : data || []);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [lead?.service]);

  const subscription = useMemo(() => {
    // Сервер может прислать абонплату прямо в лиде — тогда справочник не нужен.
    const direct = Number(lead?.subscription_amount);
    if (Number.isFinite(direct) && direct > 0) {
      return {
        amount: direct,
        period: lead?.subscription_period === "year" ? "year" : "month",
        source: lead?.tariff_display || lead?.service_display || "",
      };
    }
    const service = services.find(
      (s) => String(s.id) === String(lead?.service),
    );
    const tariff = (service?.tariffs || []).find(
      (t) => String(t.id) === String(lead?.tariff),
    );
    const amount = Number(tariff?.subscription_amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return {
      amount,
      period: tariff?.subscription_period === "year" ? "year" : "month",
      source: [service?.name, tariff?.name].filter(Boolean).join(" · "),
    };
  }, [services, lead]);

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
          ...(subscription
            ? {
                subscription_enabled: subEnabled,
                subscription_amount: subEnabled ? subscription.amount : 0,
                subscription_period: subscription.period,
                subscription_start: subEnabled ? subStart : undefined,
              }
            : {}),
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
          {subscription && (
            <div className="funnel__subBlock">
              <label className="funnel__subToggle">
                <input
                  type="checkbox"
                  checked={subEnabled}
                  onChange={(e) => setSubEnabled(e.target.checked)}
                  disabled={!clientId || saving}
                />
                <span>
                  <b>Подключить абонентскую плату</b>
                  <small>
                    {subscription.source
                      ? `${subscription.source}: `
                      : ""}
                    {subscription.amount.toLocaleString("ru-RU")} с /{" "}
                    {subscription.period === "year" ? "год" : "мес."}
                  </small>
                </span>
              </label>
              {subEnabled && (
                <div className="funnel__field">
                  <label className="funnel__label">Дата первого списания</label>
                  <input
                    className="funnel__input"
                    type="date"
                    value={subStart}
                    onChange={(e) => setSubStart(e.target.value)}
                    disabled={!clientId || saving}
                  />
                  <small className="funnel__hint">
                    График платежей появится в карточке клиента и в абонентской
                    матрице сразу после оформления.
                  </small>
                </div>
              )}
            </div>
          )}

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
