import React from "react";
import { Search, Filter, LayoutGrid, Table2 } from "lucide-react";
import { VIEW_MODES } from "../constants";
import "./CounterpartySearchSection.scss";

/**
 * Компонент секции поиска и фильтров
 */
const CounterpartySearchSection = ({
  searchTerm,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onOpenFilters,
  count,
  foundCount,
  onlyUnpaid,
  onOnlyUnpaidChange,
}) => {
  return (
    <div className="warehouse-search-section">
      <div className="warehouse-search">
        <Search className="warehouse-search__icon" size={18} />
        <input
          type="text"
          className="warehouse-search__input"
          placeholder="Поиск по названию контрагента..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="warehouse-search__info flex flex-wrap items-center gap-2">
        <span>
          Всего: {count ?? 0} • Найдено: {foundCount}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {onOnlyUnpaidChange && (
            <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-slate-700">
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(onlyUnpaid)}
                onClick={() => onOnlyUnpaidChange(!onlyUnpaid)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors
                  ${onlyUnpaid ? "bg-slate-900" : "bg-slate-300"}`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform
                    ${onlyUnpaid ? "translate-x-[18px]" : "translate-x-0.5"}`}
                />
              </button>
              Только с долгом
            </label>
          )}

          <button
            type="button"
            onClick={() => onViewModeChange(VIEW_MODES.TABLE)}
            className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
              ${
                viewMode === VIEW_MODES.TABLE
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
          >
            <Table2 size={16} />
            Таблица
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange(VIEW_MODES.CARDS)}
            className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
              ${
                viewMode === VIEW_MODES.CARDS
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
          >
            <LayoutGrid size={16} />
            Карточки
          </button>

          {onOpenFilters && (
            <button
              className="warehouse-search__filter-btn"
              onClick={onOpenFilters}
            >
              <Filter size={16} />
              Фильтры
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(CounterpartySearchSection);

