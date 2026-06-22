import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import { applyPagination } from "../../pagination";
import {
  acceptBuildingWarehouseTransfer,
  fetchBuildingWarehouseTransferById,
  fetchBuildingWarehouseTransfers,
  rejectBuildingWarehouseTransfer,
} from "../../creators/building/transfersCreators";

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

  current: null,
  currentLoading: false,
  currentLoaded: false,
  currentError: null,
};

const upsertById = (list, payload) => {
  if (!payload) return list;
  const pid = payload?.id ?? payload?.uuid;
  if (pid == null) return list;
  const next = Array.isArray(list) ? [...list] : [];
  const idx = next.findIndex((x) => String(x?.id ?? x?.uuid) === String(pid));
  if (idx === -1) return next;
  next[idx] = payload;
  return next;
};

const buildingTransfersSlice = createSlice({
  name: "buildingTransfers",
  initialState,
  reducers: {
    clearBuildingTransfersErrors: (state) => {
      state.error = null;
      state.decisionError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBuildingWarehouseTransfers.pending, (state) => {
        state.loading = true;
        state.loaded = false;
        state.error = null;
      })
      .addCase(fetchBuildingWarehouseTransfers.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        applyPagination(state, action.payload, "list");
      })
      .addCase(fetchBuildingWarehouseTransfers.rejected, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error = action.payload ?? action.error?.message;
      })
      .addCase(acceptBuildingWarehouseTransfer.pending, (state, action) => {
        const id = action.meta.arg?.transferId;
        if (id != null) state.decidingIds[id] = true;
        state.decisionError = null;
      })
      .addCase(acceptBuildingWarehouseTransfer.fulfilled, (state, action) => {
        const id = action.meta.arg?.transferId;
        if (id != null) delete state.decidingIds[id];
        state.list = upsertById(state.list, action.payload);
      })
      .addCase(acceptBuildingWarehouseTransfer.rejected, (state, action) => {
        const id = action.meta.arg?.transferId;
        if (id != null) delete state.decidingIds[id];
        state.decisionError = action.payload ?? action.error?.message;
      })
      .addCase(rejectBuildingWarehouseTransfer.pending, (state, action) => {
        const id = action.meta.arg?.transferId;
        if (id != null) state.decidingIds[id] = true;
        state.decisionError = null;
      })
      .addCase(rejectBuildingWarehouseTransfer.fulfilled, (state, action) => {
        const id = action.meta.arg?.transferId;
        if (id != null) delete state.decidingIds[id];
        state.list = upsertById(state.list, action.payload);
      })
      .addCase(rejectBuildingWarehouseTransfer.rejected, (state, action) => {
        const id = action.meta.arg?.transferId;
        if (id != null) delete state.decidingIds[id];
        state.decisionError = action.payload ?? action.error?.message;
      })
      .addCase(fetchBuildingWarehouseTransferById.pending, (state) => {
        state.currentLoading = true;
        state.currentLoaded = false;
        state.currentError = null;
      })
      .addCase(fetchBuildingWarehouseTransferById.fulfilled, (state, action) => {
        state.currentLoading = false;
        state.currentLoaded = true;
        state.current = action.payload ?? null;
      })
      .addCase(fetchBuildingWarehouseTransferById.rejected, (state, action) => {
        state.currentLoading = false;
        state.currentLoaded = true;
        state.currentError = action.payload ?? action.error?.message;
      });
  },
});

export const { clearBuildingTransfersErrors } = buildingTransfersSlice.actions;

export default buildingTransfersSlice.reducer;

export const useBuildingTransfers = () =>
  useSelector((state) => state.buildingTransfers);

