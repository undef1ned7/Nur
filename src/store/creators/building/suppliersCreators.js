import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../api";

const BASE = "/building/suppliers";

export const fetchBuildingSuppliers = createAsyncThunk(
  "buildingSuppliers/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

export const createBuildingSupplier = createAsyncThunk(
  "buildingSuppliers/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

export const updateBuildingSupplier = createAsyncThunk(
  "buildingSuppliers/update",
  async ({ id, data: payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`${BASE}/${id}/`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

export const deleteBuildingSupplier = createAsyncThunk(
  "buildingSuppliers/delete",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`${BASE}/${id}/`);
      return id;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

