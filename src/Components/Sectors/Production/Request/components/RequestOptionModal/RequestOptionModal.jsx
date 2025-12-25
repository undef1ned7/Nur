import React from "react";
import { ShoppingCart, Send } from "lucide-react";
import "./RequestOptionModal.scss";

const RequestOptionModal = ({
  isOpen,
  onClose,
  onRequestWithCart,
  onRequestWithoutCart,
  product,
  quantity,
}) => {
  if (!isOpen) return null;

  return (
    <div className="request-option-modal-overlay" onClick={onClose}>
      <div
        className="request-option-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="request-option-modal-header">
          <h3>Выберите способ запроса</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="request-option-modal-content">
          <div className="product-info">
            <p className="product-name">{product?.name}</p>
            <p className="product-quantity">Количество: {quantity} шт.</p>
          </div>
          <div className="request-options">
            <button
              className="request-option-btn request-without-cart"
              onClick={onRequestWithoutCart}
            >
              <Send size={20} />
              <div className="btn-content">
                <span className="btn-title">Запросить без корзины</span>
                <span className="btn-description">
                  Создать корзину с этим товаром и автоматически отправить
                </span>
              </div>
            </button>
            <button
              className="request-option-btn request-with-cart"
              onClick={onRequestWithCart}
            >
              <ShoppingCart size={20} />
              <div className="btn-content">
                <span className="btn-title">Запросить с корзиной</span>
                <span className="btn-description">
                  Добавить товар в текущую корзину
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestOptionModal;

