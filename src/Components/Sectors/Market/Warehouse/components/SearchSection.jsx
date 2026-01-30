import React from "react";
import { Search, Filter, LayoutGrid, Table2 } from "lucide-react";
import { VIEW_MODES } from "../constants";
import "./SearchSection.scss";

/**
 * Компонент секции поиска и фильтров
 */
const SearchSection = ({
  searchTerm,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onOpenFilters,
  count,
  foundCount,
}) => {
  return (
    <div className="warehouse-search-section">
      <div className="warehouse-search">
        <Search className="warehouse-search__icon" size={18} />
        <input
          type="text"
          className="warehouse-search__input"
          placeholder="Поиск по названию товара..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="warehouse-search__info flex flex-wrap items-center gap-2">
        <span>
          Всего: {count ?? 0} • Найдено: {foundCount}
        </span>

        <div className="ml-auto flex items-center gap-2 warehouse-view-buttons">
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
              className="warehouse-search__filter-btn md:block flex justify-center w-full"
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

export default React.memo(SearchSection);
