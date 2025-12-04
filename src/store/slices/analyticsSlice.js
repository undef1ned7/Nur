import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  fetchOrderAnalytics,
  fetchAgentAnalytics,
} from "../creators/analyticsCreators";

const orderAnalyticsSlice = createSlice({
  name: "orderAnalytics",
  initialState: {
    data: null,
    loading: false,
    error: null,
    filters: {
      start_date: null,
      end_date: null,
      status: null,
    },
    agentAnalytics: {
      data: null,
      loading: false,
      error: null,
      period: "month",
      agentId: null,
    },
  },
  reducers: {
    setAnalyticsFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearAnalytics: (state) => {
      state.data = null;
      state.loading = false;
      state.error = null;
      state.filters = { start_date: null, end_date: null, status: null };
    },
    clearAgentAnalytics: (state) => {
      state.agentAnalytics.data = null;
      state.agentAnalytics.loading = false;
      state.agentAnalytics.error = null;
      state.agentAnalytics.period = "month";
      state.agentAnalytics.agentId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOrderAnalytics.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.filters = action.meta.arg || {
          start_date: null,
          end_date: null,
          status: null,
        };
      })
      .addCase(fetchOrderAnalytics.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
        state.error = null;
      })
      .addCase(fetchOrderAnalytics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || {
          message: "Не удалось получить аналитику",
        };
        state.data = null;
      })
      .addCase(fetchAgentAnalytics.pending, (state, action) => {
        state.agentAnalytics.loading = true;
        state.agentAnalytics.error = null;
        const { agentId, period } = action.meta.arg || {};
        if (agentId !== undefined) state.agentAnalytics.agentId = agentId;
        if (period) state.agentAnalytics.period = period;
      })
      .addCase(fetchAgentAnalytics.fulfilled, (state, action) => {
        state.agentAnalytics.loading = false;
        state.agentAnalytics.data = action.payload;
        state.agentAnalytics.error = null;
      })
      .addCase(fetchAgentAnalytics.rejected, (state, action) => {
        state.agentAnalytics.loading = false;
        state.agentAnalytics.error = action.payload || {
          message: "Не удалось получить аналитику агента",
        };
        state.agentAnalytics.data = null;
      });
  },
});

export const { setAnalyticsFilters, clearAnalytics, clearAgentAnalytics } =
  orderAnalyticsSlice.actions;

export default orderAnalyticsSlice.reducer;
