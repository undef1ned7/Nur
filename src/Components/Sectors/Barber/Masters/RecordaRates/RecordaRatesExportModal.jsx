// RecordaRatesExportModal.jsx
import React, { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { RRSelect } from "./RecordaRatesSelect";

const pad2 = (n) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const ExportModal = ({ open, onClose, onExport }) => {
  const [mode, setMode] = useState("weeks"); // day | weeks
  const [date, setDate] = useState(todayStr());
  const [weeks, setWeeks] = useState("1");

  useEffect(() => {
    if (!open) return;
    setMode("weeks");
    setDate(todayStr());
    setWeeks("1");
  }, [open]);

  if (!open) return null;

  const modeOptions = [
    { value: "day", label: "День" },
    { value: "weeks", label: "Неск. недель" },
  ];

  return (
    <div className="barberrecordarates__overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="barberrecordarates__modal" onClick={(e) => e.stopPropagation()}>
        <div className="barberrecordarates__modalHead">
          <h4 className="barberrecordarates__modalTitle">Скачать отчёт</h4>
          <button type="button" className="barberrecordarates__iconBtn" aria-label="Закрыть" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="barberrecordarates__exportBody">
          <div className="barberrecordarates__exportGrid">
            <div className="barberrecordarates__exportField">
              <span className="barberrecordarates__filterLabel">Отчёт</span>
              <RRSelect value={mode} onChange={(v) => setMode(String(v))} options={modeOptions} placeholder="Выберите" />
            </div>

            <div className="barberrecordarates__exportField">
              <span className="barberrecordarates__filterLabel">Дата</span>
              <input
                className="barberrecordarates__productInput"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {mode === "weeks" ? (
              <div className="barberrecordarates__exportField">
                <span className="barberrecordarates__filterLabel">Недель</span>
                <input
                  className="barberrecordarates__productInput"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={weeks}
                  onChange={(e) => setWeeks(e.target.value)}
                  placeholder="1"
                />
              </div>
            ) : (
              <div className="barberrecordarates__exportField" />
            )}
          </div>
        </div>

        <div className="barberrecordarates__modalFoot">
          <button type="button" className="barberrecordarates__btn barberrecordarates__btn--secondary" onClick={onClose}>
            Отмена
          </button>

          <button type="button" className="barberrecordarates__btn barberrecordarates__btn--primary" onClick={() => onExport?.({ mode, date, weeks })}>
            Скачать TXT
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
