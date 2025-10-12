import { createSlice } from "@reduxjs/toolkit";
import {
  fetchProductsAsync,
  createProductAsync,
  updateProductAsync,
  deleteProductAsync,
  fetchBrandsAsync,
  fetchCategoriesAsync,
  createBrandAsync,
  createCategoryAsync,
  sendBarCode,
  createKassa,
  createProductWithBarcode,
  getItemsMake,
  createItemMake,
  consumeItemsMake,
  setItemMakeQuantity,
  updateItemsMake,
  deleteItemsMake,
  fetchAgentProductsAsync,
} from "../creators/productCreators";
import { useSelector } from "react-redux";

const initialState = {
  list: [],
  count: 0,
  next: null,
  previous: null,
  loading: false,
  error: null,
  itemsMake: [],
  itemsMakeLoading: false,

  brands: [],
  brandsLoading: false,
  brandsError: null,
  creatingBrand: false,
  createBrandError: null,

  categories: [],
  categoriesLoading: false,
  categoriesError: null,
  creatingCategory: false,
  createCategoryError: null,

  // Agent products
  agentProducts: [],
  agentProductsLoading: false,
  agentProductsError: null,

  creating: false,
  createError: null,
  updating: false,
  updateError: null,
  deleting: false,
  deleteError: null,
  barcodeError: null,
};

