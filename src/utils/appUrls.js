const trimTrailingSlash = (value) => String(value || "").replace(/\/$/, "");

const isLocalhostUrl = (value) => {
  try {
    const host = new URL(value, "https://dummy.local").hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(String(value || ""));
  }
};

/**
 * Runtime-маппинг: Vite env вшивается в билд, а на stage/prod часто забывают
 * VITE_BUILDING_APP_URL → иначе уезжает на localhost.
 */
const BUILDING_APP_BY_HOST = {
  "stage.nurcrm.kg": "https://stroy.nurcrm.kg",
  "www.stage.nurcrm.kg": "https://stroy.nurcrm.kg",
  "app.nurcrm.kg": "https://stroy.nurcrm.kg",
  "www.app.nurcrm.kg": "https://stroy.nurcrm.kg",
  "nurcrm.kg": "https://stroy.nurcrm.kg",
  "www.nurcrm.kg": "https://stroy.nurcrm.kg",
};

const DEFAULT_BUILDING_APP_URL = "https://stroy.nurcrm.kg";

const BUILDING_APP_URL_STORAGE_KEY = "buildingAppUrl";

const getCurrentHostname = () =>
  typeof window !== "undefined" ? window.location.hostname : "";

const getMappedBuildingAppUrl = () => {
  const hostname = getCurrentHostname();
  return hostname ? BUILDING_APP_BY_HOST[hostname] || null : null;
};

const clearStoredBuildingAppUrl = () => {
  try {
    sessionStorage.removeItem(BUILDING_APP_URL_STORAGE_KEY);
  } catch {
    // ignore
  }
};

export const getMainAppUrl = () =>
  trimTrailingSlash(
    import.meta.env.VITE_MAIN_APP_URL || window.location.origin,
  );

export const getMainAppLoginUrl = () => `${getMainAppUrl()}/login`;

export const getMainAppCrmUrl = () => `${getMainAppUrl()}/crm`;

export const getBuildingAppUrl = () => {
  const fromEnv = trimTrailingSlash(import.meta.env.VITE_BUILDING_APP_URL);
  const mapped = getMappedBuildingAppUrl();

  // На stage/prod всегда stroy; localhost из env/сборки игнорируем
  if (mapped) {
    if (fromEnv && !isLocalhostUrl(fromEnv)) return fromEnv;
    return mapped;
  }

  if (fromEnv && !isLocalhostUrl(fromEnv)) return fromEnv;
  if (fromEnv) return fromEnv;

  return DEFAULT_BUILDING_APP_URL;
};

export const captureBuildingAppUrlFromSearch = () => {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get(BUILDING_APP_URL_STORAGE_KEY);
  if (!fromUrl) return null;

  const normalized = trimTrailingSlash(fromUrl);

  // Не сохраняем localhost, если мы уже на stage/prod
  if (getMappedBuildingAppUrl() && isLocalhostUrl(normalized)) {
    clearStoredBuildingAppUrl();
    params.delete(BUILDING_APP_URL_STORAGE_KEY);
    const search = params.toString();
    const cleanUrl =
      window.location.pathname +
      (search ? `?${search}` : "") +
      window.location.hash;
    window.history.replaceState({}, "", cleanUrl);
    return null;
  }

  try {
    sessionStorage.setItem(BUILDING_APP_URL_STORAGE_KEY, normalized);
  } catch {
    // sessionStorage may be unavailable in private mode
  }

  params.delete(BUILDING_APP_URL_STORAGE_KEY);
  const search = params.toString();
  const cleanUrl =
    window.location.pathname +
    (search ? `?${search}` : "") +
    window.location.hash;
  window.history.replaceState({}, "", cleanUrl);

  return normalized;
};

export const getResolvedBuildingAppUrl = () => {
  const mapped = getMappedBuildingAppUrl();

  try {
    const stored = sessionStorage.getItem(BUILDING_APP_URL_STORAGE_KEY);
    if (stored) {
      const normalized = trimTrailingSlash(stored);

      // Старый local building мог записать localhost в sessionStorage —
      // на stage/prod это нельзя использовать.
      if (mapped && isLocalhostUrl(normalized)) {
        clearStoredBuildingAppUrl();
        return mapped;
      }

      if (!isLocalhostUrl(normalized) || !mapped) {
        return normalized;
      }
    }
  } catch {
    // ignore
  }

  return getBuildingAppUrl();
};

export const getBuildingAppPath = (path = "/building/projects") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getResolvedBuildingAppUrl()}${normalizedPath}`;
};
