/**
 * Turn API / network errors into a short user-facing string (DRF-style bodies, axios, etc.).
 * @param {unknown} err
 * @param {string} [fallback]
 * @returns {string}
 */
export function validateResErrors(err, fallback = "Ошибка запроса") {
  if (err == null) return fallback;

  try {
    const data = err?.response?.data ?? err?.data;

    if (data == null) {
      if (typeof err?.message === "string" && err.message.trim()) {
        return err.message.trim();
      }
      if (typeof err?.detail === "string" && err.detail.trim()) {
        return err.detail.trim();
      }
      const status = err?.response?.status ?? err?.status;
      if (status) return `Ошибка ${status}`;
      return fallback;
    }

    if (typeof data === "string") {
      const t = data.trim();
      return t || fallback;
    }

    if (Array.isArray(data)) {
      const joined = data.map(String).filter(Boolean).join("; ");
      return joined || fallback;
    }

    if (typeof data === "object") {
      if (typeof data.detail === "string" && data.detail.trim()) {
        return data.detail.trim();
      }
      if (Array.isArray(data.detail) && data.detail.length) {
        return data.detail.map(String).join("; ");
      }
      const parts = [];
      for (const [k, v] of Object.entries(data)) {
        if (k === "detail") continue;
        if (Array.isArray(v)) parts.push(`${k}: ${v.map(String).join(", ")}`);
        else if (v != null && typeof v === "object") {
          parts.push(`${k}: ${JSON.stringify(v)}`);
        } else parts.push(`${k}: ${String(v)}`);
      }
      if (parts.length) return parts.join("; ");
    }
  } catch {
    // ignore
  }

  return fallback;
}
