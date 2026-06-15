import axios from "axios";
import { createAuthResponseInterceptor } from "./authInterceptors";
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

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (res) => res,
  createAuthResponseInterceptor(api, axios),
);

api.interceptors.response.use(
  (res) => res,
  async (error) => {
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
