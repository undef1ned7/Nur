import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./Warehouse.scss";
import api from "../../../../api";
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
import useScanDetection from "use-scan-detection";
import { useSearch } from "./hooks/useSearch";
import { usePagination } from "./hooks/usePagination";
import { useProductSelection } from "./hooks/useProductSelection";
import {
  useWarehouseData,
  useWarehouseReferences,
} from "./hooks/useWarehouseData";
import { STORAGE_KEY, VIEW_MODES } from "./constants";
import { formatDeleteMessage } from "./utils";

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
import ReactPortal from "../../../common/Portal/ReactPortal";
import DataContainer from "../../../common/DataContainer/DataContainer";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useAlert } from "@/hooks/useDialog";

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
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [scanLookupLoading, setScanLookupLoading] = useState(false);
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

  useEffect(() => {
    let mounted = true;

    const loadSuppliers = async () => {
      try {
        setSuppliersLoading(true);
        const res = await api.get("/main/clients/", {
          params: { type: "suppliers", page_size: 500 },
        });
        const nextSuppliers = res?.data?.results || res?.data || [];
        if (!mounted) return;
        setSuppliers(Array.isArray(nextSuppliers) ? nextSuppliers : []);
      } catch (error) {
        if (!mounted) return;
        console.error("Ошибка при загрузке поставщиков склада:", error);
        setSuppliers([]);
      } finally {
        if (mounted) setSuppliersLoading(false);
      }
    };

    void loadSuppliers();

    return () => {
      mounted = false;
    };
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
  const barcodeProcessingRef = useRef(false);
  const lastScanTimeRef = useRef(0);
  const lastScannedBarcodeRef = useRef("");
  const isScanningRef = useRef(false);

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

  const handleApplyFilters = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({});
  }, []);

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

  useScanDetection({
    minLength: 3,
    onComplete: async (barcode) => {
      const scanned = String(barcode || "").trim();
      if (!scanned || barcodeProcessingRef.current) return;

      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.isContentEditable)
      ) {
        return;
      }
      if (showFilterModal || showDeleteConfirmModal) return;

      const now = Date.now();
      const isDuplicateScan =
        lastScannedBarcodeRef.current === scanned &&
        now - lastScanTimeRef.current < 1500;
      if (isDuplicateScan || isScanningRef.current) return;

      barcodeProcessingRef.current = true;
      isScanningRef.current = true;
      lastScannedBarcodeRef.current = scanned;
      lastScanTimeRef.current = now;
      setScanLookupLoading(true);
      let tempSaleId = null;
      try {
        const startRes = await api.post("/main/pos/sales/start/", {
          order_discount_total: 0,
        });
        tempSaleId = startRes?.data?.id;
        if (!tempSaleId) {
          alert("Не удалось подготовить поиск по штрихкоду.", true);
          return;
        }

        const scanRes = await api.post(`/main/pos/sales/${tempSaleId}/scan/`, {
          barcode: scanned,
        });

        const scanData = scanRes?.data || {};
        const scanItems = Array.isArray(scanData?.items)
          ? scanData.items
          : Array.isArray(scanData?.cart?.items)
            ? scanData.cart.items
            : [];

        const productId =
          scanItems.length > 0
            ? scanItems[scanItems.length - 1]?.product ||
              scanItems[scanItems.length - 1]?.product_id
            : null;

        if (productId) {
          navigate(`/crm/sklad/${productId}`);
          return;
        }

        alert("Товар с таким штрихкодом не найден.", true);
      } catch (error) {
        const errorMessage = validateResErrors(
          error,
          "Ошибка поиска товара по штрихкоду",
        );
        alert(errorMessage, true);
      } finally {
        if (tempSaleId) {
          try {
            await api.delete(`/main/pos/sales/${tempSaleId}/`);
          } catch {
            // ignore temporary sale cleanup errors
          }
        }
        barcodeProcessingRef.current = false;
        setScanLookupLoading(false);
        setTimeout(() => {
          isScanningRef.current = false;
        }, 300);
      }
    },
  });

  // Мемоизация сообщения для модального окна удаления
  const deleteModalMessage = useMemo(
    () => formatDeleteMessage(selectedCount),
    [selectedCount]
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
        isDeleting={bulkDeleting}
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
