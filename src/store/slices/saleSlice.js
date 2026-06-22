import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import {
  createObject,
  deleteProductInCart,
  doSearch,
  getObjects,
  getProductCheckout,
  getProductInvoice,
  historySellProduct,
  historySellProductDetail,
  manualFilling,
  objectCartAddItem,
  productCheckout,
  sendBarCode,
  startSale,
  startSellObjects,
  updateProductInCart,
  updateSale,
  createDeal,
  historySellObjectDetail,
  historySellObjects,
  updateManualFilling,
  updateSellProduct,
  deleteSale, // <-- обработаем статусы создания сделок
  addCustomItem,
  fetchDocuments,
  getSale,
} from "../creators/saleThunk";
import { parsePosSalesListTotalAmount } from "../../tools/posSalesListResponse";
import {
  applyPosCartItemPatchToState,
  applyPosStartToState,
  normalizePosStartResponse,
  patchCartTabFromSale,
  removeCartLineFromStart,
} from "../../../tools/posSaleCarts";
import {
  fetchWarehouseDocuments,
  createWarehouseDocument,
  updateWarehouseDocument,
  patchWarehouseDocument,
  deleteWarehouseDocument,
  postWarehouseDocument,
  unpostWarehouseDocument,
  cashApproveWarehouseDocument,
  cashRejectWarehouseDocument,
  fetchWarehouseProducts,
  fetchWarehouseCounterparties,
} from "../creators/warehouseThunk";

const initialState = {
  start: null, // POS-продажа (товары) — активная корзина
  posCarts: [], // вкладки корзин смены (из POST /start/)
  activeSaleId: null,
  startObject: null, // Object-продажа (строительные)
  loading: false,
  // отдельный флаг именно для startSale (чтобы не плодить параллельные /start/ запросы)
  startSaleLoading: false,
  cart: null,
  error: null,
  barcode: null,
  barcodeError: null,
  foundProduct: [],
  checkout: null,
  history: [],
  historyCount: 0,
  historyTotalAmount: null,
  historyNext: null,
  historyPrevious: null,
  historyDetail: null,
  pdf: null,
  objects: [], // список object-items
  cartObject: null,
  lastDeal: null,
  historyObjects: [],
  historyObjectsCount: 0,
  historyObjectsTotalAmount: null,
  historyObjectsNext: null,
  historyObjectsPrevious: null,
  historyObjectDetail: null,
  // Состояние для документов
  documents: [],
  documentsCount: 0,
  documentsNext: null,
  documentsPrevious: null,
  documentsLoading: false,
};

const ensureError = (action) =>
  action.payload ?? { message: action.error?.message };

