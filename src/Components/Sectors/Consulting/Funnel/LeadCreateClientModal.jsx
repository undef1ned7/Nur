import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { createClientFromLead } from "../../../../store/creators/funnelThunk";

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

export default function LeadCreateClientModal({
  lead,
  onClose,
  onSuccess,
  onSkip,
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: lead?.full_name || lead?.title || "",
    phone: lead?.phone || "",
    email: lead?.email || "",
    service: lead?.service || "",
    note: lead?.description || "",
  });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const full_name = form.full_name.trim();
    if (full_name.length < 2) {
      setErr("Введите имя клиента (минимум 2 символа).");
      return;
    }
    setErr("");
    setSaving(true);
    try {
      const client = await dispatch(
        createClientFromLead({
          leadId: lead.id,
          full_name,
          phone: form.phone.trim(),
          email: form.email.trim(),
          service: form.service || undefined,
          note: form.note.trim(),
        }),
      ).unwrap();
      onSuccess?.(client);
      onClose?.();
      if (client?.id) {
        navigate(`/crm/consulting/client/${client.id}`);
      }
    } catch (e2) {
      setErr(errToText(e2, "Не удалось создать клиента."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="funnel__overlay" onClick={onSkip || onClose}>
      <div
        className="funnel__modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="lead-client-title"
      >
        <div className="funnel__modalHead">
          <div className="funnel__modalTitle" id="lead-client-title">Создать клиента из лида</div>
          <button
            type="button"
            className="funnel__iconBtn"
            onClick={onSkip || onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <form className="funnel__form" onSubmit={submit}>
          <p className="funnel__hint">
            Лид «{lead?.title || "—"}» успешно создан. Можно сразу завести клиента —
            данные подставлены из карточки.
          </p>
          {!!err && <div className="funnel__error">{err}</div>}
          <div className="funnel__field">
            <label className="funnel__label">Имя *</label>
            <input
              className="funnel__input"
              value={form.full_name}
              onChange={set("full_name")}
              autoFocus
            />
          </div>
          <div className="funnel__grid2">
            <div className="funnel__field">
              <label className="funnel__label">Телефон</label>
              <input
                className="funnel__input"
                value={form.phone}
                onChange={set("phone")}
              />
            </div>
            <div className="funnel__field">
              <label className="funnel__label">Email</label>
              <input
                className="funnel__input"
                type="email"
                value={form.email}
                onChange={set("email")}
              />
            </div>
          </div>
          <div className="funnel__field">
            <label className="funnel__label">Примечание</label>
            <textarea
              className="funnel__input"
              rows={2}
              value={form.note}
              onChange={set("note")}
            />
          </div>
          <div className="funnel__formActions">
            <button
              type="button"
              className="funnel__btn"
              onClick={onSkip || onClose}
              disabled={saving}
            >
              Позже
            </button>
            <button
              type="submit"
              className="funnel__btn funnel__btn--primary"
              disabled={saving}
            >
              {saving ? "…" : "Создать клиента"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
