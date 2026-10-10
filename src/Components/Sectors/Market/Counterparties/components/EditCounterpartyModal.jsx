import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { X } from "lucide-react";
import { useUser } from "../../../../../store/slices/userSlice";
import { fetchEmployeesAsync } from "../../../../../store/creators/employeeCreators";
import { updateWarehouseCounterparty } from "../../../../../store/creators/warehouseThunk";
import CounterpartyLegalFields from "./CounterpartyLegalFields";
import CounterpartyBankAccountsFields from "./CounterpartyBankAccountsFields";
import {
  bankAccountsFromCounterparty,
  buildBankAccountsPayload,
} from "../counterpartyBankAccounts";
import {
  INLINE_ERROR_FIELDS,
  parseCounterpartyApiError,
  scrollToFormError,
  validateCounterpartyForm,
} from "../counterpartyFormValidation";
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
    inn: counterparty?.inn || "",
    okpo: counterparty?.okpo || "",
    address: counterparty?.address || "",
  });
  const [bankAccounts, setBankAccounts] = useState(() =>
    bankAccountsFromCounterparty(counterparty),
  );

  const [error, setError] = useState("");
  const [localError, setLocalError] = useState("");
  // Ошибки у конкретных полей (B25): показываем под полем и прокручиваем к нему
  const [fieldErrors, setFieldErrors] = useState({});
  const formRef = useRef(null);

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
      const parsed = parseCounterpartyApiError(
        updateError,
        "Не удалось обновить контрагента",
      );
      setError(parsed.message);
      setFieldErrors(parsed.fieldErrors);
      scrollToFormError(
        formRef.current,
        parsed.message ? null : Object.keys(parsed.fieldErrors)[0],
      );
    } else {
      setError("");
      setFieldErrors({});
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
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validateForm = () => {
    const invalid = validateCounterpartyForm(formData, bankAccounts);
    if (!invalid) return true;
    const isInputField = INLINE_ERROR_FIELDS.includes(invalid.field);
    setLocalError(isInputField ? "" : invalid.message);
    setFieldErrors(isInputField ? { [invalid.field]: invalid.message } : {});
    scrollToFormError(formRef.current, isInputField ? invalid.field : null);
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!counterparty?.id) return;

    if (!validateForm()) {
      return;
    }

    setError("");
    setLocalError("");
    setFieldErrors({});

    try {
      const phoneTrim = (formData.phone || "").trim();
      const accounts = buildBankAccountsPayload(bankAccounts);
      const payload = {
        name: formData.name.trim(),
        type: formData.type,
        phone: phoneTrim || null,
        inn: (formData.inn || "").trim(),
        okpo: (formData.okpo || "").trim(),
        address: (formData.address || "").trim(),
        bank_accounts: accounts,
      };
      if (accounts[0]) {
        payload.score = accounts[0].score;
        payload.bik = accounts[0].bik;
      } else {
        payload.score = "";
        payload.bik = "";
      }

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

        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          <div className="warehouse-filter-modal__content">
            {(error || localError) && (
              <div
                data-form-error
                role="alert"
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
                aria-invalid={Boolean(fieldErrors.name)}
                className="warehouse-filter-modal__select"
                placeholder="Введите название контрагента"
                value={formData.name}
                onChange={handleChange}
                required
                minLength={1}
                maxLength={255}
                disabled={updating}
              />
              {fieldErrors.name && (
                <div className="counterparty-form__field-error" role="alert">
                  {fieldErrors.name}
                </div>
              )}
            </div>

            <div className="warehouse-filter-modal__section">
              <label className="warehouse-filter-modal__label">
                Номер телефона
              </label>
              <input
                type="tel"
                name="phone"
                aria-invalid={Boolean(fieldErrors.phone)}
                className="warehouse-filter-modal__select"
                placeholder="Введите номер телефона (необязательно)"
                value={formData.phone}
                onChange={handleChange}
                disabled={updating}
                autoComplete="tel"
              />
              {fieldErrors.phone && (
                <div className="counterparty-form__field-error" role="alert">
                  {fieldErrors.phone}
                </div>
              )}
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

            <CounterpartyLegalFields
              formData={formData}
              onChange={handleChange}
              disabled={updating}
            />

            <CounterpartyBankAccountsFields
              bankAccounts={bankAccounts}
              onChange={setBankAccounts}
              disabled={updating}
            />

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

