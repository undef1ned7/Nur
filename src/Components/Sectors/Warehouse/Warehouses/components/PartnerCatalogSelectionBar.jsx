import React from "react";
import { ArrowRight, X } from "lucide-react";
import { pluralRu } from "../partnership/partnershipHelpers";
import "./PartnerCatalogSelectionBar.scss";

const PartnerCatalogSelectionBar = ({
  selectedCount,
  isReceive,
  requiresConfirmation = false,
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
            {pluralRu(selectedCount, ["товар", "товара", "товаров"])} в корзине обмена
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
            {isReceive
              ? requiresConfirmation
                ? "Запросить выбранное"
                : "Забрать выбранное"
              : "Отправить выбранное"}
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PartnerCatalogSelectionBar);
