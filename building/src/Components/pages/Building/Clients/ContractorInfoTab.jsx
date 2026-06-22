import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { useAlert } from "@/hooks/useDialog";
import { updateBuildingContractor } from "@/store/creators/building/contractorsCreators";
import { validateResErrors } from "../../../../../tools/validateResErrors";

const CONTRACTOR_TYPE_LABELS = {
  subcontractor: "Субподрядчик",
  general_contractor: "Генподрядчик",
  other: "Другой",
};

const STATUS_LABELS = {
  active: "Активен",
  inactive: "Неактивен",
};

const buildFormFromContractor = (contractor) => ({
  company_name: contractor.company_name || "",
  contractor_type: contractor.contractor_type || "",
  tax_id: contractor.tax_id || "",
  registration_number: contractor.registration_number || "",
  year_founded: contractor.year_founded ?? "",
  contact_person: contractor.contact_person || "",
  phone: contractor.phone || "",
  email: contractor.email || "",
  city: contractor.city || "",
  address: contractor.address || "",
  employees: contractor.employees ?? "",
  status: contractor.status || "active",
});

export default function ContractorInfoTab({ contractor }) {
  if (!contractor) return null;

  const dispatch = useDispatch();
  const alert = useAlert();

  const [form, setForm] = useState(() => buildFormFromContractor(contractor));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const contractorId = contractor.id ?? contractor.uuid;

  const handleChange = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleNumberChange = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm(buildFormFromContractor(contractor));
    setError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!contractorId) return;

    const payload = {
      ...form,
      year_founded:
        form.year_founded && !Number.isNaN(Number(form.year_founded))
          ? Number(form.year_founded)
          : null,
      employees:
        form.employees && !Number.isNaN(Number(form.employees))
          ? Number(form.employees)
          : null,
    };

    try {
      setSaving(true);
      setError(null);
      const res = await dispatch(
        updateBuildingContractor({ id: contractorId, data: payload }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        alert("Подрядчик обновлён");
        setIsEditing(false);
      } else {
        setError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось сохранить подрядчика",
          ),
        );
      }
    } catch (err) {
      setError(
        validateResErrors(err, "Не удалось сохранить подрядчика"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="sell-form client-detail__form" onSubmit={handleSave}>
      <section className="sell-form__section">
        <div className="sell-form__actions" style={{ marginBottom: 8 }}>
          {!isEditing ? (
            <button
              type="button"
              className="add-product-page__submit-btn"
              onClick={() => {
                resetForm();
                setIsEditing(true);
              }}
            >
              Редактировать
            </button>
          ) : (
            <>
              <button
                type="button"
                className="add-product-page__cancel-btn"
                onClick={() => {
                  resetForm();
                  setIsEditing(false);
                }}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="add-product-page__submit-btn"
                disabled={saving}
              >
                {saving ? "Сохранение..." : "Сохранить изменения"}
              </button>
            </>
          )}
        </div>
      </section>

      <section className="sell-form__section">
        <h4 className="sell-form__sectionTitle">Организация</h4>
        <div className="client-detail__row">
          <span className="sell-form__label">Название организации</span>
          <input
            className="add-product-page__input"
            value={form.company_name}
            onChange={handleChange("company_name")}
            required
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Тип подрядчика</span>
          <select
            className="add-product-page__input"
            value={form.contractor_type}
            onChange={handleChange("contractor_type")}
            disabled={!isEditing}
          >
            <option value="">Не выбрано</option>
            {Object.entries(CONTRACTOR_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">ИНН</span>
          <input
            className="add-product-page__input"
            value={form.tax_id}
            onChange={handleChange("tax_id")}
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Рег. номер</span>
          <input
            className="add-product-page__input"
            value={form.registration_number}
            onChange={handleChange("registration_number")}
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Год основания</span>
          <input
            className="add-product-page__input"
            type="number"
            min={0}
            value={form.year_founded}
            onChange={handleNumberChange("year_founded")}
            disabled={!isEditing}
          />
        </div>
      </section>

      <section className="sell-form__section">
        <h4 className="sell-form__sectionTitle">Контакты и адрес</h4>
        <div className="client-detail__row">
          <span className="sell-form__label">Контактное лицо</span>
          <input
            className="add-product-page__input"
            value={form.contact_person}
            onChange={handleChange("contact_person")}
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Телефон</span>
          <input
            className="add-product-page__input"
            value={form.phone}
            onChange={handleChange("phone")}
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Email</span>
          <input
            className="add-product-page__input"
            type="email"
            value={form.email}
            onChange={handleChange("email")}
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Город</span>
          <input
            className="add-product-page__input"
            value={form.city}
            onChange={handleChange("city")}
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Адрес</span>
          <input
            className="add-product-page__input"
            value={form.address}
            onChange={handleChange("address")}
            disabled={!isEditing}
          />
        </div>
      </section>

      <section className="sell-form__section">
        <h4 className="sell-form__sectionTitle">Сотрудники и статус</h4>
        <div className="client-detail__row">
          <span className="sell-form__label">Кол-во сотрудников</span>
          <input
            className="add-product-page__input"
            type="number"
            min={0}
            value={form.employees}
            onChange={handleNumberChange("employees")}
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Статус</span>
          <select
            className="add-product-page__input"
            value={form.status}
            onChange={handleChange("status")}
            disabled={!isEditing}
          >
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="sell-form__section">
        <h4 className="sell-form__sectionTitle">Специализации</h4>
        {(!form.specializations || form.specializations.length === 0) && (
          <div className="client-detail__row">
            <span className="sell-form__label" />
            <span>Специализации не указаны.</span>
          </div>
        )}
        {Array.isArray(form.specializations) &&
          form.specializations.map((spec, idx) => (
            <div className="client-detail__row" key={idx}>
              <span className="sell-form__label">
                Специализация #{idx + 1}
              </span>
              <div style={{ display: "flex", gap: 8, flex: 1 }}>
                <input
                  className="add-product-page__input"
                  value={spec || ""}
                  onChange={handleSpecializationChange(idx)}
                  disabled={!isEditing}
                  placeholder="Например, Монолитные работы"
                  style={{ flex: 1 }}
                />
                {isEditing && (
                  <button
                    type="button"
                    className="add-product-page__cancel-btn"
                    onClick={handleRemoveSpecialization(idx)}
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>
          ))}
        {isEditing && (
          <div className="client-detail__row">
            <span className="sell-form__label" />
            <button
              type="button"
              className="add-product-page__submit-btn"
              onClick={handleAddSpecialization}
            >
              Добавить специализацию
            </button>
          </div>
        )}
      </section>

      <section className="sell-form__section">
        <h4 className="sell-form__sectionTitle">Оборудование</h4>
        {(!form.equipment || form.equipment.length === 0) && (
          <div className="client-detail__row">
            <span className="sell-form__label" />
            <span>Оборудование не указано.</span>
          </div>
        )}
        {Array.isArray(form.equipment) && form.equipment.length > 0 && (
          <div className="client-detail__row">
            <span className="sell-form__label" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <table className="client-detail__table">
                <thead>
                  <tr>
                    <th>Наименование</th>
                    <th>Модель</th>
                    <th>Кол-во</th>
                    <th>Состояние</th>
                    {isEditing && <th />}
                  </tr>
                </thead>
                <tbody>
                  {form.equipment.map((eq, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          className="add-product-page__input"
                          value={eq.name || ""}
                          onChange={handleEquipmentFieldChange(idx, "name")}
                          disabled={!isEditing}
                          placeholder="Экскаватор"
                        />
                      </td>
                      <td>
                        <input
                          className="add-product-page__input"
                          value={eq.model || ""}
                          onChange={handleEquipmentFieldChange(idx, "model")}
                          disabled={!isEditing}
                          placeholder="CAT 320D"
                        />
                      </td>
                      <td>
                        <input
                          className="add-product-page__input"
                          type="number"
                          min={0}
                          value={eq.quantity ?? ""}
                          onChange={handleEquipmentFieldChange(idx, "quantity")}
                          disabled={!isEditing}
                        />
                      </td>
                      <td>
                        <input
                          className="add-product-page__input"
                          value={eq.condition || ""}
                          onChange={handleEquipmentFieldChange(
                            idx,
                            "condition",
                          )}
                          disabled={!isEditing}
                          placeholder="good / excellent"
                        />
                      </td>
                      {isEditing && (
                        <td>
                          <button
                            type="button"
                            className="add-product-page__cancel-btn"
                            onClick={handleRemoveEquipment(idx)}
                          >
                            Удалить
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {isEditing && (
          <div className="client-detail__row">
            <span className="sell-form__label" />
            <button
              type="button"
              className="add-product-page__submit-btn"
              onClick={handleAddEquipment}
            >
              Добавить оборудование
            </button>
          </div>
        )}
      </section>

      {error && (
        <div className="building-page__error" style={{ marginTop: 8 }}>
          {String(error)}
        </div>
      )}
    </form>
  );
}

