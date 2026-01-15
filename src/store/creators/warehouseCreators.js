import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api";

/* =================================================================== */
/*                              WAREHOUSES                              */
/* =================================================================== */

/**
 * Получение списка складов
 */
export const fetchWarehousesAsync = createAsyncThunk(
  "warehouse/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get("/warehouse/", { params });
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
      const response = await api.post("/warehouse/", warehouseData);
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
      const response = await api.patch(
        `/warehouse/${warehouseId}/`,
        updatedData
      );
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
      await api.delete(`/warehouse/${warehouseId}/`);
      return warehouseId;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

/* =================================================================== */
/*                         WAREHOUSE BRANDS                            */
/* =================================================================== */

export const fetchWarehouseBrandsAsync = createAsyncThunk(
  "warehouseBrands/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/warehouse/brands/", { params });
      return data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const createWarehouseBrandAsync = createAsyncThunk(
  "warehouseBrands/create",
  async (data, { rejectWithValue }) => {
    try {
      const { data: response } = await api.post("/warehouse/brands/", data);
      return response;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const updateWarehouseBrandAsync = createAsyncThunk(
  "warehouseBrands/update",
  async ({ brandId, updatedData }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(
        `/warehouse/brands/${brandId}/`,
        updatedData
      );
      return data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const deleteWarehouseBrandAsync = createAsyncThunk(
  "warehouseBrands/delete",
  async (brandId, { rejectWithValue }) => {
    try {
      await api.delete(`/warehouse/brands/${brandId}/`);
      return brandId;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const bulkDeleteWarehouseBrandsAsync = createAsyncThunk(
  "warehouseBrands/bulkDelete",
  async ({ ids, soft = true, require_all = false }, { rejectWithValue }) => {
    try {
      const { data } = await api.delete("/warehouse/brands/bulk-delete/", {
        data: { ids, soft, require_all },
      });
      return data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

/* =================================================================== */
/*                       WAREHOUSE CATEGORIES                           */
/* =================================================================== */

export const fetchWarehouseCategoriesAsync = createAsyncThunk(
  "warehouseCategories/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/warehouse/category/", { params });
      return data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const createWarehouseCategoryAsync = createAsyncThunk(
  "warehouseCategories/create",
  async (data, { rejectWithValue }) => {
    try {
      const { data: response } = await api.post("/warehouse/category/", data);
      return response;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const updateWarehouseCategoryAsync = createAsyncThunk(
  "warehouseCategories/update",
  async ({ categoryId, updatedData }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(
        `/warehouse/category/${categoryId}/`,
        updatedData
      );
      return data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const deleteWarehouseCategoryAsync = createAsyncThunk(
  "warehouseCategories/delete",
  async (categoryId, { rejectWithValue }) => {
    try {
      await api.delete(`/warehouse/category/${categoryId}/`);
      return categoryId;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const bulkDeleteWarehouseCategoriesAsync = createAsyncThunk(
  "warehouseCategories/bulkDelete",
  async ({ ids, soft = true, require_all = false }, { rejectWithValue }) => {
    try {
      const { data } = await api.delete("/warehouse/category/bulk-delete/", {
        data: { ids, soft, require_all },
      });
      return data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

/* =================================================================== */
/*                        WAREHOUSE PRODUCTS                           */
/* =================================================================== */

export const fetchWarehouseProductsAsync = createAsyncThunk(
  "warehouseProducts/fetchAll",
  async ({ warehouseId, params = {} }, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/warehouse/${warehouseId}/products/`, {
        params,
      });
      return data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);
