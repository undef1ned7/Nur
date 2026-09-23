import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import "./Brands.scss";
import AlertModal from "../../../common/AlertModal/AlertModal";
import SearchSection from "../../Market/Warehouse/components/SearchSection";
import BulkActionsBar from "../../Market/Warehouse/components/BulkActionsBar";
import Pagination from "../../Market/Warehouse/components/Pagination";
import BrandTable from "./components/BrandTable";
import BrandCards from "./components/BrandCards";
import CreateBrandModal from "./components/CreateBrandModal";
import {
  fetchWarehouseBrandsAsync,
  bulkDeleteWarehouseBrandsAsync,
} from "../../../../store/creators/warehouseCreators";
import { useSearch } from "../../Market/Warehouse/hooks/useSearch";
import { usePagination } from "../../Market/Warehouse/hooks/usePagination";
import { useProductSelection } from "../../Market/Warehouse/hooks/useProductSelection";
import { STORAGE_KEY, VIEW_MODES } from "../../Market/Warehouse/constants";

const Brands = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Redux state
  const {
    brands,
    brandsCount,
    brandsNext,
    brandsPrevious,
    brandsLoading,
    deletingBrand,
  } = useSelector((state) => state.warehouse);

  // Состояние фильтров и модальных окон
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return VIEW_MODES.TABLE;
    const saved = localStorage.getItem(`${STORAGE_KEY}_brands`);
    if (saved === VIEW_MODES.TABLE || saved === VIEW_MODES.CARDS) return saved;
    const isSmall = window.matchMedia("(max-width: 1199px)").matches;
    return isSmall ? VIEW_MODES.CARDS : VIEW_MODES.TABLE;
  });

  // Хуки для управления данными
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useSearch(
    "warehouse:brands:search",
  );
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

  // Загрузка брендов
  useEffect(() => {
    dispatch(fetchWarehouseBrandsAsync(requestParams));
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
  } = usePagination(brandsCount, brandsNext, brandsPrevious);

  // Сброс на первую страницу при изменении поиска
  useEffect(() => {
    if (debouncedSearchTerm) {
      resetToFirstPage();
    }
  }, [debouncedSearchTerm, resetToFirstPage]);

  // Хук для выбора брендов
  const {
    selectedRows,
    isAllSelected,
    selectedCount,
    handleRowSelect,
    handleSelectAll,
    clearSelection,
    setSelectedRows,
  } = useProductSelection(brands);

  // Сохранение режима просмотра
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`${STORAGE_KEY}_brands`, viewMode);
    }
  }, [viewMode]);

  // Обработчики событий
  const handleBrandClick = useCallback(
    (brand) => {
      setEditingBrand(brand);
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
        bulkDeleteWarehouseBrandsAsync({
          ids: Array.from(selectedRows),
          soft: true,
          require_all: false,
        })
      ).unwrap();

      setSelectedRows(new Set());
      dispatch(fetchWarehouseBrandsAsync(requestParams));
    } catch (e) {
      console.error("Ошибка при удалении брендов:", e);
      alert(
        "Не удалось удалить бренды: " +
          (e?.message || e?.detail || "Неизвестная ошибка")
      );
    } finally {
      setBulkDeleting(false);
    }
  }, [dispatch, selectedRows, requestParams]);

  const handleCreateBrand = useCallback(() => {
    setEditingBrand(null);
    setShowCreateModal(true);
  }, []);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  const handleModalClose = useCallback(() => {
    setShowCreateModal(false);
    setEditingBrand(null);
  }, []);

  const handleBrandSaved = useCallback(() => {
    dispatch(fetchWarehouseBrandsAsync(requestParams));
  }, [dispatch, requestParams]);

  // Фильтрация брендов по поисковому запросу
  const filteredBrands = useMemo(() => {
    if (!debouncedSearchTerm?.trim()) return brands;
    const searchLower = debouncedSearchTerm.toLowerCase();
    return brands.filter((brand) =>
      brand.name?.toLowerCase().includes(searchLower)
    );
  }, [brands, debouncedSearchTerm]);

  // Мемоизация сообщения для модального окна удаления
  const deleteModalMessage = useMemo(
    () => {
      const count = selectedCount;
      if (count === 1) return "Вы уверены, что хотите удалить выбранный бренд?";
      return `Вы уверены, что хотите удалить ${count} брендов?`;
    },
    [selectedCount]
  );

  return (
    <div className="warehouse-page">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon">
            <div className="warehouse-header__icon-box">🏷️</div>
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Бренды</h1>
            <p className="warehouse-header__subtitle">
              Управление брендами склада
            </p>
          </div>
        </div>
        <button
          className="warehouse-header__create-btn"
          onClick={handleCreateBrand}
        >
          <Plus size={16} />
          Создать бренд
        </button>
      </div>

      <SearchSection
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onOpenFilters={null}
        count={brandsCount}
        foundCount={filteredBrands.length}
      />

      <BulkActionsBar
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        onBulkDelete={handleBulkDelete}
        isDeleting={bulkDeleting || deletingBrand}
      />

      <div className="warehouse-table-container w-full">
        {viewMode === VIEW_MODES.TABLE ? (
          <BrandTable
            brands={filteredBrands}
            loading={brandsLoading}
            selectedRows={selectedRows}
            isAllSelected={isAllSelected}
            onRowSelect={handleRowSelect}
            onSelectAll={handleSelectAll}
            onBrandClick={handleBrandClick}
            getRowNumber={getRowNumber}
          />
        ) : (
          <BrandCards
            brands={filteredBrands}
            loading={brandsLoading}
            selectedRows={selectedRows}
            isAllSelected={isAllSelected}
            onRowSelect={handleRowSelect}
            onSelectAll={handleSelectAll}
            onBrandClick={handleBrandClick}
            getRowNumber={getRowNumber}
          />
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          count={brandsCount}
          loading={brandsLoading}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          onPageChange={handlePageChange}
        />
      </div>

      {showCreateModal && (
        <CreateBrandModal
          onClose={handleModalClose}
          brand={editingBrand}
          onSaved={handleBrandSaved}
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

export default Brands;

