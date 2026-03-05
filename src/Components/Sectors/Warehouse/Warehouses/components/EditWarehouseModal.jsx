import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { X } from "lucide-react";
import "../Warehouses.scss";
import { updateWarehouseAsync } from "../../../../../store/creators/warehouseCreators";

/**
 * Модальное окно для редактирования склада
 */
const EditWarehouseModal = ({ warehouse, onClose }) => {
  const dispatch = useDispatch();

  const [formData, setFormData] = useState({
    name: warehouse?.name || warehouse?.title || "",
    location: warehouse?.address || warehouse?.location || "",
  });
  const [error, setError] = useState("");

  const updating = useSelector((state) => state.warehouse.updating || false);
  const updateError = useSelector((state) => state.warehouse.updateError);

  useEffect(() => {
    if (updateError) {
      setError(
        updateError?.detail ||
          updateError?.message ||
          (typeof updateError === "string"
            ? updateError
            : "Не удалось обновить склад"),
      );
    } else {
      setError("");
    }
  }, [updateError]);

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
      await dispatch(
        updateWarehouseAsync({
          warehouseId: warehouse.id,
          updatedData: {
            name: formData.name.trim(),
            location: formData.location.trim(),
          },
        }),
      ).unwrap();
      onClose();
    } catch {
      // Ошибка уже обработана через Redux и отразится в updateError
    }
  };

  return (
    <div className="warehouse-filter-overlay" onClick={onClose}>
      <div
        className="warehouse-filter-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="warehouse-filter-modal__header">
          <h2 className="warehouse-filter-modal__title">Редактировать склад</h2>
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
                disabled={updating}
              />
            </div>

            <div className="warehouse-filter-modal__section">
              <label className="warehouse-filter-modal__label">Адрес</label>
              <input
                type="text"
                name="location"
                className="warehouse-filter-modal__select"
                placeholder="Введите адрес склада"
                value={formData.location}
                onChange={handleChange}
                disabled={updating}
              />
            </div>
          </div>

          <div className="warehouse-filter-modal__footer">
            <button
              type="button"
              className="warehouse-filter-modal__cancel-btn"
              onClick={onClose}
              disabled={updating}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="warehouse-filter-modal__apply-btn"
              disabled={updating}
            >
              {updating ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditWarehouseModal;

