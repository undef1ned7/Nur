import { useState, useEffect, useRef } from "react";
import { DEBOUNCE_DELAY } from "../constants";

/**
 * Хук для управления поиском с debounce
 * @returns {Object} Объект с searchTerm, debouncedSearchTerm и setSearchTerm
 */
export const useSearch = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm]);

  return {
    searchTerm,
    debouncedSearchTerm,
    setSearchTerm,
  };
};

