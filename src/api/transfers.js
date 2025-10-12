import api from "./index";

// ===================================================================
//                          MANUFACTURE SUBREALS (TRANSFERS)
// ===================================================================

export const fetchTransfersApi = async (params = {}) => {
  try {
    const response = await api.get("main/subreals/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Fetch Transfers Error Data:", error.response.data);
      console.error("Fetch Transfers Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};

export const createTransferApi = async (transferData) => {
  try {
    const response = await api.post("main/subreals/", transferData);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Transfer Error Data:", error.response.data);
      console.error("Create Transfer Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};

// Bulk transfer API
export const createBulkTransferApi = async (bulkTransferData) => {
  try {
    const response = await api.post("main/subreals/bulk/", bulkTransferData);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Bulk Transfer Error Data:", error.response.data);
      console.error(
        "Create Bulk Transfer Error Status:",
        error.response.status
      );
      return Promise.reject(error.response.data);
    }
  }
};

export const getTransferApi = async (transferId) => {
  try {
    const response = await api.get(`main/subreals/${transferId}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Transfer Error Data:", error.response.data);
      console.error("Get Transfer Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};

export const updateTransferApi = async (transferId, updateData) => {
  try {
    const response = await api.patch(
      `main/subreals/${transferId}/`,
      updateData
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Update Transfer Error Data:", error.response.data);
      console.error("Update Transfer Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};

// Update product quantity
export const updateProductQuantityApi = async (productId, quantityData) => {
  try {
    const response = await api.patch(
      `main/products/${productId}/`,
      quantityData
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Update Product Quantity Error Data:", error.response.data);
      console.error(
        "Update Product Quantity Error Status:",
        error.response.status
      );
      return Promise.reject(error.response.data);
    }
  }
};

export const deleteTransferApi = async (transferId) => {
  try {
    await api.delete(`main/subreals/${transferId}/`);
  } catch (error) {
    if (error.response) {
      console.error("Delete Transfer Error Data:", error.response.data);
      console.error("Delete Transfer Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};

// ===================================================================
//                              ACCEPTANCES
// ===================================================================

export const fetchAcceptancesApi = async (params = {}) => {
  try {
    const response = await api.get("main/acceptances/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Fetch Acceptances Error Data:", error.response.data);
      console.error("Fetch Acceptances Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};

export const createAcceptanceApi = async (acceptanceData) => {
  try {
    const response = await api.post("main/acceptances/", acceptanceData);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Acceptance Error Data:", error.response.data);
      console.error("Create Acceptance Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};

export const getAcceptanceApi = async (acceptanceId) => {
  try {
    const response = await api.get(`main/acceptances/${acceptanceId}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Acceptance Error Data:", error.response.data);
      console.error("Get Acceptance Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};

export const updateAcceptanceApi = async (acceptanceId, acceptanceData) => {
  try {
    const response = await api.patch(
      `main/acceptances/${acceptanceId}/`,
      acceptanceData
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Update Acceptance Error Data:", error.response.data);
      console.error("Update Acceptance Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};

export const deleteAcceptanceApi = async (acceptanceId) => {
  try {
    await api.delete(`main/acceptances/${acceptanceId}/`);
  } catch (error) {
    if (error.response) {
      console.error("Delete Acceptance Error Data:", error.response.data);
      console.error("Delete Acceptance Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};

// ===================================================================
//                          INLINE ACCEPT
// ===================================================================

export const acceptInlineApi = async (acceptData) => {
  try {
    const response = await api.post("main/accept/", acceptData);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Inline Accept Error Data:", error.response.data);
      console.error("Inline Accept Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};

// ===================================================================
//                              RETURNS
// ===================================================================

export const fetchReturnsApi = async (params = {}) => {
  try {
    const response = await api.get("main/returns/", { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Fetch Returns Error Data:", error.response.data);
      console.error("Fetch Returns Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};

export const createReturnApi = async (returnData) => {
  try {
    const response = await api.post("main/returns/", returnData);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Return Error Data:", error.response.data);
      console.error("Create Return Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};

export const getReturnApi = async (returnId) => {
  try {
    const response = await api.get(`main/returns/${returnId}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Get Return Error Data:", error.response.data);
      console.error("Get Return Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};

export const approveReturnApi = async (returnId) => {
  try {
    const response = await api.post(`main/returns/${returnId}/approve/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Approve Return Error Data:", error.response.data);
      console.error("Approve Return Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};
