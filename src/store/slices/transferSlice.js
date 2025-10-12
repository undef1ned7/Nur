// src/store/slices/transferSlice.js
import { createSlice } from "@reduxjs/toolkit";
import {
  fetchTransfersAsync,
  createTransferAsync,
  createBulkTransferAsync,
  getTransferAsync,
  updateTransferAsync,
  deleteTransferAsync,
  updateMeProducts,
} from "../creators/transferCreators";
import { useSelector } from "react-redux";

const initialState = {
  list: [],
  current: null,
  loading: false,
  error: null,
  creating: false,
  createError: null,
  updating: false,
  updateError: null,
  deleting: false,
  deleteError: null,
};

const transferSlice = createSlice({
  name: "transfers",
  initialState,
  reducers: {
    clearErrors: (state) => {
      state.error = null;
      state.createError = null;
      state.updateError = null;
      state.deleteError = null;
    },
    clearCurrent: (state) => {
      state.current = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch transfers
    builder
      .addCase(fetchTransfersAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTransfersAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload?.results || action.payload || [];
        state.error = null;
      })
      .addCase(fetchTransfersAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Create transfer
    builder
      .addCase(createTransferAsync.pending, (state) => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createTransferAsync.fulfilled, (state, action) => {
        state.creating = false;
        state.list.unshift(action.payload);
        state.createError = null;
      })
      .addCase(createTransferAsync.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload;
      });

    // Create bulk transfer
    builder
      .addCase(createBulkTransferAsync.pending, (state) => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createBulkTransferAsync.fulfilled, (state, action) => {
        state.creating = false;
        // For bulk transfers, we might get multiple transfers back
        if (Array.isArray(action.payload)) {
          state.list.unshift(...action.payload);
        } else {
          state.list.unshift(action.payload);
        }
        state.createError = null;
      })
      .addCase(createBulkTransferAsync.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload;
      });

    // Get transfer
    builder
      .addCase(getTransferAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getTransferAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.current = action.payload;
        state.error = null;
      })
      .addCase(getTransferAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    builder
      .addCase(updateMeProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateMeProducts.fulfilled, (state, action) => {
        state.loading = false;
        // state.current = action.payload;
        state.error = null;
      })
      .addCase(updateMeProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Update transfer
    builder
      .addCase(updateTransferAsync.pending, (state) => {
        state.updating = true;
        state.updateError = null;
      })
      .addCase(updateTransferAsync.fulfilled, (state, action) => {
        state.updating = false;
        const index = state.list.findIndex(
          (item) => item.id === action.payload.id
        );
        if (index !== -1) {
          state.list[index] = action.payload;
        }
        if (state.current?.id === action.payload.id) {
          state.current = action.payload;
        }
        state.updateError = null;
      })
      .addCase(updateTransferAsync.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload;
      });

    // Delete transfer
    builder
      .addCase(deleteTransferAsync.pending, (state) => {
        state.deleting = true;
        state.deleteError = null;
      })
      .addCase(deleteTransferAsync.fulfilled, (state, action) => {
        state.deleting = false;
        state.list = state.list.filter((item) => item.id !== action.payload);
        if (state.current?.id === action.payload) {
          state.current = null;
        }
        state.deleteError = null;
      })
      .addCase(deleteTransferAsync.rejected, (state, action) => {
        state.deleting = false;
        state.deleteError = action.payload;
      });
  },
});

export const { clearErrors, clearCurrent } = transferSlice.actions;
export const useTransfer = () => useSelector((state) => state.transfer);
export default transferSlice.reducer;
