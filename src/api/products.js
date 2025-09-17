import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "./index";

export const fetchProductsApi = async (params = {}) => {
  try {
    const response = await api.get("main/products/list/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Fetch Products Error Data:", error.response.data);
      console.error("Fetch Products Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
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
