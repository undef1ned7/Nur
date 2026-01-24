import React from "react";
import { FaTimes } from "react-icons/fa";

const MenuCategoryModal = ({
  isOpen,
  onClose,
  catEditId,
  catTitle,
  setCatTitle,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="cafeMenuModal__overlay" onClick={onClose}>
      <div className="cafeMenuModal__card" onClick={(e) => e.stopPropagation()}>
        <div className="cafeMenuModal__header">
          <div className="cafeMenuModal__headLeft">
            <h3 className="cafeMenuModal__title">
              {catEditId ? "Редактировать категорию" : "Новая категория"}
            </h3>
          </div>

          <button
            type="button"
            className="cafeMenuModal__close"
            onClick={onClose}
            aria-label="Закрыть"
            title="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        <form className="cafeMenu__form" onSubmit={onSubmit}>
          <div className="cafeMenu__field cafeMenu__field--full">
            <label className="cafeMenu__label">Название категории</label>
            <input
              className="cafeMenu__input"
              value={catTitle}
              onChange={(e) => setCatTitle(e.target.value)}
              placeholder="Например: Горячее, Супы, Десерты"
              required
              maxLength={100}
              type="text"
              autoComplete="off"
            />
          </div>

          <div className="cafeMenu__formActions">
            <button
              type="button"
              className="cafeMenu__btn cafeMenu__btn--secondary"
              onClick={onClose}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="cafeMenu__btn cafeMenu__btn--primary"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MenuCategoryModal;
