import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { X } from "lucide-react";
import { createWarehouseCounterparty } from "../../../../../store/creators/warehouseThunk";
import { useUser } from "../../../../../store/slices/userSlice";
import "../Counterparties.scss";

/** Роль агента: контрагент при создании автоматически привязывается к текущему пользователю на бэкенде */
const isAgentRole = (profile) =>
  profile && profile.role !== "owner" && profile.role !== "admin";

/**
 * Модальное окно для создания контрагента
 */
const CreateCounterpartyModal = ({ onClose }) => {
  const dispatch = useDispatch();
  const { profile } = useUser() || {};
  const [formData, setFormData] = useState({
    name: "",
    type: "CLIENT",
  });
  const [error, setError] = useState("");
  const [localError, setLocalError] = useState("");

  // Получаем состояние создания из Redux
  const creating = useSelector((state) => state.counterparty.creating || false);
  const createError = useSelector((state) => state.counterparty.createError);

  // Отслеживаем ошибки из Redux
  useEffect(() => {
    if (createError) {
      setError(
        createError?.detail ||
          createError?.message ||
          typeof createError === "string"
          ? createError
          : "Не удалось создать контрагента"
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
    if (error || localError) {
      setError("");
      setLocalError("");
    }
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setLocalError("Название контрагента обязательно");
      return false;
    }

    if (formData.name.trim().length < 1) {
      setLocalError("Название должно содержать хотя бы 1 символ");
      return false;
    }

    if (formData.name.trim().length > 255) {
      setLocalError("Название не должно превышать 255 символов");
      return false;
    }

    if (!formData.type) {
      setLocalError("Тип контрагента обязателен");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setError("");
    setLocalError("");

    try {
      await dispatch(
        createWarehouseCounterparty({
          name: formData.name.trim(),
          type: formData.type,
        })
      ).unwrap();

      // При успешном создании закрываем модальное окно
      // Список обновится автоматически через Redux slice
      onClose();
      setFormData({ name: "", type: "CLIENT" });
      setError("");
      setLocalError("");
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
          <h2 className="warehouse-filter-modal__title">Создать контрагента</h2>
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
            {(error || localError) && (
              <div
                style={{
                  padding: "12px",
                  background: "#fee",
                  color: "#c33",
                  borderRadius: "8px",
                  marginBottom: "16px",
                }}
              >
                {error || localError}
              </div>
            )}

            <div className="warehouse-filter-modal__section">
              <label className="warehouse-filter-modal__label">
                Название *
              </label>
              <input
                type="text"
                name="name"
                className="warehouse-filter-modal__select"
                placeholder="Введите название контрагента"
                value={formData.name}
                onChange={handleChange}
                required
                minLength={1}
                maxLength={255}
                disabled={creating}
              />
            </div>

            <div className="warehouse-filter-modal__section">
              <label className="warehouse-filter-modal__label">Тип *</label>
              <select
                name="type"
                className="warehouse-filter-modal__select"
                value={formData.type}
                onChange={handleChange}
                required
                disabled={creating}
              >
                <option value="CLIENT">Клиент</option>
                <option value="SUPPLIER">Поставщик</option>
                <option value="BOTH">Клиент и поставщик</option>
              </select>
            </div>

            {isAgentRole(profile) && (
              <div
                className="warehouse-filter-modal__section"
                style={{
                  padding: "10px 12px",
                  background: "var(--color-info-bg, #e8f4fd)",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "var(--color-info-text, #0c5460)",
                }}
              >
                Контрагент будет привязан к вам (агент).
              </div>
            )}
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

export default CreateCounterpartyModal;

