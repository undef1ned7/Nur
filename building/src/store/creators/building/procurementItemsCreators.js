import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../api";

const BASE = "/building";

export const fetchBuildingProcurementItems = createAsyncThunk(
  "buildingProcurementItems/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/procurement-items/`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const createBuildingProcurementItem = createAsyncThunk(
  "buildingProcurementItems/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/procurement-items/`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const updateBuildingProcurementItem = createAsyncThunk(
  "buildingProcurementItems/update",
  async ({ id, data, procurementId }, { rejectWithValue }) => {
    try {
      const { data: response } = await api.patch(
        `${BASE}/procurement-items/${id}/`,
        data
      );
      return { procurementId, item: response };
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const deleteBuildingProcurementItem = createAsyncThunk(
  "buildingProcurementItems/delete",
  async ({ id, procurementId }, { rejectWithValue }) => {
    try {
      await api.delete(`${BASE}/procurement-items/${id}/`);
      return { procurementId, id };
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

