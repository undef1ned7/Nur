// Константы для компонента Warehouse
export const STORAGE_KEY = "warehouse_view_mode";
export const PAGE_SIZE = 50;
export const DEBOUNCE_DELAY = 300;

export const VIEW_MODES = {
  TABLE: "table",
  CARDS: "cards",
};

export const getInitialViewMode = () => {
  if (typeof window === "undefined") return VIEW_MODES.TABLE;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === VIEW_MODES.TABLE || saved === VIEW_MODES.CARDS) return saved;

  const isSmall = window.matchMedia("(max-width: 1199px)").matches;
  return isSmall ? VIEW_MODES.CARDS : VIEW_MODES.TABLE;
};

