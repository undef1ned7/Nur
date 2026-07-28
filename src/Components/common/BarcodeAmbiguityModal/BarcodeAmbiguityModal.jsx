import { useEffect } from "react";
import ReactPortal from "../Portal/ReactPortal";
import "./BarcodeAmbiguityModal.scss";

const BarcodeAmbiguityModal = ({
  open,
  message,
  matches = [],
  loading = false,
  onSelect,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !loading) {
        event.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, onClose, open]);

  if (!open) return null;

  return (
    <ReactPortal wrapperId="barcode_ambiguity_modal">
      <div className="barcode-ambiguity-modal" role="presentation">
        <button
          type="button"
          className="barcode-ambiguity-modal__backdrop"
          aria-label="Закрыть"
          onClick={loading ? undefined : onClose}
        />
        <div
          className="barcode-ambiguity-modal__dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="barcode-ambiguity-title"
        >
          <h3 id="barcode-ambiguity-title">Выберите товар</h3>
          <p>{message}</p>
          <div className="barcode-ambiguity-modal__matches">
            {matches.map((match) => (
              <button
                key={String(match.id)}
                type="button"
                disabled={loading}
                onClick={() => onSelect?.(match)}
              >
                <span>{match.name}</span>
                <small>ID: {match.id}</small>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="barcode-ambiguity-modal__cancel"
            disabled={loading}
            onClick={onClose}
          >
            {loading ? "Добавление…" : "Отмена"}
          </button>
        </div>
      </div>
    </ReactPortal>
  );
};

export default BarcodeAmbiguityModal;
