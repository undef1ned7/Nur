import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../api";

const BASE = "/building";

export const fetchBuildingDrawings = createAsyncThunk(
  "buildingDrawings/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/drawings/`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const createBuildingDrawing = createAsyncThunk(
  "buildingDrawings/create",
  async (payload, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      Object.entries(payload || {}).forEach(([key, value]) => {
        if (value != null) formData.append(key, value);
      });
      const { data } = await api.post(`${BASE}/drawings/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const updateBuildingDrawing = createAsyncThunk(
  "buildingDrawings/update",
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      Object.entries(payload || {}).forEach(([key, value]) => {
        if (value != null) formData.append(key, value);
      });
      const { data } = await api.patch(`${BASE}/drawings/${id}/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const deleteBuildingDrawing = createAsyncThunk(
  "buildingDrawings/delete",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`${BASE}/drawings/${id}/`);
      return id;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

