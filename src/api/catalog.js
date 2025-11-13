import api from "./index";

// API для работы с каталогом товаров
export const catalogAPI = {
  // Получить все товары
  getProducts: async (params = {}) => {
    try {
      const response = await api.get("/main/products/list/", { params });
      return response.data;
    } catch (error) {
      console.error("Ошибка при получении товаров:", error);
      throw error;
    }
  },

  // Получить товар по ID
  getProductById: async (id) => {
    try {
      const response = await api.get(`/main/products/${id}`);
      return response.data;
    } catch (error) {
      console.error("Ошибка при получении товара:", error);
      throw error;
    }
  },

  // Создать новый товар
  createProduct: async (productData) => {
    try {
      const response = await api.post("/main/product", productData);
      return response.data;
    } catch (error) {
      console.error("Ошибка при создании товара:", error);
      throw error;
    }
  },

  // Обновить товар
  updateProduct: async (id, productData) => {
    try {
      const response = await api.put(`/main/products/list//${id}`, productData);
      return response.data;
    } catch (error) {
      console.error("Ошибка при обновлении товара:", error);
      throw error;
    }
  },

  // Удалить товар
  deleteProduct: async (id) => {
    try {
      const response = await api.delete(`/main/products/list//${id}`);
      return response.data;
    } catch (error) {
      console.error("Ошибка при удалении товара:", error);
      throw error;
    }
  },

  // Загрузить изображение товара
  uploadProductImage: async (productId, imageFile) => {
    try {
      const formData = new FormData();
      formData.append("image", imageFile);

      const response = await api.post(
        `/main/products/list/${productId}/images`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Ошибка при загрузке изображения:", error);
      throw error;
    }
  },

  // Удалить изображение товара
  deleteProductImage: async (productId, imageId) => {
    try {
      const response = await api.delete(
        `/main/products/list/${productId}/images/${imageId}`
      );
      return response.data;
    } catch (error) {
      console.error("Ошибка при удалении изображения:", error);
      throw error;
    }
  },

  // Обновить порядок товаров
  updateProductsOrder: async (productsOrder) => {
    try {
      const response = await api.put("/main/products/list/order", {
        productsOrder,
      });
      return response.data;
    } catch (error) {
      console.error("Ошибка при обновлении порядка товаров:", error);
      throw error;
    }
  },

  // Поиск товаров
  searchProducts: async (query, filters = {}) => {
    try {
      const response = await api.get("/main/products/list/", {
        params: { query, ...filters },
      });
      return response.data;
    } catch (error) {
      console.error("Ошибка при поиске товаров:", error);
      throw error;
    }
  },

  // Получить категории товаров
  getCategories: async () => {
    try {
      const response = await api.get("/catalog/categories");
      return response.data;
    } catch (error) {
      console.error("Ошибка при получении категорий:", error);
      throw error;
    }
  },

  // Получить бренды
  getBrands: async () => {
    try {
      const response = await api.get("/catalog/brands");
      return response.data;
    } catch (error) {
      console.error("Ошибка при получении брендов:", error);
      throw error;
    }
  },
};

export default catalogAPI;
