// RecordaRatesDaysModal.jsx
import React from "react";
import { FaTimes } from "react-icons/fa";
import { fmtInt, fmtMoney } from "./RecordaRates.utils";

const DaysModal = ({ open, onClose, title, rows }) => {
  if (!open) return null;

  return (
    <div
      className="barberrecordarates__overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="barberrecordarates__modal" onClick={(e) => e.stopPropagation()}>
        <div className="barberrecordarates__modalHead">
          <h4 className="barberrecordarates__modalTitle">{title}</h4>
          <button
            type="button"
            className="barberrecordarates__iconBtn"
            aria-label="Закрыть"
            onClick={onClose}
          >
            <FaTimes />
          </button>
        </div>

        <div className="barberrecordarates__tableWrap barberrecordarates__tableWrap--modal">
          <table className="barberrecordarates__table">
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
                  <td className="barberrecordarates__muted" colSpan={4}>
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

        <div className="barberrecordarates__modalFoot">
          <button
            type="button"
            className="barberrecordarates__btn barberrecordarates__btn--secondary"
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
