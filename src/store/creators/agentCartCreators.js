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
        payment_method: "transfer",
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
  async (
    { cartId, itemId, quantity, discount_total, gift_quantity },
    { rejectWithValue }
  ) => {
    try {
      const { data } = await agentCartApi.updateCartItemQuantity(
        cartId,
        itemId,
        {
          quantity,
          ...(discount_total && { discount_total }),
          ...(gift_quantity !== undefined && { gift_quantity }),
        }
      );
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

// New OpenAPI-aligned thunks
// -----------------------------------------------------------------------------
// Agent carts
export const listAgentCartsAsync = createAsyncThunk(
  "agentCart/list",
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await agentCartApi.listAgentCarts(params);
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const createAgentCartAsync = createAsyncThunk(
  "agentCart/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await agentCartApi.createAgentCart(payload);
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const getAgentCartByIdAsync = createAsyncThunk(
  "agentCart/getById",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await agentCartApi.getAgentCartById(id);
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const updateAgentCartAsync = createAsyncThunk(
  "agentCart/update",
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await agentCartApi.updateAgentCart(id, payload);
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const deleteAgentCartAsync = createAsyncThunk(
  "agentCart/delete",
  async (id, { rejectWithValue }) => {
    try {
      await agentCartApi.deleteAgentCart(id);
      return { id };
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const submitAgentCartAsync = createAsyncThunk(
  "agentCart/submit",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await agentCartApi.submitAgentCartById(id);
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const approveAgentCartAsync = createAsyncThunk(
  "agentCart/approve",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await agentCartApi.approveAgentCartById(id);
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const rejectAgentCartAsync = createAsyncThunk(
  "agentCart/reject",
  async ({ id, reason }, { rejectWithValue }) => {
    try {
      const { data } = await agentCartApi.rejectAgentCartById(id, {
        ...(reason ? { reason } : {}),
      });
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

// Agent cart items
export const listAgentCartItemsAsync = createAsyncThunk(
  "agentCartItems/list",
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await agentCartApi.listAgentCartItems(params);
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const createAgentCartItemAsync = createAsyncThunk(
  "agentCartItems/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await agentCartApi.createAgentCartItem(payload);
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const getAgentCartItemByIdAsync = createAsyncThunk(
  "agentCartItems/getById",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await agentCartApi.getAgentCartItemById(id);
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const updateAgentCartItemAsync = createAsyncThunk(
  "agentCartItems/update",
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await agentCartApi.updateAgentCartItemById(id, payload);
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const deleteAgentCartItemAsync = createAsyncThunk(
  "agentCartItems/delete",
  async (id, { rejectWithValue }) => {
    try {
      await agentCartApi.deleteAgentCartItemById(id);
      return { id };
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

// Agent inventory
export const getMyAgentProductsAsync = createAsyncThunk(
  "agentInventory/getMine",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await agentCartApi.getMyAgentProducts();
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const patchMyAgentProductsAsync = createAsyncThunk(
  "agentInventory/patchMine",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await agentCartApi.patchMyAgentProducts(payload);
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const getOwnerAgentsProductsAsync = createAsyncThunk(
  "agentInventory/getOwnerSummary",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await agentCartApi.getOwnerAgentsProducts();
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);
