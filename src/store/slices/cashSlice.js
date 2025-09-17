import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../api";
import { useSelector } from "react-redux";

const initialState = {
  list: [],
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
      });
  },
});

export const useCash = () => useSelector((state) => state.cash);
export default cashSlice.reducer;
