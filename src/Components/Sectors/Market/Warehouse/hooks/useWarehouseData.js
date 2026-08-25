import { useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchProductsAsync,
  fetchBrandsAsync,
  fetchCategoriesAsync,
} from "../../../../../store/creators/productCreators";
import { loadProductsFromCache } from "../../../../../store/slices/productSlice";

const SESSION_PRODUCTS_CACHE_KEY = "nur_market_warehouse_products_cache_v1";
const MAX_SESSION_CACHE_ENTRIES = 12;

/**
 * Хук для загрузки справочников (бренды и категории).
 * @param {boolean} enabled — загружать только когда нужны (например, FilterModal открыта)
 */
export const useWarehouseReferences = (enabled = true) => {
  const dispatch = useDispatch();

  const brands = useSelector(
    (state) => state.product.brands || [],
    (prev, next) =>
      prev.length === next.length &&
      prev.every((item, idx) => item.id === next[idx]?.id),
  );

  const categories = useSelector(
    (state) => state.product.categories || [],
    (prev, next) =>
      prev.length === next.length &&
      prev.every((item, idx) => item.id === next[idx]?.id),
  );

  useEffect(() => {
    if (!enabled) return;
    if (brands.length === 0) {
      dispatch(fetchBrandsAsync());
    }
    if (categories.length === 0) {
      dispatch(fetchCategoriesAsync());
    }
  }, [dispatch, brands.length, categories.length, enabled]);

  return { brands, categories };
};

const createCacheKey = (params) => {
  if (!params || Object.keys(params).length === 0) return "";
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});
  return JSON.stringify(sortedParams);
};

const CACHE_TTL = 5 * 60 * 1000;

const readSessionProductsCache = (cacheKey) => {
  if (typeof sessionStorage === "undefined" || !cacheKey) return null;
  try {
    const raw = sessionStorage.getItem(SESSION_PRODUCTS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const entry = parsed?.[cacheKey];
    if (!entry?.timestamp) return null;
    if (Date.now() - entry.timestamp >= CACHE_TTL) return null;
    return entry;
  } catch {
    return null;
  }
};

const writeSessionProductsCache = (cacheKey, cachedData) => {
  if (typeof sessionStorage === "undefined" || !cacheKey || !cachedData) return;
  try {
    const raw = sessionStorage.getItem(SESSION_PRODUCTS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = { ...parsed, [cacheKey]: { ...cachedData, timestamp: Date.now() } };
    const keys = Object.keys(next);
    if (keys.length > MAX_SESSION_CACHE_ENTRIES) {
      keys
        .sort((a, b) => (next[a]?.timestamp || 0) - (next[b]?.timestamp || 0))
        .slice(0, keys.length - MAX_SESSION_CACHE_ENTRIES)
        .forEach((key) => delete next[key]);
    }
    sessionStorage.setItem(SESSION_PRODUCTS_CACHE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
};

/**
 * Хук для управления данными склада с кэшированием (Redux + sessionStorage).
 */
export const useWarehouseData = (params) => {
  const dispatch = useDispatch();
  const lastParamsRef = useRef("");

  const paramsString = useMemo(() => createCacheKey(params), [params]);

  const productsCache = useSelector(
    (state) => state.product.productsCache || {},
  );

  const cachedData = useMemo(() => {
    if (!paramsString) return null;
    const data = productsCache[paramsString];
    if (data?.timestamp && Date.now() - data.timestamp < CACHE_TTL) {
      return data;
    }
    return readSessionProductsCache(paramsString);
  }, [paramsString, productsCache]);

  const products = useSelector((state) => state.product.list);
  const loading = useSelector((state) => state.product.loading);
  const count = useSelector((state) => state.product.count);
  const next = useSelector((state) => state.product.next);
  const previous = useSelector((state) => state.product.previous);

  useEffect(() => {
    if (!params || Object.keys(params).length === 0) return;

    const cacheKey = paramsString;
    if (cacheKey === lastParamsRef.current) return;

    if (cachedData) {
      dispatch(loadProductsFromCache({ cacheKey, cachedData }));
    }

    dispatch(
      fetchProductsAsync({
        ...params,
        _cacheKey: cacheKey,
        _skipLoadingIfCached: !!cachedData,
      }),
    );

    lastParamsRef.current = cacheKey;
  }, [dispatch, paramsString, cachedData, params]);

  useEffect(() => {
    if (!paramsString || loading || products.length === 0) return;
    writeSessionProductsCache(paramsString, {
      list: products,
      count,
      next,
      previous,
      weightProductsCount: 0,
    });
  }, [paramsString, loading, products, count, next, previous]);

  const effectiveLoading =
    cachedData && products.length > 0 ? false : loading;

  return {
    products,
    loading: effectiveLoading,
    count,
    next,
    previous,
  };
};
