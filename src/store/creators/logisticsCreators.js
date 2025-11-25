import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api";

// GET /logistics/logistics/?company=...&branch=...&status=...
export const fetchLogisticsAsync = createAsyncThunk(
  "logistics/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/logistics/logistics/", {
        params,
      });
      return data; // { count, next, previous, results: [ ... ] } или массив
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const createLogisticAsync = createAsyncThunk(
  "logistics/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/logistics/logistics/", payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const updateLogisticAsync = createAsyncThunk(
  "logistics/update",
  async ({ id, data: body }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/logistics/logistics/${id}/`, body);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const fetchLogisticsAnalyticsAsync = createAsyncThunk(
  "logistics/fetchAnalytics",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/logistics/logistics/analytics/", {
        params,
      });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);
