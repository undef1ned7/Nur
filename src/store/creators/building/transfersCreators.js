import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../api";

const BASE = "/building";

export const fetchBuildingWarehouseTransfers = createAsyncThunk(
  "buildingTransfers/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/warehouse-transfers/`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const fetchBuildingWarehouseTransferById = createAsyncThunk(
  "buildingTransfers/fetchById",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/warehouse-transfers/${id}/`);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const acceptBuildingWarehouseTransfer = createAsyncThunk(
  "buildingTransfers/accept",
  async ({ transferId, payload = {} }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(
        `${BASE}/warehouse-transfers/${transferId}/accept/`,
        payload
      );
      return data ?? { id: transferId };
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const rejectBuildingWarehouseTransfer = createAsyncThunk(
  "buildingTransfers/reject",
  async ({ transferId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(
        `${BASE}/warehouse-transfers/${transferId}/reject/`,
        payload
      );
      return data ?? { id: transferId };
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

