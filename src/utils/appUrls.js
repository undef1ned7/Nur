export const getMainAppUrl = () =>
  (import.meta.env.VITE_MAIN_APP_URL || window.location.origin).replace(
    /\/$/,
    ""
  );

export const getMainAppLoginUrl = () => `${getMainAppUrl()}/login`;

export const getMainAppCrmUrl = () => `${getMainAppUrl()}/crm`;

const BUILDING_APP_URL_STORAGE_KEY = "buildingAppUrl";

export const getBuildingAppUrl = () =>
  (import.meta.env.VITE_BUILDING_APP_URL || "http://localhost:3001").replace(
    /\/$/,
    ""
  );

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
