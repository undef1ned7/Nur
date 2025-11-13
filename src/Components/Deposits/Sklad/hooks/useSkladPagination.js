import { useState, useCallback } from "react";

/**
 * Хук для управления пагинацией
 */
export const useSkladPagination = () => {
  const [currentPage, setCurrentPage] = useState(1);

  const handleNextPage = useCallback((next) => {
    if (next) {
      setCurrentPage((prev) => prev + 1);
    }
  }, []);

  const handlePreviousPage = useCallback((previous) => {
    if (previous) {
      setCurrentPage((prev) => prev - 1);
    }
  }, []);

  const resetPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return {
    currentPage,
    setCurrentPage,
    handleNextPage,
    handlePreviousPage,
    resetPage,
  };
};
