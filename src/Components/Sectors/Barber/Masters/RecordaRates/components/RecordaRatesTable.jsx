// RecordaRatesTable.jsx
import React, { useState } from "react";
import { FaTimes, FaCog, FaCalendarAlt, FaBoxOpen } from "react-icons/fa";
import { fmtInt, fmtMoney } from "../RecordaRates.utils";

const RecordaRatesTable = ({
  visible,
  onRateChange,
  onOpenDays,
  onOpenProduct,
}) => {
  const [ratesModal, setRatesModal] = useState({ open: false, rowId: null });

  const openRatesModal = (row) => setRatesModal({ open: true, rowId: row.id });
  const closeRatesModal = () => setRatesModal({ open: false, rowId: null });

  // Получаем актуальные данные из visible по id
  const currentRow = ratesModal.rowId
    ? visible.find((r) => r.id === ratesModal.rowId)
    : null;

  return (
    <>
      <div className="barberrecordarates__tableWrap">
        <table className="barberrecordarates__table">
          <thead>
            <tr>
              <th>Мастер</th>
              <th>Завершено</th>
              <th>К выплате</th>
              <th>Действия</th>
            </tr>
          </thead>

          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{fmtInt(r.completed)}</td>
                <td className="barberrecordarates__payoutCell">
                  {fmtMoney(r.total)}
                </td>
                <td>
                  <div className="barberrecordarates__actions">
                    <button
                      type="button"
                      className="barberrecordarates__actionBtn barberrecordarates__actionBtn--settings"
                      onClick={() => openRatesModal(r)}
                      title="Настройки ставок"
                    >
                      <FaCog />
                      <span>Ставки</span>
                    </button>
                    <button
                      type="button"
                      className="barberrecordarates__actionBtn barberrecordarates__actionBtn--days"
                      onClick={() => onOpenDays(r)}
                      title="По дням"
                    >
                      <FaCalendarAlt />
                      <span>Дни</span>
                    </button>
                    <button
                      type="button"
                      className="barberrecordarates__actionBtn barberrecordarates__actionBtn--product"
                      onClick={() => onOpenProduct(r)}
                      title="Продажа товара"
                    >
                      <FaBoxOpen />
                      <span>Товар</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!visible.length && (
              <tr>
                <td className="barberrecordarates__muted" colSpan={4}>
                  Нет мастеров
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Модальное окно настроек ставок */}
      {ratesModal.open && currentRow && (
        <div
          className="barberrecordarates__overlay"
          onClick={(e) => e.target === e.currentTarget && closeRatesModal()}
        >
          <div className="barberrecordarates__modal barberrecordarates__modal--rates">
            <div className="barberrecordarates__modalHead">
              <h3 className="barberrecordarates__modalTitle">
                Ставки: {currentRow.name}
              </h3>
              <button
                type="button"
                className="barberrecordarates__iconBtn"
                onClick={closeRatesModal}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            <div className="barberrecordarates__ratesBody">
              {/* Выручка (только показ) */}
              <div className="barberrecordarates__ratesRow">
                <label className="barberrecordarates__ratesLabel">
                  Выручка
                </label>
                <div className="barberrecordarates__ratesValue">
                  {fmtMoney(currentRow.revenue)}
                </div>
              </div>

              {/* За запись */}
              <div className="barberrecordarates__ratesRow">
                <label className="barberrecordarates__ratesLabel">
                  За запись
                </label>
                <input
                  className="barberrecordarates__ratesInput"
                  type="number"
                  min="0"
                  max="10000000"
                  value={currentRow.perRecord || ""}
                  onChange={(e) =>
                    onRateChange(currentRow.id, "perRecord", e.target.value)
                  }
                  placeholder="0"
                />
                <span className="barberrecordarates__ratesHint">сом</span>
              </div>

              {/* Фикс */}
              <div className="barberrecordarates__ratesRow">
                <label className="barberrecordarates__ratesLabel">
                  Фикс (месяц)
                </label>
                <input
                  className="barberrecordarates__ratesInput"
                  type="number"
                  min="0"
                  max="10000000"
                  value={currentRow.fixed || ""}
                  onChange={(e) =>
                    onRateChange(currentRow.id, "fixed", e.target.value)
                  }
                  placeholder="0"
                />
                <span className="barberrecordarates__ratesHint">сом</span>
              </div>

              {/* Процент */}
              <div className="barberrecordarates__ratesRow">
                <label className="barberrecordarates__ratesLabel">
                  Процент от выручки
                </label>
                <input
                  className="barberrecordarates__ratesInput"
                  type="number"
                  min="0"
                  max="100"
                  value={currentRow.percent || ""}
                  onChange={(e) =>
                    onRateChange(currentRow.id, "percent", e.target.value)
                  }
                  placeholder="0"
                />
                <span className="barberrecordarates__ratesHint">%</span>
              </div>

              {/* Итого к выплате */}
              <div className="barberrecordarates__ratesRow barberrecordarates__ratesRow--total">
                <label className="barberrecordarates__ratesLabel">
                  К выплате
                </label>
                <div className="barberrecordarates__ratesTotalValue">
                  {fmtMoney(currentRow.total)}
                </div>
              </div>
            </div>

            <div className="barberrecordarates__modalFoot">
              <button
                type="button"
                className="barberrecordarates__btn barberrecordarates__btn--primary"
                onClick={closeRatesModal}
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RecordaRatesTable;
