import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import {
  createConsultingRequest,
  createConsultingSale,
  createConsultingService,
  deleteConsultingRequest,
  deleteConsultingSale,
  editConsultingRequest,
  editConsultingService,
  getConsultingRequestDetail,
  getConsultingRequests,
  getConsultingRows,
  getConsultingServices,
} from "../creators/consultingThunk";

const initialState = {
  loading: false,
  services: [],
  requests: [],
  requestDetail: null,
  rows: [],
  error: null,
};

const consultingSlice = createSlice({
  name: "consulting",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getConsultingServices.pending, (state) => {
        state.loading = true;
      })
      .addCase(getConsultingServices.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.services = payload;
      })
      .addCase(getConsultingServices.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })

      .addCase(getConsultingRows.pending, (state) => {
        state.loading = true;
      })
      .addCase(getConsultingRows.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.rows = payload;
      })
      .addCase(getConsultingRows.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })

      .addCase(getConsultingRequests.pending, (state) => {
        state.loading = true;
      })
      .addCase(getConsultingRequests.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.requests = payload;
      })
      .addCase(getConsultingRequests.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })

      .addCase(getConsultingRequestDetail.pending, (state) => {
        state.loading = true;
      })
      .addCase(getConsultingRequestDetail.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.requestDetail = payload;
      })
      .addCase(getConsultingRequestDetail.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })

      .addCase(createConsultingSale.pending, (state) => {
        state.loading = true;
      })
      .addCase(createConsultingSale.fulfilled, (state, { payload }) => {
        state.loading = false;
      })
      .addCase(createConsultingSale.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })

      .addCase(createConsultingRequest.pending, (state) => {
        state.loading = true;
      })
      .addCase(createConsultingRequest.fulfilled, (state, { payload }) => {
        state.loading = false;
        // Добавим в начало
        state.requests = [payload, ...(state.requests || [])];
      })
      .addCase(createConsultingRequest.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })

      .addCase(deleteConsultingSale.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteConsultingSale.fulfilled, (state, { payload }) => {
        state.loading = false;
      })
      .addCase(deleteConsultingSale.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })

      .addCase(editConsultingRequest.pending, (state) => {
        state.loading = true;
      })
      .addCase(editConsultingRequest.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.requests = (state.requests || []).map((r) =>
          r.id === payload.id ? payload : r
        );
        if (state.requestDetail?.id === payload.id)
          state.requestDetail = payload;
      })
      .addCase(editConsultingRequest.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })

      .addCase(editConsultingService.pending, (state) => {
        state.loading = true;
      })
      .addCase(editConsultingService.fulfilled, (state, { payload }) => {
        state.loading = false;
      })
      .addCase(editConsultingService.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })

      .addCase(deleteConsultingRequest.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteConsultingRequest.fulfilled, (state, { payload: id }) => {
        state.loading = false;
        state.requests = (state.requests || []).filter((r) => r.id !== id);
        if (state.requestDetail?.id === id) state.requestDetail = null;
      })
      .addCase(deleteConsultingRequest.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })

      .addCase(createConsultingService.pending, (state) => {
        state.loading = true;
      })
      .addCase(createConsultingService.fulfilled, (state, { payload }) => {
        state.loading = false;
      })
      .addCase(createConsultingService.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      });
  },
});

export const useConsulting = () => useSelector((state) => state.consulting);

export default consultingSlice.reducer;
