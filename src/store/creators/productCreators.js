import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  /* -------- PRODUCTS -------- */
  fetchProductsApi,
  createProductApi,
  updateProductApi,
  deleteProductApi,

  /* -------- BRANDS -------- */
  fetchBrands, // GET /main/brands/
  createBrand as createBrandApi,
  updateBrand as updateBrandApi,
  deleteBrand as deleteBrandApi,

  /* -------- CATEGORIES -------- */
  fetchCategories, // GET /main/categories/
  createCategory as createCategoryApi,
  updateCategory as updateCategoryApi,
  deleteCategory as deleteCategoryApi,
} from "../../api/products";
import api from "../../api";

/* =================================================================== */
/*                               PRODUCTS                              */
/* =================================================================== */

export const fetchProductsAsync = createAsyncThunk(
  "products/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchProductsApi(params);
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const createProductAsync = createAsyncThunk(
  "products/create",
  async (data, { rejectWithValue }) => {
    try {
      return await createProductApi(data);
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

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
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const createProductWithBarcode = createAsyncThunk(
  "create/by-barcode",
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

export const updateProductAsync = createAsyncThunk(
  "products/update",
  async ({ productId, updatedData }, { rejectWithValue }) => {
    try {
      return await updateProductApi(productId, updatedData);
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const deleteProductAsync = createAsyncThunk(
  "products/delete",
  async (productId, { rejectWithValue }) => {
    try {
      await deleteProductApi(productId);
      return productId;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
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
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const createBrandAsync = createAsyncThunk(
  "brand/create",
  async (data, { rejectWithValue }) => {
    try {
      return await createBrandApi(data);
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const updateBrandAsync = createAsyncThunk(
  "brand/update",
  async ({ brandId, updatedData }, { rejectWithValue }) => {
    try {
      return await updateBrandApi(brandId, updatedData);
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
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
      return rejectWithValue(error.response?.data || error.message);
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
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const createCategoryAsync = createAsyncThunk(
  "category/create",
  async (data, { rejectWithValue }) => {
    try {
      return await createCategoryApi(data);
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const updateCategoryAsync = createAsyncThunk(
  "category/update",
  async ({ categoryId, updatedData }, { rejectWithValue }) => {
    try {
      return await updateCategoryApi(categoryId, updatedData);
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
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
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const deleteListProduct = createAsyncThunk(
  "list/delete",
  async (list, { rejectWithValue }) => {
    try {
      const { data } = await api.delete("/main/products/bulk-delete/", list);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);
