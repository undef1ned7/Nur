import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import SearchableCombobox from "../../../../common/SearchableCombobox/SearchableCombobox";
import {
  MARKET_WAREHOUSE_PRESETS,
  buildMarketWarehouseListParams,
  modalStateFromAppliedFilters,
} from "../../../../../tools/marketWarehouseFilters";
import "../Warehouse.scss";

const FilterModal = ({
  onClose,
  currentFilters,
  onApplyFilters,
  onResetFilters,
  brands = [],
  categories = [],
  suppliers = [],
  suppliersLoading = false,
}) => {
  const [filters, setFilters] = useState(() =>
    modalStateFromAppliedFilters(currentFilters),
  );
  const [applyError, setApplyError] = useState("");

  const supplierOptions = useMemo(
    () =>
      (Array.isArray(suppliers) ? suppliers : [])
        .map((supplier) => ({
          value: String(supplier.id || ""),
          label:
            String(
              supplier.full_name ||
                supplier.name ||
                supplier.company_name ||
                supplier.phone ||
                supplier.email ||
                "Без названия",
            ).trim() || "Без названия",
        }))
        .filter((option) => option.value && option.label),
    [suppliers],
  );

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
    const { params, error } = buildMarketWarehouseListParams(filters);
    if (error) {
      setApplyError(error);
      return;
    }
    setApplyError("");
    onApplyFilters(params);
    onClose();
  };

  const handleReset = () => {
    setFilters(modalStateFromAppliedFilters({}));
    setApplyError("");
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
              {MARKET_WAREHOUSE_PRESETS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {applyError ? (
            <p className="warehouse-filter-modal__error" role="alert">
              {applyError}
            </p>
          ) : null}

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

          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__label">Поставщик</label>
            <SearchableCombobox
              value={String(filters.supplier || "")}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, supplier: String(value || "") }))
              }
              options={supplierOptions}
              placeholder={
                suppliersLoading
                  ? "Загрузка поставщиков..."
                  : "Выберите поставщика"
              }
              classNamePrefix="searchableCombo"
            />
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
                <option value="базовая">Базовая</option>
                <option value="цена закупки">Цена закупки</option>
                <option value="себестоимость">Себестоимость</option>
                <option value="скидка">Скидка</option>
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
          {/* <div className="warehouse-filter-modal__section">
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
          </div> */}

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
                <option value="истек">истек</option>
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
          {/* <div className="warehouse-filter-modal__section">
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
          </div> */}

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
                <option value="не продавался в течение">
                  не продавался в течение
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
            type="button"
            className="warehouse-filter-modal__reset-btn"
            onClick={handleReset}
          >
            Сбросить
          </button>
          <button
            type="button"
            className="warehouse-filter-modal__cancel-btn"
            onClick={onClose}
          >
            Отменить
          </button>
          <button
            type="button"
            className="warehouse-filter-modal__apply-btn"
            onClick={handleApply}
          >
            Применить
          </button>
          <button
            type="button"
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
