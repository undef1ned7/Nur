import { createAsyncThunk } from "@reduxjs/toolkit";
import * as agentCartApi from "../../api/agentCarts";

const plainAxiosError = (error) => ({
  message: error?.message,
  code: error?.code,
  status: error?.response?.status,
  data: error?.response?.data,
  url: error?.config?.url,
  method: error?.config?.method,
});

// Создать/получить активную корзину и выбрать агента
export const startAgentCart = createAsyncThunk(
  "agentCart/start",
  async ({ agent, order_discount_total = "0.00" }, { rejectWithValue }) => {
    try {
      const { data } = await agentCartApi.startAgentCart({
        agent,
        order_discount_total,
      });
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

// Сканировать товар по штрих-коду
export const scanProductInCart = createAsyncThunk(
  "agentCart/scanProduct",
  async ({ cartId, barcode, quantity = 1, agent }, { rejectWithValue }) => {
    try {
      const { data } = await agentCartApi.scanProduct(cartId, {
        barcode,
        quantity,
        ...(agent && { agent }),
      });
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

// Добавить товар по product_id
export const addProductToAgentCart = createAsyncThunk(
  "agentCart/addProduct",
  async (
    { cartId, product_id, quantity, discount_total, unit_price, agent },
    { rejectWithValue }
  ) => {
    try {
      const { data } = await agentCartApi.addProductToCart(cartId, {
        product_id,
        quantity,
        ...(discount_total && { discount_total }),
        ...(unit_price && { unit_price }),
        ...(agent && { agent }),
      });
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

// Добавить кастомную позицию
export const addCustomItemToAgentCart = createAsyncThunk(
  "agentCart/addCustomItem",
  async ({ cartId, name, price, quantity }, { rejectWithValue }) => {
    try {
      const { data } = await agentCartApi.addCustomItemToCart(cartId, {
        name,
        price,
        quantity,
      });
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

// Чекаут корзины
export const checkoutAgentCart = createAsyncThunk(
  "agentCart/checkout",
  async (
    { cartId, print_receipt = false, client_id, department_id, agent },
    { rejectWithValue }
  ) => {
    try {
      const { data } = await agentCartApi.checkoutAgentCart(cartId, {
        print_receipt,
        ...(client_id && { client_id }),
        ...(department_id && { department_id }),
        ...(agent && { agent }),
      });
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

// Получить информацию о корзине (используем startAgentCart)
export const getAgentCart = createAsyncThunk(
  "agentCart/get",
  async ({ agent, order_discount_total = "0.00" }, { rejectWithValue }) => {
    try {
      const { data } = await agentCartApi.getAgentCart({
        agent,
        order_discount_total,
      });
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

// Удалить позицию из корзины
export const removeItemFromAgentCart = createAsyncThunk(
  "agentCart/removeItem",
  async ({ cartId, itemId }, { rejectWithValue }) => {
    try {
      const { data } = await agentCartApi.removeItemFromCart(cartId, itemId);
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

// Обновить количество позиции
export const updateAgentCartItemQuantity = createAsyncThunk(
  "agentCart/updateItemQuantity",
  async ({ cartId, itemId, quantity, discount_total }, { rejectWithValue }) => {
    try {
      const { data } = await agentCartApi.updateCartItemQuantity(
        cartId,
        itemId,
        {
          quantity,
          ...(discount_total && { discount_total }),
        }
      );
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);
