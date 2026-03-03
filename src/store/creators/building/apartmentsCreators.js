import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../api";

const BASE = "/building";

export const fetchBuildingApartments = createAsyncThunk(
  "buildingApartments/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/apartments/`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const createBuildingApartment = createAsyncThunk(
  "buildingApartments/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/apartments/`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const updateBuildingApartment = createAsyncThunk(
  "buildingApartments/update",
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`${BASE}/apartments/${id}/`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const deleteBuildingApartment = createAsyncThunk(
  "buildingApartments/delete",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`${BASE}/apartments/${id}/`);
      return id;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const fetchBuildingResidentialFloors = createAsyncThunk(
  "buildingApartments/fetchFloors",
  async (residentialId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(
        `${BASE}/objects/${residentialId}/floors/`
      );
      return { residentialId, data };
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

