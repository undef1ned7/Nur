// src/store/creators/branchCreators.js
import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api";

// Универсально достаём список из пагинации/без неё
const listFrom = (res) => res?.data?.results || res?.data || [];

/* =================================================================== */
/*                               BRANCHES                              */
/* =================================================================== */

export const fetchBranchesAsync = createAsyncThunk(
  "branches/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get("/users/branches/", { params });
      return listFrom(response);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const createBranchAsync = createAsyncThunk(
  "branches/create",
  async (data, { rejectWithValue }) => {
    try {
      const response = await api.post("/users/branches/", data);
      return response.data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const updateBranchAsync = createAsyncThunk(
  "branches/update",
  async ({ branchId, updatedData }, { rejectWithValue }) => {
    try {
      const response = await api.patch(
        `/users/branches/${branchId}/`,
        updatedData
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const deleteBranchAsync = createAsyncThunk(
  "branches/delete",
  async (branchId, { rejectWithValue }) => {
    try {
      await api.delete(`/users/branches/${branchId}/`);
      return branchId;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const toggleBranchActiveAsync = createAsyncThunk(
  "branches/toggleActive",
  async ({ branchId, isActive }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/users/branches/${branchId}/`, {
        is_active: isActive,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);
