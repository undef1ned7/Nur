// src/store/creators/productCreators.js
import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api";

/* Если у тебя есть разделённые API-helpers (../../api/products),
   можешь оставить эти импорты. Если нет — можно удалить. */
import {
  fetchProductsApi,
  createProductApi,
  updateProductApi,
  deleteProductApi,
  fetchBrands, // GET /main/brands/
  createBrand as createBrandApi,
  updateBrand as updateBrandApi,
  deleteBrand as deleteBrandApi,
  fetchCategories, // GET /main/categories/
  createCategory as createCategoryApi,
  updateCategory as updateCategoryApi,
  deleteCategory as deleteCategoryApi,
  fetchAgentProductsApi, // GET /main/agents/me/products/
  fetchProductHistoryApi, // GET /main/warehouse/history/
  getProductByBarcodeApi, // GET /main/products/barcode/{barcode}/
  addProductToWarehouseApi, // POST /main/products/add-to-warehouse/
} from "../../api/products";

/* =================================================================== */
/*                               PRODUCTS                              */
/* =================================================================== */

export const fetchProductsAsync = createAsyncThunk(
  "products/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      // если нет helpers — замени на api.get("/main/products/", { params })
      return await fetchProductsApi(params);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const createProductAsync = createAsyncThunk(
  "products/create",
  async (data, { rejectWithValue }) => {
    try {
      // если нет helpers — замени на (await api.post("/main/products/", data)).data
      return await createProductApi(data);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const updateProductAsync = createAsyncThunk(
  "products/update",
  async ({ productId, updatedData }, { rejectWithValue }) => {
    try {
      // если нет helpers — (await api.patch(`/main/products/${productId}/`, updatedData)).data
      return await updateProductApi(productId, updatedData);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const deleteProductAsync = createAsyncThunk(
  "products/delete",
  async (productId, { rejectWithValue }) => {
    try {
      // если нет helpers — await api.delete(`/main/products/${productId}/`)
      await deleteProductApi(productId);
      return productId;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

/* bulk-delete */
export const bulkDeleteProductsAsync = createAsyncThunk(
  "products/bulkDelete",
  async ({ ids, soft = true, require_all = false }, { rejectWithValue }) => {
    try {
      const { data } = await api.delete("/main/products/bulk-delete/", {
        data: { ids, soft, require_all },
      });
      return data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

/* =================================================================== */
/*                                BRANDS                               */
/* =================================================================== */

export const fetchBrandsAsync = createAsyncThunk(
  "brand/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchBrands(params);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const createBrandAsync = createAsyncThunk(
  "brand/create",
  async (data, { rejectWithValue }) => {
    try {
      return await createBrandApi(data);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const updateBrandAsync = createAsyncThunk(
  "brand/update",
  async ({ brandId, updatedData }, { rejectWithValue }) => {
    try {
      return await updateBrandApi(brandId, updatedData);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const deleteBrandAsync = createAsyncThunk(
  "brand/delete",
  async (brandId, { rejectWithValue }) => {
    try {
      await deleteBrandApi(brandId);
      return brandId;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

/* =================================================================== */
/*                              CATEGORIES                             */
/* =================================================================== */

export const fetchCategoriesAsync = createAsyncThunk(
  "category/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchCategories(params);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const createCategoryAsync = createAsyncThunk(
  "category/create",
  async (data, { rejectWithValue }) => {
    try {
      return await createCategoryApi(data);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const updateCategoryAsync = createAsyncThunk(
  "category/update",
  async ({ categoryId, updatedData }, { rejectWithValue }) => {
    try {
      return await updateCategoryApi(categoryId, updatedData);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const deleteCategoryAsync = createAsyncThunk(
  "category/delete",
  async (categoryId, { rejectWithValue }) => {
    try {
      await deleteCategoryApi(categoryId);
      return categoryId;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

/* =================================================================== */
/*                              ITEMS MAKE                             */
/* =================================================================== */

// список сырья
export const getItemsMake = createAsyncThunk(
  "itemsMake/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/main/items-make/");
      return data?.results ?? [];
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const updateItemsMake = createAsyncThunk(
  "itemsMake/updateItem",
  async ({ id, updatedData }, { rejectWithValue }) => {
    try {
      const { data: response } = await api.patch(
        `/main/items-make/${id}/`,
        updatedData
      );
      return response;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const deleteItemsMake = createAsyncThunk(
  "itemsMake/deleteItem",
  async (id, { rejectWithValue }) => {
    try {
      const { data: response } = await api.delete(`/main/items-make/${id}/`);
      return response;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

// создание сырья
export const createItemMake = createAsyncThunk(
  "itemsMake/create",
  async (item, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/main/items-make/", item);
      return data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

// точечная установка quantity (для отладки/ручных кейсов)
export const setItemMakeQuantity = createAsyncThunk(
  "itemsMake/setQuantity",
  async ({ id, quantity }, { rejectWithValue, dispatch }) => {
    try {
      if (!id) throw new Error("id is required");
      // API: не более 3 знаков после запятой
      const qty = Math.round(Number(quantity) * 1000) / 1000;
      const { data } = await api.patch(`/main/items-make/${id}/`, {
        quantity: qty,
      });
      // рефреш списка после удачного PATCH
      try {
        await dispatch(getItemsMake()).unwrap();
      } catch (_) {}
      return data;
    } catch (error) {
      const payload = {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      };
      // eslint-disable-next-line no-console
      console.error("setItemMakeQuantity error:", payload);
      return rejectWithValue(payload);
    }
  }
);

// «умное» списание сырья по рецепту: recipe=[{id, qty_per_unit}], units=шт готового товара
export const consumeItemsMake = createAsyncThunk(
  "itemsMake/consume",
  async ({ recipe, units }, { rejectWithValue, dispatch }) => {
    try {
      if (!Array.isArray(recipe) || !recipe.length || !units) return [];

      const results = [];
      const round3 = (v) => Math.round(Number(v) * 1000) / 1000;
      for (const r of recipe) {
        const id = String(r.id);
        const perUnit = round3(r.qty_per_unit || 0);
        if (!id || perUnit <= 0) continue;

        // 1) GET актуального остатка
        const currentRes = await api.get(`/main/items-make/${id}/`);
        const current = Number(currentRes?.data?.quantity ?? 0);

        // 2) Счёт нового остатка; API: не более 3 знаков после запятой
        const delta = perUnit * Number(units);
        const newQty = Math.max(0, Math.round((current - delta) * 1000) / 1000);

        // 3) PATCH на бэк
        const { data } = await api.patch(`/main/items-make/${id}/`, {
          quantity: newQty,
        });
        results.push(data);
      }

      // 4) Рефреш списка сырья
      try {
        await dispatch(getItemsMake()).unwrap();
      } catch (_) {}

      return results;
    } catch (error) {
      const payload = {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      };
      // eslint-disable-next-line no-console
      console.error("consumeItemsMake error:", payload);
      return rejectWithValue(payload);
    }
  }
);

/* =================================================================== */
/*                          ПРОЧИЕ ПРИМЕРЫ (Касса)                    */
/* =================================================================== */

export const createKassa = createAsyncThunk(
  "kassa/create",
  async (data, { rejectWithValue }) => {
    try {
      const { data: response } = await api.post(
        "/construction/cashboxes/",
        data
      );
      return response;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const createProductWithBarcode = createAsyncThunk(
  "products/createByBarcode",
  async (barcode, { rejectWithValue }) => {
    try {
      const { data } = await api.post(
        "/main/products/create-by-barcode/",
        barcode
      );
      return data;
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);

/** Сканирование товара по штрих-коду в контексте склада (сфера склад). */
export const scanWarehouseProductAsync = createAsyncThunk(
  "products/scanWarehouse",
  async ({ warehouse_uuid, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(
        `/warehouse/${warehouse_uuid}/products/scan/`,
        payload
      );
      return data;
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);

/* =================================================================== */
/*                              AGENTS                                */
/* =================================================================== */

export const fetchAgentProductsAsync = createAsyncThunk(
  "agentProducts/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchAgentProductsApi(params);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

// История товаров для сотрудника
export const fetchProductHistoryAsync = createAsyncThunk(
  "products/fetchHistory",
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchProductHistoryApi(params);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

// Получение товара по штрих-коду
export const getProductByBarcodeAsync = createAsyncThunk(
  "products/getByBarcode",
  async (barcode, { rejectWithValue }) => {
    try {
      return await getProductByBarcodeApi(barcode);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

// Добавление товара в склад с количеством
export const addProductToWarehouseAsync = createAsyncThunk(
  "products/addToWarehouse",
  async (productData, { rejectWithValue }) => {
    try {
      return await addProductToWarehouseApi(productData);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);
