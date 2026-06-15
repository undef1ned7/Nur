import { Button } from "@mui/material";
import ReactPortal from "../../../../common/Portal/ReactPortal";
import "../../../../common/AlertModal/SystemDialog.scss";

const ConfirmModal = ({ message, isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <ReactPortal wrapperId="confirm-modal">
      <div className="system-dialog-overlay">
        <div className="system-dialog" role="dialog" aria-modal="true">
          <div className="system-dialog__body">
            <div className="system-dialog__icon-wrap">
              <svg
                fill="none"
                height="28"
                stroke="#f87171"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="28"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" x2="12.01" y1="17" y2="17" />
              </svg>
            </div>
            <h3 className="system-dialog__title">Подтвердите ваше действие</h3>
            <p className="system-dialog__message">{message}</p>
          </div>
          <div className="system-dialog__actions">
            <Button onClick={() => onCancel?.()}>Отменить</Button>
            <Button color="warning" variant="contained" onClick={() => onConfirm?.()}>
              Подтвердить
            </Button>
          </div>
        </div>
      </div>
    </ReactPortal>
  );
};

export default ConfirmModal;
