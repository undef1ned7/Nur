import { useState, useMemo, useCallback } from "react";

/**
 * Хук для управления выбором товаров
 * @param {Array} products - Список товаров
 * @returns {Object} Объект с данными и функциями выбора
 */
export const useProductSelection = (products) => {
  const [selectedRows, setSelectedRows] = useState(() => new Set());

  // Проверка, выбраны ли все товары (оптимизировано)
  const isAllSelected = useMemo(() => {
    // Быстрая проверка: если размеры не совпадают, сразу false
    if (products.length === 0 || selectedRows.size !== products.length) {
      return false;
    }
    // Если размеры совпадают, проверяем что все ID есть в selectedRows
    // Оптимизация: проверяем только если размеры совпадают
    return products.every((p) => selectedRows.has(p.id));
  }, [products, selectedRows.size]); // Используем только size вместо всего Set

  // Выбор/снятие выбора товара
  const handleRowSelect = useCallback((productId, e) => {
    e?.stopPropagation();
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
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
        return new Set(products.map((p) => p.id));
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
    (productId) => selectedRows.has(productId),
    [selectedRows]
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

