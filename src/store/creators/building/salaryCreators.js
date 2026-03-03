import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../api";

const EMPLOYEES_BASE = "/building/salary/employees";
const PAYROLLS_BASE = "/building/salary/payrolls";
const LINES_BASE = "/building/salary/payroll-lines";

export const fetchBuildingSalaryEmployees = createAsyncThunk(
  "buildingSalary/fetchEmployees",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${EMPLOYEES_BASE}/`);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

export const updateBuildingSalaryEmployeeCompensation = createAsyncThunk(
  "buildingSalary/updateEmployeeCompensation",
  async ({ userId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(
        `${EMPLOYEES_BASE}/${userId}/compensation/`,
        payload,
      );
      return { userId, data };
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

export const fetchBuildingPayrolls = createAsyncThunk(
  "buildingSalary/fetchPayrolls",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${PAYROLLS_BASE}/`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

export const createBuildingPayroll = createAsyncThunk(
  "buildingSalary/createPayroll",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${PAYROLLS_BASE}/`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

export const updateBuildingPayroll = createAsyncThunk(
  "buildingSalary/updatePayroll",
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`${PAYROLLS_BASE}/${id}/`, payload);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

export const deleteBuildingPayroll = createAsyncThunk(
  "buildingSalary/deletePayroll",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`${PAYROLLS_BASE}/${id}/`);
      return id;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

export const approveBuildingPayroll = createAsyncThunk(
  "buildingSalary/approvePayroll",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`${PAYROLLS_BASE}/${id}/approve/`);
      return data ?? { id };
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

export const fetchBuildingPayrollLines = createAsyncThunk(
  "buildingSalary/fetchPayrollLines",
  async (payrollId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`${PAYROLLS_BASE}/${payrollId}/lines/`);
      return { payrollId, data };
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

export const createBuildingPayrollLine = createAsyncThunk(
  "buildingSalary/createPayrollLine",
  async ({ payrollId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(
        `${PAYROLLS_BASE}/${payrollId}/lines/`,
        payload,
      );
      return { payrollId, data };
    } catch (err) {
      return rejectWithValue(err?.response?.data || err?.message || err);
    }
  },
);

