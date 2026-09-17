import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../api";
import { useSelector } from "react-redux";
import { handleThunkError } from "../creators/utils/handleThunkError";

const initialState = {
  list: [],
  cashFlows: [],
  loading: false,
  error: null,
  // Подтверждение кассовых операций (легаси общий модуль construction/*).
  // По умолчанию выключено — см. docs/kassa/cash-confirmation-toggle.md.
  confirmation: { enabled: false, loaded: false },
};

export const getCashBoxes = createAsyncThunk(
  "cash/getBoxes",
  async (_, { rejectWithValue }) => {
    try {
      const { data: response } = await api.get("/construction/cashboxes/");
      return response?.results ?? (Array.isArray(response) ? response : []);
    } catch (e) {
      return handleThunkError(e, rejectWithValue);
    }
  }
);

export const getCashFlows = createAsyncThunk(
  "cash/getFlows",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data: response } = await api.get("/construction/cashflows/", {
        params,
      });
      return response.results || response || [];
    } catch (e) {
      return handleThunkError(e, rejectWithValue);
    }
  }
);

export const addCashFlows = createAsyncThunk(
  "cash/addFlows",
  async (data, { rejectWithValue }) => {
    try {
      const { data: response } = await api.post(
        "/construction/cashflows/",
        data
      );
      return response;
    } catch (e) {
      return handleThunkError(e, rejectWithValue);
    }
  }
);

export const updateCashFlows = createAsyncThunk(
  "cashFlows/update",
  async ({ productId, updatedData }, { rejectWithValue }) => {
    try {
      // если нет helpers — (await api.patch(`/main/products/${productId}/`, updatedData)).data
      return await api.patch(
        `/construction/cashflows/${productId}/`,
        updatedData
      );
    } catch (error) {
      return handleThunkError(error, rejectWithValue);
    }
  }
);

export const bulkUpdateCashFlowsStatus = createAsyncThunk(
  "cashFlows/bulkUpdateStatus",
  async (items, { rejectWithValue }) => {
    try {
      const { data: response } = await api.patch(
        "/construction/cashflows/bulk/status/",
        { items }
      );
      return response;
    } catch (error) {
      return handleThunkError(error, rejectWithValue);
    }
  }
);

/**
 * Настройка подтверждения кассовых операций (легаси общий модуль,
 * используется Barber/Building/Pilorama/School/logistics и не-owner ролями).
 * По умолчанию (нет строки на сервере) — ВЫКЛЮЧЕНО: новая операция сразу
 * получает status="approved" независимо от роли автора.
 * GET/PATCH /construction/cash-confirmation-settings/
 * См. docs/kassa/cash-confirmation-toggle.md.
 */
export const getCashConfirmationSettings = createAsyncThunk(
  "cash/getConfirmationSettings",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get(
        "/construction/cash-confirmation-settings/"
      );
      return Boolean(data?.enabled);
    } catch (e) {
      return handleThunkError(e, rejectWithValue);
    }
  }
);

export const updateCashConfirmationSettings = createAsyncThunk(
  "cash/updateConfirmationSettings",
  async (enabled, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(
        "/construction/cash-confirmation-settings/",
        { enabled }
      );
      return Boolean(data?.enabled ?? enabled);
    } catch (e) {
      return handleThunkError(e, rejectWithValue);
    }
  }
);

const cashSlice = createSlice({
  name: "cash",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(addCashFlows.pending, (state) => {
        state.loading = true;
      })
      .addCase(addCashFlows.fulfilled, (state, { payload }) => {
        state.loading = false;
      })
      .addCase(addCashFlows.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })
      .addCase(updateCashFlows.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateCashFlows.fulfilled, (state, { payload }) => {
        state.loading = false;
      })
      .addCase(updateCashFlows.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })
      .addCase(bulkUpdateCashFlowsStatus.pending, (state) => {
        state.loading = true;
      })
      .addCase(bulkUpdateCashFlowsStatus.fulfilled, (state, { payload }) => {
        state.loading = false;
      })
      .addCase(bulkUpdateCashFlowsStatus.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })
      .addCase(getCashBoxes.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCashBoxes.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.list = payload;
      })
      .addCase(getCashBoxes.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })
      .addCase(getCashFlows.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCashFlows.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.cashFlows = payload;
      })
      .addCase(getCashFlows.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })
      .addCase(getCashConfirmationSettings.fulfilled, (state, { payload }) => {
        state.confirmation = { enabled: payload, loaded: true };
      })
      .addCase(getCashConfirmationSettings.rejected, (state) => {
        // Эндпоинт ещё не готов на бэке / компания без настроек — дефолт off.
        state.confirmation = { enabled: false, loaded: true };
      })
      .addCase(updateCashConfirmationSettings.fulfilled, (state, { payload }) => {
        state.confirmation = { enabled: payload, loaded: true };
      });
  },
});

export const useCash = () => useSelector((state) => state.cash);
export default cashSlice.reducer;
