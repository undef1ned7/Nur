import {
  ALLOWED_PATHS_WITHOUT_TOKEN,
  PUBLIC_PATHS_WITH_REDIRECT,
} from "../constants/routes";

/**
 * Проверяет, является ли путь разрешенным без токена
 * @param {string} path - Путь для проверки
 * @returns {boolean}
 */
export const isAllowedPathWithoutToken = (path) => {
  return ALLOWED_PATHS_WITHOUT_TOKEN.some(
    (allowedPath) =>
      path === allowedPath || path.startsWith("/submit-application")
  );
};

/**
 * Проверяет, нужно ли редиректить с публичной страницы на /crm
 * @param {string} path - Текущий путь
 * @returns {boolean}
 */
export const shouldRedirectToCrm = (path) => {
  return PUBLIC_PATHS_WITH_REDIRECT.includes(path);
};

/**
 * Очищает токены из localStorage
 */
export const clearTokens = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
};
