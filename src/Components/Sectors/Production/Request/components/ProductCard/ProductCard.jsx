import React, { useState } from "react";
import { Eye, ShoppingCart, Plus, Minus, Send } from "lucide-react";
import "./ProductCard.scss";

const ProductCard = ({
  product,
  onView,
  onDragStart,
  onDragEnd,
  isDragging,
  onRequestWithCart,
  onRequestWithoutCart,
  isOwner = false,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [showQuantityControls, setShowQuantityControls] = useState(false);

  const maxQuantity = 999; // Для запросов нет ограничений по количеству на складе
  const available = true; // Все товары доступны для запроса

  const handleQuantityChange = (e) => {
    const value = e.target.value;

    if ((value === "" || !isNaN(value)) && (value === "" || Number(value) <= 999)) {
      setQuantity(value);
    }
  };

  const handleIncrement = (e) => {
    e.stopPropagation();
    if (available && quantity < maxQuantity) {
      setQuantity((+quantity) + 1);
    }
  };

  const handleDecrement = (e) => {
    e.stopPropagation();
    setQuantity(oldQty => {
      const newQty = oldQty - 1;
      if (newQty <= 0) {
        setShowQuantityControls(false)
        return 1
      }
      return newQty
    })
  };

  const handleRequestWithCart = (e) => {
    e.stopPropagation();
    if (available && quantity > 0 && onRequestWithCart) {
      onRequestWithCart(product, quantity);
      setQuantity(1);
      setShowQuantityControls(false);
    }
  };

  const handleRequestWithoutCart = (e) => {
    e.stopPropagation();
    if (available && quantity > 0 && onRequestWithoutCart) {
      onRequestWithoutCart(product, quantity);
      setQuantity(1);
      setShowQuantityControls(false);
    }
  };

  const handleQuickRequestWithCart = (e) => {
    e.stopPropagation();
    if (available && onRequestWithCart) {
      onRequestWithCart(product, 1);
    }
  };

  const handleQuickRequestWithoutCart = (e) => {
    e.stopPropagation();
    if (available && onRequestWithoutCart) {
      onRequestWithoutCart(product, 1);
    }
  };

  const handleToggleQuantityControls = (e) => {
    e.stopPropagation();
    if (available) {
      setShowQuantityControls(!showQuantityControls);
    }
  };

  return (
    <div
      className={`product-card ${isDragging ? "dragging" : ""}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="product-image">
        {product.images?.[0]?.image_url ? (
          <img src={product.images?.[0]?.image_url} alt={product.name} />
        ) : (
          <img
            src="https://web.cloudshop.ru/images/placeholder.png"
            alt={product.name}
            style={{ objectFit: "contain" }}
          />
        )}
        <div className="product-overlay">
          <button className="view-btn" onClick={() => onView(product)}>
            <Eye size={20} />
          </button>
        </div>
        {product?.stock === true && <div className="discount-badge">Акция</div>}
      </div>
      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        <div className="product-price">
          {Number(product?.price || 0).toLocaleString()} сом
          {product?.stock === true && (
            <span className="price-discount-label">С акцией</span>
          )}
        </div>

        {!isOwner && (
          <>
            {!available ? (
              <div className="out-of-stock-message">Недоступен</div>
            ) : (
              <>
                {!showQuantityControls ? (
                  <div className="product-cart-controls">
                    <div className="request-buttons-row">
                      {/* <button
                        className="request-without-cart-btn"
                        onClick={handleQuickRequestWithoutCart}
                        disabled={!available}
                        title="Создать корзину и отправить"
                      >
                        <Send size={14} />
                        Без корзины
                      </button> */}
                      <button
                        className="request-with-cart-btn"
                        onClick={handleQuickRequestWithCart}
                        disabled={!available}
                        title="Добавить в корзину"
                      >
                        <ShoppingCart size={14} />
                        В корзину
                      </button>
                    </div>
                    <button
                      className="select-quantity-btn"
                      onClick={handleToggleQuantityControls}
                      disabled={!available}
                    >
                      Выбрать количество
                    </button>
                  </div>
                ) : (
                  <div className="product-quantity-controls">
                    <div className="quantity-selector-inline">
                      <button
                        className="quantity-btn-small"
                        onClick={handleDecrement}
                        disabled={quantity < 1}
                        type="button"
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="number"
                        min="0"
                        max={maxQuantity || 999}
                        value={quantity}
                        onChange={handleQuantityChange}
                        className="quantity-input-small"
                      />
                      <button
                        className="quantity-btn-small"
                        onClick={handleIncrement}
                        disabled={!available || quantity >= maxQuantity}
                        type="button"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="request-buttons-row">
                      {/* <button
                        className="request-without-cart-btn"
                        onClick={handleRequestWithoutCart}
                        disabled={!available || quantity <= 0}
                        title="Создать корзину и отправить"
                      >
                        <Send size={14} />
                        Без корзины ({quantity})
                      </button> */}
                      <button
                        className="request-with-cart-btn"
                        onClick={handleRequestWithCart}
                        disabled={!available || quantity <= 0}
                        title="Добавить в корзину"
                      >
                        <ShoppingCart size={14} />
                        В корзину ({quantity})
                      </button>
                    </div>
                    <button
                      className="cancel-quantity-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowQuantityControls(false);
                        setQuantity(1);
                      }}
                    >
                      Отмена
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
