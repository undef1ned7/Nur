import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { X } from "lucide-react";
import { fetchClientsAsync } from "../../../../../store/creators/clientCreators";
import { useClient } from "../../../../../store/slices/ClientSlice";
import { useProducts } from "../../../../../store/slices/productSlice";
import "./BulkEditModal.scss";

/**
 * Массовое изменение бренда / категории / поставщика у выбранных товаров.
 * Изменяются только те поля, у которых включён чекбокс.
 */
const BulkEditModal = ({ selectedCount, onClose, onApply, saving }) => {
  const dispatch = useDispatch();
  const { brands, categories } = useProducts();
  const { list: clients } = useClient();

  const [fields, setFields] = useState({
    brand_name: { enabled: false, value: "" },
    category_name: { enabled: false, value: "" },
    client: { enabled: false, value: "" },
  });
  const [error, setError] = useState("");

  const suppliers = useMemo(
    () => (clients || []).filter((c) => c.type === "suppliers"),
    [clients]
  );

  useEffect(() => {
    if (!clients || clients.length === 0) {
      dispatch(fetchClientsAsync({ type: "suppliers" }));
    }
  }, [dispatch, clients]);

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
    if (Object.values(changes).some((value) => value === "")) {
      setError("Выберите значение для каждого отмеченного поля");
      return;
    }

    onApply(changes);
  };

  const renderField = (key, label, options, placeholder) => (
    <div className="bulk-edit-modal__section">
      <label className="bulk-edit-modal__toggle">
        <input
          type="checkbox"
          checked={fields[key].enabled}
          onChange={() => toggleField(key)}
        />
        <span>{label}</span>
      </label>
      <select
        value={fields[key].value}
        disabled={!fields[key].enabled}
        onChange={(e) => changeValue(key, e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.key} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="bulk-edit-modal">
      <div className="bulk-edit-modal__overlay" onClick={onClose} />
      <div className="bulk-edit-modal__content">
        <div className="bulk-edit-modal__header">
          <h3>Изменить выбранные товары</h3>
          <X
            className="bulk-edit-modal__close-icon"
            size={20}
            onClick={onClose}
          />
        </div>

        <p className="bulk-edit-modal__hint">
          Выбрано товаров: <strong>{selectedCount}</strong>. Изменятся только
          отмеченные поля, остальные останутся без изменений.
        </p>

        {renderField(
          "brand_name",
          "Бренд",
          (brands || []).map((brand, idx) => ({
            key: brand.id ?? idx,
            value: brand.name,
            label: brand.name,
          })),
          "-- Выберите бренд --"
        )}

        {renderField(
          "category_name",
          "Категория",
          (categories || []).map((category, idx) => ({
            key: category.id ?? idx,
            value: category.name,
            label: category.name,
          })),
          "-- Выберите категорию --"
        )}

        {renderField(
          "client",
          "Поставщик",
          suppliers.map((client, idx) => ({
            key: client.id ?? idx,
            value: client.id,
            label: client.full_name,
          })),
          "-- Выберите поставщика --"
        )}

        {error && <p className="bulk-edit-modal__error">{error}</p>}

        <div className="bulk-edit-modal__footer">
          <button
            className="bulk-edit-modal__cancel"
            onClick={onClose}
            disabled={saving}
          >
            Отмена
          </button>
          <button
            className="bulk-edit-modal__apply"
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

export default BulkEditModal;
