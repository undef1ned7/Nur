import axios from "axios";
import { createAuthResponseInterceptor } from "./authInterceptors";

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
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (res) => res,
  createAuthResponseInterceptor(api, axios),
);

export default api;
