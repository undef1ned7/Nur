import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import { applyPagination } from "../../pagination";
import {
  fetchBuildingWorkEntries,
  createBuildingWorkEntry,
  updateBuildingWorkEntry,
  deleteBuildingWorkEntry,
  fetchBuildingWorkEntryById,
  createBuildingWorkEntryPhoto,
  createBuildingWorkEntryFile,
} from "../../creators/building/workEntriesCreators";

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
  if (idx === -1) {
    next.unshift(payload);
    return next;
  }
  next[idx] = payload;
  return next;
};

const buildingWorkEntriesSlice = createSlice({
  name: "buildingWorkEntries",
  initialState,
  reducers: {
    clearBuildingWorkEntriesError: (state) => {
      state.error = null;
      state.actionError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBuildingWorkEntries.pending, (state) => {
        state.loading = true;
        state.loaded = false;
        state.error = null;
      })
      .addCase(fetchBuildingWorkEntries.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        applyPagination(state, action.payload, "list");
      })
      .addCase(fetchBuildingWorkEntries.rejected, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error = action.payload ?? action.error?.message;
      })
      .addCase(createBuildingWorkEntry.pending, (state) => {
        state.creating = true;
        state.actionError = null;
      })
      .addCase(createBuildingWorkEntry.fulfilled, (state, action) => {
        state.creating = false;
        state.list = upsertById(state.list, action.payload);
        if (typeof state.count === "number") state.count += 1;
      })
      .addCase(createBuildingWorkEntry.rejected, (state, action) => {
        state.creating = false;
        state.actionError = action.payload ?? action.error?.message;
      })
      .addCase(updateBuildingWorkEntry.pending, (state, action) => {
        const id = action.meta.arg?.id;
        if (id != null) state.updatingIds[id] = true;
        state.actionError = null;
      })
      .addCase(updateBuildingWorkEntry.fulfilled, (state, action) => {
        const id = action.meta.arg?.id;
        if (id != null) delete state.updatingIds[id];
        state.list = upsertById(state.list, action.payload);
        if (
          state.current &&
          String(state.current.id ?? state.current.uuid) === String(id)
        ) {
          state.current = { ...state.current, ...action.payload };
        }
      })
      .addCase(updateBuildingWorkEntry.rejected, (state, action) => {
        const id = action.meta.arg?.id;
        if (id != null) delete state.updatingIds[id];
        state.actionError = action.payload ?? action.error?.message;
      })
      .addCase(deleteBuildingWorkEntry.pending, (state, action) => {
        const id = action.meta.arg;
        if (id != null) state.deletingIds[id] = true;
        state.actionError = null;
      })
      .addCase(deleteBuildingWorkEntry.fulfilled, (state, action) => {
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
      .addCase(deleteBuildingWorkEntry.rejected, (state, action) => {
        const id = action.meta.arg;
        if (id != null) delete state.deletingIds[id];
        state.actionError = action.payload ?? action.error?.message;
      })
      .addCase(fetchBuildingWorkEntryById.pending, (state) => {
        state.currentLoading = true;
        state.currentLoaded = false;
        state.currentError = null;
      })
      .addCase(fetchBuildingWorkEntryById.fulfilled, (state, action) => {
        state.currentLoading = false;
        state.currentLoaded = true;
        state.current = action.payload ?? null;
      })
      .addCase(fetchBuildingWorkEntryById.rejected, (state, action) => {
        state.currentLoading = false;
        state.currentLoaded = true;
        state.currentError = action.payload ?? action.error?.message;
      })
      .addCase(createBuildingWorkEntryPhoto.fulfilled, (state, action) => {
        const { entryId, photo } = action.payload || {};
        if (!entryId || !photo) return;
        if (
          state.current &&
          String(state.current.id ?? state.current.uuid) === String(entryId)
        ) {
          const prev = Array.isArray(state.current.photos)
            ? state.current.photos
            : [];
          state.current.photos = [photo, ...prev];
        }
        state.list = (state.list || []).map((x) => {
          const xid = x?.id ?? x?.uuid;
          if (String(xid) !== String(entryId)) return x;
          const prev = Array.isArray(x.photos) ? x.photos : [];
          return {
            ...x,
            photos: [photo, ...prev],
          };
        });
      })
      .addCase(createBuildingWorkEntryFile.fulfilled, (state, action) => {
        const { entryId, file } = action.payload || {};
        if (!entryId || !file) return;
        if (
          state.current &&
          String(state.current.id ?? state.current.uuid) === String(entryId)
        ) {
          const prev = Array.isArray(state.current.files)
            ? state.current.files
            : [];
          state.current.files = [file, ...prev];
        }
        state.list = (state.list || []).map((x) => {
          const xid = x?.id ?? x?.uuid;
          if (String(xid) !== String(entryId)) return x;
          const prev = Array.isArray(x.files) ? x.files : [];
          return {
            ...x,
            files: [file, ...prev],
          };
        });
      });
  },
});

export const { clearBuildingWorkEntriesError } = buildingWorkEntriesSlice.actions;

export default buildingWorkEntriesSlice.reducer;

export const useBuildingWorkEntries = () =>
  useSelector((state) => state.buildingWorkEntries);

