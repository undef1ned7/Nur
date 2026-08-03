import React, { useState } from "react";
import { X } from "lucide-react";
import SearchSelect from "../../../../common/SearchSelect/SearchSelect";
import { useSearchableOptions } from "../../../../../hooks/useSearchableOptions";
import "../Warehouse.scss";

// Постоянные параметры запросов — вне компонента, чтобы ссылка не менялась
const SUPPLIER_PARAMS = { type: "suppliers" };

const mapNameOption = (item) => ({
  value: String(item?.name || ""),
  label: String(item?.name || ""),
});

const mapSupplierOption = (supplier) => ({
  value: String(supplier?.id || ""),
  label:
    String(
      supplier?.full_name ||
        supplier?.name ||
        supplier?.company_name ||
        supplier?.phone ||
        supplier?.email ||
        "Без названия",
    ).trim() || "Без названия",
  // бэкенд ищет и по телефону/компании — чтобы найденное не отсеялось локальным фильтром
  searchText: [
    supplier?.full_name,
    supplier?.name,
    supplier?.company_name,
    supplier?.llc,
    supplier?.phone,
    supplier?.email,
  ]
    .filter(Boolean)
    .join(" "),
});

/**
 * Массовое изменение бренда / категории / поставщика у выбранных товаров.
 * Изменяются только поля с включённым чекбоксом.
 *
 * Все три справочника грузятся с бэкенда постранично: поиск уходит параметром
 * `search`, а если записей больше страницы — внизу списка появляется
 * «Смотреть ещё» (см. useSearchableOptions).
 */
const BulkEditModal = ({ selectedCount, onClose, onApply, saving = false }) => {
  const [fields, setFields] = useState({
    brand_name: { enabled: false, value: "" },
    category_name: { enabled: false, value: "" },
    client: { enabled: false, value: "" },
  });
  const [error, setError] = useState("");

  // Справочники подгружаем только для включённых полей
  const brandsSource = useSearchableOptions({
    endpoint: "/main/brands/",
    mapOption: mapNameOption,
    enabled: fields.brand_name.enabled,
  });
  const categoriesSource = useSearchableOptions({
    endpoint: "/main/categories/",
    mapOption: mapNameOption,
    enabled: fields.category_name.enabled,
  });
  const suppliersSource = useSearchableOptions({
    endpoint: "/main/clients/",
    params: SUPPLIER_PARAMS,
    mapOption: mapSupplierOption,
    enabled: fields.client.enabled,
  });

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
            <SearchSelect
              value={fields.brand_name.value}
              valueLabel={fields.brand_name.value}
              onChange={(value) => changeValue("brand_name", String(value || ""))}
              options={brandsSource.options}
              disabled={!fields.brand_name.enabled}
              placeholder="Выбрать бренд"
              emptyText="Бренды не найдены"
              maxVisible={500}
              onQueryChange={brandsSource.setQuery}
              loading={brandsSource.loading}
              hasMore={brandsSource.hasMore}
              onLoadMore={brandsSource.loadMore}
            />
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
            <SearchSelect
              value={fields.category_name.value}
              valueLabel={fields.category_name.value}
              onChange={(value) =>
                changeValue("category_name", String(value || ""))
              }
              options={categoriesSource.options}
              disabled={!fields.category_name.enabled}
              placeholder="Выбрать категорию"
              emptyText="Категории не найдены"
              maxVisible={500}
              onQueryChange={categoriesSource.setQuery}
              loading={categoriesSource.loading}
              hasMore={categoriesSource.hasMore}
              onLoadMore={categoriesSource.loadMore}
            />
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
            <SearchSelect
              value={String(fields.client.value || "")}
              onChange={(value) => changeValue("client", String(value || ""))}
              options={suppliersSource.options}
              disabled={!fields.client.enabled}
              placeholder="Выберите поставщика"
              emptyText="Поставщики не найдены"
              maxVisible={500}
              onQueryChange={suppliersSource.setQuery}
              loading={suppliersSource.loading}
              hasMore={suppliersSource.hasMore}
              onLoadMore={suppliersSource.loadMore}
            />
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
