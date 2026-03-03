import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import { applyPagination } from "../../pagination";
import {
  fetchBuildingTasks,
  fetchBuildingTaskById,
  createBuildingTask,
  updateBuildingTask,
  deleteBuildingTask,
  createBuildingTaskChecklistItem,
  updateBuildingTaskChecklistItem,
} from "../../creators/building/tasksCreators";

const initialState = {
  list: [],
  count: 0,
  next: null,
  previous: null,
  loading: false,
  loaded: false,
  error: null,

  creating: false,
  updatingIds: {},
  deletingIds: {},
  actionError: null,

   current: null,
   currentLoading: false,
   currentLoaded: false,
   currentError: null,
};

const upsertById = (list, payload) => {
  if (!payload) return list;
  const id = payload?.id ?? payload?.uuid;
  if (id == null) return list;
  const next = Array.isArray(list) ? [...list] : [];
  const idx = next.findIndex((x) => String(x?.id ?? x?.uuid) === String(id));
  if (idx === -1) next.unshift(payload);
  else next[idx] = payload;
  return next;
};

const buildingTasksSlice = createSlice({
  name: "buildingTasks",
  initialState,
  reducers: {
    clearBuildingTasksError: (state) => {
      state.error = null;
      state.actionError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBuildingTaskById.pending, (state) => {
        state.currentLoading = true;
        state.currentLoaded = false;
        state.currentError = null;
      })
      .addCase(fetchBuildingTaskById.fulfilled, (state, action) => {
        state.currentLoading = false;
        state.currentLoaded = true;
        state.currentError = null;
        state.current = action.payload || null;
        if (action.payload) {
          state.list = upsertById(state.list, action.payload);
        }
      })
      .addCase(fetchBuildingTaskById.rejected, (state, action) => {
        state.currentLoading = false;
        state.currentLoaded = true;
        state.currentError = action.payload ?? action.error?.message;
      })
      .addCase(fetchBuildingTasks.pending, (state) => {
        state.loading = true;
        state.loaded = false;
        state.error = null;
      })
      .addCase(fetchBuildingTasks.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        applyPagination(state, action.payload, "list");
      })
      .addCase(fetchBuildingTasks.rejected, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error = action.payload ?? action.error?.message;
      })
      .addCase(createBuildingTask.pending, (state) => {
        state.creating = true;
        state.actionError = null;
      })
      .addCase(createBuildingTask.fulfilled, (state, action) => {
        state.creating = false;
        state.list = upsertById(state.list, action.payload);
        if (typeof state.count === "number") state.count += 1;
        state.current = action.payload;
      })
      .addCase(createBuildingTask.rejected, (state, action) => {
        state.creating = false;
        state.actionError = action.payload ?? action.error?.message;
      })
      .addCase(updateBuildingTask.pending, (state, action) => {
        const id = action.meta.arg?.id;
        if (id != null) state.updatingIds[id] = true;
        state.actionError = null;
      })
      .addCase(updateBuildingTask.fulfilled, (state, action) => {
        const id = action.meta.arg?.id;
        if (id != null) delete state.updatingIds[id];
        state.list = upsertById(state.list, action.payload);
        const pid = action.payload?.id ?? action.payload?.uuid;
        if (
          state.current &&
          String(state.current.id ?? state.current.uuid) === String(pid)
        ) {
          state.current = action.payload;
        }
      })
      .addCase(updateBuildingTask.rejected, (state, action) => {
        const id = action.meta.arg?.id;
        if (id != null) delete state.updatingIds[id];
        state.actionError = action.payload ?? action.error?.message;
      })
      .addCase(deleteBuildingTask.pending, (state, action) => {
        const id = action.meta.arg;
        if (id != null) state.deletingIds[id] = true;
        state.actionError = null;
      })
      .addCase(deleteBuildingTask.fulfilled, (state, action) => {
        const id = action.payload;
        if (id != null) {
          delete state.deletingIds[id];
          state.list = (state.list || []).filter(
            (x) => String(x?.id ?? x?.uuid) !== String(id),
          );
          if (typeof state.count === "number" && state.count > 0) {
            state.count -= 1;
          }
        }
      })
      .addCase(deleteBuildingTask.rejected, (state, action) => {
        const id = action.meta.arg;
        if (id != null) delete state.deletingIds[id];
        state.actionError = action.payload ?? action.error?.message;
      })
      .addCase(createBuildingTaskChecklistItem.fulfilled, (state, action) => {
        const task = action.payload;
        if (!task || (!task.id && !task.uuid)) return;
        const id = task.id ?? task.uuid;
        state.list = upsertById(state.list, task);
        if (
          state.current &&
          String(state.current.id ?? state.current.uuid) === String(id)
        ) {
          state.current = task;
        }
      })
      .addCase(updateBuildingTaskChecklistItem.fulfilled, (state, action) => {
        const item = action.payload;
        if (!item || !item.id) return;
        state.list = (state.list || []).map((t) => {
          const items = Array.isArray(t.checklist_items)
            ? t.checklist_items
            : [];
          const idx = items.findIndex(
            (ci) => String(ci.id ?? ci.uuid) === String(item.id),
          );
          if (idx === -1) return t;
          const nextItems = [...items];
          nextItems[idx] = item;
          return { ...t, checklist_items: nextItems };
        });
        if (state.current && Array.isArray(state.current.checklist_items)) {
          const items = state.current.checklist_items;
          const idx = items.findIndex(
            (ci) => String(ci.id ?? ci.uuid) === String(item.id),
          );
          if (idx !== -1) {
            const nextItems = [...items];
            nextItems[idx] = item;
            state.current = { ...state.current, checklist_items: nextItems };
          }
        }
      });
  },
});

export const { clearBuildingTasksError } = buildingTasksSlice.actions;

export default buildingTasksSlice.reducer;

export const useBuildingTasks = () =>
  useSelector((state) => state.buildingTasks);

