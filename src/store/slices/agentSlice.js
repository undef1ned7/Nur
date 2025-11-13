import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import {
  doSearchInAgent,
  manualFillingInAgent,
  productCheckoutInAgent,
  startSaleInAgent,
  updateManualFillingInAgent,
} from "../creators/agentCreators";

const initialState = {
  start: null, // POS-продажа (товары)
  loading: false,
  history: [],
  products: [],
  error: null,
};

const ensureError = (action) =>
  action.payload ?? { message: action.error?.message };

export const agentSlice = createSlice({
  name: "agent",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(startSaleInAgent.pending, (state) => {
        state.loading = true;
      })
      .addCase(startSaleInAgent.fulfilled, (state, { payload }) => {
        state.start = payload;
        state.loading = false;
      })
      .addCase(startSaleInAgent.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })
      .addCase(doSearchInAgent.pending, (state) => {
        state.loading = true;
      })
      .addCase(doSearchInAgent.fulfilled, (state, { payload }) => {
        state.products = payload;
        state.loading = false;
      })
      .addCase(doSearchInAgent.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })
      .addCase(manualFillingInAgent.pending, (state) => {
        state.loading = true;
      })
      .addCase(manualFillingInAgent.fulfilled, (state, { payload }) => {
        // state.products = payload;
        state.loading = false;
      })
      .addCase(manualFillingInAgent.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })
      .addCase(updateManualFillingInAgent.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateManualFillingInAgent.fulfilled, (state, { payload }) => {
        // state.products = payload;
        state.loading = false;
      })
      .addCase(updateManualFillingInAgent.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })
      .addCase(productCheckoutInAgent.pending, (state) => {
        state.loading = true;
      })
      .addCase(productCheckoutInAgent.fulfilled, (state, { payload }) => {
        // state.products = payload;
        state.loading = false;
      })
      .addCase(productCheckoutInAgent.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      });
  },
});

export const useAgent = () => useSelector((state) => state.agent);
export default agentSlice.reducer;
