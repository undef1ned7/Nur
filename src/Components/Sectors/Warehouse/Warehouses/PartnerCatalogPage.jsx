import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  PULL_MODE_HINT,
  extractPartnershipError,
  filterProducts,
  getProductQty,
  mapOwnProductRow,
  normalizeList,
  partnerPullMode,
  pluralRu,
  warehouseLabel,
} from "./partnership/partnershipHelpers";
import { listWarehouseProducts } from "../../../../api/warehouse";
import {
  getPartnerWarehouses,
  listPartnerWarehouseProducts,
} from "../../../../api/warehousePartnership";
import { fetchWarehousesAsync } from "../../../../store/creators/warehouseCreators";
import "./PartnerCatalogPage.scss";
import "./Warehouses.scss";

const DIRECTION = {
  RECEIVE: "receive",
  SEND: "send",
};

const PRODUCT_FORMS = ["товар", "товара", "товаров"];

const EMPTY_REMOTE = { list: [], count: 0, next: null, previous: null };

const parsePaginationMeta = (data, listLength) => ({
  count: typeof data?.count === "number" ? data.count : listLength,
  next: data?.next ?? null,
  previous: data?.previous ?? null,
});

const CLOSED_TRANSFER = {
  open: false,
  mode: DIRECTION.RECEIVE,
  product: null,
  products: null,
  warehouseFromId: null,
};

