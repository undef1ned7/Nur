import React, { useMemo } from "react";
import {
  getCounterpartyName,
  getAgentDisplay,
  formatMoneyRu,
  getCounterpartyAnalyticsView,
  getCounterpartiesLedgerTotals,
} from "../utils";
import "./CounterpartyTable.scss";

/** Пустая ячейка для нулевых/отсутствующих сумм — как в бумажной ведомости */
const formatMoneyOrBlank = (value) => (value ? formatMoneyRu(value) : "");

/**
 * Мемоизированный компонент строки таблицы
 */
const CounterpartyRow = React.memo(
  ({ counterparty, rowNumber, onCounterpartyClick, showAgentColumn }) => {
    const name = getCounterpartyName(counterparty);
    const metrics = getCounterpartyAnalyticsView(counterparty);

    return (
      <tr
        className="warehouse-table__row cursor-pointer"
        onClick={() => onCounterpartyClick(counterparty)}
      >
        <td className="warehouse-table__num">{rowNumber}</td>

        <td className="warehouse-table__name">
          <span>{name}</span>
        </td>

        <td className="warehouse-table__money">
          {formatMoneyOrBlank(metrics.openingDebit)}
        </td>
        <td className="warehouse-table__money">
          {formatMoneyOrBlank(metrics.openingCredit)}
        </td>
        <td className="warehouse-table__money">
          {formatMoneyOrBlank(metrics.turnoverDebit)}
        </td>
        <td className="warehouse-table__money">
          {formatMoneyOrBlank(metrics.turnoverCredit)}
        </td>
        <td className="warehouse-table__money warehouse-table__money--strong">
          {formatMoneyOrBlank(metrics.closingDebit)}
        </td>
        <td className="warehouse-table__money warehouse-table__money--strong">
          {formatMoneyOrBlank(metrics.closingCredit)}
        </td>

        {showAgentColumn && (
          <td className="warehouse-table__agent">
            {getAgentDisplay(counterparty)}
          </td>
        )}
      </tr>
    );
  },
  (prevProps, nextProps) => {
    return (
      // Сравниваем объект целиком: при смене периода id тот же, а analytics новые
      prevProps.counterparty === nextProps.counterparty &&
      prevProps.rowNumber === nextProps.rowNumber &&
      prevProps.showAgentColumn === nextProps.showAgentColumn
    );
  },
);

CounterpartyRow.displayName = "CounterpartyRow";

/**
 * Компонент таблицы контрагентов
 */
const CounterpartyTable = ({
  counterparties,
  loading,
  onCounterpartyClick,
  getRowNumber,
  showAgentColumn = false,
  totals: totalsProp,
}) => {
  const colCount = 8 + (showAgentColumn ? 1 : 0);
  const counterpartiesData = useMemo(() => {
    return counterparties.map((counterparty, index) => ({
      counterparty,
      rowNumber: getRowNumber(index, counterparties.length),
    }));
  }, [counterparties, getRowNumber]);
  // Итоги по всему списку (а не по текущей странице) передаёт родитель
  const pageTotals = useMemo(
    () => (totalsProp ? null : getCounterpartiesLedgerTotals(counterparties)),
    [totalsProp, counterparties],
  );
  const totals = totalsProp || pageTotals;

  const renderTotalsRow = () => (
    <tr className="warehouse-table__total-row">
      <td></td>
      <td>Итого</td>
      <td className="warehouse-table__money">
        {formatMoneyOrBlank(totals.openingDebit)}
      </td>
      <td className="warehouse-table__money">
        {formatMoneyOrBlank(totals.openingCredit)}
      </td>
      <td className="warehouse-table__money">
        {formatMoneyOrBlank(totals.turnoverDebit)}
      </td>
      <td className="warehouse-table__money">
        {formatMoneyOrBlank(totals.turnoverCredit)}
      </td>
      <td className="warehouse-table__money warehouse-table__money--strong">
        {formatMoneyOrBlank(totals.closingDebit)}
      </td>
      <td className="warehouse-table__money warehouse-table__money--strong">
        {formatMoneyOrBlank(totals.closingCredit)}
      </td>
      {showAgentColumn && <td></td>}
    </tr>
  );

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
      <table className="warehouse-table warehouse-table--ledger w-full min-w-[1100px]">
        <thead>
          <tr>
            <th rowSpan={2}>№</th>
            <th rowSpan={2}>Субконто</th>
            <th colSpan={2}>Сальдо на начало периода</th>
            <th colSpan={2}>Оборот за период</th>
            <th colSpan={2}>Сальдо на конец периода</th>
            {showAgentColumn && <th rowSpan={2}>Агент</th>}
          </tr>
          <tr>
            <th>Дебет</th>
            <th>Кредит</th>
            <th>Дебет</th>
            <th>Кредит</th>
            <th>Дебет</th>
            <th>Кредит</th>
          </tr>
        </thead>
        <tbody>
          {counterpartiesData.map((data) => (
            <CounterpartyRow
              key={data.counterparty.id}
              counterparty={data.counterparty}
              rowNumber={data.rowNumber}
              onCounterpartyClick={onCounterpartyClick}
              showAgentColumn={showAgentColumn}
            />
          ))}
        </tbody>
        <tfoot>{renderTotalsRow()}</tfoot>
      </table>
    </div>
  );
};

export default React.memo(CounterpartyTable);
