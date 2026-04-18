import React from "react";
import { Box, ClipboardList, Plus } from "lucide-react";
import "./WarehouseHeader.scss";

/**
 * Компонент заголовка склада
 * @param {Function} onCreateProduct - Обработчик создания товара
 * @param {Function} onGoodsReceipt - Обработчик перехода на прием товара
 * @param {Function} onInventory - Обработчик открытия инвентаризации
 * @param {number} selectedCount - Количество выбранных товаров (для подписи кнопки)
 */
const WarehouseHeader = ({
  onCreateProduct,
  onGoodsReceipt,
  onInventory,
  selectedCount = 0,
}) => {
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
          className="warehouse-header__inventory-btn"
          onClick={onInventory}
          type="button"
          title={
            selectedCount > 0
              ? "Открыть документы: инвентаризация с выбранными товарами"
              : "Открыть раздел актов инвентаризации (Документы)"
          }
        >
          <ClipboardList size={16} />
          Инвентаризация{selectedCount > 0 ? ` (${selectedCount})` : ""}
        </button>
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

