import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import {
  fetchWarehouseCounterparties,
  getWarehouseCounterpartyById,
  createWarehouseCounterparty,
  updateWarehouseCounterparty,
  deleteWarehouseCounterparty,
  bulkDeleteWarehouseCounterparties,
} from "../creators/warehouseThunk";

const initialState = {
  list: [],
  count: 0,
  next: null,
  previous: null,
  loading: false,
  error: null,

  // Кэш для контрагентов
  counterpartiesCache: {},

  // Операции CRUD
  creating: false,
  createError: null,
  updating: false,
  updateError: null,
  deleting: false,
  deleteError: null,
  bulkDeleting: false,
  bulkDeleteError: null,

  // Детали контрагента
  current: null,
  loadingCurrent: false,
  currentError: null,
};

const counterpartySlice = createSlice({
  name: "counterparty",
  initialState,
  reducers: {
    clearCounterparties: (state) => {
      state.list = [];
      state.count = 0;
      state.next = null;
      state.previous = null;
      state.loading = false;
      state.error = null;
    },
    clearCurrentCounterparty: (state) => {
      state.current = null;
      state.loadingCurrent = false;
      state.currentError = null;
    },
    loadCounterpartiesFromCache: (state, action) => {
      const { cacheKey, cachedData } = action.payload;
      if (cachedData) {
        state.list = cachedData.list || [];
        state.count = cachedData.count || 0;
        state.next = cachedData.next || null;
        state.previous = cachedData.previous || null;
      }
    },
    setCachedCounterparties: (state, action) => {
      const { cacheKey, data } = action.payload;
      if (cacheKey && data) {
        state.counterpartiesCache[cacheKey] = {
          ...data,
          timestamp: Date.now(),
        };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Загрузка списка контрагентов
      .addCase(fetchWarehouseCounterparties.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWarehouseCounterparties.fulfilled, (state, action) => {
        state.loading = false;
        const payload = action.payload;
        state.list = payload?.results || (Array.isArray(payload) ? payload : []);
        state.count = payload?.count || payload?.length || 0;
        state.next = payload?.next || null;
        state.previous = payload?.previous || null;

        // Сохраняем в кэш (если передан _cacheKey в params)
        const cacheKey = action.meta?.arg?._cacheKey;
        if (cacheKey) {
          state.counterpartiesCache[cacheKey] = {
            list: [...state.list], // Копируем массив
            count: state.count,
            next: state.next,
            previous: state.previous,
            timestamp: Date.now(),
          };
        }
      })
      .addCase(fetchWarehouseCounterparties.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error?.message || "Ошибка загрузки контрагентов";
      })

      // Получение контрагента по ID
      .addCase(getWarehouseCounterpartyById.pending, (state) => {
        state.loadingCurrent = true;
        state.currentError = null;
      })
      .addCase(getWarehouseCounterpartyById.fulfilled, (state, action) => {
        state.loadingCurrent = false;
        state.current = action.payload;
      })
      .addCase(getWarehouseCounterpartyById.rejected, (state, action) => {
        state.loadingCurrent = false;
        state.currentError = action.payload || action.error?.message || "Ошибка загрузки контрагента";
      })

      // Создание контрагента
      .addCase(createWarehouseCounterparty.pending, (state) => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createWarehouseCounterparty.fulfilled, (state, action) => {
        state.creating = false;
        // Добавляем новый контрагент в начало списка
        state.list = [action.payload, ...state.list];
        state.count = (state.count || 0) + 1;
      })
      .addCase(createWarehouseCounterparty.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload || action.error?.message || "Ошибка создания контрагента";
      })

      // Обновление контрагента
      .addCase(updateWarehouseCounterparty.pending, (state) => {
        state.updating = true;
        state.updateError = null;
      })
      .addCase(updateWarehouseCounterparty.fulfilled, (state, action) => {
        state.updating = false;
        // Обновляем контрагента в списке
        const index = state.list.findIndex((item) => item.id === action.payload.id);
        if (index !== -1) {
          state.list[index] = action.payload;
        }
        // Обновляем текущий контрагент, если это он
        if (state.current?.id === action.payload.id) {
          state.current = action.payload;
        }
      })
      .addCase(updateWarehouseCounterparty.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload || action.error?.message || "Ошибка обновления контрагента";
      })

      // Удаление контрагента
      .addCase(deleteWarehouseCounterparty.pending, (state) => {
        state.deleting = true;
        state.deleteError = null;
      })
      .addCase(deleteWarehouseCounterparty.fulfilled, (state, action) => {
        state.deleting = false;
        // Удаляем контрагента из списка
        state.list = state.list.filter((item) => item.id !== action.payload);
        state.count = Math.max(0, (state.count || 0) - 1);
      })
      .addCase(deleteWarehouseCounterparty.rejected, (state, action) => {
        state.deleting = false;
        state.deleteError = action.payload || action.error?.message || "Ошибка удаления контрагента";
      })

      // Массовое удаление контрагентов
      .addCase(bulkDeleteWarehouseCounterparties.pending, (state) => {
        state.bulkDeleting = true;
        state.bulkDeleteError = null;
      })
      .addCase(bulkDeleteWarehouseCounterparties.fulfilled, (state, action) => {
        state.bulkDeleting = false;
        const deletedIds = action.payload;
        state.list = state.list.filter((item) => !deletedIds.includes(item.id));
        state.count = Math.max(0, (state.count || 0) - deletedIds.length);
      })
      .addCase(bulkDeleteWarehouseCounterparties.rejected, (state, action) => {
        state.bulkDeleting = false;
        state.bulkDeleteError = action.payload || action.error?.message || "Ошибка массового удаления";
      });
  },
});

export const {
  clearCounterparties,
  clearCurrentCounterparty,
  loadCounterpartiesFromCache,
  setCachedCounterparties,
} = counterpartySlice.actions;

export const useCounterparty = () => useSelector((state) => state.counterparty);

export default counterpartySlice.reducer;

