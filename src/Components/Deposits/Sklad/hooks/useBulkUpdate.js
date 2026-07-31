import { useCallback, useState } from "react";
import { useDispatch } from "react-redux";
import {
  bulkUpdateProductsAsync,
  fetchProductsAsync,
} from "../../../../store/creators/productCreators";

/**
 * Хук для массового изменения бренда / категории / поставщика выбранных товаров
 */
export const useBulkUpdate = (
  selectedIds,
  clearSelection,
  currentPage,
  searchTerm,
  currentFilters
) => {
  const dispatch = useDispatch();
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const openBulkEdit = useCallback(() => {
    if (selectedIds.size === 0) return;
    setShowBulkEditModal(true);
  }, [selectedIds]);

  const closeBulkEdit = useCallback(() => setShowBulkEditModal(false), []);

  const handleBulkUpdate = useCallback(
    async (changes) => {
      if (selectedIds.size === 0) return;

      setBulkUpdating(true);
      try {
        const result = await dispatch(
          bulkUpdateProductsAsync({
            ids: Array.from(selectedIds),
            ...changes,
            require_all: false,
          })
        ).unwrap();

        setShowBulkEditModal(false);
        clearSelection();

        const failed = Number(result?.failed) || 0;
        alert(
          failed > 0
            ? `Обновлено товаров: ${result?.updated ?? 0}, не удалось: ${failed}`
            : "Выбранные товары обновлены"
        );

        dispatch(
          fetchProductsAsync({
            page: currentPage,
            search: searchTerm,
            ...currentFilters,
          })
        );
      } catch (e) {
        alert("Не удалось изменить товары: " + (e?.detail || e?.message || e));
      } finally {
        setBulkUpdating(false);
      }
    },
    [
      selectedIds,
      clearSelection,
      currentPage,
      searchTerm,
      currentFilters,
      dispatch,
    ]
  );

  return {
    showBulkEditModal,
    openBulkEdit,
    closeBulkEdit,
    handleBulkUpdate,
    bulkUpdating,
  };
};
