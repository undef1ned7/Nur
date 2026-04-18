import { useState, useMemo, useCallback, useEffect } from "react";

const readStoredIds = (persistKey) => {
  if (!persistKey || typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(persistKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((id) => String(id));
  } catch {
    return [];
  }
};

/**
 * Хук для управления выбором товаров
 * @param {Array} products - Список товаров
 * @param {string} [persistKey] — если задан, выбранные id сохраняются в sessionStorage (вкладка браузера)
 * @returns {Object} Объект с данными и функциями выбора
 */
export const useProductSelection = (products, persistKey) => {
  const [selectedRows, setSelectedRows] = useState(() => {
    const ids = readStoredIds(persistKey);
    return new Set(ids);
  });

  useEffect(() => {
    if (!persistKey || typeof sessionStorage === "undefined") return;
    try {
      sessionStorage.setItem(persistKey, JSON.stringify([...selectedRows]));
    } catch {
      /* ignore quota / private mode */
    }
  }, [persistKey, selectedRows]);

  // Проверка, выбраны ли все товары (оптимизировано)
  const isAllSelected = useMemo(() => {
    // Быстрая проверка: если размеры не совпадают, сразу false
    if (products.length === 0 || selectedRows.size !== products.length) {
      return false;
    }
    // Если размеры совпадают, проверяем что все ID есть в selectedRows
    // Оптимизация: проверяем только если размеры совпадают
    return products.every((p) => selectedRows.has(String(p.id)));
  }, [products, selectedRows.size]); // Используем только size вместо всего Set

  // Выбор/снятие выбора товара
  const handleRowSelect = useCallback((productId, e) => {
    e?.stopPropagation();
    const id = String(productId);
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Выбор всех товаров
  const handleSelectAll = useCallback(
    (e) => {
      e?.stopPropagation();
      setSelectedRows((prev) => {
        if (prev.size === products.length) {
          return new Set();
        }
        return new Set(products.map((p) => String(p.id)));
      });
    },
    [products]
  );

  // Сброс выбора
  const clearSelection = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  // Проверка, выбран ли товар
  const isSelected = useCallback(
    (productId) => selectedRows.has(String(productId)),
    [selectedRows],
  );

  return {
    selectedRows,
    isAllSelected,
    selectedCount: selectedRows.size,
    handleRowSelect,
    handleSelectAll,
    clearSelection,
    isSelected,
    setSelectedRows,
  };
};

