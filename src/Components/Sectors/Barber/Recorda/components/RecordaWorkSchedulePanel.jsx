// RecordaWorkSchedulePanel.jsx — график работы календаря
import React, { useEffect, useRef, useState } from "react";
import { FaClock, FaTimes } from "react-icons/fa";
import {
  readWorkScheduleSettings,
  saveWorkScheduleSettings,
} from "./recordaWorkHours";

const RecordaWorkSchedulePanel = ({
  open = false,
  onClose,
  company,
  workBounds,
  canEdit = false,
  onSaved,
}) => {
  const panelRef = useRef(null);
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("21:00");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    const schedule = readWorkScheduleSettings(company);
    setWorkStart(schedule.work_start);
    setWorkEnd(schedule.work_end);
    setMessage("");
  }, [open, company, workBounds?.work_start, workBounds?.work_end]);

  useEffect(() => {
    if (!open) return undefined;

    const onDocClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose?.();
      }
    };

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const { savedToApi, schedule } = await saveWorkScheduleSettings({
        work_start: workStart,
        work_end: workEnd,
      });
      setWorkStart(schedule.work_start);
      setWorkEnd(schedule.work_end);
      setMessage(
        savedToApi
          ? "График сохранён"
          : "Сохранено локально (ожидается поддержка на сервере)",
      );
      onSaved?.({ savedToApi, schedule });
    } catch {
      setMessage("Не удалось сохранить график");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="barberrecorda__workScheduleOverlay" aria-hidden="true" />
      <div
        ref={panelRef}
        className="barberrecorda__workSchedulePanel"
        role="dialog"
        aria-labelledby="barberrecorda-work-schedule-title"
      >
        <div className="barberrecorda__workScheduleHead">
          <div className="barberrecorda__workScheduleTitleWrap">
            <FaClock aria-hidden="true" />
            <div>
              <h3 id="barberrecorda-work-schedule-title">
                График работы
              </h3>
              <p>Диапазон времени в календаре записей</p>
            </div>
          </div>
          <button
            type="button"
            className="barberrecorda__workScheduleClose"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        <div className="barberrecorda__workScheduleCurrent">
          Сейчас: <strong>{workBounds?.work_start}–{workBounds?.work_end}</strong>
        </div>

        {canEdit ? (
          <>
            <div className="barberrecorda__workScheduleRow">
              <label htmlFor="recorda-work-start">Начало</label>
              <input
                id="recorda-work-start"
                type="time"
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
                step={1800}
              />
            </div>
            <div className="barberrecorda__workScheduleRow">
              <label htmlFor="recorda-work-end">Конец</label>
              <input
                id="recorda-work-end"
                type="time"
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
                step={1800}
              />
            </div>

            {message ? (
              <p className="barberrecorda__workScheduleMsg">{message}</p>
            ) : null}

            <button
              type="button"
              className="barberrecorda__workScheduleSave"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </>
        ) : (
          <p className="barberrecorda__workScheduleHint">
            Изменить график может администратор в Настройках → Онлайн.
          </p>
        )}
      </div>
    </>
  );
};

export default RecordaWorkSchedulePanel;
