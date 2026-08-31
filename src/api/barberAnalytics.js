import api from "./index";

/**
 * Единая точка загрузки страницы «Аналитика» сектора Услуги.
 * @param {{ dateFrom: string, dateTo: string, signal?: AbortSignal }} params
 * @returns {Promise<object>}
 */
export async function fetchBarberAnalyticsDashboard({
  dateFrom,
  dateTo,
  signal,
}) {
  const { data } = await api.get("/barbershop/analytics/dashboard/", {
    params: {
      date_from: dateFrom,
      date_to: dateTo,
    },
    signal,
  });
  return data;
}
