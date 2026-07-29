/**
 * Окно «Новый лид» — ручное заведение обращения, пришедшего не из мессенджера
 * (звонок, визит, рекомендация).
 */
import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { createInboundLead } from "../../../../../api/consultingLeads";
import { LEAD_SOURCES } from "../../../../../utils/consultingLeadSources";

export default function CreateLeadModal({ onClose, onCreated, onError }) {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    source: "manual",
    message: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() && !form.phone.trim()) {
      onError?.("Укажите имя или телефон лида.");
      return;
    }
    setSaving(true);
    try {
      await createInboundLead({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        source: form.source,
        message: form.message.trim(),
      });
      onCreated?.();
    } catch (e2) {
      onError?.(e2?.detail || "Не удалось создать лид.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="leads__overlay" onClick={() => !saving && onClose()}>
      <div
        className="leads__modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-lead-title"
      >
        <div className="leads__modalHead">
          <h3 className="leads__modalTitle" id="create-lead-title">
            Новый лид
          </h3>
          <button
            type="button"
            className="leads__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        <form className="leads__form" onSubmit={submit}>
          <div className="leads__field">
            <label className="leads__label">Имя</label>
            <input
              className="cList__input"
              value={form.full_name}
              onChange={set("full_name")}
              autoFocus
            />
          </div>
          <div className="leads__field">
            <label className="leads__label">Телефон</label>
            <input
              className="cList__input"
              value={form.phone}
              onChange={set("phone")}
              placeholder="+996700000000"
              inputMode="tel"
            />
          </div>
          <div className="leads__field">
            <label className="leads__label">Источник</label>
            <select
              className="cList__input"
              value={form.source}
              onChange={set("source")}
            >
              {LEAD_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="leads__field">
            <label className="leads__label">Сообщение / комментарий</label>
            <textarea
              className="cList__input"
              rows={3}
              value={form.message}
              onChange={set("message")}
            />
          </div>

          <div className="leads__formActions">
            <button
              type="button"
              className="leads__btn"
              onClick={onClose}
              disabled={saving}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="leads__btn leads__btn--primary"
              disabled={saving}
            >
              {saving ? "Сохранение…" : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
