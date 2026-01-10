import React from "react";
import { Search } from "lucide-react";
import "./SearchSection.scss";

/**
 * Компонент секции поиска
 */
const SearchSection = ({
  searchTerm,
  onSearchChange,
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
          placeholder="Поиск по названию склада..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="warehouse-search__info flex flex-wrap items-center gap-2">
        <span>
          Всего: {count ?? 0} • Найдено: {foundCount}
        </span>
      </div>
    </div>
  );
};

export default React.memo(SearchSection);

