import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import { applyPagination } from "../../pagination";
import {
  fetchBuildingDrawings,
  createBuildingDrawing,
  updateBuildingDrawing,
  deleteBuildingDrawing,
} from "../../creators/building/drawingsCreators";

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

const buildingDrawingsSlice = createSlice({
  name: "buildingDrawings",
  initialState,
  reducers: {
    clearBuildingDrawingsError: (state) => {
      state.error = null;
      state.actionError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBuildingDrawings.pending, (state) => {
        state.loading = true;
        state.loaded = false;
        state.error = null;
      })
      .addCase(fetchBuildingDrawings.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        applyPagination(state, action.payload, "list");
      })
      .addCase(fetchBuildingDrawings.rejected, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error = action.payload ?? action.error?.message;
      })
      .addCase(createBuildingDrawing.pending, (state) => {
        state.creating = true;
        state.actionError = null;
      })
      .addCase(createBuildingDrawing.fulfilled, (state, action) => {
        state.creating = false;
        state.list = upsertById(state.list, action.payload);
        if (typeof state.count === "number") state.count += 1;
      })
      .addCase(createBuildingDrawing.rejected, (state, action) => {
        state.creating = false;
        state.actionError = action.payload ?? action.error?.message;
      })
      .addCase(updateBuildingDrawing.pending, (state, action) => {
        const id = action.meta.arg?.id;
        if (id != null) state.updatingIds[id] = true;
        state.actionError = null;
      })
      .addCase(updateBuildingDrawing.fulfilled, (state, action) => {
        const id = action.meta.arg?.id;
        if (id != null) delete state.updatingIds[id];
        state.list = upsertById(state.list, action.payload);
      })
      .addCase(updateBuildingDrawing.rejected, (state, action) => {
        const id = action.meta.arg?.id;
        if (id != null) delete state.updatingIds[id];
        state.actionError = action.payload ?? action.error?.message;
      })
      .addCase(deleteBuildingDrawing.pending, (state, action) => {
        const id = action.meta.arg;
        if (id != null) state.deletingIds[id] = true;
        state.actionError = null;
      })
      .addCase(deleteBuildingDrawing.fulfilled, (state, action) => {
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
      .addCase(deleteBuildingDrawing.rejected, (state, action) => {
        const id = action.meta.arg;
        if (id != null) delete state.deletingIds[id];
        state.actionError = action.payload ?? action.error?.message;
      });
  },
});

export const { clearBuildingDrawingsError } = buildingDrawingsSlice.actions;

export default buildingDrawingsSlice.reducer;

export const useBuildingDrawings = () =>
  useSelector((state) => state.buildingDrawings);

