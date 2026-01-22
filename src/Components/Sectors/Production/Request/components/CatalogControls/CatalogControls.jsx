import React from "react";
import { Search, ShoppingCart, Grid, List, X } from "lucide-react";
import { useUser } from "../../../../../../store/slices/userSlice";
import "./CatalogControls.scss";

const CatalogControls = ({
  searchQuery,
  onSearchChange,
  onClearSearch,
  categoryFilter,
  onCategoryChange,
  categories,
  viewMode,
  onViewModeChange,
  onOpenCart,
  totalItemsCount,
}) => {
  const { profile } = useUser();
  // Проверяем, является ли пользователь сотрудником (не владельцем)
  const isEmployee = profile?.role !== "owner";

  const handleSearch = (e) => {
    e.preventDefault();
    // Поиск работает через useMemo фильтрацию
  };

  return (
    <div className="catalog-controls w-full">
      <form onSubmit={handleSearch} className="search-form w-full max-w-full! lg:max-w-100!">
        <div className="search-input-group">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Поиск по названию товара"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={onClearSearch}
              className="clear-search-btn"
              title="Очистить поиск"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </form>

      {categories && categories.length > 0 && (
        <div style={{ marginLeft: "15px" }}>
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryChange(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "2px solid #e1e5e9",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            <option value="">Все категории</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="controls-right">
        {isEmployee && (
          <button className="request-cart-btn" onClick={onOpenCart}>
            <ShoppingCart size={20} />
            Запросы
            {totalItemsCount > 0 && (
              <span className="cart-badge">{totalItemsCount}</span>
            )}
          </button>
        )}

        <div className="view-mode-toggle">
          <button
            className={`view-btn ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => onViewModeChange("grid")}
          >
            <Grid size={20} />
          </button>
          <button
            className={`view-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => onViewModeChange("list")}
          >
            <List size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CatalogControls;