const saleSlice = createSlice({
  name: "sale",
  initialState,
  reducers: {
    resetPosSale: (state) => {
      // Сбрасываем активную POS-продажу и связанные ошибки/данные,
      // например при закрытии смены
      state.start = null;
      state.posCarts = [];
      state.activeSaleId = null;
      state.cart = null;
      state.checkout = null;
      state.error = null;
      state.barcode = null;
      state.barcodeError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // POS
      .addCase(startSale.pending, (state) => {
        state.loading = true;
        state.startSaleLoading = true;
      })
      .addCase(startSale.fulfilled, (state, { payload }) => {
        applyPosStartToState(state, payload);
        state.loading = false;
        state.startSaleLoading = false;
      })
      .addCase(startSale.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
        state.startSaleLoading = false;
      })
      .addCase(getSale.pending, (state) => {
        state.loading = true;
      })
      .addCase(getSale.fulfilled, (state, { payload }) => {
        state.start = payload;
        if (payload?.id) {
          state.activeSaleId = String(payload.id);
          state.posCarts = patchCartTabFromSale(state.posCarts, payload);
        }
        state.loading = false;
      })
      .addCase(getSale.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })

      .addCase(updateSale.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateSale.fulfilled, (state, { payload }) => {
        // Обновляем state.start если это текущая активная продажа
        if (state.start && payload && payload.id === state.start.id) {
          state.start = payload;
        }
        state.loading = false;
      })
      .addCase(updateSale.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })

      .addCase(updateSellProduct.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateSellProduct.fulfilled, (state, { payload }) => {
        // state.startObject = payload;
        state.loading = false;
      })
      .addCase(updateSellProduct.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })

      .addCase(manualFilling.pending, (state) => {
        // Не ставим loading: иначе касса «мигает» при каждом добавлении строки
      })
      .addCase(manualFilling.fulfilled, (state, { payload, meta }) => {
        state.cart = payload;
        if (payload && typeof payload === "object") {
          applyPosCartItemPatchToState(state, payload, {
            salePackageId: meta?.arg?.salePackageId,
          });
        }
        state.loading = false;
      })
      .addCase(manualFilling.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })
      .addCase(updateManualFilling.pending, (state) => {
        // Не ставим loading: PATCH строки корзины обновляет state из ответа
      })
      .addCase(updateManualFilling.fulfilled, (state, { payload, meta }) => {
        if (payload && typeof payload === "object") {
          applyPosCartItemPatchToState(state, payload, {
            salePackageId: meta?.arg?.salePackageId,
          });
        }
        state.loading = false;
      })
      .addCase(updateManualFilling.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })

      // OBJECT SALES
      .addCase(startSellObjects.pending, (state) => {
        state.loading = true;
      })
      .addCase(startSellObjects.fulfilled, (state, { payload }) => {
        state.startObject = payload; // ВАЖНО
        state.loading = false;
      })
      .addCase(startSellObjects.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })

      .addCase(objectCartAddItem.pending, (state) => {
        state.loading = true;
      })
      .addCase(objectCartAddItem.fulfilled, (state, { payload }) => {
        state.cartObject = payload;
        state.loading = false;
      })
      .addCase(objectCartAddItem.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })

      .addCase(deleteProductInCart.pending, (state) => {
        // Не ставим loading: DELETE строки корзины обновляет state из ответа
      })
      .addCase(deleteProductInCart.fulfilled, (state, { payload, meta }) => {
        state.loading = false;
        if (payload && typeof payload === "object") {
          applyPosCartItemPatchToState(state, payload);
        }
        const deletedItemId = meta?.arg?.productId;
        if (deletedItemId) {
          const items = state.start?.items ?? state.start?.cart?.items ?? [];
          const stillPresent =
            Array.isArray(items) &&
            items.some((it) => String(it.id) === String(deletedItemId));
          if (stillPresent) {
            removeCartLineFromStart(state, deletedItemId);
          }
        }
      })
      .addCase(deleteProductInCart.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })

      .addCase(addCustomItem.pending, (state) => {
        // Не ставим loading
      })
      .addCase(addCustomItem.fulfilled, (state, { payload }) => {
        if (payload && typeof payload === "object") {
          applyPosCartItemPatchToState(state, payload);
        }
        state.loading = false;
      })
      .addCase(addCustomItem.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })

      .addCase(deleteSale.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteSale.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(deleteSale.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })

      .addCase(updateProductInCart.pending, (state) => {
        // Не ставим loading: иначе синхронизация корзины затирает локальную цену/скидку до ответа PATCH
      })
      .addCase(updateProductInCart.fulfilled, (state, { payload }) => {
        state.loading = false;
        if (payload && typeof payload === "object") {
          const hasSaleShape =
            payload.id != null ||
            payload.sale != null ||
            Array.isArray(payload.carts) ||
            Array.isArray(payload.items) ||
            Array.isArray(payload.cart?.items);
          if (hasSaleShape) {
            applyPosCartItemPatchToState(state, payload);
          }
        }
      })
      .addCase(updateProductInCart.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })

      .addCase(sendBarCode.pending, (state) => {
        state.loading = true;
      })
      .addCase(sendBarCode.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.barcodeError = null;
        if (payload?.error) {
          state.barcodeError =
            typeof payload.error === "string"
              ? { message: payload.error }
              : payload.error;
          return;
        }

        if (Array.isArray(payload?.carts) || payload?.sale) {
          applyPosStartToState(state, payload);
          return;
        }

        if (
          payload &&
          typeof payload === "object" &&
          (Array.isArray(payload.items) ||
            Array.isArray(payload.cart?.items) ||
            payload.id)
        ) {
          const saleId =
            payload.id ?? payload.sale_id ?? payload.cart?.id ?? state.activeSaleId;
          const nextSale = saleId ? { ...payload, id: saleId } : payload;
          state.start = nextSale;
          if (saleId) {
            state.activeSaleId = String(saleId);
            state.posCarts = patchCartTabFromSale(state.posCarts, nextSale);
          }
        }
      })
      .addCase(sendBarCode.rejected, (state, { payload }) => {
        state.barcodeError = payload;
        state.loading = false;
      })

      .addCase(doSearch.pending, (state) => {
        state.loading = true;
      })
      .addCase(doSearch.fulfilled, (state, { payload }) => {
        state.foundProduct = payload;
        state.loading = false;
      })
      .addCase(doSearch.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })

      .addCase(historySellProduct.pending, (state) => {
        state.loading = true;
      })
      .addCase(historySellProduct.fulfilled, (state, { payload }) => {
        state.history = payload?.results || (Array.isArray(payload) ? payload : []);
        state.historyCount = payload?.count || payload?.length || 0;
        state.historyTotalAmount = parsePosSalesListTotalAmount(payload);
        state.historyNext = payload?.next || null;
        state.historyPrevious = payload?.previous || null;
        state.loading = false;
      })
      .addCase(historySellProduct.rejected, (state, action) => {
        state.error = ensureError(action);
        state.historyTotalAmount = null;
        state.loading = false;
      })

      .addCase(historySellObjects.pending, (state) => {
        state.loading = true;
      })
      .addCase(historySellObjects.fulfilled, (state, { payload }) => {
        state.historyObjects = payload?.results || (Array.isArray(payload) ? payload : []);
        state.historyObjectsCount = payload?.count || payload?.length || 0;
        state.historyObjectsTotalAmount = parsePosSalesListTotalAmount(payload);
        state.historyObjectsNext = payload?.next || null;
        state.historyObjectsPrevious = payload?.previous || null;
        state.loading = false;
      })
      .addCase(historySellObjects.rejected, (state, action) => {
        state.error = ensureError(action);
        state.historyObjectsTotalAmount = null;
        state.loading = false;
      })

      .addCase(historySellProductDetail.pending, (state) => {
        state.loading = true;
      })
      .addCase(historySellProductDetail.fulfilled, (state, { payload }) => {
        // Обновляем state.start если это текущая активная продажа
        if (state.start && state.start.id === payload.id) {
          state.start = payload;
        }
        state.historyDetail = payload;
        state.loading = false;
      })
      .addCase(historySellProductDetail.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })

      .addCase(historySellObjectDetail.pending, (state) => {
        state.loading = true;
      })
      .addCase(historySellObjectDetail.fulfilled, (state, { payload }) => {
        state.historyObjectDetail = payload;
        state.loading = false;
      })
      .addCase(historySellObjectDetail.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })

      // Старый API (для обратной совместимости)
      .addCase(fetchDocuments.pending, (state) => {
        state.documentsLoading = true;
      })
      .addCase(fetchDocuments.fulfilled, (state, { payload }) => {
        state.documents = payload?.results || [];
        state.documentsCount = payload?.count || 0;
        state.documentsNext = payload?.next || null;
        state.documentsPrevious = payload?.previous || null;
        state.documentsLoading = false;
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        state.error = ensureError(action);
        state.documentsLoading = false;
      })

      // Новый Warehouse API
      .addCase(fetchWarehouseDocuments.pending, (state) => {
        state.documentsLoading = true;
      })
      .addCase(fetchWarehouseDocuments.fulfilled, (state, { payload }) => {
        // Обрабатываем стандартный формат DRF пагинации
        state.documents = payload?.results || (Array.isArray(payload) ? payload : []);
        state.documentsCount = payload?.count || payload?.length || 0;
        state.documentsNext = payload?.next || null;
        state.documentsPrevious = payload?.previous || null;
        state.documentsLoading = false;
      })
      .addCase(fetchWarehouseDocuments.rejected, (state, action) => {
        state.error = ensureError(action);
        state.documentsLoading = false;
      })
      .addCase(createWarehouseDocument.fulfilled, (state, { payload }) => {
        // Добавляем новый документ в начало списка
        state.documents = [payload, ...state.documents];
        state.documentsCount = (state.documentsCount || 0) + 1;
      })
      .addCase(updateWarehouseDocument.fulfilled, (state, { payload }) => {
        // Обновляем документ в списке
        const index = state.documents.findIndex((doc) => doc.id === payload.id);
        if (index !== -1) {
          state.documents[index] = payload;
        }
      })
      .addCase(patchWarehouseDocument.fulfilled, (state, { payload }) => {
        // Обновляем документ в списке
        const index = state.documents.findIndex((doc) => doc.id === payload.id);
        if (index !== -1) {
          state.documents[index] = payload;
        }
      })
      .addCase(deleteWarehouseDocument.fulfilled, (state, { payload }) => {
        // Удаляем документ из списка
        state.documents = state.documents.filter((doc) => doc.id !== payload);
        state.documentsCount = Math.max(0, (state.documentsCount || 0) - 1);
      })
      .addCase(postWarehouseDocument.fulfilled, (state, { payload }) => {
        // Обновляем документ после проведения
        const index = state.documents.findIndex((doc) => doc.id === payload.id);
        if (index !== -1) {
          state.documents[index] = payload;
        }
      })
      .addCase(unpostWarehouseDocument.fulfilled, (state, { payload }) => {
        const index = state.documents.findIndex((doc) => doc.id === payload.id);
        if (index !== -1) {
          state.documents[index] = payload;
        }
      })
      .addCase(cashApproveWarehouseDocument.fulfilled, (state, { payload }) => {
        const index = state.documents.findIndex((doc) => doc.id === payload?.id);
        if (index !== -1 && payload) {
          state.documents[index] = payload;
        }
      })
      .addCase(cashRejectWarehouseDocument.fulfilled, (state, { payload }) => {
        const index = state.documents.findIndex((doc) => doc.id === payload?.id);
        if (index !== -1 && payload) {
          state.documents[index] = payload;
        }
      })

      .addCase(productCheckout.pending, (state) => {
        state.loading = true;
      })
      .addCase(productCheckout.fulfilled, (state, { payload }) => {
        state.checkout = payload;
        state.loading = false;
      })
      .addCase(productCheckout.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })

      .addCase(getProductCheckout.pending, (state) => {
        state.loading = true;
      })
      .addCase(getProductCheckout.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(getProductCheckout.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })

      .addCase(getProductInvoice.pending, (state) => {
        state.loading = true;
      })
      .addCase(getProductInvoice.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(getProductInvoice.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })

      .addCase(getObjects.pending, (state) => {
        state.loading = true;
      })
      .addCase(getObjects.fulfilled, (state, { payload }) => {
        state.objects = payload;
        state.loading = false;
      })
      .addCase(getObjects.rejected, (state, action) => {
        state.error = ensureError(action);
        state.loading = false;
      })

      // Create Deal
      .addCase(createDeal.pending, (state) => {
        // можно завести отдельный флаг, но общего loading обычно хватает
      })
      .addCase(createDeal.fulfilled, (state, { payload }) => {
        state.lastDeal = payload; // если нужно отобразить где-то
      })
      .addCase(createDeal.rejected, (state, action) => {
        state.error = ensureError(action);
      });
  },
});

export const { resetPosSale } = saleSlice.actions;
export const useSale = () => useSelector((state) => state.sale);
export default saleSlice.reducer;
