import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../api";

const BASE = "/building";

export const fetchBuildingWarehouseStockItems = createAsyncThunk(
  "buildingStock/fetchItems",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/warehouse-stock/items/`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const fetchBuildingWarehouseStockMoves = createAsyncThunk(
  "buildingStock/fetchMoves",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/warehouse-stock/moves/`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

