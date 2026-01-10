import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api";

/**
 * Получение списка складов
 */
export const fetchWarehousesAsync = createAsyncThunk(
  "warehouse/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      // Пробуем разные возможные эндпоинты
      let response;
      try {
        response = await api.get("/warehouse/warehouses/", { params });
      } catch (e) {
        try {
          response = await api.get("/main/warehouses/", { params });
        } catch (e2) {
          // Если оба не работают, возвращаем пустой результат
          console.warn("Warehouses API endpoint not found");
          return {
            results: [],
            count: 0,
            next: null,
            previous: null,
          };
        }
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

/**
 * Создание склада
 */
export const createWarehouseAsync = createAsyncThunk(
  "warehouse/create",
  async (warehouseData, { rejectWithValue }) => {
    try {
      // Пробуем разные возможные эндпоинты
      let response;
      try {
        response = await api.post("/warehouse/warehouses/", warehouseData);
      } catch (e) {
        try {
          response = await api.post("/main/warehouses/", warehouseData);
        } catch (e2) {
          return rejectWithValue(
            e2?.response?.data || e2?.message || "API endpoint для создания склада не найден"
          );
        }
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

/**
 * Обновление склада
 */
export const updateWarehouseAsync = createAsyncThunk(
  "warehouse/update",
  async ({ warehouseId, updatedData }, { rejectWithValue }) => {
    try {
      let response;
      try {
        response = await api.patch(`/warehouse/warehouses/${warehouseId}/`, updatedData);
      } catch (e) {
        try {
          response = await api.patch(`/main/warehouses/${warehouseId}/`, updatedData);
        } catch (e2) {
          return rejectWithValue(
            e2?.response?.data || e2?.message || "API endpoint для обновления склада не найден"
          );
        }
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

/**
 * Удаление склада
 */
export const deleteWarehouseAsync = createAsyncThunk(
  "warehouse/delete",
  async (warehouseId, { rejectWithValue }) => {
    try {
      try {
        await api.delete(`/warehouse/warehouses/${warehouseId}/`);
      } catch (e) {
        try {
          await api.delete(`/main/warehouses/${warehouseId}/`);
        } catch (e2) {
          return rejectWithValue(
            e2?.response?.data || e2?.message || "API endpoint для удаления склада не найден"
          );
        }
      }
      return warehouseId;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

