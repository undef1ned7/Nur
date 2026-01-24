import React, { useState, useMemo, useEffect } from "react";
import { FaTimes, FaTrash } from "react-icons/fa";
import api from "../../../../../api";
import BarberSelect from "../../common/BarberSelect";

const normalizeName = (s) =>
  String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const parseMoney = (raw) => {
  const cleaned = String(raw).replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
};

const focusFirstError = (errs) => {
  const order = ["name", "price"];
  const key = order.find((k) => errs[k]);
  if (!key) return;

  const el = document.getElementsByName(key)[0];
  if (el?.focus) el.focus();
};

const validateService = ({ name, price, services, currentService }) => {
  const alerts = [];
  const errs = {};
  const nn = normalizeName(name);

  if (!nn) {
    errs.name = true;
    alerts.push("Укажите название услуги.");
  } else {
    const duplicate = services.some(
      (s) =>
        normalizeName(s.name) === nn &&
        (!currentService?.id || s.id !== currentService.id)
    );
    if (duplicate) {
      errs.name = true;
      alerts.push("Услуга с таким названием уже существует.");
    }
  }

  if (String(price).trim() === "") {
    errs.price = true;
    alerts.push("Укажите цену.");
  }

  const priceNum = parseMoney(price);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    errs.price = true;
    alerts.push("Цена должна быть неотрицательным числом.");
  }

  return {
    errs,
    alerts,
    priceNum: Number.isFinite(priceNum) ? priceNum : 0,
  };
};

