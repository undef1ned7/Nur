/**
 * Хук загрузки и кеширования настроек фискальной кассы (/cafe/fiscal/settings/).
 *
 * Используй везде, где нужно знать:
 *   - enabled — включена ли фискальная касса
 *   - connector_base_url, registration_number, pin, login, password
 *   - receipt_width и дефолтные налоговые коды
 */
import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api";

const CACHE_KEY = "cafe_fiscal_settings_cache";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 минут

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // ignore
  }
}

export function invalidateFiscalSettingsCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

/**
 * @returns {{
 *   settings: object|null,
 *   loading: boolean,
 *   error: string|null,
 *   reload: () => void,
 *   patch: (fields: object) => Promise<object>,
 * }}
 */
export function useFiscalSettings() {
  const [settings, setSettings] = useState(() => readCache());
  const [loading, setLoading] = useState(!readCache());
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const load = useCallback(async (force = false) => {
    if (!force) {
      const cached = readCache();
      if (cached) {
        setSettings(cached);
        setLoading(false);
        return;
      }
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/cafe/fiscal/settings/", {
        signal: ctrl.signal,
      });
      writeCache(data);
      setSettings(data);
    } catch (e) {
      if (e.name === "CanceledError" || e.name === "AbortError") return;
      setError(
        e?.response?.data?.detail || e?.message || "Ошибка загрузки настроек кассы",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  const reload = useCallback(() => {
    invalidateFiscalSettingsCache();
    load(true);
  }, [load]);

  /** Частичное обновление настроек (PATCH /cafe/fiscal/settings/) */
  const patch = useCallback(async (fields) => {
    const { data } = await api.patch("/cafe/fiscal/settings/", fields);
    writeCache(data);
    setSettings(data);
    return data;
  }, []);

  return { settings, loading, error, reload, patch };
}
