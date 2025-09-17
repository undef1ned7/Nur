import "./Department.scss";

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className={"modalOverlay"} onClick={onClose}>
      <div className={"modalContent"} onClick={(e) => e.stopPropagation()}>
        <button className={"closeButton"} onClick={onClose}>
          &times;
        </button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
};

export default Modal;
