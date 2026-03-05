import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { X } from "lucide-react";
import { useUser } from "../../../../../store/slices/userSlice";
import { fetchEmployeesAsync } from "../../../../../store/creators/employeeCreators";
import { updateWarehouseCounterparty } from "../../../../../store/creators/warehouseThunk";
import "../Counterparties.scss";

const isAgentRole = (profile) =>
  profile && profile.role !== "owner" && profile.role !== "admin";

/**
 * Модальное окно для редактирования контрагента
 */
const EditCounterpartyModal = ({ counterparty, onClose }) => {
  const dispatch = useDispatch();
  const { profile } = useUser() || {};
  const isOwnerOrAdmin =
    profile?.role === "owner" || profile?.role === "admin";

  const initialAgent =
    counterparty?.agent && typeof counterparty.agent === "object"
      ? counterparty.agent.id ?? ""
      : counterparty?.agent ?? "";

  const [formData, setFormData] = useState({
    name: counterparty?.name || "",
    type: counterparty?.type || "CLIENT",
    phone: counterparty?.phone || "",
    agent: initialAgent || "",
  });

  const [error, setError] = useState("");
  const [localError, setLocalError] = useState("");

  const updating =
    useSelector((state) => state.counterparty.updating) || false;
  const updateError = useSelector((state) => state.counterparty.updateError);

  const {
    list: employees = [],
    loading: employeesLoading = false,
    error: employeesError = null,
  } = useSelector((state) => state.employee || {});

  useEffect(() => {
    if (updateError) {
      setError(
        updateError?.detail ||
          updateError?.message ||
          (typeof updateError === "string"
            ? updateError
            : "Не удалось обновить контрагента"),
      );
    } else {
      setError("");
    }
  }, [updateError]);

  useEffect(() => {
    if (!isOwnerOrAdmin) return;

    dispatch(
      fetchEmployeesAsync({
        page: 1,
        search: "",
      }),
    );
  }, [dispatch, isOwnerOrAdmin]);

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

    const phoneTrim = (formData.phone || "").trim();
    if (!phoneTrim) {
      setLocalError("Номер телефона обязателен");
      return false;
    }
    if (!/^\+?\d[\d\s\-()]{5,}$/.test(phoneTrim)) {
      setLocalError("Неверный формат телефона");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!counterparty?.id) return;

    if (!validateForm()) {
      return;
    }

    setError("");
    setLocalError("");

    try {
      const payload = {
        name: formData.name.trim(),
        type: formData.type,
        phone: formData.phone.trim(),
      };

      if (isOwnerOrAdmin && formData.agent) {
        payload.agent = formData.agent;
      }

      await dispatch(
        updateWarehouseCounterparty({
          id: counterparty.id,
          counterpartyData: payload,
        }),
      ).unwrap();

      onClose();
    } catch (err) {
      // Ошибка уже попала в Redux и будет показана через updateError
    }
  };

  return (
    <div className="warehouse-filter-overlay" onClick={onClose}>
      <div
        className="warehouse-filter-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="warehouse-filter-modal__header">
          <h2 className="warehouse-filter-modal__title">
            Редактировать контрагента
          </h2>
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
                disabled={updating}
              />
            </div>

            <div className="warehouse-filter-modal__section">
              <label className="warehouse-filter-modal__label">
                Номер телефона *
              </label>
              <input
                type="tel"
                name="phone"
                className="warehouse-filter-modal__select"
                placeholder="Введите номер телефона"
                value={formData.phone}
                onChange={handleChange}
                required
                disabled={updating}
                autoComplete="tel"
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
                disabled={updating}
              >
                <option value="CLIENT">Клиент</option>
                <option value="SUPPLIER">Поставщик</option>
                <option value="BOTH">Клиент и поставщик</option>
              </select>
            </div>

            {isOwnerOrAdmin && (
              <div className="warehouse-filter-modal__section">
                <label className="warehouse-filter-modal__label">
                  Агент (опционально)
                </label>
                <select
                  name="agent"
                  className="warehouse-filter-modal__select"
                  value={formData.agent}
                  onChange={handleChange}
                  disabled={updating || employeesLoading}
                >
                  <option value="">Без агента</option>
                  {Array.isArray(employees) &&
                    employees
                      .filter(
                        (e) =>
                          String(e.role) !== "owner" &&
                          String(e.role) !== "admin",
                      )
                      .map((e) => {
                        const label =
                          [e.last_name || "", e.first_name || ""]
                            .filter(Boolean)
                            .join(" ")
                            .trim() || e.email || "—";
                        return (
                          <option key={e.id} value={e.id}>
                            {label}
                          </option>
                        );
                      })}
                </select>
                {employeesLoading && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: "#555",
                    }}
                  >
                    Загрузка списка агентов…
                  </div>
                )}
                {employeesError && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: "#c33",
                    }}
                  >
                    {String(employeesError)}
                  </div>
                )}
              </div>
            )}

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
                Контрагент привязан к вам (агент).
              </div>
            )}
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

export default EditCounterpartyModal;

