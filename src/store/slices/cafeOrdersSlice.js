import { createSlice } from "@reduxjs/toolkit";
import {
  fetchKitchenTasksAsync,
  claimKitchenTaskAsync,
  readyKitchenTaskAsync,
} from "../creators/cafeOrdersCreators";

const initialState = {
  tasks: [],
  count: 0,
  loading: false,
  error: null,
  updatingStatus: {},
};

const cafeOrdersSlice = createSlice({
  name: "cafeOrders",
  initialState,
  reducers: {
    clearCafeOrders: (state) => {
      state.tasks = [];
      state.count = 0;
      state.loading = false;
      state.error = null;
    },
    setUpdatingStatus: (state, action) => {
      const { taskId, isUpdating } = action.payload;
      if (isUpdating) {
        state.updatingStatus[taskId] = true;
      } else {
        delete state.updatingStatus[taskId];
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch tasks
      .addCase(fetchKitchenTasksAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchKitchenTasksAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.tasks = action.payload.results || [];
        state.count = action.payload.count || 0;
        state.error = null;
      })
      .addCase(fetchKitchenTasksAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Claim task
      .addCase(claimKitchenTaskAsync.pending, (state, action) => {
        const taskId = action.meta.arg;
        state.updatingStatus[taskId] = true;
      })
      .addCase(claimKitchenTaskAsync.fulfilled, (state, action) => {
        const updatedTask = action.payload;
        const index = state.tasks.findIndex((t) => t.id === updatedTask.id);
        if (index !== -1) {
          state.tasks[index] = updatedTask;
        } else {
          state.tasks.push(updatedTask);
        }
        delete state.updatingStatus[updatedTask.id];
      })
      .addCase(claimKitchenTaskAsync.rejected, (state, action) => {
        const taskId = action.meta.arg;
        delete state.updatingStatus[taskId];
        state.error = action.payload;
      })
      // Ready task
      .addCase(readyKitchenTaskAsync.pending, (state, action) => {
        const taskId = action.meta.arg;
        state.updatingStatus[taskId] = true;
      })
      .addCase(readyKitchenTaskAsync.fulfilled, (state, action) => {
        const updatedTask = action.payload;
        const index = state.tasks.findIndex((t) => t.id === updatedTask.id);
        if (index !== -1) {
          state.tasks[index] = updatedTask;
        }
        delete state.updatingStatus[updatedTask.id];
      })
      .addCase(readyKitchenTaskAsync.rejected, (state, action) => {
        const taskId = action.meta.arg;
        delete state.updatingStatus[taskId];
        state.error = action.payload;
      });
  },
});

export const { clearCafeOrders, setUpdatingStatus } = cafeOrdersSlice.actions;
export default cafeOrdersSlice.reducer;
