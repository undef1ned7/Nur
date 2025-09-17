// src/creators/departmentCreators.js
import { createAsyncThunk } from "@reduxjs/toolkit";
import departmentAnalyticsApi from "../../api/departments";
import api from "../../api";

export const fetchDepartmentsAsync = createAsyncThunk(
  "departments/fetchAll",
  async (_, thunkAPI) => {
    try {
      return await departmentAnalyticsApi.getDepartmentAnalytics();
    } catch (err) {
      return thunkAPI.rejectWithValue(err);
    }
  }
);

export const fetchDepartmentByIdAsync = createAsyncThunk(
  "departments/fetchById",
  async (id, thunkAPI) => {
    try {
      return await departmentAnalyticsApi.getDepartmentAnalytics(id);
    } catch (err) {
      return thunkAPI.rejectWithValue(err);
    }
  }
);

export const updateEmployees = createAsyncThunk(
  "update/employee",
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const { data: response } = await api.patch(
        `/users/employees/${id}/`,
        data
      );
      return response;
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);

export const getDepartments = createAsyncThunk(
  "get/departments",
  async (_, { rejectWithValue }) => {
    try {
      const { data: response } = await api.get(`/construction/departments/`);
      return response.results;
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);
