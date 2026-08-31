import { useCallback, useEffect, useState } from "react";
import {
  fetchPlatformAdminMeta,
  patchPlatformCompanySubscription,
  pickPlatformAdminError,
} from "../../../api/platformAdmin";
import "./PlatformAdmin.scss";

const asArray = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

const SubscriptionForm = ({ companyId, company, onUpdated }) => {
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState(
    company?.subscription_plan?.id ?? company?.subscription_plan_id ?? "",
  );
  const [endDate, setEndDate] = useState(company?.end_date || "");
  const [note, setNote] = useState(company?.support_note || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      (async () => {
        try {
          const meta = await fetchPlatformAdminMeta();
          if (!cancelled) {
            setPlans(asArray(meta?.plans ?? meta?.subscription_plans));
          }
        } catch {
          /* ignore */
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const save = useCallback(
    async (e) => {
      e.preventDefault();
      setSaving(true);
      setError("");
      setMessage("");
      try {
        const payload = {
          subscription_plan_id: planId || null,
          end_date: endDate || null,
        };
        if (note.trim()) payload.support_note = note.trim();
        const updated = await patchPlatformCompanySubscription(
          companyId,
          payload,
        );
        setMessage("Подписка сохранена");
        onUpdated?.(updated);
      } catch (err) {
        setError(pickPlatformAdminError(err, "Не удалось сохранить подписку"));
      } finally {
        setSaving(false);
      }
    },
    [companyId, planId, endDate, note, onUpdated],
  );

  return (
    <form className="platform-admin__card" onSubmit={save}>
      <h3 className="platform-admin__card-title">Подписка</h3>
      {error && <div className="platform-admin__alert">{error}</div>}
      {message && (
        <div className="platform-admin__alert platform-admin__alert--ok">
          {message}
        </div>
      )}
      <div className="platform-admin__grid">
        <label className="platform-admin__field">
          <span>Тариф</span>
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            disabled={saving}
          >
            <option value="">— не выбран —</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            {!plans.length && company?.subscription_plan?.id && (
              <option value={company.subscription_plan.id}>
                {company.subscription_plan.name}
              </option>
            )}
          </select>
        </label>
        <label className="platform-admin__field">
          <span>Дата окончания (end_date)</span>
          <input
            type="date"
            value={endDate ? String(endDate).slice(0, 10) : ""}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={saving}
          />
        </label>
        <label className="platform-admin__field platform-admin__field--full">
          <span>Заметка для поддержки</span>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={saving}
            placeholder="Необязательно"
          />
        </label>
      </div>
      <div className="platform-admin__actions">
        <button
          type="submit"
          className="platform-admin__btn platform-admin__btn--primary"
          disabled={saving}
        >
          {saving ? "Сохранение…" : "Сохранить подписку"}
        </button>
      </div>
    </form>
  );
};

const SubscriptionPanel = ({ companyId, company, onUpdated }) => {
  const formKey = [
    companyId,
    company?.subscription_plan?.id ?? company?.subscription_plan_id ?? "",
    company?.end_date || "",
    company?.support_note || "",
  ].join("|");

  return (
    <SubscriptionForm
      key={formKey}
      companyId={companyId}
      company={company}
      onUpdated={onUpdated}
    />
  );
};

export default SubscriptionPanel;
