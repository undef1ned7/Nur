import { getBuildingAppPath } from "./appUrls";

const AUTH_PARAM_ACCESS = "accessToken";
const AUTH_PARAM_REFRESH = "refreshToken";

export const buildAuthRedirectUrl = (targetUrl, tokens = {}) => {
  const url = new URL(targetUrl, window.location.origin);
  const access = tokens.access || tokens.accessToken;
  const refresh = tokens.refresh || tokens.refreshToken;

  if (access) {
    url.searchParams.set(AUTH_PARAM_ACCESS, access);
  }
  if (refresh) {
    url.searchParams.set(AUTH_PARAM_REFRESH, refresh);
  }

  return url.toString();
};

export const getStoredAuthTokens = () => ({
  access: localStorage.getItem("accessToken"),
  refresh: localStorage.getItem("refreshToken"),
});

export const resolveBuildingAppPath = (currentPath) => {
  if (currentPath.startsWith("/crm/building")) {
    return currentPath.replace(/^\/crm/, "");
  }
  return "/building/projects";
};

export const redirectToBuildingApp = (currentPath = "/building/projects") => {
  const targetPath = resolveBuildingAppPath(currentPath);
  window.location.href = buildAuthRedirectUrl(
    getBuildingAppPath(targetPath),
    {
      ...getStoredAuthTokens(),
      sector: "building",
    }
  );
};

export const shouldSkipBuildingRedirect = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("skipBuildingRedirect") === "1";
};

export const clearSkipBuildingRedirectParam = () => {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("skipBuildingRedirect")) return;

  params.delete("skipBuildingRedirect");
  const search = params.toString();
  const cleanUrl =
    window.location.pathname + (search ? `?${search}` : "") + window.location.hash;
  window.history.replaceState({}, "", cleanUrl);
};
