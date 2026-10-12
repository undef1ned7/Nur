import React from "react";
import { ArrowLeft, Plus } from "lucide-react";
import "./WarehouseHeader.scss";

/**
 * Компонент заголовка складов
 * @param {Function} onBack - Обработчик кнопки «Назад» (опционально)
 * @param {Function} onCreateWarehouse - Обработчик создания склада
 * @param {Function} onCreateProduct - Обработчик создания товара (опционально)
 * @param {String} title - Заголовок (опционально)
 * @param {String} subtitle - Подзаголовок (опционально)
 */
const WarehouseHeader = ({
  onBack,
  onCreateWarehouse,
  onCreateProduct,
  title = "Склады",
  subtitle = "Управление складами и их товарами",
}) => {
  return (
    <React.Fragment>
      {onBack && (
        <button
          type="button"
          className="warehouse-header__back"
          onClick={onBack}
          aria-label="Назад"
        >
          <ArrowLeft size={20} />
          Назад
        </button>
      )}
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon">
            <div className="warehouse-header__icon-box">🏢</div>
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">{title}</h1>
            <p className="warehouse-header__subtitle">{subtitle}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          {onCreateProduct && (
            <button
              className="warehouse-header__create-btn"
              onClick={onCreateProduct}
            >
              <Plus size={16} />
              Создать товар
            </button>
          )}
          {onCreateWarehouse && (
            <button
              className="warehouse-header__create-btn"
              onClick={onCreateWarehouse}
            >
              <Plus size={16} />
              Создать склад
            </button>
          )}
        </div>
      </div>
    </React.Fragment>
  );
};

export default React.memo(WarehouseHeader);

