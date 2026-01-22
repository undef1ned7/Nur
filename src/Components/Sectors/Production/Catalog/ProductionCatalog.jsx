import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  Eye,
  Heart,
  ShoppingCart,
  Star,
  Search,
  Filter,
  Grid,
  List,
  Plus,
  Minus,
  X,
  Send,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchProducts,
  setSelectedProduct,
  clearSelectedProduct,
  updateProductsOrder,
  setFilters,
  clearFilters,
  reorderProducts,
} from "../../../../store/slices/catalogSlice";
import {
  addToCart,
  selectCartItemsCount,
} from "../../../../store/slices/cartSlice";
import {
  startAgentCart,
  addProductToAgentCart,
  getAgentCart,
  getMyAgentProductsAsync,
  checkoutAgentCart,
} from "../../../../store/creators/agentCartCreators";
import {
  openShiftAsync,
  fetchShiftsAsync,
} from "../../../../store/creators/shiftThunk";
import { useShifts } from "../../../../store/slices/shiftSlice";
import { useCash, getCashBoxes } from "../../../../store/slices/cashSlice";
import { useUser } from "../../../../store/slices/userSlice";
import Cart from "./Cart";
import "./ProductionCatalog.scss";
import { display, margin } from "@mui/system";
import AlertModal from "../../../common/AlertModal/AlertModal";
import { useDebouncedValue } from "../../../../hooks/useDebounce";
import { useAlert } from "../../../../hooks/useDialog";

// Моковые данные для демонстрации
const mockProducts = [
  {
    id: 1,
    name: "Товар 1",
    price: 15000,
    images: [
      "https://media.istockphoto.com/id/501057465/ru/%D1%84%D0%BE%D1%82%D0%BE/%D0%B3%D0%B8%D0%BC%D0%B0%D0%BB%D0%B0%D0%B8-%D0%B3%D0%BE%D1%80%D1%8B-%D0%B8%D0%B7-%D0%BF%D0%B0%D1%80%D0%BE%D0%B2-%D0%B8-%D1%82%D1%83%D0%BC%D0%B0%D0%BD.jpg?s=612x612&w=0&k=20&c=y-6Zd6b_CHF82Q8W9ZRM3vwR0LvwcDdjvx-foMUBfgE=",
      "https://koldunov.com/wp-content/uploads/2021/03/08-1536x864.jpg",
      "https://koldunov.com/wp-content/uploads/2021/03/08-1536x864.jpg",
    ],
    rating: 4.5,
    inStock: true,
  },
  {
    id: 2,
    name: "Товар 2",
    price: 25000,
    images: [
      "https://via.placeholder.com/300x200/96CEB4/FFFFFF?text=Product+2",
      "https://via.placeholder.com/300x200/FFEAA7/FFFFFF?text=Product+2+Alt",
    ],
    rating: 4.2,
    inStock: true,
  },
  {
    id: 3,
    name: "Товар 3",
    price: 18000,
    images: [
      "https://via.placeholder.com/300x200/DDA0DD/FFFFFF?text=Product+3",
    ],
    rating: 4.8,
    inStock: false,
  },
  {
    id: 4,
    name: "Товар 4",
    price: 32000,
    images: [
      "https://via.placeholder.com/300x200/98D8C8/FFFFFF?text=Product+4",
      "https://via.placeholder.com/300x200/F7DC6F/FFFFFF?text=Product+4+Alt",
    ],
    rating: 4.3,
    inStock: true,
  },
  {
    id: 5,
    name: "Товар 5",
    price: 12000,
    images: [
      "https://via.placeholder.com/300x200/BB8FCE/FFFFFF?text=Product+5",
    ],
    rating: 4.1,
    inStock: true,
  },
  {
    id: 6,
    name: "Товар 6",
    price: 28000,
    images: [
      "https://via.placeholder.com/300x200/85C1E9/FFFFFF?text=Product+6",
      "https://via.placeholder.com/300x200/F8C471/FFFFFF?text=Product+6+Alt",
    ],
    rating: 4.6,
    inStock: true,
  },
  {
    id: 7,
    name: "Товар 7",
    price: 22000,
    images: [
      "https://via.placeholder.com/300x200/F1948A/FFFFFF?text=Product+7",
    ],
    rating: 4.4,
    inStock: false,
  },
  {
    id: 8,
    name: "Товар 8",
    price: 35000,
    images: [
      "https://via.placeholder.com/300x200/82E0AA/FFFFFF?text=Product+8",
      "https://via.placeholder.com/300x200/F4D03F/FFFFFF?text=Product+8+Alt",
    ],
    rating: 4.7,
    inStock: true,
  },
  {
    id: 9,
    name: "Товар 9",
    price: 19000,
    images: [
      "https://via.placeholder.com/300x200/EC7063/FFFFFF?text=Product+9",
    ],
    rating: 4.0,
    inStock: true,
  },
];

