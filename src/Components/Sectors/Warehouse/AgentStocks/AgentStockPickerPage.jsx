import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import api from "../../../../api";
import SearchSection from "../../Market/Warehouse/components/SearchSection";
import { VIEW_MODES } from "../../Market/Warehouse/constants";
import {
  fetchAgentProductsAsync,
  fetchWarehousesAsync,
} from "../../../../store/creators/warehouseCreators";

const normalizeList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const AgentStockPickerPage = ({
  onSelect,
  onClose,
  initialWarehouse = "",
  initialProductGroup = "",
}) => {
  const dispatch = useDispatch();
  const warehouses = useSelector((state) => state.warehouse.list || []);
  const { agentProductsLoading, agentProductsError } = useSelector(
    (state) => state.warehouse,
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState(initialWarehouse);
  const [productGroupFilter, setProductGroupFilter] = useState(initialProductGroup);
  const [page, setPage] = useState(1);
  const [nextUrl, setNextUrl] = useState(null);
  const [items, setItems] = useState([]);

  const [warehouseNames, setWarehouseNames] = useState({});
  const [productPrices, setProductPrices] = useState({});
  const warehouseRequestsRef = useRef(new Set());
  const productRequestsRef = useRef(new Set());

  const [selectedKey, setSelectedKey] = useState("");
  const [selectedQty, setSelectedQty] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    dispatch(fetchWarehousesAsync({ page_size: 1000 }));
  }, [dispatch]);

  const loadPage = useCallback(
    async (targetPage, replace = false) => {
      const params = { page: targetPage };
      if (warehouseFilter) params.warehouse = warehouseFilter;
      if (productGroupFilter) params.product_group = productGroupFilter;

      const payload = await dispatch(fetchAgentProductsAsync(params)).unwrap();
      const list = normalizeList(payload);
      setNextUrl(payload?.next ?? null);
      setItems((prev) => (replace ? list : [...prev, ...list]));
    },
    [dispatch, warehouseFilter, productGroupFilter],
  );

  useEffect(() => {
    setPage(1);
    setItems([]);
    setSelectedKey("");
    setSelectedQty("");
    loadPage(1, true).catch(() => {});
  }, [loadPage]);

  useEffect(() => {
    items.forEach((item) => {
      const wid = item?.warehouse ? String(item.warehouse) : "";
      if (wid && !warehouseNames[wid] && !warehouseRequestsRef.current.has(wid)) {
        warehouseRequestsRef.current.add(wid);
        api
          .get(`/warehouse/${wid}/`)
          .then(({ data }) => {
            setWarehouseNames((prev) => ({ ...prev, [wid]: data?.name || "—" }));
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
            setProductPrices((prev) => ({ ...prev, [pid]: data?.price ?? null }));
          })
          .catch(() => {
            setProductPrices((prev) => ({ ...prev, [pid]: null }));
          })
          .finally(() => {
            productRequestsRef.current.delete(pid);
          });
      }
    });
  }, [items, warehouseNames, productPrices]);

  const visibleItems = useMemo(() => {
    const q = debouncedSearchTerm.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const warehouseName = warehouseNames[item.warehouse] || "";
      return (
        String(item.product_name || "").toLowerCase().includes(q) ||
        String(item.product_article || "").toLowerCase().includes(q) ||
        String(item.product_unit || "").toLowerCase().includes(q) ||
        String(warehouseName).toLowerCase().includes(q)
      );
    });
  }, [items, debouncedSearchTerm, warehouseNames]);

  const selectedItem = useMemo(
    () =>
      visibleItems.find(
        (item) => `${item.product}:${item.warehouse}` === selectedKey,
      ) || null,
    [visibleItems, selectedKey],
  );

  const qtyError = useMemo(() => {
    if (!selectedItem || selectedQty === "") return "";
    const maxQty = Number(selectedItem.qty || 0);
    const value = Number(selectedQty);
    if (!Number.isFinite(value) || value <= 0) return "Введите количество больше 0.";
    if (value > maxQty) return `Нельзя больше остатка (${maxQty}).`;
    return "";
  }, [selectedItem, selectedQty]);

  const handlePick = useCallback(() => {
    if (!selectedItem || qtyError) return;
    const payload = {
      product: selectedItem.product,
      warehouse: selectedItem.warehouse,
      qty: Number(selectedQty),
      price: productPrices[selectedItem.product] ?? 0,
      product_name: selectedItem.product_name,
      product_unit: selectedItem.product_unit,
    };
    onSelect?.(payload);
  }, [selectedItem, selectedQty, qtyError, productPrices, onSelect]);

  const hasLocalSearch = Boolean(debouncedSearchTerm.trim());

  return (
    <div className="warehouse-page">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon">
            <div className="warehouse-header__icon-box">🎯</div>
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Выбор из моих остатков</h1>
            <p className="warehouse-header__subtitle">
              Выберите товар и количество для документа
            </p>
          </div>
        </div>
      </div>

      <SearchSection
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        viewMode={VIEW_MODES.TABLE}
        onViewModeChange={() => {}}
        showViewModeToggle={false}
        count={items.length}
        foundCount={visibleItems.length}
        searchPlaceholder="Локальный поиск по загруженным остаткам..."
      />

      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <select
          className="warehouse-search__input"
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
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
          onChange={(e) => setProductGroupFilter(e.target.value)}
        />
      </div>

      {agentProductsError && (
        <div className="agents-error mb-3">
          {String(agentProductsError?.detail || agentProductsError)}
        </div>
      )}

      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="warehouse-table w-full min-w-[1000px]">
          <thead>
            <tr>
              <th />
              <th>Товар</th>
              <th>Склад</th>
              <th>Артикул</th>
              <th>Ед.</th>
              <th>Цена</th>
              <th>Остаток</th>
            </tr>
          </thead>
          <tbody>
            {agentProductsLoading && items.length === 0 ? (
              <tr>
                <td colSpan={7} className="warehouse-table__loading">
                  Загрузка...
                </td>
              </tr>
            ) : visibleItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="warehouse-table__empty">
                  Ничего не найдено
                </td>
              </tr>
            ) : (
              visibleItems.map((item) => {
                const key = `${item.product}:${item.warehouse}`;
                const qty = Number(item.qty || 0);
                return (
                  <tr
                    key={key}
                    className="warehouse-table__row"
                    onClick={() => {
                      setSelectedKey(key);
                      if (!selectedQty) {
                        setSelectedQty(String(Math.min(1, Math.max(0, qty))));
                      }
                    }}
                  >
                    <td>
                      <input
                        type="radio"
                        name="agent-stock-picker"
                        checked={selectedKey === key}
                        onChange={() => {
                          setSelectedKey(key);
                          if (!selectedQty) {
                            setSelectedQty(String(Math.min(1, Math.max(0, qty))));
                          }
                        }}
                      />
                    </td>
                    <td>{item.product_name || "—"}</td>
                    <td>{warehouseNames[item.warehouse] || "Склад..."}</td>
                    <td>{item.product_article || "—"}</td>
                    <td>{item.product_unit || "—"}</td>
                    <td>{productPrices[item.product] ?? "..."}</td>
                    <td className={qty === 0 ? "text-red-600 font-semibold" : ""}>
                      {qty}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!hasLocalSearch && nextUrl && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            className="warehouse-header__create-btn"
            onClick={() => {
              const nextPage = page + 1;
              setPage(nextPage);
              loadPage(nextPage).catch(() => {});
            }}
            disabled={agentProductsLoading}
          >
            Загрузить еще
          </button>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto_auto] md:items-end">
          <div className="text-sm text-slate-700">
            {selectedItem
              ? `Выбрано: ${selectedItem.product_name || "—"} (${warehouseNames[selectedItem.warehouse] || "—"})`
              : "Выберите товар из списка"}
          </div>
          <input
            type="number"
            min="0"
            step="0.001"
            className="warehouse-search__input"
            placeholder="Количество"
            value={selectedQty}
            onChange={(e) => setSelectedQty(e.target.value)}
            disabled={!selectedItem}
          />
          <button
            type="button"
            className="warehouse-header__create-btn"
            onClick={handlePick}
            disabled={!selectedItem || !selectedQty || Boolean(qtyError)}
          >
            Выбрать
          </button>
          <button
            type="button"
            className="warehouse-header__create-btn"
            onClick={onClose}
          >
            Отмена
          </button>
        </div>
        {qtyError && <div className="mt-2 text-sm text-red-600">{qtyError}</div>}
      </div>
    </div>
  );
};

export default AgentStockPickerPage;
