
import { createAsyncThunk } from '@reduxjs/toolkit';
import { getOrderAnalytics } from '../../api/analytics'; 

export const fetchOrderAnalytics = createAsyncThunk(
  'orderAnalytics/fetchOrderAnalytics',
  async (filters, { rejectWithValue }) => {
    try {
        
      const data = await getOrderAnalytics(filters);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);