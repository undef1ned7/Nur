/**
 * Консалтинг: Абонентская матрица клиентов.
 *
 * Возвращает таблицу «ФИО × услуга × месяцы»: по строке на каждую купленную
 * клиентом услугу (один клиент с несколькими услугами = несколько строк), по
 * колонке на каждый месяц периода, в ячейке — абонентский платёж и его статус.
 * Бэкенд ещё не реализован — спецификация: docs/consulting/subscription-matrix.md
 */
import api from ".";

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

/**
 * Абонентская матрица за период.
 * GET /consalting/subscription-matrix/?month_from=YYYY-MM&month_to=YYYY-MM
 * @param {Object} params - { month_from, month_to, search }
 * @returns {{ months: string[], rows: Array<{
 *   client_id, client_name, service_id, service_name,
 *   subscription_amount, subscription_period,
 *   cells: { [month: string]: { amount, status } }
 * }> }}
 */
export const getSubscriptionMatrix = async (params = {}) => {
  try {
    const { data } = await api.get("/consalting/subscription-matrix/", {
      params,
    });
    return data;
  } catch (error) {
    return reject("Get Subscription Matrix Error")(error);
  }
};
