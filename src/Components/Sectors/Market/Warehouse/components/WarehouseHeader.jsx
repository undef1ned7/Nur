import React from "react";
import { Box, Plus } from "lucide-react";
import "./WarehouseHeader.scss";

/**
 * Компонент заголовка склада
 * @param {Function} onCreateProduct - Обработчик создания товара
 * @param {Function} onGoodsReceipt - Обработчик перехода на прием товара
 */
const WarehouseHeader = ({ onCreateProduct, onGoodsReceipt }) => {
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
      <div className="warehouse-header__actions">
        <button
          className="warehouse-header__receipt-btn"
          onClick={onGoodsReceipt}
          type="button"
        >
          <Box size={16} />
          Прием товара
        </button>
        <button
          className="warehouse-header__create-btn"
          onClick={onCreateProduct}
          type="button"
        >
          <Plus size={16} />
          Создать товар
        </button>
      </div>
    </div>
  );
};

export default React.memo(WarehouseHeader);

