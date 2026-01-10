import { createSlice } from "@reduxjs/toolkit";
import { applyPagination } from "../pagination";
import {
  fetchWarehousesAsync,
  createWarehouseAsync,
  updateWarehouseAsync,
  deleteWarehouseAsync,
} from "../creators/warehouseCreators";

const initialState = {
  list: [],
  count: 0,
  next: null,
  previous: null,
  loading: false,
  error: null,

  creating: false,
  createError: null,

  updating: false,
  updateError: null,

  deleting: false,
  deleteError: null,
};

const warehouseSlice = createSlice({
  name: "warehouse",
  initialState,
  reducers: {
    clearWarehouses: (state) => {
      state.list = [];
      state.count = 0;
      state.next = null;
      state.previous = null;
      state.loading = false;
      state.error = null;
    },
    clearCreateError: (state) => {
      state.createError = null;
    },
    clearUpdateError: (state) => {
      state.updateError = null;
    },
    clearDeleteError: (state) => {
      state.deleteError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch warehouses
      .addCase(fetchWarehousesAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWarehousesAsync.fulfilled, (state, action) => {
        state.loading = false;
        applyPagination(state, action.payload, "list");
      })
      .addCase(fetchWarehousesAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Create warehouse
      .addCase(createWarehouseAsync.pending, (state) => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createWarehouseAsync.fulfilled, (state, action) => {
        state.creating = false;
        // Добавляем новый склад в начало списка
        state.list = [action.payload, ...state.list];
        state.count = (state.count || 0) + 1;
      })
      .addCase(createWarehouseAsync.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload;
      })

      // Update warehouse
      .addCase(updateWarehouseAsync.pending, (state) => {
        state.updating = true;
        state.updateError = null;
      })
      .addCase(updateWarehouseAsync.fulfilled, (state, action) => {
        state.updating = false;
        // Обновляем склад в списке
        const index = state.list.findIndex((w) => w.id === action.payload.id);
        if (index !== -1) {
          state.list[index] = action.payload;
        }
      })
      .addCase(updateWarehouseAsync.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload;
      })

      // Delete warehouse
      .addCase(deleteWarehouseAsync.pending, (state) => {
        state.deleting = true;
        state.deleteError = null;
      })
      .addCase(deleteWarehouseAsync.fulfilled, (state, action) => {
        state.deleting = false;
        // Удаляем склад из списка
        state.list = state.list.filter((w) => w.id !== action.payload);
        state.count = Math.max(0, (state.count || 0) - 1);
      })
      .addCase(deleteWarehouseAsync.rejected, (state, action) => {
        state.deleting = false;
        state.deleteError = action.payload;
      });
  },
});

export const {
  clearWarehouses,
  clearCreateError,
  clearUpdateError,
  clearDeleteError,
} = warehouseSlice.actions;

export default warehouseSlice.reducer;
