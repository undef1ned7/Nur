import React, { useState, useEffect } from "react";
import { ShoppingCart, Plus, Minus } from "lucide-react";
import "./ProductDetailModal.scss";

const ProductDetailModal = ({ product, isOpen, onClose, onRequestProduct }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const imagesList = Array.isArray(product?.images) ? product.images : [];
  const hasImages = imagesList.length > 0;
  const maxQuantity = 999;
  const available = true;

  const handleQuantityChange = (newQuantity) => {
    const qty = Math.max(1, Math.min(maxQuantity || 999, newQuantity));
    setQuantity(qty);
  };

  const handleIncrement = () => {
    if (available && quantity < maxQuantity) {
      setQuantity(quantity + 1);
    }
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const handleRequestClick = () => {
    if (available && quantity > 0 && onRequestProduct) {
      onRequestProduct(product, quantity);
      setQuantity(1);
    }
  };

  const handleQuickRequest = () => {
    if (available && onRequestProduct) {
      onRequestProduct(product, 1);
    }
  };

  useEffect(() => {
    setCurrentImageIndex(0);
    setQuantity(1);
  }, [product?.id]);

  if (!isOpen || !product) return null;

  const nextImage = () => {
    if (!hasImages) return;
    setCurrentImageIndex((prev) =>
      prev === imagesList.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    if (!hasImages) return;
    setCurrentImageIndex((prev) =>
      prev === 0 ? imagesList.length - 1 : prev - 1
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="product-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{product.name}</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-content">
          <div className="image-gallery">
            <div className="main-image">
              <img
                src={
                  imagesList[currentImageIndex]?.image_url ||
                  "https://via.placeholder.com/300x200"
                }
                alt={product.name}
              />
              {hasImages && imagesList.length > 1 && (
                <>
                  <button className="nav-btn prev" onClick={prevImage}>
                    ‹
                  </button>
                  <button className="nav-btn next" onClick={nextImage}>
                    ›
                  </button>
                </>
              )}
            </div>

            {hasImages && imagesList.length > 1 && (
              <div className="thumbnail-list">
                {imagesList.map((image, index) => (
                  <img
                    key={image.id || index}
                    src={image.image_url || "https://via.placeholder.com/100"}
                    alt={`${product.name} ${index + 1}`}
                    className={`thumbnail ${
                      index === currentImageIndex ? "active" : ""
                    }`}
                    onClick={() => setCurrentImageIndex(index)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="product-details">
            <h2
              className="title"
              style={{ fontSize: "27px", marginBottom: 10 }}
            >
              {product.name}
              {product?.stock === true && (
                <span className="modal-discount-badge">Скидка</span>
              )}
            </h2>

            <div className="price">
              {Number(product?.price || 0).toLocaleString()} сом
              {product?.stock === true && (
                <span className="price-discount-label">со скидкой</span>
              )}
            </div>

            <div className="modal-quantity-controls">
              <div className="quantity-selector-inline">
                <label
                  style={{
                    fontSize: "0.9rem",
                    marginBottom: "8px",
                    display: "block",
                    color: "#666",
                  }}
                >
                  Количество:
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "16px",
                  }}
                >
                  <button
                    className="quantity-btn-modal"
                    onClick={handleDecrement}
                    disabled={quantity <= 1}
                    type="button"
                  >
                    <Minus size={18} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={maxQuantity || 999}
                    value={quantity}
                    onChange={(e) =>
                      handleQuantityChange(Number(e.target.value))
                    }
                    className="quantity-input-modal"
                  />
                  <button
                    className="quantity-btn-modal"
                    onClick={handleIncrement}
                    disabled={!available || quantity >= maxQuantity}
                    type="button"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  flexDirection: "column",
                }}
              >
                <button
                  className="add-to-cart-btn"
                  onClick={handleRequestClick}
                  disabled={!available || quantity <= 0}
                >
                  <ShoppingCart size={20} />
                  Запросить товар ({quantity} шт.)
                </button>
                <button
                  className="quick-add-btn"
                  onClick={handleQuickRequest}
                  disabled={!available}
                >
                  Быстро запросить (1 шт.)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailModal;
