/**
 * Консалтинг: аналитика (дашборд, мессенджер, источники, менеджеры).
 *
 * Контракт: docs/consulting/analytics.md
 * GET /consalting/analytics/dashboard|messenger|sources|managers/
 */
import api from ".";

const BASE = "/consalting/analytics";

const reject = (label) => (error) => {
  if (error.response) {
    console.error(`${label}:`, error.response.data);
    const data = error.response.data;
    const payload =
      data && typeof data === "object" ? { ...data } : { detail: data };
    payload.status = error.response.status;
    return Promise.reject(payload);
  }
  return Promise.reject(error);
};

/** Параметры периода: date_from/date_to (+ алиасы period_start/period_end). */
export const analyticsPeriodParams = ({
  date_from,
  date_to,
  branch,
  owner,
} = {}) => {
  const params = {};
  if (date_from) {
    params.date_from = date_from;
    params.period_start = date_from;
  }
  if (date_to) {
    params.date_to = date_to;
    params.period_end = date_to;
  }
  if (branch) params.branch = branch;
  if (owner) params.owner = owner;
  return params;
};

/**
 * Главный дашборд: KPI с динамикой + срезы.
 * GET /consalting/analytics/dashboard/
 */
export const getAnalyticsDashboard = async (params = {}) => {
  try {
    const { data } = await api.get(`${BASE}/dashboard/`, {
      params: analyticsPeriodParams(params),
    });
    return data;
  } catch (error) {
    return reject("Analytics Dashboard Error")(error);
  }
};

/**
 * Мессенджер: скорость ответа, объём, неотвеченные, waiting_now.
 * GET /consalting/analytics/messenger/
 * @param {Object} params - date_from, date_to, branch, owner
 */
export const getAnalyticsMessenger = async (params = {}) => {
  try {
    const { data } = await api.get(`${BASE}/messenger/`, {
      params: analyticsPeriodParams(params),
    });
    return data;
  } catch (error) {
    return reject("Analytics Messenger Error")(error);
  }
};

/**
 * Источники заявок и конверсия.
 * GET /consalting/analytics/sources/
 */
export const getAnalyticsSources = async (params = {}) => {
  try {
    const { data } = await api.get(`${BASE}/sources/`, {
      params: analyticsPeriodParams(params),
    });
    return data;
  } catch (error) {
    return reject("Analytics Sources Error")(error);
  }
};

/**
 * Нагрузка и результативность менеджеров.
 * GET /consalting/analytics/managers/
 */
export const getAnalyticsManagers = async (params = {}) => {
  try {
    const { data } = await api.get(`${BASE}/managers/`, {
      params: analyticsPeriodParams(params),
    });
    return data;
  } catch (error) {
    return reject("Analytics Managers Error")(error);
  }
};

/**
 * Продажи (legacy).
 * GET /consalting/analytics/
 */
export const getAnalyticsSales = async (params = {}) => {
  try {
    const { data } = await api.get(`${BASE}/`, {
      params: analyticsPeriodParams(params),
    });
    return data;
  } catch (error) {
    return reject("Analytics Sales Error")(error);
  }
};
