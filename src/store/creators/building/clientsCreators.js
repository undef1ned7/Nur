import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../api";

const BASE = "/building/clients";

export const fetchBuildingClients = createAsyncThunk(
  "buildingClients/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const createBuildingClient = createAsyncThunk(
  "buildingClients/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const updateBuildingClient = createAsyncThunk(
  "buildingClients/update",
  async ({ id, data: payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`${BASE}/${id}/`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const deleteBuildingClient = createAsyncThunk(
  "buildingClients/delete",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`${BASE}/${id}/`);
      return id;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);
