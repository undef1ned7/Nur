import { useState, useMemo, useCallback } from "react";

/**
 * Хук для управления выбором контрагентов
 * @param {Array} counterparties - Список контрагентов
 * @returns {Object} Объект с данными и функциями выбора
 */
export const useCounterpartySelection = (counterparties) => {
  const [selectedRows, setSelectedRows] = useState(() => new Set());

  // Проверка, выбраны ли все контрагенты (оптимизировано)
  const isAllSelected = useMemo(() => {
    if (counterparties.length === 0 || selectedRows.size !== counterparties.length) {
      return false;
    }
    return counterparties.every((c) => selectedRows.has(c.id));
  }, [counterparties, selectedRows.size]);

  // Выбор/снятие выбора контрагента
  const handleRowSelect = useCallback((counterpartyId, e) => {
    e?.stopPropagation();
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(counterpartyId)) {
        newSet.delete(counterpartyId);
      } else {
        newSet.add(counterpartyId);
      }
      return newSet;
    });
  }, []);

  // Выбор всех контрагентов
  const handleSelectAll = useCallback(
    (e) => {
      e?.stopPropagation();
      setSelectedRows((prev) => {
        if (prev.size === counterparties.length) {
          return new Set();
        }
        return new Set(counterparties.map((c) => c.id));
      });
    },
    [counterparties]
  );

  // Сброс выбора
  const clearSelection = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  return {
    selectedRows,
    isAllSelected,
    selectedCount: selectedRows.size,
    handleRowSelect,
    handleSelectAll,
    clearSelection,
    setSelectedRows,
  };
};

