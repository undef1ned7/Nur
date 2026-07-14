import { getBuildingAppPath } from "./appUrls";
import { isBuildingSector } from "./sectorMapping";
import { isCompanySubscriptionActive } from "./companySubscription";

const AUTH_PARAM_ACCESS = "accessToken";
const AUTH_PARAM_REFRESH = "refreshToken";
const AUTH_PARAM_SECTOR = "sector";

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
  if (tokens.sector) {
    url.searchParams.set(AUTH_PARAM_SECTOR, tokens.sector);
  }

  return url.toString();
};

export const getStoredAuthTokens = () => ({
  access: localStorage.getItem("accessToken"),
  refresh: localStorage.getItem("refreshToken"),
});

export const resolveBuildingAppPath = (currentPath) => {
  if (currentPath?.startsWith("/crm/building")) {
    return currentPath.replace(/^\/crm/, "");
  }
  return "/building/projects";
};

/**
 * Можно ли отправить пользователя в standalone building-приложение.
 * Нужны: строительная сфера + активная подписка + токены.
 */
export const canHandoffToBuildingApp = (company) => {
  if (!isBuildingSector(company?.sector?.name)) return false;
  if (!isCompanySubscriptionActive(company)) return false;
  if (!localStorage.getItem("accessToken")) return false;
  return true;
};

export const redirectToBuildingApp = (currentPath = "/building/projects") => {
  const targetPath = resolveBuildingAppPath(currentPath);
  const tokens = {
    ...getStoredAuthTokens(),
    sector: "building",
  };

  if (!tokens.access) {
    console.warn("redirectToBuildingApp: нет accessToken, редирект отменён");
    return false;
  }

  window.location.href = buildAuthRedirectUrl(
    getBuildingAppPath(targetPath),
    tokens,
  );
  return true;
};

/**
 * Безопасный handoff: редирект только при активной подписке и строй-сфере.
 * @returns {'redirected' | 'expired' | 'skipped'}
 */
export const tryRedirectToBuildingApp = (company, currentPath) => {
  if (!isBuildingSector(company?.sector?.name)) {
    return "skipped";
  }

  if (!isCompanySubscriptionActive(company)) {
    return "expired";
  }

  const ok = redirectToBuildingApp(currentPath);
  return ok ? "redirected" : "skipped";
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
    window.location.pathname +
    (search ? `?${search}` : "") +
    window.location.hash;
  window.history.replaceState({}, "", cleanUrl);
};
