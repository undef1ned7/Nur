import { useState, useCallback } from "react";

/**
 * Хук для управления массовым выбором товаров
 */
export const useBulkSelection = () => {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const isSelected = useCallback((id) => selectedIds.has(id), [selectedIds]);

  const toggleRow = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllOnPage = useCallback((items) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected =
        items.length > 0 && items.every((i) => next.has(i.id));
      items.forEach((i) => {
        if (allSelected) next.delete(i.id);
        else next.add(i.id);
      });
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    selectedIds,
    setSelectedIds,
    bulkDeleting,
    setBulkDeleting,
    isSelected,
    toggleRow,
    toggleSelectAllOnPage,
    clearSelection,
  };
};
