import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import { applyPagination } from "../../pagination";
import { fetchBuildingWorkflowEvents } from "../../creators/building/workflowCreators";

const ensureBucket = (state, procurementId) => {
  const key = procurementId == null ? "__none__" : String(procurementId);
  if (!state.byProcurementId[key]) {
    state.byProcurementId[key] = {
      list: [],
      count: 0,
      next: null,
      previous: null,
      loading: false,
      loaded: false,
      error: null,
    };
  }
  return state.byProcurementId[key];
};

const initialState = {
  byProcurementId: {},
};

const buildingWorkflowEventsSlice = createSlice({
  name: "buildingWorkflowEvents",
  initialState,
  reducers: {
    clearBuildingWorkflowEvents: (state, action) => {
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
      .addCase(fetchBuildingWorkflowEvents.pending, (state, action) => {
        const procurementId = action.meta.arg?.procurement;
        const bucket = ensureBucket(state, procurementId);
        bucket.loading = true;
        bucket.loaded = false;
        bucket.error = null;
      })
      .addCase(fetchBuildingWorkflowEvents.fulfilled, (state, action) => {
        const procurementId = action.meta.arg?.procurement;
        const bucket = ensureBucket(state, procurementId);
        bucket.loading = false;
        bucket.loaded = true;
        applyPagination(bucket, action.payload, "list");
      })
      .addCase(fetchBuildingWorkflowEvents.rejected, (state, action) => {
        const procurementId = action.meta.arg?.procurement;
        const bucket = ensureBucket(state, procurementId);
        bucket.loading = false;
        bucket.loaded = true;
        bucket.error = action.payload ?? action.error?.message;
      });
  },
});

export const { clearBuildingWorkflowEvents } =
  buildingWorkflowEventsSlice.actions;

export default buildingWorkflowEventsSlice.reducer;

export const useBuildingWorkflowEvents = () =>
  useSelector((state) => state.buildingWorkflowEvents);

