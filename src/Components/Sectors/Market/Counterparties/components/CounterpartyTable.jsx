import React, { useMemo } from "react";
import {
  getCounterpartyName,
  getAgentDisplay,
  formatMoneyRu,
  getCounterpartyAnalyticsView,
} from "../utils";
import "./CounterpartyTable.scss";

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
        <td>{rowNumber}</td>

        <td className="warehouse-table__name">
          <span>{name}</span>
        </td>

        <td
          className="warehouse-table__money"
          style={
            metrics.openingDebit === null
              ? { textAlign: "center" }
              : { textAlign: "left" }
          }
        >
          {metrics.openingDebit === null
            ? "—"
            : formatMoneyRu(metrics.openingDebit)}
        </td>
        <td
          className="warehouse-table__money"
          style={
            metrics.openingCredit === null
              ? { textAlign: "center" }
              : { textAlign: "left" }
          }
        >
          {metrics.openingCredit === null
            ? "—"
            : formatMoneyRu(metrics.openingCredit)}
        </td>
        <td className="warehouse-table__money">
          {formatMoneyRu(metrics.turnoverDebit)}
        </td>
        <td className="warehouse-table__money">
          {formatMoneyRu(metrics.turnoverCredit)}
        </td>
        <td className="warehouse-table__money warehouse-table__money--strong">
          {formatMoneyRu(metrics.closingDebit)}
        </td>
        <td className="warehouse-table__money warehouse-table__money--strong">
          {formatMoneyRu(metrics.closingCredit)}
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
      prevProps.counterparty.id === nextProps.counterparty.id &&
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
}) => {
  const colCount = 8 + (showAgentColumn ? 1 : 0);
  const counterpartiesData = useMemo(() => {
    return counterparties.map((counterparty, index) => ({
      counterparty,
      rowNumber: getRowNumber(index, counterparties.length),
    }));
  }, [counterparties, getRowNumber]);
  const totals = useMemo(() => {
    return counterparties.reduce(
      (acc, counterparty) => {
        const metrics = getCounterpartyAnalyticsView(counterparty);
        if (metrics.openingDebit !== null) {
          acc.openingDebit += metrics.openingDebit;
          acc.hasOpeningDebit = true;
        }
        if (metrics.openingCredit !== null) {
          acc.openingCredit += metrics.openingCredit;
          acc.hasOpeningCredit = true;
        }
        acc.turnoverDebit += metrics.turnoverDebit;
        acc.turnoverCredit += metrics.turnoverCredit;
        acc.closingDebit += metrics.closingDebit;
        acc.closingCredit += metrics.closingCredit;
        return acc;
      },
      {
        openingDebit: 0,
        openingCredit: 0,
        turnoverDebit: 0,
        turnoverCredit: 0,
        closingDebit: 0,
        closingCredit: 0,
        hasOpeningDebit: false,
        hasOpeningCredit: false,
      },
    );
  }, [counterparties]);

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
            <th rowSpan={2}>№</th>
            <th
              rowSpan={2}
              style={{
                borderRight: "1px solid #e5e7eb",
                borderLeft: "1px solid #e5e7eb",
              }}
            >
              Субконто
            </th>
            <th
              colSpan={2}
              style={{
                borderRight: "1px solid #e5e7eb",
                borderLeft: "1px solid #e5e7eb",
              }}
            >
              Сальдо на начало периода
            </th>
            <th colSpan={2} style={{ borderRight: "1px solid #e5e7eb" }}>
              Оборот за период
            </th>
            <th colSpan={2} style={{ borderRight: "1px solid #e5e7eb" }}>
              Сальдо на конец периода
            </th>
            {showAgentColumn && <th rowSpan={2}>Агент</th>}
          </tr>
          <tr>
            <th
              style={{
                borderRight: "1px solid #e5e7eb",
                borderLeft: "1px solid #e5e7eb",
              }}
            >
              Дебет
            </th>
            <th style={{ borderRight: "1px solid #e5e7eb" }}>Кредит</th>
            <th style={{ borderRight: "1px solid #e5e7eb" }}>Дебет</th>
            <th style={{ borderRight: "1px solid #e5e7eb" }}>Кредит</th>
            <th style={{ borderRight: "1px solid #e5e7eb" }}>Дебет</th>
            <th style={{ borderRight: "1px solid #e5e7eb" }}>Кредит</th>
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
        <tfoot>
          <tr className="warehouse-table__total-row">
            <td></td>
            <td>Итого</td>
            <td
              className={"warehouse-table__money"}
              style={
                totals.hasOpeningCredit
                  ? { textAlign: "right" }
                  : { textAlign: "center" }
              }
            >
              {totals.hasOpeningDebit
                ? formatMoneyRu(totals.openingDebit)
                : "—"}
            </td>
            <td
              className="warehouse-table__money"
              style={
                totals.hasOpeningCredit
                  ? { textAlign: "right" }
                  : { textAlign: "center" }
              }
            >
              {totals.hasOpeningCredit
                ? formatMoneyRu(totals.openingCredit)
                : "—"}
            </td>
            <td className="warehouse-table__money text-center">
              {formatMoneyRu(totals.turnoverDebit)}
            </td>
            <td className="warehouse-table__money text-center">
              {formatMoneyRu(totals.turnoverCredit)}
            </td>
            <td className="warehouse-table__money warehouse-table__money--strong">
              {formatMoneyRu(totals.closingDebit)}
            </td>
            <td className="warehouse-table__money warehouse-table__money--strong">
              {formatMoneyRu(totals.closingCredit)}
            </td>
            {showAgentColumn && <td></td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

const areEqual = (prevProps, nextProps) => {
  if (
    prevProps.loading !== nextProps.loading ||
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
