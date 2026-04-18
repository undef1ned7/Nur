import api from ".";

export const getOrderAnalytics = async (params = {}) => {
  // console.log(params);

  const response = await api.get("/main/orders/analytics/", {
    params: params,
  });

  // console.log(response);

  return response.data;
};

/**
 * @param {string|undefined} agentId - UUID агента (owner) или undefined для /agents/me/
 * @param {string|object} periodOrParams - краткая строка period ИЛИ объект { period, date, date_from, date_to }
 */
export const getAgentAnalytics = async (agentId, periodOrParams = "month") => {
  const endpoint = agentId
    ? `/main/owners/agents/${agentId}/analytics/`
    : `/main/agents/me/analytics/`;

  const params =
    typeof periodOrParams === "string"
      ? { period: periodOrParams }
      : {
          period: periodOrParams.period ?? "month",
          ...(periodOrParams.date ? { date: periodOrParams.date } : {}),
          ...(periodOrParams.date_from
            ? { date_from: periodOrParams.date_from }
            : {}),
          ...(periodOrParams.date_to ? { date_to: periodOrParams.date_to } : {}),
        };

  const response = await api.get(endpoint, {
    params,
  });

  return response.data;
};

export const getProductionAnalytics = async (params = {}) => {
  const response = await api.get("/main/owners/analytics/", {
    params: params,
  });

  return response.data;
};
