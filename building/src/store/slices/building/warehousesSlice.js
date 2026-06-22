import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import { applyPagination } from "../../pagination";
import {
  fetchBuildingWarehouses,
  fetchBuildingWarehouseById,
  createBuildingWarehouse,
} from "../../creators/building/warehousesCreators";

const initialState = {
  list: [],
  count: 0,
  next: null,
  previous: null,
  loading: false,
  loaded: false,
  error: null,

  current: null,
  currentLoading: false,
  currentLoaded: false,
  currentError: null,
  creating: false,
  createError: null,
};

const upsertById = (list, payload) => {
  if (!payload) return list;
  const pid = payload?.id ?? payload?.uuid;
  if (pid == null) return list;
  const next = Array.isArray(list) ? [...list] : [];
  const idx = next.findIndex((x) => String(x?.id ?? x?.uuid) === String(pid));
  if (idx === -1) {
    next.unshift(payload);
    return next;
  }
  next[idx] = payload;
  return next;
};

const buildingWarehousesSlice = createSlice({
  name: "buildingWarehouses",
  initialState,
  reducers: {
    clearBuildingWarehouses: (state) => {
      state.list = [];
      state.count = 0;
      state.next = null;
      state.previous = null;
      state.loading = false;
      state.loaded = false;
      state.error = null;
      state.current = null;
      state.currentLoading = false;
      state.currentLoaded = false;
      state.currentError = null;
      state.creating = false;
      state.createError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBuildingWarehouses.pending, (state) => {
        state.loading = true;
        state.loaded = false;
        state.error = null;
      })
      .addCase(fetchBuildingWarehouses.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        applyPagination(state, action.payload, "list");
      })
      .addCase(fetchBuildingWarehouses.rejected, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error = action.payload ?? action.error?.message;
      })
      .addCase(fetchBuildingWarehouseById.pending, (state) => {
        state.currentLoading = true;
        state.currentLoaded = false;
        state.currentError = null;
      })
      .addCase(fetchBuildingWarehouseById.fulfilled, (state, action) => {
        state.currentLoading = false;
        state.currentLoaded = true;
        state.current = action.payload ?? null;
        state.list = upsertById(state.list, action.payload);
      })
      .addCase(fetchBuildingWarehouseById.rejected, (state, action) => {
        state.currentLoading = false;
        state.currentLoaded = true;
        state.currentError = action.payload ?? action.error?.message;
      })
      .addCase(createBuildingWarehouse.pending, (state) => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createBuildingWarehouse.fulfilled, (state, action) => {
        state.creating = false;
        if (action.payload) {
          state.list = [action.payload, ...state.list];
          state.count = (state.count || 0) + 1;
        }
      })
      .addCase(createBuildingWarehouse.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload ?? action.error?.message;
      });
  },
});

export const { clearBuildingWarehouses } = buildingWarehousesSlice.actions;

export default buildingWarehousesSlice.reducer;

export const useBuildingWarehouses = () =>
  useSelector((state) => state.buildingWarehouses);

