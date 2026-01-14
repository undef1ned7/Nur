import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { X } from "lucide-react";
import {
  createWarehouseBrandAsync,
  updateWarehouseBrandAsync,
} from "../../../../../store/creators/warehouseCreators";
import AlertModal from "../../../../common/AlertModal/AlertModal";
import "./CreateBrandModal.scss";

const CreateBrandModal = ({ onClose, brand, onSaved }) => {
  const dispatch = useDispatch();
  const [name, setName] = useState(brand?.name || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState("success");

  useEffect(() => {
    if (brand) {
      setName(brand.name || "");
    }
  }, [brand]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Название бренда обязательно");
      return;
    }

    setLoading(true);
    try {
      if (brand) {
        await dispatch(
          updateWarehouseBrandAsync({
            brandId: brand.id,
            updatedData: { name: name.trim() },
          })
        ).unwrap();
        setAlertMessage("Бренд успешно обновлен");
      } else {
        await dispatch(
          createWarehouseBrandAsync({ name: name.trim() })
        ).unwrap();
        setAlertMessage("Бренд успешно создан");
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
        err?.message || err?.detail || "Ошибка при сохранении бренда"
      );
      setAlertMessage(
        err?.message || err?.detail || "Ошибка при сохранении бренда"
      );
      setAlertType("error");
      setShowAlert(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="create-brand-modal-overlay" onClick={onClose} />
      <div className="create-brand-modal">
        <div className="create-brand-modal__header">
          <h2 className="create-brand-modal__title">
            {brand ? "Редактировать бренд" : "Создать бренд"}
          </h2>
          <button
            className="create-brand-modal__close"
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="create-brand-modal__form">
          <div className="create-brand-modal__form-group">
            <label className="create-brand-modal__label">
              Название бренда *
            </label>
            <input
              type="text"
              className="create-brand-modal__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите название бренда"
              required
              disabled={loading}
            />
            {error && <p className="create-brand-modal__error">{error}</p>}
          </div>

          <div className="create-brand-modal__actions">
            <button
              type="button"
              className="create-brand-modal__cancel"
              onClick={onClose}
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="create-brand-modal__submit"
              disabled={loading}
            >
              {loading ? "Сохранение..." : brand ? "Сохранить" : "Создать"}
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

export default CreateBrandModal;

