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
    <div className="menu-modal__overlay" onClick={onClose}>
      <div
        className="menu-modal__card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="menu-modal__header">
          <h3 className="menu-modal__title">
            {catEditId ? "Редактировать категорию" : "Новая категория"}
          </h3>
          <button
            className="menu-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        <form className="menu__form" onSubmit={onSubmit}>
          <div className="menu__field menu__field--full">
            <label className="menu__label">Название категории</label>
            <input
              className="menu__input"
              value={catTitle}
              onChange={(e) => setCatTitle(e.target.value)}
              placeholder="Например: Горячее, Супы, Десерты"
              required
              maxLength={100}
            />
          </div>

          <div className="menu__formActions">
            <button
              type="button"
              className="menu__btn menu__btn--secondary"
              onClick={onClose}
            >
              Отмена
            </button>
            <button type="submit" className="menu__btn menu__btn--primary">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MenuCategoryModal;
