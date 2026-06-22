import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import {
  createBuildingProject,
  fetchBuildingProjects,
  updateBuildingProject,
  deleteBuildingProject,
} from "../../creators/building/projectsCreators";

const listFrom = (data) => {
  if (!data) return [];
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data)) return data;
  return [];
};

const initialState = {
  items: [],
  raw: null,
  loading: false,
  loaded: false,
  creating: false,
  updating: false,
  deletingIds: {},
  selectedProjectId: null,
  error: null,
};

const LS_SELECTED_PROJECT_ID_KEY = "buildingSelectedProjectId";

const buildingProjectsSlice = createSlice({
  name: "buildingProjects",
  initialState,
  reducers: {
    setSelectedBuildingProjectId: (state, action) => {
      const next = action.payload == null || action.payload === "" ? null : String(action.payload);
      state.selectedProjectId = next;
      try {
        if (next) localStorage.setItem(LS_SELECTED_PROJECT_ID_KEY, next);
        else localStorage.removeItem(LS_SELECTED_PROJECT_ID_KEY);
      } catch (e) {
        // ignore localStorage errors
      }
    },
    resetBuildingProjectsError: (state) => {
      state.error = null;
    },
    clearBuildingProjects: (state) => {
      state.items = [];
      state.raw = null;
      state.loading = false;
      state.loaded = false;
      state.creating = false;
      state.updating = false;
      state.deletingIds = {};
      state.selectedProjectId = null;
      state.error = null;
      try {
        localStorage.removeItem(LS_SELECTED_PROJECT_ID_KEY);
      } catch (e) {
        // ignore localStorage errors
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBuildingProjects.pending, (state) => {
        state.loading = true;
        state.loaded = false;
        state.error = null;
      })
      .addCase(fetchBuildingProjects.fulfilled, (state, { payload }) => {
        state.raw = payload ?? null;
        state.items = listFrom(payload);
        // Подтягиваем выбранный проект из localStorage после загрузки списка
        const items = Array.isArray(state.items) ? state.items : [];
        const exists = (id) =>
          items.some((x) => String(x?.id ?? x?.uuid) === String(id));
        if (state.selectedProjectId != null && !exists(state.selectedProjectId)) {
          state.selectedProjectId = null;
        }
        if (state.selectedProjectId == null) {
          try {
            const stored = localStorage.getItem(LS_SELECTED_PROJECT_ID_KEY);
            if (stored && exists(stored)) state.selectedProjectId = String(stored);
          } catch (e) {
            // ignore localStorage errors
          }
        }
        state.loading = false;
        state.loaded = true;
      })
      .addCase(fetchBuildingProjects.rejected, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error = action.payload ?? action.error?.message;
      })
      .addCase(createBuildingProject.pending, (state) => {
        state.creating = true;
        state.error = null;
      })
      .addCase(createBuildingProject.fulfilled, (state, { payload }) => {
        state.creating = false;
        if (payload) {
          state.items = [payload, ...state.items];
        }
      })
      .addCase(createBuildingProject.rejected, (state, action) => {
        state.creating = false;
        state.error = action.payload ?? action.error?.message;
      })
      .addCase(updateBuildingProject.pending, (state) => {
        state.updating = true;
        state.error = null;
      })
      .addCase(updateBuildingProject.fulfilled, (state, { payload }) => {
        state.updating = false;
        // Сохраняем выбранный проект в localStorage, если он в items
        if (payload) {
          const pid = payload?.id ?? payload?.uuid;
          const exists = state.items.some((x) => String(x?.id ?? x?.uuid) === String(pid));
          if (exists) {
            state.selectedProjectId = String(pid);
            try {
              localStorage.setItem(LS_SELECTED_PROJECT_ID_KEY, String(pid));
            } catch (e) {
              // ignore localStorage errors
            }
          }
        }
        if (!payload) return;
        const pid = payload?.id ?? payload?.uuid;
        if (pid == null) return;
        state.items = state.items.map((x) => {
          const xid = x?.id ?? x?.uuid;
          return String(xid) === String(pid) ? payload : x;
        });
        if (state.raw && Array.isArray(state.raw?.results)) {
          state.raw.results = state.raw.results.map((x) => {
            const xid = x?.id ?? x?.uuid;
            return String(xid) === String(pid) ? payload : x;
          });
        }
      })
      .addCase(updateBuildingProject.rejected, (state, action) => {
        state.updating = false;
        state.error = action.payload ?? action.error?.message;
      })
      .addCase(deleteBuildingProject.pending, (state, action) => {
        const id = action.meta.arg;
        state.deletingIds[id] = true;
        state.error = null;
      })
      .addCase(deleteBuildingProject.fulfilled, (state, { payload: id }) => {
        if (id == null) return;
        state.items = state.items.filter((x) => {
          const xid = x?.id ?? x?.uuid;
          return String(xid) !== String(id);
        });
        if (state.raw && Array.isArray(state.raw?.results)) {
          state.raw.results = state.raw.results.filter((x) => {
            const xid = x?.id ?? x?.uuid;
            return String(xid) !== String(id);
          });
        }
        delete state.deletingIds[id];
        if (String(state.selectedProjectId ?? "") === String(id)) {
          state.selectedProjectId = null;
        }
      })
      .addCase(deleteBuildingProject.rejected, (state, action) => {
        const id = action.meta.arg;
        delete state.deletingIds[id];
        state.error = action.payload ?? action.error?.message;
      });
  },
});

export const {
  setSelectedBuildingProjectId,
  resetBuildingProjectsError,
  clearBuildingProjects,
} = buildingProjectsSlice.actions;

export default buildingProjectsSlice.reducer;

export const useBuildingProjects = () =>
  useSelector((state) => state.buildingProjects);

