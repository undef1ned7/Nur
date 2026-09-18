import { getBuildingAppPath, getMarketAppPath } from "./appUrls";
import { isBuildingSector, isMarketSector } from "./sectorMapping";
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

export const resolveMarketAppPath = (currentPath) => {
  if (currentPath?.startsWith("/crm/market")) {
    return currentPath.replace(/^\/crm/, "");
  }
  return "/market";
};

/**
 * Можно ли отправить пользователя в standalone market-приложение.
 * Нужны: сфера "Магазин" + активная подписка + токены.
 */
export const canHandoffToMarketApp = (company) => {
  if (!isMarketSector(company?.sector?.name)) return false;
  if (!isCompanySubscriptionActive(company)) return false;
  if (!localStorage.getItem("accessToken")) return false;
  return true;
};

export const redirectToMarketApp = (currentPath = "/market") => {
  const targetPath = resolveMarketAppPath(currentPath);
  const tokens = {
    ...getStoredAuthTokens(),
    sector: "market",
  };

  if (!tokens.access) {
    console.warn("redirectToMarketApp: нет accessToken, редирект отменён");
    return false;
  }

  window.location.href = buildAuthRedirectUrl(
    getMarketAppPath(targetPath),
    tokens,
  );
  return true;
};

/**
 * Безопасный handoff: редирект только при активной подписке и market-сфере.
 * @returns {'redirected' | 'expired' | 'skipped'}
 */
export const tryRedirectToMarketApp = (company, currentPath) => {
  if (!isMarketSector(company?.sector?.name)) {
    return "skipped";
  }

  if (!isCompanySubscriptionActive(company)) {
    return "expired";
  }

  const ok = redirectToMarketApp(currentPath);
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

export const shouldSkipMarketRedirect = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("skipMarketRedirect") === "1";
};

export const clearSkipMarketRedirectParam = () => {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("skipMarketRedirect")) return;

  params.delete("skipMarketRedirect");
  const search = params.toString();
  const cleanUrl =
    window.location.pathname +
    (search ? `?${search}` : "") +
    window.location.hash;
  window.history.replaceState({}, "", cleanUrl);
};
