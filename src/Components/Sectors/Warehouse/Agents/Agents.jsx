import {
  Check,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "../../../../store/slices/userSlice";
import {
  approveAgentCart,
  dispatchAgentCart,
  createAgentCart,
  createAgentCartItem,
  deleteAgentCart,
  deleteAgentCartItem,
  getAgentCartById,
  getProductById,
  listAgentCartItems,
  listAgentCarts,
  listMyAgentProducts,
  listOwnerAgentsProducts,
  listOwnerAgentProductsByAgent,
  listAgentReturnCarts,
  createAgentReturnCart,
  getAgentReturnCartById,
  patchAgentReturnCart,
  deleteAgentReturnCart,
  submitAgentReturnCart,
  approveAgentReturnCart,
  rejectAgentReturnCart,
  receiveAgentReturnCart,
  listAgentReturnCartItems,
  createAgentReturnCartItem,
  patchAgentReturnCartItem,
  deleteAgentReturnCartItem,
  listWarehouses,
  listWarehouseProducts,
  patchAgentCart,
  patchAgentCartItem,
  rejectAgentCart,
  submitAgentCart,
  searchAgentCompanies,
  listCompanyAgentRequests,
  createCompanyAgentRequest,
  acceptCompanyAgentRequest,
  rejectCompanyAgentRequest,
  removeCompanyAgent,
  patchCompanyAgentCommonAccess,
  createCompanyMembership,
} from "../../../../api/warehouse";
import { VIEW_MODES } from "../../Market/Warehouse/constants";

import AlertModal from "../../../common/AlertModal/AlertModal";
import {
  getApiErrorPayload,
  validateResErrors,
} from "../../../../../tools/validateResErrors";
import "../../Market/Warehouse/Warehouse.scss";
import "./Agents.scss";

const normalizeList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const OWNER_DISPATCH_CARTS_KEY = "nur_owner_dispatch_cart_ids";

const readOwnerDispatchCartIds = () => {
  if (typeof sessionStorage === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(OWNER_DISPATCH_CARTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
};

const rememberOwnerDispatchCart = (cartId) => {
  if (!cartId || typeof sessionStorage === "undefined") return;
  const ids = readOwnerDispatchCartIds();
  ids.add(String(cartId));
  sessionStorage.setItem(OWNER_DISPATCH_CARTS_KEY, JSON.stringify([...ids]));
};

const forgetOwnerDispatchCart = (cartId) => {
  if (!cartId || typeof sessionStorage === "undefined") return;
  const ids = readOwnerDispatchCartIds();
  ids.delete(String(cartId));
  sessionStorage.setItem(OWNER_DISPATCH_CARTS_KEY, JSON.stringify([...ids]));
};

const isOwnerDispatchCartId = (cartId) =>
  cartId ? readOwnerDispatchCartIds().has(String(cartId)) : false;

const INITIAL_ALERT_MODAL = {
  open: false,
  type: "info",
  title: "",
  message: "",
  okText: "Понятно",
  onConfirm: null,
};

const getErrorMessage = (err, fallback) =>
  validateResErrors(err, err?.detail || err?.message || fallback);

const getCartActionErrorAlert = (
  err,
  { stockTitle = "Недостаточно товара на складе", errorTitle = "Ошибка" } = {},
) => {
  const payload = getApiErrorPayload(err) ?? err;
  const stockMessages =
    payload &&
    typeof payload === "object" &&
    Array.isArray(payload.items) &&
    payload.items.length > 0
      ? payload.items.map((item) => String(item)).filter(Boolean)
      : [];

  if (stockMessages.length > 0) {
    return {
      ...INITIAL_ALERT_MODAL,
      open: true,
      type: "warning",
      title: stockTitle,
      message: stockMessages.join("\n"),
      okText: "Понятно",
    };
  }

  return {
    ...INITIAL_ALERT_MODAL,
    open: true,
    type: "error",
    title: errorTitle,
    message: getErrorMessage(err, errorTitle),
    okText: "Понятно",
  };
};

const getApproveErrorAlert = (err) =>
  getCartActionErrorAlert(err, {
    errorTitle: "Не удалось одобрить заявку",
  });

const getDispatchErrorAlert = (err) =>
  getCartActionErrorAlert(err, {
    errorTitle: "Не удалось выдать товар",
  });

const getReceiveReturnErrorAlert = (err) => {
  const payload = getApiErrorPayload(err) ?? err;
  const qtyMessages =
    payload &&
    typeof payload === "object" &&
    Array.isArray(payload.quantity_returned) &&
    payload.quantity_returned.length > 0
      ? payload.quantity_returned.map((item) => String(item)).filter(Boolean)
      : [];

  if (qtyMessages.length > 0) {
    return {
      ...INITIAL_ALERT_MODAL,
      open: true,
      type: "warning",
      title: "Недостаточно товара у агента",
      message: qtyMessages.join("\n"),
      okText: "Понятно",
    };
  }

  return getCartActionErrorAlert(err, {
    stockTitle: "Недостаточно товара у агента",
    errorTitle: "Не удалось принять возврат",
  });
};

const getApproveReturnErrorAlert = (err) => getReceiveReturnErrorAlert(err);

const openErrorAlert = (setAlert, message, title = "Ошибка") => {
  setAlert({
    ...INITIAL_ALERT_MODAL,
    open: true,
    type: "error",
    title,
    message: getErrorMessage(message, message),
    okText: "Понятно",
  });
};

const openConfirmAlert = (
  setAlert,
  { title, message, onConfirm, okText = "Да" },
) => {
  setAlert({
    ...INITIAL_ALERT_MODAL,
    open: true,
    type: "warning",
    title,
    message,
    okText,
    onConfirm,
  });
};

const shortId = (id) => {
  const s = String(id || "");
  if (!s) return "—";
  return s.length > 8 ? `${s.slice(0, 8)}…` : s;
};

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU");
  } catch {
    return String(iso);
  }
};

const statusLabel = (status) => {
  switch (status) {
    case "draft":
      return "Черновик";
    case "submitted":
      return "Отправлено";
    case "approved":
      return "Одобрено";
    case "rejected":
      return "Отклонено";
    default:
      return status || "—";
  }
};

const statusClass = (status) => {
  switch (status) {
    case "draft":
      return "badge--draft";
    case "submitted":
      return "badge--submitted";
    case "approved":
      return "badge--approved";
    case "rejected":
      return "badge--rejected";
    default:
      return "badge--draft";
  }
};

const companyStatusLabel = (status) => {
  switch (status) {
    case "pending":
      return "Ожидает решения";
    case "active":
      return "Активен";
    case "rejected":
      return "Отклонён";
    case "removed":
      return "Отстранён";
    default:
      return status || "—";
  }
};

const companyStatusClass = (status) => {
  switch (status) {
    case "pending":
      return "badge--pending";
    case "active":
      return "badge--approved";
    case "rejected":
      return "badge--rejected";
    case "removed":
      return "badge--removed";
    default:
      return "badge--draft";
  }
};

const parseQty = (value) => {
  const qtyNum = Number.parseFloat(String(value).replace(",", "."));
  if (!Number.isFinite(qtyNum) || qtyNum <= 0) return null;
  return qtyNum;
};

const getStockQty = (product) => {
  if (product?.quantity == null || product?.quantity === "") return null;
  const n = Number(product.quantity);
  return Number.isFinite(n) ? n : null;
};

const clampQtyToStock = (value, maxStock) => {
  const qtyNum = parseQty(value);
  if (qtyNum == null) return value;
  if (maxStock == null) return String(qtyNum);
  if (maxStock <= 0) return "0";
  if (qtyNum > maxStock) return String(maxStock);
  return String(qtyNum);
};

const buildQtyPresets = (maxStock) => {
  if (maxStock == null) return [1, 5, 10, 24];
  if (maxStock <= 0) return [];
  const presets = [1, 5, 10, 24].filter((p) => p <= maxStock);
  if (!presets.includes(maxStock)) presets.push(maxStock);
  return [...new Set(presets)].sort((a, b) => a - b);
};

const mapWarehouseProductRow = (row) => ({
  id: row.id,
  name: row.name,
  article: row.article,
  unit: row.unit,
  quantity: row.quantity,
});

const mapAgentStockProductRow = (row) => {
  const productId =
    typeof row.product === "string"
      ? row.product
      : row.product?.id || row.product_id;
  return {
    id: productId,
    name: row.product_name || row.name,
    article: row.product_article || row.article,
    unit: row.product_unit || row.unit,
    qty: row.qty,
    qty_available: row.qty_available,
    warehouse: row.warehouse,
  };
};

const getAgentAvailableQty = (product) => {
  const raw =
    product?.qty_available != null && product?.qty_available !== ""
      ? product.qty_available
      : product?.qty;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const clampQtyToAvailable = (value, maxAvailable) => {
  const qtyNum = parseQty(value);
  if (qtyNum == null) return value;
  if (maxAvailable == null) return String(qtyNum);
  if (maxAvailable <= 0) return "0";
  if (qtyNum > maxAvailable) return String(maxAvailable);
  return String(qtyNum);
};

const CATALOG_PAGE_SIZE = 1000;

const makePendingItemId = () =>
  `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const CartItemAddPanel = ({
  disabled,
  busy,
  warehouseId,
  existingItems = [],
  onAddMany,
}) => {
  const searchRef = useRef(null);
  const catalogWarehouseRef = useRef(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [pickList, setPickList] = useState([]);
  const [localError, setLocalError] = useState("");

  const existingQtyByProductId = useMemo(() => {
    const map = {};
    existingItems.forEach((it) => {
      const pid =
        typeof it.product === "string" ? it.product : it.product?.id;
      if (pid) map[pid] = it.quantity_requested;
    });
    return map;
  }, [existingItems]);

  const pickByProductId = useMemo(() => {
    const map = {};
    pickList.forEach((row) => {
      if (row.product?.id) map[row.product.id] = row;
    });
    return map;
  }, [pickList]);

  useEffect(() => {
    setAllProducts([]);
    setPickList([]);
    catalogWarehouseRef.current = null;
  }, [warehouseId]);

  const loadCatalog = useCallback(
    async (force = false) => {
      if (!warehouseId || disabled) return;
      if (
        !force &&
        catalogWarehouseRef.current === warehouseId &&
        allProducts.length > 0
      ) {
        return;
      }
      setLoading(true);
      try {
        const data = await listWarehouseProducts(warehouseId, {
          page_size: CATALOG_PAGE_SIZE,
        });
        const list = normalizeList(data).map(mapWarehouseProductRow);
        setAllProducts(list);
        catalogWarehouseRef.current = warehouseId;
      } catch (e) {
        console.error(e);
        setAllProducts([]);
        setLocalError("Не удалось загрузить список товаров");
      } finally {
        setLoading(false);
      }
    },
    [warehouseId, disabled, allProducts.length],
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allProducts;
    return allProducts.filter((p) => {
      const name = String(p.name || "").toLowerCase();
      const article = String(p.article || "").toLowerCase();
      return name.includes(q) || article.includes(q);
    });
  }, [allProducts, query]);

  const handleSearchFocus = async () => {
    if (disabled || busy) return;
    setCatalogOpen(true);
    setLocalError("");
    await loadCatalog();
  };

  const handleSearchBlur = () => {
    window.setTimeout(() => setCatalogOpen(false), 160);
  };

  const togglePick = (product) => {
    const stockQty = getStockQty(product);
    if (stockQty !== null && stockQty <= 0) {
      setLocalError("Товара нет на складе — добавить нельзя");
      return;
    }
    setLocalError("");
    setPickList((prev) => {
      const exists = prev.find((r) => r.product.id === product.id);
      if (exists) {
        return prev.filter((r) => r.product.id !== product.id);
      }
      const inCart = existingQtyByProductId[product.id];
      const initial = inCart != null ? parseQty(inCart) : 1;
      const safeQty =
        stockQty != null && initial != null
          ? Math.min(initial, stockQty)
          : (initial ?? 1);
      return [
        ...prev,
        {
          pickId: makePendingItemId(),
          product,
          qty: clampQtyToStock(String(safeQty), stockQty),
        },
      ];
    });
  };

  const updatePickQty = (productId, value) => {
    setPickList((prev) =>
      prev.map((row) =>
        row.product.id === productId ? { ...row, qty: value } : row,
      ),
    );
    if (localError) setLocalError("");
  };

  const blurPickQty = (productId) => {
    const row = pickList.find((r) => r.product.id === productId);
    if (!row) return;
    const stockQty = getStockQty(row.product);
    setPickList((prev) =>
      prev.map((r) =>
        r.product.id === productId
          ? { ...r, qty: clampQtyToStock(r.qty, stockQty) }
          : r,
      ),
    );
  };

  const clearPickList = () => {
    setPickList([]);
    setLocalError("");
  };

  const handleAddSelected = async () => {
    if (!pickList.length || busy || disabled) return;
    const entries = [];
    for (const row of pickList) {
      const stockQty = getStockQty(row.product);
      if (stockQty !== null && stockQty <= 0) {
        setLocalError(`«${row.product.name || "Товар"}» — нет на складе`);
        return;
      }
      const qtyNum = parseQty(row.qty);
      if (!qtyNum) {
        setLocalError(`Укажите количество для «${row.product.name || "товара"}»`);
        return;
      }
      if (stockQty != null && qtyNum > stockQty) {
        setLocalError(
          `«${row.product.name}»: на складе только ${stockQty}${row.product.unit ? ` ${row.product.unit}` : ""}`,
        );
        return;
      }
      entries.push({ product: row.product, qtyNum });
    }
    setLocalError("");
    try {
      await onAddMany(entries);
      setPickList([]);
      setQuery("");
      setCatalogOpen(false);
      searchRef.current?.focus();
    } catch {
      // ошибка в родителе
    }
  };

  const trimmedQuery = query.trim();
  const showDropdown =
    catalogOpen &&
    (loading || filteredOptions.length > 0 || allProducts.length > 0);
  const catalogTruncated = allProducts.length >= CATALOG_PAGE_SIZE;

  if (!warehouseId) {
    return (
      <div className="agent-cart-add-panel agent-cart-add-panel--blocked">
        <p className="agent-cart-add-panel__notice">
          Сначала выберите склад (и агента для выдачи), затем отметьте товары и
          укажите количество.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`agent-cart-add-panel ${disabled ? "agent-cart-add-panel--disabled" : ""}`}
    >
      <label className="agent-cart-add-panel__label">
        Выбор товаров
      </label>
      <p className="agent-cart-add-panel__hint agent-cart-add-panel__hint--top">
        Отметьте несколько товаров, укажите количество и добавьте в заявку одним
        нажатием.
      </p>

      <div className="agent-cart-add-panel__search">
        <Search className="agent-cart-add-panel__search-icon" size={18} />
        <input
          ref={searchRef}
          type="text"
          className="agent-cart-add-panel__search-input"
          placeholder="Название, артикул или штрихкод…"
          value={query}
          disabled={disabled || busy}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleSearchFocus}
          onBlur={handleSearchBlur}
        />
        {query && (
          <button
            type="button"
            className="agent-cart-add-panel__search-clear"
            disabled={disabled || busy}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery("");
              setCatalogOpen(true);
              searchRef.current?.focus();
            }}
            aria-label="Очистить поиск"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {loading && (
        <p className="agent-cart-add-panel__hint">Загрузка товаров…</p>
      )}
      {!loading && catalogOpen && !trimmedQuery && allProducts.length > 0 && (
        <p className="agent-cart-add-panel__hint">
          {allProducts.length} товар(ов) — отметьте галочками нужные
          {catalogTruncated
            ? ` (первые ${CATALOG_PAGE_SIZE})`
            : ""}
        </p>
      )}
      {!loading && catalogOpen && trimmedQuery && filteredOptions.length === 0 && (
        <p className="agent-cart-add-panel__hint">Ничего не найдено</p>
      )}
      {!loading && !catalogOpen && !trimmedQuery && (
        <p className="agent-cart-add-panel__hint">
          Нажмите на поле поиска — откроется каталог склада
        </p>
      )}

      {showDropdown && (
        <div
          className="agent-cart-add-panel__catalog agent-cart-add-panel__dropdown--catalog"
          onMouseDown={(e) => e.preventDefault()}
        >
          {(loading ? [] : filteredOptions).map((p) => {
            const stockQty = p.quantity != null ? Number(p.quantity) : null;
            const isOutOfStock = stockQty !== null && stockQty <= 0;
            const isPicked = Boolean(pickByProductId[p.id]);
            const inCartQty = existingQtyByProductId[p.id];
            return (
              <label
                key={p.id}
                className={`agent-cart-add-panel__catalog-row ${isOutOfStock ? "agent-cart-add-panel__catalog-row--out" : ""} ${isPicked ? "agent-cart-add-panel__catalog-row--picked" : ""}`}
              >
                <input
                  type="checkbox"
                  className="agent-cart-add-panel__checkbox"
                  checked={isPicked}
                  disabled={disabled || busy || isOutOfStock}
                  onChange={() => togglePick(p)}
                />
                <span className="agent-cart-add-panel__catalog-info">
                  <span className="agents-option__name">{p.name || "—"}</span>
                  <span className="agents-option__meta">
                    {p.article ? `арт. ${p.article}` : ""}
                    {p.unit ? ` • ${p.unit}` : ""}
                    {stockQty !== null ? ` • На складе: ${stockQty}` : ""}
                    {inCartQty != null ? ` • В заявке: ${inCartQty}` : ""}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}

      {pickList.length > 0 && (
        <div className="agent-cart-add-panel__pick-list">
          <div className="agent-cart-add-panel__pick-list-head">
            <span className="agent-cart-add-panel__pick-list-title">
              К добавлению ({pickList.length})
            </span>
            <button
              type="button"
              className="agent-cart-add-panel__pick-clear"
              disabled={disabled || busy}
              onClick={clearPickList}
            >
              Очистить
            </button>
          </div>
          <div className="agent-cart-add-panel__pick-rows">
            {pickList.map((row) => {
              const stockQty = getStockQty(row.product);
              const qtyNum = parseQty(row.qty);
              const overStock =
                stockQty != null && qtyNum != null && qtyNum > stockQty;
              return (
                <div
                  key={row.pickId}
                  className={`agent-cart-add-panel__pick-row ${overStock ? "agent-cart-add-panel__pick-row--error" : ""}`}
                >
                  <div className="agent-cart-add-panel__pick-row-info">
                    <span className="agent-cart-add-panel__pick-row-name">
                      {row.product.name || "—"}
                    </span>
                    <span className="agent-cart-add-panel__pick-row-meta">
                      {row.product.article ? `арт. ${row.product.article}` : ""}
                      {row.product.unit ? ` • ${row.product.unit}` : ""}
                      {stockQty != null ? ` • макс. ${stockQty}` : ""}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    max={stockQty != null ? stockQty : undefined}
                    className="agent-cart-add-panel__pick-qty"
                    value={row.qty}
                    disabled={disabled || busy}
                    onChange={(e) => updatePickQty(row.product.id, e.target.value)}
                    onBlur={() => blurPickQty(row.product.id)}
                  />
                  <button
                    type="button"
                    className="agent-cart-add-panel__pick-remove"
                    disabled={disabled || busy}
                    onClick={() => togglePick(row.product)}
                    aria-label="Убрать"
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="agent-cart-modal__btn agent-cart-modal__btn--primary agent-cart-add-panel__submit"
            disabled={disabled || busy || pickList.length === 0}
            onClick={handleAddSelected}
          >
            <Plus size={18} />
            Добавить в заявку ({pickList.length})
          </button>
        </div>
      )}

      {localError && (
        <p className="agent-cart-add-panel__error">{localError}</p>
      )}
    </div>
  );
};

const AgentReturnAddPanel = ({
  disabled,
  busy,
  catalogMode = "owner",
  agentId,
  warehouseId,
  existingItems = [],
  onAddMany,
}) => {
  const searchRef = useRef(null);
  const catalogKeyRef = useRef(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [pickList, setPickList] = useState([]);
  const [localError, setLocalError] = useState("");

  const existingQtyByProductId = useMemo(() => {
    const map = {};
    existingItems.forEach((it) => {
      const pid =
        typeof it.product === "string" ? it.product : it.product?.id;
      if (pid) map[pid] = it.quantity_returned;
    });
    return map;
  }, [existingItems]);

  const pickByProductId = useMemo(() => {
    const map = {};
    pickList.forEach((row) => {
      if (row.product?.id) map[row.product.id] = row;
    });
    return map;
  }, [pickList]);

  useEffect(() => {
    setAllProducts([]);
    setPickList([]);
    catalogKeyRef.current = null;
  }, [catalogMode, agentId, warehouseId]);

  const loadCatalog = useCallback(
    async (force = false) => {
      const isAgentCatalog = catalogMode === "agent";
      if (!isAgentCatalog && (!agentId || !warehouseId)) return;
      if (disabled) return;
      const key = isAgentCatalog
        ? `me:${warehouseId || "all"}`
        : `${agentId}:${warehouseId}`;
      if (!force && catalogKeyRef.current === key && allProducts.length > 0) {
        return;
      }
      setLoading(true);
      try {
        let list;
        if (isAgentCatalog) {
          const params = { page: 1, page_size: CATALOG_PAGE_SIZE };
          if (warehouseId) params.warehouse = warehouseId;
          const data = await listMyAgentProducts(params);
          list = normalizeList(data).map(mapAgentStockProductRow);
          if (warehouseId) {
            list = list.filter((p) => p.warehouse === warehouseId);
          }
        } else {
          const data = await listOwnerAgentProductsByAgent(agentId, {
            warehouse: warehouseId,
            page: 1,
            page_size: CATALOG_PAGE_SIZE,
          });
          list = normalizeList(data).map(mapAgentStockProductRow);
        }
        setAllProducts(list.filter((p) => p.id));
        catalogKeyRef.current = key;
        setLocalError("");
      } catch (e) {
        console.error(e);
        setAllProducts([]);
        setLocalError("Не удалось загрузить остатки");
      } finally {
        setLoading(false);
      }
    },
    [
      catalogMode,
      agentId,
      warehouseId,
      disabled,
      allProducts.length,
    ],
  );

  useEffect(() => {
    if (catalogMode !== "agent" || disabled) return;
    loadCatalog(true);
  }, [catalogMode, warehouseId, disabled, loadCatalog]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allProducts;
    return allProducts.filter((p) => {
      const name = String(p.name || "").toLowerCase();
      const article = String(p.article || "").toLowerCase();
      return name.includes(q) || article.includes(q);
    });
  }, [allProducts, query]);

  const handleSearchFocus = async () => {
    if (disabled || busy) return;
    setCatalogOpen(true);
    setLocalError("");
    await loadCatalog(true);
  };

  const handleSearchBlur = () => {
    setTimeout(() => setCatalogOpen(false), 150);
  };

  const togglePick = (product) => {
    if (disabled || busy) return;
    const available = getAgentAvailableQty(product);
    if (available !== null && available <= 0) return;

    setPickList((prev) => {
      const exists = prev.find((r) => r.product.id === product.id);
      if (exists) {
        return prev.filter((r) => r.product.id !== product.id);
      }
      const defaultQty =
        available != null && available < 1
          ? String(available)
          : "1";
      return [
        ...prev,
        {
          pickId: `pick-${product.id}-${Date.now()}`,
          product,
          qty: defaultQty,
        },
      ];
    });
  };

  const updatePickQty = (productId, value) => {
    setPickList((prev) =>
      prev.map((r) =>
        r.product.id === productId ? { ...r, qty: value } : r,
      ),
    );
  };

  const blurPickQty = (productId) => {
    const row = pickList.find((r) => r.product.id === productId);
    if (!row) return;
    const maxQty = getAgentAvailableQty(row.product);
    updatePickQty(productId, clampQtyToAvailable(row.qty, maxQty));
  };

  const clearPickList = () => setPickList([]);

  const handleAddSelected = async () => {
    if (!pickList.length || busy || disabled) return;
    const entries = [];
    for (const row of pickList) {
      const maxQty = getAgentAvailableQty(row.product);
      if (maxQty !== null && maxQty <= 0) {
        setLocalError(`«${row.product.name || "Товар"}» — нельзя вернуть`);
        return;
      }
      const qtyNum = parseQty(row.qty);
      if (!qtyNum) {
        setLocalError(
          `Укажите количество для «${row.product.name || "товара"}»`,
        );
        return;
      }
      if (maxQty != null && qtyNum > maxQty) {
        setLocalError(
          `«${row.product.name}»: доступно только ${maxQty}${row.product.unit ? ` ${row.product.unit}` : ""}`,
        );
        return;
      }
      entries.push({ product: row.product, qtyNum });
    }
    setLocalError("");
    try {
      await onAddMany(entries);
      setPickList([]);
      setQuery("");
      setCatalogOpen(false);
      searchRef.current?.focus();
    } catch {
      // ошибка в родителе
    }
  };

  const trimmedQuery = query.trim();
  const showDropdown =
    catalogOpen &&
    (loading || filteredOptions.length > 0 || allProducts.length > 0);
  const catalogTruncated = allProducts.length >= CATALOG_PAGE_SIZE;

  const needsAgent = catalogMode === "owner";
  if (needsAgent && (!agentId || !warehouseId)) {
    return (
      <div className="agent-cart-add-panel agent-cart-add-panel--blocked">
        <p className="agent-cart-add-panel__notice">
          Сначала выберите агента и склад, затем отметьте товары из его остатков.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`agent-cart-add-panel ${disabled ? "agent-cart-add-panel--disabled" : ""}`}
    >
      <label className="agent-cart-add-panel__label">Товары к возврату</label>
      <p className="agent-cart-add-panel__hint agent-cart-add-panel__hint--top">
        {catalogMode === "agent"
          ? "Товары из ваших остатков на руках. Лимит — «доступно для возврата»."
          : "Отметьте товары из остатков агента. Лимит — доступно для возврата (с учётом уже отправленных заявок)."}
      </p>

      <div className="agent-cart-add-panel__search">
        <Search className="agent-cart-add-panel__search-icon" size={18} />
        <input
          ref={searchRef}
          type="text"
          className="agent-cart-add-panel__search-input"
          placeholder="Название или артикул…"
          value={query}
          disabled={disabled || busy}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleSearchFocus}
          onBlur={handleSearchBlur}
        />
        {query && (
          <button
            type="button"
            className="agent-cart-add-panel__search-clear"
            disabled={disabled || busy}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery("");
              setCatalogOpen(true);
              searchRef.current?.focus();
            }}
            aria-label="Очистить поиск"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {loading && (
        <p className="agent-cart-add-panel__hint">Загрузка остатков…</p>
      )}
      {!loading && catalogOpen && !trimmedQuery && allProducts.length > 0 && (
        <p className="agent-cart-add-panel__hint">
          {allProducts.length} позиций у агента
          {catalogTruncated ? ` (первые ${CATALOG_PAGE_SIZE})` : ""}
        </p>
      )}
      {!loading && catalogOpen && trimmedQuery && filteredOptions.length === 0 && (
        <p className="agent-cart-add-panel__hint">Ничего не найдено</p>
      )}
      {!loading && !catalogOpen && !trimmedQuery && (
        <p className="agent-cart-add-panel__hint">
          {catalogMode === "agent"
            ? "Нажмите на поле поиска — загрузятся ваши остатки"
            : "Нажмите на поле поиска — откроется список остатков агента"}
        </p>
      )}

      {showDropdown && (
        <div
          className="agent-cart-add-panel__catalog agent-cart-add-panel__dropdown--catalog"
          onMouseDown={(e) => e.preventDefault()}
        >
          {(loading ? [] : filteredOptions).map((p) => {
            const maxQty = getAgentAvailableQty(p);
            const isUnavailable = maxQty !== null && maxQty <= 0;
            const isPicked = Boolean(pickByProductId[p.id]);
            const inListQty = existingQtyByProductId[p.id];
            return (
              <label
                key={p.id}
                className={`agent-cart-add-panel__catalog-row ${isUnavailable ? "agent-cart-add-panel__catalog-row--out" : ""} ${isPicked ? "agent-cart-add-panel__catalog-row--picked" : ""}`}
              >
                <input
                  type="checkbox"
                  className="agent-cart-add-panel__checkbox"
                  checked={isPicked}
                  disabled={disabled || busy || isUnavailable}
                  onChange={() => togglePick(p)}
                />
                <span className="agent-cart-add-panel__catalog-info">
                  <span className="agents-option__name">{p.name || "—"}</span>
                  <span className="agents-option__meta">
                    {p.article ? `арт. ${p.article}` : ""}
                    {p.unit ? ` • ${p.unit}` : ""}
                    {p.qty != null ? ` • У агента: ${p.qty}` : ""}
                    {maxQty != null ? ` • Доступно: ${maxQty}` : ""}
                    {inListQty != null ? ` • В списке: ${inListQty}` : ""}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}

      {pickList.length > 0 && (
        <div className="agent-cart-add-panel__pick-list">
          <div className="agent-cart-add-panel__pick-list-head">
            <span className="agent-cart-add-panel__pick-list-title">
              К возврату ({pickList.length})
            </span>
            <button
              type="button"
              className="agent-cart-add-panel__pick-clear"
              disabled={disabled || busy}
              onClick={clearPickList}
            >
              Очистить
            </button>
          </div>
          <div className="agent-cart-add-panel__pick-rows">
            {pickList.map((row) => {
              const maxQty = getAgentAvailableQty(row.product);
              const qtyNum = parseQty(row.qty);
              const overLimit =
                maxQty != null && qtyNum != null && qtyNum > maxQty;
              return (
                <div
                  key={row.pickId}
                  className={`agent-cart-add-panel__pick-row ${overLimit ? "agent-cart-add-panel__pick-row--error" : ""}`}
                >
                  <div className="agent-cart-add-panel__pick-row-info">
                    <span className="agent-cart-add-panel__pick-row-name">
                      {row.product.name || "—"}
                    </span>
                    <span className="agent-cart-add-panel__pick-row-meta">
                      {row.product.article ? `арт. ${row.product.article}` : ""}
                      {row.product.unit ? ` • ${row.product.unit}` : ""}
                      {maxQty != null ? ` • макс. ${maxQty}` : ""}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    max={maxQty != null ? maxQty : undefined}
                    className="agent-cart-add-panel__pick-qty"
                    value={row.qty}
                    disabled={disabled || busy}
                    onChange={(e) =>
                      updatePickQty(row.product.id, e.target.value)
                    }
                    onBlur={() => blurPickQty(row.product.id)}
                  />
                  <button
                    type="button"
                    className="agent-cart-add-panel__pick-remove"
                    disabled={disabled || busy}
                    onClick={() => togglePick(row.product)}
                    aria-label="Убрать"
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="agent-cart-modal__btn agent-cart-modal__btn--primary agent-cart-add-panel__submit"
            disabled={disabled || busy || pickList.length === 0}
            onClick={handleAddSelected}
          >
            <Plus size={18} />
            Добавить в список ({pickList.length})
          </button>
        </div>
      )}

      {localError && (
        <p className="agent-cart-add-panel__error">{localError}</p>
      )}
    </div>
  );
};

const AgentReturnModal = ({
  open,
  onClose,
  onSuccess,
  warehousesById,
  activeAgents = [],
  preset = null,
}) => {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ agent: "", warehouse: "", note: "" });
  const [pendingItems, setPendingItems] = useState([]);
  const [error, setError] = useState("");
  const [alertModal, setAlertModal] = useState(INITIAL_ALERT_MODAL);

  const closeAlertModal = () => setAlertModal(INITIAL_ALERT_MODAL);
  const handleAlertConfirm = () => {
    const onConfirm = alertModal.onConfirm;
    closeAlertModal();
    onConfirm?.();
  };

  const selectedAgentMembership = useMemo(() => {
    if (!form.agent) return null;
    return activeAgents.find((a) => a.user === form.agent) || null;
  }, [activeAgents, form.agent]);

  const warehouseOptions = useMemo(() => {
    const all = Object.values(warehousesById || {});
    const assigned = selectedAgentMembership?.assigned_warehouse;
    if (assigned) return all.filter((w) => w.id === assigned);
    return all;
  }, [warehousesById, selectedAgentMembership]);

  useEffect(() => {
    if (!open) return;
    setForm({
      agent: preset?.agent || "",
      warehouse: preset?.warehouse || "",
      note: "",
    });
    setPendingItems([]);
    setError("");
    setBusy(false);
  }, [open, preset?.agent, preset?.warehouse]);

  useEffect(() => {
    if (!open || !selectedAgentMembership?.assigned_warehouse) return;
    const whId = selectedAgentMembership.assigned_warehouse;
    setForm((prev) => {
      if (prev.warehouse === whId) return prev;
      return { ...prev, warehouse: whId };
    });
  }, [open, selectedAgentMembership?.assigned_warehouse]);

  useEffect(() => {
    if (!open || !preset?.product || !preset?.agent) return;
    const product = {
      id: preset.product,
      name: preset.product_name || "",
      article: preset.product_article || "",
      unit: preset.product_unit || "",
      qty: preset.qty,
      qty_available: preset.qty_available ?? preset.qty,
    };
    const maxQty = getAgentAvailableQty(product);
    if (maxQty != null && maxQty <= 0) return;
    setPendingItems([
      {
        tempId: makePendingItemId(),
        product,
        quantity_returned: maxQty != null && maxQty < 1 ? String(maxQty) : "1",
      },
    ]);
  }, [
    open,
    preset?.product,
    preset?.agent,
    preset?.qty,
    preset?.qty_available,
    preset?.product_name,
    preset?.product_article,
    preset?.product_unit,
  ]);

  const addItemsMany = (entries) => {
    if (!form.agent || !form.warehouse) {
      setError("Сначала выберите агента и склад");
      throw new Error("no agent/warehouse");
    }
    setPendingItems((prev) => {
      const next = [...prev];
      entries.forEach(({ product, qtyNum }) => {
        const pid = product?.id;
        if (!pid) return;
        const idx = next.findIndex((r) => r.product.id === pid);
        const row = {
          tempId: idx >= 0 ? next[idx].tempId : makePendingItemId(),
          product,
          quantity_returned: String(qtyNum),
        };
        if (idx >= 0) next[idx] = row;
        else next.push(row);
      });
      return next;
    });
    setError("");
  };

  const removePendingItem = (tempId) => {
    setPendingItems((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  const updatePendingItemQty = (tempId, value) => {
    setPendingItems((prev) =>
      prev.map((r) =>
        r.tempId === tempId ? { ...r, quantity_returned: value } : r,
      ),
    );
  };

  const blurPendingItemQty = (tempId) => {
    const row = pendingItems.find((r) => r.tempId === tempId);
    if (!row) return;
    const maxQty = getAgentAvailableQty(row.product);
    updatePendingItemQty(
      tempId,
      clampQtyToAvailable(row.quantity_returned, maxQty),
    );
  };

  const doReceiveConfirmed = async () => {
    if (!form.warehouse) {
      setError("Выберите склад");
      return;
    }
    if (!form.agent) {
      setError("Выберите агента");
      return;
    }
    if (pendingItems.length === 0) {
      setError("Добавьте хотя бы одну позицию");
      return;
    }

    for (const row of pendingItems) {
      const maxQty = getAgentAvailableQty(row.product);
      const qtyNum = parseQty(row.quantity_returned);
      if (!qtyNum) {
        setError(`Укажите количество для «${row.product.name || "товара"}»`);
        return;
      }
      if (maxQty != null && qtyNum > maxQty) {
        setError(
          `«${row.product.name}»: доступно только ${maxQty}${row.product.unit ? ` ${row.product.unit}` : ""}`,
        );
        return;
      }
    }

    setBusy(true);
    setError("");
    try {
      const items_input = pendingItems
        .map((row) => {
          const qtyNum = parseQty(row.quantity_returned);
          if (!qtyNum) return null;
          return {
            product: row.product.id,
            quantity_returned: qtyNum.toFixed(3),
          };
        })
        .filter(Boolean);

      const created = await createAgentReturnCart({
        warehouse: form.warehouse,
        agent: form.agent,
        note: form.note || "Возврат от владельца",
        items_input,
      });

      const cartId = created?.id;
      if (!cartId) {
        throw new Error("no cart id");
      }

      await receiveAgentReturnCart(cartId);
      onSuccess?.();

      setAlertModal({
        ...INITIAL_ALERT_MODAL,
        open: true,
        type: "success",
        title: "Возврат принят",
        message: "Товар возвращён на склад.",
        okText: "Понятно",
        onConfirm: () => onClose?.(),
      });
    } catch (e) {
      console.error(e);
      setAlertModal(getReceiveReturnErrorAlert(e));
    } finally {
      setBusy(false);
    }
  };

  const doReceive = () => {
    openConfirmAlert(setAlertModal, {
      title: "Принять возврат на склад?",
      message:
        "Товар будет списан с остатка агента и зачислен на выбранный склад.",
      onConfirm: doReceiveConfirmed,
    });
  };

  if (!open) return null;

  const agentLabel =
    selectedAgentMembership?.user_display || shortId(form.agent);

  return (
    <div className="agent-cart-modal">
      <div className="agent-cart-modal__overlay" onClick={onClose} />
      <div
        className="agent-cart-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-return-modal-title"
      >
        <header className="agent-cart-modal__header">
          <div className="agent-cart-modal__header-left">
            <h2 id="agent-return-modal-title" className="agent-cart-modal__title">
              Принять возврат от агента
            </h2>
          </div>
          <button
            type="button"
            className="agent-cart-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={22} />
          </button>
        </header>

        {error && <div className="agent-cart-modal__error">{error}</div>}

        <div className="agent-cart-modal__body">
          <section className="agent-cart-modal__section">
            <h3 className="agent-cart-modal__section-title">
              Агент и склад
            </h3>
            <div className="agent-cart-modal__form">
              <label className="agent-cart-modal__label">
                Агент *
                <select
                  className="agent-cart-modal__input"
                  value={form.agent}
                  disabled={busy}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      agent: e.target.value,
                      warehouse: "",
                    }))
                  }
                >
                  <option value="">Выберите агента…</option>
                  {activeAgents.map((m) => (
                    <option value={m.user} key={m.id || m.user}>
                      {m.user_display || shortId(m.user)}
                    </option>
                  ))}
                </select>
              </label>
              {activeAgents.length === 0 && (
                <p className="agent-cart-modal__hint">
                  Нет активных агентов. Назначьте агента на вкладке «Компании».
                </p>
              )}
              <label className="agent-cart-modal__label">
                Склад *
                <select
                  className="agent-cart-modal__input"
                  value={form.warehouse}
                  disabled={
                    busy ||
                    !form.agent ||
                    Boolean(selectedAgentMembership?.assigned_warehouse)
                  }
                  onChange={(e) =>
                    setForm((p) => ({ ...p, warehouse: e.target.value }))
                  }
                >
                  <option value="">Выберите склад…</option>
                  {warehouseOptions.map((w) => (
                    <option value={w.id} key={w.id}>
                      {w.name || w.title || shortId(w.id)}
                    </option>
                  ))}
                </select>
              </label>
              {form.agent && (
                <p className="agent-cart-modal__hint">
                  Агент: {agentLabel}
                </p>
              )}
              <label className="agent-cart-modal__label">
                Примечание
                <textarea
                  className="agent-cart-modal__input agent-cart-modal__textarea"
                  rows={2}
                  value={form.note}
                  disabled={busy}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, note: e.target.value }))
                  }
                  placeholder="Комментарий к возврату…"
                />
              </label>
            </div>
          </section>

          <section className="agent-cart-modal__section agent-cart-modal__positions">
            <h3 className="agent-cart-modal__section-title">
              Позиции возврата
            </h3>
            <p className="agent-cart-modal__hint">
              Выберите товары из остатков агента. После проверки нажмите
              «Принять возврат» — товар сразу поступит на склад.
            </p>

            <AgentReturnAddPanel
              disabled={busy || !form.agent || !form.warehouse}
              busy={busy}
              agentId={form.agent}
              warehouseId={form.warehouse}
              existingItems={pendingItems.map((r) => ({
                product: r.product.id,
                quantity_returned: r.quantity_returned,
              }))}
              onAddMany={addItemsMany}
            />

            <div className="agent-cart-modal__table-wrap">
              <table className="agent-cart-modal__table">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Товар</th>
                    <th>Артикул</th>
                    <th>Ед.</th>
                    <th>К возврату</th>
                    <th>Доступно</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pendingItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="agent-cart-modal__empty">
                        Нет позиций — добавьте из списка остатков выше
                      </td>
                    </tr>
                  ) : (
                    pendingItems.map((row, idx) => {
                      const maxQty = getAgentAvailableQty(row.product);
                      return (
                        <tr key={row.tempId}>
                          <td>{idx + 1}</td>
                          <td className="agent-cart-modal__cell-name">
                            {row.product.name || "—"}
                          </td>
                          <td>{row.product.article || "—"}</td>
                          <td>{row.product.unit || "—"}</td>
                          <td>
                            <input
                              type="number"
                              step="0.001"
                              className="agent-cart-modal__input-inline"
                              disabled={busy}
                              value={row.quantity_returned}
                              onChange={(e) =>
                                updatePendingItemQty(
                                  row.tempId,
                                  e.target.value,
                                )
                              }
                              onBlur={() => blurPendingItemQty(row.tempId)}
                            />
                          </td>
                          <td>{maxQty ?? "—"}</td>
                          <td>
                            <button
                              type="button"
                              className="agent-cart-modal__btn-icon agent-cart-modal__btn-icon--danger"
                              disabled={busy}
                              onClick={() => removePendingItem(row.tempId)}
                              title="Удалить"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <footer className="agent-cart-modal__footer">
          <div className="agent-cart-modal__actions">
            <button
              type="button"
              className="agent-cart-modal__btn agent-cart-modal__btn--secondary"
              disabled={busy}
              onClick={onClose}
            >
              Отмена
            </button>
            <button
              type="button"
              className="agent-cart-modal__btn agent-cart-modal__btn--primary"
              disabled={
                busy ||
                !form.warehouse ||
                !form.agent ||
                pendingItems.length === 0
              }
              onClick={doReceive}
            >
              <Undo2 size={18} />
              Принять возврат
              {pendingItems.length > 0 ? ` (${pendingItems.length})` : ""}
            </button>
          </div>
        </footer>
      </div>

      <AlertModal
        open={alertModal.open}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        okText={alertModal.okText}
        onClose={closeAlertModal}
        onConfirm={alertModal.onConfirm ? handleAlertConfirm : undefined}
      />
    </div>
  );
};

const AgentReturnRequestModal = ({
  open,
  onClose,
  cartId,
  setCartId,
  onChanged,
  warehousesById,
  isOwnerOrAdmin,
  isAgent,
}) => {
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState(null);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ warehouse: "", note: "" });
  const [itemQtyDraft, setItemQtyDraft] = useState({});
  const [pendingItems, setPendingItems] = useState([]);
  const productMetaCacheRef = useRef(new Map());
  const [productMetaByItemId, setProductMetaByItemId] = useState({});
  const [error, setError] = useState("");
  const [alertModal, setAlertModal] = useState(INITIAL_ALERT_MODAL);

  const closeAlertModal = () => setAlertModal(INITIAL_ALERT_MODAL);
  const handleAlertConfirm = () => {
    const onConfirm = alertModal.onConfirm;
    closeAlertModal();
    onConfirm?.();
  };

  const isDraft = cart?.status === "draft" || !cart?.status;
  const isSubmitted = cart?.status === "submitted";
  const canEditItems = Boolean(cartId) && isDraft && isAgent;
  const canEditHeader = (!cartId || isDraft) && isAgent;

  const warehouseOptions = useMemo(
    () => Object.values(warehousesById || {}),
    [warehousesById],
  );

  const positionsCount =
    (cartId ? items : pendingItems).filter((it) => {
      const qty = cartId
        ? itemQtyDraft?.[it.id] ?? it.quantity_returned
        : it.quantity_returned;
      return parseQty(qty);
    }).length;

  const load = useCallback(
    async (targetCartId = cartId) => {
      if (!targetCartId) return;
      setLoading(true);
      setError("");
      try {
        const c = await getAgentReturnCartById(targetCartId);
        setCart(c);
        setForm({
          warehouse: c?.warehouse || "",
          note: c?.note || "",
        });
        const itData = await listAgentReturnCartItems({ cart: targetCartId });
        const itList = normalizeList(itData);
        setItems(itList);
        setItemQtyDraft(
          itList.reduce((acc, it) => {
            acc[it.id] = it.quantity_returned ?? "";
            return acc;
          }, {}),
        );
      } catch (e) {
        console.error(e);
        setError(e?.detail || "Не удалось загрузить заявку на возврат");
      } finally {
        setLoading(false);
      }
    },
    [cartId],
  );

  useEffect(() => {
    if (!open) return;
    if (cartId) {
      load();
    } else {
      setCart(null);
      setItems([]);
      setError("");
      setForm({ warehouse: "", note: "" });
      setItemQtyDraft({});
      setPendingItems([]);
    }
  }, [open, cartId, load]);

  const getProductMeta = useCallback(async (productValue) => {
    const productId =
      typeof productValue === "string"
        ? productValue
        : productValue?.id || productValue;
    if (!productId) return { id: "", name: "—", article: null, unit: "" };
    if (typeof productValue === "object" && productValue?.name) {
      return {
        id: productValue.id || productId,
        name: productValue.name,
        article: productValue.article ?? null,
        unit: productValue.unit || "",
      };
    }
    const cached = productMetaCacheRef.current.get(productId);
    if (cached) return cached;
    try {
      const p = await getProductById(productId);
      const meta = {
        id: productId,
        name: p?.name || shortId(productId),
        article: p?.article ?? null,
        unit: p?.unit || "",
      };
      productMetaCacheRef.current.set(productId, meta);
      return meta;
    } catch {
      return {
        id: productId,
        name: shortId(productId),
        article: null,
        unit: "",
      };
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const next = {};
      for (const it of items) {
        const meta = await getProductMeta(it.product);
        next[it.id] = {
          name: it.product_name || meta.name,
          article: meta.article,
          unit: meta.unit,
        };
      }
      if (!cancelled) setProductMetaByItemId(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [items, open, getProductMeta]);

  const createCart = async () => {
    if (!form.warehouse) {
      setError("Выберите склад");
      return;
    }
    if (!isAgent) {
      setError("Создание заявки на возврат доступно только агенту");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await createAgentReturnCart({
        warehouse: form.warehouse,
        note: form.note || "",
      });
      const newCartId = created?.id;
      if (newCartId && pendingItems.length > 0) {
        for (const row of pendingItems) {
          const qtyNum = parseQty(row.quantity_returned);
          if (!qtyNum) continue;
          await createAgentReturnCartItem({
            cart: newCartId,
            product: row.product.id,
            quantity_returned: qtyNum.toFixed(3),
          });
        }
        setPendingItems([]);
      }
      setCart(created);
      setCartId?.(newCartId);
      if (newCartId) await load(newCartId);
      onChanged?.();
    } catch (e) {
      console.error(e);
      setError(getErrorMessage(e, "Не удалось создать заявку на возврат"));
    } finally {
      setBusy(false);
    }
  };

  const saveCartHeader = async () => {
    if (!cartId) return;
    setBusy(true);
    setError("");
    try {
      const patched = await patchAgentReturnCart(cartId, {
        warehouse: form.warehouse || null,
        note: form.note || "",
      });
      setCart(patched);
      onChanged?.();
    } catch (e) {
      console.error(e);
      setError(getErrorMessage(e, "Не удалось сохранить"));
    } finally {
      setBusy(false);
    }
  };

  const removeCartConfirmed = async () => {
    if (!cartId) return;
    setBusy(true);
    try {
      await deleteAgentReturnCart(cartId);
      onChanged?.();
      setCartId?.(null);
      onClose?.();
    } catch (e) {
      console.error(e);
      setError(getErrorMessage(e, "Не удалось удалить"));
    } finally {
      setBusy(false);
    }
  };

  const removeCart = () => {
    if (!cartId) return;
    openConfirmAlert(setAlertModal, {
      title: "Удалить заявку на возврат?",
      message: "Заявка и все позиции будут удалены.",
      onConfirm: removeCartConfirmed,
    });
  };

  const doSubmit = async () => {
    if (!cartId) return;
    if (positionsCount === 0) {
      setError("Добавьте хотя бы одну позицию с количеством больше 0");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await submitAgentReturnCart(cartId);
      setCart(res);
      onChanged?.();
      await load();
    } catch (e) {
      console.error(e);
      setAlertModal(getReceiveReturnErrorAlert(e));
    } finally {
      setBusy(false);
    }
  };

  const doApproveConfirmed = async () => {
    if (!cartId) return;
    setBusy(true);
    setError("");
    try {
      const res = await approveAgentReturnCart(cartId);
      setCart(res);
      onChanged?.();
      await load();
      setAlertModal({
        ...INITIAL_ALERT_MODAL,
        open: true,
        type: "success",
        title: "Возврат одобрен",
        message: "Товар возвращён на склад.",
        okText: "Понятно",
      });
    } catch (e) {
      console.error(e);
      setAlertModal(getApproveReturnErrorAlert(e));
    } finally {
      setBusy(false);
    }
  };

  const doApprove = () => {
    if (!cartId) return;
    openConfirmAlert(setAlertModal, {
      title: "Одобрить возврат?",
      message: "Товар будет списан с остатка агента и зачислен на склад.",
      onConfirm: doApproveConfirmed,
    });
  };

  const doRejectConfirmed = async () => {
    if (!cartId) return;
    setBusy(true);
    try {
      const res = await rejectAgentReturnCart(cartId);
      setCart(res);
      onChanged?.();
      await load();
    } catch (e) {
      console.error(e);
      setError(getErrorMessage(e, "Не удалось отклонить"));
    } finally {
      setBusy(false);
    }
  };

  const doReject = () => {
    if (!cartId) return;
    openConfirmAlert(setAlertModal, {
      title: "Отклонить возврат?",
      message: "Заявка на возврат будет отклонена.",
      onConfirm: doRejectConfirmed,
    });
  };

  const addItemToCart = async (product, qtyNum) => {
    if (!cartId) return;
    const maxQty = getAgentAvailableQty(product);
    if (maxQty !== null && maxQty <= 0) {
      setError("Товара нет в доступном остатке — добавить нельзя");
      throw new Error("out of stock");
    }
    if (maxQty != null && qtyNum > maxQty) {
      setError(
        `Доступно только ${maxQty}${product?.unit ? ` ${product.unit}` : ""}`,
      );
      throw new Error("exceeds stock");
    }
    const productId = product?.id;
    const existing = items.find((it) => {
      const pid = typeof it.product === "string" ? it.product : it.product?.id;
      return pid === productId;
    });
    setBusy(true);
    setError("");
    try {
      const qtyStr = qtyNum.toFixed(3);
      if (existing?.id) {
        await patchAgentReturnCartItem(existing.id, {
          quantity_returned: qtyStr,
        });
      } else {
        await createAgentReturnCartItem({
          cart: cartId,
          product: productId,
          quantity_returned: qtyStr,
        });
      }
      await load();
      onChanged?.();
    } catch (e) {
      console.error(e);
      setError(getErrorMessage(e, "Не удалось добавить позицию"));
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const addItemsMany = async (entries) => {
    if (!entries?.length) return;
    if (!cartId) {
      if (!form.warehouse) {
        setError("Сначала выберите склад");
        throw new Error("no warehouse");
      }
      setPendingItems((prev) => {
        const next = [...prev];
        entries.forEach(({ product, qtyNum }) => {
          const pid = product?.id;
          if (!pid) return;
          const idx = next.findIndex((r) => r.product.id === pid);
          const row = {
            tempId: idx >= 0 ? next[idx].tempId : makePendingItemId(),
            product,
            quantity_returned: String(qtyNum),
          };
          if (idx >= 0) next[idx] = row;
          else next.push(row);
        });
        return next;
      });
      setError("");
      return;
    }
    setBusy(true);
    try {
      for (const { product, qtyNum } of entries) {
        await addItemToCart(product, qtyNum);
      }
    } finally {
      setBusy(false);
    }
  };

  const removePendingItem = (tempId) => {
    setPendingItems((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  const updatePendingItemQty = (tempId, value) => {
    setPendingItems((prev) =>
      prev.map((r) =>
        r.tempId === tempId ? { ...r, quantity_returned: value } : r,
      ),
    );
  };

  const saveItemQty = async (itemId) => {
    setBusy(true);
    try {
      await patchAgentReturnCartItem(itemId, {
        quantity_returned:
          itemQtyDraft?.[itemId] === "" ? "0" : String(itemQtyDraft[itemId]),
      });
      await load();
      onChanged?.();
    } catch (e) {
      console.error(e);
      setError(getErrorMessage(e, "Не удалось сохранить количество"));
    } finally {
      setBusy(false);
    }
  };

  const removeItemConfirmed = async (itemId) => {
    setBusy(true);
    try {
      await deleteAgentReturnCartItem(itemId);
      await load();
      onChanged?.();
    } catch (e) {
      console.error(e);
      setError(getErrorMessage(e, "Не удалось удалить позицию"));
    } finally {
      setBusy(false);
    }
  };

  const removeItem = (itemId) => {
    openConfirmAlert(setAlertModal, {
      title: "Удалить позицию?",
      message: "Позиция будет удалена из заявки.",
      onConfirm: () => removeItemConfirmed(itemId),
    });
  };

  if (!open) return null;

  const warehouseLabel =
    warehousesById?.[form.warehouse]?.name ||
    warehousesById?.[cart?.warehouse]?.name ||
    "";

  const agentLabel =
    cart?.agent_name ||
    cart?.agent_display ||
    (cart?.agent ? shortId(cart.agent) : "—");

  const modalTitle = cartId
    ? "Заявка на возврат"
    : "Новая заявка на возврат";

  return (
    <div className="agent-cart-modal">
      <div className="agent-cart-modal__overlay" onClick={onClose} />
      <div
        className="agent-cart-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-return-request-modal-title"
      >
        <header className="agent-cart-modal__header">
          <div className="agent-cart-modal__header-left">
            <h2
              id="agent-return-request-modal-title"
              className="agent-cart-modal__title"
            >
              {modalTitle}
            </h2>
            {cartId && (
              <span className={`agents-badge ${statusClass(cart?.status)}`}>
                {statusLabel(cart?.status)}
              </span>
            )}
          </div>
          <button
            type="button"
            className="agent-cart-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={22} />
          </button>
        </header>

        {error && <div className="agent-cart-modal__error">{error}</div>}

        {loading ? (
          <div className="agent-cart-modal__body">
            <div className="agent-cart-modal__loading">Загрузка…</div>
          </div>
        ) : (
          <>
            <div className="agent-cart-modal__body">
              {cartId && cart && isOwnerOrAdmin && (
                <section className="agent-cart-modal__section agent-cart-modal__info">
                  <div className="agent-cart-modal__info-grid">
                    <div className="agent-cart-modal__field">
                      <span className="agent-cart-modal__field-label">
                        Агент
                      </span>
                      <span className="agent-cart-modal__field-value">
                        {agentLabel}
                      </span>
                    </div>
                    <div className="agent-cart-modal__field">
                      <span className="agent-cart-modal__field-label">
                        Склад
                      </span>
                      <span className="agent-cart-modal__field-value">
                        {warehouseLabel || shortId(cart.warehouse)}
                      </span>
                    </div>
                    <div className="agent-cart-modal__field">
                      <span className="agent-cart-modal__field-label">
                        Статус
                      </span>
                      <span
                        className={`agents-badge ${statusClass(cart.status)}`}
                      >
                        {statusLabel(cart.status)}
                      </span>
                    </div>
                    <div className="agent-cart-modal__field agent-cart-modal__field--full">
                      <span className="agent-cart-modal__field-label">
                        Примечание
                      </span>
                      <span className="agent-cart-modal__field-value">
                        {cart.note || "—"}
                      </span>
                    </div>
                  </div>
                </section>
              )}

              {canEditHeader && (
                <section className="agent-cart-modal__section">
                  <h3 className="agent-cart-modal__section-title">
                    {cartId ? "Редактирование" : "Параметры заявки"}
                  </h3>
                  <div className="agent-cart-modal__form">
                    <label className="agent-cart-modal__label">
                      Склад *
                      <select
                        className="agent-cart-modal__input"
                        value={form.warehouse}
                        disabled={busy || !canEditHeader}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, warehouse: e.target.value }))
                        }
                      >
                        <option value="">Выберите склад…</option>
                        {warehouseOptions.map((w) => (
                          <option value={w.id} key={w.id}>
                            {w.name || w.title || shortId(w.id)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="agent-cart-modal__label">
                      Примечание
                      <textarea
                        className="agent-cart-modal__input agent-cart-modal__textarea"
                        rows={3}
                        value={form.note}
                        disabled={busy || !canEditHeader}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, note: e.target.value }))
                        }
                        placeholder="Комментарий к возврату…"
                      />
                    </label>
                  </div>
                </section>
              )}

              {isOwnerOrAdmin && isSubmitted && (
                <p className="agent-cart-modal__hint agent-cart-modal__hint--info">
                  Заявка отправлена агентом — проверьте позиции и одобрите или
                  отклоните возврат.
                </p>
              )}

              {(cartId || canEditHeader) && (
                <section className="agent-cart-modal__section agent-cart-modal__positions">
                  <h3 className="agent-cart-modal__section-title">
                    {cartId ? "Позиции возврата" : "Товары к возврату"}
                  </h3>
                  {canEditHeader && (
                    <>
                      <p className="agent-cart-modal__hint">
                        Выберите товары из ваших остатков. Лимит — доступно для
                        возврата.
                      </p>
                      <AgentReturnAddPanel
                        catalogMode="agent"
                        disabled={!canEditHeader || busy}
                        busy={busy}
                        warehouseId={form.warehouse || cart?.warehouse}
                        existingItems={
                          cartId
                            ? items.map((it) => ({
                                product:
                                  typeof it.product === "string"
                                    ? it.product
                                    : it.product?.id,
                                quantity_returned: it.quantity_returned,
                              }))
                            : pendingItems.map((r) => ({
                                product: r.product.id,
                                quantity_returned: r.quantity_returned,
                              }))
                        }
                        onAddMany={addItemsMany}
                      />
                    </>
                  )}

                  <div className="agent-cart-modal__table-wrap">
                    <table className="agent-cart-modal__table">
                      <thead>
                        <tr>
                          <th>№</th>
                          <th>Товар</th>
                          <th>Артикул</th>
                          <th>Ед.</th>
                          <th>Кол-во</th>
                          {canEditHeader && <th />}
                        </tr>
                      </thead>
                      <tbody>
                        {!cartId && pendingItems.length === 0 && (
                          <tr>
                            <td
                              colSpan={canEditHeader ? 6 : 5}
                              className="agent-cart-modal__empty"
                            >
                              Нет позиций
                            </td>
                          </tr>
                        )}
                        {!cartId &&
                          pendingItems.map((row, idx) => (
                            <tr key={row.tempId}>
                              <td>{idx + 1}</td>
                              <td>{row.product.name || "—"}</td>
                              <td>{row.product.article || "—"}</td>
                              <td>{row.product.unit || "—"}</td>
                              <td>
                                <input
                                  type="number"
                                  step="0.001"
                                  className="agent-cart-modal__input-inline"
                                  disabled={busy}
                                  value={row.quantity_returned}
                                  onChange={(e) =>
                                    updatePendingItemQty(
                                      row.tempId,
                                      e.target.value,
                                    )
                                  }
                                />
                              </td>
                              {canEditHeader && (
                                <td>
                                  <button
                                    type="button"
                                    className="agent-cart-modal__btn-icon agent-cart-modal__btn-icon--danger"
                                    disabled={busy}
                                    onClick={() =>
                                      removePendingItem(row.tempId)
                                    }
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        {cartId && items.length === 0 && (
                          <tr>
                            <td
                              colSpan={canEditItems ? 6 : 5}
                              className="agent-cart-modal__empty"
                            >
                              Нет позиций
                            </td>
                          </tr>
                        )}
                        {cartId &&
                          items.map((it, idx) => (
                            <tr key={it.id}>
                              <td>{idx + 1}</td>
                              <td className="agent-cart-modal__cell-name">
                                {productMetaByItemId[it.id]?.name ||
                                  shortId(it.product)}
                              </td>
                              <td>
                                {productMetaByItemId[it.id]?.article || "—"}
                              </td>
                              <td>
                                {productMetaByItemId[it.id]?.unit || "—"}
                              </td>
                              <td>
                                {canEditItems ? (
                                  <input
                                    type="number"
                                    step="0.001"
                                    className="agent-cart-modal__input-inline"
                                    disabled={busy}
                                    value={itemQtyDraft?.[it.id] ?? ""}
                                    onChange={(e) =>
                                      setItemQtyDraft((p) => ({
                                        ...p,
                                        [it.id]: e.target.value,
                                      }))
                                    }
                                  />
                                ) : (
                                  (it.quantity_returned ?? "—")
                                )}
                              </td>
                              {canEditItems && (
                                <td>
                                  <div className="agent-cart-modal__row-actions">
                                    <button
                                      type="button"
                                      className="agent-cart-modal__btn-icon"
                                      disabled={busy}
                                      onClick={() => saveItemQty(it.id)}
                                    >
                                      <Check size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      className="agent-cart-modal__btn-icon agent-cart-modal__btn-icon--danger"
                                      disabled={busy}
                                      onClick={() => removeItem(it.id)}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>

            <footer className="agent-cart-modal__footer">
              <div className="agent-cart-modal__actions">
                {cartId && isAgent && isDraft && (
                  <>
                    <button
                      type="button"
                      className="agent-cart-modal__btn agent-cart-modal__btn--secondary"
                      disabled={busy}
                      onClick={saveCartHeader}
                    >
                      <Check size={18} />
                      Сохранить
                    </button>
                    <button
                      type="button"
                      className="agent-cart-modal__btn agent-cart-modal__btn--danger"
                      disabled={busy}
                      onClick={removeCart}
                    >
                      <Trash2 size={18} />
                      Удалить
                    </button>
                    <button
                      type="button"
                      className="agent-cart-modal__btn agent-cart-modal__btn--primary"
                      disabled={busy || positionsCount === 0}
                      onClick={doSubmit}
                    >
                      <Send size={18} />
                      Отправить владельцу
                    </button>
                  </>
                )}
                {cartId && isOwnerOrAdmin && isSubmitted && (
                  <>
                    <button
                      type="button"
                      className="agent-cart-modal__btn agent-cart-modal__btn--primary"
                      disabled={busy}
                      onClick={doApprove}
                    >
                      <Check size={18} />
                      Одобрить возврат
                    </button>
                    <button
                      type="button"
                      className="agent-cart-modal__btn agent-cart-modal__btn--danger"
                      disabled={busy}
                      onClick={doReject}
                    >
                      <X size={18} />
                      Отклонить
                    </button>
                  </>
                )}
                {!cartId && isAgent && (
                  <button
                    type="button"
                    className="agent-cart-modal__btn agent-cart-modal__btn--primary"
                    disabled={busy || !form.warehouse}
                    onClick={createCart}
                  >
                    <Plus size={18} />
                    {`Создать заявку${pendingItems.length ? ` (${pendingItems.length} поз.)` : ""}`}
                  </button>
                )}
              </div>
            </footer>
          </>
        )}
      </div>

      <AlertModal
        open={alertModal.open}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        okText={alertModal.okText}
        onClose={closeAlertModal}
        onConfirm={alertModal.onConfirm ? handleAlertConfirm : undefined}
      />
    </div>
  );
};

const AgentCartModal = ({
  open,
  onClose,
  cartId,
  setCartId,
  onChanged,
  warehousesById,
  isOwnerOrAdmin,
  isAgent = false,
  currentUserId,
  activeAgents = [],
  dispatchMode = false,
}) => {
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState(null);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ warehouse: "", note: "", agent: "" });
  const [itemQtyDraft, setItemQtyDraft] = useState({});
  const [pendingItems, setPendingItems] = useState([]);
  const productLabelCacheRef = useRef(new Map());
  const productMetaCacheRef = useRef(new Map());
  const [error, setError] = useState("");
  const [alertModal, setAlertModal] = useState(INITIAL_ALERT_MODAL);

  const closeAlertModal = () => setAlertModal(INITIAL_ALERT_MODAL);

  const handleAlertConfirm = () => {
    const onConfirm = alertModal.onConfirm;
    closeAlertModal();
    onConfirm?.();
  };

  const isDraft = cart?.status === "draft" || !cart?.status;
  const isOwnerDispatchFlow = Boolean(isOwnerOrAdmin && dispatchMode);
  const canEditOwnerDispatch = isOwnerDispatchFlow && isDraft;
  const canEditItems =
    Boolean(cartId) && isDraft && (isAgent || isOwnerDispatchFlow);
  const canEditHeader =
    (!cartId || isDraft) && (isAgent || isOwnerDispatchFlow);

  const selectedAgentMembership = useMemo(() => {
    if (!form.agent) return null;
    return activeAgents.find((a) => a.user === form.agent) || null;
  }, [activeAgents, form.agent]);

  const warehouseOptions = useMemo(() => {
    const all = Object.values(warehousesById || {});
    const assigned = selectedAgentMembership?.assigned_warehouse;
    if (isOwnerDispatchFlow && assigned) {
      return all.filter((w) => w.id === assigned);
    }
    return all;
  }, [warehousesById, selectedAgentMembership, isOwnerDispatchFlow]);

  useEffect(() => {
    if (!isOwnerDispatchFlow || !selectedAgentMembership?.assigned_warehouse) {
      return;
    }
    const whId = selectedAgentMembership.assigned_warehouse;
    setForm((prev) => {
      if (prev.warehouse === whId) return prev;
      return { ...prev, warehouse: whId };
    });
  }, [isOwnerDispatchFlow, selectedAgentMembership?.assigned_warehouse]);

  const load = useCallback(async (targetCartId = cartId) => {
    if (!targetCartId) return;
    setLoading(true);
    setError("");
    try {
      const c = await getAgentCartById(targetCartId);
      setCart(c);
      setForm({
        warehouse: c?.warehouse || "",
        note: c?.note || "",
        agent: c?.agent || "",
      });

      const itData = await listAgentCartItems({ cart: targetCartId });
      const itList = normalizeList(itData);
      setItems(itList);
      setItemQtyDraft(
        itList.reduce((acc, it) => {
          acc[it.id] = it.quantity_requested ?? "";
          return acc;
        }, {}),
      );
    } catch (e) {
      console.error(e);
      setError(e?.detail || "Не удалось загрузить заявку");
    } finally {
      setLoading(false);
    }
  }, [cartId]);

  useEffect(() => {
    if (!open) return;
    if (cartId) {
      load();
    } else {
      setCart(null);
      setItems([]);
      setError("");
      setForm({ warehouse: "", note: "", agent: "" });
      setItemQtyDraft({});
      setPendingItems([]);
    }
  }, [open, cartId, load]);

  const positionsCount = cartId ? items.length : pendingItems.length;

  const getProductMeta = useCallback(async (productValue) => {
    const productId =
      typeof productValue === "string"
        ? productValue
        : productValue?.id || productValue;
    if (!productId) return { id: "", name: "—", article: null, unit: "" };

    // если бэк уже отдал объект
    if (typeof productValue === "object" && productValue?.name) {
      return {
        id: productValue.id || productId,
        name: productValue.name,
        article: productValue.article ?? null,
        unit: productValue.unit || "",
      };
    }

    const cached = productMetaCacheRef.current.get(productId);
    if (cached) return cached;

    // placeholder, чтобы не спамить запросами
    const placeholder = {
      id: productId,
      name: "…",
      article: null,
      unit: "",
    };
    productMetaCacheRef.current.set(productId, placeholder);
    try {
      const p = await getProductById(productId);
      const meta = {
        id: productId,
        name: p?.name || shortId(productId),
        article: p?.article ?? null,
        unit: p?.unit || "",
      };
      productMetaCacheRef.current.set(productId, meta);
      productLabelCacheRef.current.set(productId, meta.name);
      return meta;
    } catch (e) {
      const meta = {
        id: productId,
        name: shortId(productId),
        article: null,
        unit: "",
      };
      productMetaCacheRef.current.set(productId, meta);
      productLabelCacheRef.current.set(productId, meta.name);
      return meta;
    }
  }, []);

  const [productMetaByItemId, setProductMetaByItemId] = useState({});
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const next = {};
      for (const it of items) {
        const meta = await getProductMeta(it.product);
        next[it.id] = {
          name: it.product_name || meta.name,
          article: meta.article,
          unit: meta.unit,
          productId:
            typeof it.product === "string"
              ? it.product
              : it.product?.id || it.product,
        };
      }
      if (!cancelled) setProductMetaByItemId(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [items, open, getProductMeta]);

  const saveCartHeader = async () => {
    if (!cartId) return;
    setBusy(true);
    setError("");
    try {
      const patched = await patchAgentCart(cartId, {
        warehouse: form.warehouse || null,
        note: form.note || "",
      });
      setCart(patched);
      onChanged?.();
    } catch (e) {
      console.error(e);
      setError(e?.detail || "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  const createCart = async () => {
    if (!form.warehouse) {
      setError("Выберите склад");
      return;
    }
    if (isOwnerDispatchFlow && !form.agent) {
      setError("Выберите агента");
      return;
    }
    if (!isOwnerDispatchFlow) {
      if (!isAgent) {
        setError("Создание заявки недоступно для владельца и администратора");
        return;
      }
      if (!currentUserId) {
        setError("Не определён текущий пользователь");
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        warehouse: form.warehouse,
        note: form.note || "",
      };
      if (isOwnerDispatchFlow) {
        payload.agent = form.agent;
      }
      const created = await createAgentCart(payload);
      const newCartId = created?.id;
      if (isOwnerDispatchFlow && newCartId) {
        rememberOwnerDispatchCart(newCartId);
      }
      if (newCartId && pendingItems.length > 0) {
        for (const row of pendingItems) {
          const qtyNum = parseQty(row.quantity_requested);
          if (!qtyNum) continue;
          await createAgentCartItem({
            cart: newCartId,
            product: row.product.id,
            quantity_requested: qtyNum.toFixed(3),
          });
        }
        setPendingItems([]);
      }
      setCart(created);
      setCartId?.(newCartId);
      setForm((prev) => ({
        ...prev,
        agent: created?.agent || prev.agent,
        warehouse: created?.warehouse || prev.warehouse,
      }));
      if (newCartId) {
        await load(newCartId);
      }
      onChanged?.();
    } catch (e) {
      console.error(e);
      setError(getErrorMessage(e, "Не удалось создать заявку"));
    } finally {
      setBusy(false);
    }
  };

  const removeCartConfirmed = async () => {
    if (!cartId) return;
    setBusy(true);
    setError("");
    try {
      await deleteAgentCart(cartId);
      forgetOwnerDispatchCart(cartId);
      onChanged?.();
      setCartId?.(null);
      onClose?.();
    } catch (e) {
      console.error(e);
      setError(getErrorMessage(e, "Не удалось удалить"));
    } finally {
      setBusy(false);
    }
  };

  const removeCart = () => {
    if (!cartId) return;
    openConfirmAlert(setAlertModal, {
      title: "Удалить заявку?",
      message: "Заявка и все позиции будут удалены.",
      onConfirm: removeCartConfirmed,
    });
  };

  const doSubmit = async () => {
    if (!cartId) return;
    setBusy(true);
    setError("");
    try {
      const warehouseId = cart?.warehouse || form.warehouse;
      if (warehouseId && items.length > 0) {
        const whData = await listWarehouseProducts(warehouseId, {
          page_size: 1000,
        });
        const whList = normalizeList(whData);
        // API: { results: [ { id, name, article, unit, quantity: "20.000" }, ... ] }
        const stockByProduct = whList.reduce((acc, row) => {
          if (row.id != null) {
            acc[String(row.id)] = Number(row.quantity ?? 0);
          }
          return acc;
        }, {});
        const hasZero = items.some((it) => {
          const productId =
            typeof it.product === "string"
              ? it.product
              : (it.product?.id ?? it.product);
          const qty =
            productId != null ? stockByProduct[String(productId)] : undefined;
          return qty === undefined || qty === null || Number(qty) <= 0;
        });
        if (hasZero) {
          setError(
            "Нельзя отправить заявку: у одного или нескольких товаров нулевой остаток на складе",
          );
          setBusy(false);
          return;
        }
      }
      const res = await submitAgentCart(cartId);
      setCart(res);
      onChanged?.();
      await load();
    } catch (e) {
      console.error(e);
      setError(e?.detail || "Не удалось отправить");
    } finally {
      setBusy(false);
    }
  };

  const doApproveConfirmed = async () => {
    if (!cartId) return;
    setBusy(true);
    setError("");
    try {
      const res = await approveAgentCart(cartId);
      setCart(res);
      onChanged?.();
      await load();
    } catch (e) {
      console.error(e);
      setAlertModal(getApproveErrorAlert(e));
    } finally {
      setBusy(false);
    }
  };

  const doApprove = () => {
    if (!cartId) return;
    openConfirmAlert(setAlertModal, {
      title: "Одобрить заявку?",
      message: "Товар будет списан со склада.",
      onConfirm: doApproveConfirmed,
    });
  };

  const doRejectConfirmed = async () => {
    if (!cartId) return;
    setBusy(true);
    setError("");
    try {
      const res = await rejectAgentCart(cartId);
      setCart(res);
      onChanged?.();
      await load();
    } catch (e) {
      console.error(e);
      setError(getErrorMessage(e, "Не удалось отклонить"));
    } finally {
      setBusy(false);
    }
  };

  const doReject = () => {
    if (!cartId) return;
    openConfirmAlert(setAlertModal, {
      title: "Отклонить заявку?",
      message: "Заявка будет отклонена.",
      onConfirm: doRejectConfirmed,
    });
  };

  const doDispatchConfirmed = async () => {
    if (!cartId) return;
    if (positionsCount === 0) {
      setError("Добавьте хотя бы одну позицию с количеством больше 0");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await dispatchAgentCart(cartId);
      forgetOwnerDispatchCart(cartId);
      setCart(res);
      onChanged?.();
      await load();
      setAlertModal({
        ...INITIAL_ALERT_MODAL,
        open: true,
        type: "success",
        title: "Товар выдан",
        message: "Товар списан со склада и зачислен агенту.",
        okText: "Понятно",
      });
    } catch (e) {
      console.error(e);
      setAlertModal(getDispatchErrorAlert(e));
    } finally {
      setBusy(false);
    }
  };

  const doDispatch = () => {
    if (!cartId) return;
    openConfirmAlert(setAlertModal, {
      title: "Выдать товар агенту?",
      message:
        "Товар будет списан со склада и зачислен на остаток выбранного агента.",
      onConfirm: doDispatchConfirmed,
    });
  };

  const addItemToCart = async (product, qtyNum) => {
    if (!cartId) return;
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError("Введите корректное количество (> 0)");
      throw new Error("invalid qty");
    }
    const stockQty = getStockQty(product);
    if (stockQty !== null && stockQty <= 0) {
      setError("Товара нет на складе — добавить нельзя");
      throw new Error("out of stock");
    }
    if (stockQty !== null && qtyNum > stockQty) {
      setError(
        `На складе только ${stockQty}${product?.unit ? ` ${product.unit}` : ""} — нельзя добавить больше`,
      );
      throw new Error("exceeds stock");
    }
    const productId = product?.id || product;
    const existing = items.find((it) => {
      const pid = typeof it.product === "string" ? it.product : it.product?.id;
      return pid === productId;
    });

    setBusy(true);
    setError("");
    try {
      const qtyStr = qtyNum.toFixed(3);
      if (existing?.id) {
        await patchAgentCartItem(existing.id, {
          quantity_requested: qtyStr,
        });
      } else {
        await createAgentCartItem({
          cart: cartId,
          product: productId,
          quantity_requested: qtyStr,
        });
      }
      await load();
      onChanged?.();
    } catch (e) {
      console.error(e);
      setError(e?.detail || "Не удалось добавить позицию");
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const addItemsMany = async (entries) => {
    if (!entries?.length) return;

    if (!cartId) {
      if (!form.warehouse) {
        setError("Сначала выберите склад");
        throw new Error("no warehouse");
      }
      if (isOwnerDispatchFlow && !form.agent) {
        setError("Выберите агента");
        throw new Error("no agent");
      }
      setPendingItems((prev) => {
        const next = [...prev];
        entries.forEach(({ product, qtyNum }) => {
          const pid = product?.id;
          if (!pid) return;
          const idx = next.findIndex((r) => r.product.id === pid);
          const row = {
            tempId: idx >= 0 ? next[idx].tempId : makePendingItemId(),
            product,
            quantity_requested: String(qtyNum),
          };
          if (idx >= 0) next[idx] = row;
          else next.push(row);
        });
        return next;
      });
      setError("");
      return;
    }

    setBusy(true);
    setError("");
    try {
      for (const { product, qtyNum } of entries) {
        await addItemToCart(product, qtyNum);
      }
    } finally {
      setBusy(false);
    }
  };

  const removePendingItem = (tempId) => {
    setPendingItems((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  const updatePendingItemQty = (tempId, value) => {
    setPendingItems((prev) =>
      prev.map((r) =>
        r.tempId === tempId ? { ...r, quantity_requested: value } : r,
      ),
    );
  };

  const saveItemQty = async (itemId) => {
    const value = itemQtyDraft?.[itemId];
    setBusy(true);
    setError("");
    try {
      await patchAgentCartItem(itemId, {
        quantity_requested: value === "" ? "0" : String(value),
      });
      await load();
      onChanged?.();
    } catch (e) {
      console.error(e);
      setError(e?.detail || "Не удалось сохранить количество");
    } finally {
      setBusy(false);
    }
  };

  const removeItemConfirmed = async (itemId) => {
    setBusy(true);
    setError("");
    try {
      await deleteAgentCartItem(itemId);
      await load();
      onChanged?.();
    } catch (e) {
      console.error(e);
      setError(getErrorMessage(e, "Не удалось удалить позицию"));
    } finally {
      setBusy(false);
    }
  };

  const removeItem = (itemId) => {
    openConfirmAlert(setAlertModal, {
      title: "Удалить позицию?",
      message: "Позиция будет удалена из заявки.",
      onConfirm: () => removeItemConfirmed(itemId),
    });
  };

  if (!open) return null;

  const warehouseLabel =
    warehousesById?.[form.warehouse]?.name ||
    warehousesById?.[cart?.warehouse]?.name ||
    "";

  const agentLabel =
    cart?.agent_name ||
    cart?.agent_display ||
    selectedAgentMembership?.user_display ||
    (cart?.agent || form.agent ? shortId(cart?.agent || form.agent) : "—");

  const modalTitle = cartId
    ? isOwnerDispatchFlow
      ? "Выдача товара агенту"
      : "Заявка на товар"
    : isOwnerDispatchFlow
      ? "Выдача товара агенту"
      : "Новая заявка";

  return (
    <div className="agent-cart-modal">
      <div className="agent-cart-modal__overlay" onClick={onClose} />
      <div
        className="agent-cart-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-cart-modal-title"
      >
        {/* Header: заголовок, статус, ID, закрыть */}
        <header className="agent-cart-modal__header">
          <div className="agent-cart-modal__header-left">
            <h2 id="agent-cart-modal-title" className="agent-cart-modal__title">
              {modalTitle}
            </h2>
            {cartId && (
              <div className="agent-cart-modal__meta-inline">
                <span className={`agents-badge ${statusClass(cart?.status)}`}>
                  {statusLabel(cart?.status)}
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            className="agent-cart-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={22} />
          </button>
        </header>

        {error && <div className="agent-cart-modal__error">{error}</div>}

        {loading ? (
          <div className="agent-cart-modal__body">
            <div className="agent-cart-modal__loading">Загрузка заявки…</div>
          </div>
        ) : (
          <>
            <div className="agent-cart-modal__body">
              {/* Блок данных заявки — просмотр (не режим выдачи владельцем) */}
              {cartId && cart && !isOwnerDispatchFlow && (
                <section className="agent-cart-modal__section agent-cart-modal__info">
                  <h3 className="agent-cart-modal__section-title">
                    Данные заявки
                  </h3>
                  <div className="agent-cart-modal__info-grid">
                    <div className="agent-cart-modal__field">
                      <span className="agent-cart-modal__field-label">
                        Агент
                      </span>
                      <span className="agent-cart-modal__field-value">
                        {agentLabel}
                      </span>
                    </div>
                    <div className="agent-cart-modal__field">
                      <span className="agent-cart-modal__field-label">
                        Склад
                      </span>
                      <span className="agent-cart-modal__field-value">
                        {warehouseLabel || shortId(cart.warehouse)}
                      </span>
                    </div>
                    <div className="agent-cart-modal__field">
                      <span className="agent-cart-modal__field-label">
                        Статус
                      </span>
                      <span
                        className={`agents-badge ${statusClass(cart.status)}`}
                      >
                        {statusLabel(cart.status)}
                      </span>
                    </div>
                    <div className="agent-cart-modal__field agent-cart-modal__field--full">
                      <span className="agent-cart-modal__field-label">
                        Примечание
                      </span>
                      <span className="agent-cart-modal__field-value">
                        {cart.note || "—"}
                      </span>
                    </div>
                    <div className="agent-cart-modal__field">
                      <span className="agent-cart-modal__field-label">
                        Дата создания
                      </span>
                      <span className="agent-cart-modal__field-value">
                        {fmtDateTime(cart.created_date)}
                      </span>
                    </div>
                    <div className="agent-cart-modal__field">
                      <span className="agent-cart-modal__field-label">
                        Дата одобрения
                      </span>
                      <span className="agent-cart-modal__field-value">
                        {fmtDateTime(cart.approved_at)}
                      </span>
                    </div>
                  </div>
                </section>
              )}

              {/* Параметры заявки — сотрудник (не owner/admin) */}
              {isAgent && canEditHeader && (
                <section className="agent-cart-modal__section">
                  <h3 className="agent-cart-modal__section-title">
                    {cartId ? "Редактирование" : "Параметры заявки"}
                  </h3>
                  <div className="agent-cart-modal__form">
                    <label className="agent-cart-modal__label">
                      Склад *
                      <select
                        className="agent-cart-modal__input"
                        value={form.warehouse}
                        disabled={busy || !canEditHeader}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, warehouse: e.target.value }))
                        }
                      >
                        <option value="">Выберите склад…</option>
                        {warehouseOptions.map((w) => (
                          <option value={w.id} key={w.id}>
                            {w.name || w.title || shortId(w.id)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="agent-cart-modal__label">
                      Примечание
                      <textarea
                        className="agent-cart-modal__input agent-cart-modal__textarea"
                        rows={3}
                        value={form.note}
                        disabled={busy || !canEditHeader}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, note: e.target.value }))
                        }
                        placeholder="Комментарий к заявке…"
                      />
                    </label>
                  </div>
                </section>
              )}

              {/* Параметры выдачи — владелец */}
              {isOwnerDispatchFlow && canEditHeader && (
                <section className="agent-cart-modal__section">
                  <h3 className="agent-cart-modal__section-title">
                    {cartId ? "Параметры выдачи" : "Кому и откуда выдать"}
                  </h3>
                  <div className="agent-cart-modal__form">
                    <label className="agent-cart-modal__label">
                      Агент *
                      <select
                        className="agent-cart-modal__input"
                        value={form.agent}
                        disabled={busy || Boolean(cartId)}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            agent: e.target.value,
                            warehouse: "",
                          }))
                        }
                      >
                        <option value="">Выберите агента…</option>
                        {activeAgents.map((m) => (
                          <option value={m.user} key={m.id || m.user}>
                            {m.user_display || shortId(m.user)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {activeAgents.length === 0 && (
                      <p className="agent-cart-modal__hint">
                        Нет активных агентов. Назначьте агента на вкладке
                        «Компании».
                      </p>
                    )}
                    <label className="agent-cart-modal__label">
                      Склад *
                      <select
                        className="agent-cart-modal__input"
                        value={form.warehouse}
                        disabled={
                          busy ||
                          !canEditHeader ||
                          !form.agent ||
                          Boolean(selectedAgentMembership?.assigned_warehouse)
                        }
                        onChange={(e) =>
                          setForm((p) => ({ ...p, warehouse: e.target.value }))
                        }
                      >
                        <option value="">Выберите склад…</option>
                        {warehouseOptions.map((w) => (
                          <option value={w.id} key={w.id}>
                            {w.name || w.title || shortId(w.id)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedAgentMembership?.assigned_warehouse && (
                      <p className="agent-cart-modal__hint">
                        Агенту назначен склад:{" "}
                        {warehousesById?.[
                          selectedAgentMembership.assigned_warehouse
                        ]?.name ||
                          shortId(selectedAgentMembership.assigned_warehouse)}
                      </p>
                    )}
                    <label className="agent-cart-modal__label">
                      Примечание
                      <textarea
                        className="agent-cart-modal__input agent-cart-modal__textarea"
                        rows={3}
                        value={form.note}
                        disabled={busy || !canEditHeader}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, note: e.target.value }))
                        }
                        placeholder="Комментарий к выдаче…"
                      />
                    </label>
                  </div>
                </section>
              )}

              {cartId &&
                cart &&
                isOwnerDispatchFlow &&
                !canEditOwnerDispatch && (
                  <section className="agent-cart-modal__section agent-cart-modal__info">
                    <p className="agent-cart-modal__hint">
                      Заявка уже обработана — только просмотр.
                    </p>
                  </section>
                )}

              {cartId &&
                cart &&
                isOwnerOrAdmin &&
                !isOwnerDispatchFlow &&
                isDraft && (
                  <p className="agent-cart-modal__hint agent-cart-modal__hint--info">
                    Черновик агента — ожидает отправки агентом. Одобрение будет
                    доступно после статуса «Отправлено».
                  </p>
                )}

              {(cartId || canEditHeader) && (
                <section className="agent-cart-modal__section agent-cart-modal__positions">
                  <h3 className="agent-cart-modal__section-title">
                    {cartId ? "Позиции заявки" : "Товары в заявке"}
                  </h3>
                  {!cartId && (
                    <p className="agent-cart-modal__hint agent-cart-modal__hint--info">
                      Сначала выберите склад и добавьте товары — затем нажмите
                      «{isOwnerDispatchFlow ? "Создать черновик" : "Создать заявку"}»
                      внизу.
                    </p>
                  )}
                  {canEditHeader && (
                    <>
                      <p className="agent-cart-modal__hint">
                        {isOwnerDispatchFlow
                          ? "Отметьте товары в каталоге, укажите количество и добавьте в заявку. Затем нажмите «Выдать»."
                          : !cartId
                            ? "Можно добавить товары до сохранения заявки."
                            : "Редактировать можно только в статусе «Черновик»."}
                      </p>

                      <CartItemAddPanel
                        disabled={!canEditHeader || busy}
                        busy={busy}
                        warehouseId={form.warehouse || cart?.warehouse}
                        existingItems={
                          cartId
                            ? items
                            : pendingItems.map((r) => ({
                                product: r.product.id,
                                quantity_requested: r.quantity_requested,
                              }))
                        }
                        onAddMany={addItemsMany}
                      />
                    </>
                  )}

                  <div className="agent-cart-modal__table-wrap">
                    <table className="agent-cart-modal__table">
                      <thead>
                        <tr>
                          <th>№</th>
                          <th>Товар</th>
                          <th>Артикул</th>
                          <th>Ед.</th>
                          <th>Кол-во</th>
                          {cartId && <th>Дата создания</th>}
                          {cartId && <th>Обновлено</th>}
                          {canEditHeader && <th>Действия</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {!cartId && pendingItems.length === 0 && (
                          <tr>
                            <td
                              colSpan={canEditHeader ? 6 : 5}
                              className="agent-cart-modal__empty"
                            >
                              Нет позиций — добавьте из каталога выше
                            </td>
                          </tr>
                        )}
                        {!cartId &&
                          pendingItems.map((row, idx) => (
                            <tr key={row.tempId}>
                              <td>{idx + 1}</td>
                              <td className="agent-cart-modal__cell-name">
                                {row.product.name || "—"}
                              </td>
                              <td>{row.product.article || "—"}</td>
                              <td>{row.product.unit || "—"}</td>
                              <td>
                                <input
                                  type="number"
                                  step="0.001"
                                  className="agent-cart-modal__input-inline"
                                  disabled={busy}
                                  value={row.quantity_requested}
                                  onChange={(e) =>
                                    updatePendingItemQty(
                                      row.tempId,
                                      e.target.value,
                                    )
                                  }
                                />
                              </td>
                              {canEditHeader && (
                                <td>
                                  <button
                                    type="button"
                                    className="agent-cart-modal__btn-icon agent-cart-modal__btn-icon--danger"
                                    disabled={busy}
                                    onClick={() => removePendingItem(row.tempId)}
                                    title="Удалить"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        {cartId && items.length === 0 && (
                          <tr>
                            <td
                              colSpan={canEditItems ? 8 : 7}
                              className="agent-cart-modal__empty"
                            >
                              Нет позиций
                            </td>
                          </tr>
                        )}
                        {cartId &&
                          items.map((it, idx) => (
                            <tr key={it.id}>
                              <td>{idx + 1}</td>
                              <td className="agent-cart-modal__cell-name">
                                {productMetaByItemId?.[it.id]?.name ||
                                  shortId(it.product)}
                              </td>
                              <td>
                                {productMetaByItemId?.[it.id]?.article || "—"}
                              </td>
                              <td>
                                {productMetaByItemId?.[it.id]?.unit || "—"}
                              </td>
                              <td>
                                {canEditItems ? (
                                  <input
                                    type="number"
                                    step="0.001"
                                    className="agent-cart-modal__input-inline"
                                    disabled={busy || !canEditItems}
                                    value={itemQtyDraft?.[it.id] ?? ""}
                                    onChange={(e) =>
                                      setItemQtyDraft((p) => ({
                                        ...p,
                                        [it.id]: e.target.value,
                                      }))
                                    }
                                  />
                                ) : (
                                  (itemQtyDraft?.[it.id] ??
                                  it.quantity_requested ??
                                  "—")
                                )}
                              </td>
                              <td className="agent-cart-modal__cell-date">
                                {fmtDateTime(it.created_date)}
                              </td>
                              <td className="agent-cart-modal__cell-date">
                                {fmtDateTime(it.updated_date)}
                              </td>
                              {canEditItems && (
                                <td>
                                  <div className="agent-cart-modal__row-actions">
                                    <button
                                      type="button"
                                      className="agent-cart-modal__btn-icon"
                                      disabled={busy || !canEditItems}
                                      onClick={() => saveItemQty(it.id)}
                                      title="Сохранить количество"
                                    >
                                      <Check size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      className="agent-cart-modal__btn-icon agent-cart-modal__btn-icon--danger"
                                      disabled={busy || !canEditItems}
                                      onClick={() => removeItem(it.id)}
                                      title="Удалить позицию"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>

            {/* Футер с действиями */}
            <footer className="agent-cart-modal__footer">
              {cartId ? (
                <div className="agent-cart-modal__actions">
                  {isAgent && (
                    <>
                      <button
                        type="button"
                        className="agent-cart-modal__btn agent-cart-modal__btn--secondary"
                        disabled={busy || !isDraft}
                        onClick={saveCartHeader}
                        title={
                          !isDraft
                            ? "Только в черновике"
                            : "Сохранить склад и примечание"
                        }
                      >
                        <Check size={18} />
                        Сохранить
                      </button>
                      {isDraft && (
                        <button
                          type="button"
                          className="agent-cart-modal__btn agent-cart-modal__btn--danger"
                          disabled={busy}
                          onClick={removeCart}
                        >
                          <Trash2 size={18} />
                          Удалить заявку
                        </button>
                      )}
                      {cart?.status === "draft" && (
                        <button
                          type="button"
                          className="agent-cart-modal__btn agent-cart-modal__btn--primary"
                          disabled={busy}
                          onClick={doSubmit}
                        >
                          <Send size={18} />
                          Отправить владельцу
                        </button>
                      )}
                    </>
                  )}
                  {canEditOwnerDispatch && (
                    <>
                      <button
                        type="button"
                        className="agent-cart-modal__btn agent-cart-modal__btn--secondary"
                        disabled={busy}
                        onClick={saveCartHeader}
                      >
                        <Check size={18} />
                        Сохранить
                      </button>
                      <button
                        type="button"
                        className="agent-cart-modal__btn agent-cart-modal__btn--danger"
                        disabled={busy}
                        onClick={removeCart}
                      >
                        <Trash2 size={18} />
                        Удалить
                      </button>
                      <button
                        type="button"
                        className="agent-cart-modal__btn agent-cart-modal__btn--primary"
                        disabled={busy || positionsCount === 0}
                        onClick={doDispatch}
                      >
                        <Send size={18} />
                        Выдать
                      </button>
                    </>
                  )}
                  {cart?.status === "submitted" &&
                    isOwnerOrAdmin &&
                    !isOwnerDispatchFlow && (
                      <>
                        <button
                          type="button"
                          className="agent-cart-modal__btn agent-cart-modal__btn--primary"
                          disabled={busy}
                          onClick={doApprove}
                        >
                          <Check size={18} />
                          Одобрить
                        </button>
                        <button
                          type="button"
                          className="agent-cart-modal__btn agent-cart-modal__btn--danger"
                          disabled={busy}
                          onClick={doReject}
                        >
                          <X size={18} />
                          Отклонить
                        </button>
                      </>
                    )}
                </div>
              ) : (
                <div className="agent-cart-modal__actions">
                  <button
                    type="button"
                    className="agent-cart-modal__btn agent-cart-modal__btn--primary"
                    disabled={
                      busy ||
                      !form.warehouse ||
                      (isOwnerDispatchFlow && !form.agent)
                    }
                    onClick={createCart}
                  >
                    <Plus size={18} />
                    {isOwnerDispatchFlow
                      ? `Создать черновик${pendingItems.length ? ` (${pendingItems.length} поз.)` : ""}`
                      : `Создать заявку${pendingItems.length ? ` (${pendingItems.length} поз.)` : ""}`}
                  </button>
                </div>
              )}
            </footer>
          </>
        )}
      </div>

      <AlertModal
        open={alertModal.open}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        okText={alertModal.okText}
        onClose={closeAlertModal}
        onConfirm={alertModal.onConfirm ? handleAlertConfirm : undefined}
      />
    </div>
  );
};

const Agents = () => {
  const { profile } = useUser();
  const userRole = profile?.role;
  const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";
  // Роли в компании настраиваются динамически: «агент» = любой сотрудник, не owner/admin
  const isAgent = !isOwnerOrAdmin;

  // Владелец/админ: все заявки, история, запросы, выдача. Остальные: свои заявки и остатки.
  const [activeTab, setActiveTab] = useState("carts");
  const [historySubTab, setHistorySubTab] = useState("approved");
  const [ownerCompanySubTab, setOwnerCompanySubTab] = useState("incoming"); // incoming | active
  const [agentCompanySubTab, setAgentCompanySubTab] = useState("search"); // search | myRequests
  const [viewMode, setViewMode] = useState(VIEW_MODES.TABLE);

  const [warehouses, setWarehouses] = useState([]);
  const warehousesById = useMemo(
    () =>
      normalizeList(warehouses).reduce((acc, w) => {
        acc[w.id] = w;
        return acc;
      }, {}),
    [warehouses],
  );

  // carts list
  const [cartsLoading, setCartsLoading] = useState(false);
  const [cartsError, setCartsError] = useState("");
  const [carts, setCarts] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [actionBusyId, setActionBusyId] = useState(null);
  const [alertModal, setAlertModal] = useState(INITIAL_ALERT_MODAL);

  const closeAlertModal = () => setAlertModal(INITIAL_ALERT_MODAL);

  const handleAlertConfirm = () => {
    const onConfirm = alertModal.onConfirm;
    closeAlertModal();
    onConfirm?.();
  };

  const loadWarehouses = useCallback(async () => {
    try {
      const data = await listWarehouses({ page_size: 1000 });
      setWarehouses(normalizeList(data));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadCarts = useCallback(async () => {
    setCartsLoading(true);
    setCartsError("");
    try {
      const params = {};
      const effectiveStatus =
        activeTab === "requests"
          ? "submitted"
          : activeTab === "history"
            ? ""
            : statusFilter;
      if (effectiveStatus) params.status = effectiveStatus;
      if (search.trim()) params.search = search.trim();
      const data = await listAgentCarts(params);
      setCarts(normalizeList(data));
    } catch (e) {
      console.error(e);
      setCartsError(e?.detail || "Не удалось загрузить заявки");
      setCarts([]);
    } finally {
      setCartsLoading(false);
    }
  }, [statusFilter, search, activeTab]);

  // return carts (заявки агента на возврат)
  const [returnCartsLoading, setReturnCartsLoading] = useState(false);
  const [returnCartsError, setReturnCartsError] = useState("");
  const [returnCarts, setReturnCarts] = useState([]);
  const [returnStatusFilter, setReturnStatusFilter] = useState("");
  const [returnsSubTab, setReturnsSubTab] = useState("list");
  const [returnHistorySubTab, setReturnHistorySubTab] = useState("approved");
  const [returnActionBusyId, setReturnActionBusyId] = useState(null);
  const [returnRequestModalOpen, setReturnRequestModalOpen] = useState(false);
  const [returnRequestCartId, setReturnRequestCartId] = useState(null);

  const loadReturnCarts = useCallback(async () => {
    setReturnCartsLoading(true);
    setReturnCartsError("");
    try {
      const params = {};
      if (isOwnerOrAdmin && returnsSubTab === "incoming") {
        params.status = "submitted";
      } else if (isOwnerOrAdmin && returnsSubTab === "history") {
        // все статусы, фильтр на клиенте
      } else if (returnStatusFilter) {
        params.status = returnStatusFilter;
      }
      if (search.trim()) params.search = search.trim();
      const data = await listAgentReturnCarts(params);
      setReturnCarts(normalizeList(data));
    } catch (e) {
      console.error(e);
      setReturnCartsError(e?.detail || "Не удалось загрузить заявки на возврат");
      setReturnCarts([]);
    } finally {
      setReturnCartsLoading(false);
    }
  }, [returnStatusFilter, search, returnsSubTab, isOwnerOrAdmin]);

  // stocks
  const [stocksLoading, setStocksLoading] = useState(false);
  const [stocksError, setStocksError] = useState("");
  const [stocks, setStocks] = useState([]);

  const loadStocks = useCallback(async () => {
    setStocksLoading(true);
    setStocksError("");
    try {
      const data = isOwnerOrAdmin
        ? await listOwnerAgentsProducts()
        : isAgent
          ? await listMyAgentProducts()
          : [];
      setStocks(normalizeList(data));
    } catch (e) {
      console.error(e);
      setStocksError(e?.detail || "Не удалось загрузить остатки");
      setStocks([]);
    } finally {
      setStocksLoading(false);
    }
  }, [isOwnerOrAdmin, isAgent]);

  // company agent requests (агент ↔ компании)
  const [companyRequestsLoading, setCompanyRequestsLoading] = useState(false);
  const [companyRequestsError, setCompanyRequestsError] = useState("");
  const [companyRequests, setCompanyRequests] = useState([]);
  const [companyStatusFilter, setCompanyStatusFilter] = useState("");
  const [companyActionBusyId, setCompanyActionBusyId] = useState(null);
  const [newMembershipUserId, setNewMembershipUserId] = useState("");
  const [newMembershipCommonEnabled, setNewMembershipCommonEnabled] =
    useState(false);
  const [newMembershipCanSellWholesale, setNewMembershipCanSellWholesale] =
    useState(false);
  const [newMembershipAssignedWarehouse, setNewMembershipAssignedWarehouse] =
    useState("");
  const [newMembershipWarehouse, setNewMembershipWarehouse] = useState("");
  const [newMembershipBusy, setNewMembershipBusy] = useState(false);
  const [newMembershipError, setNewMembershipError] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [companySearchLoading, setCompanySearchLoading] = useState(false);
  const [companySearchError, setCompanySearchError] = useState("");
  const [companySearchResults, setCompanySearchResults] = useState([]);
  const companySearchTimerRef = useRef(null);

  const loadCompanyRequests = useCallback(async () => {
    setCompanyRequestsLoading(true);
    setCompanyRequestsError("");
    try {
      const params = {};
      if (companyStatusFilter) params.status = companyStatusFilter;
      const data = await listCompanyAgentRequests(params);
      setCompanyRequests(normalizeList(data));
    } catch (e) {
      console.error(e);
      setCompanyRequestsError(
        e?.detail || "Не удалось загрузить заявки агентов по компаниям",
      );
      setCompanyRequests([]);
    } finally {
      setCompanyRequestsLoading(false);
    }
  }, [companyStatusFilter]);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  useEffect(() => {
    if (
      activeTab === "carts" ||
      activeTab === "history" ||
      activeTab === "requests"
    )
      loadCarts();
    if (activeTab === "stocks") loadStocks();
    if (activeTab === "returns") loadReturnCarts();
  }, [activeTab, loadCarts, loadStocks, loadReturnCarts]);

  useEffect(() => {
    if (activeTab !== "companies") return;
    loadCompanyRequests();
  }, [activeTab, loadCompanyRequests]);

  useEffect(() => {
    if (activeTab !== "companies") return;
    if (companySearchTimerRef.current) {
      clearTimeout(companySearchTimerRef.current);
    }
    if (!companySearch.trim()) {
      setCompanySearchResults([]);
      setCompanySearchError("");
      return;
    }
    companySearchTimerRef.current = setTimeout(async () => {
      setCompanySearchLoading(true);
      setCompanySearchError("");
      try {
        const data = await searchAgentCompanies({
          search: companySearch.trim(),
        });
        const list = normalizeList(data);
        setCompanySearchResults(list);
      } catch (e) {
        console.error(e);
        setCompanySearchError(
          e?.detail || "Не удалось загрузить список компаний",
        );
        setCompanySearchResults([]);
      } finally {
        setCompanySearchLoading(false);
      }
    }, 300);
    return () => {
      if (companySearchTimerRef.current) {
        clearTimeout(companySearchTimerRef.current);
      }
    };
  }, [activeTab, companySearch]);

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCartId, setModalCartId] = useState(null);
  const [modalDispatchMode, setModalDispatchMode] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnModalPreset, setReturnModalPreset] = useState(null);
  const [activeAgentsList, setActiveAgentsList] = useState([]);

  useEffect(() => {
    if (!isOwnerOrAdmin) return;
    listCompanyAgentRequests({ status: "active" })
      .then((data) => setActiveAgentsList(normalizeList(data)))
      .catch((e) => {
        console.error(e);
        setActiveAgentsList([]);
      });
  }, [isOwnerOrAdmin]);

  const closeModal = () => {
    setModalOpen(false);
    setModalDispatchMode(false);
  };

  const openNew = () => {
    setModalCartId(null);
    setModalDispatchMode(false);
    setModalOpen(true);
  };

  const openNewDispatch = () => {
    setModalCartId(null);
    setModalDispatchMode(true);
    setModalOpen(true);
  };

  const openReturnModal = (preset = null) => {
    setReturnModalPreset(preset);
    setReturnModalOpen(true);
  };

  const closeReturnModal = () => {
    setReturnModalOpen(false);
    setReturnModalPreset(null);
  };

  const openExisting = (id) => {
    setModalCartId(id);
    setModalDispatchMode(isOwnerDispatchCartId(id));
    setModalOpen(true);
  };

  const filteredCarts = useMemo(() => {
    let list = normalizeList(carts);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) =>
        String(c.note || "")
          .toLowerCase()
          .includes(q),
      );
    }
    if (statusFilter) {
      list = list.filter((c) => c.status === statusFilter);
    }
    return list.sort((a, b) => {
      const da = new Date(a.updated_date || a.created_date || 0).getTime();
      const db = new Date(b.updated_date || b.created_date || 0).getTime();
      return db - da;
    });
  }, [carts, search, statusFilter]);

  // Для владельца: история разделена на одобренные и отклонённые
  const historyCarts = useMemo(() => {
    let list = normalizeList(carts).filter(
      (c) => c.status === "approved" || c.status === "rejected",
    );
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) =>
        String(c.note || "")
          .toLowerCase()
          .includes(q),
      );
    }
    return list.sort((a, b) => {
      const da = new Date(a.updated_date || a.created_date || 0).getTime();
      const db = new Date(b.updated_date || b.created_date || 0).getTime();
      return db - da;
    });
  }, [carts, search]);

  const approvedCarts = useMemo(
    () => historyCarts.filter((c) => c.status === "approved"),
    [historyCarts],
  );
  const rejectedCarts = useMemo(
    () => historyCarts.filter((c) => c.status === "rejected"),
    [historyCarts],
  );

  const historyCartsToShow =
    historySubTab === "approved" ? approvedCarts : rejectedCarts;
  const cartsToShow = filteredCarts;
  const requestsToShow = useMemo(
    () => normalizeList(carts).filter((c) => c.status === "submitted"),
    [carts],
  );

  const filteredReturnCarts = useMemo(() => {
    let list = normalizeList(returnCarts);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) =>
        String(c.note || "")
          .toLowerCase()
          .includes(q),
      );
    }
    return list.sort((a, b) => {
      const da = new Date(a.updated_date || a.created_date || 0).getTime();
      const db = new Date(b.updated_date || b.created_date || 0).getTime();
      return db - da;
    });
  }, [returnCarts, search]);

  const returnIncomingToShow = useMemo(
    () => filteredReturnCarts.filter((c) => c.status === "submitted"),
    [filteredReturnCarts],
  );

  const returnApprovedHistory = useMemo(
    () => filteredReturnCarts.filter((c) => c.status === "approved"),
    [filteredReturnCarts],
  );

  const returnRejectedHistory = useMemo(
    () => filteredReturnCarts.filter((c) => c.status === "rejected"),
    [filteredReturnCarts],
  );

  const returnHistoryToShow =
    returnHistorySubTab === "approved"
      ? returnApprovedHistory
      : returnRejectedHistory;

  const returnListToShow =
    isOwnerOrAdmin && returnsSubTab === "incoming"
      ? returnIncomingToShow
      : isOwnerOrAdmin && returnsSubTab === "history"
        ? returnHistoryToShow
        : filteredReturnCarts;

  const companyRequestsByCompanyId = useMemo(() => {
    const map = {};
    normalizeList(companyRequests).forEach((r) => {
      if (r.company) {
        map[r.company] = r;
      }
    });
    return map;
  }, [companyRequests]);

  const pendingCompanyRequests = useMemo(
    () => normalizeList(companyRequests).filter((r) => r.status === "pending"),
    [companyRequests],
  );
  const activeCompanyAgents = useMemo(
    () => normalizeList(companyRequests).filter((r) => r.status === "active"),
    [companyRequests],
  );
  const removedOrRejectedCompanyRequests = useMemo(
    () =>
      normalizeList(companyRequests).filter(
        (r) => r.status === "removed" || r.status === "rejected",
      ),
    [companyRequests],
  );

  const handleApproveConfirmed = async (cartId) => {
    if (!cartId || actionBusyId) return;
    setActionBusyId(cartId);
    try {
      await approveAgentCart(cartId);
      loadCarts();
    } catch (e) {
      console.error(e);
      setAlertModal(getApproveErrorAlert(e));
    } finally {
      setActionBusyId(null);
    }
  };

  const handleApprove = (cartId) => {
    if (!cartId || actionBusyId) return;
    openConfirmAlert(setAlertModal, {
      title: "Одобрить заявку?",
      message: "Товар будет списан со склада.",
      onConfirm: () => handleApproveConfirmed(cartId),
    });
  };

  const handleRejectConfirmed = async (cartId) => {
    if (!cartId || actionBusyId) return;
    setActionBusyId(cartId);
    try {
      await rejectAgentCart(cartId);
      loadCarts();
    } catch (e) {
      console.error(e);
      openErrorAlert(setAlertModal, e, "Не удалось отклонить заявку");
    } finally {
      setActionBusyId(null);
    }
  };

  const handleReject = (cartId) => {
    if (!cartId || actionBusyId) return;
    openConfirmAlert(setAlertModal, {
      title: "Отклонить заявку?",
      message: "Заявка будет отклонена.",
      onConfirm: () => handleRejectConfirmed(cartId),
    });
  };

  const openNewReturnRequest = () => {
    setReturnRequestCartId(null);
    setReturnRequestModalOpen(true);
  };

  const openReturnRequest = (id) => {
    setReturnRequestCartId(id);
    setReturnRequestModalOpen(true);
  };

  const closeReturnRequestModal = () => {
    setReturnRequestModalOpen(false);
    setReturnRequestCartId(null);
  };

  const handleReturnApproveConfirmed = async (cartId) => {
    if (!cartId || returnActionBusyId) return;
    setReturnActionBusyId(cartId);
    try {
      await approveAgentReturnCart(cartId);
      loadReturnCarts();
      if (activeTab === "stocks") loadStocks();
    } catch (e) {
      console.error(e);
      setAlertModal(getApproveReturnErrorAlert(e));
    } finally {
      setReturnActionBusyId(null);
    }
  };

  const handleReturnApprove = (cartId) => {
    if (!cartId || returnActionBusyId) return;
    openConfirmAlert(setAlertModal, {
      title: "Одобрить возврат?",
      message: "Товар будет списан с остатка агента и зачислен на склад.",
      onConfirm: () => handleReturnApproveConfirmed(cartId),
    });
  };

  const handleReturnRejectConfirmed = async (cartId) => {
    if (!cartId || returnActionBusyId) return;
    setReturnActionBusyId(cartId);
    try {
      await rejectAgentReturnCart(cartId);
      loadReturnCarts();
    } catch (e) {
      console.error(e);
      openErrorAlert(setAlertModal, e, "Не удалось отклонить возврат");
    } finally {
      setReturnActionBusyId(null);
    }
  };

  const handleReturnReject = (cartId) => {
    if (!cartId || returnActionBusyId) return;
    openConfirmAlert(setAlertModal, {
      title: "Отклонить возврат?",
      message: "Заявка на возврат будет отклонена.",
      onConfirm: () => handleReturnRejectConfirmed(cartId),
    });
  };

  const handleSendCompanyRequest = async (company) => {
    if (!company?.id || companyActionBusyId) return;
    setCompanyActionBusyId(company.id);
    try {
      await createCompanyAgentRequest({ company: company.id });
      await loadCompanyRequests();
    } catch (e) {
      console.error(e);
      openErrorAlert(
        setAlertModal,
        e,
        "Не удалось отправить заявку в выбранную компанию",
      );
    } finally {
      setCompanyActionBusyId(null);
    }
  };

  const handleCompanyAccept = async (requestId) => {
    if (!requestId || companyActionBusyId) return;
    setCompanyActionBusyId(requestId);
    try {
      await acceptCompanyAgentRequest(requestId);
      await loadCompanyRequests();
    } catch (e) {
      console.error(e);
      openErrorAlert(
        setAlertModal,
        e,
        "Не удалось принять заявку агента в компанию",
      );
    } finally {
      setCompanyActionBusyId(null);
    }
  };

  const handleCompanyReject = async (requestId) => {
    if (!requestId || companyActionBusyId) return;
    setCompanyActionBusyId(requestId);
    try {
      await rejectCompanyAgentRequest(requestId);
      await loadCompanyRequests();
    } catch (e) {
      console.error(e);
      openErrorAlert(
        setAlertModal,
        e,
        "Не удалось отклонить заявку агента в компанию",
      );
    } finally {
      setCompanyActionBusyId(null);
    }
  };

  const handleCompanyRemoveConfirmed = async (requestId) => {
    if (!requestId || companyActionBusyId) return;
    setCompanyActionBusyId(requestId);
    try {
      await removeCompanyAgent(requestId);
      await loadCompanyRequests();
    } catch (e) {
      console.error(e);
      openErrorAlert(
        setAlertModal,
        e,
        "Не удалось отстранить агента от компании",
      );
    } finally {
      setCompanyActionBusyId(null);
    }
  };

  const handleCompanyRemove = (requestId) => {
    if (!requestId || companyActionBusyId) return;
    openConfirmAlert(setAlertModal, {
      title: "Отстранить агента?",
      message: "Доступ агента к складам компании будет снят.",
      onConfirm: () => handleCompanyRemoveConfirmed(requestId),
    });
  };

  const handleCompanyCommonAccessChange = async (request, warehouseId) => {
    if (!request?.id || companyActionBusyId) return;
    setCompanyActionBusyId(request.id);
    try {
      const assignedWarehouse = request.assigned_warehouse || null;
      const effectiveWarehouse = assignedWarehouse || warehouseId || null;
      if (!effectiveWarehouse) {
        await patchCompanyAgentCommonAccess(request.id, {
          common_access_enabled: false,
          assigned_warehouse: assignedWarehouse,
        });
      } else {
        await patchCompanyAgentCommonAccess(request.id, {
          common_access_enabled: true,
          common_warehouse: effectiveWarehouse,
          assigned_warehouse: assignedWarehouse,
        });
      }
      await loadCompanyRequests();
    } catch (e) {
      console.error(e);
      openErrorAlert(
        setAlertModal,
        e,
        "Не удалось обновить общий доступ к складу для агента",
      );
    } finally {
      setCompanyActionBusyId(null);
    }
  };

  const handleCompanyWholesaleChange = async (request, nextValue) => {
    if (!request?.id || companyActionBusyId) return;
    setCompanyActionBusyId(request.id);
    try {
      await patchCompanyAgentCommonAccess(request.id, {
        can_sell_wholesale: Boolean(nextValue),
      });
      await loadCompanyRequests();
    } catch (e) {
      console.error(e);
      openErrorAlert(
        setAlertModal,
        e,
        "Не удалось обновить право на оптовые продажи",
      );
    } finally {
      setCompanyActionBusyId(null);
    }
  };

  const handleCreateMembership = async () => {
    if (!newMembershipUserId.trim() || newMembershipBusy) return;
    const assignedWarehouse = newMembershipAssignedWarehouse || null;
    const commonWarehouse = assignedWarehouse || newMembershipWarehouse || null;
    if (newMembershipCommonEnabled && !commonWarehouse) {
      setNewMembershipError("Выберите склад для общего прайса.");
      return;
    }
    setNewMembershipBusy(true);
    setNewMembershipError("");
    try {
      const payload = {
        user: newMembershipUserId.trim(),
        assigned_warehouse: assignedWarehouse,
        can_sell_wholesale: Boolean(newMembershipCanSellWholesale),
      };
      if (newMembershipCommonEnabled) {
        payload.common_access_enabled = true;
        payload.common_warehouse = commonWarehouse;
      }
      if (newMembershipCanSellWholesale) {
        payload.can_sell_wholesale = true;
      }
      await createCompanyMembership(payload);
      setNewMembershipUserId("");
      setNewMembershipCommonEnabled(false);
      setNewMembershipCanSellWholesale(false);
      setNewMembershipAssignedWarehouse("");
      setNewMembershipWarehouse("");
      await loadCompanyRequests();
    } catch (e) {
      console.error(e);
      setNewMembershipError(
        e?.detail ||
          e?.message ||
          "Не удалось назначить пользователя агентом склада",
      );
    } finally {
      setNewMembershipBusy(false);
    }
  };

  useEffect(() => {
    if (newMembershipAssignedWarehouse && newMembershipCommonEnabled) {
      setNewMembershipWarehouse(newMembershipAssignedWarehouse);
    }
  }, [newMembershipAssignedWarehouse, newMembershipCommonEnabled]);

  return (
    <div className="warehouse-page agents-page">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon">
            <div className="warehouse-header__icon-box">🧑‍💼</div>
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">
              {isOwnerOrAdmin ? "Заявки агентов" : "Агенты"}
            </h1>
            <p className="warehouse-header__subtitle">
              {isOwnerOrAdmin
                ? "Заявки, выдача и возврат товара, остатки у агентов"
                : "Заявки на товар, возвраты и остатки"}
            </p>
          </div>
        </div>
        <div className="warehouse-header__actions">
          {isOwnerOrAdmin && activeTab === "carts" && (
            <button
              className="warehouse-header__create-btn"
              onClick={openNewDispatch}
              title="Выдать товар агенту со склада"
            >
              <Send size={16} />
              Выдать товар
            </button>
          )}
          {isOwnerOrAdmin &&
            (activeTab === "carts" || activeTab === "stocks") && (
              <button
                className="warehouse-header__create-btn"
                onClick={() => openReturnModal()}
                title="Принять возврат товара от агента на склад"
              >
                <Undo2 size={16} />
                Принять возврат
              </button>
            )}
          {isAgent && activeTab === "carts" && (
            <button
              className="warehouse-header__create-btn"
              onClick={openNew}
              title="Создать заявку"
            >
              <Plus size={16} />
              Создать заявку
            </button>
          )}
          {isAgent && activeTab === "returns" && (
            <button
              className="warehouse-header__create-btn"
              onClick={openNewReturnRequest}
              title="Создать заявку на возврат"
            >
              <Undo2 size={16} />
              Заявка на возврат
            </button>
          )}
          {isOwnerOrAdmin &&
            (activeTab === "carts" ||
              activeTab === "history" ||
              activeTab === "requests") && (
              <button
                className="warehouse-header__create-btn"
                onClick={loadCarts}
                disabled={cartsLoading}
                title="Обновить заявки"
              >
                <RefreshCw size={16} />
                Обновить
              </button>
            )}
          {/* <button
            className="warehouse-header__create-btn"
            onClick={() => (activeTab === "carts" ? loadCarts() : loadStocks())}
            disabled={activeTab === "carts" ? cartsLoading : stocksLoading}
            title="Обновить"
          >
            <RefreshCw size={16} />
            Обновить
          </button> */}
        </div>
      </div>

      <div className="agents-tabs">
        <button
          type="button"
          className={`agents-tab ${activeTab === "carts" ? "active" : ""}`}
          onClick={() => setActiveTab("carts")}
        >
          {isOwnerOrAdmin ? "Все заявки" : "Заявки"}
        </button>
        {isOwnerOrAdmin && (
          <button
            type="button"
            className={`agents-tab ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            История
          </button>
        )}
        {isOwnerOrAdmin && (
          <button
            type="button"
            className={`agents-tab ${activeTab === "requests" ? "active" : ""}`}
            onClick={() => setActiveTab("requests")}
          >
            Запросы
          </button>
        )}
        <button
          type="button"
          className={`agents-tab ${activeTab === "companies" ? "active" : ""}`}
          onClick={() => setActiveTab("companies")}
        >
          {isOwnerOrAdmin ? "Агенты склада" : "Мои компании"}
        </button>
        <button
          type="button"
          className={`agents-tab ${activeTab === "returns" ? "active" : ""}`}
          onClick={() => setActiveTab("returns")}
        >
          Возвраты
          {isOwnerOrAdmin && returnIncomingToShow.length > 0 && (
            <span className="agents-tab__badge">
              {returnIncomingToShow.length}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`agents-tab ${activeTab === "stocks" ? "active" : ""}`}
          onClick={() => setActiveTab("stocks")}
        >
          Остатки
        </button>
      </div>

      {(activeTab === "carts" ||
        activeTab === "history" ||
        activeTab === "requests") && (
        <>
          <div className="warehouse-search-section">
            <div className="warehouse-search">
              <Search className="warehouse-search__icon" size={18} />
              <input
                type="text"
                className="warehouse-search__input"
                placeholder="Поиск по примечанию…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="warehouse-search__info flex flex-wrap items-center gap-2">
              {activeTab !== "history" && activeTab !== "requests" && (
                <select
                  className="warehouse-search__input"
                  style={{ width: 220, maxWidth: "100%" }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">Все статусы</option>
                  <option value="draft">Черновик</option>
                  <option value="submitted">Отправлено</option>
                  <option value="approved">Одобрено</option>
                  <option value="rejected">Отклонено</option>
                </select>
              )}

              <span style={{ marginLeft: 12 }}>
                {activeTab === "history"
                  ? `${
                      historySubTab === "approved"
                        ? "Одобренные"
                        : "Отклонённые"
                    }: ${historyCartsToShow.length}`
                  : activeTab === "requests"
                    ? `Запросы: ${requestsToShow.length}`
                    : `Всего: ${cartsToShow.length}`}
              </span>

              <div className="ml-auto flex items-center gap-2 warehouse-view-buttons">
                <button
                  type="button"
                  onClick={() => setViewMode(VIEW_MODES.TABLE)}
                  className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
                    ${
                      viewMode === VIEW_MODES.TABLE
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                >
                  Таблица
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode(VIEW_MODES.CARDS)}
                  className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
                    ${
                      viewMode === VIEW_MODES.CARDS
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                >
                  Карточки
                </button>
              </div>
            </div>
          </div>

          {activeTab === "history" && (
            <div className="agents-history-tabs">
              <button
                type="button"
                className={`agents-history-tab ${
                  historySubTab === "approved" ? "active" : ""
                }`}
                onClick={() => setHistorySubTab("approved")}
              >
                Одобренные
                <span className="agents-history-tab__count">
                  {approvedCarts.length}
                </span>
              </button>
              <button
                type="button"
                className={`agents-history-tab ${
                  historySubTab === "rejected" ? "active" : ""
                }`}
                onClick={() => setHistorySubTab("rejected")}
              >
                Отклонённые
                <span className="agents-history-tab__count">
                  {rejectedCarts.length}
                </span>
              </button>
            </div>
          )}

          {cartsError && (
            <div className="agents-error">{String(cartsError)}</div>
          )}

          {activeTab === "history" ? (
            <div className="warehouse-table-container w-full">
              {viewMode === VIEW_MODES.TABLE ? (
                <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="warehouse-table w-full min-w-[900px]">
                    <thead>
                      <tr>
                        <th>№</th>
                        {isOwnerOrAdmin && <th>Агент</th>}
                        <th>Склад</th>
                        <th>Примечание</th>
                        <th>Обновлено</th>
                        <th>Отправлено</th>
                        <th>Одобрено</th>
                        {isOwnerOrAdmin && <th>Действия</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {cartsLoading ? (
                        <tr>
                          <td
                            colSpan={isOwnerOrAdmin ? 8 : 6}
                            className="warehouse-table__loading"
                          >
                            Загрузка…
                          </td>
                        </tr>
                      ) : historyCartsToShow.length === 0 ? (
                        <tr>
                          <td
                            colSpan={isOwnerOrAdmin ? 8 : 6}
                            className="warehouse-table__empty"
                          >
                            {historySubTab === "approved"
                              ? "Нет одобренных заявок"
                              : "Нет отклонённых заявок"}
                          </td>
                        </tr>
                      ) : (
                        historyCartsToShow.map((c, idx) => (
                          <tr
                            key={c.id}
                            className="warehouse-table__row agents-clickable-row"
                            onClick={() => openExisting(c.id)}
                          >
                            <td>{idx + 1}</td>
                            {isOwnerOrAdmin && (
                              <td>
                                {c.agent_name ||
                                  c.agent_display ||
                                  shortId(c.agent)}
                              </td>
                            )}
                            <td>
                              {warehousesById?.[c.warehouse]?.name ||
                                shortId(c.warehouse)}
                            </td>
                            <td className="agents-note">
                              {c.note ? String(c.note) : "—"}
                            </td>
                            <td>{fmtDateTime(c.updated_date)}</td>
                            <td>{fmtDateTime(c.submitted_at)}</td>
                            <td>{fmtDateTime(c.approved_at)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="agents-cards-grid">
                  {cartsLoading ? (
                    <div className="agents-cards-empty">Загрузка…</div>
                  ) : historyCartsToShow.length === 0 ? (
                    <div className="agents-cards-empty">
                      {historySubTab === "approved"
                        ? "Нет одобренных заявок"
                        : "Нет отклонённых заявок"}
                    </div>
                  ) : (
                    historyCartsToShow.map((c, idx) => (
                      <button
                        type="button"
                        key={c.id}
                        className="agents-card"
                        onClick={() => openExisting(c.id)}
                      >
                        <div className="agents-card__header">
                          <div className="agents-card__title">
                            Заявка #{idx + 1}
                          </div>
                          <div className="agents-card__meta">
                            {fmtDateTime(c.updated_date)}
                          </div>
                        </div>
                        {isOwnerOrAdmin && (
                          <div className="agents-card__row">
                            <span className="agents-card__label">Агент</span>
                            <span className="agents-card__value">
                              {c.agent_name ||
                                c.agent_display ||
                                shortId(c.agent)}
                            </span>
                          </div>
                        )}
                        <div className="agents-card__row">
                          <span className="agents-card__label">Склад</span>
                          <span className="agents-card__value">
                            {warehousesById?.[c.warehouse]?.name ||
                              shortId(c.warehouse)}
                          </span>
                        </div>
                        <div className="agents-card__row">
                          <span className="agents-card__label">Примечание</span>
                          <span className="agents-card__value agents-card__note">
                            {c.note ? String(c.note) : "—"}
                          </span>
                        </div>
                        <div className="agents-card__footer">
                          <span className="agents-card__label">Отправлено</span>
                          <span className="agents-card__value">
                            {fmtDateTime(c.submitted_at)}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : activeTab === "requests" ? (
            <div className="warehouse-table-container w-full">
              {viewMode === VIEW_MODES.TABLE ? (
                <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="warehouse-table w-full min-w-[900px]">
                    <thead>
                      <tr>
                        <th>№</th>
                        {isOwnerOrAdmin && <th>Агент</th>}
                        <th>Склад</th>
                        <th>Позиций</th>
                        <th>Обновлено</th>
                        <th>Отправлено</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cartsLoading ? (
                        <tr>
                          <td
                            colSpan={isOwnerOrAdmin ? 7 : 6}
                            className="warehouse-table__loading"
                          >
                            Загрузка…
                          </td>
                        </tr>
                      ) : requestsToShow.length === 0 ? (
                        <tr>
                          <td
                            colSpan={isOwnerOrAdmin ? 7 : 6}
                            className="warehouse-table__empty"
                          >
                            Нет заявок со статусом "Отправлено"
                          </td>
                        </tr>
                      ) : (
                        requestsToShow.map((c, idx) => (
                          <tr
                            key={c.id}
                            className="warehouse-table__row agents-clickable-row"
                            onClick={() => openExisting(c.id)}
                            title="Открыть заявку"
                          >
                            <td>{idx + 1}</td>
                            {isOwnerOrAdmin && (
                              <td>
                                {c.agent_name ||
                                  c.agent_display ||
                                  shortId(c.agent)}
                              </td>
                            )}
                            <td>
                              {warehousesById?.[c.warehouse]?.name ||
                                shortId(c.warehouse)}
                            </td>
                            <td>
                              {c.items_count ??
                                c.items?.length ??
                                c.items_qty ??
                                0}
                            </td>
                            <td>{fmtDateTime(c.updated_date)}</td>
                            <td>{fmtDateTime(c.submitted_at)}</td>
                            <td>
                              <div className="agents-row-actions">
                                <button
                                  type="button"
                                  className="agents-action-btn agents-action-btn--approve"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprove(c.id);
                                  }}
                                  disabled={actionBusyId === c.id}
                                >
                                  <Check size={16} />
                                  Одобрить
                                </button>
                                <button
                                  type="button"
                                  className="agents-action-btn agents-action-btn--reject"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReject(c.id);
                                  }}
                                  disabled={actionBusyId === c.id}
                                >
                                  <X size={16} />
                                  Отклонить
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="agents-cards-grid">
                  {cartsLoading ? (
                    <div className="agents-cards-empty">Загрузка…</div>
                  ) : requestsToShow.length === 0 ? (
                    <div className="agents-cards-empty">
                      Нет заявок со статусом "Отправлено"
                    </div>
                  ) : (
                    requestsToShow.map((c, idx) => (
                      <div
                        key={c.id}
                        className="agents-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => openExisting(c.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openExisting(c.id);
                          }
                        }}
                      >
                        <div className="agents-card__header">
                          <div className="agents-card__title">
                            Заявка #{idx + 1}
                          </div>
                          <div className="agents-card__meta">
                            {fmtDateTime(c.updated_date)}
                          </div>
                        </div>
                        {isOwnerOrAdmin && (
                          <div className="agents-card__row">
                            <span className="agents-card__label">Агент</span>
                            <span className="agents-card__value">
                              {c.agent_name ||
                                c.agent_display ||
                                shortId(c.agent)}
                            </span>
                          </div>
                        )}
                        <div className="agents-card__row">
                          <span className="agents-card__label">Склад</span>
                          <span className="agents-card__value">
                            {warehousesById?.[c.warehouse]?.name ||
                              shortId(c.warehouse)}
                          </span>
                        </div>
                        <div className="agents-card__row">
                          <span className="agents-card__label">Отправлено</span>
                          <span className="agents-card__value">
                            {fmtDateTime(c.submitted_at)}
                          </span>
                        </div>
                        <div className="agents-card__footer agents-card__footer--actions">
                          <button
                            type="button"
                            className="agents-action-btn agents-action-btn--approve"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(c.id);
                            }}
                            disabled={actionBusyId === c.id}
                          >
                            <Check size={16} />
                            Одобрить
                          </button>
                          <button
                            type="button"
                            className="agents-action-btn agents-action-btn--reject"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReject(c.id);
                            }}
                            disabled={actionBusyId === c.id}
                          >
                            <X size={16} />
                            Отклонить
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="warehouse-table-container w-full">
              {viewMode === VIEW_MODES.TABLE ? (
                <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="warehouse-table w-full min-w-[900px]">
                    <thead>
                      <tr>
                        <th>№</th>
                        {isOwnerOrAdmin && <th>Агент</th>}
                        <th>Склад</th>
                        <th>Статус</th>
                        <th>Примечание</th>
                        <th>Обновлено</th>
                        <th>Отправлено</th>
                        <th>Одобрено</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cartsLoading ? (
                        <tr>
                          <td
                            colSpan={isOwnerOrAdmin ? 8 : 7}
                            className="warehouse-table__loading"
                          >
                            Загрузка…
                          </td>
                        </tr>
                      ) : cartsToShow.length === 0 ? (
                        <tr>
                          <td
                            colSpan={isOwnerOrAdmin ? 8 : 7}
                            className="warehouse-table__empty"
                          >
                            Заявок нет
                          </td>
                        </tr>
                      ) : (
                        cartsToShow.map((c, idx) => {
                          const rowIndex = idx + 1;
                          return (
                            <tr
                              key={c.id}
                              className="warehouse-table__row agents-clickable-row"
                              onClick={() => openExisting(c.id)}
                            >
                              <td>{rowIndex}</td>
                              {isOwnerOrAdmin && (
                                <td>
                                  {c.agent_name ||
                                    c.agent_display ||
                                    shortId(c.agent)}
                                </td>
                              )}
                              <td>
                                {warehousesById?.[c.warehouse]?.name ||
                                  shortId(c.warehouse)}
                              </td>
                              <td>
                                <span
                                  className={`agents-badge ${statusClass(
                                    c.status,
                                  )}`}
                                >
                                  {statusLabel(c.status)}
                                </span>
                              </td>
                              <td className="agents-note">
                                {c.note ? String(c.note) : "—"}
                              </td>
                              <td>{fmtDateTime(c.updated_date)}</td>
                              <td>{fmtDateTime(c.submitted_at)}</td>
                              <td>{fmtDateTime(c.approved_at)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="agents-cards-grid">
                  {cartsLoading ? (
                    <div className="agents-cards-empty">Загрузка…</div>
                  ) : cartsToShow.length === 0 ? (
                    <div className="agents-cards-empty">Заявок нет</div>
                  ) : (
                    cartsToShow.map((c, idx) => (
                      <button
                        type="button"
                        key={c.id}
                        className="agents-card"
                        onClick={() => openExisting(c.id)}
                      >
                        <div className="agents-card__header">
                          <div className="agents-card__title">
                            Заявка #{idx + 1}
                          </div>
                          <span
                            className={`agents-badge ${statusClass(c.status)}`}
                          >
                            {statusLabel(c.status)}
                          </span>
                        </div>
                        {isOwnerOrAdmin && (
                          <div className="agents-card__row">
                            <span className="agents-card__label">Агент</span>
                            <span className="agents-card__value">
                              {c.agent_name ||
                                c.agent_display ||
                                shortId(c.agent)}
                            </span>
                          </div>
                        )}
                        <div className="agents-card__row">
                          <span className="agents-card__label">Склад</span>
                          <span className="agents-card__value">
                            {warehousesById?.[c.warehouse]?.name ||
                              shortId(c.warehouse)}
                          </span>
                        </div>
                        <div className="agents-card__row">
                          <span className="agents-card__label">Примечание</span>
                          <span className="agents-card__value agents-card__note">
                            {c.note ? String(c.note) : "—"}
                          </span>
                        </div>
                        <div className="agents-card__footer">
                          <span className="agents-card__label">Обновлено</span>
                          <span className="agents-card__value">
                            {fmtDateTime(c.updated_date)}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === "returns" && (
        <>
          <div className="warehouse-search-section">
            <div className="warehouse-search">
              <Search className="warehouse-search__icon" size={18} />
              <input
                type="text"
                className="warehouse-search__input"
                placeholder="Поиск по примечанию…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="warehouse-search__info flex flex-wrap items-center gap-2">
              {(!isOwnerOrAdmin || returnsSubTab === "list") && (
                <select
                  className="warehouse-search__input"
                  style={{ width: 220, maxWidth: "100%" }}
                  value={returnStatusFilter}
                  onChange={(e) => setReturnStatusFilter(e.target.value)}
                >
                  <option value="">Все статусы</option>
                  <option value="draft">Черновик</option>
                  <option value="submitted">Отправлено</option>
                  <option value="approved">Одобрено</option>
                  <option value="rejected">Отклонено</option>
                </select>
              )}
              <span>
                {isOwnerOrAdmin && returnsSubTab === "incoming"
                  ? `Входящие: ${returnListToShow.length}`
                  : isOwnerOrAdmin && returnsSubTab === "history"
                    ? `${
                        returnHistorySubTab === "approved"
                          ? "Одобренные"
                          : "Отклонённые"
                      }: ${returnListToShow.length}`
                    : `Всего: ${returnListToShow.length}`}
              </span>
            </div>
          </div>

          {isOwnerOrAdmin && (
            <div className="agents-history-tabs">
              <button
                type="button"
                className={`agents-history-tab ${returnsSubTab === "list" ? "active" : ""}`}
                onClick={() => setReturnsSubTab("list")}
              >
                Все
              </button>
              <button
                type="button"
                className={`agents-history-tab ${returnsSubTab === "incoming" ? "active" : ""}`}
                onClick={() => setReturnsSubTab("incoming")}
              >
                Входящие
                <span className="agents-history-tab__count">
                  {returnIncomingToShow.length}
                </span>
              </button>
              <button
                type="button"
                className={`agents-history-tab ${returnsSubTab === "history" ? "active" : ""}`}
                onClick={() => setReturnsSubTab("history")}
              >
                История
              </button>
            </div>
          )}

          {isOwnerOrAdmin && returnsSubTab === "history" && (
            <div className="agents-history-tabs">
              <button
                type="button"
                className={`agents-history-tab ${returnHistorySubTab === "approved" ? "active" : ""}`}
                onClick={() => setReturnHistorySubTab("approved")}
              >
                Одобренные
                <span className="agents-history-tab__count">
                  {returnApprovedHistory.length}
                </span>
              </button>
              <button
                type="button"
                className={`agents-history-tab ${returnHistorySubTab === "rejected" ? "active" : ""}`}
                onClick={() => setReturnHistorySubTab("rejected")}
              >
                Отклонённые
                <span className="agents-history-tab__count">
                  {returnRejectedHistory.length}
                </span>
              </button>
            </div>
          )}

          {returnCartsError && (
            <div className="agents-error">{String(returnCartsError)}</div>
          )}

          <div className="warehouse-table-container w-full">
            <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="warehouse-table w-full min-w-[900px]">
                <thead>
                  <tr>
                    <th>№</th>
                    {isOwnerOrAdmin && <th>Агент</th>}
                    <th>Склад</th>
                    <th>Статус</th>
                    <th>Примечание</th>
                    <th>Обновлено</th>
                    {isOwnerOrAdmin && returnsSubTab === "incoming" && (
                      <th>Действия</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {returnCartsLoading ? (
                    <tr>
                      <td
                        colSpan={
                          isOwnerOrAdmin
                            ? returnsSubTab === "incoming"
                              ? 7
                              : 6
                            : 5
                        }
                        className="warehouse-table__loading"
                      >
                        Загрузка…
                      </td>
                    </tr>
                  ) : returnListToShow.length === 0 ? (
                    <tr>
                      <td
                        colSpan={
                          isOwnerOrAdmin
                            ? returnsSubTab === "incoming"
                              ? 7
                              : 6
                            : 5
                        }
                        className="warehouse-table__empty"
                      >
                        {isOwnerOrAdmin && returnsSubTab === "incoming"
                          ? "Нет входящих заявок на возврат"
                          : "Заявок на возврат нет"}
                      </td>
                    </tr>
                  ) : (
                    returnListToShow.map((c, idx) => (
                      <tr
                        key={c.id}
                        className="warehouse-table__row agents-clickable-row"
                        onClick={() => openReturnRequest(c.id)}
                      >
                        <td>{idx + 1}</td>
                        {isOwnerOrAdmin && (
                          <td>
                            {c.agent_name ||
                              c.agent_display ||
                              shortId(c.agent)}
                          </td>
                        )}
                        <td>
                          {warehousesById?.[c.warehouse]?.name ||
                            shortId(c.warehouse)}
                        </td>
                        <td>
                          <span
                            className={`agents-badge ${statusClass(c.status)}`}
                          >
                            {statusLabel(c.status)}
                          </span>
                        </td>
                        <td className="agents-note">
                          {c.note ? String(c.note) : "—"}
                        </td>
                        <td>{fmtDateTime(c.updated_date)}</td>
                        {isOwnerOrAdmin && returnsSubTab === "incoming" && (
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="agents-card__footer--actions">
                              <button
                                type="button"
                                className="agents-action-btn agents-action-btn--approve"
                                disabled={returnActionBusyId === c.id}
                                onClick={() => handleReturnApprove(c.id)}
                              >
                                <Check size={16} />
                                Одобрить
                              </button>
                              <button
                                type="button"
                                className="agents-action-btn agents-action-btn--reject"
                                disabled={returnActionBusyId === c.id}
                                onClick={() => handleReturnReject(c.id)}
                              >
                                <X size={16} />
                                Отклонить
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "companies" && (
        <div className="agents-company-tab">
          {isOwnerOrAdmin ? (
            <>
              <div className="agents-history-tabs">
                <button
                  type="button"
                  className={`agents-history-tab ${ownerCompanySubTab === "incoming" ? "active" : ""}`}
                  onClick={() => setOwnerCompanySubTab("incoming")}
                >
                  Входящие заявки
                </button>
                <button
                  type="button"
                  className={`agents-history-tab ${ownerCompanySubTab === "active" ? "active" : ""}`}
                  onClick={() => setOwnerCompanySubTab("active")}
                >
                  Активные агенты
                </button>
              </div>

              {ownerCompanySubTab === "incoming" && (
                <section className="agent-cart-modal__section">
                  {/* <h3 className="agent-cart-modal__section-title">
                    Входящие заявки агентов в компанию
                  </h3>
                  <p className="agents-company-subtitle">
                    Новые запросы от пользователей, которые хотят работать
                    агентами по складам вашей компании.
                  </p> */}
                  {companyRequestsError && (
                    <div className="agents-error">
                      {String(companyRequestsError)}
                    </div>
                  )}
                  <div className="warehouse-table-container w-full">
                    <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <table className="warehouse-table w-full min-w-[900px]">
                        <thead>
                          <tr>
                            <th>№</th>
                            <th>Агент</th>
                            <th>Email</th>
                            <th>Статус</th>
                            <th>Сообщение</th>
                            <th>Создана</th>
                            <th>Решение</th>
                            <th>Действия</th>
                          </tr>
                        </thead>
                        <tbody>
                          {companyRequestsLoading ? (
                            <tr>
                              <td
                                colSpan={7}
                                className="warehouse-table__loading"
                              >
                                Загрузка…
                              </td>
                            </tr>
                          ) : pendingCompanyRequests.length === 0 ? (
                            <tr>
                              <td
                                colSpan={7}
                                className="warehouse-table__empty"
                              >
                                Нет входящих заявок
                              </td>
                            </tr>
                          ) : (
                            pendingCompanyRequests.map((r, idx) => (
                              <tr key={r.id}>
                                <td>{idx + 1}</td>
                                <td>{r.user_display || shortId(r.user)}</td>
                                <td>{r.user_email || "—"}</td>
                                <td>
                                  <span
                                    className={`agents-badge ${companyStatusClass(r.status)}`}
                                  >
                                    {companyStatusLabel(r.status)}
                                  </span>
                                </td>
                                <td className="agents-note">
                                  {r.note ? String(r.note) : "—"}
                                </td>
                                <td>{fmtDateTime(r.created_at)}</td>
                                <td>{fmtDateTime(r.decided_at)}</td>
                                <td>
                                  <div className="agents-row-actions">
                                    <button
                                      type="button"
                                      className="agents-action-btn agents-action-btn--approve"
                                      onClick={() => handleCompanyAccept(r.id)}
                                      disabled={companyActionBusyId === r.id}
                                    >
                                      <Check size={16} />
                                      Принять
                                    </button>
                                    <button
                                      type="button"
                                      className="agents-action-btn agents-action-btn--reject"
                                      onClick={() => handleCompanyReject(r.id)}
                                      disabled={companyActionBusyId === r.id}
                                    >
                                      <X size={16} />
                                      Отклонить
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              )}

              {ownerCompanySubTab === "active" && (
                <section className="agent-cart-modal__section">
                  {/* <h3 className="agent-cart-modal__section-title">
                    Активные агенты компании
                  </h3>
                  <p className="agents-company-subtitle">
                    Управляйте доступом агентов к складам компании и общему
                    прайсу.
                  </p> */}
                  {/* <div
                    className="warehouse-search-section"
                    style={{ marginBottom: 12 }}
                  >
                    <div
                      className="warehouse-search__info flex flex-wrap items-center gap-2"
                      style={{ width: "100%" }}
                    >
                      <div
                        className="flex flex-wrap items-center gap-2"
                        style={{ maxWidth: "100%" }}
                      >
                        <input
                          type="text"
                          className="warehouse-search__input"
                          style={{ minWidth: 220 }}
                          placeholder="UUID пользователя"
                          value={newMembershipUserId}
                          onChange={(e) =>
                            setNewMembershipUserId(e.target.value)
                          }
                          disabled={newMembershipBusy}
                        />
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={newMembershipCommonEnabled}
                            onChange={(e) =>
                              setNewMembershipCommonEnabled(e.target.checked)
                            }
                            disabled={newMembershipBusy}
                          />
                          Общий прайс
                        </label>
                        <select
                          className="warehouse-search__input"
                          style={{ minWidth: 220 }}
                          value={newMembershipWarehouse}
                          onChange={(e) =>
                            setNewMembershipWarehouse(e.target.value)
                          }
                          disabled={
                            newMembershipBusy || !newMembershipCommonEnabled
                          }
                        >
                          <option value="">Склад общего прайса</option>
                          {Object.values(warehousesById || {}).map((w) => (
                            <option value={w.id} key={w.id}>
                              {w.name || w.title || shortId(w.id)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="agents-action-btn agents-action-btn--approve"
                          onClick={handleCreateMembership}
                          disabled={
                            newMembershipBusy || !newMembershipUserId.trim()
                          }
                        >
                          <Check size={16} />
                          Назначить агентом
                        </button>
                      </div>
                    </div>
                    {newMembershipError && (
                      <div className="agents-error" style={{ marginTop: 8 }}>
                        {newMembershipError}
                      </div>
                    )}
                  </div> */}
                  <div
                    className="warehouse-search-section"
                    style={{ marginBottom: 12 }}
                  >
                    <div
                      className="warehouse-search__info flex flex-wrap items-center gap-2"
                      style={{ width: "100%" }}
                    >
                      <input
                        type="text"
                        className="warehouse-search__input"
                        style={{ minWidth: 220 }}
                        placeholder="UUID пользователя"
                        value={newMembershipUserId}
                        onChange={(e) => setNewMembershipUserId(e.target.value)}
                        disabled={newMembershipBusy}
                      />
                      <select
                        className="warehouse-search__input"
                        style={{ minWidth: 260 }}
                        value={newMembershipAssignedWarehouse}
                        onChange={(e) =>
                          setNewMembershipAssignedWarehouse(e.target.value)
                        }
                        disabled={newMembershipBusy}
                      >
                        <option value="">
                          Ограничить доступ одним складом (не выбрано)
                        </option>
                        {Object.values(warehousesById || {}).map((w) => (
                          <option value={w.id} key={w.id}>
                            {w.name || w.title || shortId(w.id)}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={newMembershipCommonEnabled}
                          onChange={(e) =>
                            setNewMembershipCommonEnabled(e.target.checked)
                          }
                          disabled={newMembershipBusy}
                        />
                        Общий прайс
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={newMembershipCanSellWholesale}
                          onChange={(e) =>
                            setNewMembershipCanSellWholesale(e.target.checked)
                          }
                          disabled={newMembershipBusy}
                        />
                        Разрешить опт
                      </label>
                      <select
                        className="warehouse-search__input"
                        style={{ minWidth: 220 }}
                        value={
                          newMembershipAssignedWarehouse
                            ? newMembershipAssignedWarehouse
                            : newMembershipWarehouse
                        }
                        onChange={(e) =>
                          setNewMembershipWarehouse(e.target.value)
                        }
                        disabled={
                          newMembershipBusy ||
                          !newMembershipCommonEnabled ||
                          Boolean(newMembershipAssignedWarehouse)
                        }
                      >
                        <option value="">Склад общего прайса</option>
                        {Object.values(warehousesById || {}).map((w) => (
                          <option value={w.id} key={w.id}>
                            {w.name || w.title || shortId(w.id)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="agents-action-btn agents-action-btn--approve"
                        onClick={handleCreateMembership}
                        disabled={
                          newMembershipBusy || !newMembershipUserId.trim()
                        }
                      >
                        <Check size={16} />
                        Назначить агентом
                      </button>
                    </div>
                    {newMembershipError && (
                      <div className="agents-error" style={{ marginTop: 8 }}>
                        {newMembershipError}
                      </div>
                    )}
                  </div>

                  <div className="warehouse-table-container w-full">
                    <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <table className="warehouse-table w-full min-w-[900px]">
                        <thead>
                          <tr>
                            <th>№</th>
                            <th>Агент</th>
                            <th>Email</th>
                            <th>Склад</th>
                            <th>Общий прайс</th>
                            <th>Оптовые продажи</th>
                            <th>Склад общего прайса</th>
                            <th>Создан</th>
                            <th>Обновлён</th>
                            <th>Действия</th>
                          </tr>
                        </thead>
                        <tbody>
                          {companyRequestsLoading ? (
                            <tr>
                              <td
                                colSpan={10}
                                className="warehouse-table__loading"
                              >
                                Загрузка…
                              </td>
                            </tr>
                          ) : activeCompanyAgents.length === 0 ? (
                            <tr>
                              <td
                                colSpan={10}
                                className="warehouse-table__empty"
                              >
                                Активных агентов нет
                              </td>
                            </tr>
                          ) : (
                            activeCompanyAgents.map((r, idx) => (
                              <tr key={r.id}>
                                <td>{idx + 1}</td>
                                <td>{r.user_display || shortId(r.user)}</td>
                                <td>{r.user_email || "—"}</td>
                                <td>
                                  {r.assigned_warehouse
                                    ? warehousesById?.[r.assigned_warehouse]
                                        ?.name || shortId(r.assigned_warehouse)
                                    : "Все склады"}
                                </td>
                                <td>
                                  <span
                                    className={`agents-badge ${
                                      r.common_access_enabled
                                        ? "badge--approved"
                                        : "badge--draft"
                                    }`}
                                  >
                                    {r.common_access_enabled
                                      ? "Включен"
                                      : "Выключен"}
                                  </span>
                                </td>
                                <td>
                                  <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(r.can_sell_wholesale)}
                                      onChange={(e) =>
                                        handleCompanyWholesaleChange(
                                          r,
                                          e.target.checked,
                                        )
                                      }
                                      disabled={companyActionBusyId === r.id}
                                    />
                                    {r.can_sell_wholesale
                                      ? "Разрешено"
                                      : "Запрещено"}
                                  </label>
                                </td>
                                <td>
                                  <select
                                    className="warehouse-search__input"
                                    style={{ minWidth: 220 }}
                                    value={
                                      r.assigned_warehouse ||
                                      r.common_warehouse ||
                                      ""
                                    }
                                    onChange={(e) =>
                                      handleCompanyCommonAccessChange(
                                        r,
                                        e.target.value || null,
                                      )
                                    }
                                    disabled={
                                      companyActionBusyId === r.id ||
                                      Boolean(r.assigned_warehouse)
                                    }
                                  >
                                    <option value="">Без общего доступа</option>
                                    {Object.values(warehousesById || {}).map(
                                      (w) => (
                                        <option value={w.id} key={w.id}>
                                          {w.name || w.title || shortId(w.id)}
                                        </option>
                                      ),
                                    )}
                                  </select>
                                </td>
                                <td>{fmtDateTime(r.created_at)}</td>
                                <td>{fmtDateTime(r.updated_at)}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="agents-action-btn agents-action-btn--reject"
                                    onClick={() => handleCompanyRemove(r.id)}
                                    disabled={companyActionBusyId === r.id}
                                  >
                                    <Trash2 size={16} />
                                    Отстранить
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {removedOrRejectedCompanyRequests.length > 0 && (
                    <details style={{ marginTop: 16 }}>
                      <summary>Отклонённые и отстранённые заявки</summary>
                      <div className="warehouse-table-container w-full mt-2">
                        <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <table className="warehouse-table w-full min-w-[900px]">
                            <thead>
                              <tr>
                                <th>№</th>
                                <th>Агент</th>
                                <th>Email</th>
                                <th>Статус</th>
                                <th>Сообщение</th>
                                <th>Решение</th>
                              </tr>
                            </thead>
                            <tbody>
                              {removedOrRejectedCompanyRequests.map(
                                (r, idx) => (
                                  <tr key={r.id}>
                                    <td>{idx + 1}</td>
                                    <td>{r.user_display || shortId(r.user)}</td>
                                    <td>{r.user_email || "—"}</td>
                                    <td>
                                      <span
                                        className={`agents-badge ${companyStatusClass(r.status)}`}
                                      >
                                        {companyStatusLabel(r.status)}
                                      </span>
                                    </td>
                                    <td className="agents-note">
                                      {r.note ? String(r.note) : "—"}
                                    </td>
                                    <td>{fmtDateTime(r.decided_at)}</td>
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </details>
                  )}
                </section>
              )}
            </>
          ) : (
            <>
              <div className="agents-history-tabs">
                <button
                  type="button"
                  className={`agents-history-tab ${agentCompanySubTab === "search" ? "active" : ""}`}
                  onClick={() => setAgentCompanySubTab("search")}
                >
                  Найти компанию
                </button>
                <button
                  type="button"
                  className={`agents-history-tab ${agentCompanySubTab === "myRequests" ? "active" : ""}`}
                  onClick={() => setAgentCompanySubTab("myRequests")}
                >
                  Мои заявки
                </button>
              </div>

              {agentCompanySubTab === "search" && (
                <section className="agent-cart-modal__section agents-company-card">
                  <h3 className="agent-cart-modal__section-title">
                    Найти компанию и отправить заявку
                  </h3>
                  <p className="agents-company-subtitle">
                    Найдите компанию по названию и отправьте заявку, чтобы
                    работать её агентом склада.
                  </p>
                  <div className="warehouse-search-section">
                    <div className="warehouse-search">
                      <Search className="warehouse-search__icon" size={18} />
                      <input
                        type="text"
                        className="warehouse-search__input"
                        placeholder="Поиск компании по названию…"
                        value={companySearch}
                        onChange={(e) => setCompanySearch(e.target.value)}
                      />
                    </div>
                  </div>
                  {companySearchError && (
                    <div className="agents-error">
                      {String(companySearchError)}
                    </div>
                  )}
                  <div className="agents-cards-grid" style={{ marginTop: 16 }}>
                    {companySearchLoading ? (
                      <div className="agents-cards-empty">Поиск компаний…</div>
                    ) : !companySearch.trim() ? (
                      <div className="agents-cards-empty">
                        Введите текст для поиска компании
                      </div>
                    ) : companySearchResults.length === 0 ? (
                      <div className="agents-cards-empty">
                        Компании не найдены
                      </div>
                    ) : (
                      companySearchResults.map((c) => {
                        const r = companyRequestsByCompanyId[c.id];
                        const status = r?.status || "";
                        const isPending = status === "pending";
                        const isActive = status === "active";
                        const isRejected = status === "rejected";
                        const isRemoved = status === "removed";
                        let statusText = "Вы ещё не отправляли заявку";
                        if (isPending)
                          statusText = "Заявка отправлена, ожидает решения";
                        else if (isActive)
                          statusText = "Вы уже являетесь агентом этой компании";
                        else if (isRejected)
                          statusText = "Заявка была отклонена";
                        else if (isRemoved)
                          statusText =
                            "Вы были отстранены, можно отправить новую заявку";
                        const canSend =
                          !status || status === "removed" || status === "";
                        return (
                          <div key={c.id} className="agents-card">
                            <div className="agents-card__header">
                              <div className="agents-card__title">
                                {c.name || c.company_name || "Компания"}
                              </div>
                              {status && (
                                <span
                                  className={`agents-badge ${companyStatusClass(
                                    status,
                                  )}`}
                                >
                                  {companyStatusLabel(status)}
                                </span>
                              )}
                            </div>
                            <div className="agents-card__row">
                              <span className="agents-card__label">Slug</span>
                              <span className="agents-card__value">
                                {c.slug || "—"}
                              </span>
                            </div>
                            <div className="agents-card__row">
                              <span className="agents-card__label">
                                Комментарий
                              </span>
                              <span className="agents-card__value agents-card__note">
                                {statusText}
                              </span>
                            </div>
                            <div className="agents-card__footer agents-card__footer--actions">
                              <button
                                type="button"
                                className="agents-action-btn agents-action-btn--approve"
                                disabled={
                                  !canSend || companyActionBusyId === c.id
                                }
                                onClick={() => handleSendCompanyRequest(c)}
                              >
                                <Send size={16} />
                                Отправить заявку
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              )}

              {agentCompanySubTab === "myRequests" && (
                <section className="agent-cart-modal__section agents-company-card">
                  <h3 className="agent-cart-modal__section-title">
                    Мои заявки в компании
                  </h3>
                  <p className="agents-company-subtitle">
                    История всех отправленных вами заявок на роль агента склада
                    в разных компаниях.
                  </p>
                  {companyRequestsError && (
                    <div className="agents-error">
                      {String(companyRequestsError)}
                    </div>
                  )}
                  <div className="warehouse-table-container w-full">
                    <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <table className="warehouse-table w-full min-w-[900px]">
                        <thead>
                          <tr>
                            <th>№</th>
                            <th>Компания</th>
                            <th>Статус</th>
                            <th>Сообщение</th>
                            <th>Создана</th>
                            <th>Обновлена</th>
                            <th>Решение</th>
                          </tr>
                        </thead>
                        <tbody>
                          {companyRequestsLoading ? (
                            <tr>
                              <td
                                colSpan={7}
                                className="warehouse-table__loading"
                              >
                                Загрузка…
                              </td>
                            </tr>
                          ) : normalizeList(companyRequests).length === 0 ? (
                            <tr>
                              <td
                                colSpan={7}
                                className="warehouse-table__empty"
                              >
                                Вы ещё не отправляли заявок в компании
                              </td>
                            </tr>
                          ) : (
                            normalizeList(companyRequests).map((r, idx) => (
                              <tr key={r.id}>
                                <td>{idx + 1}</td>
                                <td>{r.company_name || shortId(r.company)}</td>
                                <td>
                                  <span
                                    className={`agents-badge ${companyStatusClass(
                                      r.status,
                                    )}`}
                                  >
                                    {companyStatusLabel(r.status)}
                                  </span>
                                </td>
                                <td className="agents-note">
                                  {r.note ? String(r.note) : "—"}
                                </td>
                                <td>{fmtDateTime(r.created_at)}</td>
                                <td>{fmtDateTime(r.updated_at)}</td>
                                <td>{fmtDateTime(r.decided_at)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "stocks" && (
        <>
          {stocksError && (
            <div className="agents-error">{String(stocksError)}</div>
          )}

          <div className="warehouse-search-section">
            <div
              className="warehouse-search__info flex flex-wrap items-center gap-2"
              style={{ width: "100%" }}
            >
              <span>Всего: {normalizeList(stocks).length}</span>
              <div className="ml-auto flex items-center gap-2 warehouse-view-buttons">
                <button
                  type="button"
                  onClick={() => setViewMode(VIEW_MODES.TABLE)}
                  className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
                    ${
                      viewMode === VIEW_MODES.TABLE
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                >
                  Таблица
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode(VIEW_MODES.CARDS)}
                  className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition
                    ${
                      viewMode === VIEW_MODES.CARDS
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                >
                  Карточки
                </button>
              </div>
            </div>
          </div>

          <div className="warehouse-table-container w-full">
            {viewMode === VIEW_MODES.TABLE ? (
              <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="warehouse-table w-full min-w-[900px]">
                  <thead>
                    <tr>
                      <th>№</th>
                      {isOwnerOrAdmin && <th>Агент</th>}
                      <th>Склад</th>
                      <th>Товар</th>
                      <th>Артикул</th>
                      <th>Ед.</th>
                      <th>У агента</th>
                      {isOwnerOrAdmin && <th>Доступно</th>}
                      {isOwnerOrAdmin && <th>Действия</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {stocksLoading ? (
                      <tr>
                        <td
                          colSpan={isOwnerOrAdmin ? 9 : 6}
                          className="warehouse-table__loading"
                        >
                          Загрузка…
                        </td>
                      </tr>
                    ) : normalizeList(stocks).length === 0 ? (
                      <tr>
                        <td
                          colSpan={isOwnerOrAdmin ? 9 : 6}
                          className="warehouse-table__empty"
                        >
                          Остатков нет
                        </td>
                      </tr>
                    ) : (
                      normalizeList(stocks).map((r, idx) => {
                        const rowIndex = idx + 1;
                        const available =
                          r.qty_available != null ? r.qty_available : r.qty;
                        const canReturn =
                          isOwnerOrAdmin &&
                          r.agent &&
                          Number(available) > 0;
                        return (
                          <tr
                            key={r.id || idx}
                            className="warehouse-table__row"
                          >
                            <td>{rowIndex}</td>
                            {isOwnerOrAdmin && (
                              <td>
                                {r.agent_name ||
                                  r.agent_display ||
                                  shortId(r.agent)}
                              </td>
                            )}
                            <td>
                              {warehousesById?.[r.warehouse]?.name ||
                                shortId(r.warehouse)}
                            </td>
                            <td className="warehouse-table__name">
                              {r.product_name || shortId(r.product)}
                            </td>
                            <td>{r.product_article || "—"}</td>
                            <td>{r.product_unit || "—"}</td>
                            <td>{r.qty ?? "—"}</td>
                            {isOwnerOrAdmin && (
                              <td>{available ?? "—"}</td>
                            )}
                            {isOwnerOrAdmin && (
                              <td>
                                {canReturn ? (
                                  <button
                                    type="button"
                                    className="agents-action-btn"
                                    onClick={() =>
                                      openReturnModal({
                                        agent: r.agent,
                                        warehouse: r.warehouse,
                                        product: r.product,
                                        product_name: r.product_name,
                                        product_article: r.product_article,
                                        product_unit: r.product_unit,
                                        qty: r.qty,
                                        qty_available: r.qty_available,
                                      })
                                    }
                                  >
                                    <Undo2 size={16} />
                                    Вернуть
                                  </button>
                                ) : (
                                  "—"
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="agents-cards-grid">
                {stocksLoading ? (
                  <div className="agents-cards-empty">Загрузка…</div>
                ) : normalizeList(stocks).length === 0 ? (
                  <div className="agents-cards-empty">Остатков нет</div>
                ) : (
                  normalizeList(stocks).map((r, idx) => (
                    <div key={r.id || idx} className="agents-card">
                      <div className="agents-card__header">
                        <div className="agents-card__title">
                          Остаток #{idx + 1}
                        </div>
                      </div>
                      {isOwnerOrAdmin && (
                        <div className="agents-card__row">
                          <span className="agents-card__label">Агент</span>
                          <span className="agents-card__value">
                            {r.agent_name ||
                              r.agent_display ||
                              shortId(r.agent)}
                          </span>
                        </div>
                      )}
                      <div className="agents-card__row">
                        <span className="agents-card__label">Склад</span>
                        <span className="agents-card__value">
                          {warehousesById?.[r.warehouse]?.name ||
                            shortId(r.warehouse)}
                        </span>
                      </div>
                      <div className="agents-card__row">
                        <span className="agents-card__label">Товар</span>
                        <span className="agents-card__value">
                          {r.product_name || shortId(r.product)}
                        </span>
                      </div>
                      <div className="agents-card__row">
                        <span className="agents-card__label">Артикул</span>
                        <span className="agents-card__value">
                          {r.product_article || "—"}
                        </span>
                      </div>
                      <div className="agents-card__row">
                        <span className="agents-card__label">У агента</span>
                        <span className="agents-card__value">
                          {r.qty ?? "—"} {r.product_unit || ""}
                        </span>
                      </div>
                      {isOwnerOrAdmin && (
                        <div className="agents-card__row">
                          <span className="agents-card__label">
                            Доступно
                          </span>
                          <span className="agents-card__value">
                            {r.qty_available ?? r.qty ?? "—"}{" "}
                            {r.product_unit || ""}
                          </span>
                        </div>
                      )}
                      {isOwnerOrAdmin &&
                        r.agent &&
                        Number(r.qty_available ?? r.qty) > 0 && (
                          <div className="agents-card__footer">
                            <button
                              type="button"
                              className="agents-action-btn"
                              onClick={() =>
                                openReturnModal({
                                  agent: r.agent,
                                  warehouse: r.warehouse,
                                  product: r.product,
                                  product_name: r.product_name,
                                  product_article: r.product_article,
                                  product_unit: r.product_unit,
                                  qty: r.qty,
                                  qty_available: r.qty_available,
                                })
                              }
                            >
                              <Undo2 size={16} />
                              Вернуть
                            </button>
                          </div>
                        )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}

      <AgentReturnModal
        open={returnModalOpen}
        onClose={closeReturnModal}
        onSuccess={() => {
          loadStocks();
          loadReturnCarts();
        }}
        warehousesById={warehousesById}
        activeAgents={activeAgentsList}
        preset={returnModalPreset}
      />

      <AgentReturnRequestModal
        open={returnRequestModalOpen}
        onClose={closeReturnRequestModal}
        cartId={returnRequestCartId}
        setCartId={setReturnRequestCartId}
        onChanged={() => {
          loadReturnCarts();
          if (activeTab === "stocks") loadStocks();
        }}
        warehousesById={warehousesById}
        isOwnerOrAdmin={isOwnerOrAdmin}
        isAgent={isAgent}
      />

      <AgentCartModal
        open={modalOpen}
        onClose={closeModal}
        cartId={modalCartId}
        setCartId={setModalCartId}
        onChanged={() => {
          loadCarts();
          if (activeTab === "stocks") loadStocks();
          if (isOwnerOrAdmin) {
            listCompanyAgentRequests({ status: "active" })
              .then((data) => setActiveAgentsList(normalizeList(data)))
              .catch(console.error);
          }
        }}
        warehousesById={warehousesById}
        isOwnerOrAdmin={isOwnerOrAdmin}
        isAgent={isAgent}
        currentUserId={profile?.id}
        activeAgents={activeAgentsList}
        dispatchMode={modalDispatchMode}
      />

      <AlertModal
        open={alertModal.open}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        okText={alertModal.okText}
        onClose={closeAlertModal}
        onConfirm={alertModal.onConfirm ? handleAlertConfirm : undefined}
      />
    </div>
  );
};

export default Agents;