const productSlice = createSlice({
  name: "product",
  initialState,
  reducers: {
    clearProducts: (state) => {
      state.list = [];
      state.count = 0;
      state.next = null;
      state.previous = null;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProductsAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProductsAsync.fulfilled, (state, action) => {
        // console.log(action.payload);

        state.loading = false;
        state.list = action.payload.results;
        state.count = action.payload.count;
        state.next = action.payload.next;
        state.previous = action.payload.previous;
      })
      .addCase(fetchProductsAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // 🆕 FETCH BRANDS
      .addCase(fetchBrandsAsync.pending, (state) => {
        state.brandsLoading = true;
        state.brandsError = null;
      })
      .addCase(fetchBrandsAsync.fulfilled, (state, action) => {
        state.brandsLoading = false;
        state.brands = action.payload.results || action.payload;
      })
      .addCase(fetchBrandsAsync.rejected, (state, action) => {
        state.brandsLoading = false;
        state.brandsError = action.payload;
      })
      .addCase(updateItemsMake.pending, (state) => {
        state.loading = true;
        // state.brandsError = null;
      })
      .addCase(updateItemsMake.fulfilled, (state, action) => {
        state.loading = false;
        // state.brands = action.payload.results || action.payload;
      })
      .addCase(updateItemsMake.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(deleteItemsMake.pending, (state) => {
        state.loading = true;
        // state.brandsError = null;
      })
      .addCase(deleteItemsMake.fulfilled, (state, action) => {
        state.loading = false;
        // state.brands = action.payload.results || action.payload;
      })
      .addCase(deleteItemsMake.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(getItemsMake.pending, (state) => {
        state.itemsMakeLoading = true;
        state.error = null;
      })
      .addCase(getItemsMake.fulfilled, (state, action) => {
        state.itemsMakeLoading = false;
        state.itemsMake = action.payload;
      })
      .addCase(getItemsMake.rejected, (state, action) => {
        state.itemsMakeLoading = false;
        state.error = action.payload;
      })

      .addCase(createItemMake.pending, (state) => {
        state.itemsMakeLoading = true;
        state.error = null;
      })
      .addCase(createItemMake.fulfilled, (state, action) => {
        state.itemsMakeLoading = false;
        // state.itemsMake = action.payload;
      })
      .addCase(createItemMake.rejected, (state, action) => {
        state.itemsMakeLoading = false;
        state.error = action.payload;
      })
      .addCase(consumeItemsMake.pending, (state) => {
        state.itemsMakeLoading = true;
        state.error = null;
      })
      .addCase(consumeItemsMake.fulfilled, (state, action) => {
        state.itemsMakeLoading = false;
        // state.itemsMake = action.payload;
      })
      .addCase(consumeItemsMake.rejected, (state, action) => {
        state.itemsMakeLoading = false;
        state.error = action.payload;
      })
      .addCase(setItemMakeQuantity.pending, (state) => {
        state.itemsMakeLoading = true;
        state.error = null;
      })
      .addCase(setItemMakeQuantity.fulfilled, (state, action) => {
        state.itemsMakeLoading = false;
        // state.itemsMake = action.payload;
      })
      .addCase(setItemMakeQuantity.rejected, (state, action) => {
        state.itemsMakeLoading = false;
        state.error = action.payload;
      })

      // 🆕 FETCH CATEGORIES
      .addCase(fetchCategoriesAsync.pending, (state) => {
        state.categoriesLoading = true;
        state.categoriesError = null;
      })
      .addCase(fetchCategoriesAsync.fulfilled, (state, action) => {
        state.categoriesLoading = false;
        state.categories = action.payload.results || action.payload;
      })
      .addCase(fetchCategoriesAsync.rejected, (state, action) => {
        state.categoriesLoading = false;
        state.categoriesError = action.payload;
      })

      // ➕ CREATE BRAND
      .addCase(createBrandAsync.pending, (state) => {
        state.creatingBrand = true;
        state.createBrandError = null;
      })
      .addCase(createBrandAsync.fulfilled, (state, action) => {
        state.creatingBrand = false;
        state.brands.push(action.payload);
      })
      .addCase(createBrandAsync.rejected, (state, action) => {
        state.creatingBrand = false;
        state.createBrandError = action.payload;
      })

      // ➕ CREATE CATEGORY
      .addCase(createCategoryAsync.pending, (state) => {
        state.creatingCategory = true;
        state.createCategoryError = null;
      })
      .addCase(createCategoryAsync.fulfilled, (state, action) => {
        state.creatingCategory = false;
        state.categories.push(action.payload);
      })
      .addCase(createCategoryAsync.rejected, (state, action) => {
        state.creatingCategory = false;
        state.createCategoryError = action.payload;
      })

      // ➕ CREATE PRODUCT
      .addCase(createProductAsync.pending, (state) => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createProductAsync.fulfilled, (state, action) => {
        state.creating = false;
        state.list.unshift(action.payload);
        state.count += 1;
      })
      .addCase(createProductAsync.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload;
      })

      // 🔄 UPDATE PRODUCT
      .addCase(updateProductAsync.pending, (state) => {
        state.updating = true;
        state.updateError = null;
      })
      .addCase(updateProductAsync.fulfilled, (state, action) => {
        state.updating = false;
        const index = state.list.findIndex(
          (product) => product.id === action.payload.id
        );
        if (index !== -1) {
          state.list[index] = action.payload;
        }
      })
      .addCase(updateProductAsync.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload;
      })

      // ❌ DELETE PRODUCT
      .addCase(deleteProductAsync.pending, (state) => {
        state.deleting = true;
        state.deleteError = null;
      })
      .addCase(deleteProductAsync.fulfilled, (state, action) => {
        state.deleting = false;
        state.list = state.list.filter(
          (product) => product.id !== action.payload
        );
        state.count -= 1;
      })
      .addCase(deleteProductAsync.rejected, (state, action) => {
        state.deleting = false;
        state.deleteError = action.payload;
      })
      .addCase(createKassa.pending, (state) => {
        state.loading = true;
        // state.deleteError = null;
      })
      .addCase(createKassa.fulfilled, (state, action) => {
        state.loading = false;
      })
      .addCase(createKassa.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })
      .addCase(createProductWithBarcode.pending, (state) => {
        state.loading = true;
      })
      .addCase(createProductWithBarcode.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(createProductWithBarcode.rejected, (state, { payload }) => {
        state.loading = false;
        if (payload) {
          state.barcodeError = payload;
        } else {
          state.barcodeError = {
            detail: "Что-то пошло не так. Попробуйте снова.",
          };
        }
      })

      // 🆕 FETCH AGENT PRODUCTS
      .addCase(fetchAgentProductsAsync.pending, (state) => {
        state.agentProductsLoading = true;
        state.agentProductsError = null;
      })
      .addCase(fetchAgentProductsAsync.fulfilled, (state, action) => {
        state.agentProductsLoading = false;
        state.agentProducts = action.payload;
      })
      .addCase(fetchAgentProductsAsync.rejected, (state, action) => {
        state.agentProductsLoading = false;
        state.agentProductsError = action.payload;
      });
  },
});

export const useProducts = () => useSelector((state) => state.product);
export const { clearProducts } = productSlice.actions;
export default productSlice.reducer;
