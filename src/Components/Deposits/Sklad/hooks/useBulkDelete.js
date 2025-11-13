import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { bulkDeleteProductsAsync } from "../../../../store/creators/productCreators";
import { fetchProductsAsync } from "../../../../store/creators/productCreators";

/**
 * Хук для массового удаления товаров
 */
export const useBulkDelete = (
  selectedIds,
  clearSelection,
  currentPage,
  searchTerm,
  currentFilters
) => {
  const dispatch = useDispatch();

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (
      !window.confirm(
        `Удалить выбранные ${selectedIds.size} товар(ов)? Это действие нельзя отменить.`
      )
    ) {
      return;
    }

    try {
      await dispatch(
        bulkDeleteProductsAsync({
          ids: Array.from(selectedIds),
          soft: true,
          require_all: false,
        })
      ).unwrap();

      clearSelection();
      alert("Выбранные товары удалены");
      dispatch(
        fetchProductsAsync({
          page: currentPage,
          search: searchTerm,
          ...currentFilters,
        })
      );
    } catch (e) {
      alert("Не удалось удалить товары: " + (e.message || e));
    }
  }, [
    selectedIds,
    clearSelection,
    currentPage,
    searchTerm,
    currentFilters,
    dispatch,
  ]);

  return handleBulkDelete;
};
