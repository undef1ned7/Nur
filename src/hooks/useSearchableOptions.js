import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import { useDebouncedValue } from "./useDebounce";

/** Размер страницы справочников по умолчанию. */
export const SEARCHABLE_OPTIONS_PAGE_SIZE = 100;

const readResults = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

/**
 * Справочник для селекта с поиском: поиск уходит на бэкенд параметром `search`,
 * список приходит страницами по `pageSize`. Пока на сервере есть ещё записи,
 * `hasMore === true` — селект показывает внизу кнопку «Смотреть ещё»,
 * а `loadMore()` дописывает следующую страницу в конец списка.
 *
 * Состояние локальное (не Redux) — общий список брендов/категорий/клиентов
 * в store не затрагивается, поэтому поиск в одном селекте не влияет на другие
 * экраны.
 *
 * @param {Object} config
 * @param {string} config.endpoint — путь API, например "/main/brands/"
 * @param {Object} [config.params] — доп. постоянные параметры запроса (например { type: "suppliers" })
 * @param {(item: any) => {value: string, label: string}} config.mapOption — должна быть
 *   стабильной (объявляйте вне компонента или через useCallback): смена ссылки перезапрашивает список
 * @param {number} [config.pageSize]
 * @param {boolean} [config.enabled] — false: не грузить (например, пока поле выключено)
 * @param {number} [config.debounceMs]
 */
export const useSearchableOptions = ({
  endpoint,
  params,
  mapOption,
  pageSize = SEARCHABLE_OPTIONS_PAGE_SIZE,
  enabled = true,
  debounceMs = 350,
}) => {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);

  const debouncedQuery = useDebouncedValue(query, debounceMs);

  // Стабильный ключ для доп. параметров, чтобы не перезапрашивать на каждый рендер
  const paramsKey = useMemo(() => JSON.stringify(params || {}), [params]);

  // Зеркало options — нужно, чтобы догрузка знала текущий список без пересоздания колбэка
  const optionsRef = useRef([]);
  const pageRef = useRef(1);
  // Отбрасываем ответы устаревших запросов (гонка при быстром вводе)
  const requestIdRef = useRef(0);

  const applyOptions = useCallback((next) => {
    optionsRef.current = next;
    setOptions(next);
  }, []);

  const fetchPage = useCallback(
    async ({ page, append }) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setLoading(true);
      setError(null);
      try {
        const search = String(debouncedQuery || "").trim();
        const { data } = await api.get(endpoint, {
          params: {
            ...JSON.parse(paramsKey),
            ...(search ? { search } : {}),
            page,
            page_size: pageSize,
          },
        });
        if (requestIdRef.current !== requestId) return;

        const mapped = readResults(data)
          .map((item) => mapOption(item))
          .filter((option) => option && String(option.value ?? "") !== "");

        let merged = mapped;
        if (append) {
          const seen = new Set(
            optionsRef.current.map((option) => String(option.value)),
          );
          merged = [
            ...optionsRef.current,
            ...mapped.filter((option) => !seen.has(String(option.value))),
          ];
        }
        applyOptions(merged);

        const total = Number(data?.count);
        setHasMore(
          data?.next !== undefined
            ? Boolean(data.next)
            : Number.isFinite(total)
              ? merged.length < total
              : mapped.length >= pageSize,
        );
        pageRef.current = page;
      } catch (e) {
        if (requestIdRef.current !== requestId) return;
        console.error(`Ошибка загрузки справочника ${endpoint}:`, e);
        setError(e);
        if (!append) applyOptions([]);
        setHasMore(false);
      } finally {
        if (requestIdRef.current === requestId) setLoading(false);
      }
    },
    [applyOptions, endpoint, paramsKey, pageSize, debouncedQuery, mapOption],
  );

  // Первая страница: при монтировании, смене поиска или параметров
  useEffect(() => {
    if (!enabled) return;
    void fetchPage({ page: 1, append: false });
  }, [enabled, fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    void fetchPage({ page: pageRef.current + 1, append: true });
  }, [fetchPage, hasMore, loading]);

  /** Добавить опцию в начало списка (например, только что созданный бренд). */
  const prependOption = useCallback(
    (option) => {
      if (!option || String(option.value ?? "") === "") return;
      applyOptions([
        option,
        ...optionsRef.current.filter(
          (item) => String(item.value) !== String(option.value),
        ),
      ]);
    },
    [applyOptions],
  );

  return {
    options,
    loading,
    hasMore,
    error,
    query,
    setQuery,
    loadMore,
    prependOption,
  };
};

export default useSearchableOptions;
