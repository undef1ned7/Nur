/**
 * Консалтинг: единый хук для всех списков сектора.
 *
 * Закрывает одинаковые для всех экранов задачи:
 *  - пагинация (`page`, `page_size`) и серверный поиск (`search`) — всё уходит
 *    в query-параметры запроса, никакой фильтрации «на клиенте по всему списку»;
 *  - произвольные фильтры (статус, сотрудник, период, источник…);
 *  - синхронизация состояния с URL, чтобы ссылку можно было переслать
 *    (`prefix` разводит несколько списков на одной странице);
 *  - дебаунс поиска и отмена устаревших запросов (AbortController + generation),
 *    чтобы медленный ответ не перетирал свежий;
 *  - единая обработка «эндпоинт ещё не реализован» (404/501) → `notReady`.
 *
 * Контракт fetcher: (params, { signal }) => { results, count } | Array.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [20, 50, 100];

export const isNotReadyError = (e) => e?.status === 404 || e?.status === 501;

export const listErrorText = (e, fallback = "Не удалось загрузить данные.") => {
  if (!e) return fallback;
  if (typeof e === "string") return e;
  if (typeof e.detail === "string") return e.detail;
  const first = Object.values(e).find(
    (v) => typeof v === "string" || Array.isArray(v),
  );
  if (Array.isArray(first)) return String(first[0] || fallback);
  return typeof first === "string" ? first : fallback;
};

/** DRF отдаёт либо {results, count}, либо голый массив. */
export const rowsOf = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

export const countOf = (data, rows) =>
  typeof data?.count === "number" ? data.count : rows.length;

/** Пустые значения не должны уезжать в запрос как `?status=`. */
const clean = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === "" || v === null || v === undefined) continue;
    if (Array.isArray(v) && !v.length) continue;
    out[k] = Array.isArray(v) ? v.join(",") : v;
  }
  return out;
};

