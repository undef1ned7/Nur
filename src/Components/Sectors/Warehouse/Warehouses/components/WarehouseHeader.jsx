import React from "react";
import { Plus } from "lucide-react";
import "./WarehouseHeader.scss";

/**
 * Компонент заголовка складов
 * @param {Function} onCreateWarehouse - Обработчик создания склада
 */
const WarehouseHeader = ({ onCreateWarehouse }) => {
  return (
    <div className="warehouse-header">
      <div className="warehouse-header__left">
        <div className="warehouse-header__icon">
          <div className="warehouse-header__icon-box">🏢</div>
        </div>
        <div className="warehouse-header__title-section">
          <h1 className="warehouse-header__title">Склады</h1>
          <p className="warehouse-header__subtitle">
            Управление складами и их товарами
          </p>
        </div>
      </div>
      <button
        className="warehouse-header__create-btn"
        onClick={onCreateWarehouse}
      >
        <Plus size={16} />
        Создать склад
      </button>
    </div>
  );
};

export default React.memo(WarehouseHeader);

