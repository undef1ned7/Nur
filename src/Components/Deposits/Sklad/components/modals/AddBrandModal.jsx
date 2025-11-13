import { useState } from "react";
import { useDispatch } from "react-redux";
import { X } from "lucide-react";
import { createBrandAsync } from "../../../../../store/creators/productCreators";

const AddBrandModal = ({ onClose }) => {
  const dispatch = useDispatch();
  const [name, setName] = useState("");

  const handleSave = async () => {
    if (!name.trim()) return alert("Введите название бренда");
    try {
      await dispatch(createBrandAsync({ name })).unwrap();
      onClose();
    } catch (e) {
      alert("Ошибка создания бренда: " + (e.detail || e));
    }
  };

  return (
    <div className="add-modal">
      <div className="add-modal__overlay" onClick={onClose} />
      <div className="add-modal__content">
        <div className="add-modal__header">
          <h3>Добавление бренда</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <div className="add-modal__section">
          <label>Название *</label>
          <input
            type="text"
            placeholder="Например, Samsung"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="add-modal__footer">
          <button className="add-modal__cancel" onClick={onClose}>
            Отмена
          </button>
          <button className="add-modal__save" onClick={handleSave}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddBrandModal;
