/**
 * Доступ к платформенной админке NUR.
 * Бэкенд выставляет `is_platform_admin: true` только сотрудникам NUR.
 */
export function isPlatformAdmin(profile) {
  if (!profile || typeof profile !== "object") return false;
  return profile.is_platform_admin === true;
}

export const PLATFORM_ADMIN_SESSION_KEY = "platformAdminSession";
export const PLATFORM_ADMIN_IMPERSONATING_KEY = "platformAdminImpersonating";

/**
 * @returns {{ accessToken: string, refreshToken: string, returnPath?: string } | null}
 */
export function readPlatformAdminSession() {
  try {
    const raw = localStorage.getItem(PLATFORM_ADMIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePlatformAdminSession(session) {
  localStorage.setItem(PLATFORM_ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function clearPlatformAdminSession() {
  localStorage.removeItem(PLATFORM_ADMIN_SESSION_KEY);
  localStorage.removeItem(PLATFORM_ADMIN_IMPERSONATING_KEY);
}

export function isImpersonating() {
  return Boolean(readPlatformAdminSession());
}

/**
 * @returns {{ userId?: string|number, email?: string, name?: string } | null}
 */
export function readImpersonationMeta() {
  try {
    const raw = localStorage.getItem(PLATFORM_ADMIN_IMPERSONATING_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeImpersonationMeta(meta) {
  localStorage.setItem(PLATFORM_ADMIN_IMPERSONATING_KEY, JSON.stringify(meta));
}
