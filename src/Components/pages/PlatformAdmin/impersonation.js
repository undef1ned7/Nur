/**
 * Хелперы impersonate: смена токенов и выход из режима.
 */
import {
  clearPlatformAdminSession,
  readPlatformAdminSession,
  writeImpersonationMeta,
  writePlatformAdminSession,
} from "./platformAdminAccess";

export function startImpersonation({
  access,
  refresh,
  userMeta,
  returnPath = "/platform-admin",
}) {
  const accessToken = localStorage.getItem("accessToken");
  const refreshToken = localStorage.getItem("refreshToken");
  if (!accessToken) {
    throw new Error("Нет активной сессии администратора");
  }

  writePlatformAdminSession({
    accessToken,
    refreshToken: refreshToken || "",
    returnPath,
  });
  writeImpersonationMeta(userMeta || {});

  localStorage.setItem("accessToken", access);
  if (refresh) {
    localStorage.setItem("refreshToken", refresh);
  } else {
    localStorage.removeItem("refreshToken");
  }
  localStorage.removeItem("userData");
  localStorage.removeItem("userId");

  window.location.assign("/crm");
}

export function stopImpersonation() {
  const session = readPlatformAdminSession();
  if (!session?.accessToken) {
    clearPlatformAdminSession();
    window.location.assign("/platform-admin");
    return;
  }

  localStorage.setItem("accessToken", session.accessToken);
  if (session.refreshToken) {
    localStorage.setItem("refreshToken", session.refreshToken);
  } else {
    localStorage.removeItem("refreshToken");
  }
  localStorage.removeItem("userData");
  localStorage.removeItem("userId");

  const returnPath = session.returnPath || "/platform-admin";
  clearPlatformAdminSession();
  window.location.assign(returnPath);
}