const ServiceModal = ({
  isOpen,
  currentService,
  categories,
  services,
  onClose,
  onSaved,
  onDeleted,
}) => {
  const [fieldErrors, setFieldErrors] = useState({});
  const [modalAlerts, setModalAlerts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");

  // Обновляем категорию при смене услуги
  useEffect(() => {
    setSelectedCategory(currentService?.categoryId ? String(currentService.categoryId) : "");
  }, [currentService]);

  if (!isOpen) return null;

  const safeCategories = Array.isArray(categories) ? categories : [];
  const currentCategoryId = currentService?.categoryId ?? "";
  const categoriesForSelect = safeCategories.filter((c) => {
    if (c.active) return true;
    return String(c.id) === String(currentCategoryId);
  });

  // Опции для BarberSelect
  const categoryOptions = [
    { value: "", label: "Без категории" },
    ...categoriesForSelect.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  const handleClose = () => {
    if (saving || deleting) return;
    setFieldErrors({});
    setModalAlerts([]);
    setConfirmDelete(false);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get("name") || "").toString().trim();
    const priceStr = (fd.get("price") || "").toString().trim();
    const active = fd.get("active") === "on";
    const time = (fd.get("time") || "").toString().trim();
    const categoryId = (fd.get("category") || "").toString().trim();

    const { errs, alerts, priceNum } = validateService({
      name,
      price: priceStr,
      services,
      currentService,
    });

    if (alerts.length) {
      setFieldErrors(errs);
      setModalAlerts(["Исправьте ошибки в форме.", ...alerts]);
      focusFirstError(errs);
      return;
    }

    try {
      setSaving(true);
      setModalAlerts([]);

      const payload = {
        name,
        price: priceNum,
        is_active: active,
        time: time || null,
        category: categoryId ? categoryId : null,
        company: localStorage.getItem("company"),
      };

      let createdId = null;

      if (currentService?.id) {
        await api.patch(
          `/barbershop/services/${encodeURIComponent(currentService.id)}/`,
          payload
        );
      } else {
        const { data: created } = await api.post("/barbershop/services/", payload);
        createdId = created?.id || null;
      }

      onSaved(createdId);
    } catch (e2) {
      const data = e2?.response?.data;
      const msgs = [];
      if (typeof data === "string") msgs.push(data);
      else if (data && typeof data === "object") {
        Object.values(data).forEach((v) =>
          msgs.push(String(Array.isArray(v) ? v[0] : v))
        );
      }
      if (!msgs.length) msgs.push("Не удалось сохранить услугу.");
      setModalAlerts(msgs);
      console.error(e2);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentService?.id) return;
    const id = encodeURIComponent(currentService.id);

    try {
      setDeleting(true);
      setModalAlerts([]);

      try {
        await api.delete(`/barbershop/services/${id}/`);
      } catch (err) {
        const st = err?.response?.status;
        if (st === 404 || st === 405 || st === 301 || st === 302) {
          await api.delete(`/barbershop/services/${id}`);
        } else {
          throw err;
        }
      }

      onDeleted();
    } catch (e) {
      const data = e?.response?.data;
      const msg =
        typeof data === "string"
          ? data
          : data?.detail || "Не удалось удалить услугу.";
      setModalAlerts([msg]);
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="barberservices__overlay" onClick={handleClose}>
      <div
        className="barberservices__modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="barberservices__modalHeader">
          <h3 className="barberservices__modalTitle">
            {currentService ? "Редактировать услугу" : "Новая услуга"}
          </h3>
          <button
            className="barberservices__iconBtn"
            onClick={handleClose}
            aria-label="Закрыть"
            title="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        {modalAlerts.length > 0 && (
          <div className="barberservices__alert barberservices__alert--inModal">
            {modalAlerts.length === 1 ? (
              modalAlerts[0]
            ) : (
              <ul className="barberservices__alertList">
                {modalAlerts.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <form className="barberservices__form" onSubmit={handleSubmit} noValidate>
          <div className="barberservices__grid">
            <label
              className={
                fieldErrors.name
                  ? "barberservices__field barberservices__field--invalid"
                  : "barberservices__field"
              }
            >
              <span className="barberservices__label">
                Название <b className="barberservices__req">*</b>
              </span>
              <input
                name="name"
                defaultValue={currentService?.name || ""}
                className={
                  fieldErrors.name
                    ? "barberservices__input barberservices__input--invalid"
                    : "barberservices__input"
                }
                placeholder="Например: Стрижка"
                autoFocus
                required
              />
            </label>

            <label
              className={
                fieldErrors.price
                  ? "barberservices__field barberservices__field--invalid"
                  : "barberservices__field"
              }
            >
              <span className="barberservices__label">
                Цена <b className="barberservices__req">*</b>
              </span>
              <input
                name="price"
                defaultValue={
                  currentService?.price !== undefined ? String(currentService.price) : ""
                }
                className={
                  fieldErrors.price
                    ? "barberservices__input barberservices__input--invalid"
                    : "barberservices__input"
                }
                placeholder="0"
                inputMode="decimal"
              />
            </label>

            <label className="barberservices__field">
              <span className="barberservices__label">Длительность</span>
              <input
                name="time"
                defaultValue={currentService?.time || ""}
                className="barberservices__input"
                placeholder="45 мин"
                list="durationSuggestions"
              />
              <datalist id="durationSuggestions">
                <option value="15 мин" />
                <option value="30 мин" />
                <option value="45 мин" />
                <option value="1 час" />
                <option value="1 час 30 мин" />
                <option value="2 часа" />
              </datalist>
            </label>

            <div className="barberservices__field">
              <span className="barberservices__label">Категория</span>
              <input type="hidden" name="category" value={selectedCategory} />
              <BarberSelect
                value={selectedCategory}
                onChange={setSelectedCategory}
                options={categoryOptions}
                placeholder="Без категории"
              />
            </div>

            <div className="barberservices__field barberservices__field--switch">
              <span className="barberservices__label">Активна</span>
              <label className="barberservices__switch" title="Активность услуги">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={currentService?.active ?? true}
                />
                <span className="barberservices__slider" />
              </label>
            </div>
          </div>

          <div className="barberservices__footer">
            {currentService?.id ? (
              confirmDelete ? (
                <div className="barberservices__confirm">
                  <span className="barberservices__confirmText">
                    Удалить «{currentService.name}» безвозвратно?
                  </span>
                  <div className="barberservices__confirmActions">
                    <button
                      type="button"
                      className="barberservices__btn barberservices__btn--secondary"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      className="barberservices__btn barberservices__btn--danger"
                      onClick={handleDelete}
                      disabled={deleting}
                      title="Удалить навсегда"
                    >
                      <FaTrash />
                      <span className="barberservices__btnText">
                        {deleting ? "Удаление…" : "Удалить"}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="barberservices__btn barberservices__btn--danger"
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleting || saving}
                  title="Удалить услугу"
                >
                  <FaTrash />
                  <span className="barberservices__btnText">Удалить</span>
                </button>
              )
            ) : (
              <span className="barberservices__spacer" />
            )}

            <div className="barberservices__footerRight">
              <button
                type="button"
                className="barberservices__btn barberservices__btn--secondary"
                onClick={handleClose}
                disabled={saving || deleting}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="barberservices__btn barberservices__btn--primary"
                disabled={saving || deleting}
              >
                {saving ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServiceModal;