export default function useConsultingList({
  fetcher,
  filters: initialFilters = {},
  pageSize: initialPageSize = DEFAULT_PAGE_SIZE,
  prefix = "",
  syncUrl = true,
  searchDelay = 350,
  extraParams = null,
  enabled = true,
  mapParams = null,
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Набор фильтров у экрана статичен — фиксируем его на первом рендере.
  // useState (а не useRef): значение читается прямо в рендере.
  const [filterKeys] = useState(() => Object.keys(initialFilters));
  const [baseFilters] = useState(() => ({ ...initialFilters }));

  const urlKey = useCallback(
    (name) => (prefix ? `${prefix}_${name}` : name),
    [prefix],
  );

  // Локальное состояние используется, когда синхронизация с URL выключена
  // (списки внутри модалок и вкладок, которым не нужен deep link).
  const [localState, setLocalState] = useState(() => ({
    page: 1,
    page_size: initialPageSize,
    search: "",
    ...initialFilters,
  }));

  const state = useMemo(() => {
    if (!syncUrl) return localState;
    const next = {
      page: Math.max(1, Number(searchParams.get(urlKey("page")) || 1) || 1),
      page_size:
        Number(searchParams.get(urlKey("page_size")) || 0) || initialPageSize,
      search: searchParams.get(urlKey("search")) || "",
    };
    for (const k of filterKeys) {
      next[k] = searchParams.get(urlKey(k)) ?? baseFilters[k];
    }
    return next;
  }, [
    syncUrl,
    localState,
    searchParams,
    urlKey,
    initialPageSize,
    filterKeys,
    baseFilters,
  ]);

  const patchState = useCallback(
    (patch) => {
      if (!syncUrl) {
        setLocalState((prev) => ({ ...prev, ...patch }));
        return;
      }
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            const key = urlKey(k);
            const isDefault =
              (k === "page" && Number(v) === 1) ||
              (k === "page_size" && Number(v) === initialPageSize) ||
              v === "" ||
              v === null ||
              v === undefined ||
              (filterKeys.includes(k) &&
                String(v) === String(baseFilters[k] ?? ""));
            if (isDefault) p.delete(key);
            else p.set(key, String(v));
          }
          return p;
        },
        { replace: true },
      );
    },
    [syncUrl, setSearchParams, urlKey, initialPageSize, filterKeys, baseFilters],
  );

  /* ----------------------------- поиск ----------------------------- */
  // Поле ввода живёт локально, в запрос уходит через дебаунс.
  const [searchInput, setSearchInput] = useState(state.search);

  // Внешнее изменение (переход по ссылке, «сбросить фильтры») подтягиваем в
  // поле. Во время набора state.search не меняется, поэтому цикла не будет.
  useEffect(() => {
    setSearchInput(state.search);
  }, [state.search]);

  const setSearch = useCallback((value) => setSearchInput(value), []);

  useEffect(() => {
    if (searchInput === state.search) return;
    const t = setTimeout(() => {
      patchState({ search: searchInput, page: 1 });
    }, searchDelay);
    return () => clearTimeout(t);
  }, [searchInput, state.search, searchDelay, patchState]);

  /* ---------------------------- фильтры ---------------------------- */
  const setFilter = useCallback(
    (name, value) => patchState({ [name]: value, page: 1 }),
    [patchState],
  );

  const setFilters = useCallback(
    (patch) => patchState({ ...patch, page: 1 }),
    [patchState],
  );

  const setPage = useCallback((page) => patchState({ page }), [patchState]);

  const setPageSize = useCallback(
    (size) => patchState({ page_size: size, page: 1 }),
    [patchState],
  );

  const resetFilters = useCallback(() => {
    const patch = { search: "", page: 1 };
    for (const k of filterKeys) patch[k] = baseFilters[k] ?? "";
    setSearchInput("");
    patchState(patch);
  }, [patchState, filterKeys, baseFilters]);

  /* ---------------------------- загрузка --------------------------- */
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notReady, setNotReady] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const params = useMemo(() => {
    const filterValues = {};
    for (const k of filterKeys) filterValues[k] = state[k];
    const merged = {
      page: state.page,
      page_size: state.page_size,
      search: state.search.trim(),
      ...filterValues,
      ...(extraParams || {}),
    };
    // mapParams позволяет отправить на сервер не то, что лежит в URL:
    // например, таб `queue=new` разворачивается в `status=new,assigned`.
    return clean(mapParams ? mapParams(merged) : merged);
    // extraParams и mapParams передаются вызывающим кодом уже мемоизированными
  }, [state, extraParams, mapParams, filterKeys]);

  const paramsKey = useMemo(() => JSON.stringify(params), [params]);
  const generationRef = useRef(0);

  useEffect(() => {
    if (!enabled || typeof fetcher !== "function") return undefined;
    const generation = ++generationRef.current;
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    setError("");

    (async () => {
      try {
        const data = await fetcher(JSON.parse(paramsKey), {
          signal: controller.signal,
        });
        // Ответ на устаревший запрос игнорируем — иначе на быстром вводе
        // в поиске список «прыгает» между старым и новым результатом.
        if (cancelled || generation !== generationRef.current) return;
        const rows = rowsOf(data);
        setItems(rows);
        setCount(countOf(data, rows));
        setRaw(data);
        setNotReady(false);
      } catch (e) {
        if (cancelled || generation !== generationRef.current) return;
        if (e?.name === "CanceledError" || e?.name === "AbortError") return;
        if (isNotReadyError(e)) {
          setNotReady(true);
          setItems([]);
          setCount(0);
          setRaw(null);
        } else {
          setError(listErrorText(e));
          setItems([]);
          setCount(0);
        }
      } finally {
        if (!cancelled && generation === generationRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fetcher, paramsKey, enabled, reloadToken]);

  const refresh = useCallback(() => setReloadToken((v) => v + 1), []);

  const pageSize = state.page_size || initialPageSize;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  // Страница «уехала» за пределы выдачи (удалили последнюю запись) — вернуться.
  useEffect(() => {
    if (!loading && state.page > totalPages) setPage(totalPages);
  }, [loading, state.page, totalPages, setPage]);

  const filterValues = useMemo(() => {
    const out = {};
    for (const k of filterKeys) out[k] = state[k];
    return out;
  }, [state, filterKeys]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(state.search) ||
      filterKeys.some(
        (k) => String(state[k] ?? "") !== String(baseFilters[k] ?? ""),
      ),
    [state, filterKeys, baseFilters],
  );

  return {
    items,
    count,
    raw,
    loading,
    error,
    notReady,
    page: state.page,
    pageSize,
    totalPages,
    search: state.search,
    searchInput,
    setSearch,
    filters: filterValues,
    setFilter,
    setFilters,
    setPage,
    setPageSize,
    resetFilters,
    hasActiveFilters,
    refresh,
    params,
  };
}
