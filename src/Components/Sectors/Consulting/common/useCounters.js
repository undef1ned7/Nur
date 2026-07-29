/**
 * Консалтинг: загрузка счётчиков для табов (лиды по статусам, заявки кассы
 * и т.п.).
 *
 * Отдельный лёгкий запрос рядом со списком: счётчики должны считаться по всем
 * записям, а не по текущей странице. Если эндпоинт ещё не реализован (404/501)
 * — молча возвращаем null, табы просто рисуются без цифр, интерфейс не ломается.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { isNotReadyError } from "./useConsultingList";

export default function useCounters(fetcher, params = null, enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(0);

  const paramsKey = useMemo(() => JSON.stringify(params || {}), [params]);

  useEffect(() => {
    if (!enabled || typeof fetcher !== "function") return undefined;
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    fetcher(JSON.parse(paramsKey), { signal: controller.signal })
      .then((res) => {
        if (!cancelled) setData(res || null);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e?.name === "CanceledError" || e?.name === "AbortError") return;
        // Счётчики — вспомогательные данные: их отсутствие не должно
        // превращаться в ошибку на весь экран.
        if (!isNotReadyError(e)) console.warn("Counters error:", e);
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fetcher, paramsKey, enabled, token]);

  const reload = useCallback(() => setToken((v) => v + 1), []);

  return { data, loading, reload };
}
