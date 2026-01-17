import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "./index";

export const fetchProductsApi = async (params = {}) => {
  try {
    // Убираем служебные параметры из запроса
    const { warehouse, _cacheKey, ...restParams } = params;
    let url = "main/products/list/";

    if (warehouse) {
      url = `warehouse/${warehouse}/products/`;
    }

    const response = await api.get(url, { params: restParams });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Fetch Products Error Data:", error.response.data);
      console.error("Fetch Products Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const getBrandsPorduct = async (params = {}) => {
  try {
    const response = await api.get("main/brands/");
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Fetch Products Error Data:", error.response.data);
      console.error("Fetch Products Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};

export const getCategoriesPorduct = async (params = {}) => {
  try {
    const response = await api.get("main/categories/");
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Fetch Products Error Data:", error.response.data);
      console.error("Fetch Products Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};

export const createProductApi = async (productData) => {
  try {
    const response = await api.post(
      "main/products/create-manual/",
      productData
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Product Error Data:", error.response.data);
      console.error("Create Product Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};

export const updateProductApi = async (productId, productData) => {
  try {
    const response = await api.patch(
      `main/products/${productId}/`,
      productData
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(
        `Update Product (ID: ${productId}) Error Data:`,
        error.response.data
      );
      console.error(
        `Update Product (ID: ${productId}) Error Status:`,
        error.response.status
      );
      return Promise.reject(error.response.data);
    }
  }
};

export const deleteProductApi = async (productId) => {
  try {
    await api.delete(`main/products/${productId}/`);
  } catch (error) {
    if (error.response) {
      console.error(
        `Delete Product (ID: ${productId}) Error Data:`,
        error.response.data
      );
      console.error(
        `Delete Product (ID: ${productId}) Error Status:`,
        error.response.status
      );
      return Promise.reject(error.response.data);
    }
  }
};

export const fetchBrands = async (params = {}) =>
  (await api.get("main/brands/", { params })).data;

export const createBrand = async (data) =>
  (await api.post("main/brands/", data)).data;

export const updateBrand = async (id, data) =>
  (await api.patch(`main/brands/${id}/`, data)).data;

export const deleteBrand = async (id) =>
  (await api.delete(`main/brands/${id}/`)).data;

// ---------- Categories ----------
export const fetchCategories = async (params = {}) =>
  (await api.get("main/categories/", { params })).data;

export const createCategory = async (data) =>
  (await api.post("main/categories/", data)).data;

export const updateCategory = async (id, data) =>
  (await api.patch(`main/categories/${id}/`, data)).data;

export const deleteCategory = async (id) =>
  (await api.delete(`main/categories/${id}/`)).data;

// ---------- Agents ----------
export const fetchAgentProductsApi = async (params = {}) => {
  try {
    const response = await api.get("main/agents/me/products/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Fetch Agent Products Error Data:", error.response.data);
      console.error(
        "Fetch Agent Products Error Status:",
        error.response.status
      );
      return Promise.reject(error.response.data);
    }
  }
};

// История товаров для сотрудника
export const fetchProductHistoryApi = async (params = {}) => {
  try {
    // Загружаем все данные без параметров, так как сервер не поддерживает фильтрацию и пагинацию
    const response = await api.get("/main/products/list/");
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Fetch Product History Error Data:", error.response.data);
      console.error(
        "Fetch Product History Error Status:",
        error.response.status
      );
      return Promise.reject(error.response.data);
    }
  }
};

// Получение товара по штрих-коду
export const getProductByBarcodeApi = async (barcode) => {
  try {
    const response = await api.get(`main/products/global-barcode/${barcode}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Product By Barcode Error Data:", error.response.data);
      console.error(
        "Get Product By Barcode Error Status:",
        error.response.status
      );
      return Promise.reject(error.response.data);
    }
  }
};

// Добавление товара в склад с количеством
export const addProductToWarehouseApi = async (productData) => {
  try {
    const response = await api.post(
      "main/products/add-to-warehouse/",
      productData
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(
        "Add Product To Warehouse Error Data:",
        error.response.data
      );
      console.error(
        "Add Product To Warehouse Error Status:",
        error.response.status
      );
      return Promise.reject(error.response.data);
    }
  }
};
