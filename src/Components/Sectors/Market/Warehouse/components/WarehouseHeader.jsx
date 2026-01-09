import React from "react";
import { Plus } from "lucide-react";
import "./WarehouseHeader.scss";

/**
 * Компонент заголовка склада
 * @param {Function} onCreateProduct - Обработчик создания товара
 */
const WarehouseHeader = ({ onCreateProduct }) => {
  return (
    <div className="warehouse-header">
      <div className="warehouse-header__left">
        <div className="warehouse-header__icon">
          <div className="warehouse-header__icon-box">📦</div>
        </div>
        <div className="warehouse-header__title-section">
          <h1 className="warehouse-header__title">Склад</h1>
          <p className="warehouse-header__subtitle">
            Управление товарами и запасами
          </p>
        </div>
      </div>
      <button
        className="warehouse-header__create-btn"
        onClick={onCreateProduct}
      >
        <Plus size={16} />
        Создать товар
      </button>
    </div>
  );
};

export default React.memo(WarehouseHeader);

