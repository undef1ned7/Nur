import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import { applyPagination } from "../../pagination";
import {
  fetchBuildingContractors,
  createBuildingContractor,
  updateBuildingContractor,
  deleteBuildingContractor,
} from "../../creators/building/contractorsCreators";

const initialState = {
  list: [],
  count: 0,
  next: null,
  previous: null,
  loading: false,
  loaded: false,
  error: null,
  creating: false,
  createError: null,
  updatingId: null,
  updatingError: null,
  deletingId: null,
};

const upsertById = (list, payload) => {
  if (!payload) return list;
  const id = payload?.id ?? payload?.uuid;
  if (id == null) return list;
  const next = Array.isArray(list) ? [...list] : [];
  const idx = next.findIndex((x) => String(x?.id ?? x?.uuid) === String(id));
  if (idx >= 0) next[idx] = payload;
  else next.push(payload);
  return next;
};

const buildingContractorsSlice = createSlice({
  name: "buildingContractors",
  initialState,
  reducers: {
    clearBuildingContractorsError: (state) => {
      state.error = null;
      state.createError = null;
      state.updatingError = null;
    },
    clearBuildingContractors: (state) => {
      state.list = [];
      state.count = 0;
      state.next = null;
      state.previous = null;
      state.loading = false;
      state.loaded = false;
      state.error = null;
      state.creating = false;
      state.createError = null;
      state.updatingId = null;
      state.updatingError = null;
      state.deletingId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBuildingContractors.pending, (state) => {
        state.loading = true;
        state.loaded = false;
        state.error = null;
      })
      .addCase(fetchBuildingContractors.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        applyPagination(state, action.payload, "list");
      })
      .addCase(fetchBuildingContractors.rejected, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error = action.payload ?? action.error?.message;
      })
      .addCase(createBuildingContractor.pending, (state) => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createBuildingContractor.fulfilled, (state, action) => {
        state.creating = false;
        if (action.payload) {
          state.list = [action.payload, ...(state.list || [])];
          state.count = (state.count || 0) + 1;
        }
      })
      .addCase(createBuildingContractor.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload ?? action.error?.message;
      })
      .addCase(updateBuildingContractor.pending, (state, action) => {
        state.updatingId = action.meta.arg?.id ?? null;
        state.updatingError = null;
      })
      .addCase(updateBuildingContractor.fulfilled, (state, action) => {
        state.updatingId = null;
        if (action.payload) {
          state.list = upsertById(state.list || [], action.payload);
        }
      })
      .addCase(updateBuildingContractor.rejected, (state, action) => {
        state.updatingId = null;
        state.updatingError = action.payload ?? action.error?.message;
      })
      .addCase(deleteBuildingContractor.pending, (state, action) => {
        state.deletingId = action.meta.arg ?? null;
      })
      .addCase(deleteBuildingContractor.fulfilled, (state, action) => {
        const id = action.payload;
        state.deletingId = null;
        if (id != null && Array.isArray(state.list)) {
          state.list = state.list.filter(
            (x) => String(x?.id ?? x?.uuid) !== String(id),
          );
          state.count = Math.max(0, (state.count || 1) - 1);
        }
      })
      .addCase(deleteBuildingContractor.rejected, (state) => {
        state.deletingId = null;
      });
  },
});

export const { clearBuildingContractors, clearBuildingContractorsError } =
  buildingContractorsSlice.actions;

export default buildingContractorsSlice.reducer;

export const useBuildingContractors = () =>
  useSelector((state) => state.buildingContractors);

