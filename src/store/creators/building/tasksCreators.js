import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../api";

const BASE = "/building/tasks";

export const fetchBuildingTasks = createAsyncThunk(
  "buildingTasks/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

export const fetchBuildingTaskById = createAsyncThunk(
  "buildingTasks/fetchOne",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/${id}/`);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

export const createBuildingTask = createAsyncThunk(
  "buildingTasks/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

export const updateBuildingTask = createAsyncThunk(
  "buildingTasks/update",
  async ({ id, data: payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`${BASE}/${id}/`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

export const deleteBuildingTask = createAsyncThunk(
  "buildingTasks/delete",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`${BASE}/${id}/`);
      return id;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

export const createBuildingTaskChecklistItem = createAsyncThunk(
  "buildingTasks/createChecklistItem",
  async ({ taskId, text, order }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(
        `${BASE}/${taskId}/checklist-items/`,
        { text, order },
      );
      // API возвращает целиком задачу с обновленным checklist_items
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

export const updateBuildingTaskChecklistItem = createAsyncThunk(
  "buildingTasks/updateChecklistItem",
  async ({ id, data: payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(
        `/building/task-checklist-items/${id}/`,
        payload,
      );
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

