import api from ".";

export const getOrderAnalytics = async (params = {}) => {
  // console.log(params);

  const response = await api.get("/main/orders/analytics/", {
    params: params,
  });

  // console.log(response);

  return response.data;
};

export const getAgentAnalytics = async (agentId, period = "month") => {
  const endpoint = agentId
    ? `/main/owners/agents/${agentId}/analytics/`
    : `/main/agents/me/analytics/`;

  const response = await api.get(endpoint, {
    params: { period },
  });

  return response.data;
};
