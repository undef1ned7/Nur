import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./Warehouse.scss";
import FilterModal from "./components/FilterModal";
import AlertModal from "../../../common/AlertModal/AlertModal";
import WarehouseHeader from "./components/WarehouseHeader";
import SearchSection from "./components/SearchSection";
import BulkActionsBar from "./components/BulkActionsBar";
import ProductTable from "./components/ProductTable";
import ProductCards from "./components/ProductCards";
import Pagination from "./components/Pagination";
import {
  bulkDeleteProductsAsync,
  fetchProductsAsync,
} from "../../../../store/creators/productCreators";
import { useSearch } from "./hooks/useSearch";
import { usePagination } from "./hooks/usePagination";
import { useProductSelection } from "./hooks/useProductSelection";
import {
  useWarehouseData,
  useWarehouseReferences,
} from "./hooks/useWarehouseData";
import { STORAGE_KEY, VIEW_MODES } from "./constants";
import { formatDeleteMessage } from "./utils";
import ReactPortal from "../../../common/Portal/ReactPortal";

const Warehouse = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Реф для отслеживания предыдущих продуктов
  const prevProductsRef = useRef([]);
  // Реф для первого рендера
  const isInitialMountRef = useRef(true);
  // Состояние фильтров и модальных окон
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({});
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return VIEW_MODES.TABLE;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === VIEW_MODES.TABLE || saved === VIEW_MODES.CARDS) return saved;
    const isSmall = window.matchMedia("(max-width: 1199px)").matches;
    return isSmall ? VIEW_MODES.CARDS : VIEW_MODES.TABLE;
  });


  // Хуки для управления данными
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useSearch();
  const [searchParams] = useSearchParams();

  // Загрузка справочников
  const { brands, categories } = useWarehouseReferences();

  // Получаем текущую страницу из URL
  const currentPageFromUrl = useMemo(
    () => parseInt(searchParams.get("page") || "1", 10),
    [searchParams]
  );

  // Параметры запроса
  const requestParams = useMemo(() => {
    const params = {
      page: currentPageFromUrl,
      ...filters,
    };
    if (debouncedSearchTerm?.trim()) {
      params.search = debouncedSearchTerm.trim();
    }
    return params;
  }, [currentPageFromUrl, filters, debouncedSearchTerm]);

  // Загрузка товаров
  const { products, loading, count, next, previous } =
    useWarehouseData(requestParams);



  useEffect(() => {
    if (loading) return;
    // Пропускаем первый рендер
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    // Проверяем, что продукты изменились (новый запрос)
    const prevProducts = prevProductsRef.current;
    const currentProducts = products || [];

    // Сравниваем первые товары - если они разные, значит новый запрос
    const isNewData =
      prevProducts.length > 0 &&
      currentProducts.length > 0 &&
      prevProducts[0]?.id !== currentProducts[0]?.id;

    if (isNewData) {
      document.getElementById('root').scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    }
    prevProductsRef.current = currentProducts;
  }, [products]);

  // Хук для пагинации с реальными данными
  const {
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    getRowNumber,
    handlePageChange: handlePageChangeBase,
    resetToFirstPage,
  } = usePagination(count, next, previous);

  // Сброс на первую страницу при изменении поиска
  useEffect(() => {
    if (debouncedSearchTerm) {
      resetToFirstPage();
    }
  }, [debouncedSearchTerm, resetToFirstPage]);

  // Хук для выбора товаров
  const {
    selectedRows,
    isAllSelected,
    selectedCount,
    handleRowSelect,
    handleSelectAll,
    clearSelection,
    setSelectedRows,
  } = useProductSelection(products);

  // Сохранение режима просмотра
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, viewMode);
    }
  }, [viewMode]);

  // Обработчики событий
  const handleProductClick = useCallback(
    (product) => {
      navigate(`/crm/sklad/${product.id}`);
    },
    [navigate]
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
        bulkDeleteProductsAsync({
          ids: Array.from(selectedRows),
          soft: true,
          require_all: false,
        })
      ).unwrap();

      setSelectedRows(new Set());
      dispatch(fetchProductsAsync(requestParams));
    } catch (e) {
      console.error("Ошибка при удалении товаров:", e);
      alert(
        "Не удалось удалить товары: " +
        (e?.message || e?.detail || "Неизвестная ошибка")
      );
    } finally {
      setBulkDeleting(false);
    }
  }, [dispatch, selectedRows, requestParams]);

  const handleApplyFilters = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({});
  }, []);

  const handleCreateProduct = useCallback(() => {
    navigate("/crm/sklad/add-product");
  }, [navigate]);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  // Мемоизация сообщения для модального окна удаления
  const deleteModalMessage = useMemo(
    () => formatDeleteMessage(selectedCount),
    [selectedCount]
  );

  return (
    <div className="warehouse-page">
      <WarehouseHeader onCreateProduct={handleCreateProduct} />

      <SearchSection
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onOpenFilters={() => setShowFilterModal(true)}
        count={count}
        foundCount={products.length}
      />

      <BulkActionsBar
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        onBulkDelete={handleBulkDelete}
        isDeleting={bulkDeleting}
      />

      <div className="warehouse-table-container w-full">
        {viewMode === VIEW_MODES.TABLE ? (
          <ProductTable
            products={products}
            loading={loading}
            selectedRows={selectedRows}
            isAllSelected={isAllSelected}
            onRowSelect={handleRowSelect}
            onSelectAll={handleSelectAll}
            onProductClick={handleProductClick}
            getRowNumber={getRowNumber}
          />
        ) : (
          <ProductCards
            products={products}
            loading={loading}
            selectedRows={selectedRows}
            isAllSelected={isAllSelected}
            onRowSelect={handleRowSelect}
            onSelectAll={handleSelectAll}
            onProductClick={handleProductClick}
            getRowNumber={getRowNumber}
          />
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          count={count}
          loading={loading}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          onPageChange={handlePageChange}
        />
      </div>

      {showFilterModal && (
        <ReactPortal modalId="warehouse-filter-modal">
          <FilterModal
            onClose={() => setShowFilterModal(false)}
            currentFilters={filters}
            onApplyFilters={handleApplyFilters}
            onResetFilters={handleResetFilters}
            brands={brands}
            categories={categories}
          />
        </ReactPortal>
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

export default Warehouse;
