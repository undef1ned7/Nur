import { useState } from "react";
import { X } from "lucide-react";

const FilterModal = ({
  onClose,
  currentFilters,
  onApplyFilters,
  onResetFilters,
}) => {
  const [filters, setFilters] = useState(() => {
    return {
      name: currentFilters.name || "",
      category: currentFilters.category || "",
      min_price: currentFilters.min_price || "",
      max_price: currentFilters.max_price || "",
      min_quantity: currentFilters.min_quantity || "",
      max_quantity: currentFilters.max_quantity || "",
    };
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleApply = () => {
    const cleanedFilters = {};
    for (const key in filters) {
      const value = filters[key];
      if (value !== undefined && value !== null && value !== "") {
        cleanedFilters[key] = value;
      }
    }
    onApplyFilters(cleanedFilters);
    onClose();
  };

  const handleReset = () => {
    const resetValues = {
      name: "",
      category: "",
      min_price: "",
      max_price: "",
      min_quantity: "",
      max_quantity: "",
    };
    setFilters(resetValues);
    onResetFilters();
    onClose();
  };

  return (
    <div className="filter-modal">
      <div className="filter-modal__overlay" onClick={onClose} />
      <div className="filter-modal__content">
        <div className="filter-modal__header">
          <h3>Фильтры товаров</h3>
          <X className="filter-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <div className="filter-modal__section">
          <label>Название</label>
          <input
            type="text"
            name="name"
            placeholder="Название товара"
            value={filters.name}
            onChange={handleChange}
          />
        </div>

        <div className="filter-modal__section">
          <label>Категория</label>
          <input
            type="text"
            name="category"
            placeholder="Например, Электроника"
            value={filters.category}
            onChange={handleChange}
          />
        </div>

        <div className="filter-modal__section">
          <label>Минимальная цена</label>
          <input
            type="number"
            name="min_price"
            placeholder="0"
            value={filters.min_price}
            onChange={handleChange}
            min="0"
            step="0.01"
          />
        </div>

        <div className="filter-modal__section">
          <label>Максимальная цена</label>
          <input
            type="number"
            name="max_price"
            placeholder="1000"
            value={filters.max_price}
            onChange={handleChange}
            min="0"
            step="0.01"
          />
        </div>

        <div className="filter-modal__section">
          <label>Минимальное количество</label>
          <input
            type="number"
            name="min_quantity"
            placeholder="0"
            value={filters.min_quantity}
            onChange={handleChange}
            min="0"
          />
        </div>

        <div className="filter-modal__section">
          <label>Максимальное количество</label>
          <input
            type="number"
            name="max_quantity"
            placeholder="100"
            value={filters.max_quantity}
            onChange={handleChange}
            min="0"
          />
        </div>

        <div className="filter-modal__footer">
          <button className="filter-modal__reset" onClick={handleReset}>
            Сбросить фильтры
          </button>
          <button className="filter-modal__apply" onClick={handleApply}>
            Применить фильтры
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterModal;
