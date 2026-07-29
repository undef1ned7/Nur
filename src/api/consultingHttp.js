/**
 * Консалтинг: общий HTTP-слой сектора.
 *
 * Все модули сектора (`consulting*.js`) ходят через него, чтобы:
 *  - ошибка всегда приходила в одном формате `{ ...body, status }` —
 *    на этом построена обработка «эндпоинт ещё не готов» (404/501) в UI;
 *  - список всегда можно было запросить с `params` и с `signal`
 *    (отмена устаревших запросов в useConsultingList).
 */
import api from ".";

export const BASE = "/consalting";

/** Нормализует ошибку axios в плоский объект с полем `status`. */
export const toApiError = (label) => (error) => {
  if (error?.name === "CanceledError" || error?.name === "AbortError") {
    return Promise.reject(error);
  }
  if (error?.response) {
    if (import.meta.env?.DEV) {
      console.error(`${label}:`, error.response.data);
    }
    const data = error.response.data;
    const payload =
      data && typeof data === "object" ? { ...data } : { detail: data };
    payload.status = error.response.status;
    return Promise.reject(payload);
  }
  return Promise.reject(error);
};

const request = async (label, method, url, { params, data, signal } = {}) => {
  try {
    const res = await api.request({ method, url, params, data, signal });
    return res.data;
  } catch (error) {
    return toApiError(label)(error);
  }
};

export const cGet = (label, url, params, config = {}) =>
  request(label, "get", url, { params, signal: config.signal });

export const cPost = (label, url, data, config = {}) =>
  request(label, "post", url, { data, signal: config.signal });

export const cPatch = (label, url, data, config = {}) =>
  request(label, "patch", url, { data, signal: config.signal });

export const cPut = (label, url, data, config = {}) =>
  request(label, "put", url, { data, signal: config.signal });

export const cDelete = (label, url, config = {}) =>
  request(label, "delete", url, { signal: config.signal });
