export const NOTIFICATIONS_ENABLED_STORAGE_KEY = "notificationsEnabled";

/** Уведомления включены по умолчанию. */
export function areNotificationsEnabled() {
  if (typeof window === "undefined") return true;
  const saved = localStorage.getItem(NOTIFICATIONS_ENABLED_STORAGE_KEY);
  if (saved === null) return true;
  return saved !== "false";
}

export function setNotificationsEnabled(enabled) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    NOTIFICATIONS_ENABLED_STORAGE_KEY,
    enabled ? "true" : "false",
  );
  window.dispatchEvent(
    new CustomEvent("notifications-preference-changed", {
      detail: { enabled: !!enabled },
    }),
  );
}
