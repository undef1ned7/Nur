import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api";

const plainAxiosError = (error) => ({
  message: error?.message,
  code: error?.code,
  status: error?.response?.status,
  data: error?.response?.data,
  url: error?.config?.url,
  method: error?.config?.method,
});

export const startSaleInAgent = createAsyncThunk(
  "sale/startInAgent",
  async (discount_total, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/main/agents/me/cart/start/", {
        order_discount_total: discount_total,
      });
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const manualFillingInAgent = createAsyncThunk(
  "sale/manualFillingInAgent",
  async ({ id, productId, quantity, discount_total }, { rejectWithValue }) => {
    try {
      const { data: response } = await api.post(
        `/main/agents/me/carts/${id}/add-item/`,
        { product_id: productId, quantity, discount_total }
      );
      return response;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const updateManualFillingInAgent = createAsyncThunk(
  "sale/updateManualFillingInAgent",
  async ({ id, productId, discount_total, quantity }, { rejectWithValue }) => {
    try {
      const { data: response } = await api.patch(
        `/main/agents/me/carts/${id}/items/${productId}/`,
        { discount_total, quantity }
      );
      return response;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const doSearchInAgent = createAsyncThunk(
  "products/doSearchInAgent",
  async (search, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/main/agents/me/products/`, {
        params: search,
      });
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const productCheckoutInAgent = createAsyncThunk(
  "products/productCheckoutInAgent",
  async ({ id, bool, clientId }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/main/agents/me/carts/${id}/checkout/`, {
        print_receipt: bool,
        client_id: clientId,
        payment_method: "transfer",
      });
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);