const PartnerCatalogPage = () => {
  const { partnerId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();

  const direction =
    searchParams.get("direction") === DIRECTION.SEND
      ? DIRECTION.SEND
      : DIRECTION.RECEIVE;
  const isReceive = direction === DIRECTION.RECEIVE;

  const ownWarehouses = useSelector((state) => state.warehouse.list || []);
  const {
    searchTerm: productSearch,
    debouncedSearchTerm,
    setSearchTerm: setProductSearch,
  } = useSearch(`warehouse:partnerCatalog:${partnerId}:search`);

  const [partnerLoading, setPartnerLoading] = useState(true);
  const [partnerError, setPartnerError] = useState("");
  // { source: "light" | "catalog", partner_company, partnership, warehouses, cash_registers }
  const [partnerData, setPartnerData] = useState(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  // Серверная выдача: свои товары (send) или товары партнёра на новом бэке (receive)
  const [remoteProducts, setRemoteProducts] = useState(EMPTY_REMOTE);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState("");
  const prevDebouncedSearchRef = useRef(debouncedSearchTerm);

  const [selectedProducts, setSelectedProducts] = useState(() => new Map());
  const [transferState, setTransferState] = useState(CLOSED_TRANSFER);

  const partnerName = partnerData?.partner_company?.name || "Партнёр";
  const partnerWarehouses = useMemo(
    () => partnerData?.warehouses || [],
    [partnerData],
  );
  const pullMode = partnerPullMode(partnerData?.partnership);

  // На старом бэке товары партнёра приходят вместе со складами — фильтруем и
  // листаем на клиенте. На новом — запрашиваем страницу с бэка.
  const isClientMode = isReceive && partnerData?.source !== "light";

  const activeWarehouses = isReceive ? partnerWarehouses : ownWarehouses;

  const loadPartner = useCallback(async () => {
    if (!partnerId) return;
    setPartnerLoading(true);
    setPartnerError("");
    try {
      setPartnerData(await getPartnerWarehouses(partnerId));
    } catch (e) {
      console.error(e);
      setPartnerError(extractPartnershipError(e));
      setPartnerData(null);
    } finally {
      setPartnerLoading(false);
    }
  }, [partnerId]);

  const loadRemoteProducts = useCallback(
    async ({ receive, warehouseId, page, search }) => {
      if (!warehouseId) return;
      setRemoteLoading(true);
      setRemoteError("");
      try {
        const params = { page, page_size: PAGE_SIZE };
        const trimmed = search.trim();
        if (trimmed) params.search = trimmed;
        const data = receive
          ? await listPartnerWarehouseProducts(partnerId, warehouseId, params)
          : await listWarehouseProducts(warehouseId, params);
        const list = receive
          ? normalizeList(data)
          : normalizeList(data).map(mapOwnProductRow);
        setRemoteProducts({ list, ...parsePaginationMeta(data, list.length) });
      } catch (e) {
        console.error(e);
        setRemoteError(extractPartnershipError(e));
        setRemoteProducts(EMPTY_REMOTE);
      } finally {
        setRemoteLoading(false);
      }
    },
    [partnerId],
  );

  useEffect(() => {
    dispatch(fetchWarehousesAsync({ page_size: 1000 }));
    loadPartner();
  }, [dispatch, loadPartner]);

  const clearSelection = useCallback(() => {
    setSelectedProducts(new Map());
  }, []);

  const productsForSelectedWarehouse = useMemo(() => {
    if (!selectedWarehouseId) return [];
    if (isClientMode) {
      const wh = partnerWarehouses.find(
        (w) => String(w.id) === String(selectedWarehouseId),
      );
      return wh?.products || [];
    }
    return remoteProducts.list;
  }, [isClientMode, selectedWarehouseId, partnerWarehouses, remoteProducts.list]);

  const filteredClientProducts = useMemo(
    () =>
      isClientMode
        ? filterProducts(productsForSelectedWarehouse, debouncedSearchTerm)
        : [],
    [isClientMode, productsForSelectedWarehouse, debouncedSearchTerm],
  );

  const productsCount = isClientMode
    ? filteredClientProducts.length
    : remoteProducts.count;

  const currentPageFromUrl = useMemo(
    () => parseInt(searchParams.get("page") || "1", 10),
    [searchParams],
  );

  const clientTotalPages = Math.max(1, Math.ceil((productsCount || 0) / PAGE_SIZE));

  const paginationNext = isClientMode
    ? currentPageFromUrl < clientTotalPages
      ? "1"
      : null
    : remoteProducts.next;
  const paginationPrevious = isClientMode
    ? currentPageFromUrl > 1
      ? "1"
      : null
    : remoteProducts.previous;

  const {
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    handlePageChange,
    resetToFirstPage,
  } = usePagination(productsCount, paginationNext, paginationPrevious);

  // Смена направления или партнёра — начинаем с чистого листа. На первом
  // рендере ничего не сбрасываем: страница и поиск из URL/сессии должны
  // сохраниться при перезагрузке и переходе по ссылке.
  const scopeKey = `${partnerId}|${direction}`;
  const prevScopeKeyRef = useRef(scopeKey);
  useEffect(() => {
    if (prevScopeKeyRef.current === scopeKey) return;
    prevScopeKeyRef.current = scopeKey;
    setProductSearch("");
    setSelectedWarehouseId("");
    clearSelection();
    setRemoteProducts(EMPTY_REMOTE);
    resetToFirstPage();
  }, [scopeKey, setProductSearch, clearSelection, resetToFirstPage]);

  useEffect(() => {
    clearSelection();
  }, [selectedWarehouseId, clearSelection]);

  useEffect(() => {
    if (!selectedWarehouseId && activeWarehouses.length > 0) {
      setSelectedWarehouseId(String(activeWarehouses[0].id));
    }
  }, [activeWarehouses, selectedWarehouseId]);

  useEffect(() => {
    if (isClientMode || !selectedWarehouseId) return;
    // receive на новом бэке ждёт, пока станет известен источник данных
    if (isReceive && !partnerData) return;
    loadRemoteProducts({
      receive: isReceive,
      warehouseId: selectedWarehouseId,
      page: currentPage,
      search: debouncedSearchTerm,
    });
  }, [
    isClientMode,
    isReceive,
    partnerData,
    selectedWarehouseId,
    currentPage,
    debouncedSearchTerm,
    loadRemoteProducts,
  ]);

  useEffect(() => {
    if (prevDebouncedSearchRef.current !== debouncedSearchTerm) {
      prevDebouncedSearchRef.current = debouncedSearchTerm;
      resetToFirstPage();
    }
  }, [debouncedSearchTerm, resetToFirstPage]);

  useEffect(() => {
    if (isClientMode && currentPage > totalPages) {
      resetToFirstPage();
    }
  }, [isClientMode, currentPage, totalPages, resetToFirstPage]);

  const displayProducts = useMemo(() => {
    if (!isClientMode) return productsForSelectedWarehouse;
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredClientProducts.slice(start, start + PAGE_SIZE);
  }, [isClientMode, productsForSelectedWarehouse, filteredClientProducts, currentPage]);

  const productsLoading = !isClientMode && remoteLoading;
  const hasNoProducts = !productsLoading && productsCount === 0;

  const setDirection = (next) => {
    if (next === direction) return;
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

  const closeTransfer = () => setTransferState(CLOSED_TRANSFER);

  const reloadProducts = () => {
    if (isClientMode) return loadPartner();
    return Promise.all([
      loadPartner(),
      loadRemoteProducts({
        receive: isReceive,
        warehouseId: selectedWarehouseId,
        page: currentPage,
        search: debouncedSearchTerm,
      }),
    ]);
  };

  const handleTransferred = async () => {
    clearSelection();
    await reloadProducts();
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
    return transferableOnPage.every((p) => selectedProducts.has(String(p.id)));
  }, [transferableOnPage, selectedProducts]);

  const somePageSelected = useMemo(
    () =>
      transferableOnPage.some((p) => selectedProducts.has(String(p.id))) &&
      !allPageSelected,
    [transferableOnPage, selectedProducts, allPageSelected],
  );

  const handleSelectAllOnPage = () => {
    setSelectedProducts((prev) => {
      const next = new Map(prev);
      if (allPageSelected) {
        transferableOnPage.forEach((p) => next.delete(String(p.id)));
      } else {
        transferableOnPage.forEach((p) => next.set(String(p.id), p));
      }
      return next;
    });
  };

  const handleBack = () => {
    navigate("/crm/warehouse/warehouses?tab=partnerships");
  };

  const handleWarehouseSelect = (warehouseId) => {
    setSelectedWarehouseId(String(warehouseId));
    resetToFirstPage();
  };

  const productCountLabel = useMemo(() => {
    if (productsCount === 0) return null;
    const searchSuffix = debouncedSearchTerm.trim() ? " по запросу" : "";
    if (totalPages <= 1) {
      return `${productsCount} ${pluralRu(productsCount, PRODUCT_FORMS)}${
        searchSuffix || " на выбранном складе"
      }`;
    }
    const from = (currentPage - 1) * PAGE_SIZE + 1;
    const to = Math.min(currentPage * PAGE_SIZE, productsCount);
    return `Показано ${from}–${to} из ${productsCount}${searchSuffix}`;
  }, [productsCount, totalPages, currentPage, debouncedSearchTerm]);

  const renderProductsTable = () => {
    if (partnerLoading || productsLoading) {
      return <div className="partner-catalog-empty">Загрузка товаров…</div>;
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

    if (remoteError && !isClientMode) {
      return <div className="warehouse-partnership-error">{remoteError}</div>;
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
            В корзине обмена: {selectedCount} {pluralRu(selectedCount, PRODUCT_FORMS)}
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
                              openTransfer(DIRECTION.RECEIVE, p, selectedWarehouseId)
                            }
                          >
                            {pullMode === "confirm" ? "Запросить" : "Забрать"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="warehouse-table__action-btn warehouse-table__action-btn--send"
                            disabled={!canTransfer}
                            onClick={() =>
                              openTransfer(DIRECTION.SEND, p, selectedWarehouseId)
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
        subtitle="Межкомпанейское перемещение товаров между вашими складами"
      />

      {partnerError && (
        <div className="warehouse-partnership-error">{partnerError}</div>
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
            {pullMode === "confirm"
              ? "Отметьте товары со склада партнёра — после его подтверждения они поступят на ваш склад"
              : "Отметьте один или несколько товаров со склада партнёра — они поступят на ваш склад"}
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

      {isReceive && partnerData && (
        <div
          className={`warehouse-partnership-hint ${pullMode === "legacy" ? "warehouse-partnership-hint--warning" : ""}`}
        >
          {PULL_MODE_HINT[pullMode]}
        </div>
      )}

      <div className="partner-catalog-steps">
        {isReceive ? (
          <>
            <span>
              <strong>1.</strong> Выберите склад партнёра
            </span>
            <span>
              <strong>2.</strong> Отметьте товары галочками или нажмите «
              {pullMode === "confirm" ? "Запросить" : "Забрать"}» в строке
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
          onClick={reloadProducts}
          disabled={partnerLoading || remoteLoading}
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

      {!partnerLoading && activeWarehouses.length > 0 && productCountLabel && (
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
        requiresConfirmation={pullMode === "confirm"}
        onContinue={openBulkTransfer}
        onClear={clearSelection}
      />

      {transferState.open && (
        <StockPartnershipTransferModal
          mode={transferState.mode}
          onClose={closeTransfer}
          product={transferState.product}
          products={transferState.products}
          warehouseFromId={transferState.warehouseFromId}
          partnerCompanyName={partnerName}
          pullMode={pullMode}
          targetWarehouses={
            transferState.mode === DIRECTION.SEND ? partnerWarehouses : ownWarehouses
          }
          onTransferred={handleTransferred}
        />
      )}
    </div>
  );
};

export default PartnerCatalogPage;
