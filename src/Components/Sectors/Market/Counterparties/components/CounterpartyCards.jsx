import React, { useMemo } from "react";
import { formatPhone, getCounterpartyName } from "../utils";
import "./CounterpartyCards.scss";

/**
 * Мемоизированный компонент карточки контрагента
 */
const CounterpartyCard = React.memo(
  ({
    counterparty,
    isSelected,
    rowNumber,
    onRowSelect,
    onCounterpartyClick,
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
      <div className="warehouse-table__row warehouse-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
        <div className="flex items-start gap-3">
          <div className="pt-1" onClick={(e) => onRowSelect(counterparty.id, e)}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onRowSelect(counterparty.id, e)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-slate-300"
            />
          </div>

          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xl">
            👥
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500">#{rowNumber}</div>
            <div className="warehouse-table__name mt-0.5 truncate text-sm font-semibold text-slate-900">
              {name}
            </div>

            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
              <span className="whitespace-nowrap">
                Тип:{" "}
                <span className="font-medium">{typeLabel}</span>
              </span>
              {phone !== "—" && (
                <span className="whitespace-nowrap">
                  Телефон:{" "}
                  <span className="font-medium">{phone}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          {email !== "—" && (
            <div className="rounded-xl bg-slate-50 p-2">
              <div className="text-slate-500">Email</div>
              <div className="mt-0.5 truncate font-semibold text-slate-900">
                {email}
              </div>
            </div>
          )}

          {inn !== "—" && (
            <div className="rounded-xl bg-slate-50 p-2">
              <div className="text-slate-500">ИНН</div>
              <div className="mt-0.5 font-semibold text-slate-900">
                {inn}
              </div>
            </div>
          )}

          {phone !== "—" && email === "—" && (
            <div className="col-span-2 rounded-xl bg-slate-50 p-2">
              <div className="text-slate-500">Телефон</div>
              <div className="mt-0.5 font-semibold text-slate-900">
                {phone}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="warehouse-card__open-btn"
            onClick={(e) => {
              e.stopPropagation();
              onCounterpartyClick(counterparty);
            }}
          >
            Открыть
          </button>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.counterparty.id === nextProps.counterparty.id &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.rowNumber === nextProps.rowNumber
    );
  }
);

CounterpartyCard.displayName = "CounterpartyCard";

/**
 * Компонент карточек контрагентов
 */
const CounterpartyCards = ({
  counterparties,
  loading,
  selectedRows,
  isAllSelected,
  onRowSelect,
  onSelectAll,
  onCounterpartyClick,
  getRowNumber,
}) => {
  const selectedRowsSize = selectedRows.size;
  const counterpartiesData = useMemo(() => {
    return counterparties.map((counterparty, index) => ({
      counterparty,
      isSelected: selectedRows.has(counterparty.id),
      rowNumber: getRowNumber(index, counterparties.length),
    }));
  }, [counterparties, selectedRows, selectedRowsSize, getRowNumber]);

  if (loading && counterparties.length === 0) {
    return (
      <div className="warehouse-table__loading rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
        Загрузка...
      </div>
    );
  }

  if (counterparties.length === 0 && !loading) {
    return (
      <div className="warehouse-table__empty rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
        Контрагенты не найдены
      </div>
    );
  }

  return (
    <div className="block relative">
      {loading && counterparties.length > 0 && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
          <div className="text-sm text-slate-600">Загрузка...</div>
        </div>
      )}
      <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <label
          className="flex items-center gap-2 text-sm text-slate-700"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={onSelectAll}
            disabled={loading}
            className="h-4 w-4 rounded border-slate-300"
          />
          Выбрать все
        </label>

        <div className="text-sm text-slate-600">
          Выбрано: <span className="font-semibold">{selectedRows.size}</span>
        </div>
      </div>

      <div className="warehouse-cards grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {counterpartiesData.map((data) => (
          <CounterpartyCard
            key={data.counterparty.id}
            counterparty={data.counterparty}
            isSelected={data.isSelected}
            rowNumber={data.rowNumber}
            onRowSelect={onRowSelect}
            onCounterpartyClick={onCounterpartyClick}
          />
        ))}
      </div>
    </div>
  );
};

const areEqual = (prevProps, nextProps) => {
  if (
    prevProps.loading !== nextProps.loading ||
    prevProps.isAllSelected !== nextProps.isAllSelected ||
    prevProps.selectedRows.size !== nextProps.selectedRows.size ||
    prevProps.getRowNumber !== nextProps.getRowNumber
  ) {
    return false;
  }

  if (prevProps.counterparties.length !== nextProps.counterparties.length) {
    return false;
  }

  if (prevProps.counterparties === nextProps.counterparties) {
    return true;
  }

  if (prevProps.counterparties.length > 0 && nextProps.counterparties.length > 0) {
    if (prevProps.counterparties[0]?.id !== nextProps.counterparties[0]?.id) {
      return false;
    }
  }

  return true;
};

export default React.memo(CounterpartyCards, areEqual);

