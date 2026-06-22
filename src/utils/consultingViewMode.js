import { useEffect, useState } from "react";

export const VIEW_MODES = {
  TABLE: "table",
  CARDS: "cards",
};

export function getInitialViewMode(storageKey) {
  if (typeof window === "undefined") return VIEW_MODES.TABLE;
  const saved = window.localStorage.getItem(storageKey);
  if (saved === VIEW_MODES.TABLE || saved === VIEW_MODES.CARDS) return saved;
  return VIEW_MODES.TABLE;
}

export function usePersistedViewMode(storageKey) {
  const [viewMode, setViewMode] = useState(() => getInitialViewMode(storageKey));

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, viewMode);
  }, [storageKey, viewMode]);

  return [viewMode, setViewMode];
}
