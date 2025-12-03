import React, { useState } from "react";
import { Eye, ShoppingCart, Plus, Minus } from "lucide-react";
import "./ProductCard.scss";

const ProductCard = ({
  product,
  onView,
  onDragStart,
  onDragEnd,
  isDragging,
  onRequestProduct,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [showQuantityControls, setShowQuantityControls] = useState(false);

  const maxQuantity = 999; // Для запросов нет ограничений по количеству на складе
  const available = true; // Все товары доступны для запроса

  const handleQuantityChange = (newQuantity) => {
    const qty = Math.max(1, Math.min(maxQuantity || 999, newQuantity));
    setQuantity(qty);
  };

  const handleIncrement = (e) => {
    e.stopPropagation();
    if (available && quantity < maxQuantity) {
      setQuantity(quantity + 1);
    }
  };

  const handleDecrement = (e) => {
    e.stopPropagation();
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const handleRequestClick = (e) => {
    e.stopPropagation();
    if (available && quantity > 0 && onRequestProduct) {
      onRequestProduct(product, quantity);
      setQuantity(1);
      setShowQuantityControls(false);
    }
  };

  const handleQuickRequest = (e) => {
    e.stopPropagation();
    if (available && onRequestProduct) {
      onRequestProduct(product, 1);
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
        <img
          src={
            product.images?.[0]?.image_url ||
            "https://via.placeholder.com/300x200"
          }
          alt={product.name}
        />
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

        {!available ? (
          <div className="out-of-stock-message">Недоступен</div>
        ) : (
          <>
            {!showQuantityControls ? (
              <div className="product-cart-controls">
                <button
                  className="add-to-cart-btn"
                  onClick={handleQuickRequest}
                  disabled={!available}
                >
                  <ShoppingCart size={16} />
                  Быстро запросить
                </button>
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
                    disabled={quantity <= 1}
                    type="button"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={maxQuantity || 999}
                    value={quantity}
                    onChange={(e) =>
                      handleQuantityChange(Number(e.target.value))
                    }
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
                <button
                  className="add-to-cart-btn"
                  onClick={handleRequestClick}
                  disabled={!available || quantity <= 0}
                >
                  <ShoppingCart size={16} />
                  Запросить ({quantity})
                </button>
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
      </div>
    </div>
  );
};

export default ProductCard;
