import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../api";

const BASE = "/building";

export const fetchBuildingProcurements = createAsyncThunk(
  "buildingProcurements/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/procurements/`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const fetchBuildingProcurementById = createAsyncThunk(
  "buildingProcurements/fetchById",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/procurements/${id}/`);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const createBuildingProcurement = createAsyncThunk(
  "buildingProcurements/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/procurements/`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const submitBuildingProcurementToCash = createAsyncThunk(
  "buildingProcurements/submitToCash",
  async (procurementId, { rejectWithValue }) => {
    try {
      const { data } = await api.post(
        `${BASE}/procurements/${procurementId}/submit-to-cash/`
      );
      return data ?? { id: procurementId };
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const createBuildingTransferFromProcurement = createAsyncThunk(
  "buildingProcurements/createTransfer",
  async ({ procurementId, payload = {} }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(
        `${BASE}/procurements/${procurementId}/transfers/create/`,
        payload
      );
      return data ?? { id: procurementId };
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

