import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import {
  createBuildingProcurementItem,
  deleteBuildingProcurementItem,
  fetchBuildingProcurementItems,
  updateBuildingProcurementItem,
} from "../../creators/building/procurementItemsCreators";

const listFrom = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload)) return payload;
  return [];
};

const ensureBucket = (state, procurementId) => {
  const key = procurementId == null ? "__none__" : String(procurementId);
  if (!state.byProcurementId[key]) {
    state.byProcurementId[key] = {
      list: [],
      loading: false,
      loaded: false,
      error: null,
      creating: false,
      createError: null,
      updatingIds: {},
      deletingIds: {},
    };
  }
  return state.byProcurementId[key];
};

const initialState = {
  byProcurementId: {},
};

const buildingProcurementItemsSlice = createSlice({
  name: "buildingProcurementItems",
  initialState,
  reducers: {
    clearBuildingProcurementItems: (state, action) => {
      const procurementId = action.payload;
      if (procurementId == null) {
        state.byProcurementId = {};
        return;
      }
      delete state.byProcurementId[String(procurementId)];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBuildingProcurementItems.pending, (state, action) => {
        const procurementId = action.meta.arg?.procurement;
        const bucket = ensureBucket(state, procurementId);
        bucket.loading = true;
        bucket.loaded = false;
        bucket.error = null;
      })
      .addCase(fetchBuildingProcurementItems.fulfilled, (state, action) => {
        const procurementId = action.meta.arg?.procurement;
        const bucket = ensureBucket(state, procurementId);
        bucket.loading = false;
        bucket.loaded = true;
        bucket.list = listFrom(action.payload);
      })
      .addCase(fetchBuildingProcurementItems.rejected, (state, action) => {
        const procurementId = action.meta.arg?.procurement;
        const bucket = ensureBucket(state, procurementId);
        bucket.loading = false;
        bucket.loaded = true;
        bucket.error = action.payload ?? action.error?.message;
      })
      .addCase(createBuildingProcurementItem.pending, (state, action) => {
        const procurementId = action.meta.arg?.procurement;
        const bucket = ensureBucket(state, procurementId);
        bucket.creating = true;
        bucket.createError = null;
      })
      .addCase(createBuildingProcurementItem.fulfilled, (state, action) => {
        const procurementId = action.meta.arg?.procurement;
        const bucket = ensureBucket(state, procurementId);
        bucket.creating = false;
        if (action.payload) bucket.list = [action.payload, ...bucket.list];
      })
      .addCase(createBuildingProcurementItem.rejected, (state, action) => {
        const procurementId = action.meta.arg?.procurement;
        const bucket = ensureBucket(state, procurementId);
        bucket.creating = false;
        bucket.createError = action.payload ?? action.error?.message;
      })
      .addCase(updateBuildingProcurementItem.pending, (state, action) => {
        const procurementId = action.meta.arg?.procurementId;
        const id = action.meta.arg?.id;
        const bucket = ensureBucket(state, procurementId);
        if (id != null) bucket.updatingIds[id] = true;
        bucket.error = null;
      })
      .addCase(updateBuildingProcurementItem.fulfilled, (state, action) => {
        const procurementId = action.payload?.procurementId;
        const item = action.payload?.item;
        const bucket = ensureBucket(state, procurementId);
        const id = item?.id ?? item?.uuid;
        if (id != null) delete bucket.updatingIds[id];
        if (!item) return;
        bucket.list = bucket.list.map((x) =>
          String(x?.id ?? x?.uuid) === String(id) ? item : x
        );
      })
      .addCase(updateBuildingProcurementItem.rejected, (state, action) => {
        const procurementId = action.meta.arg?.procurementId;
        const id = action.meta.arg?.id;
        const bucket = ensureBucket(state, procurementId);
        if (id != null) delete bucket.updatingIds[id];
        bucket.error = action.payload ?? action.error?.message;
      })
      .addCase(deleteBuildingProcurementItem.pending, (state, action) => {
        const procurementId = action.meta.arg?.procurementId;
        const id = action.meta.arg?.id;
        const bucket = ensureBucket(state, procurementId);
        if (id != null) bucket.deletingIds[id] = true;
        bucket.error = null;
      })
      .addCase(deleteBuildingProcurementItem.fulfilled, (state, action) => {
        const procurementId = action.payload?.procurementId;
        const id = action.payload?.id;
        const bucket = ensureBucket(state, procurementId);
        if (id != null) delete bucket.deletingIds[id];
        if (id == null) return;
        bucket.list = bucket.list.filter(
          (x) => String(x?.id ?? x?.uuid) !== String(id)
        );
      })
      .addCase(deleteBuildingProcurementItem.rejected, (state, action) => {
        const procurementId = action.meta.arg?.procurementId;
        const id = action.meta.arg?.id;
        const bucket = ensureBucket(state, procurementId);
        if (id != null) delete bucket.deletingIds[id];
        bucket.error = action.payload ?? action.error?.message;
      });
  },
});

export const { clearBuildingProcurementItems } =
  buildingProcurementItemsSlice.actions;

export default buildingProcurementItemsSlice.reducer;

export const useBuildingProcurementItems = () =>
  useSelector((state) => state.buildingProcurementItems);

