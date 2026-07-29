/**
 * Окно «Отложить лид».
 *
 * Отложенный лид уходит из рабочей очереди, но не теряется: в срок
 * ответственному приходит персональное напоминание, а лид помечается
 * «пора связаться». Причина обязательна — она питает аналитику потерь.
 */
import { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import {
  DEFER_PRESETS,
  DEFER_REASONS,
  deferInboundLead,
} from "../../../../../api/consultingLeads";

/** Локальное время в формате, который понимает <input type="datetime-local">. */
const toLocalInput = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
};

export default function DeferLeadModal({ lead, onClose, onDeferred, onError }) {
  const [preset, setPreset] = useState("tomorrow");
  const [remindAt, setRemindAt] = useState("");
  const [minRemind, setMinRemind] = useState("");
  const [reason, setReason] = useState(DEFER_REASONS[0].value);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  // Текущее время читаем в эффекте: рендер должен оставаться чистым.
  useEffect(() => {
    const now = Date.now();
    setMinRemind(toLocalInput(new Date(now)));
    setRemindAt(toLocalInput(new Date(now + DEFER_PRESETS[1].ms)));
  }, []);

  const applyPreset = (p) => {
    setPreset(p.value);
    setRemindAt(toLocalInput(new Date(Date.now() + p.ms)));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!remindAt) {
      onError?.("Укажите, когда напомнить о лиде.");
      return;
    }
    const when = new Date(remindAt);
    if (Number.isNaN(when.getTime())) {
      onError?.("Некорректная дата напоминания.");
      return;
    }
    if (reason === "other" && !comment.trim()) {
      onError?.("Для причины «Другое» нужен комментарий.");
      return;
    }

    setSaving(true);
    try {
      await deferInboundLead(lead.id, {
        remind_at: when.toISOString(),
        reason,
        comment: comment.trim(),
      });
      onDeferred?.();
    } catch (e2) {
      onError?.(e2?.detail || "Не удалось отложить лид.");
    } finally {
      setSaving(false);
    }
  };

  const deferCount = Number(lead?.defer_count) || 0;

  return (
    <div className="leads__overlay" onClick={() => !saving && onClose()}>
      <div
        className="leads__modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="defer-lead-title"
      >
        <div className="leads__modalHead">
          <h3 className="leads__modalTitle" id="defer-lead-title">
            Отложить лид
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

        {deferCount >= 3 && (
          <div className="leads__warn">
            Этот лид откладывали уже {deferCount} раз. Возможно, пора закрыть его
            отказом.
          </div>
        )}

        <form className="leads__form" onSubmit={submit}>
          <div className="leads__field">
            <label className="leads__label">Напомнить</label>
            <div className="leads__presets">
              {DEFER_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`leads__chip${preset === p.value ? " is-active" : ""}`}
                  onClick={() => applyPreset(p)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="datetime-local"
              className="cList__input"
              value={remindAt}
              min={minRemind || undefined}
              onChange={(e) => {
                setPreset("custom");
                setRemindAt(e.target.value);
              }}
              required
            />
          </div>

          <div className="leads__field">
            <label className="leads__label">Причина</label>
            <select
              className="cList__input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {DEFER_REASONS.map((r) => (
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
              placeholder="Например: просил перезвонить после отпуска"
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
              {saving ? "Сохранение…" : "Отложить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
