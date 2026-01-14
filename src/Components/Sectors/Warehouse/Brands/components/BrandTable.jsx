import React, { useMemo } from "react";
import "./BrandTable.scss";

/**
 * Мемоизированный компонент строки таблицы
 */
const BrandRow = React.memo(
  ({
    brand,
    isSelected,
    rowNumber,
    onRowSelect,
    onBrandClick,
  }) => {
    return (
      <tr
        className="warehouse-table__row"
        onClick={() => onBrandClick(brand)}
      >
        <td onClick={(e) => onRowSelect(brand.id, e)}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onRowSelect(brand.id, e)}
            onClick={(e) => e.stopPropagation()}
          />
        </td>

        <td>{rowNumber}</td>

        <td className="warehouse-table__name">
          <span>{brand.name || "—"}</span>
        </td>

        <td>{brand.id || "—"}</td>
      </tr>
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

BrandRow.displayName = "BrandRow";

/**
 * Компонент таблицы брендов
 */
const BrandTable = ({
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

  if (brands.length === 0) {
    return (
      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="warehouse-table w-full min-w-[600px]">
          <tbody>
            <tr>
              <td colSpan={4} className="warehouse-table__empty">
                Бренды не найдены
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
          {brandsData.map((brandData) => (
            <BrandRow
              key={brandData.brand.id}
              brand={brandData.brand}
              isSelected={brandData.isSelected}
              rowNumber={brandData.rowNumber}
              onRowSelect={onRowSelect}
              onBrandClick={onBrandClick}
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
    prevProps.brands.length === nextProps.brands.length &&
    prevProps.selectedRows.size === nextProps.selectedRows.size &&
    prevProps.brands.every(
      (b, i) => b.id === nextProps.brands[i]?.id
    ) &&
    prevProps.getRowNumber === nextProps.getRowNumber
  );
};

export default React.memo(BrandTable, areEqual);

