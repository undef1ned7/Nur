import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useAlert } from "@/hooks/useDialog";
import { createBuildingContractor } from "@/store/creators/building/contractorsCreators";
import { validateResErrors } from "../../../../../tools/validateResErrors";

const INITIAL_FORM = {
  company_name: "",
  contractor_type: "",
  tax_id: "",
  registration_number: "",
  year_founded: "",
  contact_person: "",
  phone: "",
  email: "",
  city: "",
  address: "",
  employees: "",
  status: "active",
};

const CONTRACTOR_TYPE_OPTIONS = [
  { value: "subcontractor", label: "Субподрядчик" },
  { value: "general_contractor", label: "Генподрядчик" },
  { value: "other", label: "Другое" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Активен" },
  { value: "inactive", label: "Неактивен" },
];

export default function ContractorCreatePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const alert = useAlert();

  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!String(form.company_name || "").trim()) {
      setError("Название организации обязательно");
      return;
    }

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
      setSubmitting(true);
      const res = await dispatch(createBuildingContractor(payload));
      if (res.meta.requestStatus === "fulfilled") {
        alert("Подрядчик успешно создан");
        navigate("/crm/building/clients?tab=contractors");
      } else {
        setError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось создать подрядчика",
          ),
        );
      }
    } catch (err) {
      setError(
        validateResErrors(err, "Не удалось создать подрядчика"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="building-page building-page--clients">
      <header className="sell-header">
        <div className="sell-header__content">
          <h1 className="sell-header__title">Новый подрядчик</h1>
          <p className="sell-header__subtitle">
            Заполните карточку подрядчика. Поля с * обязательны к заполнению.
          </p>
        </div>
        <button
          type="button"
          className="sell-header__btn sell-header__btn--secondary"
          onClick={() => navigate("/crm/building/clients?tab=contractors")}
          disabled={submitting}
        >
          Отмена
        </button>
      </header>

      <div className="sell-card client-detail__section">
        <form className="sell-form" onSubmit={handleSubmit}>
          <section className="sell-form__section">
            <h4 className="sell-form__sectionTitle">Основная информация</h4>

            <div className="sell-form__row">
              <label className="sell-form__label">
                Название организации<span style={{ color: "red" }}>*</span>
              </label>
              <input
                className="add-product-page__input"
                value={form.company_name}
                onChange={handleChange("company_name")}
                placeholder="ООО «СтройПодряд»"
                maxLength={255}
              />
            </div>

            <div className="sell-form__row">
              <label className="sell-form__label">Тип подрядчика</label>
              <select
                className="add-product-page__input"
                value={form.contractor_type}
                onChange={handleChange("contractor_type")}
              >
                <option value="">Не выбрано</option>
                {CONTRACTOR_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sell-form__row">
              <label className="sell-form__label">ИНН</label>
              <input
                className="add-product-page__input"
                value={form.tax_id}
                onChange={handleChange("tax_id")}
                maxLength={32}
              />
            </div>

            <div className="sell-form__row">
              <label className="sell-form__label">Рег. номер</label>
              <input
                className="add-product-page__input"
                value={form.registration_number}
                onChange={handleChange("registration_number")}
                maxLength={64}
              />
            </div>

            <div className="sell-form__row">
              <label className="sell-form__label">Год основания</label>
              <input
                type="number"
                className="add-product-page__input"
                value={form.year_founded}
                onChange={handleChange("year_founded")}
                min={0}
              />
            </div>
          </section>

          <section className="sell-form__section">
            <h4 className="sell-form__sectionTitle">Контакты</h4>

            <div className="sell-form__row">
              <label className="sell-form__label">Контактное лицо</label>
              <input
                className="add-product-page__input"
                value={form.contact_person}
                onChange={handleChange("contact_person")}
                maxLength={255}
              />
            </div>

            <div className="sell-form__row">
              <label className="sell-form__label">Телефон</label>
              <input
                className="add-product-page__input"
                value={form.phone}
                onChange={handleChange("phone")}
                maxLength={64}
                placeholder="+996 ..."
              />
            </div>

            <div className="sell-form__row">
              <label className="sell-form__label">Email</label>
              <input
                type="email"
                className="add-product-page__input"
                value={form.email}
                onChange={handleChange("email")}
                maxLength={254}
                placeholder="mail@example.com"
              />
            </div>
          </section>

          <section className="sell-form__section">
            <h4 className="sell-form__sectionTitle">Адрес и статус</h4>

            <div className="sell-form__row">
              <label className="sell-form__label">Город</label>
              <input
                className="add-product-page__input"
                value={form.city}
                onChange={handleChange("city")}
                maxLength={128}
              />
            </div>

            <div className="sell-form__row">
              <label className="sell-form__label">Адрес</label>
              <input
                className="add-product-page__input"
                value={form.address}
                onChange={handleChange("address")}
                maxLength={512}
              />
            </div>

            <div className="sell-form__row">
              <label className="sell-form__label">Кол-во сотрудников</label>
              <input
                type="number"
                className="add-product-page__input"
                value={form.employees}
                onChange={handleChange("employees")}
                min={0}
              />
            </div>

            <div className="sell-form__row">
              <label className="sell-form__label">Статус</label>
              <select
                className="add-product-page__input"
                value={form.status}
                onChange={handleChange("status")}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {error && (
            <div className="building-page__error" style={{ marginTop: 12 }}>
              {String(error)}
            </div>
          )}

          <div className="sell-form__actions" style={{ marginTop: 20 }}>
            <button
              type="button"
              className="add-product-page__cancel-btn"
              onClick={() =>
                navigate("/crm/building/clients?tab=contractors")
              }
              disabled={submitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="add-product-page__submit-btn"
              disabled={submitting}
            >
              {submitting ? "Сохранение..." : "Создать подрядчика"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

