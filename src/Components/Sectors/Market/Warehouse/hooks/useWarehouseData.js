import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchProductsAsync,
  fetchBrandsAsync,
  fetchCategoriesAsync,
} from "../../../../../store/creators/productCreators";
import { useProducts } from "../../../../../store/slices/productSlice";

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

/**
 * Хук для управления данными склада
 * @param {Object} params - Параметры запроса товаров
 * @returns {Object} Объект с данными и состоянием загрузки
 */
export const useWarehouseData = (params) => {
  const dispatch = useDispatch();

  const {
    list: productsFromStore,
    loading: productsLoading,
    count: productsCount,
    next: productsNext,
    previous: productsPrevious,
  } = useProducts();

  const products = productsFromStore;
  const loading = productsLoading;
  const count = productsCount;
  const next = productsNext;
  const previous = productsPrevious;

  // Сериализация params для стабильного сравнения (предотвращает лишние запросы)
  const paramsString = useMemo(() => {
    if (!params || Object.keys(params).length === 0) return "";
    // Сортируем ключи для стабильной сериализации
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {});
    return JSON.stringify(sortedParams);
  }, [params]);

  // Загрузка товаров при изменении параметров
  useEffect(() => {
    if (params && Object.keys(params).length > 0) {
      // fetchProductsAsync теперь сам умеет ходить в /warehouse/{id}/products/
      // если передать params.warehouse (см. src/api/products.js)
      dispatch(fetchProductsAsync(params));
    }
  }, [dispatch, paramsString]); // Используем строку вместо объекта

  // Мемоизация отфильтрованных продуктов
  const filteredProducts = useMemo(() => products, [products]);

  return {
    products: filteredProducts,
    loading,
    count,
    next,
    previous,
  };
};

