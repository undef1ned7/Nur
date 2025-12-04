import { createAsyncThunk } from "@reduxjs/toolkit";
import { getOrderAnalytics, getAgentAnalytics } from "../../api/analytics";

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
