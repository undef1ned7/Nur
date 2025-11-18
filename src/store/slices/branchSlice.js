// src/store/slices/branchSlice.js
import { createSlice } from "@reduxjs/toolkit";
import {
  fetchBranchesAsync,
  createBranchAsync,
  updateBranchAsync,
  deleteBranchAsync,
  toggleBranchActiveAsync,
} from "../creators/branchCreators";

const initialState = {
  list: [],
  loading: false,
  error: null,
  creating: false,
  createError: null,
  updating: false,
  updateError: null,
  deleting: false,
  deleteError: null,
  toggling: false,
  toggleError: null,
};

const branchSlice = createSlice({
  name: "branches",
  initialState,
  reducers: {
    clearErrors: (state) => {
      state.error = null;
      state.createError = null;
      state.updateError = null;
      state.deleteError = null;
      state.toggleError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch branches
      .addCase(fetchBranchesAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBranchesAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.list = Array.isArray(action.payload) ? action.payload : [];
        state.error = null;
      })
      .addCase(fetchBranchesAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Create branch
      .addCase(createBranchAsync.pending, (state) => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createBranchAsync.fulfilled, (state, action) => {
        state.creating = false;
        state.list.unshift(action.payload);
        state.createError = null;
      })
      .addCase(createBranchAsync.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload;
      })

      // Update branch
      .addCase(updateBranchAsync.pending, (state) => {
        state.updating = true;
        state.updateError = null;
      })
      .addCase(updateBranchAsync.fulfilled, (state, action) => {
        state.updating = false;
        const index = state.list.findIndex(
          (branch) => branch.id === action.payload.id
        );
        if (index !== -1) {
          state.list[index] = action.payload;
        }
        state.updateError = null;
      })
      .addCase(updateBranchAsync.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload;
      })

      // Delete branch
      .addCase(deleteBranchAsync.pending, (state) => {
        state.deleting = true;
        state.deleteError = null;
      })
      .addCase(deleteBranchAsync.fulfilled, (state, action) => {
        state.deleting = false;
        state.list = state.list.filter(
          (branch) => branch.id !== action.payload
        );
        state.deleteError = null;
      })
      .addCase(deleteBranchAsync.rejected, (state, action) => {
        state.deleting = false;
        state.deleteError = action.payload;
      })

      // Toggle branch active
      .addCase(toggleBranchActiveAsync.pending, (state) => {
        state.toggling = true;
        state.toggleError = null;
      })
      .addCase(toggleBranchActiveAsync.fulfilled, (state, action) => {
        state.toggling = false;
        const index = state.list.findIndex(
          (branch) => branch.id === action.payload.id
        );
        if (index !== -1) {
          state.list[index] = action.payload;
        }
        state.toggleError = null;
      })
      .addCase(toggleBranchActiveAsync.rejected, (state, action) => {
        state.toggling = false;
        state.toggleError = action.payload;
      });
  },
});

export const { clearErrors } = branchSlice.actions;
export default branchSlice.reducer;
