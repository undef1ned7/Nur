import api from ".";

export const getOrderAnalytics = async (params = {}) => {
    // console.log(params);
    
  const response = await api.get("/main/orders/analytics/", {
    params: params,
  });

  // console.log(response);
  
  return response.data;
};

