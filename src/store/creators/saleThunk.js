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
  async ({ discount_total = 0, shift = null }, { rejectWithValue }) => {
    try {
      const payload = {
        order_discount_total: discount_total,
      };
      // Если передан shift, добавляем его в payload
      if (shift) {
        payload.shift = shift;
      }
      const { data } = await api.post("/main/pos/sales/start/", payload);
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

export const updateSale = createAsyncThunk(
  "sale/update",
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const { data: response } = await api.patch(`/main/pos/sales/${id}/`, data);
      return response;
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

// Thunk для загрузки документов (чеков) с пагинацией
export const fetchDocuments = createAsyncThunk(
  "documents/fetchDocuments",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/main/pos/sales/`, {
        params: {
          page: params.page || 1,
          search: params.search || "",
        },
      });
      return data; // Возвращаем полный объект с пагинацией
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
  async (
    { id, bool, clientId, payment_method, cash_received },
    { rejectWithValue }
  ) => {
    try {
      const payload = {
        print_receipt: bool,
        ...(clientId && { client_id: clientId }),
        ...(payment_method && { payment_method }),
        ...(cash_received && { cash_received }),
      };
      const { data } = await api.post(
        `main/pos/sales/${id}/checkout/`,
        payload
      );
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

// Получение JSON данных накладной
export const getInvoiceJson = createAsyncThunk(
  "products/getInvoiceJson",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/main/sales/json/${id}/invoice/`);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Получение JSON данных чека
export const getReceiptJson = createAsyncThunk(
  "products/getReceiptJson",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/main/sales/json/${id}/receipt/`);
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
    {
      clientId,
      title,
      statusRu,
      amount,
      debtMonths,
      prepayment,
      first_due_date, // <=== ДОБАВИЛИ
    }, // prepayment и debtMonths могут приходить вместе
    { rejectWithValue }
  ) => {
    try {
      const kind = ruStatusToKind(statusRu);

      // Базовый payload
      const payload = {
        title: String(title || "").trim(),
        kind, // enum: sale | debt | prepayment (или у тебя всё сведено к "debt")
        amount: toDecimalString(amount), // общая сумма сделки
        note: "",
        client: clientId,
      };

      if (kind === "debt") {
        // 1) ВСЕГДА отправляем debt_months (даже если 0)
        const monthsNum = Number(debtMonths);
        payload.debt_months = Number.isFinite(monthsNum) ? monthsNum : 0;

        // 2) Если пришла предоплата (режим "Предоплата") — шлём prepayment
        if (
          prepayment !== undefined &&
          prepayment !== null &&
          prepayment !== ""
        ) {
          const prepaymentNum = Number(prepayment);
          if (!Number.isNaN(prepaymentNum) && prepaymentNum >= 0) {
            payload.prepayment = toDecimalString(prepaymentNum);
          }
        }

        // 3) Дата первого платежа (YYYY-MM-DD)
        if (first_due_date) {
          payload.first_due_date = first_due_date;
        }

        // 4) Автоматическое планирование графика — всегда включено
        payload.auto_schedule = true;
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
