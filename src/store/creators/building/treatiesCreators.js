import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../api";

const BASE = "/building/treaties";

export const fetchBuildingTreaties = createAsyncThunk(
  "buildingTreaties/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const createBuildingTreaty = createAsyncThunk(
  "buildingTreaties/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const updateBuildingTreaty = createAsyncThunk(
  "buildingTreaties/update",
  async ({ id, data: payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`${BASE}/${id}/`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const deleteBuildingTreaty = createAsyncThunk(
  "buildingTreaties/delete",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`${BASE}/${id}/`);
      return id;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const createBuildingTreatyInErp = createAsyncThunk(
  "buildingTreaties/createInErp",
  async (treatyId, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/${treatyId}/erp/create/`);
      return data ?? { id: treatyId };
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

/**
 * Прикрепить файл к договору
 * POST /building/treaties/{id}/files/ (multipart/form-data)
 * @param {string} treatyId - ID договора
 * @param {{ file: File, title?: string }} payload - file обязательно, title опционально
 */
export const createBuildingTreatyFile = createAsyncThunk(
  "buildingTreaties/createFile",
  async ({ treatyId, file, title }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (title != null && String(title).trim() !== "") {
        formData.append("title", String(title).trim());
      }
      const { data } = await api.post(`${BASE}/${treatyId}/files/`, formData);
      return data ?? { treatyId };
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);
