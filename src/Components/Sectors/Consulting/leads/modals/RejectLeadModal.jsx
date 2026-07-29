/**
 * Окно «Отказ по лиду».
 *
 * Причина обязательна: без неё блок «на чём теряем клиентов» в аналитике
 * останется пустым, а отказ превратится в бесполезную отметку.
 */
import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import {
  REJECT_REASONS,
  markInboundLeadLost,
} from "../../../../../api/consultingLeads";

export default function RejectLeadModal({ lead, onClose, onRejected, onError }) {
  const [reason, setReason] = useState(REJECT_REASONS[0].value);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (reason === "other" && !comment.trim()) {
      onError?.("Для причины «Другое» нужен комментарий.");
      return;
    }
    setSaving(true);
    try {
      await markInboundLeadLost(lead.id, {
        reason,
        comment: comment.trim(),
      });
      onRejected?.();
    } catch (e2) {
      onError?.(e2?.detail || "Не удалось оформить отказ.");
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
        aria-labelledby="reject-lead-title"
      >
        <div className="leads__modalHead">
          <h3 className="leads__modalTitle" id="reject-lead-title">
            Отказ по лиду
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
            <label className="leads__label">Причина отказа</label>
            <select
              className="cList__input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            >
              {REJECT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="leads__field">
            <label className="leads__label">
              Комментарий{reason === "other" ? "" : " (необязательно)"}
            </label>
            <textarea
              className="cList__input"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
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
              className="leads__btn leads__btn--danger"
              disabled={saving}
            >
              {saving ? "Сохранение…" : "Оформить отказ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
