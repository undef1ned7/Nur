import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api";

// Делает ошибки сериализуемыми
const plainAxiosError = (error) => ({
  message: error?.message,
  code: error?.code,
  status: error?.response?.status,
  data: error?.response?.data,
  url: error?.config?.url,
  method: error?.config?.method,
});

// ===== Helpers для сделок =====
// ===== Helpers для сделок =====
const ruStatusToKind = (ru) => {
  const s = String(ru).trim();
  if (s === "Долги" || s === "Предоплата") return "debt";
  return "sale";
};

const toDecimalString = (n) => {
  const num = Number(n || 0);
  return num.toFixed(2);
};

const hasPositiveNumber = (v) => Number.isFinite(Number(v)) && Number(v) > 0;

// ===== POS продажи (товары) =====
export const startSale = createAsyncThunk(
  "sale/start",
  async (discount_total, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/main/pos/sales/start/", {
        order_discount_total: discount_total,
      });
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const updateSale = createAsyncThunk(
  "sale/update",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/main/pos/sales/start/`);
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const manualFilling = createAsyncThunk(
  "sale/manualFilling",
  async ({ id, productId, quantity, discount_total }, { rejectWithValue }) => {
    try {
      const { data: response } = await api.post(
        `/main/pos/sales/${id}/add-item/`,
        { product_id: productId, quantity, discount_total }
      );
      return response;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const updateManualFilling = createAsyncThunk(
  "sale/updateManualFilling",
  async ({ id, productId, discount_total, quantity }, { rejectWithValue }) => {
    try {
      const { data: response } = await api.patch(
        `/main/pos/carts/${id}/items/${productId}/`,
        { discount_total, quantity }
      );
      return response;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const deleteProductInCart = createAsyncThunk(
  "sale/deleteProductInCart",
  async ({ id, productId }, { rejectWithValue }) => {
    try {
      await api.delete(`/main/pos/carts/${id}/items/${productId}/`);
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const deleteSale = createAsyncThunk(
  "sale/deleteSale",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/main/pos/sales/${id}/`);
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const updateProductInCart = createAsyncThunk(
  "sale/updateProductInCart",
  async ({ id, productId, data }, { rejectWithValue }) => {
    try {
      await api.patch(`/main/pos/carts/${id}/items/${productId}/`, data);
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const sendBarCode = createAsyncThunk(
  "products/sendBarcode",
  async ({ barcode, id }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/main/pos/sales/${id}/scan/`, {
        barcode,
      });
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const doSearch = createAsyncThunk(
  "products/doSearch",
  async (search, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/main/products/list/`, {
        params: search,
      });
      return data.results;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const historySellProduct = createAsyncThunk(
  "products/historySellProduct",
  async (search, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/main/pos/sales/`, {
        params: search,
      });
      return data.results;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const updateSellProduct = createAsyncThunk(
  "products/updateSellProduct",
  async ({ updatedData, id }, { rejectWithValue }) => {
    try {
      const { data: response } = await api.patch(
        `/main/pos/sales/${id}/`,
        updatedData
      );
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const historySellObjects = createAsyncThunk(
  "products/historySellObjects",
  async (search, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/main/object-sales/`, {
        params: search,
      });
      return data.results;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const historySellProductDetail = createAsyncThunk(
  "products/historySellProductDetail",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/main/pos/sales/${id}/`);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const historySellObjectDetail = createAsyncThunk(
  "products/historySellObjectDetail",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/main/object-sales/${id}/`);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const productCheckout = createAsyncThunk(
  "products/productCheckout",
  async ({ id, bool, clientId }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`main/pos/sales/${id}/checkout/`, {
        print_receipt: bool,
        client_id: clientId,
      });
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const getProductCheckout = createAsyncThunk(
  "products/getProductCheckout",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/main/pos/sales/${id}/receipt/`, {
        responseType: "blob",
      });
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const getProductInvoice = createAsyncThunk(
  "products/getProductInvoice",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/main/sales/${id}/invoice/`, {
        responseType: "blob",
      });
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// ===== Object sales (строительные объекты) =====
export const getObjects = createAsyncThunk(
  "objects/get",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/main/object-items/`);
      return data.results;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const createObject = createAsyncThunk(
  "object/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data: response } = await api.post("/main/object-items/", payload);
      return response;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const startSellObjects = createAsyncThunk(
  "object/start",
  async (payload, { rejectWithValue }) => {
    try {
      // payload: { client, status, sold_at, note }
      const { data } = await api.post("/main/object-sales/", payload);
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const objectCartAddItem = createAsyncThunk(
  "object/addItem",
  async ({ id, product, data }, { rejectWithValue }) => {
    try {
      const body = product ?? data; // поддержка обоих вариантов
      const { data: response } = await api.post(
        `/main/object-sales/${id}/items/`,
        body
      );
      return response;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const addCustomItem = createAsyncThunk(
  "sale/addCustomItem",
  async ({ id, name, price, quantity }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/main/pos/carts/${id}/custom-item/`, {
        name,
        price: toDecimalString(price),
        quantity: Number(quantity) || 1,
      });
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const createDeal = createAsyncThunk(
  "deals/create",
  async (
    { clientId, title, statusRu, amount, debtMonths, prepayment }, // prepayment и debtMonths могут приходить вместе
    { rejectWithValue }
  ) => {
    try {
      const kind = ruStatusToKind(statusRu);

      // Базовый payload
      const payload = {
        title: String(title || "").trim(),
        kind, // enum: sale | debt | prepayment
        amount: toDecimalString(amount), // общая сумма сделки
        note: "",
        client: clientId,
      };

      // Если это "Долги" ИЛИ "Предоплата", на клиенте мы уже передали kind="debt"
      if (kind === "debt") {
        if (hasPositiveNumber(debtMonths)) {
          payload.debt_months = Number(debtMonths);
        }
        // Если пришла предоплата (значит выбран режим "Предоплата")
        if (hasPositiveNumber(prepayment)) {
          payload.prepayment = toDecimalString(prepayment);
        }
      }

      const { data } = await api.post(
        `/main/clients/${clientId}/deals/`,
        payload
      );
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);
