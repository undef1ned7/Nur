import { createAsyncThunk } from "@reduxjs/toolkit";
import warehouseAPI from "../../api/warehouse";

/**
 * Thunks для работы с документами склада
 */

// Загрузка списка документов
export const fetchWarehouseDocuments = createAsyncThunk(
  "warehouse/fetchDocuments",
  async (params = {}, { rejectWithValue }) => {
    try {
      const data = await warehouseAPI.listDocuments(params);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// Получение документа по ID
export const getWarehouseDocumentById = createAsyncThunk(
  "warehouse/getDocumentById",
  async (id, { rejectWithValue }) => {
    try {
      const data = await warehouseAPI.getDocumentById(id);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// Создание документа
export const createWarehouseDocument = createAsyncThunk(
  "warehouse/createDocument",
  async (documentData, { rejectWithValue }) => {
    try {
      const data = await warehouseAPI.createDocument(documentData);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// Обновление документа
export const updateWarehouseDocument = createAsyncThunk(
  "warehouse/updateDocument",
  async ({ id, documentData }, { rejectWithValue }) => {
    try {
      const data = await warehouseAPI.updateDocument(id, documentData);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// Частичное обновление документа
export const patchWarehouseDocument = createAsyncThunk(
  "warehouse/patchDocument",
  async ({ id, documentData }, { rejectWithValue }) => {
    try {
      const data = await warehouseAPI.patchDocument(id, documentData);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// Удаление документа
export const deleteWarehouseDocument = createAsyncThunk(
  "warehouse/deleteDocument",
  async (id, { rejectWithValue }) => {
    try {
      await warehouseAPI.deleteDocument(id);
      return id;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// Проведение документа
export const postWarehouseDocument = createAsyncThunk(
  "warehouse/postDocument",
  async ({ id, allowNegative }, { rejectWithValue }) => {
    try {
      const data = await warehouseAPI.postDocument(id, {
        allow_negative: allowNegative,
      });
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// Отмена проведения документа
export const unpostWarehouseDocument = createAsyncThunk(
  "warehouse/unpostDocument",
  async (id, { rejectWithValue }) => {
    try {
      const data = await warehouseAPI.unpostDocument(id);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// Загрузка товаров склада
export const fetchWarehouseProducts = createAsyncThunk(
  "warehouse/fetchProducts",
  async (params = {}, { rejectWithValue }) => {
    try {
      const data = await warehouseAPI.listProducts(params);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// Загрузка контрагентов
export const fetchWarehouseCounterparties = createAsyncThunk(
  "warehouse/fetchCounterparties",
  async (params = {}, { rejectWithValue }) => {
    try {
      const data = await warehouseAPI.listCounterparties(params);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// Загрузка складов
export const fetchWarehouses = createAsyncThunk(
  "warehouse/fetchWarehouses",
  async (params = {}, { rejectWithValue }) => {
    try {
      const data = await warehouseAPI.listWarehouses(params);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// ==================== КОНТРАГЕНТЫ (CRUD) ====================

// Получение контрагента по ID
export const getWarehouseCounterpartyById = createAsyncThunk(
  "warehouse/getCounterpartyById",
  async (id, { rejectWithValue }) => {
    try {
      const data = await warehouseAPI.getCounterpartyById(id);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// Создание контрагента
export const createWarehouseCounterparty = createAsyncThunk(
  "warehouse/createCounterparty",
  async (counterpartyData, { rejectWithValue }) => {
    try {
      const data = await warehouseAPI.createCounterparty(counterpartyData);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// Обновление контрагента
export const updateWarehouseCounterparty = createAsyncThunk(
  "warehouse/updateCounterparty",
  async ({ id, counterpartyData }, { rejectWithValue }) => {
    try {
      const data = await warehouseAPI.updateCounterparty(id, counterpartyData);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// Удаление контрагента
export const deleteWarehouseCounterparty = createAsyncThunk(
  "warehouse/deleteCounterparty",
  async (id, { rejectWithValue }) => {
    try {
      await warehouseAPI.deleteCounterparty(id);
      return id;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// Массовое удаление контрагентов
export const bulkDeleteWarehouseCounterparties = createAsyncThunk(
  "warehouse/bulkDeleteCounterparties",
  async (ids, { rejectWithValue }) => {
    try {
      // Удаляем по одному (если API не поддерживает массовое удаление)
      const results = await Promise.allSettled(
        ids.map((id) => warehouseAPI.deleteCounterparty(id))
      );
      const failed = results
        .map((result, index) => (result.status === "rejected" ? ids[index] : null))
        .filter(Boolean);
      if (failed.length > 0) {
        return rejectWithValue({ failed });
      }
      return ids;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);


