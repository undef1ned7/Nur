import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import { applyPagination } from "../../pagination";
import {
  createBuildingProcurement,
  createBuildingTransferFromProcurement,
  fetchBuildingProcurements,
  fetchBuildingProcurementById,
  submitBuildingProcurementToCash,
} from "../../creators/building/procurementsCreators";

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

  submittingToCashIds: {},
  creatingTransferIds: {},
  actionError: null,
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

const buildingProcurementsSlice = createSlice({
  name: "buildingProcurements",
  initialState,
  reducers: {
    clearBuildingProcurementsError: (state) => {
      state.error = null;
      state.createError = null;
      state.actionError = null;
    },
    clearBuildingProcurements: (state) => {
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
      state.submittingToCashIds = {};
      state.creatingTransferIds = {};
      state.actionError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBuildingProcurements.pending, (state) => {
        state.loading = true;
        state.loaded = false;
        state.error = null;
      })
      .addCase(fetchBuildingProcurements.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        applyPagination(state, action.payload, "list");
      })
      .addCase(fetchBuildingProcurements.rejected, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error = action.payload ?? action.error?.message;
      })
      .addCase(fetchBuildingProcurementById.pending, (state) => {
        state.currentLoading = true;
        state.currentLoaded = false;
        state.currentError = null;
      })
      .addCase(fetchBuildingProcurementById.fulfilled, (state, action) => {
        state.currentLoading = false;
        state.currentLoaded = true;
        state.current = action.payload ?? null;
        // если в списке есть такая закупка — обновим ее тоже
        state.list = upsertById(state.list, action.payload);
      })
      .addCase(fetchBuildingProcurementById.rejected, (state, action) => {
        state.currentLoading = false;
        state.currentLoaded = true;
        state.currentError = action.payload ?? action.error?.message;
      })
      .addCase(createBuildingProcurement.pending, (state) => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createBuildingProcurement.fulfilled, (state, action) => {
        state.creating = false;
        if (action.payload) {
          state.list = [action.payload, ...state.list];
          state.count = (state.count || 0) + 1;
        }
      })
      .addCase(createBuildingProcurement.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload ?? action.error?.message;
      })
      .addCase(submitBuildingProcurementToCash.pending, (state, action) => {
        const id = action.meta.arg;
        if (id != null) state.submittingToCashIds[id] = true;
        state.actionError = null;
      })
      .addCase(submitBuildingProcurementToCash.fulfilled, (state, action) => {
        const argId = action.meta.arg;
        if (argId != null) delete state.submittingToCashIds[argId];
        state.list = upsertById(state.list, action.payload);
        if (
          state.current &&
          String(state.current?.id ?? state.current?.uuid) === String(argId)
        ) {
          state.current = action.payload;
        }
      })
      .addCase(submitBuildingProcurementToCash.rejected, (state, action) => {
        const id = action.meta.arg;
        if (id != null) delete state.submittingToCashIds[id];
        state.actionError = action.payload ?? action.error?.message;
      })
      .addCase(createBuildingTransferFromProcurement.pending, (state, action) => {
        const id = action.meta.arg?.procurementId;
        if (id != null) state.creatingTransferIds[id] = true;
        state.actionError = null;
      })
      .addCase(createBuildingTransferFromProcurement.fulfilled, (state, action) => {
        const id = action.meta.arg?.procurementId;
        if (id != null) delete state.creatingTransferIds[id];
        // Обычно endpoint возвращает transfer, но если вернет procurement — обновим.
        state.list = upsertById(state.list, action.payload);
        if (
          state.current &&
          String(state.current?.id ?? state.current?.uuid) === String(id)
        ) {
          state.current = action.payload;
        }
      })
      .addCase(createBuildingTransferFromProcurement.rejected, (state, action) => {
        const id = action.meta.arg?.procurementId;
        if (id != null) delete state.creatingTransferIds[id];
        state.actionError = action.payload ?? action.error?.message;
      });
  },
});

export const { clearBuildingProcurements, clearBuildingProcurementsError } =
  buildingProcurementsSlice.actions;

export default buildingProcurementsSlice.reducer;

export const useBuildingProcurements = () =>
  useSelector((state) => state.buildingProcurements);

