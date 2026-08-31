/** Prefetch JS для /crm/sklad — идempotent, безопасно вызывать многократно. */

let skladPagePromise = null;
let crmRoutesPromise = null;

export const isSkladRoute = (path = "") => {
  const normalized = String(path || "").split("?")[0].replace(/\/+$/, "");
  return normalized === "/crm/sklad" || normalized.startsWith("/crm/sklad/");
};

/** Lazy-chunk страницы склада (Warehouse.jsx). */
export function prefetchSkladPage() {
  if (!skladPagePromise) {
    skladPagePromise = import(
      "../Components/Sectors/Market/Warehouse/Warehouse"
    ).catch((err) => {
      skladPagePromise = null;
      throw err;
    });
  }
  return skladPagePromise;
}

/** CRM routes index — ускоряет первый заход в любой /crm/* маршрут. */
export function prefetchCrmRoutes() {
  if (!crmRoutesPromise) {
    crmRoutesPromise = import("../config/routes/index.js").catch((err) => {
      crmRoutesPromise = null;
      throw err;
    });
  }
  return crmRoutesPromise;
}

/** Полный prefetch: routes + страница склада. */
export function prefetchSkladRoute() {
  void prefetchCrmRoutes();
  return prefetchSkladPage();
}
