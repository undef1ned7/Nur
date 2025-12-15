import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import {
  fetchShiftsAsync,
  fetchShiftByIdAsync,
  openShiftAsync,
  closeShiftAsync,
} from "../creators/shiftThunk";

const initialState = {
  shifts: [],
  currentShift: null,
  loading: false,
  error: null,
};

const shiftSlice = createSlice({
  name: "shifts",
  initialState,
  reducers: {
    clearCurrentShift: (state) => {
      state.currentShift = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch all shifts
    builder
      .addCase(fetchShiftsAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchShiftsAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.shifts = action.payload?.results || action.payload || [];
      })
      .addCase(fetchShiftsAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch shift by ID
    builder
      .addCase(fetchShiftByIdAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchShiftByIdAsync.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.currentShift = action.payload;
          // Обновляем смену в списке, если она там есть
          const index = state.shifts.findIndex(
            (s) => s.id === action.payload.id
          );
          if (index !== -1) {
            state.shifts[index] = action.payload;
          }
        }
      })
      .addCase(fetchShiftByIdAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Open shift
    builder
      .addCase(openShiftAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(openShiftAsync.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.currentShift = action.payload;
          // Добавляем новую смену в начало списка
          state.shifts.unshift(action.payload);
        }
      })
      .addCase(openShiftAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Close shift
    builder
      .addCase(closeShiftAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(closeShiftAsync.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          const closedShift = action.payload;
          state.currentShift = closedShift;
          // Обновляем смену в списке
          const index = state.shifts.findIndex((s) => s.id === closedShift.id);
          if (index !== -1) {
            state.shifts[index] = closedShift;
          }
        }
      })
      .addCase(closeShiftAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearCurrentShift, clearError } = shiftSlice.actions;

// Selectors
export const useShifts = () => {
  return useSelector((state) => state.shifts);
};

export default shiftSlice.reducer;
