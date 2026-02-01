import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import warehouseAPI from "../../../../../api/warehouse";
import AlertModal from "../../../../common/AlertModal/AlertModal";
import "./CreatePaymentCategoryModal.scss";

const CreatePaymentCategoryModal = ({ onClose, category, onSaved }) => {
  const [title, setTitle] = useState(category?.title ?? category?.name ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState("success");

  useEffect(() => {
    if (category) {
      setTitle(category.title ?? category.name ?? "");
    }
  }, [category]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Название категории обязательно");
      return;
    }

    setLoading(true);
    try {
      if (category) {
        await warehouseAPI.patchMoneyCategory(category.id, { title: title.trim() });
        setAlertMessage("Категория успешно обновлена");
      } else {
        await warehouseAPI.createMoneyCategory({ title: title.trim() });
        setAlertMessage("Категория успешно создана");
      }
      setAlertType("success");
      setShowAlert(true);
      setTimeout(() => {
        setShowAlert(false);
        onSaved();
        onClose();
      }, 1500);
    } catch (err) {
      const msg = err?.message || err?.detail || "Ошибка при сохранении категории";
      setError(msg);
      setAlertMessage(msg);
      setAlertType("error");
      setShowAlert(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="create-payment-category-modal-overlay" onClick={onClose} />
      <div className="create-payment-category-modal">
        <div className="create-payment-category-modal__header">
          <h2 className="create-payment-category-modal__title">
            {category ? "Редактировать категорию платежа" : "Создать категорию платежа"}
          </h2>
          <button
            className="create-payment-category-modal__close"
            onClick={onClose}
            type="button"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="create-payment-category-modal__form">
          <div className="create-payment-category-modal__form-group">
            <label className="create-payment-category-modal__label">
              Название *
            </label>
            <input
              type="text"
              className="create-payment-category-modal__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введите название категории"
              required
              disabled={loading}
            />
            {error && <p className="create-payment-category-modal__error">{error}</p>}
          </div>

          <div className="create-payment-category-modal__actions">
            <button
              type="button"
              className="create-payment-category-modal__cancel"
              onClick={onClose}
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="create-payment-category-modal__submit"
              disabled={loading}
            >
              {loading ? "Сохранение..." : category ? "Сохранить" : "Создать"}
            </button>
          </div>
        </form>
      </div>

      <AlertModal
        open={showAlert}
        type={alertType}
        title={alertType === "success" ? "Успех" : "Ошибка"}
        message={alertMessage}
        onClose={() => setShowAlert(false)}
      />
    </>
  );
};

export default CreatePaymentCategoryModal;
