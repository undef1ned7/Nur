import React from "react";
import { Trash2, X } from "lucide-react";
import "./BulkActionsBar.scss";

/**
 * Компонент панели массовых действий
 */
const BulkActionsBar = ({
  selectedCount,
  onClearSelection,
  onBulkDelete,
  isDeleting,
}) => {
  if (selectedCount === 0) return null;

  const getSelectedText = () => {
    if (selectedCount === 1) return "товар выбран";
    if (selectedCount < 5) return "товара выбрано";
    return "товаров выбрано";
  };

  return (
    <div className="warehouse-bulk-actions">
      <div className="warehouse-bulk-actions__content">
        <div className="warehouse-bulk-actions__info">
          <div className="warehouse-bulk-actions__badge">
            <span className="warehouse-bulk-actions__count">
              {selectedCount}
            </span>
            <span className="warehouse-bulk-actions__text">
              {getSelectedText()}
            </span>
          </div>
        </div>
        <div className="warehouse-bulk-actions__buttons">
          <button
            className="warehouse-bulk-actions__clear-btn"
            onClick={onClearSelection}
            disabled={isDeleting}
            title="Снять выбор"
          >
            <X size={16} />
            Сбросить
          </button>
          <button
            className="warehouse-bulk-actions__delete-btn"
            onClick={onBulkDelete}
            disabled={isDeleting}
            title="Удалить выбранные товары"
          >
            <Trash2 size={16} />
            {isDeleting ? "Удаление..." : "Удалить выбранные"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(BulkActionsBar);

