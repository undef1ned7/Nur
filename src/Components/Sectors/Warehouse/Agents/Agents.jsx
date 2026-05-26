import {
  Check,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
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
  sessionStorage.setItem(
    OWNER_DISPATCH_CARTS_KEY,
    JSON.stringify([...ids]),
  );
};

const forgetOwnerDispatchCart = (cartId) => {
  if (!cartId || typeof sessionStorage === "undefined") return;
  const ids = readOwnerDispatchCartIds();
  ids.delete(String(cartId));
  sessionStorage.setItem(
    OWNER_DISPATCH_CARTS_KEY,
    JSON.stringify([...ids]),
  );
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

const CATALOG_PAGE_SIZE = 1000;

const CartItemAddPanel = ({
  disabled,
  busy,
  warehouseId,
  existingItems = [],
  onAdd,
}) => {
  const searchRef = useRef(null);
  const qtyRef = useRef(null);
  const catalogWarehouseRef = useRef(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState("1");
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

  const resetForm = useCallback(() => {
    setSelected(null);
    setQty("1");
    setQuery("");
    setCatalogOpen(false);
    setLocalError("");
  }, []);

  useEffect(() => {
    setAllProducts([]);
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
    [warehouseId, disabled],
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
    if (disabled || busy || selected) return;
    setCatalogOpen(true);
    setLocalError("");
    await loadCatalog();
  };

  const handleSearchBlur = () => {
    window.setTimeout(() => setCatalogOpen(false), 160);
  };

  const pickProduct = (product) => {
    const stockQty = getStockQty(product);
    if (stockQty !== null && stockQty <= 0) {
      setLocalError("Товара нет на складе — добавить нельзя");
      return;
    }
    setSelected(product);
    setQuery("");
    setCatalogOpen(false);
    setLocalError("");
    const inCart = existingQtyByProductId[product.id];
    const initial = inCart != null ? parseQty(inCart) : 1;
    const safeQty =
      stockQty != null && initial != null
        ? Math.min(initial, stockQty)
        : (initial ?? 1);
    setQty(clampQtyToStock(String(safeQty), stockQty));
    setTimeout(() => qtyRef.current?.focus(), 0);
  };

  const selectedStock = selected ? getStockQty(selected) : null;
  const isSelectedOutOfStock =
    selectedStock !== null && selectedStock <= 0;
  const qtyPresets = useMemo(
    () => buildQtyPresets(selectedStock),
    [selectedStock],
  );
  const currentQtyNum = parseQty(qty);
  const atStockMax =
    selectedStock != null &&
    currentQtyNum != null &&
    currentQtyNum >= selectedStock;

  const adjustQty = (delta) => {
    const current = parseQty(qty) ?? 0;
    let next = Math.max(0.001, current + delta);
    if (selectedStock != null && selectedStock > 0) {
      next = Math.min(next, selectedStock);
    }
    setQty(String(next));
  };

  const handleQtyChange = (value) => {
    setQty(value);
    if (localError) setLocalError("");
  };

  const handleQtyBlur = () => {
    if (selectedStock == null) return;
    setQty(clampQtyToStock(qty, selectedStock));
  };

  const handleAdd = async () => {
    if (!selected || busy || disabled) return;
    if (isSelectedOutOfStock) {
      setLocalError("Товара нет на складе — добавить нельзя");
      return;
    }
    const qtyNum = parseQty(qty);
    if (!qtyNum) {
      setLocalError("Укажите количество больше 0");
      qtyRef.current?.focus();
      return;
    }
    if (selectedStock != null && qtyNum > selectedStock) {
      setLocalError(
        `На складе только ${selectedStock}${selected?.unit ? ` ${selected.unit}` : ""} — нельзя добавить больше`,
      );
      setQty(clampQtyToStock(qty, selectedStock));
      qtyRef.current?.focus();
      return;
    }
    setLocalError("");
    try {
      await onAdd(selected, qtyNum);
      resetForm();
      searchRef.current?.focus();
    } catch {
      // ошибка обрабатывается в родителе
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Escape") {
      if (selected) {
        resetForm();
      } else {
        setQuery("");
        setCatalogOpen(false);
      }
      return;
    }
    if (e.key === "ArrowDown" && filteredOptions.length > 0) {
      e.preventDefault();
      pickProduct(filteredOptions[0]);
    }
  };

  const trimmedQuery = query.trim();
  const showDropdown =
    catalogOpen &&
    !selected &&
    (loading || filteredOptions.length > 0 || allProducts.length > 0);
  const catalogTruncated = allProducts.length >= CATALOG_PAGE_SIZE;
  const alreadyInCart =
    selected?.id && existingQtyByProductId[selected.id] != null;

  if (!warehouseId) {
    return (
      <div className="agent-cart-add-panel agent-cart-add-panel--blocked">
        <p className="agent-cart-add-panel__notice">
          Сначала выберите склад в блоке «Параметры заявки», затем добавляйте
          товары.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`agent-cart-add-panel ${disabled ? "agent-cart-add-panel--disabled" : ""}`}
    >
      {!selected ? (
        <>
          <label className="agent-cart-add-panel__label">Добавить товар</label>
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
              onKeyDown={handleSearchKeyDown}
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
              {allProducts.length} товар(ов) на складе
              {catalogTruncated
                ? ` — показаны первые ${CATALOG_PAGE_SIZE}, используйте поиск для уточнения`
                : " — выберите из списка или введите название для фильтра"}
            </p>
          )}
          {!loading && catalogOpen && trimmedQuery && filteredOptions.length === 0 && (
            <p className="agent-cart-add-panel__hint">Ничего не найдено</p>
          )}
          {!loading && !catalogOpen && !trimmedQuery && (
            <p className="agent-cart-add-panel__hint">
              Нажмите на поле — откроется полный список товаров склада
            </p>
          )}

          {showDropdown && (
            <div
              className="agents-options agent-cart-add-panel__dropdown agent-cart-add-panel__dropdown--catalog"
              onMouseDown={(e) => e.preventDefault()}
            >
              {(loading ? [] : filteredOptions).map((p) => {
                const stockQty =
                  p.quantity != null ? Number(p.quantity) : null;
                const isOutOfStock = stockQty !== null && stockQty <= 0;
                const inCartQty = existingQtyByProductId[p.id];
                return (
                  <button
                    type="button"
                    key={p.id}
                    className={`agents-option ${isOutOfStock ? "agents-option--out-of-stock" : ""}`}
                    disabled={isOutOfStock}
                    onClick={() => pickProduct(p)}
                  >
                    <div className="agents-option__name">{p.name || "—"}</div>
                    <div className="agents-option__meta">
                      {p.article ? `арт. ${p.article}` : ""}
                      {p.unit ? ` • ${p.unit}` : ""}
                      {stockQty !== null ? ` • На складе: ${stockQty}` : ""}
                      {inCartQty != null ? ` • В заявке: ${inCartQty}` : ""}
                    </div>
                    {isOutOfStock && (
                      <div className="agents-option__stock agents-option__stock--zero">
                        Нет в наличии
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="agent-cart-add-panel__selected">
          <div className="agent-cart-add-panel__selected-head">
            <div className="agent-cart-add-panel__selected-info">
              <span className="agent-cart-add-panel__selected-name">
                {selected.name || "—"}
              </span>
              <span className="agent-cart-add-panel__selected-meta">
                {selected.article ? `арт. ${selected.article}` : ""}
                {selected.unit ? ` • ${selected.unit}` : ""}
                {selected.quantity != null
                  ? ` • На складе: ${Number(selected.quantity)}`
                  : ""}
              </span>
              {alreadyInCart && (
                <span className="agent-cart-add-panel__selected-note">
                  Уже в заявке — новое количество заменит текущее
                </span>
              )}
              {selectedStock != null && selectedStock > 0 && (
                <span className="agent-cart-add-panel__selected-note agent-cart-add-panel__selected-note--stock">
                  Максимум к добавлению: {selectedStock}
                  {selected.unit ? ` ${selected.unit}` : ""}
                </span>
              )}
            </div>
            <button
              type="button"
              className="agent-cart-add-panel__selected-change"
              disabled={disabled || busy}
              onClick={() => {
                setSelected(null);
                setQty("1");
                setLocalError("");
                searchRef.current?.focus();
              }}
            >
              Сменить товар
            </button>
          </div>

          <div className="agent-cart-add-panel__qty-row">
            <span className="agent-cart-add-panel__qty-label">Количество</span>
            <div className="agent-cart-add-panel__qty-controls">
              <button
                type="button"
                className="agent-cart-add-panel__qty-btn"
                disabled={
                  disabled ||
                  busy ||
                  (currentQtyNum != null && currentQtyNum <= 0.001)
                }
                onClick={() => adjustQty(-1)}
                aria-label="Уменьшить"
              >
                <Minus size={16} />
              </button>
              <input
                ref={qtyRef}
                type="number"
                step="0.001"
                min="0.001"
                max={selectedStock != null ? selectedStock : undefined}
                className="agent-cart-add-panel__qty-input"
                value={qty}
                disabled={disabled || busy || isSelectedOutOfStock}
                onChange={(e) => handleQtyChange(e.target.value)}
                onBlur={handleQtyBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    resetForm();
                    searchRef.current?.focus();
                  }
                }}
              />
              <button
                type="button"
                className="agent-cart-add-panel__qty-btn"
                disabled={disabled || busy || atStockMax || isSelectedOutOfStock}
                onClick={() => adjustQty(1)}
                aria-label="Увеличить"
              >
                <Plus size={16} />
              </button>
            </div>
            {qtyPresets.length > 0 && (
              <div className="agent-cart-add-panel__qty-presets">
                {qtyPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="agent-cart-add-panel__qty-preset"
                    disabled={disabled || busy || isSelectedOutOfStock}
                    onClick={() =>
                      setQty(clampQtyToStock(String(preset), selectedStock))
                    }
                  >
                    {preset}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              className="agent-cart-modal__btn agent-cart-modal__btn--primary agent-cart-add-panel__submit"
              disabled={
                disabled ||
                busy ||
                isSelectedOutOfStock ||
                !parseQty(qty) ||
                (selectedStock != null &&
                  currentQtyNum != null &&
                  currentQtyNum > selectedStock)
              }
              onClick={handleAdd}
            >
              <Plus size={18} />
              {alreadyInCart ? "Обновить" : "Добавить"}
            </button>
          </div>
        </div>
      )}

      {localError && (
        <p className="agent-cart-add-panel__error">{localError}</p>
      )}
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

  const load = useCallback(async () => {
    if (!cartId) return;
    setLoading(true);
    setError("");
    try {
      const c = await getAgentCartById(cartId);
      setCart(c);
      setForm({
        warehouse: c?.warehouse || "",
        note: c?.note || "",
        agent: c?.agent || "",
      });

      const itData = await listAgentCartItems({ cart: cartId });
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
    }
  }, [open, cartId, load]);

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
        setError("Создание заявки доступно только сотрудникам с ролью «агент»");
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
      if (isOwnerDispatchFlow && created?.id) {
        rememberOwnerDispatchCart(created.id);
      }
      setCart(created);
      setCartId?.(created?.id);
      setForm((prev) => ({
        ...prev,
        agent: created?.agent || prev.agent,
        warehouse: created?.warehouse || prev.warehouse,
      }));
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
    if (items.length === 0) {
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

  const addItem = async (product, qtyNum) => {
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
      const pid =
        typeof it.product === "string" ? it.product : it.product?.id;
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

              {/* Параметры заявки — сотрудник с ролью agent */}
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
                        ]?.name || shortId(selectedAgentMembership.assigned_warehouse)}
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

              {/* Позиции заявки показываем только после создания заявки (есть cartId) */}
              {cartId && (
                <section className="agent-cart-modal__section agent-cart-modal__positions">
                  <h3 className="agent-cart-modal__section-title">
                    Позиции заявки
                  </h3>
                  {canEditItems && (
                    <>
                      <p className="agent-cart-modal__hint">
                        {isOwnerDispatchFlow
                          ? "Добавьте товары и нажмите «Выдать» — товар сразу спишется со склада."
                          : "Редактировать можно только в статусе «Черновик»."}
                      </p>

                      <CartItemAddPanel
                        disabled={!canEditItems}
                        busy={busy}
                        warehouseId={form.warehouse || cart?.warehouse}
                        existingItems={items}
                        onAdd={addItem}
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
                          <th>Дата создания</th>
                          <th>Обновлено</th>
                          {canEditItems && <th>Действия</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {items.length === 0 ? (
                          <tr>
                            <td
                              colSpan={canEditItems ? 8 : 7}
                              className="agent-cart-modal__empty"
                            >
                              Нет позиций
                            </td>
                          </tr>
                        ) : (
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
                          ))
                        )}
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
                        disabled={busy || items.length === 0}
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
                    disabled={busy}
                    onClick={createCart}
                  >
                    <Plus size={18} />
                    {isOwnerDispatchFlow
                      ? "Создать черновик"
                      : "Создать заявку"}
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
  const isAgent = userRole === "agent";

  // Владелец/админ: все заявки, история, запросы, выдача. Агент (role=agent): свои заявки и остатки.
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
  }, [activeTab, loadCarts, loadStocks]);

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
      openErrorAlert(
        setAlertModal,
        e,
        "Не удалось отклонить заявку",
      );
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
      message:
        "Доступ агента к складам компании будет снят.",
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
      };
      if (newMembershipCommonEnabled) {
        payload.common_access_enabled = true;
        payload.common_warehouse = commonWarehouse;
      }
      await createCompanyMembership(payload);
      setNewMembershipUserId("");
      setNewMembershipCommonEnabled(false);
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
                ? "Все заявки, история принятых и отказных, остатки у агентов"
                : "Заявки на товар и остатки"}
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
          {isOwnerOrAdmin ? "Агенты склада" : isAgent ? "Мои компании" : "Компании"}
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
                                colSpan={9}
                                className="warehouse-table__loading"
                              >
                                Загрузка…
                              </td>
                            </tr>
                          ) : activeCompanyAgents.length === 0 ? (
                            <tr>
                              <td
                                colSpan={9}
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
                      <th>Кол-во</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stocksLoading ? (
                      <tr>
                        <td
                          colSpan={isOwnerOrAdmin ? 7 : 6}
                          className="warehouse-table__loading"
                        >
                          Загрузка…
                        </td>
                      </tr>
                    ) : normalizeList(stocks).length === 0 ? (
                      <tr>
                        <td
                          colSpan={isOwnerOrAdmin ? 7 : 6}
                          className="warehouse-table__empty"
                        >
                          Остатков нет
                        </td>
                      </tr>
                    ) : (
                      normalizeList(stocks).map((r, idx) => {
                        const rowIndex = idx + 1;
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
                      <div className="agents-card__footer">
                        <span className="agents-card__label">Кол-во</span>
                        <span className="agents-card__value">
                          {r.qty ?? "—"} {r.product_unit || ""}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}

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
