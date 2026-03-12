import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useAlert } from "@/hooks/useDialog";
import { createBuildingSupplier } from "@/store/creators/building/suppliersCreators";
import { validateResErrors } from "../../../../../tools/validateResErrors";

const INITIAL_FORM = {
  company_name: "",
  supplier_type: "",
  tax_id: "",
  registration_number: "",
  year_founded: "",
  contact_person: "",
  position: "",
  phone: "",
  email: "",
  website: "",
  city: "",
  address: "",
  postal_code: "",
  rating: "",
  completed_orders: "",
  status: "active",
};

const SUPPLIER_TYPE_OPTIONS = [
  { value: "materials_supplier", label: "Поставщик материалов" },
  { value: "equipment_supplier", label: "Поставщик оборудования" },
  { value: "other", label: "Другое" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Активен" },
  { value: "inactive", label: "Неактивен" },
];

export default function SupplierCreatePage() {
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
      completed_orders:
        form.completed_orders && !Number.isNaN(Number(form.completed_orders))
          ? Number(form.completed_orders)
          : 0,
      rating:
        form.rating && !Number.isNaN(Number(form.rating))
          ? String(form.rating)
          : null,
    };

    try {
      setSubmitting(true);
      const res = await dispatch(createBuildingSupplier(payload));
      if (res.meta.requestStatus === "fulfilled") {
        alert("Поставщик успешно создан");
        navigate("/crm/building/clients?tab=suppliers");
      } else {
        setError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось создать поставщика",
          ),
        );
      }
    } catch (err) {
      setError(
        validateResErrors(err, "Не удалось создать поставщика"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="building-page building-page--clients">
      <header className="sell-header">
        <div className="sell-header__content">
          <h1 className="sell-header__title">Новый поставщик</h1>
          <p className="sell-header__subtitle">
            Заполните карточку поставщика. Поля с * обязательны к заполнению.
          </p>
        </div>
        <button
          type="button"
          className="sell-header__btn sell-header__btn--secondary"
          onClick={() => navigate("/crm/building/clients?tab=suppliers")}
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
                placeholder="ООО «СтройСнаб»"
                maxLength={255}
              />
            </div>

            <div className="sell-form__row">
              <label className="sell-form__label">Тип поставщика</label>
              <select
                className="add-product-page__input"
                value={form.supplier_type}
                onChange={handleChange("supplier_type")}
              >
                <option value="">Не выбрано</option>
                {SUPPLIER_TYPE_OPTIONS.map((opt) => (
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
              <label className="sell-form__label">Должность</label>
              <input
                className="add-product-page__input"
                value={form.position}
                onChange={handleChange("position")}
                maxLength={128}
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

            <div className="sell-form__row">
              <label className="sell-form__label">Сайт</label>
              <input
                className="add-product-page__input"
                value={form.website}
                onChange={handleChange("website")}
                maxLength={200}
                placeholder="https://example.com"
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
              <label className="sell-form__label">Индекс</label>
              <input
                className="add-product-page__input"
                value={form.postal_code}
                onChange={handleChange("postal_code")}
                maxLength={32}
              />
            </div>

            <div className="sell-form__row">
              <label className="sell-form__label">Рейтинг</label>
              <input
                className="add-product-page__input"
                value={form.rating}
                onChange={handleChange("rating")}
                placeholder="Например, 4.5"
              />
            </div>

            <div className="sell-form__row">
              <label className="sell-form__label">Выполнено заказов</label>
              <input
                type="number"
                className="add-product-page__input"
                value={form.completed_orders}
                onChange={handleChange("completed_orders")}
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
              onClick={() => navigate("/crm/building/clients?tab=suppliers")}
              disabled={submitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="add-product-page__submit-btn"
              disabled={submitting}
            >
              {submitting ? "Сохранение..." : "Создать поставщика"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

