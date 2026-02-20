import React, { useMemo } from "react";
import { formatPhone, getCounterpartyName, getAgentDisplay } from "../utils";
import "./CounterpartyTable.scss";

/**
 * Мемоизированный компонент строки таблицы
 */
const CounterpartyRow = React.memo(
  ({
    counterparty,
    isSelected,
    rowNumber,
    onRowSelect,
    onCounterpartyClick,
    showAgentColumn,
  }) => {
    const name = getCounterpartyName(counterparty);
    const phone = formatPhone(counterparty?.phone);
    const email = counterparty?.email || "—";
    const type = counterparty?.type || "—";
    const inn = counterparty?.inn || "—";

    // Маппинг типов для отображения
    const typeLabels = {
      CLIENT: "Клиент",
      SUPPLIER: "Поставщик",
      BOTH: "Клиент и поставщик",
    };

    const typeLabel = typeLabels[type] || type;

    return (
      <tr className="warehouse-table__row">
        <td onClick={(e) => onRowSelect(counterparty.id, e)}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onRowSelect(counterparty.id, e)}
            onClick={(e) => e.stopPropagation()}
          />
        </td>

        <td>{rowNumber}</td>

        <td className="warehouse-table__name">
          <span>{name}</span>
        </td>

        <td>{typeLabel}</td>

        {showAgentColumn && (
          <td className="warehouse-table__agent">
            {getAgentDisplay(counterparty)}
          </td>
        )}
        <td>
          <button
            type="button"
            className="warehouse-table__open-btn"
            onClick={(e) => {
              e.stopPropagation();
              onCounterpartyClick(counterparty);
            }}
          >
            Открыть
          </button>
        </td>
      </tr>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.counterparty.id === nextProps.counterparty.id &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.rowNumber === nextProps.rowNumber &&
      prevProps.showAgentColumn === nextProps.showAgentColumn
    );
  }
);

CounterpartyRow.displayName = "CounterpartyRow";

/**
 * Компонент таблицы контрагентов
 */
const CounterpartyTable = ({
  counterparties,
  loading,
  selectedRows,
  isAllSelected,
  onRowSelect,
  onSelectAll,
  onCounterpartyClick,
  getRowNumber,
  showAgentColumn = false,
}) => {
  const selectedRowsSize = selectedRows.size;
  const colCount = 5 + (showAgentColumn ? 1 : 0);
  const counterpartiesData = useMemo(() => {
    return counterparties.map((counterparty, index) => ({
      counterparty,
      isSelected: selectedRows.has(counterparty.id),
      rowNumber: getRowNumber(index, counterparties.length),
    }));
  }, [counterparties, selectedRows, selectedRowsSize, getRowNumber]);

  if (loading && counterparties.length === 0) {
    return (
      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="warehouse-table w-full min-w-[1100px]">
          <tbody>
            <tr>
              <td colSpan={colCount} className="warehouse-table__loading">
                Загрузка...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  if (counterparties.length === 0 && !loading) {
    return (
      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="warehouse-table w-full min-w-[1100px]">
          <tbody>
            <tr>
              <td colSpan={colCount} className="warehouse-table__empty">
                Контрагенты не найдены
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm relative">
      {loading && counterparties.length > 0 && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
          <div className="text-sm text-slate-600">Загрузка...</div>
        </div>
      )}
      <table className="warehouse-table w-full min-w-[1100px]">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={onSelectAll}
                disabled={loading}
              />
            </th>
            <th>№</th>
            <th>Название</th>
            <th>Тип</th>
            {showAgentColumn && <th>Агент</th>}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {counterpartiesData.map((data) => (
            <CounterpartyRow
              key={data.counterparty.id}
              counterparty={data.counterparty}
              isSelected={data.isSelected}
              rowNumber={data.rowNumber}
              onRowSelect={onRowSelect}
              onCounterpartyClick={onCounterpartyClick}
              showAgentColumn={showAgentColumn}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

const areEqual = (prevProps, nextProps) => {
  if (
    prevProps.loading !== nextProps.loading ||
    prevProps.isAllSelected !== nextProps.isAllSelected ||
    prevProps.selectedRows.size !== nextProps.selectedRows.size ||
    prevProps.getRowNumber !== nextProps.getRowNumber ||
    prevProps.showAgentColumn !== nextProps.showAgentColumn
  ) {
    return false;
  }

  if (prevProps.counterparties.length !== nextProps.counterparties.length) {
    return false;
  }

  if (prevProps.counterparties === nextProps.counterparties) {
    return true;
  }

  if (
    prevProps.counterparties.length > 0 &&
    nextProps.counterparties.length > 0
  ) {
    if (prevProps.counterparties[0]?.id !== nextProps.counterparties[0]?.id) {
      return false;
    }
  }

  return true;
};

export default React.memo(CounterpartyTable, areEqual);
