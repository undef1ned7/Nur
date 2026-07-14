const trimTrailingSlash = (value) => String(value || "").replace(/\/$/, "");

const isLocalhostUrl = (value) => {
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
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

const LOCAL_BUILDING_APP_URL = "http://localhost:3001";

export const getMainAppUrl = () =>
  trimTrailingSlash(import.meta.env.VITE_MAIN_APP_URL || window.location.origin);

export const getMainAppLoginUrl = () => `${getMainAppUrl()}/login`;

export const getMainAppCrmUrl = () => `${getMainAppUrl()}/crm`;

const BUILDING_APP_URL_STORAGE_KEY = "buildingAppUrl";

export const getBuildingAppUrl = () => {
  const fromEnv = trimTrailingSlash(import.meta.env.VITE_BUILDING_APP_URL);
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";

  const mapped = hostname ? BUILDING_APP_BY_HOST[hostname] : null;
  if (mapped) {
    // На stage/prod localhost из .env не должен ломать редирект
    if (fromEnv && !isLocalhostUrl(fromEnv)) return fromEnv;
    return mapped;
  }

  return fromEnv || LOCAL_BUILDING_APP_URL;
};

export const captureBuildingAppUrlFromSearch = () => {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get(BUILDING_APP_URL_STORAGE_KEY);
  if (!fromUrl) return null;

  const normalized = fromUrl.replace(/\/$/, "");
  try {
    sessionStorage.setItem(BUILDING_APP_URL_STORAGE_KEY, normalized);
  } catch {
    // sessionStorage may be unavailable in private mode
  }
  return normalized;
};

export const getResolvedBuildingAppUrl = () => {
  try {
    const stored = sessionStorage.getItem(BUILDING_APP_URL_STORAGE_KEY);
    if (stored) {
      return stored.replace(/\/$/, "");
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
