/**
 * Auth-перехватчики axios: proactive refresh перед запросом и refresh по 401.
 * Вынесено для unit-тестов; подключается в src/api/index.js.
 */

const REFRESH_URL = "/users/auth/refresh/";

/** Обновляем токен заранее, если до истечения осталось меньше этого запаса. */
export const ACCESS_TOKEN_EXPIRY_SKEW_MS = 30_000;

const isRefreshUrl = (url) => Boolean(url && url.includes(REFRESH_URL));

const isNetworkFailure = (error) =>
  !error?.response ||
  (typeof navigator !== "undefined" && navigator.onLine === false);

const redirectToLogin = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  window.location.href = "/login";
};

const setAuthHeader = (config, token) => {
  if (!config.headers) config.headers = {};
  if (typeof config.headers.set === "function") {
    config.headers.set("Authorization", `Bearer ${token}`);
  } else {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
};

const getAuthHeader = (config) => {
  const headers = config?.headers;
  if (!headers) return undefined;
  if (typeof headers.get === "function") return headers.get("Authorization");
  return headers["Authorization"] || headers.authorization;
};

/**
 * Достаёт exp (в мс) из JWT без проверки подписи. null — если токен не JWT
 * или exp нет.
 */
export function getJwtExpiryMs(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const payload = JSON.parse(atob(b64));
    return typeof payload?.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isAccessTokenExpiring(
  token,
  now = Date.now(),
  skewMs = ACCESS_TOKEN_EXPIRY_SKEW_MS,
) {
  const expMs = getJwtExpiryMs(token);
  if (expMs == null) return false;
  return expMs - now <= skewMs;
}

/**
 * Single-flight refresh: параллельные вызовы получают один и тот же промис,
 * по сети уходит один POST /users/auth/refresh/.
 */
export function createTokenRefresher(api) {
  let inFlight = null;

  return function refreshAccessToken() {
    if (inFlight) return inFlight;

    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      return Promise.reject(new Error("No refresh token"));
    }

    inFlight = api
      .post(REFRESH_URL, { refresh: refreshToken })
      .then((response) => {
        const newAccessToken = response.data.access;
        localStorage.setItem("accessToken", newAccessToken);
        // При ROTATE_REFRESH_TOKENS бэк вернёт новый refresh — сохраняем.
        if (response.data.refresh) {
          localStorage.setItem("refreshToken", response.data.refresh);
        }
        if (api.defaults?.headers?.common) {
          api.defaults.headers.common["Authorization"] =
            "Bearer " + newAccessToken;
        }
        return newAccessToken;
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  };
}

/**
 * Request-перехватчик: если access-токен уже истёк (или вот-вот истечёт),
 * сначала обновляем его, а потом отправляем запрос. Без этого каждое открытие
 * страницы после истечения access-токена давало GET /users/profile/ → 401 →
 * refresh → повтор.
 */
export function createAuthRequestInterceptor(refreshAccessToken) {
  return async (config) => {
    if (isRefreshUrl(config?.url)) return config;

    const token = localStorage.getItem("accessToken");
    if (!token) return config;

    if (
      isAccessTokenExpiring(token) &&
      localStorage.getItem("refreshToken") &&
      !(typeof navigator !== "undefined" && navigator.onLine === false)
    ) {
      try {
        const newToken = await refreshAccessToken();
        setAuthHeader(config, newToken);
        return config;
      } catch {
        // Сеть недоступна — отправляем как есть (сработает офлайн-fallback
        // кафе). Refresh отклонён бэком — запрос получит 401, и
        // response-перехватчик разлогинит по обычной логике.
      }
    }

    setAuthHeader(config, localStorage.getItem("accessToken") || token);
    return config;
  };
}

/**
 * Response-перехватчик: на 401 обновляем токен (single-flight) и повторяем
 * запрос.
 */
export function createAuthResponseInterceptor(
  api,
  _axiosLib,
  refreshAccessToken = createTokenRefresher(api),
) {
  return async (err) => {
    const originalRequest = err.config;
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");

    if (
      err.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      accessToken &&
      !isRefreshUrl(originalRequest.url)
    ) {
      if (!refreshToken) {
        redirectToLogin();
        return Promise.reject(err);
      }

      originalRequest._retry = true;

      // Токен уже обновил параллельный запрос — просто повторяем с новым.
      const sentAuth = getAuthHeader(originalRequest);
      if (sentAuth && sentAuth !== `Bearer ${accessToken}`) {
        setAuthHeader(originalRequest, accessToken);
        return api(originalRequest);
      }

      try {
        const newAccessToken = await refreshAccessToken();
        setAuthHeader(originalRequest, newAccessToken);
        return api(originalRequest);
      } catch (refreshErr) {
        if (isNetworkFailure(refreshErr)) {
          return Promise.reject(refreshErr);
        }
        redirectToLogin();
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(err);
  };
}
