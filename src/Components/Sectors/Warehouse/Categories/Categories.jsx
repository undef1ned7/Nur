import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import "./Categories.scss";
import AlertModal from "../../../common/AlertModal/AlertModal";
import SearchSection from "../../Market/Warehouse/components/SearchSection";
import BulkActionsBar from "../../Market/Warehouse/components/BulkActionsBar";
import Pagination from "../../Market/Warehouse/components/Pagination";
import CategoryTable from "./components/CategoryTable";
import CategoryCards from "./components/CategoryCards";
import CreateCategoryModal from "./components/CreateCategoryModal";
import {
  fetchWarehouseCategoriesAsync,
  bulkDeleteWarehouseCategoriesAsync,
} from "../../../../store/creators/warehouseCreators";
import { useSearch } from "../../Market/Warehouse/hooks/useSearch";
import { usePagination } from "../../Market/Warehouse/hooks/usePagination";
import { useProductSelection } from "../../Market/Warehouse/hooks/useProductSelection";
import { STORAGE_KEY, VIEW_MODES } from "../../Market/Warehouse/constants";

const Categories = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Redux state
  const {
    categories,
    categoriesCount,
    categoriesNext,
    categoriesPrevious,
    categoriesLoading,
    deletingCategory,
  } = useSelector((state) => state.warehouse);

  // Состояние фильтров и модальных окон
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return VIEW_MODES.TABLE;
    const saved = localStorage.getItem(`${STORAGE_KEY}_categories`);
    if (saved === VIEW_MODES.TABLE || saved === VIEW_MODES.CARDS) return saved;
    const isSmall = window.matchMedia("(max-width: 1199px)").matches;
    return isSmall ? VIEW_MODES.CARDS : VIEW_MODES.TABLE;
  });

  // Хуки для управления данными
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useSearch();
  const [searchParams] = useSearchParams();

  // Получаем текущую страницу из URL
  const currentPageFromUrl = useMemo(
    () => parseInt(searchParams.get("page") || "1", 10),
    [searchParams]
  );

  // Параметры запроса
  const requestParams = useMemo(() => {
    const params = {
      page: currentPageFromUrl,
    };
    if (debouncedSearchTerm?.trim()) {
      params.search = debouncedSearchTerm.trim();
    }
    return params;
  }, [currentPageFromUrl, debouncedSearchTerm]);

  // Загрузка категорий
  useEffect(() => {
    dispatch(fetchWarehouseCategoriesAsync(requestParams));
  }, [dispatch, requestParams]);

  // Хук для пагинации
  const {
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    getRowNumber,
    handlePageChange: handlePageChangeBase,
    resetToFirstPage,
  } = usePagination(categoriesCount, categoriesNext, categoriesPrevious);

  // Сброс на первую страницу при изменении поиска
  useEffect(() => {
    if (debouncedSearchTerm) {
      resetToFirstPage();
    }
  }, [debouncedSearchTerm, resetToFirstPage]);

  // Хук для выбора категорий
  const {
    selectedRows,
    isAllSelected,
    selectedCount,
    handleRowSelect,
    handleSelectAll,
    clearSelection,
    setSelectedRows,
  } = useProductSelection(categories);

  // Сохранение режима просмотра
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`${STORAGE_KEY}_categories`, viewMode);
    }
  }, [viewMode]);

  // Обработчики событий
  const handleCategoryClick = useCallback(
    (category) => {
      setEditingCategory(category);
      setShowCreateModal(true);
    },
    []
  );

  const handlePageChange = useCallback(
    (newPage) => {
      handlePageChangeBase(newPage, () => setSelectedRows(new Set()));
    },
    [handlePageChangeBase, setSelectedRows]
  );

  const handleBulkDelete = useCallback(() => {
    if (selectedCount === 0) return;
    setShowDeleteConfirmModal(true);
  }, [selectedCount]);

  const confirmBulkDelete = useCallback(async () => {
    setShowDeleteConfirmModal(false);
    setBulkDeleting(true);
    try {
      await dispatch(
        bulkDeleteWarehouseCategoriesAsync({
          ids: Array.from(selectedRows),
          soft: true,
          require_all: false,
        })
      ).unwrap();

      setSelectedRows(new Set());
      dispatch(fetchWarehouseCategoriesAsync(requestParams));
    } catch (e) {
      console.error("Ошибка при удалении категорий:", e);
      alert(
        "Не удалось удалить категории: " +
          (e?.message || e?.detail || "Неизвестная ошибка")
      );
    } finally {
      setBulkDeleting(false);
    }
  }, [dispatch, selectedRows, requestParams]);

  const handleCreateCategory = useCallback(() => {
    setEditingCategory(null);
    setShowCreateModal(true);
  }, []);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  const handleModalClose = useCallback(() => {
    setShowCreateModal(false);
    setEditingCategory(null);
  }, []);

  const handleCategorySaved = useCallback(() => {
    dispatch(fetchWarehouseCategoriesAsync(requestParams));
  }, [dispatch, requestParams]);

  // Фильтрация категорий по поисковому запросу
  const filteredCategories = useMemo(() => {
    if (!debouncedSearchTerm?.trim()) return categories;
    const searchLower = debouncedSearchTerm.toLowerCase();
    return categories.filter((category) =>
      category.name?.toLowerCase().includes(searchLower)
    );
  }, [categories, debouncedSearchTerm]);

  // Мемоизация сообщения для модального окна удаления
  const deleteModalMessage = useMemo(
    () => {
      const count = selectedCount;
      if (count === 1) return "Вы уверены, что хотите удалить выбранную категорию?";
      return `Вы уверены, что хотите удалить ${count} категорий?`;
    },
    [selectedCount]
  );

  return (
    <div className="warehouse-page">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon">
            <div className="warehouse-header__icon-box">📁</div>
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Категории</h1>
            <p className="warehouse-header__subtitle">
              Управление категориями склада
            </p>
          </div>
        </div>
        <button
          className="warehouse-header__create-btn"
          onClick={handleCreateCategory}
        >
          <Plus size={16} />
          Создать категорию
        </button>
      </div>

      <SearchSection
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onOpenFilters={null}
        count={categoriesCount}
        foundCount={filteredCategories.length}
      />

      <BulkActionsBar
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        onBulkDelete={handleBulkDelete}
        isDeleting={bulkDeleting || deletingCategory}
      />

      <div className="warehouse-table-container w-full">
        {viewMode === VIEW_MODES.TABLE ? (
          <CategoryTable
            categories={filteredCategories}
            loading={categoriesLoading}
            selectedRows={selectedRows}
            isAllSelected={isAllSelected}
            onRowSelect={handleRowSelect}
            onSelectAll={handleSelectAll}
            onCategoryClick={handleCategoryClick}
            getRowNumber={getRowNumber}
          />
        ) : (
          <CategoryCards
            categories={filteredCategories}
            loading={categoriesLoading}
            selectedRows={selectedRows}
            isAllSelected={isAllSelected}
            onRowSelect={handleRowSelect}
            onSelectAll={handleSelectAll}
            onCategoryClick={handleCategoryClick}
            getRowNumber={getRowNumber}
          />
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          count={categoriesCount}
          loading={categoriesLoading}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          onPageChange={handlePageChange}
        />
      </div>

      {showCreateModal && (
        <CreateCategoryModal
          onClose={handleModalClose}
          category={editingCategory}
          onSaved={handleCategorySaved}
        />
      )}

      <AlertModal
        open={showDeleteConfirmModal}
        type="warning"
        title="Подтверждение удаления"
        message={deleteModalMessage}
        okText="Удалить"
        onClose={() => setShowDeleteConfirmModal(false)}
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
};

export default Categories;

