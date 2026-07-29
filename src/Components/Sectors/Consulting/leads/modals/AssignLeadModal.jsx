/**
 * Окно «Назначить лид».
 *
 * Основной путь — POST /assign/. Если спец-эндпоинт ещё не поднят на сервере,
 * откатываемся на обычный PATCH, чтобы менеджер мог работать уже сейчас.
 */
import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import {
  assignInboundLead,
  updateInboundLead,
} from "../../../../../api/consultingLeads";
import { employeeName } from "../Leads";

export default function AssignLeadModal({
  lead,
  employees,
  onClose,
  onAssigned,
  onError,
}) {
  const [owner, setOwner] = useState(lead.owner ? String(lead.owner) : "");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!owner) {
      onError?.("Выберите сотрудника.");
      return;
    }
    setSaving(true);
    try {
      await assignInboundLead(lead.id, { owner });
      onAssigned?.();
    } catch (e2) {
      try {
        await updateInboundLead(lead.id, { owner, status: "assigned" });
        onAssigned?.();
      } catch (e3) {
        onError?.(e3?.detail || e2?.detail || "Не удалось назначить лид.");
      }
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
        aria-labelledby="assign-lead-title"
      >
        <div className="leads__modalHead">
          <h3 className="leads__modalTitle" id="assign-lead-title">
            Назначить лид
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
            <label className="leads__label">Сотрудник</label>
            <select
              className="cList__input"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              autoFocus
            >
              <option value="">Выберите сотрудника</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {employeeName(e)}
                </option>
              ))}
            </select>
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
              {saving ? "…" : "Назначить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
