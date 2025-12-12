import React, { useState } from "react";
import { X } from "lucide-react";
import "../Warehouse.scss";

const FilterModal = ({
  onClose,
  currentFilters,
  onApplyFilters,
  onResetFilters,
  brands = [],
  categories = [],
}) => {
  const [filters, setFilters] = useState(() => ({
    itemTypes: {
      product: true,
      service: true,
      kit: true,
    },
    preset: currentFilters.preset || "",
    category: currentFilters.category || "",
    brand: currentFilters.brand || "",
    price: {
      type: currentFilters.price_type || "базовая",
      condition: currentFilters.price_condition || "больше",
      value: currentFilters.price_value || "0",
    },
    stock: {
      type: currentFilters.stock_type || "общие",
      condition: currentFilters.stock_condition || "больше",
      value: currentFilters.stock_value || "0",
    },
    shelfLife: {
      condition: currentFilters.shelf_life_condition || "истекает в течение",
      value: currentFilters.shelf_life_value || "0",
    },
    productChanges: {
      condition: currentFilters.changes_condition || "изменялся в течение",
      value: currentFilters.changes_value || "0",
    },
    sellability: {
      condition: currentFilters.sellability_condition || "продавался в течение",
      value: currentFilters.sellability_value || "0",
    },
  }));

  const handleItemTypeChange = (type) => {
    setFilters((prev) => ({
      ...prev,
      itemTypes: {
        ...prev.itemTypes,
        [type]: !prev.itemTypes[type],
      },
    }));
  };

  const handleInputChange = (section, field, value) => {
    setFilters((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleApply = () => {
    const cleanedFilters = {};

    // Item types (kind)
    const selectedTypes = [];
    if (filters.itemTypes.product) selectedTypes.push("product");
    if (filters.itemTypes.service) selectedTypes.push("service");
    if (filters.itemTypes.kit) selectedTypes.push("bundle");

    // Если выбраны не все типы, отправляем фильтр
    if (selectedTypes.length < 3) {
      cleanedFilters.kind = selectedTypes.join(",");
    }

    // Other filters
    if (filters.preset) cleanedFilters.preset = filters.preset;
    if (filters.category) cleanedFilters.category = filters.category;
    if (filters.brand) cleanedFilters.brand = filters.brand;

    if (filters.price.value && filters.price.value !== "0") {
      cleanedFilters.price_type = filters.price.type;
      cleanedFilters.price_condition = filters.price.condition;
      cleanedFilters.price_value = filters.price.value;
    }

    if (filters.stock.value && filters.stock.value !== "0") {
      cleanedFilters.stock_type = filters.stock.type;
      cleanedFilters.stock_condition = filters.stock.condition;
      cleanedFilters.stock_value = filters.stock.value;
    }

    if (filters.shelfLife.value && filters.shelfLife.value !== "0") {
      cleanedFilters.shelf_life_condition = filters.shelfLife.condition;
      cleanedFilters.shelf_life_value = filters.shelfLife.value;
    }

    if (filters.productChanges.value && filters.productChanges.value !== "0") {
      cleanedFilters.changes_condition = filters.productChanges.condition;
      cleanedFilters.changes_value = filters.productChanges.value;
    }

    if (filters.sellability.value && filters.sellability.value !== "0") {
      cleanedFilters.sellability_condition = filters.sellability.condition;
      cleanedFilters.sellability_value = filters.sellability.value;
    }

    onApplyFilters(cleanedFilters);
    onClose();
  };

  const handleReset = () => {
    setFilters({
      itemTypes: {
        product: true,
        service: true,
        kit: true,
      },
      preset: "",
      category: "",
      brand: "",
      price: {
        type: "базовая",
        condition: "больше",
        value: "0",
      },
      stock: {
        type: "общие",
        condition: "больше",
        value: "0",
      },
      shelfLife: {
        condition: "истекает в течение",
        value: "0",
      },
      productChanges: {
        condition: "изменялся в течение",
        value: "0",
      },
      sellability: {
        condition: "продавался в течение",
        value: "0",
      },
    });
    onResetFilters();
    onClose();
  };

  return (
    <div className="warehouse-filter-overlay" onClick={onClose}>
      <div
        className="warehouse-filter-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="warehouse-filter-modal__header">
          <h3 className="warehouse-filter-modal__title">Фильтры</h3>
          <button className="warehouse-filter-modal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <p className="warehouse-filter-modal__subtitle">
          Настройте фильтры для поиска товаров
        </p>

        <div className="warehouse-filter-modal__content">
          {/* Пресеты фильтров */}
          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label">
              Пресеты фильтров
            </label>
            <select
              className="warehouse-filter-modal__select"
              value={filters.preset}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, preset: e.target.value }))
              }
            >
              <option value="">Выберите</option>
            </select>
          </div>

          {/* Типы товаров */}
          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label">Тип товара</label>
            <div className="warehouse-filter-modal__checkboxes">
              <label className="warehouse-filter-modal__checkbox-label">
                <input
                  type="checkbox"
                  checked={filters.itemTypes.product}
                  onChange={() => handleItemTypeChange("product")}
                />
                <span>Товар</span>
              </label>
              <label className="warehouse-filter-modal__checkbox-label">
                <input
                  type="checkbox"
                  checked={filters.itemTypes.service}
                  onChange={() => handleItemTypeChange("service")}
                />
                <span>Услуга</span>
              </label>
              <label className="warehouse-filter-modal__checkbox-label">
                <input
                  type="checkbox"
                  checked={filters.itemTypes.kit}
                  onChange={() => handleItemTypeChange("kit")}
                />
                <span>Комплект</span>
              </label>
            </div>
          </div>

          {/* Категории */}
          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label">Категории</label>
            <select
              className="warehouse-filter-modal__select"
              value={filters.category}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, category: e.target.value }))
              }
            >
              <option value="">Выбрать категорию</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Бренд */}
          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label">Бренд</label>
            <select
              className="warehouse-filter-modal__select"
              value={filters.brand}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, brand: e.target.value }))
              }
            >
              <option value="">Выбрать бренд</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          {/* Цена */}
          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label">Цена</label>
            <div className="warehouse-filter-modal__row">
              <select
                className="warehouse-filter-modal__select-small"
                value={filters.price.type}
                onChange={(e) =>
                  handleInputChange("price", "type", e.target.value)
                }
              >
                <option value="базовая">базовая</option>
              </select>
              <select
                className="warehouse-filter-modal__select-small"
                value={filters.price.condition}
                onChange={(e) =>
                  handleInputChange("price", "condition", e.target.value)
                }
              >
                <option value="больше">больше</option>
                <option value="меньше">меньше</option>
                <option value="равно">равно</option>
              </select>
              <input
                type="number"
                className="warehouse-filter-modal__input-small"
                value={filters.price.value}
                onChange={(e) =>
                  handleInputChange("price", "value", e.target.value)
                }
              />
              <button className="warehouse-filter-modal__add-btn">+</button>
            </div>
          </div>

          {/* Остатки */}
          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label">Остатки</label>
            <div className="warehouse-filter-modal__row">
              <select
                className="warehouse-filter-modal__select-small"
                value={filters.stock.type}
                onChange={(e) =>
                  handleInputChange("stock", "type", e.target.value)
                }
              >
                <option value="общие">общие</option>
              </select>
              <select
                className="warehouse-filter-modal__select-small"
                value={filters.stock.condition}
                onChange={(e) =>
                  handleInputChange("stock", "condition", e.target.value)
                }
              >
                <option value="больше">больше</option>
                <option value="меньше">меньше</option>
                <option value="равно">равно</option>
              </select>
              <input
                type="number"
                className="warehouse-filter-modal__input-small"
                value={filters.stock.value}
                onChange={(e) =>
                  handleInputChange("stock", "value", e.target.value)
                }
              />
              <button className="warehouse-filter-modal__add-btn">+</button>
            </div>
          </div>

          {/* Срок годности */}
          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label">
              Срок годности
            </label>
            <div className="warehouse-filter-modal__row">
              <select
                className="warehouse-filter-modal__select-medium"
                value={filters.shelfLife.condition}
                onChange={(e) =>
                  handleInputChange("shelfLife", "condition", e.target.value)
                }
              >
                <option value="истекает в течение">истекает в течение</option>
              </select>
              <input
                type="number"
                className="warehouse-filter-modal__input-small"
                value={filters.shelfLife.value}
                onChange={(e) =>
                  handleInputChange("shelfLife", "value", e.target.value)
                }
              />
              <span className="warehouse-filter-modal__unit">дней</span>
            </div>
          </div>

          {/* Изменения товара */}
          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label">
              Изменения товара
            </label>
            <div className="warehouse-filter-modal__row">
              <select
                className="warehouse-filter-modal__select-medium"
                value={filters.productChanges.condition}
                onChange={(e) =>
                  handleInputChange(
                    "productChanges",
                    "condition",
                    e.target.value
                  )
                }
              >
                <option value="изменялся в течение">изменялся в течение</option>
              </select>
              <input
                type="number"
                className="warehouse-filter-modal__input-small"
                value={filters.productChanges.value}
                onChange={(e) =>
                  handleInputChange("productChanges", "value", e.target.value)
                }
              />
              <span className="warehouse-filter-modal__unit">дней</span>
            </div>
          </div>

          {/* Продаваемость */}
          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label">
              Продаваемость
            </label>
            <div className="warehouse-filter-modal__row">
              <select
                className="warehouse-filter-modal__select-medium"
                value={filters.sellability.condition}
                onChange={(e) =>
                  handleInputChange("sellability", "condition", e.target.value)
                }
              >
                <option value="продавался в течение">
                  продавался в течение
                </option>
              </select>
              <input
                type="number"
                className="warehouse-filter-modal__input-small"
                value={filters.sellability.value}
                onChange={(e) =>
                  handleInputChange("sellability", "value", e.target.value)
                }
              />
              <span className="warehouse-filter-modal__unit">дней</span>
            </div>
          </div>
        </div>

        <div className="warehouse-filter-modal__footer">
          <button
            className="warehouse-filter-modal__apply-btn"
            onClick={handleApply}
          >
            Применить
          </button>
          <button
            className="warehouse-filter-modal__cancel-btn"
            onClick={onClose}
          >
            Отменить
          </button>
          <button
            className="warehouse-filter-modal__save-preset-btn"
            onClick={() => {}}
          >
            Сохранить пресет
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterModal;
