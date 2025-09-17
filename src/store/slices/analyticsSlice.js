import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchOrderAnalytics } from '../creators/analyticsCreators';

const orderAnalyticsSlice = createSlice({
  name: 'orderAnalytics',
  initialState: {
    data: null,
    loading: false,
    error: null,
    filters: { 
      start_date: null,
      end_date: null,
      status: null,
    }
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
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOrderAnalytics.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.filters = action.meta.arg || { start_date: null, end_date: null, status: null }; 
      })
      .addCase(fetchOrderAnalytics.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload; 
        state.error = null;
      })
      .addCase(fetchOrderAnalytics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || { message: 'Не удалось получить аналитику' };
        state.data = null; 
      });
  },
});

export const { setAnalyticsFilters, clearAnalytics } = orderAnalyticsSlice.actions;

export default orderAnalyticsSlice.reducer;