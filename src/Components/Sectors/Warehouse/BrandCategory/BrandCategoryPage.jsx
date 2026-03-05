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
import CategoryTable from "../Categories/components/CategoryTable";
import CreateBrandModal from "../Brands/components/CreateBrandModal";
import CreateCategoryModal from "../Categories/components/CreateCategoryModal";
import CreatePaymentCategoryModal from "./components/CreatePaymentCategoryModal";
import PaymentCategoryTable from "./components/PaymentCategoryTable";
import warehouseAPI from "../../../../api/warehouse";
import {
  fetchWarehouseBrandsAsync,
  bulkDeleteWarehouseBrandsAsync,
  fetchWarehouseCategoriesAsync,
  bulkDeleteWarehouseCategoriesAsync,
} from "../../../../store/creators/warehouseCreators";
import { useSearch } from "../../Market/Warehouse/hooks/useSearch";
import { usePagination } from "../../Market/Warehouse/hooks/usePagination";
import { useProductSelection } from "../../Market/Warehouse/hooks/useProductSelection";

const TABS = {
  BRANDS: "brands",
  CATEGORIES: "categories",
  PAYMENT_CATEGORIES: "payment_categories",
};

const BrandCategoryPage = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Определяем активную вкладку из URL пути
  const activeTab = useMemo(() => {
    if (location.pathname.includes("/payment_categories")) {
      return TABS.PAYMENT_CATEGORIES;
    }
    if (location.pathname.includes("/categories")) {
      return TABS.CATEGORIES;
    }
    return TABS.BRANDS;
  }, [location.pathname]);

  const setActiveTab = useCallback(
    (tab) => {
      const newParams = new URLSearchParams(searchParams);
      const page = newParams.get("page");
      const search = newParams.get("search");
      const params = new URLSearchParams();
      if (page && page !== "1") params.set("page", page);
      if (search) params.set("search", search);
      const queryString = params.toString();
      const basePath =
        tab === TABS.BRANDS
          ? "/crm/warehouse/brands"
          : tab === TABS.PAYMENT_CATEGORIES
            ? "/crm/warehouse/payment_categories"
            : "/crm/warehouse/categories";
      navigate(`${basePath}${queryString ? `?${queryString}` : ""}`, {
        replace: true,
      });
    },
    [navigate, searchParams],
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
  const [showCreatePaymentCategoryModal, setShowCreatePaymentCategoryModal] =
    useState(false);
  const [editingPaymentCategory, setEditingPaymentCategory] = useState(null);
  const [paymentCategories, setPaymentCategories] = useState([]);
  const [loadingPaymentCategories, setLoadingPaymentCategories] =
    useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

  // Хуки для управления данными
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useSearch();
  const currentPageFromUrl = useMemo(
    () => parseInt(searchParams.get("page") || "1", 10),
    [searchParams],
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

  const loadPaymentCategories = useCallback(async () => {
    setLoadingPaymentCategories(true);
    try {
      const data = await warehouseAPI.listMoneyCategories();
      setPaymentCategories(data?.results ?? (Array.isArray(data) ? data : []));
    } catch {
      setPaymentCategories([]);
    } finally {
      setLoadingPaymentCategories(false);
    }
  }, []);

  // Загрузка данных в зависимости от активной вкладки
  React.useEffect(() => {
    if (activeTab === TABS.BRANDS) {
      dispatch(fetchWarehouseBrandsAsync(requestParams));
    } else if (activeTab === TABS.CATEGORIES) {
      dispatch(fetchWarehouseCategoriesAsync(requestParams));
    } else if (activeTab === TABS.PAYMENT_CATEGORIES) {
      loadPaymentCategories();
    }
  }, [dispatch, requestParams, activeTab, loadPaymentCategories]);

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
    }
    if (activeTab === TABS.PAYMENT_CATEGORIES) {
      return {
        count: paymentCategories.length,
        next: null,
        previous: null,
        loading: loadingPaymentCategories,
        deleting: false,
      };
    }
    return {
      count: categoriesCount,
      next: categoriesNext,
      previous: categoriesPrevious,
      loading: categoriesLoading,
      deleting: deletingCategory,
    };
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
    paymentCategories.length,
    loadingPaymentCategories,
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
    if (activeTab === TABS.BRANDS) return brands;
    if (activeTab === TABS.PAYMENT_CATEGORIES) return paymentCategories;
    return categories;
  }, [activeTab, brands, categories, paymentCategories]);

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

  // Обработчики событий
  const handleItemClick = useCallback(
    (item) => {
      if (activeTab === TABS.BRANDS) {
        setEditingBrand(item);
        setShowCreateBrandModal(true);
      } else if (activeTab === TABS.PAYMENT_CATEGORIES) {
        setEditingPaymentCategory(item);
        setShowCreatePaymentCategoryModal(true);
      } else {
        setEditingCategory(item);
        setShowCreateCategoryModal(true);
      }
    },
    [activeTab],
  );

  const handlePageChange = useCallback(
    (newPage) => {
      handlePageChangeBase(newPage, () => setSelectedRows(new Set()));
    },
    [handlePageChangeBase, setSelectedRows],
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
          }),
        ).unwrap();
        dispatch(fetchWarehouseBrandsAsync(requestParams));
      } else {
        await dispatch(
          bulkDeleteWarehouseCategoriesAsync({
            ids: Array.from(selectedRows),
            soft: true,
            require_all: false,
          }),
        ).unwrap();
        dispatch(fetchWarehouseCategoriesAsync(requestParams));
      }

      setSelectedRows(new Set());
    } catch (e) {
      console.error(
        `Ошибка при удалении ${activeTab === TABS.BRANDS ? "брендов" : "категорий"}:`,
        e,
      );
      alert(
        `Не удалось удалить ${activeTab === TABS.BRANDS ? "бренды" : "категории"}: ` +
          (e?.message || e?.detail || "Неизвестная ошибка"),
      );
    } finally {
      setBulkDeleting(false);
    }
  }, [dispatch, selectedRows, requestParams, activeTab]);

  const handleCreate = useCallback(() => {
    if (activeTab === TABS.BRANDS) {
      setEditingBrand(null);
      setShowCreateBrandModal(true);
    } else if (activeTab === TABS.PAYMENT_CATEGORIES) {
      setEditingPaymentCategory(null);
      setShowCreatePaymentCategoryModal(true);
    } else {
      setEditingCategory(null);
      setShowCreateCategoryModal(true);
    }
  }, [activeTab]);

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

  const handlePaymentCategoryModalClose = useCallback(() => {
    setShowCreatePaymentCategoryModal(false);
    setEditingPaymentCategory(null);
  }, []);

  const handlePaymentCategorySaved = useCallback(() => {
    loadPaymentCategories();
  }, [loadPaymentCategories]);

  // Фильтрация элементов по поисковому запросу
  const filteredItems = useMemo(() => {
    if (!debouncedSearchTerm?.trim()) return currentItems;
    const searchLower = debouncedSearchTerm.toLowerCase();
    return currentItems.filter((item) => {
      const name = item.name ?? item.title ?? "";
      return String(name).toLowerCase().includes(searchLower);
    });
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
    if (activeTab === TABS.BRANDS) return "Бренды";
    if (activeTab === TABS.PAYMENT_CATEGORIES) return "Категории платежей";
    return "Категории";
  };

  const getSubtitle = () => {
    if (activeTab === TABS.BRANDS) return "Управление брендами склада";
    if (activeTab === TABS.PAYMENT_CATEGORIES)
      return "Управление категориями платежей (приход/расход)";
    return "Управление категориями склада";
  };

  const getCreateButtonText = () => {
    if (activeTab === TABS.BRANDS) return "Создать бренд";
    if (activeTab === TABS.PAYMENT_CATEGORIES) return "Создать категорию";
    return "Создать категорию";
  };

  return (
    <div className="warehouse-page brand-category-page">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon">
            <div className="warehouse-header__icon-box">
              {activeTab === TABS.BRANDS
                ? "🏷️"
                : activeTab === TABS.PAYMENT_CATEGORIES
                  ? "💰"
                  : "📁"}
            </div>
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">{getTitle()}</h1>
            <p className="warehouse-header__subtitle">{getSubtitle()}</p>
          </div>
        </div>
        <button className="warehouse-header__create-btn" onClick={handleCreate}>
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
        <button
          className={`brand-category-tabs__tab ${
            activeTab === TABS.PAYMENT_CATEGORIES
              ? "brand-category-tabs__tab--active"
              : ""
          }`}
          onClick={() => setActiveTab(TABS.PAYMENT_CATEGORIES)}
        >
          Категории платежей
        </button>
      </div>

      <SearchSection
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onOpenFilters={null}
        count={currentData.count}
        foundCount={filteredItems.length}
        showViewModeToggle={false}
      />

      {activeTab !== TABS.PAYMENT_CATEGORIES && (
        <BulkActionsBar
          selectedCount={selectedCount}
          onClearSelection={clearSelection}
          onBulkDelete={handleBulkDelete}
          isDeleting={bulkDeleting || currentData.deleting}
        />
      )}

      <div className="warehouse-table-container w-full">
        {activeTab === TABS.PAYMENT_CATEGORIES ? (
          <PaymentCategoryTable
            categories={filteredItems}
            loading={loadingPaymentCategories}
            onCategoryClick={handleItemClick}
            getRowNumber={(index) => index + 1}
          />
        ) : activeTab === TABS.BRANDS ? (
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
        )}

        {activeTab !== TABS.PAYMENT_CATEGORIES && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            count={currentData.count}
            loading={currentData.loading}
            hasNextPage={hasNextPage}
            hasPrevPage={hasPrevPage}
            onPageChange={handlePageChange}
          />
        )}
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

      {showCreatePaymentCategoryModal && (
        <CreatePaymentCategoryModal
          onClose={handlePaymentCategoryModalClose}
          category={editingPaymentCategory}
          onSaved={handlePaymentCategorySaved}
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
