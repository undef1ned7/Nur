import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import "../Warehouses/Warehouses.scss";
import api from "../../../../api";
import AlertModal from "../../../common/AlertModal/AlertModal";
import WarehouseHeader from "../Warehouses/components/WarehouseHeader";
import SearchSection from "../../Market/Warehouse/components/SearchSection";
import FilterModal from "../../Market/Warehouse/components/FilterModal";
import BulkActionsBar from "../../Market/Warehouse/components/BulkActionsBar";
import ProductTable from "../../Market/Warehouse/components/ProductTable";
import ProductCards from "../../Market/Warehouse/components/ProductCards";
import Pagination from "../Warehouses/components/Pagination";
import {
  bulkDeleteProductsAsync,
  fetchProductsAsync,
} from "../../../../store/creators/productCreators";
import { useSearch } from "../Warehouses/hooks/useSearch";
import { usePagination } from "../Warehouses/hooks/usePagination";
import { useProductSelection } from "../../Market/Warehouse/hooks/useProductSelection";
import {
  useWarehouseData,
  useWarehouseReferences,
} from "../../Market/Warehouse/hooks/useWarehouseData";
import { STORAGE_KEY, VIEW_MODES } from "../../Market/Warehouse/constants";
import { formatDeleteMessage } from "../../Market/Warehouse/utils";

const Stocks = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { warehouse_id: warehouseIdFromParams } = useParams();
  const warehouseId = warehouseIdFromParams || searchParams.get("warehouse_id");

  // Получаем название склада из Redux store
  const warehouseName = useSelector((state) => {
    const warehouse = state.warehouse.list.find(
      (w) => String(w.id) === String(warehouseId)
    );
    return warehouse ? warehouse.name : "";
  });

  // "Закрепляем" название, чтобы оно не исчезало при обновлениях стора
  const [resolvedWarehouseName, setResolvedWarehouseName] = useState("");

  useEffect(() => {
    if (warehouseName) {
      setResolvedWarehouseName(warehouseName);
    }
  }, [warehouseName]);

  // Если в store нет названия (например, после обновления/перезагрузки),
  // подгружаем детали склада по id и сохраняем локально.
  useEffect(() => {
    let cancelled = false;

    const loadWarehouseName = async () => {
      if (!warehouseId) return;
      if (resolvedWarehouseName) return;

      try {
        const { data } = await api.get(`/warehouse/${warehouseId}/`);
        const name = data?.name || data?.title || "";
        if (!cancelled && name) {
          setResolvedWarehouseName(name);
        }
      } catch (_) {
        // не блокируем UI
      }
    };

    loadWarehouseName();

    return () => {
      cancelled = true;
    };
  }, [warehouseId, resolvedWarehouseName]);

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
    if (warehouseId) {
      params.warehouse = warehouseId;
    }
    if (debouncedSearchTerm?.trim()) {
      params.search = debouncedSearchTerm.trim();
    }
    return params;
  }, [currentPageFromUrl, filters, debouncedSearchTerm, warehouseId]);

  // Загрузка товаров
  const { products, loading, count, next, previous } =
    useWarehouseData(requestParams);

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
      navigate(`/crm/warehouse/products/${product.id}`);
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
      // fetchProductsAsync сам выберет нужный эндпоинт (warehouse/{id}/products/),
      // если в requestParams есть warehouse
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

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  const handleCreateProduct = useCallback(() => {
    if (warehouseId) {
      navigate(`/crm/warehouse/stocks/add-product?warehouse_id=${warehouseId}`);
    } else {
      navigate("/crm/warehouse/stocks/add-product");
    }
  }, [navigate, warehouseId]);

  // Мемоизация сообщения для модального окна удаления
  const deleteModalMessage = useMemo(
    () => formatDeleteMessage(selectedCount),
    [selectedCount]
  );

  return (
    <div className="warehouse-page">
      <WarehouseHeader
        onCreateProduct={handleCreateProduct}
        title={
          resolvedWarehouseName
            ? `Товары склада: ${resolvedWarehouseName}`
            : "Товары склада"
        }
        subtitle="Управление товарами на складе"
      />

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
        <FilterModal
          onClose={() => setShowFilterModal(false)}
          currentFilters={filters}
          onApplyFilters={handleApplyFilters}
          onResetFilters={handleResetFilters}
          brands={brands}
          categories={categories}
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

export default Stocks;
