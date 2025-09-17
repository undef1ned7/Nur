import api from "./index";

export const fetchOrdersApi = async (params = {}) => {
  try {
    // console.log('sraer');

    const response = await api.get("/main/orders/");
    // console.log(response, 'response from fetchOrdersApi');

    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Fetch Orders Error Data:", error.response.data);
      console.error("Fetch Orders Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};

export const fetchOrderByIdApi = async (orderId) => {
  try {
    const response = await api.get(`/main/orders/${orderId}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(
        `Fetch Order (ID: ${orderId}) Error Data:`,
        error.response.data
      );
      return Promise.reject(error.response.data);
    } else {
      return Promise.reject({
        message: error.message || `Failed to fetch order ${orderId}`,
      });
    }
  }
};

export const createOrderApi = async (orderData) => {
  try {
    const response = await api.post("/main/orders/", orderData);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Order Error Data:", error.response.data);
      console.error("Create Order Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};

export const deleteOrderApi = async (orderId) => {
  try {
    const response = await api.delete(`/main/orders/${orderId}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(
        `Delete Order (ID: ${orderId}) Error Data:`,
        error.response.data
      );
      console.error(
        `Delete Order (ID: ${orderId}) Error Status:`,
        error.response.status
      );
      return Promise.reject(error.response.data);
    }
  }
};

export const updateOrderApi = async (orderId, orderData) => {
  try {
    const response = await api.patch(`/main/orders/${orderId}/`, orderData);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(
        `Update Order (ID: ${orderId}) Error Data:`,
        error.response.data
      );
      console.error(
        `Update Order (ID: ${orderId}) Error Status:`,
        error.response.status
      );
      return Promise.reject(error.response.data);
    }
  }
};
