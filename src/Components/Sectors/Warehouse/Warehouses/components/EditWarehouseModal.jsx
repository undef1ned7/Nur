import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { X } from "lucide-react";
import "../Warehouses.scss";
import { parseDrfErrors } from "../../utils/drfErrors";
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
  // Ошибки по полям: клиентская валидация + ответ сервера DRF {field: [msg]}
  const [fieldErrors, setFieldErrors] = useState({});

  const updating = useSelector((state) => state.warehouse.updating || false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (error) setError("");
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validate = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = "Название склада обязательно";
    if (!formData.location.trim()) errors.location = "Адрес склада обязателен";
    return errors;
  };

  const applyServerError = (err) => {
    const { fieldErrors: serverFieldErrors, message } = parseDrfErrors(err, [
      "name",
      "location",
      "address",
    ]);
    if (serverFieldErrors.address && !serverFieldErrors.location) {
      serverFieldErrors.location = serverFieldErrors.address;
    }
    delete serverFieldErrors.address;
    setFieldErrors(serverFieldErrors);
    const hasFieldErrors = Object.keys(serverFieldErrors).length > 0;
    setError(
      message ||
        (hasFieldErrors
          ? "Проверьте выделенные поля"
          : "Не удалось обновить склад"),
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("");
      return;
    }

    setError("");
    setFieldErrors({});

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
    } catch (err) {
      applyServerError(err);
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

        <form onSubmit={handleSubmit} noValidate>
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
                aria-invalid={!!fieldErrors.name}
                style={
                  fieldErrors.name ? { borderColor: "#ef4444" } : undefined
                }
              />
              {fieldErrors.name && (
                <p style={{ color: "#c33", fontSize: 12, marginTop: 4 }}>
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div className="warehouse-filter-modal__section">
              <label className="warehouse-filter-modal__label">Адрес *</label>
              <input
                type="text"
                name="location"
                className="warehouse-filter-modal__select"
                placeholder="Введите адрес склада"
                value={formData.location}
                onChange={handleChange}
                required
                disabled={updating}
                aria-invalid={!!fieldErrors.location}
                style={
                  fieldErrors.location ? { borderColor: "#ef4444" } : undefined
                }
              />
              {fieldErrors.location && (
                <p style={{ color: "#c33", fontSize: 12, marginTop: 4 }}>
                  {fieldErrors.location}
                </p>
              )}
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
