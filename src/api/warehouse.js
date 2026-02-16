import api from "./index";

/**
 * API для работы со складом (warehouse module)
 * Базовый префикс: /api/warehouse/
 *
 * Скоуп: все вьюхи используют CompanyBranchRestrictedMixin.
 * Если у пользователя нет фиксированного филиала — передавайте ?branch=<uuid> в params.
 * Пагинация: в списках поддерживается ?page=1|2|...
 */

// ==================== ДОКУМЕНТЫ ====================

/**
 * Получить список документов
 * @param {Object} params - doc_type, status, warehouse_from, warehouse_to, counterparty, search (по number, comment), page, branch
 */
export const listDocuments = async (params = {}) => {
  try {
    const response = await api.get("warehouse/documents/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Documents Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Получить документ по ID
 * @param {string} id - UUID документа
 */
export const getDocumentById = async (id) => {
  try {
    const response = await api.get(`warehouse/documents/${id}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Создать документ
 * @param {Object} documentData - Данные документа
 * @param {string} documentData.doc_type - Тип документа (SALE, PURCHASE, TRANSFER, etc.)
 * @param {string} documentData.warehouse_from - UUID склада-отправителя
 * @param {string} documentData.warehouse_to - UUID склада-получателя (для TRANSFER)
 * @param {string} documentData.counterparty - UUID контрагента
 * @param {string} documentData.comment - Комментарий
 * @param {Array} documentData.items - Массив товаров
 */
export const createDocument = async (documentData) => {
  try {
    const response = await api.post("warehouse/documents/", documentData);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Обновить документ
 * @param {string} id - UUID документа
 * @param {Object} documentData - Данные документа
 */
export const updateDocument = async (id, documentData) => {
  try {
    const response = await api.put(`warehouse/documents/${id}/`, documentData);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Update Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Частичное обновление документа
 * @param {string} id - UUID документа
 * @param {Object} documentData - Частичные данные документа
 */
export const patchDocument = async (id, documentData) => {
  try {
    const response = await api.patch(
      `warehouse/documents/${id}/`,
      documentData
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Patch Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Удалить документ
 * @param {string} id - UUID документа
 */
export const deleteDocument = async (id) => {
  try {
    const response = await api.delete(`warehouse/documents/${id}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Delete Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Провести документ
 * @param {string} id - UUID документа
 * @param {Object} options - Опции проведения
 * @param {boolean|string} options.allow_negative - Обход проверки отрицательных остатков (true|"true"|"1"|"yes")
 */
export const postDocument = async (id, options = {}) => {
  try {
    const body = {};
    if (options.allow_negative !== undefined) {
      body.allow_negative = options.allow_negative;
    }
    const response = await api.post(
      `warehouse/documents/${id}/post/`,
      Object.keys(body).length > 0 ? body : undefined
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Post Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Отменить проведение документа
 * @param {string} id - UUID документа
 */
export const unpostDocument = async (id) => {
  try {
    const response = await api.post(`warehouse/documents/${id}/unpost/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Unpost Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

// ==================== ТИПОВЫЕ СПИСКИ ДОКУМЕНТОВ ====================

/**
 * Получить список документов продажи (SALE)
 * GET /api/warehouse/documents/sale/
 */
export const listSaleDocuments = async (params = {}) => {
  try {
    const response = await api.get("warehouse/documents/sale/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Sale Documents Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Создать документ продажи (SALE)
 * POST /api/warehouse/documents/sale/
 */
export const createSaleDocument = async (payload) => {
  try {
    const response = await api.post("warehouse/documents/sale/", payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Sale Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Получить список документов покупки (PURCHASE)
 * GET /api/warehouse/documents/purchase/
 */
export const listPurchaseDocuments = async (params = {}) => {
  try {
    const response = await api.get("warehouse/documents/purchase/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Purchase Documents Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Создать документ покупки (PURCHASE)
 * POST /api/warehouse/documents/purchase/
 */
export const createPurchaseDocument = async (payload) => {
  try {
    const response = await api.post("warehouse/documents/purchase/", payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Purchase Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Получить список документов возврата продажи (SALE_RETURN)
 * GET /api/warehouse/documents/sale-return/
 */
export const listSaleReturnDocuments = async (params = {}) => {
  try {
    const response = await api.get("warehouse/documents/sale-return/", {
      params,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Sale-Return Documents Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Создать документ возврата продажи (SALE_RETURN)
 * POST /api/warehouse/documents/sale-return/
 */
export const createSaleReturnDocument = async (payload) => {
  try {
    const response = await api.post(
      "warehouse/documents/sale-return/",
      payload
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Sale-Return Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Получить список документов возврата покупки (PURCHASE_RETURN)
 * GET /api/warehouse/documents/purchase-return/
 */
export const listPurchaseReturnDocuments = async (params = {}) => {
  try {
    const response = await api.get("warehouse/documents/purchase-return/", {
      params,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(
        "List Purchase-Return Documents Error:",
        error.response.data
      );
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Создать документ возврата покупки (PURCHASE_RETURN)
 * POST /api/warehouse/documents/purchase-return/
 */
export const createPurchaseReturnDocument = async (payload) => {
  try {
    const response = await api.post(
      "warehouse/documents/purchase-return/",
      payload
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(
        "Create Purchase-Return Document Error:",
        error.response.data
      );
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Получить список документов инвентаризации (INVENTORY)
 * GET /api/warehouse/documents/inventory/
 */
export const listInventoryDocuments = async (params = {}) => {
  try {
    const response = await api.get("warehouse/documents/inventory/", {
      params,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Inventory Documents Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Создать документ инвентаризации (INVENTORY)
 * POST /api/warehouse/documents/inventory/
 */
export const createInventoryDocument = async (payload) => {
  try {
    const response = await api.post("warehouse/documents/inventory/", payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Inventory Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Получить список документов прихода (RECEIPT)
 * GET /api/warehouse/documents/receipt/
 */
export const listReceiptDocuments = async (params = {}) => {
  try {
    const response = await api.get("warehouse/documents/receipt/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Receipt Documents Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Создать документ прихода (RECEIPT)
 * POST /api/warehouse/documents/receipt/
 */
export const createReceiptDocument = async (payload) => {
  try {
    const response = await api.post("warehouse/documents/receipt/", payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Receipt Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Получить список документов списания (WRITE_OFF)
 * GET /api/warehouse/documents/write-off/
 */
export const listWriteOffDocuments = async (params = {}) => {
  try {
    const response = await api.get("warehouse/documents/write-off/", {
      params,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Write-Off Documents Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Создать документ списания (WRITE_OFF)
 * POST /api/warehouse/documents/write-off/
 */
export const createWriteOffDocument = async (payload) => {
  try {
    const response = await api.post("warehouse/documents/write-off/", payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Write-Off Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Получить список документов перемещения (TRANSFER)
 * GET /api/warehouse/documents/transfer/
 */
export const listTransferDocuments = async (params = {}) => {
  try {
    const response = await api.get("warehouse/documents/transfer/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Transfer Documents Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Создать документ перемещения (TRANSFER)
 * POST /api/warehouse/documents/transfer/
 */
export const createTransferDocument = async (payload) => {
  try {
    const response = await api.post("warehouse/documents/transfer/", payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Transfer Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Перемещение товаров между складами (transfer endpoint)
 * POST /api/warehouse/transfer/
 * @param {Object} payload - { warehouse_from, warehouse_to, comment, items[] }
 */
export const transferWarehouse = async (payload) => {
  try {
    const response = await api.post("warehouse/transfer/", payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Warehouse Transfer Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

// ==================== БРЕНДЫ (2.2) ====================

/**
 * GET /api/warehouse/brands/
 * @param {Object} params - name (icontains), branch, page
 */
export const listBrands = async (params = {}) => {
  try {
    const response = await api.get("warehouse/brands/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Brands Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const getBrandById = async (uuid) => {
  try {
    const response = await api.get(`warehouse/brands/${uuid}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Brand Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const createBrand = async (payload) => {
  try {
    const response = await api.post("warehouse/brands/", payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Brand Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const updateBrand = async (uuid, payload) => {
  try {
    const response = await api.patch(`warehouse/brands/${uuid}/`, payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Update Brand Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const deleteBrand = async (uuid) => {
  try {
    const response = await api.delete(`warehouse/brands/${uuid}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Delete Brand Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

// ==================== КАТЕГОРИИ (2.3) ====================

/**
 * GET /api/warehouse/category/
 * @param {Object} params - branch, page
 */
export const listCategories = async (params = {}) => {
  try {
    const response = await api.get("warehouse/category/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Categories Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const getCategoryById = async (uuid) => {
  try {
    const response = await api.get(`warehouse/category/${uuid}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Category Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const createCategory = async (payload) => {
  try {
    const response = await api.post("warehouse/category/", payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Category Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const updateCategory = async (uuid, payload) => {
  try {
    const response = await api.patch(`warehouse/category/${uuid}/`, payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Update Category Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const deleteCategory = async (uuid) => {
  try {
    const response = await api.delete(`warehouse/category/${uuid}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Delete Category Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

// ==================== ТОВАРЫ: основной API (3.1) ====================

/**
 * 3.1 Список товаров по складу
 * GET /api/warehouse/{warehouse_uuid}/products/
 * @param {string} warehouseUuid - UUID склада
 * @param {Object} params - name, article, price_min, price_max, purchase_price_min, purchase_price_max, markup_min, markup_max, brand, category, warehouse, status, stock, page
 */
export const listWarehouseProducts = async (warehouseUuid, params = {}) => {
  try {
    const response = await api.get(`warehouse/${warehouseUuid}/products/`, {
      params,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Warehouse Products Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * 3.1 Создать товар на складе
 * POST /api/warehouse/{warehouse_uuid}/products/
 */
export const createProductInWarehouse = async (warehouseUuid, payload) => {
  try {
    const response = await api.post(
      `warehouse/${warehouseUuid}/products/`,
      payload
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Product In Warehouse Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * 3.1 Детали товара (глобально по uuid)
 * GET /api/warehouse/products/{product_uuid}/
 */
export const getProductByUuid = async (uuid) => {
  try {
    const response = await api.get(`warehouse/products/${uuid}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Product By Uuid Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * 3.1 Обновить товар
 * PATCH/PUT /api/warehouse/products/{product_uuid}/
 */
export const updateProductByUuid = async (uuid, payload) => {
  try {
    const response = await api.patch(`warehouse/products/${uuid}/`, payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Update Product By Uuid Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * 3.1 Удалить товар
 * DELETE /api/warehouse/products/{product_uuid}/
 */
export const deleteProductByUuid = async (uuid) => {
  try {
    const response = await api.delete(`warehouse/products/${uuid}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Delete Product By Uuid Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * 3.1.1 Скан штрихкода (поиск или создание товара)
 * POST /api/warehouse/{warehouse_uuid}/products/scan/
 * @param {string} warehouseUuid - UUID склада
 * @param {Object} payload - { barcode, name?, category? } — name и category обязательны при создании нового
 * @returns {{ created: boolean, scan_qty?: string|null, product: Object }}
 */
export const scanProduct = async (warehouseUuid, payload) => {
  try {
    const response = await api.post(
      `warehouse/${warehouseUuid}/products/scan/`,
      payload
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Scan Product Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

// ==================== ГРУППЫ ТОВАРОВ СКЛАДА (2.3.1) ====================

/**
 * Список групп склада
 * GET /api/warehouse/{warehouse_uuid}/groups/
 */
export const listWarehouseGroups = async (warehouseUuid) => {
  try {
    const response = await api.get(`warehouse/${warehouseUuid}/groups/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Warehouse Groups Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Детали группы
 * GET /api/warehouse/{warehouse_uuid}/groups/{group_uuid}/
 */
export const getWarehouseGroup = async (warehouseUuid, groupUuid) => {
  try {
    const response = await api.get(
      `warehouse/${warehouseUuid}/groups/${groupUuid}/`
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Warehouse Group Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Создать группу
 * POST /api/warehouse/{warehouse_uuid}/groups/
 * @param {Object} payload - { name, parent?: uuid|null }
 */
export const createWarehouseGroup = async (warehouseUuid, payload) => {
  try {
    const response = await api.post(
      `warehouse/${warehouseUuid}/groups/`,
      payload
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Warehouse Group Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Обновить группу
 * PATCH/PUT /api/warehouse/{warehouse_uuid}/groups/{group_uuid}/
 */
export const updateWarehouseGroup = async (
  warehouseUuid,
  groupUuid,
  payload
) => {
  try {
    const response = await api.patch(
      `warehouse/${warehouseUuid}/groups/${groupUuid}/`,
      payload
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Update Warehouse Group Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Удалить группу
 * DELETE /api/warehouse/{warehouse_uuid}/groups/{group_uuid}/
 */
export const deleteWarehouseGroup = async (warehouseUuid, groupUuid) => {
  try {
    const response = await api.delete(
      `warehouse/${warehouseUuid}/groups/${groupUuid}/`
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Delete Warehouse Group Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

// ==================== ФОТО ТОВАРА (3.2) ====================

/**
 * GET /api/warehouse/products/{product_uuid}/images/
 */
export const listProductImages = async (productUuid) => {
  try {
    const response = await api.get(
      `warehouse/products/${productUuid}/images/`
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Product Images Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * POST /api/warehouse/products/{product_uuid}/images/
 * Content-Type: multipart/form-data, поле image (обязательно), опционально alt, is_primary
 */
export const createProductImage = async (productUuid, formData) => {
  try {
    const response = await api.post(
      `warehouse/products/${productUuid}/images/`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Product Image Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * GET/PATCH/PUT/DELETE /api/warehouse/products/{product_uuid}/images/{image_uuid}/
 */
export const getProductImage = async (productUuid, imageUuid) => {
  try {
    const response = await api.get(
      `warehouse/products/${productUuid}/images/${imageUuid}/`
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Product Image Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const updateProductImage = async (productUuid, imageUuid, formData) => {
  try {
    const response = await api.patch(
      `warehouse/products/${productUuid}/images/${imageUuid}/`,
      formData,
      formData instanceof FormData
        ? { headers: { "Content-Type": "multipart/form-data" } }
        : {}
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Update Product Image Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const deleteProductImage = async (productUuid, imageUuid) => {
  try {
    const response = await api.delete(
      `warehouse/products/${productUuid}/images/${imageUuid}/`
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Delete Product Image Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

// ==================== УПАКОВКИ ТОВАРА (3.3) ====================

/**
 * GET /api/warehouse/products/{product_uuid}/packages/
 */
export const listProductPackages = async (productUuid) => {
  try {
    const response = await api.get(
      `warehouse/products/${productUuid}/packages/`
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Product Packages Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * POST /api/warehouse/products/{product_uuid}/packages/
 * quantity_in_package > 0
 */
export const createProductPackage = async (productUuid, payload) => {
  try {
    const response = await api.post(
      `warehouse/products/${productUuid}/packages/`,
      payload
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Product Package Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const getProductPackage = async (productUuid, packageUuid) => {
  try {
    const response = await api.get(
      `warehouse/products/${productUuid}/packages/${packageUuid}/`
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Product Package Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const updateProductPackage = async (
  productUuid,
  packageUuid,
  payload
) => {
  try {
    const response = await api.patch(
      `warehouse/products/${productUuid}/packages/${packageUuid}/`,
      payload
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Update Product Package Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const deleteProductPackage = async (productUuid, packageUuid) => {
  try {
    const response = await api.delete(
      `warehouse/products/${productUuid}/packages/${packageUuid}/`
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Delete Product Package Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

// ==================== ТОВАРЫ: простой CRUD для документов (3.4) ====================

/**
 * 3.4 Список товаров для выбора в документах
 * GET /api/warehouse/crud/products/
 * @param {Object} params - search (name/article/barcode), page
 */
export const listProducts = async (params = {}) => {
  try {
    const response = await api.get("warehouse/crud/products/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Products Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Получить товар по ID
 * @param {string} id - UUID товара
 */
export const getProductById = async (id) => {
  try {
    const response = await api.get(`warehouse/crud/products/${id}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Product Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Создать товар
 * @param {Object} productData - Данные товара
 */
export const createProduct = async (productData) => {
  try {
    const response = await api.post("warehouse/crud/products/", productData);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Product Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Обновить товар
 * @param {string} id - UUID товара
 * @param {Object} productData - Данные товара
 */
export const updateProduct = async (id, productData) => {
  try {
    const response = await api.put(
      `warehouse/crud/products/${id}/`,
      productData
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Update Product Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Удалить товар
 * @param {string} id - UUID товара
 */
export const deleteProduct = async (id) => {
  try {
    const response = await api.delete(`warehouse/crud/products/${id}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Delete Product Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

// ==================== СКЛАДЫ ====================

/**
 * 2.1 Склады (полный CRUD) — список с фильтрами
 * GET /api/warehouse/
 * @param {Object} params - name (icontains), status (active|inactive), created_after, created_before, branch, page
 */
export const listWarehousesFull = async (params = {}) => {
  try {
    const response = await api.get("warehouse/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Warehouses Full Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * 2.1 Детали склада (полный CRUD)
 * GET /api/warehouse/{warehouse_uuid}/
 */
export const getWarehouseByUuid = async (uuid) => {
  try {
    const response = await api.get(`warehouse/${uuid}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Warehouse By Uuid Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * 2.1 Создать склад
 * POST /api/warehouse/
 */
export const createWarehouseFull = async (payload) => {
  try {
    const response = await api.post("warehouse/", payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Warehouse Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * 2.1 Обновить склад
 * PATCH/PUT /api/warehouse/{warehouse_uuid}/
 */
export const updateWarehouseFull = async (uuid, payload) => {
  try {
    const response = await api.patch(`warehouse/${uuid}/`, payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Update Warehouse Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * 2.1 Удалить склад
 * DELETE /api/warehouse/{warehouse_uuid}/
 */
export const deleteWarehouseFull = async (uuid) => {
  try {
    const response = await api.delete(`warehouse/${uuid}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Delete Warehouse Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * 3.5 Простой список складов (для селектов)
 * GET /api/warehouse/crud/warehouses/
 * @param {Object} params - branch, page
 */
export const listWarehouses = async (params = {}) => {
  try {
    const response = await api.get("warehouse/crud/warehouses/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Warehouses Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Получить склад по ID (crud, для селектов)
 * GET /api/warehouse/crud/warehouses/{id}/
 */
export const getWarehouseById = async (id) => {
  try {
    const response = await api.get(`warehouse/crud/warehouses/${id}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Warehouse Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

// ==================== АГЕНТЫ: ЗАЯВКИ (CARTS) ====================

/**
 * 6.1 Заявки агента на товар
 * GET /api/warehouse/agent-carts/
 */
export const listAgentCarts = async (params = {}) => {
  try {
    const response = await api.get("warehouse/agent-carts/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Agent Carts Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * POST /api/warehouse/agent-carts/
 */
export const createAgentCart = async (payload) => {
  try {
    const response = await api.post("warehouse/agent-carts/", payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Agent Cart Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * GET /api/warehouse/agent-carts/{id}/
 */
export const getAgentCartById = async (id) => {
  try {
    const response = await api.get(`warehouse/agent-carts/${id}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Agent Cart Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * PUT /api/warehouse/agent-carts/{id}/
 */
export const updateAgentCart = async (id, payload) => {
  try {
    const response = await api.put(`warehouse/agent-carts/${id}/`, payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Update Agent Cart Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * PATCH /api/warehouse/agent-carts/{id}/
 */
export const patchAgentCart = async (id, payload) => {
  try {
    const response = await api.patch(`warehouse/agent-carts/${id}/`, payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Patch Agent Cart Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * DELETE /api/warehouse/agent-carts/{id}/
 */
export const deleteAgentCart = async (id) => {
  try {
    const response = await api.delete(`warehouse/agent-carts/${id}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Delete Agent Cart Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * POST /api/warehouse/agent-carts/{id}/submit/
 */
export const submitAgentCart = async (id) => {
  try {
    const response = await api.post(`warehouse/agent-carts/${id}/submit/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Submit Agent Cart Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * POST /api/warehouse/agent-carts/{id}/approve/
 */
export const approveAgentCart = async (id) => {
  try {
    const response = await api.post(`warehouse/agent-carts/${id}/approve/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Approve Agent Cart Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * POST /api/warehouse/agent-carts/{id}/reject/
 */
export const rejectAgentCart = async (id) => {
  try {
    const response = await api.post(`warehouse/agent-carts/${id}/reject/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Reject Agent Cart Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

// ==================== АГЕНТЫ: ПОЗИЦИИ ЗАЯВКИ (ITEMS) ====================

/**
 * 6.2 Позиции заявки
 * GET /api/warehouse/agent-cart-items/?cart={uuid}
 */
export const listAgentCartItems = async (params = {}) => {
  try {
    const response = await api.get("warehouse/agent-cart-items/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Agent Cart Items Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * POST /api/warehouse/agent-cart-items/
 */
export const createAgentCartItem = async (payload) => {
  try {
    const response = await api.post("warehouse/agent-cart-items/", payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Agent Cart Item Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * GET /api/warehouse/agent-cart-items/{id}/
 */
export const getAgentCartItemById = async (id) => {
  try {
    const response = await api.get(`warehouse/agent-cart-items/${id}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Agent Cart Item Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * PUT /api/warehouse/agent-cart-items/{id}/
 */
export const updateAgentCartItem = async (id, payload) => {
  try {
    const response = await api.put(`warehouse/agent-cart-items/${id}/`, payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Update Agent Cart Item Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * PATCH /api/warehouse/agent-cart-items/{id}/
 */
export const patchAgentCartItem = async (id, payload) => {
  try {
    const response = await api.patch(
      `warehouse/agent-cart-items/${id}/`,
      payload
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Patch Agent Cart Item Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * DELETE /api/warehouse/agent-cart-items/{id}/
 */
export const deleteAgentCartItem = async (id) => {
  try {
    const response = await api.delete(`warehouse/agent-cart-items/${id}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Delete Agent Cart Item Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

// ==================== АГЕНТЫ: ОСТАТКИ ====================

// ==================== ДОКУМЕНТЫ АГЕНТА (4.2.1) ====================

/**
 * Документы агента (по своим товарам). Для агента нельзя TRANSFER и INVENTORY.
 * GET /api/warehouse/agent/documents/
 * @param {Object} params - doc_type, status, search, page
 */
export const listAgentDocuments = async (params = {}) => {
  try {
    const response = await api.get("warehouse/agent/documents/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Agent Documents Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const getAgentDocumentById = async (id) => {
  try {
    const response = await api.get(`warehouse/agent/documents/${id}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Agent Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const createAgentDocument = async (payload) => {
  try {
    const response = await api.post("warehouse/agent/documents/", payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Agent Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const updateAgentDocument = async (id, payload) => {
  try {
    const response = await api.patch(
      `warehouse/agent/documents/${id}/`,
      payload
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Update Agent Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const deleteAgentDocument = async (id) => {
  try {
    const response = await api.delete(`warehouse/agent/documents/${id}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Delete Agent Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

// ==================== АГЕНТЫ: ОСТАТКИ ====================

/**
 * 6.3 Остатки у агента (текущий пользователь)
 * GET /api/warehouse/agents/me/products/
 */
export const listMyAgentProducts = async (params = {}) => {
  try {
    const response = await api.get("warehouse/agents/me/products/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List My Agent Products Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Остатки у всех агентов (для owner/admin)
 * GET /api/warehouse/owner/agents/products/
 */
export const listOwnerAgentsProducts = async (params = {}) => {
  try {
    const response = await api.get("warehouse/owner/agents/products/", {
      params,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Owner Agents Products Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

// ==================== КОНТРАГЕНТЫ (CRUD) ====================

/**
 * 2.4 Контрагенты
 * GET /api/warehouse/crud/counterparties/
 * @param {Object} params - search, type (CLIENT|SUPPLIER|BOTH), page, branch
 */
export const listCounterparties = async (params = {}) => {
  try {
    const response = await api.get("warehouse/crud/counterparties/", {
      params,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Counterparties Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Получить контрагента по ID
 * @param {string} id - UUID контрагента
 */
export const getCounterpartyById = async (id) => {
  try {
    const response = await api.get(`warehouse/crud/counterparties/${id}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Counterparty Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Создать контрагента
 * @param {Object} counterpartyData - Данные контрагента
 */
export const createCounterparty = async (counterpartyData) => {
  try {
    const response = await api.post(
      "warehouse/crud/counterparties/",
      counterpartyData
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Counterparty Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Обновить контрагента
 * @param {string} id - UUID контрагента
 * @param {Object} counterpartyData - Данные контрагента
 */
export const updateCounterparty = async (id, counterpartyData) => {
  try {
    const response = await api.put(
      `warehouse/crud/counterparties/${id}/`,
      counterpartyData
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Update Counterparty Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Удалить контрагента
 * @param {string} id - UUID контрагента
 */
export const deleteCounterparty = async (id) => {
  try {
    const response = await api.delete(`warehouse/crud/counterparties/${id}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Delete Counterparty Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Получить долги контрагента
 * @param {string} id - UUID контрагента
 * @returns {{ results: Array, total_debt: number }}
 */
export const getCounterpartyDebts = async (id) => {
  try {
    const response = await api.get(
      `warehouse/crud/counterparties/${id}/debts/`
    );
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return { results: [], total_debt: 0 };
    }
    if (error.response) {
      console.error("Get Counterparty Debts Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Получить историю оплат контрагента
 * @param {string} id - UUID контрагента
 * @returns {{ results: Array }}
 */
export const getCounterpartyPayments = async (id) => {
  try {
    const response = await api.get(
      `warehouse/crud/counterparties/${id}/payments/`
    );
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return { results: [] };
    }
    if (error.response) {
      console.error("Get Counterparty Payments Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

// ==================== КАССА (CASH REGISTER) 5.0 ====================

/**
 * Список касс
 * GET /api/warehouse/cash-registers/
 */
export const listCashRegisters = async (params = {}) => {
  try {
    const response = await api.get("warehouse/cash-registers/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Cash Registers Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Детали кассы
 * GET /api/warehouse/cash-registers/{id}/
 */
export const getCashRegister = async (id) => {
  try {
    const response = await api.get(`warehouse/cash-registers/${id}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Cash Register Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Создать кассу
 * POST /api/warehouse/cash-registers/
 * @param {Object} payload - { name, location? }
 */
export const createCashRegister = async (payload) => {
  try {
    const response = await api.post("warehouse/cash-registers/", payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Cash Register Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Обновить кассу
 * PATCH/PUT /api/warehouse/cash-registers/{id}/
 */
export const updateCashRegister = async (id, payload) => {
  try {
    const response = await api.patch(
      `warehouse/cash-registers/${id}/`,
      payload
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Update Cash Register Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Удалить кассу
 * DELETE /api/warehouse/cash-registers/{id}/
 */
export const deleteCashRegister = async (id) => {
  try {
    const response = await api.delete(`warehouse/cash-registers/${id}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Delete Cash Register Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Касса с балансом, приходами и расходами
 * GET /api/warehouse/cash-registers/{id}/operations/
 * @returns {{ id, name, balance, receipts_total, expenses_total, receipts[], expenses[] }}
 */
export const getCashRegisterOperations = async (id) => {
  try {
    const response = await api.get(
      `warehouse/cash-registers/${id}/operations/`
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(
        "Get Cash Register Operations Error:",
        error.response.data
      );
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

// ==================== ДЕНЕЖНЫЕ ДОКУМЕНТЫ (ПРИХОД/РАСХОД) ====================

/**
 * 5.1 Категории платежей
 * GET/POST /api/warehouse/money/categories/
 * @param {Object} params - search (по title), branch, page
 */
export const listMoneyCategories = async (params = {}) => {
  try {
    const response = await api.get("warehouse/money/categories/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Money Categories Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const getMoneyCategoryById = async (id) => {
  try {
    const response = await api.get(`warehouse/money/categories/${id}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Money Category Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const createMoneyCategory = async (payload) => {
  try {
    const response = await api.post("warehouse/money/categories/", payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Money Category Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const updateMoneyCategory = async (id, payload) => {
  try {
    const response = await api.put(
      `warehouse/money/categories/${id}/`,
      payload
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Update Money Category Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const patchMoneyCategory = async (id, payload) => {
  try {
    const response = await api.patch(
      `warehouse/money/categories/${id}/`,
      payload
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Patch Money Category Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const deleteMoneyCategory = async (id) => {
  try {
    const response = await api.delete(`warehouse/money/categories/${id}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Delete Money Category Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * 5.2 Денежные документы (приход MONEY_RECEIPT / расход MONEY_EXPENSE)
 * Статусы: DRAFT | POSTED
 */
export const listMoneyDocuments = async (params = {}) => {
  try {
    const response = await api.get("warehouse/money/documents/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("List Money Documents Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const getMoneyDocumentById = async (id) => {
  try {
    const response = await api.get(`warehouse/money/documents/${id}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Money Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const createMoneyDocument = async (payload) => {
  try {
    const response = await api.post("warehouse/money/documents/", payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Money Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const updateMoneyDocument = async (id, payload) => {
  try {
    const response = await api.put(`warehouse/money/documents/${id}/`, payload);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Update Money Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const patchMoneyDocument = async (id, payload) => {
  try {
    const response = await api.patch(
      `warehouse/money/documents/${id}/`,
      payload
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Patch Money Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const deleteMoneyDocument = async (id) => {
  try {
    const response = await api.delete(`warehouse/money/documents/${id}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Delete Money Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const postMoneyDocument = async (id) => {
  try {
    const response = await api.post(`warehouse/money/documents/${id}/post/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Post Money Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export const unpostMoneyDocument = async (id) => {
  try {
    const response = await api.post(`warehouse/money/documents/${id}/unpost/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Unpost Money Document Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * 5.3 Денежные операции по контрагенту
 * GET /api/warehouse/money/counterparties/{counterparty_id}/operations/
 * Фильтры: doc_type, status, warehouse, payment_category. Поиск: search (по number, comment)
 */
export const getCounterpartyMoneyOperations = async (
  counterpartyId,
  params = {}
) => {
  try {
    const response = await api.get(
      `warehouse/money/counterparties/${counterpartyId}/operations/`,
      { params }
    );
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return { results: [] };
    }
    if (error.response) {
      console.error(
        "Get Counterparty Money Operations Error:",
        error.response.data
      );
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Акт сверки с контрагентом (JSON)
 * GET /api/warehouse/counterparties/{counterparty_id}/reconciliation/json/
 * @param {string} counterpartyId - UUID контрагента
 * @param {Object} params - start (YYYY-MM-DD), end (YYYY-MM-DD), currency?, branch?
 */
export const getReconciliationJson = async (counterpartyId, params = {}) => {
  try {
    const response = await api.get(
      `warehouse/counterparties/${counterpartyId}/reconciliation/json/`,
      { params }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Reconciliation JSON Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * Акт сверки с контрагентом (PDF с сервера)
 * GET /api/warehouse/counterparties/{counterparty_id}/reconciliation/
 * @param {string} counterpartyId - UUID контрагента
 * @param {Object} params - start, end, currency?, branch?
 * @returns {Promise<Blob>}
 */
export const getReconciliationPdf = async (counterpartyId, params = {}) => {
  try {
    const response = await api.get(
      `warehouse/counterparties/${counterpartyId}/reconciliation/`,
      { params, responseType: "blob" }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Reconciliation PDF Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

// ==================== АНАЛИТИКА СКЛАДА ====================

/**
 * 7.1 Аналитика владельца (общая)
 * GET /api/warehouse/owner/analytics/
 * @param {Object} params - period=day|week|month|custom, date, date_from, date_to
 */
export const getOwnerAnalytics = async (params = {}) => {
  try {
    const response = await api.get("warehouse/owner/analytics/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Owner Analytics Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * 7.2 Аналитика агента (по себе)
 * GET /api/warehouse/agents/me/analytics/
 */
export const getAgentMeAnalytics = async (params = {}) => {
  try {
    const response = await api.get("warehouse/agents/me/analytics/", {
      params,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Agent Me Analytics Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

/**
 * 7.3 Аналитика по конкретному агенту
 * GET /api/warehouse/owner/agents/{agent_id}/analytics/
 */
export const getOwnerAgentAnalytics = async (agentId, params = {}) => {
  try {
    const response = await api.get(
      `warehouse/owner/agents/${agentId}/analytics/`,
      { params }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Owner Agent Analytics Error:", error.response.data);
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
};

export default {
  // Документы
  listDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  patchDocument,
  deleteDocument,
  postDocument,
  unpostDocument,
  // Типовые списки документов
  listSaleDocuments,
  createSaleDocument,
  listPurchaseDocuments,
  createPurchaseDocument,
  listSaleReturnDocuments,
  createSaleReturnDocument,
  listPurchaseReturnDocuments,
  createPurchaseReturnDocument,
  listInventoryDocuments,
  createInventoryDocument,
  listReceiptDocuments,
  createReceiptDocument,
  listWriteOffDocuments,
  createWriteOffDocument,
  listTransferDocuments,
  createTransferDocument,
  transferWarehouse,
  // Документы агента (4.2.1)
  listAgentDocuments,
  getAgentDocumentById,
  createAgentDocument,
  updateAgentDocument,
  deleteAgentDocument,
  // Склады: полный CRUD (2.1)
  listWarehousesFull,
  getWarehouseByUuid,
  createWarehouseFull,
  updateWarehouseFull,
  deleteWarehouseFull,
  // Склады: простой CRUD для селектов
  listWarehouses,
  getWarehouseById,
  // Бренды (2.2)
  listBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
  // Категории (2.3)
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  // Товары: основной API (3.1)
  listWarehouseProducts,
  createProductInWarehouse,
  getProductByUuid,
  updateProductByUuid,
  deleteProductByUuid,
  // Фото товара (3.2)
  listProductImages,
  createProductImage,
  getProductImage,
  updateProductImage,
  deleteProductImage,
  // Упаковки товара (3.3)
  listProductPackages,
  createProductPackage,
  getProductPackage,
  updateProductPackage,
  deleteProductPackage,
  // Товары: простой CRUD для документов (3.4)
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  // Агенты: заявки и остатки
  listAgentCarts,
  createAgentCart,
  getAgentCartById,
  updateAgentCart,
  patchAgentCart,
  deleteAgentCart,
  submitAgentCart,
  approveAgentCart,
  rejectAgentCart,
  listAgentCartItems,
  createAgentCartItem,
  getAgentCartItemById,
  updateAgentCartItem,
  patchAgentCartItem,
  deleteAgentCartItem,
  listMyAgentProducts,
  listOwnerAgentsProducts,
  // Аналитика склада
  getOwnerAnalytics,
  getAgentMeAnalytics,
  getOwnerAgentAnalytics,
  // Контрагенты (2.4)
  listCounterparties,
  getCounterpartyById,
  createCounterparty,
  updateCounterparty,
  deleteCounterparty,
  getCounterpartyDebts,
  getCounterpartyPayments,
  // Денежные документы (приход/расход)
  listMoneyCategories,
  getMoneyCategoryById,
  createMoneyCategory,
  updateMoneyCategory,
  patchMoneyCategory,
  deleteMoneyCategory,
  listMoneyDocuments,
  getMoneyDocumentById,
  createMoneyDocument,
  updateMoneyDocument,
  patchMoneyDocument,
  deleteMoneyDocument,
  postMoneyDocument,
  unpostMoneyDocument,
  getCounterpartyMoneyOperations,
  getReconciliationJson,
  getReconciliationPdf,
  // Касса (5.0)
  listCashRegisters,
  getCashRegister,
  createCashRegister,
  updateCashRegister,
  deleteCashRegister,
  getCashRegisterOperations,
  // Скан штрихкода (3.1.1)
  scanProduct,
  // Группы товаров склада (2.3.1)
  listWarehouseGroups,
  getWarehouseGroup,
  createWarehouseGroup,
  updateWarehouseGroup,
  deleteWarehouseGroup,
};
