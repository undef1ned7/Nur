import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../api";

const BASE = "/building";

export const fetchBuildingWorkEntries = createAsyncThunk(
  "buildingWorkEntries/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/work-entries/`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const createBuildingWorkEntry = createAsyncThunk(
  "buildingWorkEntries/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${BASE}/work-entries/`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const updateBuildingWorkEntry = createAsyncThunk(
  "buildingWorkEntries/update",
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`${BASE}/work-entries/${id}/`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const deleteBuildingWorkEntry = createAsyncThunk(
  "buildingWorkEntries/delete",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`${BASE}/work-entries/${id}/`);
      return id;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const fetchBuildingWorkEntryById = createAsyncThunk(
  "buildingWorkEntries/fetchById",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${BASE}/work-entries/${id}/`);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const createBuildingWorkEntryPhoto = createAsyncThunk(
  "buildingWorkEntries/createPhoto",
  async ({ id, image, caption }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append("image", image);
      if (caption) formData.append("caption", caption);
      const { data } = await api.post(
        `${BASE}/work-entries/${id}/photos/`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      return { entryId: id, photo: data };
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const createBuildingWorkEntryFile = createAsyncThunk(
  "buildingWorkEntries/createFile",
  async ({ id, file, title }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (title) formData.append("title", title);
      const { data } = await api.post(
        `${BASE}/work-entries/${id}/files/`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      return { entryId: id, file: data };
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

export const createWorkEntryWarehouseRequest = createAsyncThunk(
  "buildingWorkEntries/createWarehouseRequest",
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(
        `${BASE}/work-entries/${id}/warehouse-requests/`,
        payload
      );
      return { entryId: id, request: data };
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);


