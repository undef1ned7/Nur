/**
 * Axios response interceptor: attach Bearer token on 401 via refresh endpoint.
 * Extracted for unit testing; wired from src/api/index.js.
 */
export function createAuthResponseInterceptor(api, axiosLib) {
  let isRefreshing = false;
  let failedQueue = [];

  const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve(token);
      }
    });
    failedQueue = [];
  };

  return async (err) => {
    const originalRequest = err.config;
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");

    if (
      err.response?.status === 401 &&
      !originalRequest._retry &&
      accessToken &&
      !originalRequest?.url?.includes("/users/auth/refresh/")
    ) {
      if (!refreshToken) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
        return Promise.reject(err);
      }

      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers["Authorization"] = "Bearer " + token;
            return axiosLib(originalRequest);
          })
          .catch((queueErr) => {
            return Promise.reject(queueErr);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await api.post("/users/auth/refresh/", {
          refresh: refreshToken,
        });

        const newAccessToken = response.data.access;
        localStorage.setItem("accessToken", newAccessToken);

        api.defaults.headers.common["Authorization"] =
          "Bearer " + newAccessToken;
        originalRequest.headers["Authorization"] = "Bearer " + newAccessToken;

        processQueue(null, newAccessToken);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);

        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  };
}
