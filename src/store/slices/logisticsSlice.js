import { createSlice } from "@reduxjs/toolkit";
import {
  fetchLogisticsAsync,
  createLogisticAsync,
  updateLogisticAsync,
  fetchLogisticsAnalyticsAsync,
} from "../creators/logisticsCreators";
import { useSelector } from "react-redux";

const initialState = {
  list: [],
  count: 0,
  next: null,
  previous: null,
  loading: false,
  error: null,
  creating: false,
  updating: false,
  analytics: null,
  analyticsLoading: false,
};

const logisticsSlice = createSlice({
  name: "logistics",
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder
      // list
      .addCase(fetchLogisticsAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLogisticsAsync.fulfilled, (state, action) => {
        const payload = action.payload;
        const results = Array.isArray(payload?.results)
          ? payload.results
          : Array.isArray(payload)
          ? payload
          : [];
        state.list = results;
        state.count = payload?.count ?? results.length;
        state.next = payload?.next ?? null;
        state.previous = payload?.previous ?? null;
        state.loading = false;
      })
      .addCase(fetchLogisticsAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // create
      .addCase(createLogisticAsync.pending, (state) => {
        state.creating = true;
        state.error = null;
      })
      .addCase(createLogisticAsync.fulfilled, (state, action) => {
        state.creating = false;
        state.list.unshift(action.payload);
        state.count += 1;
      })
      .addCase(createLogisticAsync.rejected, (state, action) => {
        state.creating = false;
        state.error = action.payload;
      })
      // update
      .addCase(updateLogisticAsync.pending, (state) => {
        state.updating = true;
        state.error = null;
      })
      .addCase(updateLogisticAsync.fulfilled, (state, action) => {
        state.updating = false;
        const idx = state.list.findIndex((x) => x.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(updateLogisticAsync.rejected, (state, action) => {
        state.updating = false;
        state.error = action.payload;
      })
      // analytics
      .addCase(fetchLogisticsAnalyticsAsync.pending, (state) => {
        state.analyticsLoading = true;
        state.error = null;
      })
      .addCase(fetchLogisticsAnalyticsAsync.fulfilled, (state, action) => {
        state.analyticsLoading = false;
        state.analytics = action.payload;
      })
      .addCase(fetchLogisticsAnalyticsAsync.rejected, (state, action) => {
        state.analyticsLoading = false;
        state.error = action.payload;
      });
  },
});

export const useLogistics = () => useSelector((state) => state.logistics);

export default logisticsSlice.reducer;
