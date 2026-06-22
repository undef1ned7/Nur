import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../api";

const ENDPOINT = "/building/objects/";

/**
 * Загрузка проектов строительства
 * GET /construction/projects/
 */
export const fetchBuildingProjects = createAsyncThunk(
  "buildingProjects/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(ENDPOINT, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

/**
 * Создание проекта строительства
 * POST /construction/projects/
 */
export const createBuildingProject = createAsyncThunk(
  "buildingProjects/create",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post(ENDPOINT, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

/**
 * Обновление проекта строительства
 * PATCH /construction/projects/{id}/
 */
export const updateBuildingProject = createAsyncThunk(
  "buildingProjects/update",
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const { data: response } = await api.patch(`${ENDPOINT}${id}/`, data);
      return response;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

/**
 * Удаление проекта строительства
 * DELETE /construction/projects/{id}/
 */
export const deleteBuildingProject = createAsyncThunk(
  "buildingProjects/delete",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`${ENDPOINT}${id}/`);
      return id;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  }
);

