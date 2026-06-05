// Разрешенные пути без токена (публичные страницы)
export const ALLOWED_PATHS_WITHOUT_TOKEN = [
  "/crm/logout",
  "/login",
  "/register",
  "/register-access/settings",
  "/",
  "/old-landing",
  "/submit-application",
  "/get-application-list",
  // Public pages
  "/cafe/:company_slug/menu",
  "/catalog/:slug",
  "/production/:slug",
  "/barber/:company_slug/booking",
  "/video-lessons",
  "/video-lessons/admin",
  "/video-lessons/:lessonId",
];

// Публичные пути, на которые нужно редиректить если токен валиден
export const PUBLIC_PATHS_WITH_REDIRECT = ["/login", "/register", "/"];

// Путь для редиректа после успешной аутентификации
export const DEFAULT_AUTHENTICATED_PATH = "/crm";

// Путь для редиректа при отсутствии токена
export const DEFAULT_UNAUTHENTICATED_PATH = "/login";
