import React, { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import "./WarehouseTable.scss";

/**
 * Мемоизированный компонент строки таблицы
 */
const WarehouseRow = React.memo(
  ({ warehouse, rowNumber, onOpenWarehouse }) => {
    const handleOpenClick = (e) => {
      e.stopPropagation();
      onOpenWarehouse(warehouse);
    };

    return (
      <tr className="warehouse-table__row">
        <td>{rowNumber}</td>
        <td className="warehouse-table__name">
          {warehouse.name || warehouse.title || "—"}
        </td>
        <td>{warehouse.address || warehouse.location || "—"}</td>
        <td>{warehouse.products_count || warehouse.products?.length || 0}</td>
        <td>
          <button
            className="warehouse-table__action-btn"
            onClick={handleOpenClick}
            title="Открыть товары склада"
          >
            <ExternalLink size={16} />
            Открыть
          </button>
        </td>
      </tr>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.warehouse.id === nextProps.warehouse.id &&
      prevProps.rowNumber === nextProps.rowNumber
    );
  }
);

WarehouseRow.displayName = "WarehouseRow";

/**
 * Компонент таблицы складов
 */
const WarehouseTable = ({
  warehouses,
  loading,
  onOpenWarehouse,
  getRowNumber,
}) => {
  // Мемоизация вычислений для всех складов
  const warehousesData = useMemo(() => {
    return warehouses.map((warehouse, index) => ({
      warehouse,
      rowNumber: getRowNumber(index, warehouses.length),
    }));
  }, [warehouses, getRowNumber]);

  if (loading) {
    return (
      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="warehouse-table w-full min-w-[800px]">
          <tbody>
            <tr>
              <td colSpan={5} className="warehouse-table__loading">
                Загрузка...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  if (warehouses.length === 0) {
    return (
      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="warehouse-table w-full min-w-[800px]">
          <tbody>
            <tr>
              <td colSpan={5} className="warehouse-table__empty">
                Склады не найдены
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="warehouse-table w-full min-w-[800px]">
        <thead>
          <tr>
            <th>№</th>
            <th>Наименование</th>
            <th>Адрес</th>
            <th>Товары</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          {warehousesData.map((warehouseData) => (
            <WarehouseRow
              key={warehouseData.warehouse.id}
              warehouse={warehouseData.warehouse}
              rowNumber={warehouseData.rowNumber}
              onOpenWarehouse={onOpenWarehouse}
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
    prevProps.warehouses.length === nextProps.warehouses.length &&
    prevProps.getRowNumber === nextProps.getRowNumber
  );
};

export default React.memo(WarehouseTable, areEqual);
