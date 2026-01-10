import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { PAGE_SIZE } from "../constants";

/**
 * Хук для управления пагинацией
 * @param {number} count - Общее количество элементов
 * @param {string|null} next - URL следующей страницы
 * @param {string|null} previous - URL предыдущей страницы
 * @returns {Object} Объект с данными и функциями пагинации
 */
export const usePagination = (count, next, previous) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const pageFromUrl = useMemo(
    () => parseInt(searchParams.get("page") || "1", 10),
    [searchParams]
  );
  const [currentPage, setCurrentPage] = useState(() => pageFromUrl || 1);

  // Расчет общего количества страниц
  const totalPages = useMemo(
    () => (count && PAGE_SIZE ? Math.ceil(count / PAGE_SIZE) : 1),
    [count]
  );

  const hasNextPage = useMemo(() => !!next, [next]);
  const hasPrevPage = useMemo(() => !!previous, [previous]);

  // Синхронизация URL с состоянием страницы
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage > 1) {
      params.set("page", currentPage.toString());
    }
    const newSearchString = params.toString();
    const currentSearchString = searchParams.toString();
    if (newSearchString !== currentSearchString) {
      setSearchParams(params, { replace: true });
    }
  }, [currentPage, searchParams, setSearchParams]);

  // Функция для получения номера строки
  const getRowNumber = useCallback(
    (index, itemsLength) => {
      const effectivePageSize = PAGE_SIZE || itemsLength || 1;
      return (currentPage - 1) * effectivePageSize + index + 1;
    },
    [currentPage]
  );

  // Обработчик смены страницы
  const handlePageChange = useCallback(
    (newPage) => {
      if (newPage < 1 || (totalPages && newPage > totalPages)) return;
      setCurrentPage(newPage);
    },
    [totalPages]
  );

  // Сброс на первую страницу
  const resetToFirstPage = useCallback(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [currentPage]);

  return {
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    getRowNumber,
    handlePageChange,
    resetToFirstPage,
    setCurrentPage,
  };
};

