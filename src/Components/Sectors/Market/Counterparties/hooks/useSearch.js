import { useState, useEffect, useRef } from "react";
import { DEBOUNCE_DELAY } from "../constants";

const readPersistedSearch = (persistKey) => {
  if (!persistKey || typeof sessionStorage === "undefined") return "";
  try {
    return sessionStorage.getItem(persistKey) || "";
  } catch {
    return "";
  }
};

/**
 * Хук для управления поиском с debounce
 * @param {string} [persistKey] — если задан, значение сохраняется в sessionStorage
 *   (вкладка браузера) и восстанавливается при возврате на страницу
 * @returns {Object} Объект с searchTerm, debouncedSearchTerm и setSearchTerm
 */
export const useSearch = (persistKey) => {
  const [searchTerm, setSearchTerm] = useState(() =>
    readPersistedSearch(persistKey),
  );
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(() =>
    readPersistedSearch(persistKey),
  );
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

  useEffect(() => {
    if (!persistKey || typeof sessionStorage === "undefined") return;
    try {
      sessionStorage.setItem(persistKey, searchTerm);
    } catch {
      /* ignore quota / private mode */
    }
  }, [persistKey, searchTerm]);

  return {
    searchTerm,
    debouncedSearchTerm,
    setSearchTerm,
  };
};
