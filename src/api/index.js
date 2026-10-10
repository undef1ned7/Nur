import axios from "axios";
import {
  createAuthRequestInterceptor,
  createAuthResponseInterceptor,
  createTokenRefresher,
} from "./authInterceptors";
import {
  createCircuitRequestInterceptor,
  noteCircuitFailure,
} from "./circuitBreaker";
import { getOfflineFallback } from "../services/cafeOfflineFallback";
import "../i18n.js";
import "../i18n";
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://app.nurcrm.kg/api",
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// B34: у ранее залогиненных пользователей access/refresh лежат ещё и внутри
// userData — вычищаем (источник истины — ключи accessToken/refreshToken).
try {
  const raw = localStorage.getItem("userData");
  const parsed = raw ? JSON.parse(raw) : null;
  if (parsed && typeof parsed === "object" && ("access" in parsed || "refresh" in parsed)) {
    delete parsed.access;
    delete parsed.refresh;
    localStorage.setItem("userData", JSON.stringify(parsed));
  }
} catch {
  /* битый userData — не трогаем */
}

// Один общий single-flight refresh для proactive- и 401-веток.
const refreshAccessToken = createTokenRefresher(api);

// Bearer-токен читается из localStorage на каждый запрос; если access уже
// истёк по exp — сначала refresh (один на все параллельные запросы).
api.interceptors.request.use(createAuthRequestInterceptor(refreshAccessToken));

api.interceptors.request.use(
  (config) => {
    // Для multipart (FormData) дефолтный application/json ломает тело запроса
    // (сервер видит file: {} вместо бинарника). Даем браузеру/axios самой
    // выставить Content-Type с boundary.
    const isFormData =
      typeof FormData !== "undefined" &&
      (config.data instanceof FormData ||
        // fallback на случай, если экземпляр FormData не проходит instanceof
        (config.data &&
          typeof config.data.append === "function" &&
          typeof config.data.entries === "function"));

    if (isFormData) {
      if (typeof config.headers?.delete === "function") {
        config.headers.delete("Content-Type");
      } else if (config.headers) {
        delete config.headers["Content-Type"];
        delete config.headers["content-type"];
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

api.interceptors.request.use(createCircuitRequestInterceptor());

api.interceptors.response.use(
  (res) => res,
  createAuthResponseInterceptor(api, axios, refreshAccessToken),
);

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error?.response?.status) {
      noteCircuitFailure(error.config, error.response.status);
    }

    const isNetworkError =
      !error.response &&
      (error.code === "ERR_NETWORK" ||
        error.code === "ECONNABORTED" ||
        error.message === "Network Error" ||
        !navigator.onLine);

    if (isNetworkError) {
      const fallback = await getOfflineFallback(error.config);
      if (fallback !== null) {
        return {
          data: fallback,
          status: 200,
          statusText: "OK",
          headers: {},
          config: error.config,
          offline: true,
        };
      }
    }

    return Promise.reject(error);
  },
);

export default api;
