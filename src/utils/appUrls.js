export const getMainAppUrl = () =>
  (import.meta.env.VITE_MAIN_APP_URL || window.location.origin).replace(
    /\/$/,
    ""
  );

export const getMainAppLoginUrl = () => `${getMainAppUrl()}/login`;

export const getMainAppCrmUrl = () => `${getMainAppUrl()}/crm`;

export const getBuildingAppUrl = () =>
  (import.meta.env.VITE_BUILDING_APP_URL || "http://localhost:3001").replace(
    /\/$/,
    ""
  );

export const getBuildingAppPath = (path = "/building/projects") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getBuildingAppUrl()}${normalizedPath}`;
};
