import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { X } from "lucide-react";
import "../Warehouses.scss";

/**
 * Модальное окно для создания склада
 */
const CreateWarehouseModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: "",
    address: "",
  });
  const [error, setError] = useState("");

  // Получаем состояние создания из Redux
  const creating = useSelector((state) => state.warehouse.creating || false);
  const createError = useSelector((state) => state.warehouse.createError);

  // Отслеживаем ошибки из Redux
  useEffect(() => {
    if (createError) {
      setError(
        createError?.detail ||
        createError?.message ||
        typeof createError === "string" ? createError : "Не удалось создать склад"
      );
    } else {
      setError("");
    }
  }, [createError]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError("Название склада обязательно");
      return;
    }

    setError("");

    try {
      await onCreate(formData);
      // При успешном создании (unwrap() не выбросил ошибку) закрываем модальное окно
      onClose();
      setFormData({ name: "", address: "" });
      setError("");
    } catch (err) {
      // Ошибка уже обработана через Redux и отображена через useEffect
      // Модальное окно остается открытым для исправления ошибки
    }
  };

  return (
    <div className="warehouse-filter-overlay" onClick={onClose}>
      <div
        className="warehouse-filter-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="warehouse-filter-modal__header">
          <h2 className="warehouse-filter-modal__title">Создать склад</h2>
          <button
            className="warehouse-filter-modal__close"
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="warehouse-filter-modal__content">
            {error && (
              <div
                style={{
                  padding: "12px",
                  background: "#fee",
                  color: "#c33",
                  borderRadius: "8px",
                  marginBottom: "16px",
                }}
              >
                {error}
              </div>
            )}

            <div className="warehouse-filter-modal__section">
              <label className="warehouse-filter-modal__label">
                Наименование *
              </label>
              <input
                type="text"
                name="name"
                className="warehouse-filter-modal__select"
                placeholder="Введите название склада"
                value={formData.name}
                onChange={handleChange}
                required
                disabled={creating}
              />
            </div>

            <div className="warehouse-filter-modal__section">
              <label className="warehouse-filter-modal__label">Адрес</label>
              <input
                type="text"
                name="address"
                className="warehouse-filter-modal__select"
                placeholder="Введите адрес склада"
                value={formData.address}
                onChange={handleChange}
                disabled={creating}
              />
            </div>
          </div>

          <div className="warehouse-filter-modal__footer">
            <button
              type="button"
              className="warehouse-filter-modal__cancel-btn"
              onClick={onClose}
              disabled={creating}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="warehouse-filter-modal__apply-btn"
              disabled={creating}
            >
              {creating ? "Создание..." : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateWarehouseModal;

