// PayrollDailyDetailsModal.jsx
import React, { useEffect, useRef } from "react";
import { FaTimes } from "react-icons/fa";
import { fmtMoney } from "./PayrollDailyUtils";

const PayrollDailyDetailsModal = ({ open, title, rows, onClose }) => {
  const bodyRef = useRef(null);

  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose?.();
    if (open) document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="payrolldaily__overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="payrolldaily__modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="payrolldaily__modalHead">
          <h4 className="payrolldaily__modalTitle">{title}</h4>
          <button
            type="button"
            className="payrolldaily__iconBtn"
            aria-label="Закрыть"
            onClick={onClose}
            title="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        <div className="payrolldaily__modalBody" ref={bodyRef}>
          <div className="payrolldaily__tableWrap payrolldaily__tableWrap--modal">
            <table className="payrolldaily__table">
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Клиент</th>
                  <th>Услуги</th>
                  <th className="is-money">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="payrolldaily__empty">
                      Нет данных
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.time}</td>
                      <td>{r.client}</td>
                      <td
                        className="payrolldaily__ellipsis"
                        title={r.services}
                      >
                        {r.services}
                      </td>
                      <td className="is-money">
                        {fmtMoney(r.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="payrolldaily__modalFoot">
          <button
            type="button"
            className="payrolldaily__btn payrolldaily__btn--secondary"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default PayrollDailyDetailsModal;
