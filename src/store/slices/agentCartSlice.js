import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import {
  startAgentCart,
  scanProductInCart,
  addProductToAgentCart,
  addCustomItemToAgentCart,
  checkoutAgentCart,
  getAgentCart,
  removeItemFromAgentCart,
  updateAgentCartItemQuantity,
} from "../creators/agentCartCreators";

const initialState = {
  currentCart: null,
  selectedAgent: null,
  items: [],
  loading: false,
  error: null,
  subtotal: "0.00",
  order_discount_total: "0.00",
  total: "0.00",
};

const agentCartSlice = createSlice({
  name: "agentCart",
  initialState,
  reducers: {
    setSelectedAgent: (state, action) => {
      state.selectedAgent = action.payload;
    },
    clearCart: (state) => {
      state.currentCart = null;
      state.items = [];
      state.subtotal = "0.00";
      state.order_discount_total = "0.00";
      state.total = "0.00";
      state.selectedAgent = null;
    },
    setCartData: (state, action) => {
      const { items, subtotal, order_discount_total, total } = action.payload;
      state.items = items || [];
      state.subtotal = subtotal || "0.00";
      state.order_discount_total = order_discount_total || "0.00";
      state.total = total || "0.00";
    },
  },
  extraReducers: (builder) => {
    builder
      // Start cart
      .addCase(startAgentCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(startAgentCart.fulfilled, (state, action) => {
        state.loading = false;
        state.currentCart = action.payload;
        state.items = action.payload.items || [];
        state.subtotal = action.payload.subtotal || "0.00";
        state.order_discount_total =
          action.payload.order_discount_total || "0.00";
        state.total = action.payload.total || "0.00";
      })
      .addCase(startAgentCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Scan product
      .addCase(scanProductInCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(scanProductInCart.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items || state.items;
        state.subtotal = action.payload.subtotal || state.subtotal;
        state.order_discount_total =
          action.payload.order_discount_total || state.order_discount_total;
        state.total = action.payload.total || state.total;
      })
      .addCase(scanProductInCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Add product
      .addCase(addProductToAgentCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addProductToAgentCart.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items || state.items;
        state.subtotal = action.payload.subtotal || state.subtotal;
        state.order_discount_total =
          action.payload.order_discount_total || state.order_discount_total;
        state.total = action.payload.total || state.total;
      })
      .addCase(addProductToAgentCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Add custom item
      .addCase(addCustomItemToAgentCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addCustomItemToAgentCart.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items || state.items;
        state.subtotal = action.payload.subtotal || state.subtotal;
        state.order_discount_total =
          action.payload.order_discount_total || state.order_discount_total;
        state.total = action.payload.total || state.total;
      })
      .addCase(addCustomItemToAgentCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Checkout
      .addCase(checkoutAgentCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(checkoutAgentCart.fulfilled, (state, action) => {
        state.loading = false;
        // После успешного чекаута очищаем корзину
        state.currentCart = null;
        state.items = [];
        state.subtotal = "0.00";
        state.order_discount_total = "0.00";
        state.total = "0.00";
      })
      .addCase(checkoutAgentCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Get cart
      .addCase(getAgentCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAgentCart.fulfilled, (state, action) => {
        state.loading = false;
        state.currentCart = action.payload;
        state.items = action.payload.items || [];
        state.subtotal = action.payload.subtotal || "0.00";
        state.order_discount_total =
          action.payload.order_discount_total || "0.00";
        state.total = action.payload.total || "0.00";
      })
      .addCase(getAgentCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Remove item
      .addCase(removeItemFromAgentCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeItemFromAgentCart.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items || state.items;
        state.subtotal = action.payload.subtotal || state.subtotal;
        state.order_discount_total =
          action.payload.order_discount_total || state.order_discount_total;
        state.total = action.payload.total || state.total;
      })
      .addCase(removeItemFromAgentCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Update item quantity
      .addCase(updateAgentCartItemQuantity.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateAgentCartItemQuantity.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items || state.items;
        state.subtotal = action.payload.subtotal || state.subtotal;
        state.order_discount_total =
          action.payload.order_discount_total || state.order_discount_total;
        state.total = action.payload.total || state.total;
      })
      .addCase(updateAgentCartItemQuantity.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { setSelectedAgent, clearCart, setCartData } =
  agentCartSlice.actions;

// Селектор для использования в компонентах
export const useAgentCart = () => {
  const state = useSelector((state) => state.agentCart);
  return state;
};

export default agentCartSlice.reducer;
