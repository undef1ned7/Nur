import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import { applyPagination } from "../../pagination";
import {
  fetchBuildingSalaryEmployees,
  updateBuildingSalaryEmployeeCompensation,
  fetchBuildingPayrolls,
  createBuildingPayroll,
  updateBuildingPayroll,
  deleteBuildingPayroll,
  approveBuildingPayroll,
  fetchBuildingPayrollLines,
  createBuildingPayrollLine,
} from "../../creators/building/salaryCreators";

const initialState = {
  employees: [],
  employeesLoading: false,
  employeesError: null,
  employeesUpdatingId: null,

  payrolls: [],
  payrollsCount: 0,
  payrollsLoading: false,
  payrollsError: null,
  payrollsCreating: false,

  linesByPayrollId: {},
};

const ensureLinesBucket = (state, payrollId) => {
  const key = String(payrollId);
  if (!state.linesByPayrollId[key]) {
    state.linesByPayrollId[key] = {
      list: [],
      loading: false,
      error: null,
    };
  }
  return state.linesByPayrollId[key];
};

const upsertById = (list, payload) => {
  if (!payload) return list;
  const id = payload?.id ?? payload?.uuid;
  if (id == null) return list;
  const next = Array.isArray(list) ? [...list] : [];
  const idx = next.findIndex((x) => String(x?.id ?? x?.uuid) === String(id));
  if (idx === -1) next.unshift(payload);
  else next[idx] = payload;
  return next;
};

const buildingSalarySlice = createSlice({
  name: "buildingSalary",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchBuildingSalaryEmployees.pending, (state) => {
        state.employeesLoading = true;
        state.employeesError = null;
      })
      .addCase(fetchBuildingSalaryEmployees.fulfilled, (state, action) => {
        state.employeesLoading = false;
        state.employees = Array.isArray(action.payload)
          ? action.payload
          : [];
      })
      .addCase(fetchBuildingSalaryEmployees.rejected, (state, action) => {
        state.employeesLoading = false;
        state.employeesError = action.payload ?? action.error?.message;
      })
      .addCase(
        updateBuildingSalaryEmployeeCompensation.pending,
        (state, action) => {
          state.employeesUpdatingId = action.meta.arg?.userId ?? null;
        },
      )
      .addCase(
        updateBuildingSalaryEmployeeCompensation.fulfilled,
        (state, action) => {
          const userId = action.meta.arg?.userId;
          state.employeesUpdatingId = null;
          if (!userId || !action.payload?.data) return;
          state.employees = (state.employees || []).map((e) =>
            String(e.id ?? e.uuid) === String(userId)
              ? { ...e, compensation: action.payload.data }
              : e,
          );
        },
      )
      .addCase(
        updateBuildingSalaryEmployeeCompensation.rejected,
        (state) => {
          state.employeesUpdatingId = null;
        },
      )

      .addCase(fetchBuildingPayrolls.pending, (state) => {
        state.payrollsLoading = true;
        state.payrollsError = null;
      })
      .addCase(fetchBuildingPayrolls.fulfilled, (state, action) => {
        state.payrollsLoading = false;
        applyPagination(
          {
            list: state.payrolls,
            count: state.payrollsCount,
          },
          action.payload,
          "list",
        );
        state.payrolls = action.payload?.results || action.payload || [];
        state.payrollsCount = action.payload?.count ?? state.payrolls.length;
      })
      .addCase(fetchBuildingPayrolls.rejected, (state, action) => {
        state.payrollsLoading = false;
        state.payrollsError = action.payload ?? action.error?.message;
      })
      .addCase(createBuildingPayroll.pending, (state) => {
        state.payrollsCreating = true;
        state.payrollsError = null;
      })
      .addCase(createBuildingPayroll.fulfilled, (state, action) => {
        state.payrollsCreating = false;
        if (action.payload) {
          state.payrolls = upsertById(state.payrolls, action.payload);
          state.payrollsCount =
            typeof state.payrollsCount === "number"
              ? state.payrollsCount + 1
              : state.payrolls.length;
        }
      })
      .addCase(createBuildingPayroll.rejected, (state, action) => {
        state.payrollsCreating = false;
        state.payrollsError = action.payload ?? action.error?.message;
      })
      .addCase(updateBuildingPayroll.fulfilled, (state, action) => {
        state.payrolls = upsertById(state.payrolls, action.payload);
      })
      .addCase(deleteBuildingPayroll.fulfilled, (state, action) => {
        const id = action.payload;
        if (id != null) {
          state.payrolls = (state.payrolls || []).filter(
            (p) => String(p.id ?? p.uuid) !== String(id),
          );
          if (typeof state.payrollsCount === "number" && state.payrollsCount) {
            state.payrollsCount -= 1;
          }
          delete state.linesByPayrollId[String(id)];
        }
      })
      .addCase(approveBuildingPayroll.fulfilled, (state, action) => {
        if (!action.payload) return;
        state.payrolls = upsertById(state.payrolls, action.payload);
      })

      .addCase(fetchBuildingPayrollLines.pending, (state, action) => {
        const payrollId = action.meta.arg;
        const bucket = ensureLinesBucket(state, payrollId);
        bucket.loading = true;
        bucket.error = null;
      })
      .addCase(fetchBuildingPayrollLines.fulfilled, (state, action) => {
        const payrollId = action.payload?.payrollId;
        const bucket = ensureLinesBucket(state, payrollId);
        bucket.loading = false;
        const data = action.payload?.data;
        bucket.list = Array.isArray(data?.results) ? data.results : data || [];
      })
      .addCase(fetchBuildingPayrollLines.rejected, (state, action) => {
        const payrollId = action.meta.arg;
        const bucket = ensureLinesBucket(state, payrollId);
        bucket.loading = false;
        bucket.error = action.payload ?? action.error?.message;
      })
      .addCase(createBuildingPayrollLine.fulfilled, (state, action) => {
        const payrollId = action.payload?.payrollId;
        const line = action.payload?.data;
        if (!payrollId || !line) return;
        const bucket = ensureLinesBucket(state, payrollId);
        bucket.list = upsertById(bucket.list, line);
      });
  },
});

export default buildingSalarySlice.reducer;

export const useBuildingSalary = () =>
  useSelector((state) => state.buildingSalary);

