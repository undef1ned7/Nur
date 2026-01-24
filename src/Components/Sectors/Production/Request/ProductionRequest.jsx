import React, { useState, useEffect, useMemo, useRef } from "react";
import { useDispatch } from "react-redux";
import { fetchProductsAsync } from "../../../../store/creators/productCreators";
import { useProducts } from "../../../../store/slices/productSlice";
import { useUser } from "../../../../store/slices/userSlice";
import {
  createAgentCartItem,
  submitAgentCartById,
} from "../../../../api/agentCarts";
import { useCart } from "./hooks/useCart";
import ProductCard from "./components/ProductCard/ProductCard";
import ProductDetailModal from "./components/ProductDetailModal/ProductDetailModal";
import CatalogControls from "./components/CatalogControls/CatalogControls";
import ProductsGrid from "./components/ProductsGrid/ProductsGrid";
import RequestCart from "./RequestCart";
import AlertModal from "../../../common/AlertModal/AlertModal";
import "./ProductionRequest.scss";

const ProductionRequest = () => {
  const dispatch = useDispatch();
  const { list: products, categories, loading, error } = useProducts();
  const { profile } = useUser();

  // Проверяем, является ли пользователь владельцем
  const isOwner = profile?.role_display === "Владелец";

  // Состояние UI
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [showCart, setShowCart] = useState(false);
  const [isCartSectionOpen, setIsCartSectionOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertType, setAlertType] = useState("success");
  const [alertMessage, setAlertMessage] = useState("");
  const debounceTimerRef = useRef(null);

  // Хук для работы с корзиной
  const {
    cartId,
    cartItems,
    cartLoading,
    createNewCart,
    loadOrCreateCart,
    refreshCart,
  } = useCart();

  // Инициализация корзины при монтировании
  useEffect(() => {
    loadOrCreateCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Debounce для поиска
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  // Загружаем товары с параметрами поиска и категории
  useEffect(() => {
    const params = {};
    if (debouncedSearchQuery.trim()) {
      params.search = debouncedSearchQuery.trim();
    }
    if (categoryFilter) {
      params.category = categoryFilter;
    }
    dispatch(fetchProductsAsync(params));
  }, [dispatch, debouncedSearchQuery, categoryFilter]);

  // Обработчики событий
  const handleViewProduct = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const handleDragStart = (e, productId) => {
    setDraggedItem(productId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setCategoryFilter("");
  };

  // Запрос с корзиной (обычная функция)
  const handleRequestWithCart = async (product, quantity = 1) => {
    if (!product || !product.id || quantity <= 0) return;
    if (!cartId) {
      setAlertType("error");
      setAlertMessage("Корзина не загружена. Пожалуйста, обновите страницу.");
      setAlertOpen(true);
      return;
    }

    try {
      // Проверяем, есть ли уже такой товар в корзине
      const existingItem = cartItems.find(
        (item) => item.product === product.id
      );

      if (existingItem) {
        // Если товар уже есть, обновляем количество через API
        const { updateAgentCartItemById } = await import(
          "../../../../api/agentCarts"
        );
        const newQuantity = (existingItem.quantity_requested || 0) + quantity;
        await updateAgentCartItemById(existingItem.id, {
          quantity_requested: newQuantity,
        });
      } else {
        // Если товара нет, добавляем новый через API
        await createAgentCartItem({
          cart: cartId,
          product: product.id,
          quantity_requested: quantity,
        });
      }

      // Обновляем данные корзины
      await refreshCart();

      // Показываем уведомление об успешном добавлении
      setAlertType("success");
      setAlertMessage(
        `Товар "${product.name}" добавлен в запрос (${quantity} шт.)`
      );
      setAlertOpen(true);

      // Анимация кнопки корзины
      const cartBtn = document.querySelector(".request-cart-btn");
      if (cartBtn) {
        cartBtn.style.transform = "scale(1.1)";
        setTimeout(() => {
          cartBtn.style.transform = "scale(1)";
        }, 200);
      }
    } catch (error) {
      console.log(error.response.data);
      const firstErrorEntry = Object.values(error?.response?.data || {})[0];
      const errorMessage =
        (Array.isArray(firstErrorEntry) ? firstErrorEntry[0] : firstErrorEntry) ||
        "Не удалось добавить товар в запрос";
      setAlertType("error");
      setAlertMessage(errorMessage);
      setAlertOpen(true);
    }
  };

  // Запрос без корзины (создать корзину, добавить товар, отправить)
  const handleRequestWithoutCart = async (product, quantity = 1) => {
    if (!product || !product.id || quantity <= 0) return;

    try {
      // Создаем новую корзину
      const newCart = await createNewCart();
      const tempCartId = newCart.id;

      // Добавляем товар в корзину
      await createAgentCartItem({
        cart: tempCartId,
        product: product.id,
        quantity_requested: quantity,
      });

      // Отправляем корзину
      await submitAgentCartById(tempCartId);

      // Показываем уведомление об успешной отправке
      setAlertType("success");
      setAlertMessage(
        `Запрос на товар "${product.name}" (${quantity} шт.) успешно отправлен!`
      );
      setAlertOpen(true);

      // Обновляем текущую корзину (создаем новую пустую)
      await loadOrCreateCart();
    } catch (error) {
      console.error("Error requesting without cart:", error);
      const errorMessage =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        "Не удалось отправить запрос";
      setAlertType("error");
      setAlertMessage(errorMessage);
      setAlertOpen(true);
    }
  };

  const handleOpenCart = () => {
    setIsCartSectionOpen(true);
  };

  const handleCloseCart = () => {
    setIsCartSectionOpen(false);
  };

  // Вычисляем количество товаров (позиций) в корзине
  const totalItemsCount = useMemo(() => {
    return cartItems ? cartItems.length : 0;
  }, [cartItems]);

  const handleNotify = async (type, message) => {
    setIsCartSectionOpen(false);
    setAlertType(type || "success");
    setAlertMessage(message || "");

    // Если запрос успешно отправлен, создаем новую корзину
    if (type === "success") {
      await createNewCart();
    }

    setTimeout(() => setAlertOpen(true), 150);
  };

  // Функция для обновления количества товара в корзине
  const handleUpdateItemQuantity = async (itemId, newQuantity) => {
    if (!cartId) return;

    try {
      if (newQuantity <= 0) {
        // Удаляем товар, если количество <= 0
        const { deleteAgentCartItemById } = await import(
          "../../../../api/agentCarts"
        );
        await deleteAgentCartItemById(itemId);
      } else {
        // Обновляем количество через API
        const { updateAgentCartItemById } = await import(
          "../../../../api/agentCarts"
        );
        await updateAgentCartItemById(itemId, {
          quantity_requested: newQuantity,
        });
      }
      // Обновляем данные корзины
      await refreshCart();
    } catch (error) {
      console.error("Error updating item quantity:", error);
      const errorMessage =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        "Не удалось обновить количество";
      setAlertType("error");
      setAlertMessage(errorMessage);
      setAlertOpen(true);
    }
  };

  // Функция для удаления товара из корзины
  const handleRemoveItem = async (itemId) => {
    if (!cartId) return;

    try {
      const { deleteAgentCartItemById } = await import(
        "../../../../api/agentCarts"
      );
      await deleteAgentCartItemById(itemId);
      // Обновляем данные корзины
      await refreshCart();
    } catch (error) {
      console.error("Error removing item:", error);
      const errorMessage =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        "Не удалось удалить товар";
      setAlertType("error");
      setAlertMessage(errorMessage);
      setAlertOpen(true);
    }
  };

  const [isMobileView, setIsMobileView] = useState(false);

  return (
    <div className="production-request">
      <CatalogControls
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onClearSearch={handleClearSearch}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        categories={categories}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onOpenCart={handleOpenCart}
        totalItemsCount={totalItemsCount}
        hideCartButton={isMobileView}
      />

      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Загрузка товаров...</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>Ошибка: {error}</p>
        </div>
      )}

      {!loading && !error && (
        <ProductsGrid
          products={products || []}
          viewMode={viewMode}
          onViewProduct={handleViewProduct}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          draggedItem={draggedItem}
          onRequestWithCart={handleRequestWithCart}
          onRequestWithoutCart={handleRequestWithoutCart}
          onClearSearch={handleClearSearch}
          isOwner={isOwner}
        />
      )}

      <ProductDetailModal
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onRequestWithCart={handleRequestWithCart}
        onRequestWithoutCart={handleRequestWithoutCart}
      />

      <RequestCart
        cartId={cartId}
        items={cartItems}
        onUpdateQuantity={handleUpdateItemQuantity}
        onRemoveItem={handleRemoveItem}
        onNotify={handleNotify}
        onRefresh={refreshCart}
        onCreateNewCart={createNewCart}
        onClose={handleCloseCart}
        isOpen={isCartSectionOpen}
        onOpenChange={setIsCartSectionOpen}
        totalItemsCount={totalItemsCount}
        onMobileOrderSectionChange={setIsMobileView}
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

export default ProductionRequest;
