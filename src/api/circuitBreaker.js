/**
 * Circuit breaker for axios: stops this browser from hammering endpoints that
 * repeatedly fail with 404/401 (and hard-blocks known-dead catalog sync URLs
 * that never existed on the backend but appear in production access logs).
 */

/** Paths that must never be called from this SPA (not implemented on BE). */
const DEAD_CATALOG_PATH_RE =
  /(?:^|\/)(?:main\/products\/(?:catalog-meta|meta)|main\/catalog\/version)\/?/i;

const circuitState = new Map(); // key -> { fails, openUntil }
const FAIL_THRESHOLD = 3;
const OPEN_MS = 60_000;

function normalizeUrl(url = "") {
  try {
    // absolute or relative
    const path = String(url).split("?")[0];
    return path.replace(/^https?:\/\/[^/]+/i, "").replace(/^\/api\/?/i, "/");
  } catch {
    return String(url || "");
  }
}

export function circuitKey(config = {}) {
  const method = String(config.method || "get").toLowerCase();
  return `${method}:${normalizeUrl(config.url || "")}`;
}

export function isDeadCatalogPath(url = "") {
  return DEAD_CATALOG_PATH_RE.test(normalizeUrl(url));
}

export function createCircuitRequestInterceptor() {
  return (config) => {
    const url = config?.url || "";
    if (isDeadCatalogPath(url)) {
      const err = new Error(
        `Blocked dead catalog endpoint (not in API): ${normalizeUrl(url)}`,
      );
      err.code = "ERR_DEAD_CATALOG";
      err.config = config;
      return Promise.reject(err);
    }

    const key = circuitKey(config);
    const state = circuitState.get(key);
    if (state?.openUntil && Date.now() < state.openUntil) {
      const err = new Error(`Circuit open for ${key}`);
      err.code = "ERR_CIRCUIT_OPEN";
      err.config = config;
      return Promise.reject(err);
    }
    return config;
  };
}

export function noteCircuitFailure(config, status) {
  if (status !== 404 && status !== 401) return;
  if (!config?.url) return;
  // Never trip circuit on auth refresh — login flow owns that
  if (String(config.url).includes("/users/auth/")) return;

  const key = circuitKey(config);
  const prev = circuitState.get(key) || { fails: 0, openUntil: 0 };
  if (prev.openUntil && Date.now() < prev.openUntil) return;

  prev.fails += 1;
  if (prev.fails >= FAIL_THRESHOLD) {
    prev.openUntil = Date.now() + OPEN_MS;
    prev.fails = 0;
    if (typeof console !== "undefined") {
      console.warn(`[api] circuit open ${OPEN_MS}ms for ${key}`);
    }
  }
  circuitState.set(key, prev);
}

/** Test helper */
export function _resetCircuitStateForTests() {
  circuitState.clear();
}
