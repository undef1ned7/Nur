import {
  lazy,
  Suspense,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./Warehouse.scss";
import AlertModal from "../../../common/AlertModal/AlertModal";
import BarcodeAmbiguityModal from "../../../common/BarcodeAmbiguityModal/BarcodeAmbiguityModal";
import WarehouseHeader from "./components/WarehouseHeader";
import SearchSection from "./components/SearchSection";
import BulkActionsBar from "./components/BulkActionsBar";
import ProductTable from "./components/ProductTable";
import ProductCards from "./components/ProductCards";
import Pagination from "./components/Pagination";
import ReactPortal from "../../../common/Portal/ReactPortal";
import DataContainer from "../../../common/DataContainer/DataContainer";
import {
  bulkDeleteProductsAsync,
  bulkUpdateProductsAsync,
  fetchProductsAsync,
} from "../../../../store/creators/productCreators";
import { useSearch } from "./hooks/useSearch";
import { usePagination } from "./hooks/usePagination";
import { useProductSelection } from "./hooks/useProductSelection";
import { useWarehouseData } from "./hooks/useWarehouseData";
import { useWarehouseFilterData } from "./hooks/useWarehouseFilterData";
import { STORAGE_KEY, VIEW_MODES } from "./constants";
import { formatDeleteMessage } from "./utils";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useAlert } from "@/hooks/useDialog";

const FilterModal = lazy(() => import("./components/FilterModal"));
const BulkEditModal = lazy(() => import("./components/BulkEditModal"));
const WarehouseBarcodeScanner = lazy(
  () => import("./components/WarehouseBarcodeScanner"),
);

const WAREHOUSE_SELECTED_IDS_KEY = "marketWarehouseSelectedProductIds";
const WAREHOUSE_SELECTED_SNAPSHOTS_KEY = "marketWarehouseSelectedProductSnapshots";

const loadSnapshotsFromStorage = () => {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(WAREHOUSE_SELECTED_SNAPSHOTS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out = {};
    Object.entries(parsed).forEach(([k, v]) => {
      if (v && typeof v === "object") out[String(k)] = v;
    });
    return out;
  } catch {
    return {};
  }
};

const pickProductSnapshot = (product) => ({
  id: product.id,
  name: product.name,
  quantity: product.quantity ?? 0,
  unit: product.unit || "шт",
  code: product.code || product.article,
  article: product.article,
  barcode: product.barcode,
  alternate_barcodes: product.alternate_barcodes,
});

const scheduleIdleTask = (callback) => {
  if (typeof requestIdleCallback === "function") {
    return requestIdleCallback(callback, { timeout: 2500 });
  }
  return setTimeout(callback, 800);
};

const cancelIdleTask = (id) => {
  if (typeof cancelIdleCallback === "function") {
    cancelIdleCallback(id);
    return;
  }
  clearTimeout(id);
};

