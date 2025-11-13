import { useState, useCallback } from "react";

/**
 * Хук для управления фильтрацией и поиском
 */
export const useSkladFilters = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentFilters, setCurrentFilters] = useState({});

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleApplyFilters = useCallback((filters) => {
    setCurrentFilters(filters);
  }, []);

  const handleResetAllFilters = useCallback(() => {
    setSearchTerm("");
    setCurrentFilters({});
  }, []);

  const isFiltered = searchTerm || Object.keys(currentFilters).length > 0;

  return {
    searchTerm,
    currentFilters,
    isFiltered,
    handleSearchChange,
    handleApplyFilters,
    handleResetAllFilters,
    setSearchTerm,
    setCurrentFilters,
  };
};
