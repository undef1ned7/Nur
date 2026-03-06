import React, { useState } from "react";
import { FaTimes, FaTrash } from "react-icons/fa";
import api from "../../../../../api";
import ReactPortal from "../../../../common/Portal/ReactPortal";
import ConfirmModal from "../../../../common/ConfirmModal/ConfirmModal";

const normalizeName = (s) =>
  String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const validateCategory = ({ name, categories, currentCategory }) => {
  const alerts = [];
  const errs = {};
  const nn = normalizeName(name);

  if (!nn) {
    errs.name = true;
    alerts.push("Введите название.");
  } else {
    const duplicate = categories.some(
      (c) =>
        normalizeName(c.name) === nn &&
        (!currentCategory?.id || c.id !== currentCategory.id)
    );
    if (duplicate) {
      errs.name = true;
      alerts.push("Такая категория уже есть.");
    }
  }

  return { errs, alerts };
};

const CategoryModal = ({
  isOpen,
  currentCategory,
  categories,
  onClose,
  onSaved,
  onDeleted,
}) => {
  const [catFieldErrors, setCatFieldErrors] = useState({});
  const [catAlerts, setCatAlerts] = useState([]);
  const [catSaving, setCatSaving] = useState(false);
  const [catDeleting, setCatDeleting] = useState(false);
  const [catConfirmDelete, setCatConfirmDelete] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (catSaving || catDeleting) return;
    setCatFieldErrors({});
    setCatAlerts([]);
    setCatConfirmDelete(false);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get("cat_name") || "").toString().trim();
    const active = fd.get("cat_active") === "on";

    const { errs, alerts } = validateCategory({
      name,
      categories,
      currentCategory,
    });

    if (alerts.length) {
      setCatFieldErrors(errs);
      setCatAlerts(["Исправьте ошибки в форме.", ...alerts]);
      return;
    }

    try {
      setCatSaving(true);
      setCatAlerts([]);

      const payload = {
        name,
        is_active: active,
        company: localStorage.getItem("company"),
      };

      if (currentCategory?.id) {
        await api.patch(
          `/barbershop/service-categories/${encodeURIComponent(
            currentCategory.id
          )}/`,
          payload
        );
      } else {
        await api.post("/barbershop/service-categories/", payload);
      }

      onSaved();
    } catch (err) {
      const data = err?.response?.data;
      const msgs = [];
      if (typeof data === "string") msgs.push(data);
      else if (data && typeof data === "object") {
        Object.values(data).forEach((v) =>
          msgs.push(String(Array.isArray(v) ? v[0] : v))
        );
      }
      if (!msgs.length) msgs.push("Ошибка сохранения.");
      setCatAlerts(msgs);
      console.error(err);
    } finally {
      setCatSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentCategory?.id) return;
    const id = encodeURIComponent(currentCategory.id);

    try {
      setCatDeleting(true);
      setCatAlerts([]);

      try {
        await api.delete(`/barbershop/service-categories/${id}/`);
      } catch (err) {
        const st = err?.response?.status;
        if (st === 404 || st === 405 || st === 301 || st === 302) {
          await api.delete(`/barbershop/service-categories/${id}`);
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
      setCatAlerts([msg]);
      console.error(e);
    } finally {
      setCatDeleting(false);
    }
  };

  return (
    <>
      <ReactPortal wrapperId="barber-category-modal">
        <div 
          className="barberservices__overlay" 
          onClick={handleClose} 
          style={{ 
            opacity: catConfirmDelete ? 0 : 1,
            pointerEvents: catConfirmDelete ? 'none' : 'auto',
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
                {currentCategory ? "Редактировать" : "Новая категория"}
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

            {catAlerts.length > 0 && (
              <div className="barberservices__alert barberservices__alert--inModal">
                {catAlerts.length === 1 ? (
                  catAlerts[0]
                ) : (
                  <ul className="barberservices__alertList">
                    {catAlerts.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <form
              className="barberservices__form"
              onSubmit={handleSubmit}
              noValidate
            >
              <div className="barberservices__grid">
                <label
                  className={`${
                    catFieldErrors.name
                      ? "barberservices__field barberservices__field--invalid"
                      : "barberservices__field"
                  }`}
                  style={{ gridColumn: "1 / -1" }}
                >
                  <span className="barberservices__label">
                    Название <b className="barberservices__req">*</b>
                  </span>
                  <input
                    name="cat_name"
                    defaultValue={currentCategory?.name || ""}
                    className={`${
                      catFieldErrors.name
                        ? "barberservices__input barberservices__input--invalid"
                        : "barberservices__input"
                    }`}
                    placeholder="Волосы"
                    autoFocus
                    required
                  />
                </label>

                <div
                  className="barberservices__field barberservices__field--switch"
                  style={{ gridColumn: "1 / -1" }}
                >
                  <span className="barberservices__label">Активна</span>
                  <label
                    className="barberservices__switch"
                    title="Активность"
                  >
                    <input
                      type="checkbox"
                      name="cat_active"
                      defaultChecked={currentCategory?.active ?? true}
                    />
                    <span className="barberservices__slider" />
                  </label>
                </div>
              </div>

              <div className="barberservices__footer">
                {currentCategory?.id ? (
                  <button
                    type="button"
                    className="barberservices__btn barberservices__btn--danger"
                    onClick={() => setCatConfirmDelete(true)}
                    disabled={catDeleting || catSaving}
                    title="Удалить категорию"
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
                    disabled={catSaving || catDeleting}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="barberservices__btn barberservices__btn--primary"
                    disabled={catSaving || catDeleting}
                  >
                    {catSaving ? "Сохранение…" : "Сохранить"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </ReactPortal>

      <ConfirmModal
        isOpen={catConfirmDelete}
        message={`Удалить категорию «${currentCategory?.name}»?`}
        onConfirm={handleDelete}
        onCancel={() => setCatConfirmDelete(false)}
      />
    </>
  );
};

export default CategoryModal;
