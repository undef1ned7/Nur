import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import SearchableCombobox from "../../../../common/SearchableCombobox/SearchableCombobox";
import "../Warehouse.scss";

/**
 * Массовое изменение бренда / категории / поставщика у выбранных товаров.
 * Изменяются только поля с включённым чекбоксом.
 */
const BulkEditModal = ({
  selectedCount,
  onClose,
  onApply,
  saving = false,
  brands = [],
  categories = [],
  suppliers = [],
  suppliersLoading = false,
}) => {
  const [fields, setFields] = useState({
    brand_name: { enabled: false, value: "" },
    category_name: { enabled: false, value: "" },
    client: { enabled: false, value: "" },
  });
  const [error, setError] = useState("");

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

  const toggleField = (key) => {
    setError("");
    setFields((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }));
  };

  const changeValue = (key, value) => {
    setError("");
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], value } }));
  };

  const handleApply = () => {
    const changes = {};
    Object.entries(fields).forEach(([key, field]) => {
      if (field.enabled) changes[key] = field.value;
    });

    if (Object.keys(changes).length === 0) {
      setError("Отметьте хотя бы одно поле для изменения");
      return;
    }
    if (Object.values(changes).some((value) => !String(value).trim())) {
      setError("Выберите значение для каждого отмеченного поля");
      return;
    }

    onApply(changes);
  };

  return (
    <div className="warehouse-filter-overlay" onClick={onClose}>
      <div
        className="warehouse-filter-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="warehouse-filter-modal__header">
          <h3 className="warehouse-filter-modal__title">
            Изменить выбранные товары
          </h3>
          <button className="warehouse-filter-modal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <p className="warehouse-filter-modal__subtitle">
          Выбрано товаров: {selectedCount}. Изменятся только отмеченные поля.
        </p>

        <div className="warehouse-filter-modal__content">
          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__checkbox-label">
              <input
                type="checkbox"
                checked={fields.brand_name.enabled}
                onChange={() => toggleField("brand_name")}
              />
              <span>Бренд</span>
            </label>
            <select
              className="warehouse-filter-modal__select"
              value={fields.brand_name.value}
              disabled={!fields.brand_name.enabled}
              onChange={(e) => changeValue("brand_name", e.target.value)}
            >
              <option value="">Выбрать бренд</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.name}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__checkbox-label">
              <input
                type="checkbox"
                checked={fields.category_name.enabled}
                onChange={() => toggleField("category_name")}
              />
              <span>Категория</span>
            </label>
            <select
              className="warehouse-filter-modal__select"
              value={fields.category_name.value}
              disabled={!fields.category_name.enabled}
              onChange={(e) => changeValue("category_name", e.target.value)}
            >
              <option value="">Выбрать категорию</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="warehouse-filter-modal__section">
            <label className="warehouse-filter-modal__checkbox-label">
              <input
                type="checkbox"
                checked={fields.client.enabled}
                onChange={() => toggleField("client")}
              />
              <span>Поставщик</span>
            </label>
            {fields.client.enabled ? (
              <SearchableCombobox
                value={String(fields.client.value || "")}
                onChange={(value) => changeValue("client", String(value || ""))}
                options={supplierOptions}
                placeholder={
                  suppliersLoading
                    ? "Загрузка поставщиков..."
                    : "Выберите поставщика"
                }
                classNamePrefix="searchableCombo"
              />
            ) : (
              <select className="warehouse-filter-modal__select" disabled>
                <option>Выберите поставщика</option>
              </select>
            )}
          </div>

          {error ? (
            <p className="warehouse-filter-modal__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="warehouse-filter-modal__footer">
          <button
            type="button"
            className="warehouse-filter-modal__cancel-btn"
            onClick={onClose}
            disabled={saving}
          >
            Отменить
          </button>
          <button
            type="button"
            className="warehouse-filter-modal__apply-btn"
            onClick={handleApply}
            disabled={saving}
          >
            {saving ? "Сохранение..." : "Применить"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(BulkEditModal);