const Warehouse = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const alert = useAlert();

  // Реф для отслеживания предыдущих продуктов
  const prevProductsRef = useRef([]);
  // Реф для первого рендера
  const isInitialMountRef = useRef(true);
  // Состояние фильтров и модальных окон
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({});
  const [scanLookupLoading, setScanLookupLoading] = useState(false);
  const [enableBarcodeScanner, setEnableBarcodeScanner] = useState(false);
  const [barcodeAmbiguity, setBarcodeAmbiguity] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
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

  const { brands, categories, suppliers, suppliersLoading } =
    useWarehouseFilterData(showFilterModal);

  useEffect(() => {
    const taskId = scheduleIdleTask(() => setEnableBarcodeScanner(true));
    return () => cancelIdleTask(taskId);
  }, []);

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
  } = useProductSelection(products, WAREHOUSE_SELECTED_IDS_KEY);

  const [selectedSnapshots, setSelectedSnapshots] = useState(
    loadSnapshotsFromStorage,
  );

  const scannerBlocked =
    showFilterModal ||
    showDeleteConfirmModal ||
    showBulkEditModal ||
    Boolean(barcodeAmbiguity);

  const handleScanStart = useCallback(() => setScanLookupLoading(true), []);
  const handleScanEnd = useCallback(() => setScanLookupLoading(false), []);
  const handleScanAmbiguity = useCallback(
    (ambiguity) => setBarcodeAmbiguity(ambiguity),
    [],
  );

  useEffect(() => {
    setSelectedSnapshots((prev) => {
      const next = { ...prev };
      (products || []).forEach((p) => {
        const sid = String(p.id);
        if (selectedRows.has(sid)) {
          next[sid] = pickProductSnapshot(p);
        }
      });
      Object.keys(next).forEach((id) => {
        if (!selectedRows.has(id)) delete next[id];
      });
      try {
        sessionStorage.setItem(
          WAREHOUSE_SELECTED_SNAPSHOTS_KEY,
          JSON.stringify(next),
        );
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [products, selectedRows]);

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
      handlePageChangeBase(newPage);
    },
    [handlePageChangeBase],
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
      const errorMessage = validateResErrors(e, "Ошибка при удалении товаров");
      alert(errorMessage, true);
    } finally {
      setBulkDeleting(false);
    }
  }, [dispatch, selectedRows, requestParams]);

  const handleBulkEdit = useCallback(() => {
    if (selectedCount === 0) return;
    setShowBulkEditModal(true);
  }, [selectedCount]);

  const confirmBulkEdit = useCallback(
    async (changes) => {
      if (selectedRows.size === 0) return;
      setBulkUpdating(true);
      try {
        const result = await dispatch(
          bulkUpdateProductsAsync({
            ids: Array.from(selectedRows),
            ...changes,
            require_all: false,
          })
        ).unwrap();

        setShowBulkEditModal(false);
        setSelectedRows(new Set());

        const failed = Number(result?.failed) || 0;
        if (failed > 0) {
          alert(
            `Обновлено товаров: ${result?.updated ?? 0}, не удалось: ${failed}`,
            true,
          );
        }

        dispatch(fetchProductsAsync(requestParams));
      } catch (e) {
        const errorMessage = validateResErrors(
          e,
          "Ошибка при изменении товаров",
        );
        alert(errorMessage, true);
      } finally {
        setBulkUpdating(false);
      }
    },
    [dispatch, selectedRows, setSelectedRows, requestParams, alert],
  );

  const handleApplyFilters = useCallback(
    (newFilters) => {
      setFilters(newFilters);
      resetToFirstPage();
    },
    [resetToFirstPage],
  );

  const handleResetFilters = useCallback(() => {
    setFilters({});
    resetToFirstPage();
  }, [resetToFirstPage]);

  const handleCreateProduct = useCallback(() => {
    navigate("/crm/sklad/add-product");
  }, [navigate]);

  const selectedProducts = useMemo(() => {
    if (!selectedRows?.size) return [];
    return [...selectedRows]
      .map((id) => selectedSnapshots[id])
      .filter(Boolean);
  }, [selectedRows, selectedSnapshots]);

  const handleOpenInventory = useCallback(() => {
    if (selectedProducts.length === 0) {
      navigate("/crm/market/documents?tab=inventory");
      return;
    }
    navigate("/crm/market/documents?tab=inventory", {
      state: { inventoryProducts: selectedProducts },
    });
  }, [navigate, selectedProducts]);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  const deleteModalMessage = useMemo(
    () => formatDeleteMessage(selectedCount),
    [selectedCount],
  );

  return (
    <div className="warehouse-page">
      <WarehouseHeader
        onCreateProduct={handleCreateProduct}
        onInventory={handleOpenInventory}
        selectedCount={selectedCount}
      />

      <SearchSection
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        scanLookupLoading={scanLookupLoading}
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
        onBulkEdit={handleBulkEdit}
        isDeleting={bulkDeleting}
        isUpdating={bulkUpdating}
      />
      <DataContainer>
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
      </DataContainer>

      {showFilterModal && (
        <ReactPortal modalId="warehouse-filter-modal">
          <Suspense fallback={null}>
            <FilterModal
              onClose={() => setShowFilterModal(false)}
              currentFilters={filters}
              onApplyFilters={handleApplyFilters}
              onResetFilters={handleResetFilters}
              brands={brands}
              categories={categories}
              suppliers={suppliers}
              suppliersLoading={suppliersLoading}
            />
          </Suspense>
        </ReactPortal>
      )}

      {showBulkEditModal && (
        <ReactPortal modalId="warehouse-bulk-edit-modal">
          <Suspense fallback={null}>
            <BulkEditModal
              selectedCount={selectedCount}
              onClose={() => setShowBulkEditModal(false)}
              onApply={confirmBulkEdit}
              saving={bulkUpdating}
            />
          </Suspense>
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

      <BarcodeAmbiguityModal
        open={Boolean(barcodeAmbiguity)}
        message={barcodeAmbiguity?.message}
        matches={barcodeAmbiguity?.matches}
        onSelect={(match) => {
          setBarcodeAmbiguity(null);
          navigate(`/crm/sklad/${match.id}`);
        }}
        onClose={() => setBarcodeAmbiguity(null)}
      />

      {enableBarcodeScanner && (
        <Suspense fallback={null}>
          <WarehouseBarcodeScanner
            isBlocked={scannerBlocked}
            onScanStart={handleScanStart}
            onScanEnd={handleScanEnd}
            onAmbiguity={handleScanAmbiguity}
          />
        </Suspense>
      )}
    </div>
  );
};

export default Warehouse;
