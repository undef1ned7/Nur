import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import catalogAPI from "../../api/catalog";

// Асинхронные действия
export const fetchProducts = createAsyncThunk(
  "catalog/fetchProducts",
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await catalogAPI.getProducts(params);
      return response.results;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Ошибка при загрузке товаров"
      );
    }
  }
);

export const fetchProductById = createAsyncThunk(
  "catalog/fetchProductById",
  async (id, { rejectWithValue }) => {
    try {
      const response = await catalogAPI.getProductById(id);
      return response;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Ошибка при загрузке товара"
      );
    }
  }
);

export const createProduct = createAsyncThunk(
  "catalog/createProduct",
  async (productData, { rejectWithValue }) => {
    try {
      const response = await catalogAPI.createProduct(productData);
      return response;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Ошибка при создании товара"
      );
    }
  }
);

export const updateProduct = createAsyncThunk(
  "catalog/updateProduct",
  async ({ id, productData }, { rejectWithValue }) => {
    try {
      const response = await catalogAPI.updateProduct(id, productData);
      return response;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Ошибка при обновлении товара"
      );
    }
  }
);

export const deleteProduct = createAsyncThunk(
  "catalog/deleteProduct",
  async (id, { rejectWithValue }) => {
    try {
      await catalogAPI.deleteProduct(id);
      return id;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Ошибка при удалении товара"
      );
    }
  }
);

export const updateProductsOrder = createAsyncThunk(
  "catalog/updateProductsOrder",
  async (productsOrder, { rejectWithValue }) => {
    try {
      const response = await catalogAPI.updateProductsOrder(productsOrder);
      return response;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Ошибка при обновлении порядка"
      );
    }
  }
);

export const searchProducts = createAsyncThunk(
  "catalog/searchProducts",
  async ({ query, filters }, { rejectWithValue }) => {
    try {
      const response = await catalogAPI.searchProducts(query, filters);
      return response;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Ошибка при поиске товаров"
      );
    }
  }
);

export const fetchCategories = createAsyncThunk(
  "catalog/fetchCategories",
  async (_, { rejectWithValue }) => {
    try {
      const response = await catalogAPI.getCategories();
      return response;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Ошибка при загрузке категорий"
      );
    }
  }
);

export const fetchBrands = createAsyncThunk(
  "catalog/fetchBrands",
  async (_, { rejectWithValue }) => {
    try {
      const response = await catalogAPI.getBrands();
      return response;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Ошибка при загрузке брендов"
      );
    }
  }
);

// Начальное состояние
const initialState = {
  products: [],
  categories: [],
  brands: [],
  selectedProduct: null,
  searchResults: [],
  loading: false,
  error: null,
  filters: {
    category: null,
    brand: null,
    priceRange: null,
    inStock: null,
    sortBy: "name",
    sortOrder: "asc",
  },
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 9,
  },
};

// Слайс
const catalogSlice = createSlice({
  name: "catalog",
  initialState,
  reducers: {
    setSelectedProduct: (state, action) => {
      state.selectedProduct = action.payload;
    },
    clearSelectedProduct: (state) => {
      state.selectedProduct = null;
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
    },
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    clearError: (state) => {
      state.error = null;
    },
    updateProductInList: (state, action) => {
      const { id, updates } = action.payload;
      const index = state.products.findIndex((product) => product.id === id);
      if (index !== -1) {
        state.products[index] = { ...state.products[index], ...updates };
      }
    },
    reorderProducts: (state, action) => {
      state.products = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Получение товаров
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload.products || action.payload;
        if (action.payload.pagination) {
          state.pagination = action.payload.pagination;
        }
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Получение товара по ID
      .addCase(fetchProductById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProductById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedProduct = action.payload;
      })
      .addCase(fetchProductById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Создание товара
      .addCase(createProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createProduct.fulfilled, (state, action) => {
        state.loading = false;
        state.products.unshift(action.payload);
      })
      .addCase(createProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Обновление товара
      .addCase(updateProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProduct.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.products.findIndex(
          (product) => product.id === action.payload.id
        );
        if (index !== -1) {
          state.products[index] = action.payload;
        }
        if (
          state.selectedProduct &&
          state.selectedProduct.id === action.payload.id
        ) {
          state.selectedProduct = action.payload;
        }
      })
      .addCase(updateProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Удаление товара
      .addCase(deleteProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteProduct.fulfilled, (state, action) => {
        state.loading = false;
        state.products = state.products.filter(
          (product) => product.id !== action.payload
        );
        if (
          state.selectedProduct &&
          state.selectedProduct.id === action.payload
        ) {
          state.selectedProduct = null;
        }
      })
      .addCase(deleteProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Обновление порядка товаров
      .addCase(updateProductsOrder.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProductsOrder.fulfilled, (state, action) => {
        state.loading = false;
        // Порядок уже обновлен в reducer
      })
      .addCase(updateProductsOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Поиск товаров
      .addCase(searchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.searchResults = action.payload;
      })
      .addCase(searchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Получение категорий
      .addCase(fetchCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.loading = false;
        state.categories = action.payload;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Получение брендов
      .addCase(fetchBrands.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBrands.fulfilled, (state, action) => {
        state.loading = false;
        state.brands = action.payload;
      })
      .addCase(fetchBrands.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const {
  setSelectedProduct,
  clearSelectedProduct,
  setFilters,
  clearFilters,
  setPagination,
  clearError,
  updateProductInList,
  reorderProducts,
} = catalogSlice.actions;

export default catalogSlice.reducer;
