// src/store/slices/acceptanceSlice.js
import { createSlice } from "@reduxjs/toolkit";
import {
  fetchAcceptancesAsync,
  createAcceptanceAsync,
  getAcceptanceAsync,
  updateAcceptanceAsync,
  deleteAcceptanceAsync,
  acceptInlineAsync,
} from "../creators/transferCreators";

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
  acceptingInline: false,
  acceptInlineError: null,
};

const acceptanceSlice = createSlice({
  name: "acceptances",
  initialState,
  reducers: {
    clearErrors: (state) => {
      state.error = null;
      state.createError = null;
      state.updateError = null;
      state.deleteError = null;
      state.acceptInlineError = null;
    },
    clearCurrent: (state) => {
      state.current = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch acceptances
    builder
      .addCase(fetchAcceptancesAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAcceptancesAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload?.results || action.payload || [];
        state.error = null;
      })
      .addCase(fetchAcceptancesAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Create acceptance
    builder
      .addCase(createAcceptanceAsync.pending, (state) => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createAcceptanceAsync.fulfilled, (state, action) => {
        state.creating = false;
        state.list.unshift(action.payload);
        state.createError = null;
      })
      .addCase(createAcceptanceAsync.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload;
      });

    // Get acceptance
    builder
      .addCase(getAcceptanceAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAcceptanceAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.current = action.payload;
        state.error = null;
      })
      .addCase(getAcceptanceAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Update acceptance
    builder
      .addCase(updateAcceptanceAsync.pending, (state) => {
        state.updating = true;
        state.updateError = null;
      })
      .addCase(updateAcceptanceAsync.fulfilled, (state, action) => {
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
      .addCase(updateAcceptanceAsync.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload;
      });

    // Delete acceptance
    builder
      .addCase(deleteAcceptanceAsync.pending, (state) => {
        state.deleting = true;
        state.deleteError = null;
      })
      .addCase(deleteAcceptanceAsync.fulfilled, (state, action) => {
        state.deleting = false;
        state.list = state.list.filter((item) => item.id !== action.payload);
        if (state.current?.id === action.payload) {
          state.current = null;
        }
        state.deleteError = null;
      })
      .addCase(deleteAcceptanceAsync.rejected, (state, action) => {
        state.deleting = false;
        state.deleteError = action.payload;
      });

    // Accept inline
    builder
      .addCase(acceptInlineAsync.pending, (state) => {
        state.acceptingInline = true;
        state.acceptInlineError = null;
      })
      .addCase(acceptInlineAsync.fulfilled, (state, action) => {
        state.acceptingInline = false;
        state.acceptInlineError = null;
        // Add the acceptance to the list if it's returned
        if (action.payload) {
          state.list.unshift(action.payload);
        }
      })
      .addCase(acceptInlineAsync.rejected, (state, action) => {
        state.acceptingInline = false;
        state.acceptInlineError = action.payload;
      });
  },
});

export const { clearErrors, clearCurrent } = acceptanceSlice.actions;
export default acceptanceSlice.reducer;
