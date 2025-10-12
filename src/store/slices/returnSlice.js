// src/store/slices/returnSlice.js
import { createSlice } from "@reduxjs/toolkit";
import {
  fetchReturnsAsync,
  createReturnAsync,
  getReturnAsync,
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
};

const returnSlice = createSlice({
  name: "returns",
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
    // Fetch returns
    builder
      .addCase(fetchReturnsAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReturnsAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload?.results || action.payload || [];
        state.error = null;
      })
      .addCase(fetchReturnsAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Create return
    builder
      .addCase(createReturnAsync.pending, (state) => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createReturnAsync.fulfilled, (state, action) => {
        state.creating = false;
        state.list.unshift(action.payload);
        state.createError = null;
      })
      .addCase(createReturnAsync.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload;
      });

    // Get return
    builder
      .addCase(getReturnAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getReturnAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.current = action.payload;
        state.error = null;
      })
      .addCase(getReturnAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearErrors, clearCurrent } = returnSlice.actions;
export default returnSlice.reducer;
