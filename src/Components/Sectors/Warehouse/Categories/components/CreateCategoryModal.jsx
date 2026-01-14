import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { X } from "lucide-react";
import {
  createWarehouseCategoryAsync,
  updateWarehouseCategoryAsync,
} from "../../../../../store/creators/warehouseCreators";
import AlertModal from "../../../../common/AlertModal/AlertModal";
import "./CreateCategoryModal.scss";

const CreateCategoryModal = ({ onClose, category, onSaved }) => {
  const dispatch = useDispatch();
  const [name, setName] = useState(category?.name || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState("success");

  useEffect(() => {
    if (category) {
      setName(category.name || "");
    }
  }, [category]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Название категории обязательно");
      return;
    }

    setLoading(true);
    try {
      if (category) {
        await dispatch(
          updateWarehouseCategoryAsync({
            categoryId: category.id,
            updatedData: { name: name.trim() },
          })
        ).unwrap();
        setAlertMessage("Категория успешно обновлена");
      } else {
        await dispatch(
          createWarehouseCategoryAsync({ name: name.trim() })
        ).unwrap();
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
      setError(
        err?.message || err?.detail || "Ошибка при сохранении категории"
      );
      setAlertMessage(
        err?.message || err?.detail || "Ошибка при сохранении категории"
      );
      setAlertType("error");
      setShowAlert(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="create-category-modal-overlay" onClick={onClose} />
      <div className="create-category-modal">
        <div className="create-category-modal__header">
          <h2 className="create-category-modal__title">
            {category ? "Редактировать категорию" : "Создать категорию"}
          </h2>
          <button
            className="create-category-modal__close"
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="create-category-modal__form">
          <div className="create-category-modal__form-group">
            <label className="create-category-modal__label">
              Название категории *
            </label>
            <input
              type="text"
              className="create-category-modal__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите название категории"
              required
              disabled={loading}
            />
            {error && <p className="create-category-modal__error">{error}</p>}
          </div>

          <div className="create-category-modal__actions">
            <button
              type="button"
              className="create-category-modal__cancel"
              onClick={onClose}
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="create-category-modal__submit"
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

export default CreateCategoryModal;

