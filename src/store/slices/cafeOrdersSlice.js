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

const normalizeTasksIds = (arg) => {
  if (Array.isArray(arg)) return arg;
  if (arg && typeof arg === "object" && Array.isArray(arg.tasks_ids)) {
    return arg.tasks_ids;
  }
  return arg ? [arg] : [];
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
    removeAfterReady: (state, { payload }) => {
      const ids = Array.isArray(payload) ? payload : [payload];
      const set = new Set(ids.map((x) => String(x)));
      state.tasks = state.tasks.filter((el) => !set.has(String(el.id)));
    }
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
        const ids = normalizeTasksIds(action.meta.arg);
        for (const id of ids) state.updatingStatus[id] = true;
      })
      .addCase(claimKitchenTaskAsync.fulfilled, (state, action) => {
        let updatedTasks = [];
        if (Array.isArray(action.payload?.claimed)) updatedTasks = action?.payload?.claimed;

        if (updatedTasks.length) {
          for (const updatedTask of updatedTasks) {
            const index = state.tasks.findIndex((t) => t.id === updatedTask.id);
            if (index !== -1) {
              state.tasks[index] = updatedTask;
            } else {
              state.tasks.push(updatedTask);
            }
            delete state.updatingStatus[updatedTask.id];
          }
        } else {
          const ids = normalizeTasksIds(action.meta.arg);
          for (const id of ids) delete state.updatingStatus[id];
        }
      })
      .addCase(claimKitchenTaskAsync.rejected, (state, action) => {
        const ids = normalizeTasksIds(action.meta.arg);
        for (const id of ids) delete state.updatingStatus[id];
        state.error = action.payload;
      })
      // Ready task
      .addCase(readyKitchenTaskAsync.pending, (state, action) => {
        const ids = normalizeTasksIds(action.meta.arg);
        for (const id of ids) state.updatingStatus[id] = true;
      })
      .addCase(readyKitchenTaskAsync.fulfilled, (state, action) => {
        let updatedTasks = [];
        if (Array.isArray(action.payload)) updatedTasks = action.payload;
        else if (Array.isArray(action.payload?.results)) updatedTasks = action.payload.results;
        else if (Array.isArray(action.payload?.tasks)) updatedTasks = action.payload.tasks;
        else if (action.payload && typeof action.payload === "object" && action.payload.id) {
          updatedTasks = [action.payload];
        }

        if (updatedTasks.length) {
          for (const updatedTask of updatedTasks) {
            const index = state.tasks.findIndex((t) => t.id === updatedTask.id);
            if (index !== -1) {
              state.tasks[index] = updatedTask;
            }
            delete state.updatingStatus[updatedTask.id];
          }
        } else {
          // fallback: просто снимаем "loading" по всем ids
          const ids = normalizeTasksIds(action.meta.arg);
          for (const id of ids) delete state.updatingStatus[id];
        }
      })
      .addCase(readyKitchenTaskAsync.rejected, (state, action) => {
        const ids = normalizeTasksIds(action.meta.arg);
        for (const id of ids) delete state.updatingStatus[id];
        state.error = action.payload;
      });
  },
});

export const { clearCafeOrders, setUpdatingStatus, removeAfterReady } = cafeOrdersSlice.actions;
export default cafeOrdersSlice.reducer;
