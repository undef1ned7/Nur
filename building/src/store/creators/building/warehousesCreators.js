import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../api";

const BASE = "/building";

export const fetchBuildingWarehouses = createAsyncThunk(
  "buildingWarehouses/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/warehouses/`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const fetchBuildingWarehouseById = createAsyncThunk(
  "buildingWarehouses/fetchById",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/warehouses/${id}/`);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const createBuildingWarehouse = createAsyncThunk(
  "buildingWarehouses/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/warehouses/`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

