import React, { useState, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import "./BrandCategoryPage.scss";
import AlertModal from "../../../common/AlertModal/AlertModal";
import SearchSection from "../../Market/Warehouse/components/SearchSection";
import BulkActionsBar from "../../Market/Warehouse/components/BulkActionsBar";
import Pagination from "../../Market/Warehouse/components/Pagination";
import BrandTable from "../Brands/components/BrandTable";
import BrandCards from "../Brands/components/BrandCards";
import CategoryTable from "../Categories/components/CategoryTable";
import CategoryCards from "../Categories/components/CategoryCards";
import CreateBrandModal from "../Brands/components/CreateBrandModal";
import CreateCategoryModal from "../Categories/components/CreateCategoryModal";
import {
  fetchWarehouseBrandsAsync,
  bulkDeleteWarehouseBrandsAsync,
  fetchWarehouseCategoriesAsync,
  bulkDeleteWarehouseCategoriesAsync,
} from "../../../../store/creators/warehouseCreators";
import { useSearch } from "../../Market/Warehouse/hooks/useSearch";
import { usePagination } from "../../Market/Warehouse/hooks/usePagination";
import { useProductSelection } from "../../Market/Warehouse/hooks/useProductSelection";
import { STORAGE_KEY, VIEW_MODES } from "../../Market/Warehouse/constants";

const TABS = {
  BRANDS: "brands",
  CATEGORIES: "categories",
};

const BrandCategoryPage = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Определяем активную вкладку из URL пути
  const activeTab = useMemo(() => {
    // Если путь содержит "categories", открываем таб категорий
    if (location.pathname.includes("/categories")) {
      return TABS.CATEGORIES;
    }
    // По умолчанию - бренды
    return TABS.BRANDS;
  }, [location.pathname]);

  const setActiveTab = useCallback(
    (tab) => {
      // Сохраняем параметры пагинации и поиска
      const newParams = new URLSearchParams(searchParams);
      const page = newParams.get("page");
      const search = newParams.get("search");
      
      // Формируем новый URL с сохранением параметров
      const params = new URLSearchParams();
      if (page && page !== "1") {
        params.set("page", page);
      }
      if (search) {
        params.set("search", search);
      }
      
      const queryString = params.toString();
      const basePath = tab === TABS.BRANDS 
        ? "/crm/warehouse/brands" 
        : "/crm/warehouse/categories";
      
      navigate(`${basePath}${queryString ? `?${queryString}` : ""}`, { replace: true });
    },
    [navigate, searchParams]
  );

  // Redux state для брендов
  const {
    brands,
    brandsCount,
    brandsNext,
    brandsPrevious,
    brandsLoading,
    deletingBrand,
  } = useSelector((state) => state.warehouse);

  // Redux state для категорий
  const {
    categories,
    categoriesCount,
    categoriesNext,
    categoriesPrevious,
    categoriesLoading,
    deletingCategory,
  } = useSelector((state) => state.warehouse);

  // Состояние модальных окон
  const [showCreateBrandModal, setShowCreateBrandModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return VIEW_MODES.TABLE;
    const saved = localStorage.getItem(`${STORAGE_KEY}_brand_category`);
    if (saved === VIEW_MODES.TABLE || saved === VIEW_MODES.CARDS) return saved;
    const isSmall = window.matchMedia("(max-width: 1199px)").matches;
    return isSmall ? VIEW_MODES.CARDS : VIEW_MODES.TABLE;
  });

  // Хуки для управления данными
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useSearch();
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

  // Загрузка данных в зависимости от активной вкладки
  React.useEffect(() => {
    if (activeTab === TABS.BRANDS) {
      dispatch(fetchWarehouseBrandsAsync(requestParams));
    } else {
      dispatch(fetchWarehouseCategoriesAsync(requestParams));
    }
  }, [dispatch, requestParams, activeTab]);

  // Хук для пагинации (зависит от активной вкладки)
  const currentData = useMemo(() => {
    if (activeTab === TABS.BRANDS) {
      return {
        count: brandsCount,
        next: brandsNext,
        previous: brandsPrevious,
        loading: brandsLoading,
        deleting: deletingBrand,
      };
    } else {
      return {
        count: categoriesCount,
        next: categoriesNext,
        previous: categoriesPrevious,
        loading: categoriesLoading,
        deleting: deletingCategory,
      };
    }
  }, [
    activeTab,
    brandsCount,
    brandsNext,
    brandsPrevious,
    brandsLoading,
    deletingBrand,
    categoriesCount,
    categoriesNext,
    categoriesPrevious,
    categoriesLoading,
    deletingCategory,
  ]);

  const {
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    getRowNumber,
    handlePageChange: handlePageChangeBase,
    resetToFirstPage,
  } = usePagination(currentData.count, currentData.next, currentData.previous);

  // Сброс на первую страницу при изменении поиска
  React.useEffect(() => {
    if (debouncedSearchTerm) {
      resetToFirstPage();
    }
  }, [debouncedSearchTerm, resetToFirstPage]);

  // Данные для текущей вкладки
  const currentItems = useMemo(() => {
    return activeTab === TABS.BRANDS ? brands : categories;
  }, [activeTab, brands, categories]);

  // Хук для выбора элементов
  const {
    selectedRows,
    isAllSelected,
    selectedCount,
    handleRowSelect,
    handleSelectAll,
    clearSelection,
    setSelectedRows,
  } = useProductSelection(currentItems);

  // Сохранение режима просмотра
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`${STORAGE_KEY}_brand_category`, viewMode);
    }
  }, [viewMode]);

  // Обработчики событий
  const handleItemClick = useCallback(
    (item) => {
      if (activeTab === TABS.BRANDS) {
        setEditingBrand(item);
        setShowCreateBrandModal(true);
      } else {
        setEditingCategory(item);
        setShowCreateCategoryModal(true);
      }
    },
    [activeTab]
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
      if (activeTab === TABS.BRANDS) {
        await dispatch(
          bulkDeleteWarehouseBrandsAsync({
            ids: Array.from(selectedRows),
            soft: true,
            require_all: false,
          })
        ).unwrap();
        dispatch(fetchWarehouseBrandsAsync(requestParams));
      } else {
        await dispatch(
          bulkDeleteWarehouseCategoriesAsync({
            ids: Array.from(selectedRows),
            soft: true,
            require_all: false,
          })
        ).unwrap();
        dispatch(fetchWarehouseCategoriesAsync(requestParams));
      }

      setSelectedRows(new Set());
    } catch (e) {
      console.error(`Ошибка при удалении ${activeTab === TABS.BRANDS ? "брендов" : "категорий"}:`, e);
      alert(
        `Не удалось удалить ${activeTab === TABS.BRANDS ? "бренды" : "категории"}: ` +
          (e?.message || e?.detail || "Неизвестная ошибка")
      );
    } finally {
      setBulkDeleting(false);
    }
  }, [dispatch, selectedRows, requestParams, activeTab]);

  const handleCreate = useCallback(() => {
    if (activeTab === TABS.BRANDS) {
      setEditingBrand(null);
      setShowCreateBrandModal(true);
    } else {
      setEditingCategory(null);
      setShowCreateCategoryModal(true);
    }
  }, [activeTab]);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  const handleBrandModalClose = useCallback(() => {
    setShowCreateBrandModal(false);
    setEditingBrand(null);
  }, []);

  const handleCategoryModalClose = useCallback(() => {
    setShowCreateCategoryModal(false);
    setEditingCategory(null);
  }, []);

  const handleBrandSaved = useCallback(() => {
    dispatch(fetchWarehouseBrandsAsync(requestParams));
  }, [dispatch, requestParams]);

  const handleCategorySaved = useCallback(() => {
    dispatch(fetchWarehouseCategoriesAsync(requestParams));
  }, [dispatch, requestParams]);

  // Фильтрация элементов по поисковому запросу
  const filteredItems = useMemo(() => {
    if (!debouncedSearchTerm?.trim()) return currentItems;
    const searchLower = debouncedSearchTerm.toLowerCase();
    return currentItems.filter((item) =>
      item.name?.toLowerCase().includes(searchLower)
    );
  }, [currentItems, debouncedSearchTerm]);

  // Мемоизация сообщения для модального окна удаления
  const deleteModalMessage = useMemo(() => {
    const count = selectedCount;
    const itemType = activeTab === TABS.BRANDS ? "бренд" : "категорию";
    const itemTypePlural = activeTab === TABS.BRANDS ? "брендов" : "категорий";
    if (count === 1) {
      return `Вы уверены, что хотите удалить выбранный ${itemType}?`;
    }
    return `Вы уверены, что хотите удалить ${count} ${itemTypePlural}?`;
  }, [selectedCount, activeTab]);

  const getTitle = () => {
    return activeTab === TABS.BRANDS ? "Бренды" : "Категории";
  };

  const getSubtitle = () => {
    return activeTab === TABS.BRANDS
      ? "Управление брендами склада"
      : "Управление категориями склада";
  };

  const getCreateButtonText = () => {
    return activeTab === TABS.BRANDS ? "Создать бренд" : "Создать категорию";
  };

  return (
    <div className="warehouse-page">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon">
            <div className="warehouse-header__icon-box">
              {activeTab === TABS.BRANDS ? "🏷️" : "📁"}
            </div>
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">{getTitle()}</h1>
            <p className="warehouse-header__subtitle">{getSubtitle()}</p>
          </div>
        </div>
        <button
          className="warehouse-header__create-btn"
          onClick={handleCreate}
        >
          <Plus size={16} />
          {getCreateButtonText()}
        </button>
      </div>

      {/* Табы */}
      <div className="brand-category-tabs">
        <button
          className={`brand-category-tabs__tab ${
            activeTab === TABS.BRANDS ? "brand-category-tabs__tab--active" : ""
          }`}
          onClick={() => setActiveTab(TABS.BRANDS)}
        >
          Бренды
        </button>
        <button
          className={`brand-category-tabs__tab ${
            activeTab === TABS.CATEGORIES
              ? "brand-category-tabs__tab--active"
              : ""
          }`}
          onClick={() => setActiveTab(TABS.CATEGORIES)}
        >
          Категории
        </button>
      </div>

      <SearchSection
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onOpenFilters={null}
        count={currentData.count}
        foundCount={filteredItems.length}
      />

      <BulkActionsBar
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        onBulkDelete={handleBulkDelete}
        isDeleting={bulkDeleting || currentData.deleting}
      />

      <div className="warehouse-table-container w-full">
        {viewMode === VIEW_MODES.TABLE ? (
          activeTab === TABS.BRANDS ? (
            <BrandTable
              brands={filteredItems}
              loading={currentData.loading}
              selectedRows={selectedRows}
              isAllSelected={isAllSelected}
              onRowSelect={handleRowSelect}
              onSelectAll={handleSelectAll}
              onBrandClick={handleItemClick}
              getRowNumber={getRowNumber}
            />
          ) : (
            <CategoryTable
              categories={filteredItems}
              loading={currentData.loading}
              selectedRows={selectedRows}
              isAllSelected={isAllSelected}
              onRowSelect={handleRowSelect}
              onSelectAll={handleSelectAll}
              onCategoryClick={handleItemClick}
              getRowNumber={getRowNumber}
            />
          )
        ) : activeTab === TABS.BRANDS ? (
          <BrandCards
            brands={filteredItems}
            loading={currentData.loading}
            selectedRows={selectedRows}
            isAllSelected={isAllSelected}
            onRowSelect={handleRowSelect}
            onSelectAll={handleSelectAll}
            onBrandClick={handleItemClick}
            getRowNumber={getRowNumber}
          />
        ) : (
          <CategoryCards
            categories={filteredItems}
            loading={currentData.loading}
            selectedRows={selectedRows}
            isAllSelected={isAllSelected}
            onRowSelect={handleRowSelect}
            onSelectAll={handleSelectAll}
            onCategoryClick={handleItemClick}
            getRowNumber={getRowNumber}
          />
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          count={currentData.count}
          loading={currentData.loading}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          onPageChange={handlePageChange}
        />
      </div>

      {showCreateBrandModal && (
        <CreateBrandModal
          onClose={handleBrandModalClose}
          brand={editingBrand}
          onSaved={handleBrandSaved}
        />
      )}

      {showCreateCategoryModal && (
        <CreateCategoryModal
          onClose={handleCategoryModalClose}
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

export default BrandCategoryPage;

