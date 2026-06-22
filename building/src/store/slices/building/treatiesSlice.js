import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import { applyPagination } from "../../pagination";
import {
  fetchBuildingTreaties,
  fetchBuildingTreatyById,
  createBuildingTreaty,
  updateBuildingTreaty,
  deleteBuildingTreaty,
  createBuildingTreatyInErp,
  createBuildingTreatyFile,
} from "../../creators/building/treatiesCreators";

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
  erpCreatingId: null,
  erpError: null,
  current: null,
  currentLoading: false,
  currentLoaded: false,
  currentError: null,
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

const buildingTreatiesSlice = createSlice({
  name: "buildingTreaties",
  initialState,
  reducers: {
    clearBuildingTreatiesError: (state) => {
      state.error = null;
      state.createError = null;
      state.updatingError = null;
      state.erpError = null;
    },
    clearBuildingTreaties: (state) => {
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
      state.erpCreatingId = null;
      state.erpError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBuildingTreatyById.pending, (state) => {
        state.currentLoading = true;
        state.currentLoaded = false;
        state.currentError = null;
      })
      .addCase(fetchBuildingTreatyById.fulfilled, (state, action) => {
        state.currentLoading = false;
        state.currentLoaded = true;
        state.currentError = null;
        const payload = action.payload?.data ?? action.payload;
        state.current = payload || null;
        if (payload) {
          state.list = upsertById(state.list || [], payload);
        }
      })
      .addCase(fetchBuildingTreatyById.rejected, (state, action) => {
        state.currentLoading = false;
        state.currentLoaded = true;
        state.currentError = action.payload ?? action.error?.message;
      })
      .addCase(fetchBuildingTreaties.pending, (state) => {
        state.loading = true;
        state.loaded = false;
        state.error = null;
      })
      .addCase(fetchBuildingTreaties.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        applyPagination(state, action.payload, "list");
      })
      .addCase(fetchBuildingTreaties.rejected, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error = action.payload ?? action.error?.message;
      })
      .addCase(createBuildingTreaty.pending, (state) => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createBuildingTreaty.fulfilled, (state, action) => {
        state.creating = false;
        if (action.payload) {
          state.list = [action.payload, ...(state.list || [])];
          state.count = (state.count || 0) + 1;
          state.current = action.payload;
        }
      })
      .addCase(createBuildingTreaty.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload ?? action.error?.message;
      })
      .addCase(updateBuildingTreaty.pending, (state, action) => {
        state.updatingId = action.meta.arg?.id ?? null;
        state.updatingError = null;
      })
      .addCase(updateBuildingTreaty.fulfilled, (state, action) => {
        state.updatingId = null;
        if (action.payload) {
          state.list = upsertById(state.list || [], action.payload);
          const id = action.payload?.id ?? action.payload?.uuid;
          if (
            state.current &&
            String(state.current.id ?? state.current.uuid) === String(id)
          ) {
            state.current = action.payload;
          }
        }
      })
      .addCase(updateBuildingTreaty.rejected, (state, action) => {
        state.updatingId = null;
        state.updatingError = action.payload ?? action.error?.message;
      })
      .addCase(deleteBuildingTreaty.pending, (state, action) => {
        state.deletingId = action.meta.arg ?? null;
      })
      .addCase(deleteBuildingTreaty.fulfilled, (state, action) => {
        const id = action.payload;
        state.deletingId = null;
        if (id != null && Array.isArray(state.list)) {
          state.list = state.list.filter(
            (x) => String(x?.id ?? x?.uuid) !== String(id)
          );
          state.count = Math.max(0, (state.count || 1) - 1);
        }
      })
      .addCase(deleteBuildingTreaty.rejected, (state) => {
        state.deletingId = null;
      })
      .addCase(createBuildingTreatyInErp.pending, (state, action) => {
        state.erpCreatingId = action.meta.arg ?? null;
        state.erpError = null;
      })
      .addCase(createBuildingTreatyInErp.fulfilled, (state, action) => {
        state.erpCreatingId = null;
        if (
          action.payload &&
          typeof action.payload === "object" &&
          (action.payload.id || action.payload.uuid)
        ) {
          state.list = upsertById(state.list || [], action.payload);
          const id = action.payload.id ?? action.payload.uuid;
          if (
            state.current &&
            String(state.current.id ?? state.current.uuid) === String(id)
          ) {
            state.current = action.payload;
          }
        }
      })
      .addCase(createBuildingTreatyInErp.rejected, (state, action) => {
        state.erpCreatingId = null;
        state.erpError = action.payload ?? action.error?.message;
      })
      .addCase(createBuildingTreatyFile.fulfilled, (state, action) => {
        // API может вернуть обновленный договор или список файлов
        if (!action.payload) return;
        if (Array.isArray(action.payload.files)) {
          if (state.current) {
            state.current = {
              ...state.current,
              files: action.payload.files,
            };
          }
        } else if (action.payload.id || action.payload.uuid) {
          state.list = upsertById(state.list || [], action.payload);
          const id = action.payload.id ?? action.payload.uuid;
          if (
            state.current &&
            String(state.current.id ?? state.current.uuid) === String(id)
          ) {
            state.current = action.payload;
          }
        }
      });
  },
});

export const { clearBuildingTreaties, clearBuildingTreatiesError } =
  buildingTreatiesSlice.actions;

export default buildingTreatiesSlice.reducer;

export const useBuildingTreaties = () =>
  useSelector((state) => state.buildingTreaties);
