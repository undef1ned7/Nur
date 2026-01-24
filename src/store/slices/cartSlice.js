import { createSlice } from "@reduxjs/toolkit";

// Начальное состояние корзины
const initialState = {
  items: [],
  selectedClient: null,
  loading: false,
  error: null,
};

// Слайс корзины
const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    // Добавить товар в корзину
    addToCart: (state, action) => {
      const { product, quantity = 1, store = "Default Store" } = action.payload;
      const existingItem = state.items.find(
        (item) => item.product.id === product.id
      );

      if (existingItem) {
        existingItem.quantity += quantity;
        existingItem.total = existingItem.product.price * existingItem.quantity;
      } else {
        state.items.push({
          id: Date.now(), // Временный ID
          product,
          quantity,
          store,
          total: product.price * quantity,
        });
      }
    },

    // Обновить количество товара
    updateQuantity: (state, action) => {
      const { itemId, quantity } = action.payload;
      const item = state.items.find((item) => item.id === itemId);

      if (item) {
        item.quantity = quantity;
        item.total = item.product.price * quantity;
      }
    },

    // Удалить товар из корзины
    removeFromCart: (state, action) => {
      const itemId = action.payload;
      state.items = state.items.filter((item) => item.id !== itemId);
    },

    // Очистить корзину
    clearCart: (state) => {
      state.items = [];
    },

    // Выбрать клиента
    selectClient: (state, action) => {
      state.selectedClient = action.payload;
    },

    // Очистить выбор клиента
    clearSelectedClient: (state) => {
      state.selectedClient = null;
    },

    // Установить состояние загрузки
    setLoading: (state, action) => {
      state.loading = action.payload;
    },

    // Установить ошибку
    setError: (state, action) => {
      state.error = action.payload;
    },

    // Очистить ошибку
    clearError: (state) => {
      state.error = null;
    },

    // Загрузить корзину из localStorage
    loadCartFromStorage: (state, action) => {
      state.items = action.payload || [];
    },

    // Сохранить корзину в localStorage
    saveCartToStorage: (state) => {
      localStorage.setItem("cart", JSON.stringify(state.items));
    },
  },
});

export const {
  addToCart,
  updateQuantity,
  removeFromCart,
  clearCart,
  selectClient,
  clearSelectedClient,
  setLoading,
  setError,
  clearError,
  loadCartFromStorage,
  saveCartToStorage,
} = cartSlice.actions;

// Селекторы
export const selectCartItems = (state) => state.cart.items;
export const selectCartTotal = (state) => {
  return state.cart.items.reduce((total, item) => total + item.total, 0);
};
export const selectCartItemsCount = (state) => {
  return state.cart.items.reduce((count, item) => count + item?.quantity, 0);
};
export const selectSelectedClient = (state) => state.cart.selectedClient;
export const selectCartLoading = (state) => state.cart.loading;
export const selectCartError = (state) => state.cart.error;

export default cartSlice.reducer;
