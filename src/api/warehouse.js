import api from "./index";

/**
 * API для работы со складом (warehouse module)
 * Базовый префикс: /api/warehouse/
 */

// ==================== ДОКУМЕНТЫ ====================

/**
 * Получить список документов
 * @param {Object} params - Параметры запроса
 * @param {string} params.doc_type - Тип документа (SALE, PURCHASE, TRANSFER, etc.)
 * @param {string} params.status - Статус (DRAFT, POSTED)
 * @param {string} params.warehouse_from - UUID склада-отправителя
 * @param {string} params.warehouse_to - UUID склада-получателя
 * @param {string} params.counterparty - UUID контрагента
 * @param {string} params.date_from - Дата начала периода
 * @param {string} params.date_to - Дата окончания периода
 * @param {number} params.page - Номер страницы
 * @param {string} params.search - Поисковый запрос
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
    const response = await api.patch(`warehouse/documents/${id}/`, documentData);
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
 * @param {boolean} options.allow_negative - Разрешить проведение при недостаточном количестве товара
 */
export const postDocument = async (id, options = {}) => {
  try {
    const body = {};
    if (options.allow_negative !== undefined) {
      body.allow_negative = options.allow_negative;
    }
    const response = await api.post(`warehouse/documents/${id}/post/`, Object.keys(body).length > 0 ? body : undefined);
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
    const response = await api.post("warehouse/documents/sale-return/", payload);
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

// ==================== ТОВАРЫ (CRUD) ====================

/**
 * Получить список товаров
 * @param {Object} params - Параметры запроса
 * @param {string} params.search - Поиск по name/article/barcode
 * @param {number} params.page - Номер страницы
 * @param {number} params.page_size - Размер страницы
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
    const response = await api.put(`warehouse/crud/products/${id}/`, productData);
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

// ==================== СКЛАДЫ (CRUD) ====================

/**
 * Получить список складов
 * @param {Object} params - Параметры запроса
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
 * Получить склад по ID
 * @param {string} id - UUID склада
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

// ==================== КОНТРАГЕНТЫ (CRUD) ====================

/**
 * Получить список контрагентов
 * @param {Object} params - Параметры запроса
 * @param {string} params.search - Поисковый запрос
 * @param {string} params.type - Тип контрагента (client, supplier, etc.)
 */
export const listCounterparties = async (params = {}) => {
  try {
    const response = await api.get("warehouse/crud/counterparties/", { params });
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
    const response = await api.post("warehouse/crud/counterparties/", counterpartyData);
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
    const response = await api.put(`warehouse/crud/counterparties/${id}/`, counterpartyData);
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
    const response = await api.get(`warehouse/crud/counterparties/${id}/debts/`);
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
    const response = await api.get(`warehouse/crud/counterparties/${id}/payments/`);
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
  // Товары
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  // Склады
  listWarehouses,
  getWarehouseById,
  // Контрагенты
  listCounterparties,
  getCounterpartyById,
  createCounterparty,
  updateCounterparty,
  deleteCounterparty,
  getCounterpartyDebts,
  getCounterpartyPayments,
};


