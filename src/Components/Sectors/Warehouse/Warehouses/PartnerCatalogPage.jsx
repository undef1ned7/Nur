import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Package,
  RefreshCw,
  Search,
} from "lucide-react";
import WarehouseHeader from "./components/WarehouseHeader";
import PartnerCatalogSelectionBar from "./components/PartnerCatalogSelectionBar";
import StockPartnershipTransferModal from "./components/StockPartnershipTransferModal";
import Pagination from "./components/Pagination";
import { usePagination } from "./hooks/usePagination";
import { useSearch } from "./hooks/useSearch";
import { PAGE_SIZE } from "./constants";
import {
  extractPartnershipError,
  filterProducts,
  getProductQty,
  mapOwnProductRow,
  normalizeList,
  warehouseLabel,
} from "./partnership/partnershipHelpers";
import {
  getStockPartnerCatalog,
  listWarehouseProducts,
} from "../../../../api/warehouse";
import { fetchWarehousesAsync } from "../../../../store/creators/warehouseCreators";
import "./PartnerCatalogPage.scss";
import "./Warehouses.scss";

const DIRECTION = {
  RECEIVE: "receive",
  SEND: "send",
};

const parsePaginationMeta = (data, listLength) => ({
  count: typeof data?.count === "number" ? data.count : listLength,
  next: data?.next ?? null,
  previous: data?.previous ?? null,
});

