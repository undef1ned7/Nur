import React, { useMemo } from "react";
import "./CategoryTable.scss";

/**
 * Мемоизированный компонент строки таблицы
 */
const CategoryRow = React.memo(
  ({
    category,
    isSelected,
    rowNumber,
    onRowSelect,
    onCategoryClick,
  }) => {
    return (
      <tr
        className="warehouse-table__row"
        onClick={() => onCategoryClick(category)}
      >
        <td onClick={(e) => onRowSelect(category.id, e)}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onRowSelect(category.id, e)}
            onClick={(e) => e.stopPropagation()}
          />
        </td>

        <td>{rowNumber}</td>

        <td className="warehouse-table__name">
          <span>{category.name || "—"}</span>
        </td>

        <td>{category.id || "—"}</td>
      </tr>
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

CategoryRow.displayName = "CategoryRow";

/**
 * Компонент таблицы категорий
 */
const CategoryTable = ({
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
      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="warehouse-table w-full min-w-[600px]">
          <tbody>
            <tr>
              <td colSpan={4} className="warehouse-table__loading">
                Загрузка...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="warehouse-table w-full min-w-[600px]">
          <tbody>
            <tr>
              <td colSpan={4} className="warehouse-table__empty">
                Категории не найдены
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="warehouse-table w-full min-w-[600px]">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={onSelectAll}
              />
            </th>
            <th>№</th>
            <th>Название</th>
            <th>ID</th>
          </tr>
        </thead>
        <tbody>
          {categoriesData.map((categoryData) => (
            <CategoryRow
              key={categoryData.category.id}
              category={categoryData.category}
              isSelected={categoryData.isSelected}
              rowNumber={categoryData.rowNumber}
              onRowSelect={onRowSelect}
              onCategoryClick={onCategoryClick}
            />
          ))}
        </tbody>
      </table>
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

export default React.memo(CategoryTable, areEqual);

