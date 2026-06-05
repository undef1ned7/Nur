import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  getDefaultPackage,
  maxPiecesAvailable,
  pieceUnitPrice,
  supportsPieceFromPack,
} from "../../../../../../tools/marketPackPieceSale";
import "./PieceSaleModal.scss";

const formatPrice = (price) => {
  const num = parseFloat(price);
  if (Number.isNaN(num)) return "0";
  if (num % 1 === 0) return String(num);
  return String(num).replace(/\.?0+$/, "");
};

const PieceSaleModal = ({
  product,
  step = "choice",
  source = "click",
  maxQuantity = null,
  onClose,
  onChoosePack,
  onConfirmPieces,
}) => {
  const [localStep, setLocalStep] = useState(step);
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState("");
  const qtyInputRef = useRef(null);

  useEffect(() => {
    setLocalStep(step);
    setQuantity("1");
    setError("");
  }, [product?.id, step]);

  useEffect(() => {
    if (localStep !== "quantity") return;
    qtyInputRef.current?.focus();
    qtyInputRef.current?.select();
  }, [localStep]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const pkg = useMemo(() => getDefaultPackage(product), [product]);
  const piecePrice = useMemo(
    () => (product && pkg ? pieceUnitPrice(product, pkg) : 0),
    [product, pkg],
  );

  const resolvedMaxQty = useMemo(() => {
    if (maxQuantity != null && Number.isFinite(Number(maxQuantity))) {
      return Math.max(0, Math.floor(Number(maxQuantity)));
    }
    const stock = parseFloat(product?.quantity || 0);
    const ipp = Number(pkg?.quantity_in_package || 0);
    if (!(ipp > 0)) return 0;
    return Math.floor(stock * ipp);
  }, [maxQuantity, product?.quantity, pkg?.quantity_in_package]);

  if (!product || !supportsPieceFromPack(product) || !pkg) return null;

  const unitLabel = pkg.unit || "шт.";
  const stockUnit = product.unit || "упак.";

  const handleConfirmPieces = () => {
    const qty = Math.floor(parseFloat(String(quantity).replace(",", ".")) || 0);
    if (!(qty > 0)) {
      setError("Укажите количество больше 0");
      return;
    }
    if (resolvedMaxQty > 0 && qty > resolvedMaxQty) {
      setError(`Доступно не более ${resolvedMaxQty} ${unitLabel}`);
      return;
    }
    onConfirmPieces?.(product, pkg.id, qty);
  };

  return (
    <div className="piece-sale-modal-overlay" onClick={onClose}>
      <div
        className="piece-sale-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="piece-sale-modal__header">
          <div>
            <h2 className="piece-sale-modal__title">{product.name || "Товар"}</h2>
            <p className="piece-sale-modal__subtitle">
              Остаток: {formatPrice(product.quantity || 0)} {stockUnit}
            </p>
          </div>
          <button
            type="button"
            className="piece-sale-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={22} />
          </button>
        </div>

        {localStep === "choice" ? (
          <div className="piece-sale-modal__body">
            <p className="piece-sale-modal__hint">Как добавить в корзину?</p>
            <button
              type="button"
              className="piece-sale-modal__option"
              onClick={() => onChoosePack?.(product, source)}
            >
              <span className="piece-sale-modal__option-title">
                Целая {pkg.name || stockUnit}
              </span>
              <span className="piece-sale-modal__option-meta">
                {formatPrice(product.price || 0)} сом за {stockUnit}
              </span>
            </button>
            <button
              type="button"
              className="piece-sale-modal__option piece-sale-modal__option--piece"
              onClick={() => {
                setError("");
                setLocalStep("quantity");
              }}
            >
              <span className="piece-sale-modal__option-title">Поштучно</span>
              <span className="piece-sale-modal__option-meta">
                {formatPrice(piecePrice)} сом за {unitLabel} ({pkg.quantity_in_package}{" "}
                {unitLabel} в {pkg.name || stockUnit})
              </span>
            </button>
          </div>
        ) : (
          <div className="piece-sale-modal__body">
            <p className="piece-sale-modal__hint">
              Сколько {unitLabel} добавить?
            </p>
            <div className="piece-sale-modal__qty-row">
              <input
                ref={qtyInputRef}
                type="text"
                inputMode="numeric"
                className="piece-sale-modal__qty-input"
                value={quantity}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "" || /^\d+$/.test(value)) {
                    setQuantity(value);
                    setError("");
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleConfirmPieces();
                  }
                }}
              />
              <span className="piece-sale-modal__qty-unit">{unitLabel}</span>
            </div>
            <p className="piece-sale-modal__price-hint">
              Цена: {formatPrice(piecePrice)} сом × {quantity || "0"} ={" "}
              {formatPrice(piecePrice * (parseFloat(quantity) || 0))} сом
            </p>
            {resolvedMaxQty > 0 ? (
              <p className="piece-sale-modal__stock-hint">
                Доступно до {resolvedMaxQty} {unitLabel}
              </p>
            ) : null}
            {error ? <p className="piece-sale-modal__error">{error}</p> : null}
            <div className="piece-sale-modal__actions">
              <button
                type="button"
                className="piece-sale-modal__back-btn"
                onClick={() => {
                  setError("");
                  setLocalStep("choice");
                }}
              >
                Назад
              </button>
              <button
                type="button"
                className="piece-sale-modal__confirm-btn"
                onClick={handleConfirmPieces}
              >
                Добавить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { maxPiecesAvailable };
export default PieceSaleModal;
