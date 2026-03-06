import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import { applyPagination } from "../../pagination";
import {
  fetchBuildingApartments,
  createBuildingApartment,
  updateBuildingApartment,
  deleteBuildingApartment,
  fetchBuildingResidentialFloors,
} from "../../creators/building/apartmentsCreators";

const initialState = {
  list: [],
  count: 0,
  next: null,
  previous: null,
  loading: false,
  loaded: false,
  error: null,

  creating: false,
  updatingIds: {},
  deletingIds: {},
  actionError: null,

  floors: [],
  floorsLoading: false,
  floorsError: null,
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

const buildingApartmentsSlice = createSlice({
  name: "buildingApartments",
  initialState,
  reducers: {
    clearBuildingApartmentsError: (state) => {
      state.error = null;
      state.actionError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBuildingApartments.pending, (state) => {
        state.loading = true;
        state.loaded = false;
        state.error = null;
      })
      .addCase(fetchBuildingApartments.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        applyPagination(state, action.payload, "list");
      })
      .addCase(fetchBuildingApartments.rejected, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error = action.payload ?? action.error?.message;
      })
      .addCase(createBuildingApartment.pending, (state) => {
        state.creating = true;
        state.actionError = null;
      })
      .addCase(createBuildingApartment.fulfilled, (state, action) => {
        state.creating = false;
        state.list = upsertById(state.list, action.payload);
        if (typeof state.count === "number") state.count += 1;
      })
      .addCase(createBuildingApartment.rejected, (state, action) => {
        state.creating = false;
        state.actionError = action.payload ?? action.error?.message;
      })
      .addCase(updateBuildingApartment.pending, (state, action) => {
        const id = action.meta.arg?.id;
        if (id != null) state.updatingIds[id] = true;
        state.actionError = null;
      })
      .addCase(updateBuildingApartment.fulfilled, (state, action) => {
        const id = action.meta.arg?.id;
        if (id != null) delete state.updatingIds[id];
        state.list = upsertById(state.list, action.payload);
      })
      .addCase(updateBuildingApartment.rejected, (state, action) => {
        const id = action.meta.arg?.id;
        if (id != null) delete state.updatingIds[id];
        state.actionError = action.payload ?? action.error?.message;
      })
      .addCase(deleteBuildingApartment.pending, (state, action) => {
        const id = action.meta.arg;
        if (id != null) state.deletingIds[id] = true;
        state.actionError = null;
      })
      .addCase(deleteBuildingApartment.fulfilled, (state, action) => {
        const id = action.payload;
        if (id != null) {
          delete state.deletingIds[id];
          state.list = (state.list || []).filter(
            (x) => String(x?.id ?? x?.uuid) !== String(id)
          );
          if (typeof state.count === "number" && state.count > 0) {
            state.count -= 1;
          }
        }
      })
      .addCase(deleteBuildingApartment.rejected, (state, action) => {
        const id = action.meta.arg;
        if (id != null) delete state.deletingIds[id];
        state.actionError = action.payload ?? action.error?.message;
      })
      .addCase(fetchBuildingResidentialFloors.pending, (state) => {
        state.floorsLoading = true;
        state.floorsError = null;
      })
      .addCase(fetchBuildingResidentialFloors.fulfilled, (state, action) => {
        state.floorsLoading = false;
        state.floors = Array.isArray(action.payload?.data)
          ? action.payload.data
          : [];
      })
      .addCase(fetchBuildingResidentialFloors.rejected, (state, action) => {
        state.floorsLoading = false;
        state.floorsError = action.payload ?? action.error?.message;
      });
  },
});

export const { clearBuildingApartmentsError } = buildingApartmentsSlice.actions;

export default buildingApartmentsSlice.reducer;

export const useBuildingApartments = () =>
  useSelector((state) => state.buildingApartments);

