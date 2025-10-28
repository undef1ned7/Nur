import React, { useState, useRef, useEffect } from "react";
import {
  Eye,
  Heart,
  ShoppingCart,
  Star,
  Search,
  Filter,
  Grid,
  List,
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
import Cart from "./Cart";
import "./ProductionCatalog.scss";

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
}) => {
  const [isLongPress, setIsLongPress] = useState(false);
  const longPressTimer = useRef(null);

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
      className={`product-card ${isDragging ? "dragging" : ""} ${
        isLongPress ? "long-press" : ""
      }`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <div className="product-image">
        <img src={product.images[0]} alt={product.name} />
        <div className="product-overlay">
          <button className="view-btn" onClick={() => onView(product)}>
            <Eye size={20} />
          </button>
        </div>
        {!product?.inStock && <div className="out-of-stock">Нет в наличии</div>}
      </div>
      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        <div className="product-rating">
          <Star size={16} fill="#FFD700" />
          <span>{product?.rating}</span>
        </div>
        <div className="product-price">
          {product?.price.toLocaleString()} сом
        </div>
        <button
          className="add-to-cart-btn"
          onClick={() => onAddToCart && onAddToCart(product)}
          disabled={!product?.inStock}
        >
          <ShoppingCart size={16} />
          {product?.inStock ? "В корзину" : "Нет в наличии"}
        </button>
      </div>
    </div>
  );
};

const ProductDetailModal = ({ product, isOpen, onClose }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (!isOpen || !product) return null;

  const nextImage = () => {
    setCurrentImageIndex((prev) =>
      prev === product.images.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? product.images.length - 1 : prev - 1
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
              <img src={product.images[currentImageIndex]} alt={product.name} />
              {product.images.length > 1 && (
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

            {product.images.length > 1 && (
              <div className="thumbnail-list">
                {product.images.map((image, index) => (
                  <img
                    key={index}
                    src={image}
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
            <div className="rating">
              <Star size={20} fill="#FFD700" />
              <span>{product.rating}</span>
            </div>
            <div className="price">{product.price.toLocaleString()} сом</div>
            <div className="stock-status">
              {product.inStock ? "В наличии" : "Нет в наличии"}
            </div>
            <button className="add-to-cart-btn" disabled={!product.inStock}>
              <ShoppingCart size={20} />
              {product.inStock ? "Добавить в корзину" : "Нет в наличии"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProductionCatalog = () => {
  const dispatch = useDispatch();
  const { products, loading, error, selectedProduct, filters } = useSelector(
    (state) => state.catalog
  );
  const cartItemsCount = useSelector(selectCartItemsCount);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' or 'list'
  const [showFilters, setShowFilters] = useState(false);
  const [showCart, setShowCart] = useState(false);

  // Загружаем товары при монтировании компонента
  useEffect(() => {
    dispatch(fetchProducts());
  }, [dispatch]);

  const handleViewProduct = (product) => {
    dispatch(setSelectedProduct(product));
    setIsModalOpen(true);
  };

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
      const draggedIndex = (products || []).findIndex(
        (p) => p.id === draggedItem
      );
      const targetIndex = (products || []).findIndex(
        (p) => p.id === targetProductId
      );

      const newProducts = [...(products || [])];
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
    if (searchQuery.trim()) {
      dispatch(setFilters({ search: searchQuery.trim() }));
      dispatch(fetchProducts({ search: searchQuery.trim() }));
    }
  };

  const handleFilterChange = (filterType, value) => {
    dispatch(setFilters({ [filterType]: value }));
    dispatch(fetchProducts({ [filterType]: value }));
  };

  const clearAllFilters = () => {
    dispatch(clearFilters());
    setSearchQuery("");
    dispatch(fetchProducts());
  };

  const handleAddToCart = (product) => {
    dispatch(
      addToCart({
        product,
        quantity: 1,
        store: "Default Store",
      })
    );

    // Анимация кнопки корзины
    const cartBtn = document.querySelector(".cart-btn");
    if (cartBtn) {
      cartBtn.style.transform = "scale(1.1)";
      setTimeout(() => {
        cartBtn.style.transform = "scale(1)";
      }, 200);
    }
  };

  const handleOpenCart = () => {
    setShowCart(true);
  };

  const handleCloseCart = () => {
    setShowCart(false);
  };

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
            <button type="submit" className="search-btn">
              Найти
            </button>
          </div>
        </form>

        <div className="controls-right">
          <button
            className={`filter-btn ${showFilters ? "active" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={20} />
            Фильтры
          </button>

          <button className="cart-btn" onClick={handleOpenCart}>
            <ShoppingCart size={20} />
            Корзина
            {cartItemsCount > 0 && (
              <span className="cart-badge">{cartItemsCount}</span>
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
          {(products || []).length === 0 ? (
            <div className="empty-state">
              <p>Товары не найдены</p>
              <button onClick={clearAllFilters}>Показать все товары</button>
            </div>
          ) : (
            <div className={`products-grid ${viewMode}`}>
              {(mockProducts || []).map((product) => (
                <div
                  key={product.id}
                  className="grid-item"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, product.id)}
                >
                  <ProductCard
                    product={product}
                    onView={handleViewProduct}
                    onDragStart={(e) => handleDragStart(e, product.id)}
                    onDragEnd={handleDragEnd}
                    isDragging={draggedItem === product.id}
                    onAddToCart={handleAddToCart}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ProductDetailModal
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />

      {/* Модальное окно корзины */}
      {showCart && (
        <div className="cart-modal-overlay" onClick={handleCloseCart}>
          <div className="cart-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cart-modal-header">
              <h2>Корзина</h2>
              <button className="close-cart-btn" onClick={handleCloseCart}>
                ×
              </button>
            </div>
            <div className="cart-modal-content">
              <Cart />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionCatalog;
