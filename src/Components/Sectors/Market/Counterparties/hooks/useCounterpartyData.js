import { useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchWarehouseCounterparties,
} from "../../../../../store/creators/warehouseThunk";
import { loadCounterpartiesFromCache, setCachedCounterparties } from "../../../../../store/slices/counterpartySlice";

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
 * Хук для управления данными контрагентов с кэшированием
 * @param {Object} params - Параметры запроса контрагентов
 * @returns {Object} Объект с данными и состоянием загрузки
 */
export const useCounterpartyData = (params) => {
  const dispatch = useDispatch();
  const lastParamsRef = useRef("");
  const cacheLoadedRef = useRef(false);

  // Сериализация params для стабильного сравнения и ключа кэша
  const paramsString = useMemo(() => {
    return createCacheKey(params);
  }, [params]);

  // Селектор для кэша
  const counterpartiesCache = useSelector(
    (state) => state.counterparty.counterpartiesCache || {}
  );

  // Проверяем кэш синхронно и загружаем данные сразу, если они есть
  const cachedData = useMemo(() => {
    if (!paramsString) return null;
    const data = counterpartiesCache[paramsString];
    if (data && data.timestamp) {
      const cacheAge = Date.now() - data.timestamp;
      if (cacheAge < CACHE_TTL) {
        return data;
      }
    }
    return null;
  }, [paramsString, counterpartiesCache]);

  // Оптимизированные селекторы - выбираем только нужные поля
  const counterparties = useSelector((state) => state.counterparty.list);
  const loading = useSelector((state) => state.counterparty.loading);
  const count = useSelector((state) => state.counterparty.count);
  const next = useSelector((state) => state.counterparty.next);
  const previous = useSelector((state) => state.counterparty.previous);

  // Загрузка контрагентов при изменении параметров с приоритетом кэша
  useEffect(() => {
    if (!params || Object.keys(params).length === 0) return;

    const cacheKey = paramsString;

    // Пропускаем, если это те же параметры
    if (cacheKey === lastParamsRef.current) return;

    // Если есть валидный кэш, загружаем его СИНХРОННО перед запросом
    if (cachedData) {
      dispatch(loadCounterpartiesFromCache({ cacheKey, cachedData }));
      cacheLoadedRef.current = true;
    }

    // Делаем запрос для обновления данных (stale-while-revalidate)
    dispatch(
      fetchWarehouseCounterparties({
        ...params,
        _cacheKey: cacheKey,
        _skipLoadingIfCached: !!cachedData,
      })
    );

    lastParamsRef.current = cacheKey;
    cacheLoadedRef.current = false;
  }, [dispatch, paramsString, cachedData, params]);

  // Если есть валидный кэш и данные уже загружены, не показываем loading
  const effectiveLoading = cachedData && counterparties.length > 0 ? false : loading;

  return {
    counterparties,
    loading: effectiveLoading,
    count,
    next,
    previous,
  };
};

