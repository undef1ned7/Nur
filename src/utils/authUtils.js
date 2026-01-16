import {
  ALLOWED_PATHS_WITHOUT_TOKEN,
  PUBLIC_PATHS_WITH_REDIRECT,
} from "../constants/routes";

/**
 * Проверяет, является ли путь разрешенным без токена
 * @param {string} path - Путь для проверки
 * @returns {boolean}
 */

// export const isAllowedPathWithoutToken = (path) => {
//   return ALLOWED_PATHS_WITHOUT_TOKEN.some(
//     (allowedPath) =>
//       path === allowedPath || path.startsWith("/submit-application")
//   );
// };

export const isAllowedPathWithoutToken = (path) => {
  return ALLOWED_PATHS_WITHOUT_TOKEN.some((allowedPath) => {
    // Точное совпадение
    if (path === allowedPath) return true;

    // Поддержка динамических параметров (например /cafe/:company_slug/menu)
    const pathSegments = path.split("/").filter(Boolean);
    const allowedSegments = allowedPath.split("/").filter(Boolean);

    // Если длина не совпадает, это не наш маршрут
    if (pathSegments.length !== allowedSegments.length) return false;

    // Проверяем каждый сегмент
    return pathSegments.every((segment, index) => {
      const allowedSegment = allowedSegments[index];
      // Если в allowedPath динамический параметр (начинается с :), принимаем любое значение
      // Иначе требуем точное совпадение
      return allowedSegment.startsWith(":") || segment === allowedSegment;
    });
  });
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
