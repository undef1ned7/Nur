import { Search, Filter } from "lucide-react";

/**
 * Компонент поиска и фильтров для склада
 */
const SkladSearchSection = ({
  searchTerm,
  onSearchChange,
  count,
  productsLength,
  isFiltered,
  onResetFilters,
  onShowFilterModal,
}) => {
  return (
    <div className="sklad-new__search-section-wrapper">
      {/* Поиск и фильтры */}
      <div className="sklad-new__search-section">
        <div className="sklad-new__search-wrapper">
          <Search size={20} className="sklad-new__search-icon" />
          <input
            type="text"
            placeholder="Поиск по названию товара..."
            className="sklad-new__search"
            value={searchTerm}
            onChange={onSearchChange}
          />
        </div>
        <button
          className="sklad-new__filter-btn hidden"
          onClick={onShowFilterModal}
        >
          <Filter size={18} />
          Фильтры
        </button>
      </div>

      {/* Статистика */}
      <div className="sklad-new__stats">
        Всего: {count !== null ? count : "-"} • Найдено: {productsLength}
        {isFiltered && (
          <span className="sklad-new__reset" onClick={onResetFilters}>
            Сбросить фильтры
          </span>
        )}
      </div>
    </div>
  );
};

export default SkladSearchSection;
