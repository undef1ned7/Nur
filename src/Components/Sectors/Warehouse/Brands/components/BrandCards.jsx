import React, { useMemo } from "react";
import "./BrandCards.scss";

/**
 * Мемоизированный компонент карточки бренда
 */
const BrandCard = React.memo(
  ({
    brand,
    isSelected,
    rowNumber,
    onRowSelect,
    onBrandClick,
  }) => {
    return (
      <div
        className="warehouse-card"
        onClick={() => onBrandClick(brand)}
      >
        <div className="warehouse-card__checkbox">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onRowSelect(brand.id, e)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="warehouse-card__content">
          <div className="warehouse-card__header">
            <h3 className="warehouse-card__title">{brand.name || "—"}</h3>
            <span className="warehouse-card__number">#{rowNumber}</span>
          </div>
          <div className="warehouse-card__info">
            <span className="warehouse-card__label">ID:</span>
            <span className="warehouse-card__value">{brand.id || "—"}</span>
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.brand.id === nextProps.brand.id &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.rowNumber === nextProps.rowNumber
    );
  }
);

BrandCard.displayName = "BrandCard";

/**
 * Компонент карточек брендов
 */
const BrandCards = ({
  brands,
  loading,
  selectedRows,
  isAllSelected,
  onRowSelect,
  onSelectAll,
  onBrandClick,
  getRowNumber,
}) => {
  // Мемоизация вычислений для всех брендов
  const brandsData = useMemo(() => {
    return brands.map((brand, index) => ({
      brand,
      isSelected: selectedRows.has(brand.id),
      rowNumber: getRowNumber(index, brands.length),
    }));
  }, [brands, selectedRows, getRowNumber]);

  if (loading) {
    return (
      <div className="warehouse-cards-container">
        <div className="warehouse-cards__loading">Загрузка...</div>
      </div>
    );
  }

  if (brands.length === 0) {
    return (
      <div className="warehouse-cards-container">
        <div className="warehouse-cards__empty">Бренды не найдены</div>
      </div>
    );
  }

  return (
    <div className="warehouse-cards-container">
      <div className="warehouse-cards">
        {brandsData.map((brandData) => (
          <BrandCard
            key={brandData.brand.id}
            brand={brandData.brand}
            isSelected={brandData.isSelected}
            rowNumber={brandData.rowNumber}
            onRowSelect={onRowSelect}
            onBrandClick={onBrandClick}
          />
        ))}
      </div>
    </div>
  );
};

// Оптимизированное сравнение для React.memo
const areEqual = (prevProps, nextProps) => {
  return (
    prevProps.loading === nextProps.loading &&
    prevProps.isAllSelected === nextProps.isAllSelected &&
    prevProps.brands.length === nextProps.brands.length &&
    prevProps.selectedRows.size === nextProps.selectedRows.size &&
    prevProps.brands.every(
      (b, i) => b.id === nextProps.brands[i]?.id
    ) &&
    prevProps.getRowNumber === nextProps.getRowNumber
  );
};

export default React.memo(BrandCards, areEqual);

