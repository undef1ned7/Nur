import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../api";
import { useSelector } from "react-redux";

const initialState = {
  list: [],
  cashFlows: [],
  loading: false,
  error: null,
};

export const getCashBoxes = createAsyncThunk(
  "cash/getBoxes",
  async (_, { rejectWithValue }) => {
    try {
      const { data: response } = await api.get("/construction/cashboxes/");
      return response.results;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
    }
  }
);
export const getCashFlows = createAsyncThunk(
  "cash/getFlows",
  async (_, { rejectWithValue }) => {
    try {
      const { data: response } = await api.get("/construction/cashflows/");
      return response.results;
    } catch (e) {
      return rejectWithValue(e.response?.data || e.message);
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
      return rejectWithValue(e.response?.data || e.message);
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
      return rejectWithValue(error?.response?.data || error?.message);
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
      });
  },
});

export const useCash = () => useSelector((state) => state.cash);
export default cashSlice.reducer;
