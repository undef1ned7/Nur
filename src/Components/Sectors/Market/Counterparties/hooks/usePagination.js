import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  const prevPageRef = useRef(currentPage);

  // Синхронизация currentPage с URL (если URL изменился извне)
  useEffect(() => {
    if (pageFromUrl !== currentPage && pageFromUrl > 0) {
      setCurrentPage(pageFromUrl);
      prevPageRef.current = pageFromUrl;
    }
  }, [pageFromUrl]);

  // Расчет общего количества страниц
  const totalPages = useMemo(
    () => (count && PAGE_SIZE ? Math.ceil(count / PAGE_SIZE) : 1),
    [count]
  );

  const hasNextPage = useMemo(() => !!next, [next]);
  const hasPrevPage = useMemo(() => !!previous, [previous]);

  // Синхронизация URL с состоянием страницы (оптимизировано)
  useEffect(() => {
    if (prevPageRef.current !== currentPage) {
      prevPageRef.current = currentPage;
      const params = new URLSearchParams(searchParams);
      if (currentPage > 1) {
        params.set("page", currentPage.toString());
      } else {
        params.delete("page");
      }
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
    (newPage, onPageChange) => {
      if (newPage < 1 || (totalPages && newPage > totalPages)) return;
      if (onPageChange) onPageChange();
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

