import React, { useState, useEffect } from "react";
import { FaTimes, FaTrash } from "react-icons/fa";
import api from "../../../../../api";
import BarberSelect from "../../common/BarberSelect";
import ReactPortal from "../../../../common/Portal/ReactPortal";
import ConfirmModal from "../../../../common/ConfirmModal/ConfirmModal";

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
    alerts.push("Введите название.");
  } else {
    const duplicate = services.some(
      (s) =>
        normalizeName(s.name) === nn &&
        (!currentService?.id || s.id !== currentService.id)
    );
    if (duplicate) {
      errs.name = true;
      alerts.push("Такая услуга уже есть.");
    }
  }

  if (String(price).trim() === "") {
    errs.price = true;
    alerts.push("Введите цену.");
  }

  const priceNum = parseMoney(price);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    errs.price = true;
    alerts.push("Цена должна быть числом.");
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
    { value: "", label: "Общее" },
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
      if (!msgs.length) msgs.push("Ошибка сохранения.");
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
          : data?.detail || "Ошибка удаления.";
      setModalAlerts([msg]);
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <ReactPortal wrapperId="barber-service-modal">
        <div 
          className="barberservices__overlay" 
          onClick={handleClose} 
          style={{ 
            opacity: confirmDelete ? 0 : 1,
            pointerEvents: confirmDelete ? 'none' : 'auto',
            transition: 'opacity 0.2s ease'
          }}
        >
          <div
            className="barberservices__modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="barberservices__modalHeader">
              <h3 className="barberservices__modalTitle">
                {currentService ? "Редактировать" : "Новая услуга"}
              </h3>
              <button
                type="button"
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
                    placeholder="Стрижка"
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
                    placeholder="500"
                    inputMode="decimal"
                  />
                </label>

                <label className="barberservices__field">
                  <span className="barberservices__label">Длительность (мин)</span>
                  <input
                    name="time"
                    type="text"
                    defaultValue={currentService?.time || ""}
                    className="barberservices__input"
                    placeholder="30"
                    inputMode="numeric"
                  />
                </label>

                <div className="barberservices__field">
                  <span className="barberservices__label">Категория</span>
                  <input type="hidden" name="category" value={selectedCategory} />
                  <BarberSelect
                    value={selectedCategory}
                    onChange={setSelectedCategory}
                    options={categoryOptions}
                    placeholder="Не выбрана"
                  />
                </div>

                <div className="barberservices__field barberservices__field--switch">
                  <span className="barberservices__label">Активна</span>
                  <label className="barberservices__switch" title="Активность">
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
      </ReactPortal>

      <ConfirmModal
        isOpen={confirmDelete}
        message={`Удалить услугу «${currentService?.name}» безвозвратно?`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
};

export default ServiceModal;
