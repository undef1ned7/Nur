import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../api";

const BASE = "/building";

export const fetchBuildingCashPendingProcurements = createAsyncThunk(
  "buildingCashRegister/fetchPending",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/cash/procurements/pending/`, {
        params,
      });
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const approveBuildingCashProcurement = createAsyncThunk(
  "buildingCashRegister/approve",
  async ({ procurementId, payload = {} }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(
        `${BASE}/cash/procurements/${procurementId}/approve/`,
        payload
      );
      return data ?? { id: procurementId };
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const rejectBuildingCashProcurement = createAsyncThunk(
  "buildingCashRegister/reject",
  async ({ procurementId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(
        `${BASE}/cash/procurements/${procurementId}/reject/`,
        payload
      );
      return data ?? { id: procurementId };
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

