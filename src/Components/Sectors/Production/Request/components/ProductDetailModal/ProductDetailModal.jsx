import React, { useState, useEffect, useCallback } from "react";
import { ShoppingCart, Plus, Minus, Send } from "lucide-react";
import "./ProductDetailModal.scss";

const ProductDetailModal = ({
  product,
  isOpen,
  onClose,
  onRequestWithCart,
  onRequestWithoutCart,
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // безопасно считаем заранее
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

  const handleRequestWithCart = () => {
    if (available && quantity > 0 && onRequestWithCart) {
      onRequestWithCart(product, quantity);
      setQuantity(1);
    }
  };

  const handleRequestWithoutCart = () => {
    if (available && quantity > 0 && onRequestWithoutCart) {
      onRequestWithoutCart(product, quantity);
      setQuantity(1);
    }
  };

  // Определяем функции до использования в useEffect
  const handleCloseFullScreen = useCallback(() => {
    setIsFullScreen(false);
  }, []);

  const handleFullScreenNext = useCallback(
    (e) => {
      if (e && e.stopPropagation) {
        e.stopPropagation();
      }
      if (hasImages && imagesList.length > 0) {
        setCurrentImageIndex((prev) =>
          prev === imagesList.length - 1 ? 0 : prev + 1
        );
      }
    },
    [hasImages, imagesList.length]
  );

  const handleFullScreenPrev = useCallback(
    (e) => {
      if (e && e.stopPropagation) {
        e.stopPropagation();
      }
      if (hasImages && imagesList.length > 0) {
        setCurrentImageIndex((prev) =>
          prev === 0 ? imagesList.length - 1 : prev - 1
        );
      }
    },
    [hasImages, imagesList.length]
  );

  // ХУКИ — всегда до любых return
  useEffect(() => {
    setCurrentImageIndex(0);
    setIsFullScreen(false);
    setQuantity(1);
  }, [product?.id]);

  // Обработка клавиатуры для полноэкранного просмотра
  useEffect(() => {
    if (!isFullScreen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleCloseFullScreen();
      } else if (e.key === "ArrowLeft") {
        handleFullScreenPrev({ stopPropagation: () => {} });
      } else if (e.key === "ArrowRight") {
        handleFullScreenNext({ stopPropagation: () => {} });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    isFullScreen,
    handleCloseFullScreen,
    handleFullScreenPrev,
    handleFullScreenNext,
  ]);

  // после хуков можно делать ранний выход
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

  const handleImageClick = () => {
    if (hasImages) {
      setIsFullScreen(true);
    }
  };

  const handleFullScreenThumbnailClick = (e, index) => {
    e.stopPropagation();
    setCurrentImageIndex(index);
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
                onClick={handleImageClick}
                style={{ cursor: "pointer" }}
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
              {hasImages && (
                <div className="fullscreen-hint" onClick={handleImageClick}>
                  Нажмите для просмотра в полном размере
                </div>
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

          {/* Полноэкранный просмотр изображения */}
          {isFullScreen && hasImages && (
            <div
              className="fullscreen-image-overlay"
              onClick={handleCloseFullScreen}
            >
              <div
                className="fullscreen-image-container"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="fullscreen-close-btn"
                  onClick={handleCloseFullScreen}
                >
                  ×
                </button>
                {imagesList.length > 1 && (
                  <>
                    <button
                      className="fullscreen-nav-btn prev"
                      onClick={handleFullScreenPrev}
                    >
                      ‹
                    </button>
                    <button
                      className="fullscreen-nav-btn next"
                      onClick={handleFullScreenNext}
                    >
                      ›
                    </button>
                  </>
                )}
                <img
                  src={
                    imagesList[currentImageIndex]?.image_url ||
                    "https://via.placeholder.com/300x200"
                  }
                  alt={product.name}
                  className="fullscreen-image"
                />
                {imagesList.length > 1 && (
                  <div className="fullscreen-thumbnails">
                    {imagesList.map((image, index) => (
                      <img
                        key={image.id || index}
                        src={
                          image.image_url || "https://via.placeholder.com/100"
                        }
                        alt={`${product.name} ${index + 1}`}
                        className={`fullscreen-thumbnail ${
                          index === currentImageIndex ? "active" : ""
                        }`}
                        onClick={(e) =>
                          handleFullScreenThumbnailClick(e, index)
                        }
                      />
                    ))}
                  </div>
                )}
                <div className="fullscreen-image-info">
                  {currentImageIndex + 1} / {imagesList.length}
                </div>
              </div>
            </div>
          )}

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
            <div
              className="stock-status"
              style={{
                margin: 0,
                color: "#4CAF50",
                fontWeight: "500",
              }}
            >
              Доступно для запроса
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
                  className="request-without-cart-btn-modal"
                  onClick={handleRequestWithoutCart}
                  disabled={!available || quantity <= 0}
                >
                  <Send size={18} />
                  Запросить без корзины ({quantity} шт.)
                </button>
                <button
                  className="request-with-cart-btn-modal"
                  onClick={handleRequestWithCart}
                  disabled={!available || quantity <= 0}
                >
                  <ShoppingCart size={18} />
                  Запросить с корзиной ({quantity} шт.)
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
