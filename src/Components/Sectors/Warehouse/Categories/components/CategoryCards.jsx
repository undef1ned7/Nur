import React, { useMemo } from "react";
import "./CategoryCards.scss";

/**
 * Мемоизированный компонент карточки категории
 */
const CategoryCard = React.memo(
  ({
    category,
    isSelected,
    rowNumber,
    onRowSelect,
    onCategoryClick,
  }) => {
    return (
      <div
        className="warehouse-card"
        onClick={() => onCategoryClick(category)}
      >
        <div className="warehouse-card__checkbox">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onRowSelect(category.id, e)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="warehouse-card__content">
          <div className="warehouse-card__header">
            <h3 className="warehouse-card__title">{category.name || "—"}</h3>
            <span className="warehouse-card__number">#{rowNumber}</span>
          </div>
          <div className="warehouse-card__info">
            <span className="warehouse-card__label">ID:</span>
            <span className="warehouse-card__value">{category.id || "—"}</span>
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.category.id === nextProps.category.id &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.rowNumber === nextProps.rowNumber
    );
  }
);

CategoryCard.displayName = "CategoryCard";

/**
 * Компонент карточек категорий
 */
const CategoryCards = ({
  categories,
  loading,
  selectedRows,
  isAllSelected,
  onRowSelect,
  onSelectAll,
  onCategoryClick,
  getRowNumber,
}) => {
  // Мемоизация вычислений для всех категорий
  const categoriesData = useMemo(() => {
    return categories.map((category, index) => ({
      category,
      isSelected: selectedRows.has(category.id),
      rowNumber: getRowNumber(index, categories.length),
    }));
  }, [categories, selectedRows, getRowNumber]);

  if (loading) {
    return (
      <div className="warehouse-cards-container">
        <div className="warehouse-cards__loading">Загрузка...</div>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="warehouse-cards-container">
        <div className="warehouse-cards__empty">Категории не найдены</div>
      </div>
    );
  }

  return (
    <div className="warehouse-cards-container">
      <div className="warehouse-cards">
        {categoriesData.map((categoryData) => (
          <CategoryCard
            key={categoryData.category.id}
            category={categoryData.category}
            isSelected={categoryData.isSelected}
            rowNumber={categoryData.rowNumber}
            onRowSelect={onRowSelect}
            onCategoryClick={onCategoryClick}
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
    prevProps.categories.length === nextProps.categories.length &&
    prevProps.selectedRows.size === nextProps.selectedRows.size &&
    prevProps.categories.every(
      (c, i) => c.id === nextProps.categories[i]?.id
    ) &&
    prevProps.getRowNumber === nextProps.getRowNumber
  );
};

export default React.memo(CategoryCards, areEqual);

