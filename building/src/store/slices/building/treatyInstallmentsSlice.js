import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import {
  fetchBuildingInstallmentPayments,
  createBuildingInstallmentPayment,
} from "../../creators/building/treatyInstallmentsCreators";

const initialState = {
  paymentsByInstallmentId: {},
  loadingByInstallmentId: {},
  loadedByInstallmentId: {},
  errorByInstallmentId: {},
  creatingByInstallmentId: {},
  createErrorByInstallmentId: {},
};

const getKey = (id) => String(id ?? "");

const treatyInstallmentsSlice = createSlice({
  name: "buildingTreatyInstallments",
  initialState,
  reducers: {
    clearBuildingInstallmentErrors: (state, action) => {
      const installmentId = action.payload;
      if (installmentId == null) return;
      const key = getKey(installmentId);
      delete state.errorByInstallmentId[key];
      delete state.createErrorByInstallmentId[key];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBuildingInstallmentPayments.pending, (state, action) => {
        const installmentId = action.meta.arg;
        const key = getKey(installmentId);
        state.loadingByInstallmentId[key] = true;
        state.loadedByInstallmentId[key] = false;
        state.errorByInstallmentId[key] = null;
      })
      .addCase(
        fetchBuildingInstallmentPayments.fulfilled,
        (state, action) => {
          const installmentId = action.payload?.installmentId;
          const key = getKey(installmentId);
          state.loadingByInstallmentId[key] = false;
          state.loadedByInstallmentId[key] = true;
          state.errorByInstallmentId[key] = null;

          const data = action.payload?.data;
          let list = [];
          if (Array.isArray(data?.results)) list = data.results;
          else if (Array.isArray(data)) list = data;
          else if (data) list = [data];

          state.paymentsByInstallmentId[key] = list;
        },
      )
      .addCase(fetchBuildingInstallmentPayments.rejected, (state, action) => {
        const installmentId = action.meta.arg;
        const key = getKey(installmentId);
        state.loadingByInstallmentId[key] = false;
        state.loadedByInstallmentId[key] = true;
        state.errorByInstallmentId[key] =
          action.payload ?? action.error?.message ?? null;
      })
      .addCase(createBuildingInstallmentPayment.pending, (state, action) => {
        const installmentId = action.meta.arg?.installmentId;
        const key = getKey(installmentId);
        state.creatingByInstallmentId[key] = true;
        state.createErrorByInstallmentId[key] = null;
      })
      .addCase(
        createBuildingInstallmentPayment.fulfilled,
        (state, action) => {
          const installmentId =
            action.meta.arg?.installmentId ?? action.payload?.installmentId;
          const key = getKey(installmentId);
          state.creatingByInstallmentId[key] = false;
          state.createErrorByInstallmentId[key] = null;
          // Список платежей обновляется отдельным fetch-ом внутри thunk
        },
      )
      .addCase(
        createBuildingInstallmentPayment.rejected,
        (state, action) => {
          const installmentId = action.meta.arg?.installmentId;
          const key = getKey(installmentId);
          state.creatingByInstallmentId[key] = false;
          state.createErrorByInstallmentId[key] =
            action.payload ?? action.error?.message ?? null;
        },
      );
  },
});

export const { clearBuildingInstallmentErrors } =
  treatyInstallmentsSlice.actions;

export default treatyInstallmentsSlice.reducer;

export const useBuildingTreatyInstallments = () =>
  useSelector((state) => state.buildingTreatyInstallments);

