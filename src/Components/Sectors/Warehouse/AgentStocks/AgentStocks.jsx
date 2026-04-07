import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import api from "../../../../api";
import SearchSection from "../../Market/Warehouse/components/SearchSection";
import ProductTable from "../../Market/Warehouse/components/ProductTable";
import ProductCards from "../../Market/Warehouse/components/ProductCards";
import { VIEW_MODES } from "../../Market/Warehouse/constants";
import Pagination from "../Warehouses/components/Pagination";
import { usePagination } from "../Warehouses/hooks/usePagination";
import { useSearch } from "../Warehouses/hooks/useSearch";
import { listCompanyAgentRequests } from "../../../../api/warehouse";
import {
  fetchAgentProductsAsync,
  fetchWarehousesAsync,
} from "../../../../store/creators/warehouseCreators";

const VIEW_STORAGE_KEY = "warehouse_agent_stocks_view_mode";

const normalizeList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const shortId = (id) => {
  const s = String(id || "");
  if (!s) return "—";
  return s.length > 8 ? `${s.slice(0, 8)}…` : s;
};

const AgentStocks = () => {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useSearch();

  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return VIEW_MODES.TABLE;
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    return saved === VIEW_MODES.CARDS ? VIEW_MODES.CARDS : VIEW_MODES.TABLE;
  });

  const warehouseFilter = searchParams.get("warehouse") || "";
  const productGroupFilter = searchParams.get("product_group") || "";

  const warehouses = useSelector((state) => state.warehouse.list || []);
  const {
    agentProducts,
    agentProductsCount,
    agentProductsNext,
    agentProductsPrevious,
    agentProductsLoading,
    agentProductsError,
  } = useSelector((state) => state.warehouse);

  const {
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    getRowNumber,
    handlePageChange,
    resetToFirstPage,
  } = usePagination(agentProductsCount, agentProductsNext, agentProductsPrevious);

  const [pagesMap, setPagesMap] = useState({});
  const [warehouseNames, setWarehouseNames] = useState({});
  const [productPrices, setProductPrices] = useState({});
  const [membershipAssignedWarehouseId, setMembershipAssignedWarehouseId] =
    useState(null);
  const warehouseRequestsRef = useRef(new Set());
  const productRequestsRef = useRef(new Set());

  const filterKey = useMemo(
    () => JSON.stringify({ warehouseFilter, productGroupFilter }),
    [warehouseFilter, productGroupFilter],
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    }
  }, [viewMode]);

  useEffect(() => {
    dispatch(fetchWarehousesAsync({ page_size: 1000 }));
  }, [dispatch]);

  useEffect(() => {
    if (debouncedSearchTerm) {
      resetToFirstPage();
    }
  }, [debouncedSearchTerm, resetToFirstPage]);

  useEffect(() => {
    setPagesMap({});
    resetToFirstPage();
  }, [filterKey, resetToFirstPage]);

  useEffect(() => {
    let mounted = true;
    const params = { page: currentPage };
    if (warehouseFilter) params.warehouse = warehouseFilter;
    if (productGroupFilter) params.product_group = productGroupFilter;

    dispatch(fetchAgentProductsAsync(params))
      .unwrap()
      .then((payload) => {
        if (!mounted) return;
        const list = normalizeList(payload);
        setPagesMap((prev) => ({
          ...prev,
          [currentPage]: list,
        }));
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [dispatch, currentPage, warehouseFilter, productGroupFilter]);

  const loadedItems = useMemo(() => {
    const pages = Object.keys(pagesMap)
      .map((p) => Number(p))
      .filter((p) => Number.isFinite(p) && p <= currentPage)
      .sort((a, b) => a - b);
    const out = [];
    pages.forEach((page) => {
      const list = pagesMap[page] || [];
      list.forEach((item) => out.push(item));
    });
    return out;
  }, [pagesMap, currentPage]);

  useEffect(() => {
    loadedItems.forEach((item) => {
      const wid = item?.warehouse ? String(item.warehouse) : "";
      if (wid && !warehouseNames[wid] && !warehouseRequestsRef.current.has(wid)) {
        warehouseRequestsRef.current.add(wid);
        api
          .get(`/warehouse/${wid}/`)
          .then(({ data }) => {
            setWarehouseNames((prev) => ({
              ...prev,
              [wid]: data?.name || "—",
            }));
          })
          .catch(() => {
            setWarehouseNames((prev) => ({ ...prev, [wid]: "—" }));
          })
          .finally(() => {
            warehouseRequestsRef.current.delete(wid);
          });
      }

      const pid = item?.product ? String(item.product) : "";
      if (pid && !(pid in productPrices) && !productRequestsRef.current.has(pid)) {
        productRequestsRef.current.add(pid);
        api
          .get(`/warehouse/products/${pid}/`)
          .then(({ data }) => {
            setProductPrices((prev) => ({
              ...prev,
              [pid]: data?.price ?? null,
            }));
          })
          .catch(() => {
            setProductPrices((prev) => ({ ...prev, [pid]: null }));
          })
          .finally(() => {
            productRequestsRef.current.delete(pid);
          });
      }
    });
  }, [loadedItems, warehouseNames, productPrices]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await listCompanyAgentRequests({ status: "active" });
        const list = normalizeList(data);
        const first = list[0] || null;
        const assigned = first?.assigned_warehouse
          ? String(first.assigned_warehouse)
          : null;
        if (!mounted) return;
        setMembershipAssignedWarehouseId(assigned);
        if (
          assigned &&
          !warehouseNames[assigned] &&
          !warehouseRequestsRef.current.has(assigned)
        ) {
          warehouseRequestsRef.current.add(assigned);
          api
            .get(`/warehouse/${assigned}/`)
            .then(({ data: warehouseData }) => {
              setWarehouseNames((prev) => ({
                ...prev,
                [assigned]: warehouseData?.name || "—",
              }));
            })
            .catch(() => {
              setWarehouseNames((prev) => ({ ...prev, [assigned]: "—" }));
            })
            .finally(() => {
              warehouseRequestsRef.current.delete(assigned);
            });
        }
      } catch {
        if (!mounted) return;
        setMembershipAssignedWarehouseId(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const q = debouncedSearchTerm.trim().toLowerCase();
    if (!q) return loadedItems;
    return loadedItems.filter((item) => {
      const warehouseName = warehouseNames[item.warehouse] || "";
      return (
        String(item.product_name || "").toLowerCase().includes(q) ||
        String(item.product_article || "").toLowerCase().includes(q) ||
        String(item.product_unit || "").toLowerCase().includes(q) ||
        String(warehouseName).toLowerCase().includes(q)
      );
    });
  }, [loadedItems, debouncedSearchTerm, warehouseNames]);

  const assignedWarehouseId = membershipAssignedWarehouseId;

  const assignedWarehouseLabel = assignedWarehouseId
    ? warehouseNames[assignedWarehouseId] || shortId(assignedWarehouseId)
    : "Все склады компании";

  const uiProducts = useMemo(
    () =>
      filteredItems.map((item) => ({
        id: `${item.product}:${item.warehouse}`,
        name: item.product_name || "—",
        code: warehouseNames[item.warehouse] || "Склад…",
        article: item.product_article || "—",
        unit: item.product_unit || "—",
        price: productPrices[item.product] ?? 0,
        discount_percent: 0,
        quantity: Number(item.qty || 0),
      })),
    [filteredItems, warehouseNames, productPrices],
  );

  const [selectedRows, setSelectedRows] = useState(new Set());
  const isAllSelected =
    uiProducts.length > 0 &&
    uiProducts.every((row) => selectedRows.has(row.id));

  const handleRowSelect = useCallback((id) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedRows((prev) => {
      if (uiProducts.length > 0 && uiProducts.every((row) => prev.has(row.id))) {
        return new Set();
      }
      return new Set(uiProducts.map((row) => row.id));
    });
  }, [uiProducts]);

  const onWarehouseFilterChange = useCallback(
    (value) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set("warehouse", value);
      else next.delete("warehouse");
      next.delete("page");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const onGroupFilterChange = useCallback(
    (value) => {
      const next = new URLSearchParams(searchParams);
      if (value.trim()) next.set("product_group", value.trim());
      else next.delete("product_group");
      next.delete("page");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const hasLocalSearch = Boolean(debouncedSearchTerm.trim());

  return (
    <div className="warehouse-page">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon">
            <div className="warehouse-header__icon-box">📦</div>
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Мои остатки</h1>
            <p className="warehouse-header__subtitle">
              Личный баланс агента по товарам и складам
            </p>
            <p className="warehouse-header__subtitle">
              Склад: {assignedWarehouseLabel}
            </p>
          </div>
        </div>
      </div>

      <SearchSection
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        count={agentProductsCount}
        foundCount={uiProducts.length}
        searchPlaceholder="Поиск по названию, артикулу и складу..."
      />

      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <select
          className="warehouse-search__input"
          value={warehouseFilter}
          onChange={(e) => onWarehouseFilterChange(e.target.value)}
        >
          <option value="">Все склады</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name || w.title || w.id}
            </option>
          ))}
        </select>
        <input
          className="warehouse-search__input"
          placeholder="Фильтр по product_group (UUID)"
          value={productGroupFilter}
          onChange={(e) => onGroupFilterChange(e.target.value)}
        />
      </div>

      {agentProductsError && (
        <div className="agents-error mb-3">
          {String(agentProductsError?.detail || agentProductsError)}
        </div>
      )}

      <div className="warehouse-table-container w-full stocksContent">
        {viewMode === VIEW_MODES.TABLE ? (
          <ProductTable
            products={uiProducts}
            loading={agentProductsLoading}
            selectedRows={selectedRows}
            isAllSelected={isAllSelected}
            onRowSelect={handleRowSelect}
            onSelectAll={handleSelectAll}
            onProductClick={() => {}}
            getRowNumber={getRowNumber}
            isOutOfStock={(product) => Number(product.quantity) === 0}
          />
        ) : (
          <ProductCards
            products={uiProducts}
            loading={agentProductsLoading}
            selectedRows={selectedRows}
            isAllSelected={isAllSelected}
            onRowSelect={handleRowSelect}
            onSelectAll={handleSelectAll}
            onProductClick={() => {}}
            getRowNumber={getRowNumber}
            isOutOfStock={(product) => Number(product.quantity) === 0}
          />
        )}

        {!hasLocalSearch && hasNextPage && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              className="warehouse-header__create-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={agentProductsLoading}
            >
              Загрузить еще
            </button>
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          count={agentProductsCount}
          loading={agentProductsLoading}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
};

export default AgentStocks;
