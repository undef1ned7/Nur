import React from "react";
import { ArrowRight, X } from "lucide-react";
import "./PartnerCatalogSelectionBar.scss";

const pluralItems = (n) => {
  if (n === 1) return "товар";
  if (n >= 2 && n <= 4) return "товара";
  return "товаров";
};

const PartnerCatalogSelectionBar = ({
  selectedCount,
  isReceive,
  onContinue,
  onClear,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="partner-catalog-selection-bar" role="region" aria-label="Выбранные товары">
      <div className="partner-catalog-selection-bar__inner">
        <div className="partner-catalog-selection-bar__info">
          <span className="partner-catalog-selection-bar__count">{selectedCount}</span>
          <span>
            {pluralItems(selectedCount)} в корзине обмена
          </span>
        </div>
        <div className="partner-catalog-selection-bar__actions">
          <button
            type="button"
            className="partner-catalog-selection-bar__clear"
            onClick={onClear}
          >
            <X size={16} />
            Сбросить
          </button>
          <button
            type="button"
            className={`partner-catalog-selection-bar__continue ${isReceive ? "partner-catalog-selection-bar__continue--receive" : "partner-catalog-selection-bar__continue--send"}`}
            onClick={onContinue}
          >
            {isReceive ? "Забрать выбранное" : "Отправить выбранное"}
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PartnerCatalogSelectionBar);
