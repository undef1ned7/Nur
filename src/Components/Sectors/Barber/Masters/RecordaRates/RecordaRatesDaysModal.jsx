// RecordaRatesDaysModal.jsx
import React from "react";
import { FaTimes } from "react-icons/fa";
import { fmtInt, fmtMoney } from "./RecordaRates.utils";

const DaysModal = ({ open, onClose, title, rows }) => {
  if (!open) return null;

  return (
    <div
      className="recordarates__overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="recordarates__modal" onClick={(e) => e.stopPropagation()}>
        <div className="recordarates__modalHead">
          <h4 className="recordarates__modalTitle">{title}</h4>
          <button
            type="button"
            className="recordarates__iconBtn"
            aria-label="Закрыть"
            onClick={onClose}
          >
            <FaTimes />
          </button>
        </div>

        <div className="recordarates__tableWrap recordarates__tableWrap--modal">
          <table className="recordarates__table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Завершено</th>
                <th>Выручка</th>
                <th>К выплате</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="recordarates__muted" colSpan={4}>
                    Нет данных
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.date}>
                    <td>{r.date}</td>
                    <td>{fmtInt(r.completed)}</td>
                    <td>{fmtMoney(r.revenue)}</td>
                    <td>
                      <b>{fmtMoney(r.payout)}</b>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="recordarates__modalFoot">
          <button
            type="button"
            className="recordarates__btn recordarates__btn--secondary"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default DaysModal;
