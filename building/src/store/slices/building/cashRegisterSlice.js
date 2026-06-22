import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import { applyPagination } from "../../pagination";
import {
  approveBuildingCashProcurement,
  fetchBuildingCashPendingProcurements,
  rejectBuildingCashProcurement,
} from "../../creators/building/cashRegisterCreators";

const initialState = {
  list: [],
  count: 0,
  next: null,
  previous: null,
  loading: false,
  loaded: false,
  error: null,
  decidingIds: {},
  decisionError: null,
};

const removeById = (list, payloadOrId) => {
  const id = payloadOrId?.id ?? payloadOrId?.uuid ?? payloadOrId;
  if (id == null) return list;
  return (Array.isArray(list) ? list : []).filter(
    (x) => String(x?.id ?? x?.uuid) !== String(id)
  );
};

const buildingCashRegisterSlice = createSlice({
  name: "buildingCashRegister",
  initialState,
  reducers: {
    clearBuildingCashRegisterErrors: (state) => {
      state.error = null;
      state.decisionError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBuildingCashPendingProcurements.pending, (state) => {
        state.loading = true;
        state.loaded = false;
        state.error = null;
      })
      .addCase(fetchBuildingCashPendingProcurements.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        applyPagination(state, action.payload, "list");
      })
      .addCase(fetchBuildingCashPendingProcurements.rejected, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error = action.payload ?? action.error?.message;
      })
      .addCase(approveBuildingCashProcurement.pending, (state, action) => {
        const id = action.meta.arg?.procurementId;
        if (id != null) state.decidingIds[id] = true;
        state.decisionError = null;
      })
      .addCase(approveBuildingCashProcurement.fulfilled, (state, action) => {
        const id = action.meta.arg?.procurementId;
        if (id != null) delete state.decidingIds[id];
        state.list = removeById(state.list, action.payload ?? id);
        state.count = Math.max(0, (state.count || 0) - 1);
      })
      .addCase(approveBuildingCashProcurement.rejected, (state, action) => {
        const id = action.meta.arg?.procurementId;
        if (id != null) delete state.decidingIds[id];
        state.decisionError = action.payload ?? action.error?.message;
      })
      .addCase(rejectBuildingCashProcurement.pending, (state, action) => {
        const id = action.meta.arg?.procurementId;
        if (id != null) state.decidingIds[id] = true;
        state.decisionError = null;
      })
      .addCase(rejectBuildingCashProcurement.fulfilled, (state, action) => {
        const id = action.meta.arg?.procurementId;
        if (id != null) delete state.decidingIds[id];
        state.list = removeById(state.list, action.payload ?? id);
        state.count = Math.max(0, (state.count || 0) - 1);
      })
      .addCase(rejectBuildingCashProcurement.rejected, (state, action) => {
        const id = action.meta.arg?.procurementId;
        if (id != null) delete state.decidingIds[id];
        state.decisionError = action.payload ?? action.error?.message;
      });
  },
});

export const { clearBuildingCashRegisterErrors } =
  buildingCashRegisterSlice.actions;

export default buildingCashRegisterSlice.reducer;

export const useBuildingCashRegister = () =>
  useSelector((state) => state.buildingCashRegister);