const PartnerCatalogPage = () => {
  const { partnerId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();

  const direction =
    searchParams.get("direction") === DIRECTION.SEND
      ? DIRECTION.SEND
      : DIRECTION.RECEIVE;

  const ownWarehouses = useSelector((state) => state.warehouse.list || []);
  const { searchTerm: productSearch, debouncedSearchTerm, setSearchTerm: setProductSearch } =
    useSearch();

  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [catalogData, setCatalogData] = useState(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [ownProducts, setOwnProducts] = useState({
    list: [],
    count: 0,
    next: null,
    previous: null,
  });
  const [ownProductsLoading, setOwnProductsLoading] = useState(false);
  const prevDebouncedSearchRef = useRef(debouncedSearchTerm);

  const [selectedProducts, setSelectedProducts] = useState(() => new Map());
  const [transferState, setTransferState] = useState({
    open: false,
    mode: DIRECTION.RECEIVE,
    product: null,
    products: null,
    warehouseFromId: null,
  });

  const partnerName =
    catalogData?.partner_company?.name || "Партнёр";

  const isReceive = direction === DIRECTION.RECEIVE;

  const partnerWarehouses = catalogData?.warehouses || [];

  const activeWarehouses = useMemo(() => {
    if (isReceive) return partnerWarehouses;
    return ownWarehouses;
  }, [isReceive, partnerWarehouses, ownWarehouses]);

  const currentPageFromUrl = useMemo(
    () => parseInt(searchParams.get("page") || "1", 10),
    [searchParams],
  );

  const loadCatalog = useCallback(async () => {
    if (!partnerId) return;
    setCatalogLoading(true);
    setCatalogError("");
    try {
      const data = await getStockPartnerCatalog(partnerId);
      setCatalogData(data);
    } catch (e) {
      console.error(e);
      setCatalogError(extractPartnershipError(e));
      setCatalogData(null);
    } finally {
      setCatalogLoading(false);
    }
  }, [partnerId]);

  const loadOwnWarehouseProducts = useCallback(
    async (warehouseId, page = 1, search = "") => {
      if (!warehouseId) return;
      setOwnProductsLoading(true);
      try {
        const params = {
          page,
          page_size: PAGE_SIZE,
        };
        const trimmedSearch = search.trim();
        if (trimmedSearch) {
          params.search = trimmedSearch;
        }
        const data = await listWarehouseProducts(warehouseId, params);
        const list = normalizeList(data).map(mapOwnProductRow);
        const meta = parsePaginationMeta(data, list.length);
        setOwnProducts({ list, ...meta });
      } catch (e) {
        console.error(e);
        setOwnProducts({
          list: [],
          count: 0,
          next: null,
          previous: null,
        });
      } finally {
        setOwnProductsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    dispatch(fetchWarehousesAsync({ page_size: 1000 }));
    loadCatalog();
  }, [dispatch, loadCatalog]);

  const clearSelection = useCallback(() => {
    setSelectedProducts(new Map());
  }, []);

  useEffect(() => {
    setProductSearch("");
    setSelectedWarehouseId("");
    clearSelection();
    setOwnProducts({
      list: [],
      count: 0,
      next: null,
      previous: null,
    });
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete("page");
        return params;
      },
      { replace: true },
    );
  }, [direction, partnerId, setProductSearch, setSearchParams, clearSelection]);

  useEffect(() => {
    clearSelection();
  }, [selectedWarehouseId, clearSelection]);

  useEffect(() => {
    if (!selectedWarehouseId && activeWarehouses.length > 0) {
      setSelectedWarehouseId(String(activeWarehouses[0].id));
    }
  }, [activeWarehouses, selectedWarehouseId]);

  const productsForSelectedWarehouse = useMemo(() => {
    if (!selectedWarehouseId) return [];
    if (isReceive) {
      const wh = partnerWarehouses.find(
        (w) => String(w.id) === String(selectedWarehouseId),
      );
      return wh?.products || [];
    }
    return ownProducts.list;
  }, [
    isReceive,
    selectedWarehouseId,
    partnerWarehouses,
    ownProducts.list,
  ]);

  const filteredPartnerProducts = useMemo(
    () => filterProducts(productsForSelectedWarehouse, debouncedSearchTerm),
    [productsForSelectedWarehouse, debouncedSearchTerm],
  );

  const productsCount = isReceive
    ? filteredPartnerProducts.length
    : ownProducts.count;

  const totalPagesEstimate = useMemo(
    () => Math.max(1, Math.ceil((productsCount || 0) / PAGE_SIZE)),
    [productsCount],
  );

  const paginationNext = useMemo(() => {
    if (isReceive) {
      return currentPageFromUrl < totalPagesEstimate ? "1" : null;
    }
    return ownProducts.next;
  }, [isReceive, currentPageFromUrl, totalPagesEstimate, ownProducts.next]);

  const paginationPrevious = useMemo(() => {
    if (isReceive) {
      return currentPageFromUrl > 1 ? "1" : null;
    }
    return ownProducts.previous;
  }, [isReceive, currentPageFromUrl, ownProducts.previous]);

  const {
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    handlePageChange,
    resetToFirstPage,
  } = usePagination(productsCount, paginationNext, paginationPrevious);

  useEffect(() => {
    if (!isReceive && selectedWarehouseId) {
      loadOwnWarehouseProducts(
        selectedWarehouseId,
        currentPage,
        debouncedSearchTerm,
      );
    }
  }, [
    isReceive,
    selectedWarehouseId,
    currentPage,
    debouncedSearchTerm,
    loadOwnWarehouseProducts,
  ]);

  useEffect(() => {
    if (prevDebouncedSearchRef.current !== debouncedSearchTerm) {
      prevDebouncedSearchRef.current = debouncedSearchTerm;
      resetToFirstPage();
    }
  }, [debouncedSearchTerm, resetToFirstPage]);

  useEffect(() => {
    if (isReceive && currentPage > totalPages) {
      resetToFirstPage();
    }
  }, [isReceive, currentPage, totalPages, resetToFirstPage]);

  const displayProducts = useMemo(() => {
    if (!isReceive) {
      return productsForSelectedWarehouse;
    }
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredPartnerProducts.slice(start, start + PAGE_SIZE);
  }, [
    isReceive,
    productsForSelectedWarehouse,
    filteredPartnerProducts,
    currentPage,
  ]);

  const productsLoading = !isReceive && ownProductsLoading;

  const hasNoProducts = isReceive
    ? filteredPartnerProducts.length === 0
    : ownProducts.count === 0 && !productsLoading;

  const setDirection = (next) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === DIRECTION.SEND) {
          params.set("direction", DIRECTION.SEND);
        } else {
          params.delete("direction");
        }
        params.delete("page");
        return params;
      },
      { replace: true },
    );
  };

  const openTransfer = (mode, product, warehouseFromId) => {
    setTransferState({
      open: true,
      mode,
      product,
      products: null,
      warehouseFromId,
    });
  };

  const openBulkTransfer = () => {
    const items = Array.from(selectedProducts.values());
    if (items.length === 0) return;
    setTransferState({
      open: true,
      mode: isReceive ? DIRECTION.RECEIVE : DIRECTION.SEND,
      product: null,
      products: items,
      warehouseFromId: selectedWarehouseId,
    });
  };

  const closeTransfer = () => {
    setTransferState({
      open: false,
      mode: DIRECTION.RECEIVE,
      product: null,
      products: null,
      warehouseFromId: null,
    });
  };

  const handleTransferred = async (mode, warehouseFromId) => {
    clearSelection();
    await loadCatalog();
    if (mode === DIRECTION.SEND && warehouseFromId) {
      await loadOwnWarehouseProducts(
        warehouseFromId,
        currentPage,
        debouncedSearchTerm,
      );
    }
  };

  const toggleProductSelection = (product) => {
    const key = String(product.id);
    setSelectedProducts((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, product);
      }
      return next;
    });
  };

  const transferableOnPage = useMemo(
    () => displayProducts.filter((p) => getProductQty(p) > 0),
    [displayProducts],
  );

  const selectedCount = selectedProducts.size;

  const allPageSelected = useMemo(() => {
    if (transferableOnPage.length === 0) return false;
    return transferableOnPage.every((p) =>
      selectedProducts.has(String(p.id)),
    );
  }, [transferableOnPage, selectedProducts]);

  const somePageSelected = useMemo(
    () =>
      transferableOnPage.some((p) => selectedProducts.has(String(p.id))) &&
      !allPageSelected,
    [transferableOnPage, selectedProducts, allPageSelected],
  );

  const handleSelectAllOnPage = () => {
    if (allPageSelected) {
      setSelectedProducts((prev) => {
        const next = new Map(prev);
        transferableOnPage.forEach((p) => next.delete(String(p.id)));
        return next;
      });
      return;
    }
    setSelectedProducts((prev) => {
      const next = new Map(prev);
      transferableOnPage.forEach((p) => next.set(String(p.id), p));
      return next;
    });
  };

  const handleBack = () => {
    navigate("/crm/warehouse/warehouses?tab=partnerships");
  };

  const handleWarehouseSelect = (warehouseId) => {
    setSelectedWarehouseId(String(warehouseId));
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete("page");
        return params;
      },
      { replace: true },
    );
    resetToFirstPage();
  };

  const handleRefresh = () => {
    loadCatalog();
    if (!isReceive && selectedWarehouseId) {
      loadOwnWarehouseProducts(
        selectedWarehouseId,
        currentPage,
        debouncedSearchTerm,
      );
    }
  };

  const productCountLabel = useMemo(() => {
    if (productsCount === 0) return null;
    if (totalPages <= 1) {
      return `${productsCount} ${productsCount === 1 ? "товар" : "товаров"}${
        debouncedSearchTerm.trim() ? " по запросу" : " на выбранном складе"
      }`;
    }
    const from = (currentPage - 1) * PAGE_SIZE + 1;
    const to = Math.min(currentPage * PAGE_SIZE, productsCount);
    return `Показано ${from}–${to} из ${productsCount} ${
      productsCount === 1 ? "товара" : "товаров"
    }${debouncedSearchTerm.trim() ? " по запросу" : ""}`;
  }, [
    productsCount,
    totalPages,
    currentPage,
    debouncedSearchTerm,
  ]);

  const renderProductsTable = () => {
    if (catalogLoading || productsLoading) {
      return (
        <div className="partner-catalog-empty">Загрузка товаров…</div>
      );
    }

    if (activeWarehouses.length === 0) {
      return (
        <div className="partner-catalog-empty">
          {isReceive
            ? "У партнёра нет складов для обмена"
            : "У вас нет складов — создайте склад на вкладке «Склады»"}
        </div>
      );
    }

    if (!isReceive && partnerWarehouses.length === 0) {
      return (
        <div className="partner-catalog-empty">
          У партнёра нет складов для приёма товара
        </div>
      );
    }

    if (hasNoProducts) {
      return (
        <div className="partner-catalog-empty">
          {debouncedSearchTerm.trim()
            ? "Ничего не найдено по запросу"
            : "На выбранном складе нет товаров"}
        </div>
      );
    }

    return (
      <>
        <div className="partner-catalog-howto">
          <strong>Как переместить несколько товаров:</strong> отметьте галочками нужные
          позиции (можно на разных страницах списка), затем нажмите кнопку внизу экрана.
          Для одного товара можно сразу нажать кнопку в строке.
        </div>

        {selectedCount > 0 && (
          <p className="partner-catalog-selection-note">
            В корзине обмена: {selectedCount}{" "}
            {selectedCount === 1 ? "товар" : selectedCount < 5 ? "товара" : "товаров"}
            {totalPages > 1 ? " (выбор сохраняется при перелистывании)" : ""}
          </p>
        )}

        <div className="warehouse-table-container w-full partner-catalog-products">
          <div className="warehouse-table-scroll warehouse-table-scroll--catalog">
            <table className="warehouse-table warehouse-partnership-products">
              <thead>
                <tr>
                  <th className="partner-catalog-table__check-col">
                    <input
                      type="checkbox"
                      className="partner-catalog-table__checkbox"
                      checked={allPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = somePageSelected;
                      }}
                      onChange={handleSelectAllOnPage}
                      disabled={transferableOnPage.length === 0}
                      aria-label="Выбрать все товары на странице"
                      title="Выбрать все на этой странице"
                    />
                  </th>
                  <th>Товар</th>
                  <th>Артикул</th>
                  <th>Остаток</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {displayProducts.map((p) => {
                  const qty = getProductQty(p);
                  const canTransfer = qty > 0;
                  const isSelected = selectedProducts.has(String(p.id));
                  return (
                    <tr
                      key={p.id}
                      className={isSelected ? "partner-catalog-table__row--selected" : ""}
                    >
                      <td className="partner-catalog-table__check-col">
                        <input
                          type="checkbox"
                          className="partner-catalog-table__checkbox"
                          checked={isSelected}
                          disabled={!canTransfer}
                          onChange={() => toggleProductSelection(p)}
                          aria-label={`Выбрать ${p.name || "товар"}`}
                          title={
                            canTransfer
                              ? "Добавить в корзину обмена"
                              : "Нет остатка для перемещения"
                          }
                        />
                      </td>
                      <td className="warehouse-table__name">{p.name}</td>
                      <td>{p.article || "—"}</td>
                      <td>
                        {qty} {p.unit || ""}
                      </td>
                      <td>
                        {isReceive ? (
                          <button
                            type="button"
                            className="warehouse-table__action-btn warehouse-table__action-btn--receive"
                            disabled={!canTransfer}
                            onClick={() =>
                              openTransfer(
                                DIRECTION.RECEIVE,
                                p,
                                selectedWarehouseId,
                              )
                            }
                          >
                            Забрать
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="warehouse-table__action-btn warehouse-table__action-btn--send"
                            disabled={!canTransfer}
                            onClick={() =>
                              openTransfer(
                                DIRECTION.SEND,
                                p,
                                selectedWarehouseId,
                              )
                            }
                          >
                            Отправить
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          count={productsCount}
          countLabel="товаров"
          loading={productsLoading}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          onPageChange={handlePageChange}
        />
      </>
    );
  };

  return (
    <div
      className={`warehouse-page partner-catalog-page${selectedCount > 0 ? " partner-catalog-page--has-selection" : ""}`}
    >
      <WarehouseHeader
        onBack={handleBack}
        title={`Обмен с «${partnerName}»`}
        subtitle="Межкомпанейное перемещение товаров между вашими складами"
      />

      {catalogError && (
        <div className="warehouse-partnership-error">{catalogError}</div>
      )}

      <div className="partner-catalog-direction">
        <button
          type="button"
          className={`partner-catalog-direction-card ${isReceive ? "active" : ""}`}
          onClick={() => setDirection(DIRECTION.RECEIVE)}
        >
          <span className="partner-catalog-direction-card__icon">
            <ArrowDownLeft size={22} />
          </span>
          <span className="partner-catalog-direction-card__title">
            Забрать у партнёра
          </span>
          <span className="partner-catalog-direction-card__desc">
            Отметьте один или несколько товаров со склада партнёра — они поступят на ваш склад
          </span>
          <span className="partner-catalog-direction-card__flow">
            <span className="partner-catalog-direction-card__flow-badge">
              {partnerName}
            </span>
            <ArrowRight size={16} />
            <span className="partner-catalog-direction-card__flow-badge">
              Ваша компания
            </span>
          </span>
        </button>

        <button
          type="button"
          className={`partner-catalog-direction-card partner-catalog-direction-card--send ${!isReceive ? "active" : ""}`}
          onClick={() => setDirection(DIRECTION.SEND)}
        >
          <span className="partner-catalog-direction-card__icon">
            <ArrowUpRight size={22} />
          </span>
          <span className="partner-catalog-direction-card__title">
            Отдать партнёру
          </span>
          <span className="partner-catalog-direction-card__desc">
            Отметьте один или несколько товаров со своего склада — они поступят партнёру
          </span>
          <span className="partner-catalog-direction-card__flow">
            <span className="partner-catalog-direction-card__flow-badge">
              Ваша компания
            </span>
            <ArrowRight size={16} />
            <span className="partner-catalog-direction-card__flow-badge">
              {partnerName}
            </span>
          </span>
        </button>
      </div>

      <div className="partner-catalog-steps">
        {isReceive ? (
          <>
            <span>
              <strong>1.</strong> Выберите склад партнёра
            </span>
            <span>
              <strong>2.</strong> Отметьте товары галочками или нажмите «Забрать» в строке
            </span>
            <span>
              <strong>3.</strong> Укажите свой склад-получатель и количество
            </span>
          </>
        ) : (
          <>
            <span>
              <strong>1.</strong> Выберите свой склад
            </span>
            <span>
              <strong>2.</strong> Отметьте товары галочками или нажмите «Отправить» в строке
            </span>
            <span>
              <strong>3.</strong> Выберите склад партнёра и количество по каждой позиции
            </span>
          </>
        )}
      </div>

      <div className="partner-catalog-toolbar">
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search
            size={18}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#9ca3af",
            }}
          />
          <input
            className="partner-catalog-toolbar__search"
            style={{ paddingLeft: 40, width: "100%" }}
            placeholder="Поиск по названию или артикулу…"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="partner-catalog-toolbar__refresh"
          onClick={handleRefresh}
          disabled={catalogLoading}
          aria-label="Обновить"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {activeWarehouses.length > 0 && (
        <div className="partner-catalog-warehouses">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "#6b7280",
              marginRight: 4,
            }}
          >
            <Building2 size={16} />
            {isReceive ? "Склады партнёра:" : "Ваши склады:"}
          </span>
          {activeWarehouses.map((wh) => (
            <button
              key={wh.id}
              type="button"
              className={`partner-catalog-warehouse-chip ${!isReceive ? "partner-catalog-warehouse-chip--send" : ""} ${String(selectedWarehouseId) === String(wh.id) ? "active" : ""}`}
              onClick={() => handleWarehouseSelect(wh.id)}
            >
              {warehouseLabel(wh)}
            </button>
          ))}
        </div>
      )}

      {!catalogLoading && activeWarehouses.length > 0 && productCountLabel && (
        <p
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            color: "#6b7280",
            marginBottom: 12,
          }}
        >
          <Package size={16} />
          {productCountLabel}
        </p>
      )}

      {renderProductsTable()}

      {selectedCount > 0 && (
        <div className="partner-catalog-selection-spacer" aria-hidden="true" />
      )}

      <PartnerCatalogSelectionBar
        selectedCount={selectedCount}
        isReceive={isReceive}
        onContinue={openBulkTransfer}
        onClear={clearSelection}
      />

      <StockPartnershipTransferModal
        mode={transferState.mode}
        open={transferState.open}
        onClose={closeTransfer}
        product={transferState.product}
        products={transferState.products}
        warehouseFromId={transferState.warehouseFromId}
        partnerCompanyName={partnerName}
        targetWarehouses={
          transferState.mode === DIRECTION.SEND
            ? partnerWarehouses
            : ownWarehouses
        }
        onTransferred={handleTransferred}
      />
    </div>
  );
};

export default PartnerCatalogPage;
