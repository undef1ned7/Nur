import { getSnapshot } from "./cafeOfflineService";

function isCafeUrl(url = "") {
  return (
    url.includes("/cafe/") ||
    url.includes("/orders/") ||
    url.includes("/tables/") ||
    url.includes("/menu/")
  );
}

export async function getOfflineFallback(config) {
  if (!config?.url) return null;
  if (!isCafeUrl(config.url)) return null;

  const { categories, items, tables, open_orders, current_shift } =
    await getSnapshot();

  const url = config.url;
  const method = (config.method || "get").toLowerCase();

  if (url.includes("offline-snapshot")) {
    return {
      snapshot_at: localStorage.getItem("cafe_snapshot_at"),
      menu: { categories, items },
      tables,
      open_orders,
      current_shift,
    };
  }

  if (
    method === "get" &&
    (url.includes("/menu/") || url.includes("/categories/"))
  ) {
    return { results: categories, count: categories.length };
  }

  if (method === "get" && url.includes("/menu-items/")) {
    const itemIdMatch = url.match(/menu-items\/([0-9a-f-]{36})/i);
    if (itemIdMatch) {
      const item = items.find((i) => i.id === itemIdMatch[1]);
      return item || null;
    }
    return { results: items, count: items.length };
  }

  if (method === "get" && url.includes("/tables/")) {
    return { results: tables, count: tables.length };
  }

  if (method === "get" && url.includes("/orders/")) {
    const orderIdMatch = url.match(/orders\/([0-9a-f-]{36})/i);
    if (orderIdMatch) {
      const order = open_orders.find((o) => o.id === orderIdMatch[1]);
      return order || null;
    }
    return { results: open_orders, count: open_orders.length };
  }

  if (method === "get" && url.includes("/shifts/")) {
    return current_shift;
  }

  if (["post", "patch", "put", "delete"].includes(method)) {
    return { offline: true, queued: true };
  }

  if (method === "get") {
    return { results: [], count: 0 };
  }

  return null;
}
