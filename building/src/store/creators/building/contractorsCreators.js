import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../api";

const BASE = "/building/contractors";

export const fetchBuildingContractors = createAsyncThunk(
  "buildingContractors/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

export const createBuildingContractor = createAsyncThunk(
  "buildingContractors/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

export const updateBuildingContractor = createAsyncThunk(
  "buildingContractors/update",
  async ({ id, data: payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`${BASE}/${id}/`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

export const deleteBuildingContractor = createAsyncThunk(
  "buildingContractors/delete",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`${BASE}/${id}/`);
      return id;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

