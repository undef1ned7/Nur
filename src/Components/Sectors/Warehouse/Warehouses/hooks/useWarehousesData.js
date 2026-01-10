import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchWarehousesAsync } from "../../../../../store/creators/warehouseCreators";

/**
 * Хук для управления данными складов через Redux
 * @param {Object} params - Параметры запроса складов
 * @returns {Object} Объект с данными и состоянием загрузки
 */
export const useWarehousesData = (params) => {
  const dispatch = useDispatch();

  // Получаем данные из Redux store
  const warehouses = useSelector((state) => state.warehouse.list || []);
  const loading = useSelector((state) => state.warehouse.loading || false);
  const count = useSelector((state) => state.warehouse.count || 0);
  const next = useSelector((state) => state.warehouse.next);
  const previous = useSelector((state) => state.warehouse.previous);
  const error = useSelector((state) => state.warehouse.error);

  // Сериализация params для стабильного сравнения
  const paramsString = useMemo(() => {
    if (!params || Object.keys(params).length === 0) return "";
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {});
    return JSON.stringify(sortedParams);
  }, [params]);

  // Загрузка складов при изменении параметров
  useEffect(() => {
    dispatch(fetchWarehousesAsync(params));
  }, [dispatch, paramsString]);

  return {
    warehouses,
    loading,
    count,
    next,
    previous,
    error,
  };
};
