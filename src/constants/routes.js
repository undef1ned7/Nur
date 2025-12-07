// Разрешенные пути без токена (публичные страницы)
export const ALLOWED_PATHS_WITHOUT_TOKEN = [
  "/login",
  "/register",
  "/",
  "/submit-application",
];

// Публичные пути, на которые нужно редиректить если токен валиден
export const PUBLIC_PATHS_WITH_REDIRECT = ["/login", "/register", "/"];

// Путь для редиректа после успешной аутентификации
export const DEFAULT_AUTHENTICATED_PATH = "/crm";

// Путь для редиректа при отсутствии токена
export const DEFAULT_UNAUTHENTICATED_PATH = "/login";