const ProductCard = ({
  product,
  onView,
  onDragStart,
  onDragEnd,
  isDragging,
  onAddToCart,
  onAddToCartWithoutCart,
}) => {
  const [isLongPress, setIsLongPress] = useState(false);
  const longPressTimer = useRef(null);
  const [quantity, setQuantity] = useState(1);
  const [showQuantityControls, setShowQuantityControls] = useState(false);

  const maxQuantity = Number(product?.quantity || 0);
  // Товар доступен только если он есть в агентских продуктах И количество > 0
  const isAvailableInAgent = product?.isAvailableInAgent === true; // явно должен быть true
  const available = isAvailableInAgent && maxQuantity > 0;

  const handleQuantityChange = (newQuantity) => {
    // Разрешаем пустое значение или 0 во время ввода
    if (newQuantity === "" || isNaN(newQuantity) || newQuantity < 1) {
      setQuantity("");
      return;
    }
    const qty = Math.min(maxQuantity || 999, Math.max(1, newQuantity));
    setQuantity(qty);
  };

  console.log('QUANTITY', maxQuantity);
  console.log('PRODUCTS', product)

  // Валидация количества при потере фокуса
  const handleQuantityBlur = () => {
    if (quantity === "" || quantity < 1 || isNaN(quantity)) {
      setQuantity(1);
    }
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

  const handleAddToCartClick = (e) => {
    e.stopPropagation();
    // Валидируем количество перед добавлением
    const validQuantity =
      quantity === "" || quantity < 1 || isNaN(quantity) ? 1 : quantity;
    if (available && validQuantity > 0 && onAddToCart) {
      onAddToCart(product, validQuantity);
      setQuantity(1);
      setShowQuantityControls(false);
    }
  };

  const handleQuickAdd = (e) => {
    e.stopPropagation();
    if (available && onAddToCart) {
      onAddToCart(product, 1);
    }
  };

  const handleAddToCartWithoutCartClick = (e) => {
    e.stopPropagation();
    // Валидируем количество перед добавлением
    const validQuantity =
      quantity === "" || quantity < 1 || isNaN(quantity) ? 1 : quantity;
    if (available && validQuantity > 0 && onAddToCartWithoutCart) {
      onAddToCartWithoutCart(product, validQuantity);
      setQuantity(1);
      setShowQuantityControls(false);
    }
  };

  const handleToggleQuantityControls = (e) => {
    e.stopPropagation();
    if (available) {
      setShowQuantityControls(!showQuantityControls);
    }
  };

  const handleMouseDown = () => {
    longPressTimer.current = setTimeout(() => {
      setIsLongPress(true);
    }, 500);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    setIsLongPress(false);
  };

  const handleMouseLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    setIsLongPress(false);
  };

  return (
    <div
      className={`product-card ${isDragging ? "dragging" : ""} ${isLongPress ? "long-press" : ""
        }`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <div className="product-image">
        {product.images?.[0]?.image_url ? (
          <img src={product.images?.[0]?.image_url} alt={product.name} />
        ) : (
          <img
            src="https://img.icons8.com/ios7/1200/no-image.jpg"
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
        {Number(product?.quantity || 0) === 0 && (
          <div className="out-of-stock">Нет в наличии</div>
        )}
      </div>
      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        <div className="product-price">
          {Number(product?.price || 0).toLocaleString()} сом
          {product?.stock === true && (
            <span className="price-discount-label">С акцией</span>
          )}
        </div>
        <div
          className="product-quantity-info"
          style={{
            marginTop: "4px",
            fontSize: "0.9rem",
            color: maxQuantity > 0 ? "#4CAF50" : "#f44336",
            fontWeight: "500",
          }}
        >
          В наличии: {maxQuantity} шт.
        </div>

        {!available ? (
          <div className="out-of-stock-message">Нет в наличии</div>
        ) : (
          <>
            {!showQuantityControls ? (
              <div className="product-cart-controls">
                {onAddToCartWithoutCart && (
                  <div className="request-buttons-row">
                    <button
                      className="request-without-cart-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (available && onAddToCartWithoutCart) {
                          onAddToCartWithoutCart(product, 1);
                        }
                      }}
                      disabled={!available}
                      title="Создать корзину и отправить"
                    >
                      <Send size={14} />
                      Без корзины
                    </button>
                    <button
                      className="request-with-cart-btn"
                      onClick={handleQuickAdd}
                      disabled={!available}
                      title="Добавить в корзину"
                    >
                      <ShoppingCart size={14} />В корзину
                    </button>
                  </div>
                )}
                {!onAddToCartWithoutCart && (
                  <button
                    className="add-to-cart-btn"
                    onClick={handleQuickAdd}
                    disabled={!available}
                  >
                    <ShoppingCart size={16} />
                    Быстро добавить
                  </button>
                )}
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
                      handleQuantityChange(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    onBlur={handleQuantityBlur}
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
                {onAddToCartWithoutCart && (
                  <div className="request-buttons-row">
                    <button
                      className="request-without-cart-btn"
                      onClick={handleAddToCartWithoutCartClick}
                      disabled={!available || quantity <= 0}
                      title="Создать корзину и отправить"
                    >
                      <Send size={14} />
                      Без корзины ({quantity})
                    </button>
                    <button
                      className="request-with-cart-btn"
                      onClick={handleAddToCartClick}
                      disabled={!available || quantity <= 0}
                      title="Добавить в корзину"
                    >
                      <ShoppingCart size={14} />В корзину ({quantity})
                    </button>
                  </div>
                )}
                {!onAddToCartWithoutCart && (
                  <button
                    className="add-to-cart-btn"
                    onClick={handleAddToCartClick}
                    disabled={!available || quantity <= 0}
                  >
                    <ShoppingCart size={16} />
                    Добавить ({quantity})
                  </button>
                )}
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

const ProductDetailModal = ({
  product,
  isOpen,
  onClose,
  onAddToCart,
  onAddToCartWithoutCart,
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // безопасно считаем заранее
  const imagesList = Array.isArray(product?.images) ? product.images : [];
  const hasImages = imagesList.length > 0;

  const maxQuantity = Number(product?.quantity || 0);
  // Товар доступен только если он есть в агентских продуктах И количество > 0
  const isAvailableInAgent = product?.isAvailableInAgent === true; // явно должен быть true
  const available = isAvailableInAgent && maxQuantity > 0;

  const handleQuantityChange = (newQuantity) => {
    // Разрешаем пустое значение или 0 во время ввода
    if (newQuantity === "" || isNaN(newQuantity) || newQuantity < 1) {
      setQuantity("");
      return;
    }
    const qty = Math.min(maxQuantity || 999, Math.max(1, newQuantity));
    setQuantity(qty);
  };

  // Валидация количества при потере фокуса
  const handleQuantityBlur = () => {
    if (quantity === "" || quantity < 1 || isNaN(quantity)) {
      setQuantity(1);
    }
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

  const handleAddToCartClick = () => {
    // Валидируем количество перед добавлением
    const validQuantity =
      quantity === "" || quantity < 1 || isNaN(quantity) ? 1 : quantity;
    if (available && validQuantity > 0 && onAddToCart) {
      onAddToCart(product, validQuantity);
      setQuantity(1);
    }
  };

  const handleQuickAdd = () => {
    if (available && onAddToCart) {
      onAddToCart(product, 1);
    }
  };

  const handleAddToCartWithoutCartClick = () => {
    // Валидируем количество перед добавлением
    const validQuantity =
      quantity === "" || quantity < 1 || isNaN(quantity) ? 1 : quantity;
    if (available && validQuantity > 0 && onAddToCartWithoutCart) {
      onAddToCartWithoutCart(product, validQuantity);
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
        handleFullScreenPrev({ stopPropagation: () => { } });
      } else if (e.key === "ArrowRight") {
        handleFullScreenNext({ stopPropagation: () => { } });
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
                    className={`thumbnail ${index === currentImageIndex ? "active" : ""
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
                        className={`fullscreen-thumbnail ${index === currentImageIndex ? "active" : ""
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
                color:
                  Number(product?.quantity || 0) > 0 ? "#4CAF50" : "#f44336",
                fontWeight: "500",
              }}
            >
              {Number(product?.quantity || 0) > 0
                ? `В наличии: ${product.quantity} шт.`
                : "Нет в наличии"}
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
                      handleQuantityChange(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    onBlur={handleQuantityBlur}
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
                {onAddToCartWithoutCart ? (
                  <>
                    <button
                      className="request-without-cart-btn-modal"
                      onClick={handleAddToCartWithoutCartClick}
                      disabled={!available || quantity <= 0}
                    >
                      <Send size={18} />
                      Без корзины ({quantity} шт.)
                    </button>
                    <button
                      className="request-with-cart-btn-modal"
                      onClick={handleAddToCartClick}
                      disabled={!available || quantity <= 0}
                    >
                      <ShoppingCart size={18} />В корзину ({quantity} шт.)
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="add-to-cart-btn"
                      onClick={handleAddToCartClick}
                      disabled={!available || quantity <= 0}
                    >
                      <ShoppingCart size={20} />
                      Добавить в корзину ({quantity} шт.)
                    </button>
                    <button
                      className="quick-add-btn"
                      onClick={handleQuickAdd}
                      disabled={!available}
                    >
                      Быстро добавить (1 шт.)
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProductionCatalog = () => {
  const alert = useAlert();
  const dispatch = useDispatch();
  const { products, loading, error, selectedProduct, filters } = useSelector(
    (state) => state.catalog
  );
  const { shifts, currentShift } = useShifts();
  const { list: cashBoxes } = useCash();
  const { profile, currentUser, userId } = useUser();

  // console.log(1, products);

  const cartItemsCount = useSelector(selectCartItemsCount);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 400);
  const [viewMode, setViewMode] = useState("grid"); // 'grid' or 'list'
  const [showFilters, setShowFilters] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [isCartSectionOpen, setIsCartSectionOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [agentCartId, setAgentCartId] = useState(null);
  const [agentCartItemsCount, setAgentCartItemsCount] = useState(0);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertType, setAlertType] = useState("success");
  const [alertMessage, setAlertMessage] = useState("");
  const [agentProducts, setAgentProducts] = useState([]);
  const [agentProductsMap, setAgentProductsMap] = useState(new Map());

  // Получаем массив продуктов из results
  const rawProductsList = Array.isArray(products?.results)
    ? products.results
    : Array.isArray(products)
      ? products
      : [];

  // Сортируем товары: сначала те, что в наличии
  const productsList = useMemo(() => {
    return [...rawProductsList].sort((a, b) => {
      // Проверяем наличие товара в агентских продуктах
      const aHasInAgent = agentProductsMap.has(a.id);
      const bHasInAgent = agentProductsMap.has(b.id);

      // Получаем количество
      const aQty = aHasInAgent ? agentProductsMap.get(a.id) ?? 0 : 0;
      const bQty = bHasInAgent ? agentProductsMap.get(b.id) ?? 0 : 0;

      // Товар в наличии, если есть в агентских продуктах и количество > 0
      const aInStock = aHasInAgent && aQty > 0;
      const bInStock = bHasInAgent && bQty > 0;

      // Сначала товары в наличии (true идет первым)
      if (aInStock && !bInStock) return -1;
      if (!aInStock && bInStock) return 1;

      // Если оба в наличии или оба не в наличии, сохраняем исходный порядок
      return 0;
    });
  }, [rawProductsList, agentProductsMap]);

  // Функция для получения товаров из корзины и обновления счетчика
  const refreshCartItems = useCallback(async () => {
    try {
      // Используем getAgentCart для получения активной корзины
      const cart = await dispatch(
        getAgentCart({ agent: null, order_discount_total: "0.00" })
      ).unwrap();
      if (cart?.items && Array.isArray(cart.items)) {
        // Подсчитываем общее количество товаров в корзине
        // Используем quantity из ответа API
        const totalQuantity = cart.items.reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0
        );
        setAgentCartItemsCount(totalQuantity);
        // Обновляем ID корзины если он изменился
        if (cart.id && cart.id !== agentCartId) {
          setAgentCartId(cart.id);
          console.log("CART ID", cart.id);
          
          localStorage.setItem("agentCartId", cart.id);
        }
      } else {
        setAgentCartItemsCount(0);
      }
    } catch (error) {
      console.error("Error fetching cart items:", error);
      setAgentCartItemsCount(0);
    }
  }, [dispatch, agentCartId]);

  // Функция для обновления агентских продуктов
  const refreshAgentProducts = useCallback(async () => {
    try {
      const result = await dispatch(getMyAgentProductsAsync()).unwrap();
      if (Array.isArray(result)) {
        setAgentProducts(result);
        // Создаем мапу product_id -> qty_on_hand
        const map = new Map();
        console.log('RESULTS AGENT PRODUCT', result);

        result.forEach((item) => {
          if (item.product && item.qty_on_hand !== undefined) {
            map.set(item.product, Number(item.qty_on_hand) || 0);
          }
        });
        setAgentProductsMap(map);
      }
    } catch (error) {
      console.error("Error refreshing agent products:", error);
    }
  }, [dispatch]);

  // helpers to parse page from DRF 'next/previous' URLs
  const getPageFromUrl = useCallback((url) => {
    try {
      if (!url) return null;
      const u = new URL(url);
      const p = u.searchParams.get("page");
      return p ? Number(p) : null;
    } catch {
      return null;
    }
  }, []);

  // derive current page whenever API payload changes
  useEffect(() => {
    if (!products) return;
    const nextPage = getPageFromUrl(products?.next);
    const prevPage = getPageFromUrl(products?.previous);
    if (nextPage) setPage(nextPage - 1);
    else if (prevPage) setPage(prevPage + 1);
    else setPage(1);
  }, [products]);

  // Загружаем товары с параметрами поиска
  useEffect(() => {
    const params = {};
    if (debouncedSearchQuery.trim()) {
      params.search = debouncedSearchQuery.trim();
    }
    // Сохраняем текущие фильтры
    if (filters) {
      Object.assign(params, filters);
    }
    dispatch(fetchProducts(params));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery, filters]);

  // Загружаем данные агентских продуктов для получения количества
  useEffect(() => {
    (async () => {
      try {
        const result = await dispatch(getMyAgentProductsAsync()).unwrap();
        if (Array.isArray(result)) {
          setAgentProducts(result);
          // Создаем мапу product_id -> qty_on_hand
          const map = new Map();
          result.forEach((item) => {
            if (item.product && item.qty_on_hand !== undefined) {
              map.set(item.product, Number(item.qty_on_hand) || 0);
            }
          });
          setAgentProductsMap(map);
        }
      } catch (error) {
        console.error("Error loading agent products:", error);
      }
    })();
  }, [dispatch]);

  // Загружаем смены и кассы при монтировании
  useEffect(() => {
    dispatch(fetchShiftsAsync());
    dispatch(getCashBoxes());
  }, [dispatch]);

  // Ensure agent cart exists once per page load: if no id in localStorage, create
  useEffect(() => {
    (async () => {
      try {
        const storedId = localStorage.getItem("agentCartId");
        if (storedId) {
          // Проверяем, существует ли корзина через getAgentCart
          try {
            const cart = await dispatch(
              getAgentCart({ agent: null, order_discount_total: "0.00" })
            ).unwrap();
            if (cart?.id) {
              setAgentCartId(cart.id);
              // Обновляем счетчик товаров
              await refreshCartItems();
              return;
            }
          } catch (e) {
            // Корзина не найдена, создадим новую
            localStorage.removeItem("agentCartId");
          }
        }
        // Создаем новую корзину
        const created = await dispatch(
          startAgentCart({
            agent: null, // или можно передать ID агента, если доступен
            order_discount_total: "0.00",
          })
        ).unwrap();
        const newId = created?.id || null;
        if (newId) {
          localStorage.setItem("agentCartId", newId);
          setAgentCartId(newId);
          setAgentCartItemsCount(0);
        }
      } catch (e) {
        // ignore; will fallback to local cart until user retries
        console.error("Error initializing agent cart:", e);
      }
    })();
  }, [dispatch, refreshCartItems]);

  // Блокировка прокрутки фона при открытии корзины (только на десктопе)
  useEffect(() => {
    // Проверяем, десктоп ли это
    const isDesktop = window.innerWidth >= 1024;

    if (isCartSectionOpen && isDesktop) {
      // Сохраняем текущую позицию прокрутки
      const scrollY = window.scrollY;
      // Блокируем прокрутку только на десктопе
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
    } else {
      // Восстанавливаем прокрутку
      const scrollY = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || "0") * -1);
      }
    }

    // Очистка при размонтировании
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
    };
  }, [isCartSectionOpen]);

  const handleViewProduct = useCallback((product) => {
    dispatch(setSelectedProduct(product));
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    dispatch(clearSelectedProduct());
  };

  const handleDragStart = (e, productId) => {
    setDraggedItem(productId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e, targetProductId) => {
    e.preventDefault();

    if (draggedItem && draggedItem !== targetProductId) {
      const draggedIndex = productsList.findIndex((p) => p.id === draggedItem);
      const targetIndex = productsList.findIndex(
        (p) => p.id === targetProductId
      );

      const newProducts = [...productsList];
      const draggedProduct = newProducts[draggedIndex];

      newProducts.splice(draggedIndex, 1);
      newProducts.splice(targetIndex, 0, draggedProduct);

      // Обновляем локальное состояние
      dispatch(reorderProducts(newProducts));

      // Отправляем на сервер
      const productsOrder = newProducts.map((product, index) => ({
        id: product.id,
        order: index,
      }));

      try {
        await dispatch(updateProductsOrder(productsOrder));
      } catch (error) {
        console.error("Ошибка при обновлении порядка товаров:", error);
      }
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    // Поиск обрабатывается через debounce и useEffect
  };

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    dispatch(clearFilters());
    dispatch(fetchProducts());
  }, []);

  const handleFilterChange = (filterType, value) => {
    const newFilters = { ...filters, [filterType]: value };
    dispatch(setFilters(newFilters));
    const params = { ...newFilters };
    if (debouncedSearchQuery.trim()) {
      params.search = debouncedSearchQuery.trim();
    }
    dispatch(fetchProducts(params));
  };

  const clearAllFilters = useCallback(() => {
    dispatch(clearFilters());
    setSearchQuery("");
    dispatch(fetchProducts());
  }, []);

  // Pagination controls
  const { totalPages, canPrev, canNext } = useMemo(() => {
    const pageSize = productsList.length || 1;
    const totalPages = products?.count
      ? Math.max(1, Math.ceil(products.count / pageSize))
      : 1;
    const canPrev = Boolean(products?.previous) || page > 1;
    const canNext = Boolean(products?.next) || page < totalPages;
    return { totalPages, canNext, canPrev }
  }, [productsList, products, page]);

  const gotoPage = useCallback((p) => {
    const target = Math.min(Math.max(1, p), totalPages);
    setPage(target);
    // keep current filters applied
    dispatch(fetchProducts({ ...(filters || {}), page: target }));
  }, [totalPages, filters]);

  const handleAddToCart = async (product, quantity = 1) => {
    try {
      // Try server-backed agent cart first; fallback to local cart if not available
      let cartId = agentCartId || localStorage.getItem("agentCartId");
      console.log('CARTID');

      if (!cartId) {
        // Создаем новую корзину, если её нет
        const created = await dispatch(
          startAgentCart({
            agent: null,
            order_discount_total: "0.00",
          })
        ).unwrap();
        cartId = created?.id || null;
        if (cartId) {
          localStorage.setItem("agentCartId", cartId);
          setAgentCartId(cartId);
        }
      }

      if (cartId) {
        // Добавляем товар в корзину агента - возвращает обновленную корзину
        const updated = await dispatch(
          addProductToAgentCart({
            cartId: cartId,
            product_id: product.id,
            quantity: quantity,
            // Можно передать discount_total и unit_price, если нужны
            // discount_total: product.discount_total,
            // unit_price: product.price,
          })
        ).unwrap();

        // Используем возвращенные данные для обновления счетчика
        if (updated?.items && Array.isArray(updated.items)) {
          const totalQuantity = updated.items.reduce(
            (sum, item) => sum + Number(item.quantity || 0),
            0
          );
          setAgentCartItemsCount(totalQuantity);
          // Обновляем ID корзины если он изменился
          if (updated.id && updated.id !== cartId) {
            setAgentCartId(updated.id);
            localStorage.setItem("agentCartId", updated.id);
          }
        } else {
          // Если данных нет, обновляем через refreshCartItems
          await refreshCartItems();
        }

        // Анимация кнопки корзины
        const cartBtn = document.querySelector(".cart-btn");
        if (cartBtn) {
          cartBtn.style.transform = "scale(1.1)";
          setTimeout(() => {
            cartBtn.style.transform = "scale(1)";
          }, 200);
        }
      } else {
        // Fallback to local cart if agent cart creation failed
        dispatch(addToCart({ product, quantity, store: "Default Store" }));
      }
    } catch (error) {
      alert(error?.data?.detail || 'Ошибка при добавлении в корзину!')
      console.error("Error adding product to cart:", error);
      // Fallback to local cart on error
      dispatch(addToCart({ product, quantity, store: "Default Store" }));
    }
  };

  // Функция для проверки и открытия смены
  const ensureShiftIsOpen = async () => {
    // Проверяем наличие открытой смены
    const openShift = shifts.find((s) => s.status === "open") || currentShift;

    if (openShift) {
      return; // Смена уже открыта
    }

    // Если смены нет, открываем её
    let availableCashBoxes = cashBoxes;
    if (!availableCashBoxes || availableCashBoxes.length === 0) {
      // Загружаем кассы, если их нет
      availableCashBoxes = await dispatch(getCashBoxes()).unwrap();
      if (!availableCashBoxes || availableCashBoxes.length === 0) {
        throw new Error(
          "Нет доступных касс. Пожалуйста, создайте кассу перед началом смены."
        );
      }
    }

    const firstCashBox = availableCashBoxes[0];
    const cashboxId = firstCashBox?.id;

    if (!cashboxId) {
      throw new Error("Не удалось определить кассу");
    }

    const cashierId = currentUser?.id || userId || profile?.id;

    if (!cashierId) {
      throw new Error("Не удалось определить кассира");
    }

    // Открываем смену с нулевой суммой
    await dispatch(
      openShiftAsync({
        cashbox: cashboxId,
        cashier: cashierId,
        opening_cash: "0",
      })
    ).unwrap();

    // Обновляем список смен
    await dispatch(fetchShiftsAsync());
  };

  // Добавление в корзину без сохранения (создать корзину, добавить товар, отправить)
  const handleAddToCartWithoutCart = async (product, quantity = 1) => {
    if (!product || !product.id || quantity <= 0) return;

    try {
      // Проверяем и открываем смену перед оформлением заказа
      await ensureShiftIsOpen();

      // Создаем новую корзину
      const created = await dispatch(
        startAgentCart({
          agent: null,
          order_discount_total: "0.00",
        })
      ).unwrap();
      const tempCartId = created?.id || null;

      if (!tempCartId) {
        setAlertType("error");
        setAlertMessage("Не удалось создать корзину");
        setAlertOpen(true);
        return;
      }

      // Добавляем товар в корзину используя тот же метод, что и в обычном добавлении
      const updated = await dispatch(
        addProductToAgentCart({
          cartId: tempCartId,
          product_id: product.id,
          quantity: quantity,
        })
      ).unwrap();

      // Оформляем заказ без клиента (используя тот же метод, что и в Cart.jsx)
      await dispatch(
        checkoutAgentCart({
          cartId: tempCartId,
          print_receipt: false,
          // client_id не передаем, так как это быстрый заказ без корзины
        })
      ).unwrap();

      // Показываем уведомление об успешной отправке
      setAlertType("success");
      setAlertMessage(
        `Заказ на товар "${product.name}" (${quantity} шт.) успешно отправлен!`
      );
      setAlertOpen(true);

      // Обновляем текущую корзину (создаем новую пустую)
      const newCart = await dispatch(
        startAgentCart({
          agent: null,
          order_discount_total: "0.00",
        })
      ).unwrap();
      if (newCart?.id) {
        localStorage.setItem("agentCartId", newCart.id);
        setAgentCartId(newCart.id);
        setAgentCartItemsCount(0);
      }

      // Обновляем список товаров
      dispatch(fetchProducts());
      refreshAgentProducts();
    } catch (error) {
      console.error("Error adding to cart without saving:", error);
      const errorMessage =
        error?.response?.data?.shift_id?.[0] ||
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        "Не удалось отправить заказ";
      setAlertType("error");
      setAlertMessage(errorMessage);
      setAlertOpen(true);
    }
  };

  const handleOpenCart = async () => {
    try {
      let cid = agentCartId || localStorage.getItem("agentCartId");
      if (!cid) {
        // Создаем новую корзину, если её нет
        const created = await dispatch(
          startAgentCart({
            agent: null,
            order_discount_total: "0.00",
          })
        ).unwrap();
        cid = created?.id || null;
        if (cid) {
          localStorage.setItem("agentCartId", cid);
          setAgentCartId(cid);
          setAgentCartItemsCount(0);
        }
      } else {
        setAgentCartId(cid);
        // Обновляем счетчик товаров при открытии корзины
        await refreshCartItems();
      }
    } catch (e) {
      console.error("Error opening cart:", e);
      // keep null; component will fallback to local items
    } finally {
      setIsCartSectionOpen(true);
    }
  };

  const handleCloseCart = () => {
    setIsCartSectionOpen(false);
  };

  const handleNotify = (type, message) => {
    setIsCartSectionOpen(false);
    setAlertType(type || "success");
    setAlertMessage(message || "");
    // ensure next open starts fresh if needed
    setAgentCartId(null);

    // При успешном оформлении заказа обновляем список товаров
    if (type === "success") {
      dispatch(fetchProducts());
      refreshAgentProducts();
    }

    setTimeout(() => setAlertOpen(true), 150);
  };

  useEffect(() => {
    refreshAgentProducts();
  }, [])
  return (
    <div className="production-catalog">
      {/* <div className="catalog-header">
        <h1>Каталог товаров</h1>
        <p>Перетащите товары для изменения порядка</p>
      </div> */}

      {/* Панель поиска и фильтров */}
      <div className="catalog-controls">
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-group">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="Поиск товаров..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {(searchQuery || filters?.search) && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="clear-search-btn"
                title="Очистить поиск"
              >
                <X size={18} />
              </button>
            )}
            <button type="submit" className="search-btn">
              Найти
            </button>
          </div>
        </form>

        <div className="controls-right">
          {/* <button
            className={`filter-btn ${showFilters ? "active" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={20} />
            Фильтры
          </button> */}

          <button className="cart-btn" onClick={handleOpenCart}>
            <ShoppingCart size={20} />
            Корзина
            {(agentCartItemsCount > 0 || cartItemsCount > 0) && (
              <span className="cart-badge">
                {agentCartItemsCount > 0 ? agentCartItemsCount : cartItemsCount}
              </span>
            )}
          </button>

          <div className="view-mode-toggle">
            <button
              className={`view-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
            >
              <Grid size={20} />
            </button>
            <button
              className={`view-btn ${viewMode === "list" ? "active" : ""}`}
              onClick={() => setViewMode("list")}
            >
              <List size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Панель фильтров */}
      {showFilters && (
        <div className="filters-panel">
          <div className="filter-group">
            <label>Категория:</label>
            <select
              value={(filters || {}).category || ""}
              onChange={(e) => handleFilterChange("category", e.target.value)}
            >
              <option value="">Все категории</option>
              {/* Здесь будут категории из API */}
            </select>
          </div>

          <div className="filter-group">
            <label>Бренд:</label>
            <select
              value={(filters || {}).brand || ""}
              onChange={(e) => handleFilterChange("brand", e.target.value)}
            >
              <option value="">Все бренды</option>
              {/* Здесь будут бренды из API */}
            </select>
          </div>

          <div className="filter-group">
            <label>Наличие:</label>
            <select
              value={(filters || {}).inStock || ""}
              onChange={(e) => handleFilterChange("inStock", e.target.value)}
            >
              <option value="">Все товары</option>
              <option value="true">В наличии</option>
              <option value="false">Нет в наличии</option>
            </select>
          </div>

          <button className="clear-filters-btn" onClick={clearAllFilters}>
            Очистить фильтры
          </button>
        </div>
      )}

      {/* Состояние загрузки */}
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Загрузка товаров...</p>
        </div>
      )}

      {/* Состояние ошибки */}
      {error && (
        <div className="error-state">
          <p>Ошибка: {error}</p>
          <button onClick={() => dispatch(fetchProducts())}>
            Попробовать снова
          </button>
        </div>
      )}

      {/* Сетка товаров */}
      {!loading && !error && (
        <div className={`products-container ${viewMode}`}>
          {productsList.length === 0 ? (
            <div className="empty-state">
              <p>Товары не найдены</p>
              <button onClick={clearAllFilters}>Показать все товары</button>
            </div>
          ) : (
            <div className={`products-grid ${viewMode}`}>
              {productsList.map((product) => {
                // Проверяем, есть ли товар в мапе агентских продуктов
                const hasInAgentProducts = agentProductsMap.has(product.id);
                // Получаем количество из мапы агентских продуктов
                // Если товара нет в мапе, количество = 0 и он недоступен
                const agentQty = hasInAgentProducts
                  ? agentProductsMap.get(product.id) ?? 0
                  : 0;
                // Обогащаем продукт количеством из агентских продуктов
                const enrichedProduct = {
                  ...product,
                  quantity: agentQty,
                  isAvailableInAgent: hasInAgentProducts, // Флаг наличия в агентских продуктах
                };
                return (
                  <div
                    key={product.id}
                    className="grid-item"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, product.id)}
                  >
                    <ProductCard
                      product={enrichedProduct}
                      onView={handleViewProduct}
                      onDragStart={(e) => handleDragStart(e, product.id)}
                      onDragEnd={handleDragEnd}
                      isDragging={draggedItem === product.id}
                      onAddToCart={handleAddToCart}
                      onAddToCartWithoutCart={handleAddToCartWithoutCart}
                    />
                  </div>
                );
              })}
            </div>
          )}
          {/* Pagination */}
          <div
            className="catalog-pagination"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              marginTop: 16,
              flexWrap: "wrap",
            }}
          >
            <button
              className="page-btn"
              disabled={!canPrev}
              onClick={() => gotoPage(1)}
              title="Первая страница"
            >
              «
            </button>
            <button
              className="page-btn"
              disabled={!canPrev}
              onClick={() => gotoPage(page - 1)}
              title="Предыдущая страница"
            >
              ‹
            </button>
            <span style={{ opacity: 0.8 }}>
              Стр. {page} из {totalPages}
            </span>
            <button
              className="page-btn"
              disabled={!canNext}
              onClick={() => gotoPage(page + 1)}
              title="Следующая страница"
            >
              ›
            </button>
            <button
              className="page-btn"
              disabled={!canNext}
              onClick={() => gotoPage(totalPages)}
              title="Последняя страница"
            >
              »
            </button>
          </div>
        </div>
      )}

      <ProductDetailModal
        product={
          selectedProduct
            ? {
              ...selectedProduct,
              quantity: agentProductsMap.has(selectedProduct.id)
                ? agentProductsMap.get(selectedProduct.id) ?? 0
                : 0,
              isAvailableInAgent: agentProductsMap.has(selectedProduct.id),
            }
            : null
        }
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onAddToCart={handleAddToCart}
        onAddToCartWithoutCart={handleAddToCartWithoutCart}
      />

      {/* Компонент корзины - всегда рендерится, но секция заказа открывается условно */}
      <Cart
        agentCartId={agentCartId}
        onNotify={handleNotify}
        onClose={handleCloseCart}
        isOpen={isCartSectionOpen}
        onOpenChange={setIsCartSectionOpen}
        totalItemsCount={
          agentCartItemsCount > 0 ? agentCartItemsCount : cartItemsCount
        }
      />

      <AlertModal
        open={alertOpen}
        type={alertType}
        message={alertMessage}
        onClose={() => setAlertOpen(false)}
      />
    </div>
  );
};

export default ProductionCatalog;
