import React from "react";
import { Plus } from "lucide-react";
import "./CounterpartyHeader.scss";

/**
 * Компонент заголовка контрагентов
 * @param {Function} onCreateCounterparty - Обработчик создания контрагента
 */
const CounterpartyHeader = ({ onCreateCounterparty }) => {
  return (
    <div className="warehouse-header">
      <div className="warehouse-header__left">
        <div className="warehouse-header__icon">
          <div className="warehouse-header__icon-box">👥</div>
        </div>
        <div className="warehouse-header__title-section">
          <h1 className="warehouse-header__title">Контрагенты</h1>
          <p className="warehouse-header__subtitle">
            Управление контрагентами склада
          </p>
        </div>
      </div>
      <button
        className="warehouse-header__create-btn"
        onClick={onCreateCounterparty}
      >
        <Plus size={16} />
        Создать контрагента
      </button>
    </div>
  );
};

export default React.memo(CounterpartyHeader);

