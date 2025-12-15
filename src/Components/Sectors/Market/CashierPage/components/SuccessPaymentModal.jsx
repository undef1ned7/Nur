import React, { useState, useEffect } from "react";
import { X, ChevronUp, ChevronDown, Printer } from "lucide-react";
import "./SuccessPaymentModal.scss";

const SuccessPaymentModal = ({
  open,
  onClose,
  onPrint,
  printing = false,
  total,
  cashAmount = 0,
  cashlessAmount = 0,
  deferredAmount = 0,
  amountReceived = 0,
  change = 0,
}) => {
  const [isTotalExpanded, setIsTotalExpanded] = useState(true);
  const [isReceivedExpanded, setIsReceivedExpanded] = useState(false);

  // Обработка нажатия Enter для закрытия модального окна
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (open && e.key === "Enter") {
        e.preventDefault();
        onClose();
      }
    };

    if (open) {
      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="success-payment-modal-overlay" onClick={onClose}>
      <div
        className="success-payment-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="success-payment-modal__close" onClick={onClose}>
          <X size={24} />
        </button>

        <h2 className="success-payment-modal__title">Продажа прошла успешно</h2>

        <div className="success-payment-modal__summary">
          <div
            className="success-payment-modal__summary-header"
            onClick={() => setIsTotalExpanded(!isTotalExpanded)}
          >
            <span className="success-payment-modal__summary-label">Итог</span>
            <div className="success-payment-modal__summary-value-wrapper">
              <span className="success-payment-modal__summary-value">
                {total.toFixed(2)}сом
              </span>
              {isTotalExpanded ? (
                <ChevronUp size={18} className="success-payment-modal__icon" />
              ) : (
                <ChevronDown
                  size={18}
                  className="success-payment-modal__icon"
                />
              )}
            </div>
          </div>

          {isTotalExpanded && (
            <div className="success-payment-modal__summary-details">
              <div className="success-payment-modal__summary-item">
                <span className="success-payment-modal__summary-label">
                  Наличные
                </span>
                <span className="success-payment-modal__summary-value">
                  {cashAmount.toFixed(2)}сом
                </span>
              </div>

              <div className="success-payment-modal__summary-item">
                <span className="success-payment-modal__summary-label">
                  Безналичные
                </span>
                <span className="success-payment-modal__summary-value">
                  {cashlessAmount.toFixed(2)}сом
                </span>
              </div>

              <div className="success-payment-modal__summary-item">
                <span className="success-payment-modal__summary-label">
                  Отсрочка
                </span>
                <span className="success-payment-modal__summary-value">
                  {deferredAmount.toFixed(2)}сом
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="success-payment-modal__received">
          <div
            className="success-payment-modal__received-header"
            onClick={() => setIsReceivedExpanded(!isReceivedExpanded)}
          >
            <span className="success-payment-modal__received-label">
              Принято
            </span>
            <div className="success-payment-modal__received-value-wrapper">
              <span className="success-payment-modal__received-value">
                {amountReceived.toFixed(2)}сом
              </span>
              {isReceivedExpanded ? (
                <ChevronUp size={18} className="success-payment-modal__icon" />
              ) : (
                <ChevronDown
                  size={18}
                  className="success-payment-modal__icon"
                />
              )}
            </div>
          </div>

          {isReceivedExpanded && (
            <div className="success-payment-modal__received-details">
              <div className="success-payment-modal__summary-item">
                <span className="success-payment-modal__summary-label">
                  Наличные
                </span>
                <span className="success-payment-modal__summary-value">
                  {amountReceived.toFixed(2)}сом
                </span>
              </div>
            </div>
          )}
        </div>

        {change > 0 && (
          <div className="success-payment-modal__change">
            <div className="success-payment-modal__change-label">СДАЧА:</div>
            <div className="success-payment-modal__change-value">
              {change.toFixed(2)} сом
            </div>
          </div>
        )}

        <div className="success-payment-modal__actions">
          {/* {onPrint && (
            <button
              className="success-payment-modal__print-btn"
              onClick={onPrint}
              disabled={printing}
            >
              <Printer size={18} />
              {printing ? "Печать..." : "ПЕЧАТЬ ЧЕКА"}
            </button>
          )} */}
          <button
            className="success-payment-modal__close-btn"
            onClick={onClose}
            autoFocus
          >
            ЗАКРЫТЬ{" "}
            <span className="success-payment-modal__enter-hint">[ENTER]</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuccessPaymentModal;
