// Modal.jsx
// Импортируем стили. Здесь используется стили из DepartmentDetails.module.scss
// В реальном проекте, для общих компонентов, лучше иметь Modal.module.scss

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null; // Если модалка не открыта, ничего не рендерим

  return (
    <div className={"modalOverlay"} onClick={onClose}>
      {/* Предотвращаем закрытие модалки при клике внутри ее контента */}
      <div className={"modalContent"} onClick={(e) => e.stopPropagation()}>
        <button className={"closeButton"} onClick={onClose}>
          &times; {/* Символ крестика для закрытия */}
        </button>
        <h2>{title}</h2> {/* Заголовок модалки */}
        {children} {/* Содержимое модалки передается через children */}
      </div>
    </div>
  );
};

export default Modal;
