import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  getOrderAnalytics,
  getAgentAnalytics,
  getProductionAnalytics,
} from "../../api/analytics";

export const fetchOrderAnalytics = createAsyncThunk(
  "orderAnalytics/fetchOrderAnalytics",
  async (filters, { rejectWithValue }) => {
    try {
      const data = await getOrderAnalytics(filters);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchAgentAnalytics = createAsyncThunk(
  "orderAnalytics/fetchAgentAnalytics",
  async ({ agentId, period = "month" }, { rejectWithValue }) => {
    try {
      const data = await getAgentAnalytics(agentId, period);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchProductionAnalytics = createAsyncThunk(
  "orderAnalytics/fetchProductionAnalytics",
  async (params = {}, { rejectWithValue }) => {
    try {
      const data = await getProductionAnalytics(params);
      return data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.detail ||
        error.message ||
        "Не удалось загрузить аналитику производства";
      return rejectWithValue({
        message: errorMessage,
        status: error.response?.status,
      });
    }
  }
);
