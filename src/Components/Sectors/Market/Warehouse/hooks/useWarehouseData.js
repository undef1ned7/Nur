import { useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchProductsAsync,
  fetchBrandsAsync,
  fetchCategoriesAsync,
} from "../../../../../store/creators/productCreators";
import { loadProductsFromCache } from "../../../../../store/slices/productSlice";

/**
 * Хук для загрузки справочников (бренды и категории)
 * @returns {Object} Объект с брендами и категориями
 */
export const useWarehouseReferences = () => {
  const dispatch = useDispatch();

  // Оптимизация селекторов с мемоизацией
  const brands = useSelector(
    (state) => state.product.brands || [],
    (prev, next) =>
      prev.length === next.length &&
      prev.every((item, idx) => item.id === next[idx]?.id)
  );

  const categories = useSelector(
    (state) => state.product.categories || [],
    (prev, next) =>
      prev.length === next.length &&
      prev.every((item, idx) => item.id === next[idx]?.id)
  );

  // Загрузка справочников только если данных нет (кэширование)
  useEffect(() => {
    if (brands.length === 0) {
      dispatch(fetchBrandsAsync());
    }
    if (categories.length === 0) {
      dispatch(fetchCategoriesAsync());
    }
  }, [dispatch, brands.length, categories.length]);


  return { brands, categories };
};

// Функция для создания ключа кэша из параметров
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

// Время жизни кэша (5 минут)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Хук для управления данными склада с кэшированием
 * @param {Object} params - Параметры запроса товаров
 * @returns {Object} Объект с данными и состоянием загрузки
 */
export const useWarehouseData = (params) => {
  const dispatch = useDispatch();
  const lastParamsRef = useRef("");
  const cacheLoadedRef = useRef(false);

  // Сериализация params для стабильного сравнения и ключа кэша
  const paramsString = useMemo(() => {
    return createCacheKey(params);
  }, [params]);

  // Селектор для кэша
  const productsCache = useSelector(
    (state) => state.product.productsCache || {}
  );

  // Проверяем кэш синхронно и загружаем данные сразу, если они есть
  const cachedData = useMemo(() => {
    if (!paramsString) return null;
    const data = productsCache[paramsString];
    if (data && data.timestamp) {
      const cacheAge = Date.now() - data.timestamp;
      if (cacheAge < CACHE_TTL) {
        return data;
      }
    }
    return null;
  }, [paramsString, productsCache]);

  // Оптимизированные селекторы - выбираем только нужные поля
  const products = useSelector((state) => state.product.list);
  const loading = useSelector((state) => state.product.loading);
  const count = useSelector((state) => state.product.count);
  const next = useSelector((state) => state.product.next);
  const previous = useSelector((state) => state.product.previous);

  // Загрузка товаров при изменении параметров с приоритетом кэша
  useEffect(() => {
    if (!params || Object.keys(params).length === 0) return;

    const cacheKey = paramsString;

    // Пропускаем, если это те же параметры
    if (cacheKey === lastParamsRef.current) return;

    // Если есть валидный кэш, загружаем его СИНХРОННО перед запросом
    // Это предотвращает белый экран при быстрой смене страниц
    if (cachedData) {
      dispatch(loadProductsFromCache({ cacheKey, cachedData }));
      cacheLoadedRef.current = true;
    }

    // Делаем запрос для обновления данных (stale-while-revalidate)
    // Если есть кэш, loading не будет true благодаря _skipLoadingIfCached
    dispatch(
      fetchProductsAsync({
        ...params,
        _cacheKey: cacheKey,
        _skipLoadingIfCached: !!cachedData, // Флаг для пропуска loading если есть кэш
      })
    );

    lastParamsRef.current = cacheKey;
    cacheLoadedRef.current = false;
  }, [dispatch, paramsString, cachedData, params]);

  // Если есть валидный кэш и данные уже загружены, не показываем loading
  // Это предотвращает белый экран при быстрой смене страниц
  const effectiveLoading = cachedData && products.length > 0 ? false : loading;

  return {
    products,
    loading: effectiveLoading,
    count,
    next,
    previous,
  };
};
