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
 */
export const postDocument = async (id) => {
  try {
    const response = await api.post(`warehouse/documents/${id}/post/`);
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
};


