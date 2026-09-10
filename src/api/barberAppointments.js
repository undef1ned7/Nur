/**
 * Записи барбершопа / услуги / стоматология.
 * Сводка дня: docs/services/appointment-day-summary.md
 */
import api from "./index";

const SUMMARY_URL = "/barbershop/appointments/summary/";

const isSummaryNotReady = (error) => {
  const status = error?.response?.status;
  return status === 404 || status === 405;
};

/**
 * GET /barbershop/appointments/summary/
 * @param {Object} params
 * @param {"day"|"deleted"} [params.scope]
 * @param {string} [params.date] YYYY-MM-DD (обязателен для scope=day)
 * @param {string} [params.barber] uuid мастера
 * @param {string} [params.status] фильтр статуса
 */
export const getAppointmentsSummary = async (params = {}) => {
  const { data } = await api.get(SUMMARY_URL, { params });
  return data;
};

/** Без throw, если эндпоинт ещё не на бэке — null для client fallback. */
export const getAppointmentsSummarySafe = async (params = {}) => {
  try {
    return await getAppointmentsSummary(params);
  } catch (error) {
    if (isSummaryNotReady(error)) return null;
    throw error;
  }
};

export default {
  getAppointmentsSummary,
  getAppointmentsSummarySafe,
};
