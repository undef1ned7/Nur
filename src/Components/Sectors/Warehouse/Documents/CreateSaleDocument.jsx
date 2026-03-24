import React, { useState, useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  useNavigate,
  useLocation,
  useSearchParams,
  useParams,
} from "react-router-dom";
import {
  Search,
  Plus,
  Check,
  X,
  ChevronDown,
  Pencil,
  Calendar,
  Save,
  Printer,
  Package,
  User,
  Folder,
  FolderOpen,
  ArrowLeft,
} from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import ReceiptPdfDocument from "./components/ReceiptPdfDocument";
import InvoicePdfDocument from "./components/InvoicePdfDocument";
import {
  fetchWarehouseCounterparties,
  fetchWarehouses,
  postWarehouseDocument,
  getWarehouseDocumentById,
  updateWarehouseDocument,
} from "../../../../store/creators/warehouseThunk";
import { fetchProductsAsync } from "../../../../store/creators/productCreators";
import warehouseAPI from "../../../../api/warehouse";
import { useCash } from "../../../../store/slices/cashSlice";
import { useCounterparty } from "../../../../store/slices/counterpartySlice";
import { useUser } from "../../../../store/slices/userSlice";
import { getEmployees } from "../../../../store/creators/departmentCreators";
import { useDepartments } from "../../../../store/slices/departmentSlice";
import "./CreateSaleDocument.scss";
import { useAlert } from "../../../../hooks/useDialog";

const VALID_DOC_TYPES = [
  "SALE",
  "PURCHASE",
  "SALE_RETURN",
  "PURCHASE_RETURN",
  "INVENTORY",
  "RECEIPT",
  "WRITE_OFF",
  "TRANSFER",
];

// Маленькая модалка с полным текстом при наведении
const FullNamePopover = ({ fullText, children, className = "" }) => {
  const [show, setShow] = useState(false);
  const wrapperRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const updatePosition = () => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    }
  };

  const handleMouseEnter = () => {
    updatePosition();
    setShow(true);
  };

  const handleMouseLeave = () => {
    setShow(false);
  };

  if (!fullText || String(fullText).trim() === "") {
    return <span className={className}>{children}</span>;
  }

  return (
    <>
      <span
        ref={wrapperRef}
        className={className}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </span>
      {show && (
        <div
          className="create-sale-document__fullname-popover"
          style={{
            position: "fixed",
            top: position.top - 4,
            left: position.left,
            transform: "translateY(-100%)",
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {fullText}
        </div>
      )}
    </>
  );
};

const SearchSelect = ({
  value,
  onChange,
  options,
  placeholder = "Выберите...",
  disabled = false,
  emptyText = "Ничего не найдено",
}) => {
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => {
    const v = value == null ? "" : String(value);
    return (Array.isArray(options) ? options : []).find(
      (o) => String(o.value) === v,
    );
  }, [options, value]);

  const filtered = useMemo(() => {
    const list = Array.isArray(options) ? options : [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) => {
      const text = String(o.searchText || o.label || "").toLowerCase();
      return text.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    const onDocDown = (e) => {
      const el = containerRef.current;
      if (!el) return;
      if (!el.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  return (
    <div className="create-sale-document__searchselect" ref={containerRef}>
      <input
        ref={inputRef}
        className="create-sale-document__searchselect-input"
        type="text"
        disabled={disabled}
        value={open ? query : selected?.label || ""}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          if (!open) setOpen(true);
          setQuery(e.target.value);
        }}
      />

      {open && !disabled && (
        <div className="create-sale-document__searchselect-menu">
          {filtered.length === 0 ? (
            <div className="create-sale-document__searchselect-empty">
              {emptyText}
            </div>
          ) : (
            filtered.map((o) => (
              <button
                key={String(o.value)}
                type="button"
                className={`create-sale-document__searchselect-item ${
                  String(o.value) === String(value)
                    ? "create-sale-document__searchselect-item--active"
                    : ""
                }`}
                onClick={() => {
                  onChange?.(o.value);
                  setOpen(false);
                  setQuery("");
                  inputRef.current?.blur?.();
                }}
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const CreateSaleDocument = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams();
  const { company, profile: userProfile } = useUser();
  const { list: cashBoxes } = useCash();
  const { list: counterparties } = useCounterparty();
  const { employees } = useDepartments();
  const alert = useAlert();
  const urlDocType = searchParams.get("doc_type");
  const initialDocType =
    urlDocType && VALID_DOC_TYPES.includes(urlDocType)
      ? urlDocType
      : location.state?.docType &&
          VALID_DOC_TYPES.includes(location.state.docType)
        ? location.state.docType
        : "SALE";

  const [productSearch, setProductSearch] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());
  const [addingProduct, setAddingProduct] = useState(false);

  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState(null);
  // expanded group keys: "all" | uuid
  const [expandedGroupIds, setExpandedGroupIds] = useState(() => new Set());
  const [groupProducts, setGroupProducts] = useState(() => ({}));

  const [warehouses, setWarehouses] = useState([]);
  const [warehouse, setWarehouse] = useState("");
  const [warehouseTo, setWarehouseTo] = useState("");
  const [clientId, setClientId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [docType, setDocType] = useState(initialDocType);
  const [activeTab, setActiveTab] = useState("products");
  const [documentSearch, setDocumentSearch] = useState("");
  const [isDocumentPosted, setIsDocumentPosted] = useState(true);
  const [isOrder, setIsOrder] = useState(false);
  const [documentDateValue, setDocumentDateValue] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [showSavePrintMenu, setShowSavePrintMenu] = useState(false);
  const dateInputRef = useRef(null);
  const [documentDiscount, setDocumentDiscount] = useState("");
  const [comment, setComment] = useState("");
  const [paymentKind, setPaymentKind] = useState("cash"); // cash — сразу, credit — в долг (API: payment_kind)
  const [prepaymentAmount, setPrepaymentAmount] = useState(""); // предоплата по долгу (только при payment_kind=credit)
  const [showPrepaymentModal, setShowPrepaymentModal] = useState(false);
  const [modalPrepaymentValue, setModalPrepaymentValue] = useState("");
  const [showProductSelectModal, setShowProductSelectModal] = useState(false);
  const [productSelectModalProduct, setProductSelectModalProduct] =
    useState(null);
  const [productSelectModalQty, setProductSelectModalQty] = useState("1");
  const productSelectQtyInputRef = useRef(null);
  const productListRefs = useRef({});
  const [showExitModal, setShowExitModal] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [activeGroupKeyForKeyboard, setActiveGroupKeyForKeyboard] =
    useState("");
  const [groupKeyboardIndexMap, setGroupKeyboardIndexMap] = useState({});
  const [documentId] = useState(
    () => `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  );
  // id из URL (маршрут edit/:id) или из query/state для обратной совместимости
  const editDocumentId =
    params.id ||
    searchParams.get("edit_id") ||
    location.state?.editDocumentId ||
    null;
  const [loadingDraft, setLoadingDraft] = useState(!!editDocumentId);

  // Путь к списку документов текущего типа (продажи, покупки и т.д.)
  const documentsListPath = `/crm/warehouse/documents/${(docType || "SALE").toLowerCase()}`;

  const debounceTimerRef = useRef(null);
  const warehouseRef = useRef(warehouse);

  useEffect(() => {
    warehouseRef.current = warehouse;
  }, [warehouse]);

  useEffect(() => {
    if (!showProductSelectModal) return;
    // Даем React отрисовать модалку, потом фокус + выделение текста
    const t = setTimeout(() => {
      const el = productSelectQtyInputRef.current;
      if (!el) return;
      el.focus();
      el.select?.();
    }, 0);
    return () => clearTimeout(t);
  }, [showProductSelectModal]);

  // При открытии модалки предоплаты подставляем текущее значение
  useEffect(() => {
    if (showPrepaymentModal) {
      setModalPrepaymentValue(prepaymentAmount || "");
    }
  }, [showPrepaymentModal]); // eslint-disable-line react-hooks/exhaustive-deps

  const isTypingElement = (el) => {
    if (!el || typeof el !== "object") return false;
    const tag = String(el.tagName || "").toLowerCase();
    return (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      Boolean(el.isContentEditable)
    );
  };

  // Глобальная навигация по товарам стрелками без фокуса через Tab
  useEffect(() => {
    const onWindowKeyDown = (e) => {
      const key = e.key;
      if (
        key !== "ArrowUp" &&
        key !== "ArrowDown" &&
        key !== "ArrowLeft" &&
        key !== "ArrowRight" &&
        key !== "Enter"
      ) {
        return;
      }
      if (showProductSelectModal || showPrepaymentModal || showExitModal)
        return;
      if (isTypingElement(document.activeElement)) return;

      const groupsByParentMap = new Map();
      const parentByGroupKey = new Map();
      (Array.isArray(groups) ? groups : []).forEach((g) => {
        const gid = g?.id ?? g?.uuid;
        if (gid != null) {
          const gKey = String(gid);
          const parent =
            g?.parent != null && String(g?.parent).trim() !== ""
              ? String(g.parent)
              : null;
          parentByGroupKey.set(gKey, parent);
        }
        const parent = g?.parent ?? null;
        const parentKey = parent === null ? "root" : String(parent);
        if (!groupsByParentMap.has(parentKey))
          groupsByParentMap.set(parentKey, []);
        groupsByParentMap.get(parentKey).push(g);
      });
      for (const [k, arr] of groupsByParentMap.entries()) {
        arr.sort((a, b) =>
          String(a?.name || "").localeCompare(String(b?.name || ""), "ru", {
            sensitivity: "base",
          }),
        );
        groupsByParentMap.set(k, arr);
      }

      const collectGroupKeys = (parentId = null) => {
        const parentKey = parentId == null ? "root" : String(parentId);
        const children = groupsByParentMap.get(parentKey) || [];
        const keys = [];
        children.forEach((group) => {
          const gid = group?.id ?? group?.uuid;
          if (!gid) return;
          const gKey = String(gid);
          keys.push(gKey);
          keys.push(...collectGroupKeys(gKey));
        });
        return keys;
      };

      const allGroupKeys = ["all", ...collectGroupKeys(null)];
      const getParentChain = (groupKey) => {
        const chain = [];
        let current = String(groupKey || "");
        const guard = new Set();
        while (current && current !== "all" && !guard.has(current)) {
          guard.add(current);
          const parent = parentByGroupKey.get(current);
          if (!parent) break;
          chain.unshift(parent);
          current = String(parent);
        }
        return chain;
      };
      const expandedOnlyKeys = allGroupKeys.filter((k) =>
        expandedGroupIds.has(k),
      );

      if (key === "ArrowLeft" || key === "ArrowRight") {
        if (!expandedOnlyKeys.length) return;
        e.preventDefault();
        const currentGroupIndex = expandedOnlyKeys.findIndex(
          (k) => String(k) === String(activeGroupKeyForKeyboard || ""),
        );
        const nextGroupIndex =
          currentGroupIndex === -1
            ? 0
            : key === "ArrowRight"
              ? (currentGroupIndex + 1) % expandedOnlyKeys.length
              : (currentGroupIndex - 1 + expandedOnlyKeys.length) %
                expandedOnlyKeys.length;
        const nextGroupKey = String(expandedOnlyKeys[nextGroupIndex]);
        setActiveGroupKeyForKeyboard(nextGroupKey);
        setGroupKeyboardIndexMap((prev) => ({
          ...(prev || {}),
          [nextGroupKey]:
            typeof prev?.[nextGroupKey] === "number" ? prev[nextGroupKey] : 0,
        }));
        return;
      }

      const preferredKey = String(activeGroupKeyForKeyboard || "");
      const preferredEntry = preferredKey
        ? groupProducts?.[preferredKey]
        : null;
      const preferredItems = Array.isArray(preferredEntry?.items)
        ? preferredKey === "all"
          ? sortProductsByDate(getUngroupedProducts(preferredEntry.items))
          : sortProductsByDate(preferredEntry.items)
        : [];

      let targetGroupKey = preferredKey;
      let targetItems = preferredItems;

      if (!targetGroupKey || targetItems.length === 0) {
        const expandedKeys = expandedOnlyKeys;
        const fallbackKey = expandedKeys.find((k) => {
          const items = groupProducts?.[String(k)]?.items;
          if (!Array.isArray(items) || items.length === 0) return false;
          if (String(k) === "all") {
            return getUngroupedProducts(items).length > 0;
          }
          return true;
        });
        if (!fallbackKey) return;
        targetGroupKey = String(fallbackKey);
        const fallbackItems = groupProducts?.[targetGroupKey]?.items || [];
        targetItems =
          targetGroupKey === "all"
            ? sortProductsByDate(getUngroupedProducts(fallbackItems))
            : sortProductsByDate(fallbackItems);
      }

      if (!targetItems.length) return;

      const currentIndex =
        typeof groupKeyboardIndexMap[targetGroupKey] === "number"
          ? groupKeyboardIndexMap[targetGroupKey]
          : 0;

      if (key === "ArrowDown" || key === "ArrowUp") {
        e.preventDefault(); // блокируем скролл страницы
        if (key === "ArrowDown" && currentIndex >= targetItems.length - 1) {
          const currentGroupFlatIndex = allGroupKeys.findIndex(
            (k) => String(k) === String(targetGroupKey),
          );
          const nextGroupKey =
            currentGroupFlatIndex >= 0
              ? allGroupKeys[currentGroupFlatIndex + 1]
              : null;

          if (nextGroupKey) {
            const nextKey = String(nextGroupKey);
            const nextChain = getParentChain(nextKey);
            setExpandedGroupIds((prev) => {
              const next = new Set(prev || []);
              nextChain.forEach((k) => next.add(String(k)));
              next.add(nextKey);
              return next;
            });
            setActiveGroupKeyForKeyboard(nextKey);
            setGroupKeyboardIndexMap((prev) => ({
              ...(prev || {}),
              [nextKey]: 0,
            }));

            const nextEntry = groupProducts?.[nextKey];
            const nextNotLoaded = !Array.isArray(nextEntry?.items);
            if (nextNotLoaded) {
              loadProductsForGroup(nextKey, nextKey === "all" ? null : nextKey);
            }
            return;
          }
        }
        if (key === "ArrowUp" && currentIndex <= 0) {
          const currentGroupFlatIndex = allGroupKeys.findIndex(
            (k) => String(k) === String(targetGroupKey),
          );
          const prevGroupKey =
            currentGroupFlatIndex > 0
              ? allGroupKeys[currentGroupFlatIndex - 1]
              : null;

          if (prevGroupKey) {
            const prevKey = String(prevGroupKey);
            const prevChain = getParentChain(prevKey);
            setExpandedGroupIds((prev) => {
              const next = new Set(prev || []);
              prevChain.forEach((k) => next.add(String(k)));
              next.add(prevKey);
              return next;
            });
            setActiveGroupKeyForKeyboard(prevKey);

            const prevEntry = groupProducts?.[prevKey];
            const prevNotLoaded = !Array.isArray(prevEntry?.items);
            if (prevNotLoaded) {
              loadProductsForGroup(prevKey, prevKey === "all" ? null : prevKey);
              setGroupKeyboardIndexMap((prev) => ({
                ...(prev || {}),
                [prevKey]: 0,
              }));
            } else {
              const prevItems = Array.isArray(prevEntry?.items)
                ? prevEntry.items
                : [];
              const prevVisibleCount =
                prevKey === "all"
                  ? getUngroupedProducts(prevItems).length
                  : prevItems.length;
              const lastIndex = Math.max(0, prevVisibleCount - 1);
              setGroupKeyboardIndexMap((prev) => ({
                ...(prev || {}),
                [prevKey]: lastIndex,
              }));
            }
            return;
          }
        }

        const nextIndex =
          key === "ArrowDown"
            ? currentIndex >= targetItems.length - 1
              ? 0
              : currentIndex + 1
            : currentIndex <= 0
              ? targetItems.length - 1
              : currentIndex - 1;
        setActiveGroupKeyForKeyboard(targetGroupKey);
        setGroupKeyboardIndexMap((prev) => ({
          ...(prev || {}),
          [targetGroupKey]: nextIndex,
        }));
      } else if (key === "Enter") {
        e.preventDefault();
        const selectedByKeyboard = targetItems[currentIndex] || targetItems[0];
        if (selectedByKeyboard) {
          setActiveGroupKeyForKeyboard(targetGroupKey);
          openProductSelectModal(selectedByKeyboard);
        }
      }
    };

    window.addEventListener("keydown", onWindowKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown, { capture: true });
    };
  }, [
    activeGroupKeyForKeyboard,
    expandedGroupIds,
    groups,
    groupKeyboardIndexMap,
    groupProducts,
    showProductSelectModal,
    showPrepaymentModal,
    showExitModal,
  ]);

  // Форматирование даты для отображения
  const formatDisplayDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const displayDate = formatDisplayDate(
    documentDateValue ? new Date(documentDateValue).toISOString() : null,
  );

  // Синхронизируем тип документа в URL, чтобы в сайдбаре подсвечивался текущий тип
  useEffect(() => {
    const current = searchParams.get("doc_type");
    if (current !== docType) {
      setSearchParams({ doc_type: docType }, { replace: true });
    }
  }, [docType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce для поиска товаров
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedProductSearch(productSearch);
    }, 300);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [productSearch]);

  useEffect(() => {
    if (!warehouse) {
      setGroups([]);
      setGroupsError(null);
      setExpandedGroupIds(new Set());
      setGroupProducts({});
      return;
    }

    // при смене склада — сразу сбрасываем прошлые группы/товары в каталоге,
    // чтобы не показывались данные старого склада
    setGroups([]);
    setGroupsError(null);
    setExpandedGroupIds(new Set());
    setGroupProducts({});

    let cancelled = false;

    const loadGroups = async () => {
      setGroupsLoading(true);
      setGroupsError(null);
      try {
        const data = await warehouseAPI.listWarehouseGroups(warehouse);
        const list = Array.isArray(data) ? data : data?.results || [];
        if (!cancelled) setGroups(list);
      } catch (e) {
        console.error("Ошибка при загрузке групп:", e);
        if (!cancelled) {
          setGroups([]);
          setGroupsError(e);
        }
      } finally {
        if (!cancelled) setGroupsLoading(false);
      }
    };

    loadGroups();

    return () => {
      cancelled = true;
    };
  }, [warehouse]);

  const groupsByParent = useMemo(() => {
    const map = new Map();
    (Array.isArray(groups) ? groups : []).forEach((g) => {
      const parent = g?.parent ?? null;
      const key = parent === null ? "root" : String(parent);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(g);
    });
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || ""), "ru", {
          sensitivity: "base",
        }),
      );
      map.set(k, arr);
    }
    return map;
  }, [groups]);

  const getUngroupedProducts = (list) => {
    const arr = Array.isArray(list) ? list : [];
    return arr.filter((p) => {
      // API может вернуть product_group как id/uuid, объект или null
      const pg = p?.product_group;
      if (pg == null) return true;
      if (typeof pg === "string" || typeof pg === "number") return false;
      if (typeof pg === "object") {
        const id = pg?.id ?? pg?.uuid;
        return id == null || String(id).trim() === "";
      }
      return false;
    });
  };

  // Сортировка товаров по дате (новые сверху)
  const sortProductsByDate = (list) => {
    const arr = Array.isArray(list) ? list : [];
    return [...arr].sort((a, b) => {
      const dateA = a?.updated_at || a?.created_at || 0;
      const dateB = b?.updated_at || b?.created_at || 0;
      return new Date(dateB) - new Date(dateA);
    });
  };

  const toggleGroupExpand = (groupKey) => {
    const key = String(groupKey);
    setExpandedGroupIds((prev) => {
      const next = new Set(prev || []);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const loadProductsForGroup = async (groupKey, groupIdOrNull) => {
    if (!warehouse) return;
    const requestWarehouse = warehouse;
    const key = String(groupKey);

    setGroupProducts((prev) => ({
      ...(prev || {}),
      [key]: {
        ...(prev?.[key] || {}),
        loading: true,
        error: null,
        search: debouncedProductSearch || "",
      },
    }));

    try {
      const params = {
        warehouse,
        page_size: 1000,
      };
      if (debouncedProductSearch?.trim()) {
        params.search = debouncedProductSearch.trim();
      }
      if (groupIdOrNull) {
        params.product_group = groupIdOrNull;
      }

      const result = await dispatch(fetchProductsAsync(params));
      // если склад поменялся пока грузили — ничего не обновляем
      if (warehouseRef.current !== requestWarehouse) return;

      if (fetchProductsAsync.fulfilled.match(result)) {
        const list =
          result.payload?.results ||
          (Array.isArray(result.payload) ? result.payload : []);
        setGroupProducts((prev) => ({
          ...(prev || {}),
          [key]: {
            items: list,
            loading: false,
            error: null,
            search: debouncedProductSearch || "",
          },
        }));
      } else {
        setGroupProducts((prev) => ({
          ...(prev || {}),
          [key]: {
            items: [],
            loading: false,
            error: result.payload || result.error || true,
            search: debouncedProductSearch || "",
          },
        }));
      }
    } catch (e) {
      console.error("Ошибка загрузки товаров группы:", e);
      setGroupProducts((prev) => ({
        ...(prev || {}),
        [key]: {
          items: [],
          loading: false,
          error: e,
          search: debouncedProductSearch || "",
        },
      }));
    }
  };

  const renderGroupTree = (parentId, depth = 0) => {
    const key = parentId == null ? "root" : String(parentId);
    const list = groupsByParent.get(key) || [];
    if (!list.length) return null;

    return list.map((g) => {
      const gid = g?.id ?? g?.uuid;
      if (!gid) return null;
      const gKey = String(gid);
      const children = groupsByParent.get(gKey) || [];
      const hasChildren = children.length > 0;
      const isExpanded = expandedGroupIds.has(gKey);
      const cached = groupProducts?.[gKey];
      const cachedCount = Array.isArray(cached?.items)
        ? cached.items.length
        : 0;
      const count =
        g?.products_count !== undefined && g?.products_count !== null
          ? Number(g.products_count) || 0
          : cachedCount;

      return (
        <div key={gKey} className="create-sale-document__group-node">
          <div
            className={`create-sale-document__group-item ${
              isExpanded ? "is-open" : ""
            }`}
            style={{ paddingLeft: 10 + depth * 14 }}
            role="button"
            tabIndex={0}
            onClick={() => {
              setActiveGroupKeyForKeyboard(gKey);
              toggleGroupExpand(gKey);
              const entry = groupProducts?.[gKey];
              const isStale =
                (entry?.search || "") !== (debouncedProductSearch || "");
              const notLoaded = !Array.isArray(entry?.items);
              if (!isExpanded && (notLoaded || isStale)) {
                loadProductsForGroup(gKey, gKey);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setActiveGroupKeyForKeyboard(gKey);
                toggleGroupExpand(gKey);
                const entry = groupProducts?.[gKey];
                const isStale =
                  (entry?.search || "") !== (debouncedProductSearch || "");
                const notLoaded = !Array.isArray(entry?.items);
                if (!isExpanded && (notLoaded || isStale)) {
                  loadProductsForGroup(gKey, gKey);
                }
              }
            }}
            title="Открыть товары группы"
          >
            <span
              className="create-sale-document__group-expander"
              onClick={(e) => {
                e.stopPropagation();
                setActiveGroupKeyForKeyboard(gKey);
                toggleGroupExpand(gKey);
                const entry = groupProducts?.[gKey];
                const isStale =
                  (entry?.search || "") !== (debouncedProductSearch || "");
                const notLoaded = !Array.isArray(entry?.items);
                if (!isExpanded && (notLoaded || isStale)) {
                  loadProductsForGroup(gKey, gKey);
                }
              }}
              title="Раскрыть"
            >
              <ChevronDown
                size={14}
                style={{
                  transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                }}
              />
            </span>
            <span className="create-sale-document__group-icon">
              {isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
            </span>
            <span className="create-sale-document__group-name">
              {g?.name || "—"}
            </span>
            <span className="create-sale-document__group-count">{count}</span>
          </div>
          {isExpanded && (
            <div className="create-sale-document__group-body">
              <div className="create-sale-document__group-products">
                {cached?.loading ? (
                  <div className="create-sale-document__group-products-empty">
                    Загрузка…
                  </div>
                ) : cached?.error ? (
                  <div className="create-sale-document__group-products-empty">
                    Не удалось загрузить товары
                  </div>
                ) : Array.isArray(cached?.items) &&
                  cached.items.length === 0 ? (
                  <div className="create-sale-document__group-products-empty">
                    Нет товаров
                  </div>
                ) : (
                  (() => {
                    const visibleProducts = sortProductsByDate(
                      cached?.items || [],
                    );
                    const currentIndex =
                      typeof groupKeyboardIndexMap[gKey] === "number"
                        ? groupKeyboardIndexMap[gKey]
                        : 0;

                    return (
                      <div
                        role="listbox"
                        className="create-sale-document__group-products-list"
                        tabIndex={0}
                        ref={(el) => {
                          if (el) productListRefs.current[gKey] = el;
                        }}
                        onFocus={() => {
                          setActiveGroupKeyForKeyboard(gKey);
                          setGroupKeyboardIndexMap((prev) => ({
                            ...(prev || {}),
                            [gKey]:
                              typeof prev?.[gKey] === "number" ? prev[gKey] : 0,
                          }));
                        }}
                        onKeyDown={(e) => {
                          if (e.defaultPrevented) return;
                          if (!visibleProducts.length) return;
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            const nextIndex =
                              currentIndex >= visibleProducts.length - 1
                                ? 0
                                : currentIndex + 1;
                            setActiveGroupKeyForKeyboard(gKey);
                            setGroupKeyboardIndexMap((prev) => ({
                              ...(prev || {}),
                              [gKey]: nextIndex,
                            }));
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            const nextIndex =
                              currentIndex <= 0
                                ? visibleProducts.length - 1
                                : currentIndex - 1;
                            setActiveGroupKeyForKeyboard(gKey);
                            setGroupKeyboardIndexMap((prev) => ({
                              ...(prev || {}),
                              [gKey]: nextIndex,
                            }));
                          } else if (e.key === "Enter") {
                            e.preventDefault();
                            const selectedByKeyboard =
                              visibleProducts[currentIndex] ||
                              visibleProducts[0];
                            if (selectedByKeyboard) {
                              openProductSelectModal(selectedByKeyboard);
                            }
                          }
                        }}
                      >
                        {visibleProducts.map((product, index) => {
                          const isSelected = selectedProductIds.has(
                            String(product.id),
                          );
                          const isInCart = cartItems.some(
                            (item) =>
                              String(item.productId) === String(product.id),
                          );
                          const isKeyboardActive =
                            activeGroupKeyForKeyboard === gKey &&
                            currentIndex === index;
                          return (
                            <div
                              key={product.id}
                              className={`create-sale-document__group-product-item ${
                                isSelected || isInCart ? "active" : ""
                              } ${isKeyboardActive ? "active" : ""}`}
                              onMouseEnter={() => {
                                setActiveGroupKeyForKeyboard(gKey);
                                setGroupKeyboardIndexMap((prev) => ({
                                  ...(prev || {}),
                                  [gKey]: index,
                                }));
                              }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                handleAddProduct(product);
                              }}
                            >
                              <div className="create-sale-document__group-product-main">
                                <FullNamePopover
                                  fullText={product.name}
                                  className="create-sale-document__group-product-name"
                                >
                                  {product.name}
                                </FullNamePopover>
                                <div className="create-sale-document__group-product-meta">
                                  <span className="create-sale-document__group-product-price">
                                    {formatPrice(
                                      getProductPriceForDocument(product),
                                    )}{" "}
                                    сом
                                  </span>
                                  <span className="create-sale-document__group-product-stock">
                                    {product.quantity ?? 0}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </div>

              {hasChildren && (
                <div className="create-sale-document__group-children">
                  {renderGroupTree(gKey, depth + 1)}
                </div>
              )}
            </div>
          )}
        </div>
      );
    });
  };

  // Загрузка контрагентов через warehouse API
  useEffect(() => {
    // Загружаем всех контрагентов (CLIENT, SUPPLIER, BOTH)
    dispatch(fetchWarehouseCounterparties());
  }, [dispatch]);

  // Загрузка складов через новый warehouse API
  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const result = await dispatch(fetchWarehouses());
        if (fetchWarehouses.fulfilled.match(result)) {
          const loadedWarehouses =
            result.payload?.results ||
            (Array.isArray(result.payload) ? result.payload : []);
          setWarehouses(loadedWarehouses);
        }
      } catch (error) {
        console.error("Ошибка загрузки складов:", error);
      }
    };
    loadWarehouses();
  }, [dispatch]);

  // Загружаем сотрудников (для выбора агента)
  useEffect(() => {
    dispatch(getEmployees());
  }, [dispatch]);

  // Автоматически выбираем первый склад по умолчанию (не при редактировании черновика)
  useEffect(() => {
    if (editDocumentId) return;
    if (warehouse) return;

    if (warehouses.length > 0) {
      const firstWarehouse = warehouses[0];
      setWarehouse(firstWarehouse.id || firstWarehouse.uuid || "");
    }
  }, [warehouses, warehouse, editDocumentId]);

  // Загрузка черновика для редактирования
  useEffect(() => {
    if (!editDocumentId) return;

    let cancelled = false;
    const loadDraft = async () => {
      setLoadingDraft(true);
      try {
        const result = await dispatch(getWarehouseDocumentById(editDocumentId));
        if (cancelled) return;
        if (!getWarehouseDocumentById.fulfilled.match(result)) {
          setLoadingDraft(false);
          alert("Не удалось загрузить документ");
          navigate(documentsListPath);
          return;
        }
        const doc = result.payload;
        if (!doc || typeof doc !== "object") {
          setLoadingDraft(false);
          alert("Не удалось загрузить документ");
          navigate(documentsListPath);
          return;
        }
        // API может вернуть warehouse_from/counterparty как строку (UUID) или объект
        const whFrom =
          typeof doc.warehouse_from === "object" && doc.warehouse_from != null
            ? (doc.warehouse_from?.id ?? doc.warehouse_from?.uuid ?? "")
            : String(doc.warehouse_from ?? "");
        const whTo =
          typeof doc.warehouse_to === "object" && doc.warehouse_to != null
            ? (doc.warehouse_to?.id ?? doc.warehouse_to?.uuid ?? "")
            : String(doc.warehouse_to ?? "");
        const cpId =
          typeof doc.counterparty === "object" && doc.counterparty != null
            ? (doc.counterparty?.id ?? doc.counterparty?.uuid ?? "")
            : String(doc.counterparty ?? "");
        setWarehouse(whFrom);
        setWarehouseTo(whTo);
        setClientId(cpId);
        setDocType(doc.doc_type || "SALE");
        setComment(doc.comment || "");
        setDocumentDiscount(
          doc.discount_percent != null && doc.discount_percent !== ""
            ? String(doc.discount_percent)
            : "",
        );
        setPaymentKind(doc.payment_kind || "cash");
        setPrepaymentAmount(
          doc.prepayment_amount != null && doc.prepayment_amount !== ""
            ? String(doc.prepayment_amount)
            : "",
        );
        if (doc.date) {
          const d =
            typeof doc.date === "string" && doc.date.includes("T")
              ? doc.date.split("T")[0]
              : doc.date;
          setDocumentDateValue(d);
        } else if (doc.created_at) {
          const d =
            typeof doc.created_at === "string" && doc.created_at.includes("T")
              ? doc.created_at.split("T")[0]
              : doc.created_at;
          setDocumentDateValue(d);
        }
        const items = Array.isArray(doc.items)
          ? doc.items.map((it, idx) => {
              // product в API может быть строкой (UUID) или объектом
              const productId =
                typeof it.product === "object" && it.product != null
                  ? (it.product?.id ?? it.product?.uuid ?? "")
                  : String(it.product ?? it.product_id ?? "");
              const productName =
                it.product_name ??
                (typeof it.product === "object" ? it.product?.name : null) ??
                it.name ??
                "Товар";
              const price = Number(it.price ?? it.unit_price ?? 0);
              const qty = Number(it.qty ?? it.quantity ?? 1);
              const discountPct = Number(
                it.discount_percent ?? it.discount ?? 0,
              );
              const unit =
                typeof it.product === "object" && it.product != null
                  ? (it.product?.unit ?? it.unit)
                  : it.unit;
              const article =
                typeof it.product === "object" && it.product != null
                  ? (it.product?.article ?? it.article ?? it.product_article)
                  : (it.article ?? it.product_article ?? "");
              return {
                id: it.id || `item-${Date.now()}-${idx}`,
                productId: productId,
                productName,
                name: productName,
                price,
                unit_price: price,
                quantity: qty,
                stock: it.stock ?? 0,
                unit: unit && String(unit).trim() ? String(unit) : "шт",
                discount: discountPct,
                discount_percent: discountPct,
                article: article ? String(article) : "",
                addedAt: it.created_at || new Date().toISOString(),
                created_at: it.created_at,
              };
            })
          : [];
        setCartItems(items);
        if (!cancelled) setLoadingDraft(false);
      } catch (e) {
        if (!cancelled) {
          setLoadingDraft(false);
          alert(
            "Ошибка загрузки документа: " +
              (e?.message || "Неизвестная ошибка"),
          );
          navigate(documentsListPath);
        }
      } finally {
        setLoadingDraft(false);
      }
    };
    loadDraft();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только при смене editDocumentId; alert/navigate стабильны по смыслу
  }, [editDocumentId]);

  // Цена для подстановки в позицию: при покупке — закупочная, при продаже — цена продажи
  const getProductPriceForDocument = (product) => {
    if (!product) return 0;
    const isPurchase = docType === "PURCHASE" || docType === "PURCHASE_RETURN";
    return Number(
      isPurchase
        ? (product.purchase_price ?? product.price ?? 0)
        : (product.price ?? 0),
    );
  };

  // Ограничение по остатку только для операций отгрузки (продажа, возврат поставщику, списание, перемещение).
  const isStockLimitRequired = useMemo(() => {
    return ["SALE", "PURCHASE_RETURN", "WRITE_OFF", "TRANSFER"].includes(
      docType,
    );
  }, [docType]);

  // При смене склада удаляем из корзины товары, которых нет на новом складе
  // При редактировании черновика (editDocumentId) позиции не удаляем — только обновляем остатки
  useEffect(() => {
    if (!warehouse || !cartItems.length) return;

    let cancelled = false;
    (async () => {
      try {
        const result = await dispatch(
          fetchProductsAsync({ warehouse, page_size: 1000 }),
        );
        if (cancelled) return;
        if (fetchProductsAsync.fulfilled.match(result)) {
          const list =
            result.payload?.results ||
            (Array.isArray(result.payload) ? result.payload : []);
          const productById = new Map(
            list.map((p) => [String(p.id), { id: p.id, quantity: p.quantity }]),
          );
          setCartItems((prev) => {
            const isEditDraft = !!editDocumentId;
            const filtered = isEditDraft
              ? prev
              : prev.filter((item) =>
                  productById.has(String(item.productId ?? item.product_id)),
                );
            return filtered.map((item) => {
              const p = productById.get(
                String(item.productId ?? item.product_id),
              );
              const stock =
                p != null ? Number(p?.quantity ?? 0) : Number(item.stock ?? 0);
              const qty = Number(item.quantity ?? 0);
              const capByStock =
                isStockLimitRequired && stock > 0 && qty > stock;
              return {
                ...item,
                stock,
                quantity: capByStock ? stock : item.quantity,
              };
            });
          });
        }
      } catch (e) {
        // игнорируем ошибку загрузки
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [warehouse, isStockLimitRequired, editDocumentId]);

  // Синхронизация выбранных товаров с товарами в корзине
  useEffect(() => {
    if (cartItems && cartItems.length > 0) {
      const productIdsInCart = new Set();
      cartItems.forEach((item) => {
        const productId = item.productId || item.product_id || item.product;
        if (productId) {
          productIdsInCart.add(String(productId));
        }
      });
      setSelectedProductIds(productIdsInCart);
    } else {
      // Если корзина пуста, очищаем выбранные товары
      setSelectedProductIds(new Set());
    }
  }, [cartItems]);

  // Фильтрация контрагентов в зависимости от типа документа
  const filteredCounterparties = useMemo(() => {
    const all = counterparties || [];
    // Для SALE, SALE_RETURN, PURCHASE, PURCHASE_RETURN нужны контрагенты
    if (
      ["SALE", "SALE_RETURN", "PURCHASE", "PURCHASE_RETURN"].includes(docType)
    ) {
      return all.filter((c) => {
        if (docType === "SALE" || docType === "SALE_RETURN") {
          return c.type === "CLIENT" || c.type === "BOTH";
        }
        if (docType === "PURCHASE" || docType === "PURCHASE_RETURN") {
          return c.type === "SUPPLIER" || c.type === "BOTH";
        }
        return true;
      });
    }
    // Для других типов документов показываем всех
    return all;
  }, [counterparties, docType]);

  const isAgentFilterRelevant = docType === "SALE" || docType === "SALE_RETURN";

  const getCounterpartyAgentId = (cp) => {
    const a = cp?.agent;
    if (!a) return null;
    if (typeof a === "object") {
      const id = a?.id ?? a?.uuid;
      return id != null ? String(id) : null;
    }
    return String(a);
  };

  const agents = useMemo(() => {
    const list = Array.isArray(employees) ? employees : [];
    const baseAgents = list.filter((e) => {
      const role =
        e?.role_display ??
        e?.role_name ??
        e?.role ??
        e?.position ??
        e?.post ??
        "";
      return String(role).trim() === "Агент";
    });

    const filteredAgents = isAgentFilterRelevant
      ? baseAgents.filter((e) =>
          filteredCounterparties.some(
            (c) => getCounterpartyAgentId(c) === String(e?.id ?? ""),
          ),
        )
      : baseAgents;

    return filteredAgents.sort((a, b) =>
      String(a?.full_name || a?.name || a?.email || "").localeCompare(
        String(b?.full_name || b?.name || b?.email || ""),
        "ru",
      ),
    );
  }, [employees, filteredCounterparties, isAgentFilterRelevant]);

  const counterpartyOptions = useMemo(() => {
    const list = Array.isArray(filteredCounterparties)
      ? filteredCounterparties
      : [];
    const agentKey = isAgentFilterRelevant && agentId ? String(agentId) : "";
    const filtered =
      agentKey.trim() === ""
        ? list
        : list.filter((cp) => getCounterpartyAgentId(cp) === agentKey);

    return filtered
      .slice()
      .sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || ""), "ru"),
      )
      .map((cp) => ({
        value: cp.id,
        label: cp.name || cp.full_name || cp.title || "Без названия",
        searchText: `${cp.name || ""} ${cp.full_name || ""} ${cp.title || ""} ${
          cp.phone || ""
        } ${cp.inn || ""}`.trim(),
      }));
  }, [filteredCounterparties, agentId, isAgentFilterRelevant]);

  const agentOptions = useMemo(() => {
    return (Array.isArray(agents) ? agents : []).map((a) => ({
      value: a.id,
      label: a.full_name || a.name || a.email || `#${a.id}`,
      searchText: `${a.full_name || ""} ${a.name || ""} ${a.email || ""} ${
        a.phone || ""
      }`.trim(),
    }));
  }, [agents]);

  const warehouseOptions = useMemo(() => {
    return (Array.isArray(warehouses) ? warehouses : [])
      .slice()
      .sort((a, b) =>
        String(a?.name || a?.title || "").localeCompare(
          String(b?.name || b?.title || ""),
          "ru",
        ),
      )
      .map((wh) => ({
        value: wh.id || wh.uuid,
        label: wh.name || wh.title || String(wh.id || wh.uuid),
        searchText: `${wh.name || ""} ${wh.title || ""} ${
          wh.address || ""
        }`.trim(),
      }));
  }, [warehouses]);

  const warehouseToOptions = useMemo(() => {
    return (Array.isArray(warehouses) ? warehouses : [])
      .filter((wh) => String(wh.id) !== String(warehouse))
      .slice()
      .sort((a, b) =>
        String(a?.name || a?.title || "").localeCompare(
          String(b?.name || b?.title || ""),
          "ru",
        ),
      )
      .map((wh) => ({
        value: wh.id || wh.uuid,
        label: wh.name || wh.title || String(wh.id || wh.uuid),
        searchText: `${wh.name || ""} ${wh.title || ""} ${
          wh.address || ""
        }`.trim(),
      }));
  }, [warehouses, warehouse]);

  // Если при выборе агента текущий контрагент не подходит — сбрасываем контрагента
  // При редактировании черновика не сбрасываем — контрагент уже из документа
  useEffect(() => {
    if (editDocumentId || !clientId) return;
    const exists = counterpartyOptions.some(
      (o) => String(o.value) === String(clientId),
    );
    if (!exists) setClientId("");
  }, [agentId, counterpartyOptions, editDocumentId, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Определяем, требуется ли контрагент для текущего типа документа
  const isCounterpartyRequired = useMemo(() => {
    return ["SALE", "SALE_RETURN", "PURCHASE", "PURCHASE_RETURN"].includes(
      docType,
    );
  }, [docType]);

  // payment_kind (оплата сразу / в долг) только для SALE, PURCHASE, SALE_RETURN, PURCHASE_RETURN
  const isPaymentKindRelevant = useMemo(() => {
    return ["SALE", "PURCHASE", "SALE_RETURN", "PURCHASE_RETURN"].includes(
      docType,
    );
  }, [docType]);

  // Определяем, требуется ли второй склад (для TRANSFER)
  const isWarehouseToRequired = useMemo(() => {
    return docType === "TRANSFER";
  }, [docType]);

  // Фильтрация и сортировка товаров в документе по дате (новые сверху)
  const filteredDocumentItems = useMemo(() => {
    if (!cartItems || cartItems.length === 0) return [];
    const search = documentSearch.toLowerCase();
    const filtered = cartItems.filter((item) => {
      const name = item.productName || item.name || "";
      return name.toLowerCase().includes(search);
    });
    return [...filtered].sort((a, b) => {
      const dateA = a.addedAt || a.created_at || 0;
      const dateB = b.addedAt || b.created_at || 0;
      return new Date(dateB) - new Date(dateA);
    });
  }, [cartItems, documentSearch]);

  // Расчет итогов
  const totals = useMemo(() => {
    const items = cartItems || [];
    const subtotal = items.reduce(
      (sum, item) =>
        sum +
        (Number(item.price || item.unit_price) || 0) *
          (Number(item.quantity) || 0),
      0,
    );

    // Скидка по позициям (сумма всех скидок на товары)
    const itemsDiscount = items.reduce((sum, item) => {
      const itemPrice = Number(item.price || item.unit_price || 0);
      const itemQty = Number(item.quantity || 0);
      const itemDiscountPercent = Number(
        item.discount_percent || item.discount || 0,
      );
      return sum + (itemPrice * itemQty * itemDiscountPercent) / 100;
    }, 0);

    // Сумма после скидок по позициям
    const subtotalAfterItemsDiscount = subtotal - itemsDiscount;

    // Скидка по документу (в процентах) применяется к сумме ПОСЛЕ скидок по позициям
    const discountPercent = Number(documentDiscount) || 0;
    const documentDiscountAmount =
      (subtotalAfterItemsDiscount * discountPercent) / 100;

    // Общая скидка (скидка по позициям + скидка по документу)
    const totalDiscount = itemsDiscount + documentDiscountAmount;

    // Итоговая сумма с учетом всех скидок
    const total = subtotalAfterItemsDiscount - documentDiscountAmount;

    // Предоплата (только для продажи/покупки в долг)
    const prepaymentNum =
      isPaymentKindRelevant && paymentKind === "credit"
        ? Math.max(0, Number(prepaymentAmount) || 0)
        : 0;

    // Оплачено: для оплаты сразу считаем всю сумму, для кредита — только предоплату
    const paid = isDocumentPosted
      ? paymentKind === "cash"
        ? total
        : prepaymentNum
      : prepaymentNum;

    const displayTotal = total;

    return {
      subtotal,
      itemsDiscount,
      documentDiscount: documentDiscountAmount,
      totalDiscount,
      total,
      displayTotal,
      paid,
      prepayment: prepaymentNum,
      taxes: 0,
    };
  }, [
    cartItems,
    documentDiscount,
    isDocumentPosted,
    isPaymentKindRelevant,
    paymentKind,
    prepaymentAmount,
  ]);

  // Добавление товара в корзину
  const handleAddProduct = async (productOrId, requestedQty = 1) => {
    if (addingProduct) return false; // Предотвращаем множественные клики

    setAddingProduct(true);
    try {
      const product =
        typeof productOrId === "object" && productOrId ? productOrId : null;

      if (!product?.id) {
        alert("Товар не найден");
        return false;
      }

      const requestedQtyNumber = Number(requestedQty);
      if (isNaN(requestedQtyNumber) || requestedQtyNumber <= 0) {
        alert("Введите корректное количество");
        return false;
      }

      const unit = String(product.unit || "шт").toLowerCase();
      const isPiece = unit === "шт" || unit === "штук";
      const qtyToAdd = isPiece
        ? Math.floor(requestedQtyNumber)
        : requestedQtyNumber;
      if (qtyToAdd <= 0) {
        alert("Количество должно быть больше 0");
        return false;
      }

      // Проверяем, есть ли уже этот товар в корзине
      const existingItemIndex = cartItems.findIndex(
        (item) => String(item.productId) === String(product.id),
      );

      const stock = Number(product.quantity ?? 0);

      if (existingItemIndex >= 0) {
        const existing = cartItems[existingItemIndex];
        const currentQty = Number(existing.quantity || 0);
        const maxQty = Number(existing.stock ?? stock);
        if (
          isStockLimitRequired &&
          maxQty > 0 &&
          currentQty + qtyToAdd > maxQty
        ) {
          const available = Math.max(0, maxQty - currentQty);
          alert(
            available > 0
              ? `Можно добавить не более ${available}. Остаток: ${maxQty}`
              : `Нельзя добавить больше остатка. Остаток: ${maxQty}`,
          );
          return false;
        }
        setCartItems((prev) => {
          const updated = [...prev];
          updated[existingItemIndex] = {
            ...updated[existingItemIndex],
            quantity:
              Number(updated[existingItemIndex].quantity || 0) + qtyToAdd,
            stock: maxQty,
          };
          return updated;
        });
      } else {
        if (isStockLimitRequired && stock < qtyToAdd) {
          alert("Нет остатка на складе");
          return false;
        }
        const priceForDoc = getProductPriceForDocument(product);
        const newItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          productId: product.id,
          productName: product.name,
          name: product.name,
          price: priceForDoc,
          unit_price: priceForDoc,
          quantity: qtyToAdd,
          stock,
          unit: product.unit || "шт",
          discount: 0,
          discount_percent: 0,
          article: product.article || "",
          addedAt: new Date().toISOString(),
        };
        setCartItems((prev) => [...prev, newItem]);
      }

      // Добавляем товар в список выбранных
      setSelectedProductIds((prev) => new Set([...prev, String(product.id)]));
      return true;
    } catch (error) {
      console.error("Ошибка при добавлении товара:", error);
      alert("Ошибка при добавлении товара");
      return false;
    } finally {
      setAddingProduct(false);
    }
  };

  const openProductSelectModal = (product) => {
    if (!product) return;
    setProductSelectModalProduct(product);
    setProductSelectModalQty("1");
    setShowProductSelectModal(true);
  };

  const closeProductSelectModal = () => {
    setShowProductSelectModal(false);
    setProductSelectModalProduct(null);
    setProductSelectModalQty("1");
  };

  const handleConfirmProductSelect = async () => {
    if (!productSelectModalProduct) return;
    const returnFocusKey = String(activeGroupKeyForKeyboard || "");
    const qtyNumber = Number(String(productSelectModalQty).replace(",", "."));
    if (isNaN(qtyNumber) || qtyNumber <= 0) {
      alert("Введите корректное количество");
      return;
    }
    const success = await handleAddProduct(
      productSelectModalProduct,
      qtyNumber,
    );
    if (success) {
      closeProductSelectModal();
      // Гарантируем, что текущая "папка" (группа) останется раскрытой после добавления
      if (returnFocusKey && returnFocusKey !== "all") {
        const parentByGroupKey = new Map();
        (Array.isArray(groups) ? groups : []).forEach((g) => {
          const gid = g?.id ?? g?.uuid;
          if (gid == null) return;
          const gKey = String(gid);
          const parent =
            g?.parent != null && String(g?.parent).trim() !== ""
              ? String(g.parent)
              : null;
          parentByGroupKey.set(gKey, parent);
        });
        const chain = [];
        let current = String(returnFocusKey);
        const guard = new Set();
        while (current && !guard.has(current)) {
          guard.add(current);
          const parent = parentByGroupKey.get(current);
          if (!parent) break;
          chain.unshift(String(parent));
          current = String(parent);
        }
        setExpandedGroupIds((prev) => {
          const next = new Set(prev || []);
          chain.forEach((k) => next.add(String(k)));
          next.add(String(returnFocusKey));
          return next;
        });
      }
      if (returnFocusKey === "all") {
        setExpandedGroupIds((prev) => {
          const next = new Set(prev || []);
          next.add("all");
          return next;
        });
      }
      // Возвращаем фокус в список товаров группы, чтобы можно было продолжать навигацию стрелками
      setTimeout(() => {
        const el = productListRefs.current?.[returnFocusKey];
        el?.focus?.();
      }, 0);
    }
  };

  // Изменение количества товара
  const handleQuantityChange = (itemId, newQuantity) => {
    const item = cartItems.find((i) => i.id === itemId);
    if (!item) return;
    const qty = Number(newQuantity);
    const unit = item.unit || "шт";
    const isPiece =
      unit.toLowerCase() === "шт" || unit.toLowerCase() === "штук";
    let finalQty = isPiece ? Math.floor(qty) : qty;
    const maxQty = Number(item.stock ?? 0);
    if (isStockLimitRequired && maxQty > 0 && finalQty > maxQty) {
      finalQty = maxQty;
    }
    setCartItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, quantity: finalQty } : i)),
    );
  };

  // Удаление товара
  const handleRemoveProduct = (itemId) => {
    setCartItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  // Изменение цены товара в таблице
  const handlePriceChange = (itemId, newPrice) => {
    const num = Number(newPrice);
    if (isNaN(num) || num < 0) return;
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, price: num, unit_price: num } : item,
      ),
    );
  };

  // Изменение скидки по позиции в таблице
  const handleDiscountChange = (itemId, newDiscount) => {
    const num = Math.max(0, Math.min(100, Number(newDiscount) || 0));
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, discount_percent: num, discount: num }
          : item,
      ),
    );
  };

  // Валидация данных документа перед отправкой
  const validateDocumentData = () => {
    // Проверка товаров
    if (!cartItems || cartItems.length === 0) {
      return { valid: false, error: "Добавьте товары в документ" };
    }

    // Валидация каждого товара
    for (const item of cartItems) {
      const unit = item.unit || "шт";
      const isPiece =
        unit.toLowerCase() === "шт" || unit.toLowerCase() === "штук";
      const qty = Number(item.quantity || 0);

      // Для piece items qty должно быть целым числом
      if (isPiece && !Number.isInteger(qty)) {
        return {
          valid: false,
          error: `Для товара "${
            item.productName || item.name
          }" количество должно быть целым числом (единица измерения: ${unit})`,
        };
      }

      // Проверка discount_percent в диапазоне 0-100
      const discountPercent = Number(
        item.discount_percent || item.discount || 0,
      );
      if (discountPercent < 0 || discountPercent > 100) {
        return {
          valid: false,
          error: `Скидка для товара "${
            item.productName || item.name
          }" должна быть в диапазоне 0-100%`,
        };
      }

      // Проверка: количество не больше остатка на складе (только для операций отгрузки)
      if (isStockLimitRequired) {
        const stock = Number(item.stock ?? 0);
        if (stock > 0 && qty > stock) {
          return {
            valid: false,
            error: `Количество товара "${
              item.productName || item.name
            }" не может превышать остаток на складе (${stock})`,
          };
        }
      }
    }

    // Проверка склада
    if (!warehouse) {
      return { valid: false, error: "Выберите склад" };
    }

    // Проверка склада получателя для TRANSFER
    if (isWarehouseToRequired && !warehouseTo) {
      return { valid: false, error: "Выберите склад получатель" };
    }

    if (isWarehouseToRequired && warehouse === warehouseTo) {
      return {
        valid: false,
        error: "Склад отправитель и склад получатель должны быть разными",
      };
    }

    // Проверка контрагента
    if (isCounterpartyRequired && !clientId) {
      const counterpartyLabel =
        docType === "SALE" || docType === "SALE_RETURN"
          ? "клиента"
          : "поставщика";
      return { valid: false, error: `Выберите ${counterpartyLabel}` };
    }

    return { valid: true };
  };

  // Форматирование ошибок от API
  const formatApiError = (error) => {
    if (!error) return "Неизвестная ошибка";

    // Обработка поле-специфичных ошибок: {"field": ["error1", ...]}
    if (typeof error === "object" && !error.detail && !error.message) {
      const fieldErrors = Object.entries(error)
        .map(([field, messages]) => {
          const msgArray = Array.isArray(messages) ? messages : [messages];
          return `${field}: ${msgArray.join(", ")}`;
        })
        .join("; ");
      return fieldErrors || "Ошибка валидации";
    }

    // Обработка detail или message
    return error.detail || error.message || "Ошибка при сохранении документа";
  };

  // Вспомогательный хелпер: выбор правильного эндпоинта для создания документа по типу
  const createDocumentByType = async (payload) => {
    switch (docType) {
      case "SALE":
        return warehouseAPI.createSaleDocument(payload);
      case "PURCHASE":
        return warehouseAPI.createPurchaseDocument(payload);
      case "SALE_RETURN":
        return warehouseAPI.createSaleReturnDocument(payload);
      case "PURCHASE_RETURN":
        return warehouseAPI.createPurchaseReturnDocument(payload);
      case "INVENTORY":
        return warehouseAPI.createInventoryDocument(payload);
      case "RECEIPT":
        return warehouseAPI.createReceiptDocument(payload);
      case "WRITE_OFF":
        return warehouseAPI.createWriteOffDocument(payload);
      case "TRANSFER":
        return warehouseAPI.createTransferDocument(payload);
      default:
        // Фолбэк на общий эндпоинт /documents/
        return warehouseAPI.createDocument(payload);
    }
  };

  // Сохранение документа (без печати)
  const handleSave = async () => {
    // Валидация перед отправкой
    const validation = validateDocumentData();
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    try {
      // Скидка по документу (API: discount_percent, discount_amount)
      const discountPercentNum = Number(documentDiscount) || 0;
      const subtotalForDoc = cartItems.reduce(
        (sum, item) =>
          sum +
          (Number(item.price || item.unit_price) || 0) *
            (Number(item.quantity) || 0),
        0,
      );
      const itemsDiscountSum = cartItems.reduce((sum, item) => {
        const p = Number(item.price || item.unit_price) || 0;
        const q = Number(item.quantity) || 0;
        const d = Number(item.discount_percent || item.discount || 0);
        return sum + (p * q * d) / 100;
      }, 0);
      const subtotalAfterItems = subtotalForDoc - itemsDiscountSum;
      const documentDiscountAmount =
        (subtotalAfterItems * discountPercentNum) / 100;

      // Предоплата по долгу (API: prepayment_amount, только при payment_kind=credit)
      const prepaymentNum = Number(prepaymentAmount) || 0;
      const hasPrepayment =
        isPaymentKindRelevant && paymentKind === "credit" && prepaymentNum > 0;

      // Формируем данные для создания документа через новый API
      const documentData = {
        doc_type: docType,
        ...(isPaymentKindRelevant && { payment_kind: paymentKind }),
        ...(hasPrepayment && {
          prepayment_amount: String(prepaymentNum.toFixed(2)),
        }),
        warehouse_from: warehouse,
        ...(isWarehouseToRequired && { warehouse_to: warehouseTo }),
        ...(isCounterpartyRequired && clientId && { counterparty: clientId }),
        comment: comment || "",
        discount_percent: String(discountPercentNum.toFixed(2)),
        discount_amount: String(documentDiscountAmount.toFixed(2)),
        items: cartItems.map((item) => {
          const unit = item.unit || "шт";
          const isPiece =
            unit.toLowerCase() === "шт" || unit.toLowerCase() === "штук";
          const qty = Number(item.quantity || 1);
          const finalQty = isPiece ? Math.floor(qty) : qty;
          const price = Number(item.price || item.unit_price || 0);
          const itemDiscPct = Math.max(
            0,
            Math.min(100, Number(item.discount_percent || item.discount || 0)),
          );
          const itemDiscAmount = (price * finalQty * itemDiscPct) / 100;
          const lineTotal = price * finalQty - itemDiscAmount;

          return {
            product: item.productId,
            qty: String(finalQty),
            price: String(price.toFixed(2)),
            discount_percent: String(itemDiscPct.toFixed(2)),
            discount_amount: String(itemDiscAmount.toFixed(2)),
            line_total: String(lineTotal.toFixed(2)),
          };
        }),
      };

      let createdDocument;
      try {
        if (editDocumentId) {
          const result = await dispatch(
            updateWarehouseDocument({ id: editDocumentId, documentData }),
          );
          if (!updateWarehouseDocument.fulfilled.match(result)) {
            const errData = result.payload || result.error;
            alert("Ошибка: " + formatApiError(errData));
            return;
          }
          createdDocument = result.payload;
        } else {
          createdDocument = await createDocumentByType(documentData);
        }
      } catch (err) {
        const errData = err?.response?.data || err;
        const errorMessage = formatApiError(errData);
        alert("Ошибка: " + errorMessage);
        return;
      }

      // Если документ должен быть проведен, вызываем POST /documents/{id}/post/
      if (isDocumentPosted) {
        const postResult = await dispatch(
          postWarehouseDocument({
            id: createdDocument.id,
            allowNegative: false,
          }),
        );
        if (!postWarehouseDocument.fulfilled.match(postResult)) {
          const postError = postResult.payload || postResult.error;
          alert(
            "Документ " +
              (editDocumentId ? "обновлен" : "создан") +
              ", но не проведен: " +
              formatApiError(postError),
          );
          navigate(documentsListPath);
          return;
        }
      }

      alert(
        "Документ успешно " +
          (editDocumentId ? "обновлен" : "сохранен") +
          (isDocumentPosted ? " и проведен" : ""),
      );

      // Очищаем локальное состояние
      setCartItems([]);
      setSelectedProductIds(new Set());
      setClientId("");
      setWarehouseTo("");
      setDocumentDiscount("");
      setPrepaymentAmount("");
      setComment("");
      setDocumentSearch("");

      navigate(documentsListPath);
    } catch (error) {
      console.error("Ошибка при сохранении документа:", error);
      alert("Ошибка: " + formatApiError(error?.response?.data || error));
    }
  };

  // Вспомогательная функция для скачивания blob
  const downloadBlob = (blob, filename) => {
    if (typeof window === "undefined" || !window.URL || !window.document) {
      throw new Error("Браузерное окружение недоступно");
    }
    const url = window.URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = filename;
    window.document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  };

  // Сохранение и печать
  const handleSaveAndPrint = async (printType) => {
    // Используем ту же валидацию, что и для handleSave
    const validation = validateDocumentData();
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    try {
      // Сначала создаем документ через новый API
      const discountPercentNum = Number(documentDiscount) || 0;
      const subtotalForDoc = cartItems.reduce(
        (sum, item) =>
          sum +
          (Number(item.price || item.unit_price) || 0) *
            (Number(item.quantity) || 0),
        0,
      );
      const itemsDiscountSum = cartItems.reduce((sum, item) => {
        const p = Number(item.price || item.unit_price) || 0;
        const q = Number(item.quantity) || 0;
        const d = Number(item.discount_percent || item.discount || 0);
        return sum + (p * q * d) / 100;
      }, 0);
      const subtotalAfterItems = subtotalForDoc - itemsDiscountSum;
      const documentDiscountAmount =
        (subtotalAfterItems * discountPercentNum) / 100;

      const prepaymentNum = Number(prepaymentAmount) || 0;
      const hasPrepayment =
        isPaymentKindRelevant && paymentKind === "credit" && prepaymentNum > 0;

      const documentData = {
        doc_type: docType,
        ...(isPaymentKindRelevant && { payment_kind: paymentKind }),
        ...(hasPrepayment && {
          prepayment_amount: String(prepaymentNum.toFixed(2)),
        }),
        warehouse_from: warehouse,
        ...(isWarehouseToRequired && { warehouse_to: warehouseTo }),
        ...(isCounterpartyRequired && clientId && { counterparty: clientId }),
        comment: comment || "",
        discount_percent: String(discountPercentNum.toFixed(2)),
        discount_amount: String(documentDiscountAmount.toFixed(2)),
        items: cartItems.map((item) => {
          const unit = item.unit || "шт";
          const isPiece =
            unit.toLowerCase() === "шт" || unit.toLowerCase() === "штук";
          const qty = Number(item.quantity || 1);
          const finalQty = isPiece ? Math.floor(qty) : qty;
          const price = Number(item.price || item.unit_price || 0);
          const itemDiscPct = Math.max(
            0,
            Math.min(100, Number(item.discount_percent || item.discount || 0)),
          );
          const itemDiscAmount = (price * finalQty * itemDiscPct) / 100;
          const lineTotal = price * finalQty - itemDiscAmount;

          return {
            product: item.productId,
            qty: String(finalQty),
            price: String(price.toFixed(2)),
            discount_percent: String(itemDiscPct.toFixed(2)),
            discount_amount: String(itemDiscAmount.toFixed(2)),
            line_total: String(lineTotal.toFixed(2)),
          };
        }),
      };

      // При редактировании — обновляем документ, иначе создаём через типовой эндпоинт
      let createdDocument;
      try {
        if (editDocumentId) {
          const result = await dispatch(
            updateWarehouseDocument({ id: editDocumentId, documentData }),
          );
          if (!updateWarehouseDocument.fulfilled.match(result)) {
            const errData = result.payload || result.error;
            alert("Ошибка: " + formatApiError(errData));
            return;
          }
          createdDocument = result.payload;
        } else {
          createdDocument = await createDocumentByType(documentData);
        }
      } catch (err) {
        const errData = err?.response?.data || err;
        const errorMessage = formatApiError(errData);
        alert("Ошибка: " + errorMessage);
        return;
      }

      // При сохранении и печати тоже уважаем флаг «Документ проведён»
      if (isDocumentPosted) {
        const postResult = await dispatch(
          postWarehouseDocument({
            id: createdDocument.id,
            allowNegative: false,
          }),
        );
        if (!postWarehouseDocument.fulfilled.match(postResult)) {
          const postError = postResult.payload || postResult.error;
          alert(
            "Документ " +
              (editDocumentId ? "обновлен" : "создан") +
              ", но не проведен: " +
              formatApiError(postError),
          );
          navigate(documentsListPath);
          return;
        }
      }

      // Формируем данные для печати из ответа сервера (createdDocument)
      const doc = createdDocument;
      const docDiscountPercent = Number(doc.discount_percent || 0);
      const docDiscountAmount = Number(doc.discount_amount || 0);

      const items = Array.isArray(doc.items)
        ? doc.items.map((item) => {
            const price = Number(item.price || 0);
            const qty = Number(item.qty || 0);
            const lineTotal = price * qty;
            return {
              id: item.id,
              name:
                item.product_name ??
                item.product?.name ??
                item.name ??
                item.product?.title ??
                "Товар",
              qty: String(qty),
              unit_price: String(price.toFixed(2)),
              total: String(
                Number(item.line_total ?? item.total ?? lineTotal).toFixed(2),
              ),
              unit: item.product?.unit ?? item.unit ?? "ШТ",
              article:
                String(
                  item.product?.article ??
                    item.article ??
                    item.product_article ??
                    "",
                ).trim() || "",
              discount_percent: Number(item.discount_percent || 0),
              discount_amount: Number(item.discount_amount || 0),
              price_before_discount: String(price.toFixed(2)),
            };
          })
        : [];

      const subtotal = items.reduce(
        (sum, item) => sum + Number(item.unit_price) * Number(item.qty),
        0,
      );
      const itemsDiscountTotal = items.reduce(
        (sum, item) =>
          sum +
          (Number(item.unit_price) *
            Number(item.qty) *
            Number(item.discount_percent || 0)) /
            100,
        0,
      );
      const totalDiscount = itemsDiscountTotal + docDiscountAmount;
      const total = Number(doc.total) || subtotal - totalDiscount;

      const docNumber = doc.number || documentId.substring(0, 8) || "00001";
      const currentDate = doc.date
        ? new Date(doc.date)
        : new Date(documentDateValue || undefined);
      const warehouseName =
        doc.warehouse_from_name ??
        warehouses.find((w) => w.id === doc.warehouse_from)?.name ??
        doc.warehouse_from;
      const warehouseToName =
        doc.warehouse_to_name ??
        (doc.warehouse_to
          ? warehouses.find((w) => w.id === doc.warehouse_to)?.name
          : null) ??
        null;
      const selectedCounterparty = filteredCounterparties.find(
        (c) => c.id === (doc.counterparty || clientId),
      );
      const buyerName =
        doc.counterparty_display_name ?? selectedCounterparty?.name ?? "";

      if (printType === "invoice") {
        const invoiceData = {
          doc_type: doc.doc_type || docType,
          document: {
            type: "sale_invoice",
            doc_type: doc.doc_type || docType,
            title: "Накладная",
            id: doc.id,
            number: docNumber,
            date: currentDate.toISOString().split("T")[0],
            datetime: doc.date || currentDate.toISOString(),
            created_at: doc.created_at || currentDate.toISOString(),
            discount_percent: docDiscountPercent,
            discount_amount: docDiscountAmount,
            discount_total: docDiscountAmount,
          },
          seller: {
            id: company?.id || "",
            name: company?.name || "",
            inn: company?.inn || "",
            okpo: company?.okpo || "",
            score: company?.score || "",
            bik: company?.bik || "",
            address: company?.address || "",
            phone: company?.phone || null,
            email: company?.email || null,
          },
          buyer: selectedCounterparty
            ? {
                id: selectedCounterparty.id,
                name: selectedCounterparty.name || buyerName || "",
                inn: selectedCounterparty.inn || "",
                okpo: selectedCounterparty.okpo || "",
                score: selectedCounterparty.score || "",
                bik: selectedCounterparty.bik || "",
                address: selectedCounterparty.address || "",
                phone: selectedCounterparty.phone || null,
                email: selectedCounterparty.email || null,
              }
            : buyerName
              ? {
                  id: "",
                  name: buyerName,
                  inn: "",
                  okpo: "",
                  score: "",
                  bik: "",
                  address: "",
                  phone: null,
                  email: null,
                }
              : null,
          items,
          totals: {
            subtotal: String(subtotal.toFixed(2)),
            discount_total: String(totalDiscount.toFixed(2)),
            tax_total: "0.00",
            total: String(total.toFixed(2)),
          },
          warehouse: warehouseName,
          warehouse_to: warehouseToName,
        };

        // Генерируем PDF накладной
        const blob = await pdf(
          <InvoicePdfDocument data={invoiceData} />,
        ).toBlob();
        downloadBlob(blob, `invoice_${docNumber}.pdf`);
      } else if (printType === "receipt") {
        const receiptData = {
          document: {
            type: "receipt",
            title: "Товарный чек",
            id: doc.id,
            number: docNumber,
            doc_no: docNumber,
            date: currentDate.toISOString().split("T")[0],
            created_at: doc.created_at || currentDate.toISOString(),
          },
          company: {
            id: company?.id || "",
            name: company?.name || "",
            address: company?.address || "",
            phone: company?.phone || null,
          },
          cashier: {
            id: userProfile?.id || "",
            name: userProfile?.full_name || userProfile?.name || "",
          },
          client: selectedCounterparty
            ? {
                id: selectedCounterparty.id,
                full_name: selectedCounterparty.name || buyerName || "",
              }
            : buyerName
              ? { id: "", full_name: buyerName }
              : null,
          items,
          totals: {
            subtotal: String(subtotal.toFixed(2)),
            discount_total: String(totalDiscount.toFixed(2)),
            tax_total: "0.00",
            total: String(total.toFixed(2)),
          },
          payment: {
            method: paymentKind,
            cash_received: String(total.toFixed(2)),
            change: "0.00",
            paid_at: doc.date || currentDate.toISOString(),
            is_credit: paymentKind === "credit",
          },
          warehouse: warehouseName,
        };

        // Генерируем PDF чека
        const blob = await pdf(
          <ReceiptPdfDocument data={receiptData} />,
        ).toBlob();
        downloadBlob(blob, `receipt_${docNumber}.pdf`);
      }

      // Очищаем корзину после успешного скачивания PDF
      setCartItems([]);

      // Сбрасываем локальное состояние
      setSelectedProductIds(new Set());
      setClientId("");
      setDocumentDiscount("");
      setPrepaymentAmount("");
      setComment("");
      setDocumentSearch("");

      navigate(documentsListPath);
    } catch (error) {
      console.error("Ошибка генерации PDF:", error);
      // Если это ошибка API, используем formatApiError, иначе обычное сообщение
      const errorMessage =
        error?.response?.data || error?.payload || error?.error
          ? formatApiError(
              error?.response?.data || error?.payload || error?.error,
            )
          : error?.message || "Не удалось сгенерировать PDF";
      alert("Ошибка: " + errorMessage);
    }
  };

  const formatPrice = (price) => {
    return Number(price || 0).toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  if (loadingDraft) {
    return (
      <div className="create-sale-document">
        <div className="create-sale-document__container create-sale-document__container--loading">
          <div className="create-sale-document__draft-loading">
            Загрузка документа...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="create-sale-document">
      <div className="create-sale-document__container">
        {/* Левая панель — каталог товаров */}
        <div className="create-sale-document__sidebar">
          <h2 className="create-sale-document__sidebar-title">
            КАТАЛОГ ТОВАРОВ
            {cartItems.length > 0 && (
              <span className="create-sale-document__selected-count">
                {cartItems.length}
              </span>
            )}
          </h2>
          <div className="create-sale-document__search-wrapper">
            <div className="create-sale-document__search">
              <Search size={18} className="create-sale-document__search-icon" />
              <input
                type="text"
                placeholder="Поиск..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="create-sale-document__groups">
            <div className="create-sale-document__group-tree">
              {(() => {
                const key = "all";
                const isExpanded = expandedGroupIds.has(key);
                const entry = groupProducts?.[key];
                const isStale =
                  (entry?.search || "") !== (debouncedProductSearch || "");
                const notLoaded = !Array.isArray(entry?.items);
                return (
                  <div className="create-sale-document__group-node">
                    <div
                      className={`create-sale-document__group-item ${
                        isExpanded ? "is-open" : ""
                      }`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setActiveGroupKeyForKeyboard(key);
                        toggleGroupExpand(key);
                        if (!isExpanded && (notLoaded || isStale)) {
                          loadProductsForGroup(key, null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setActiveGroupKeyForKeyboard(key);
                          toggleGroupExpand(key);
                          if (!isExpanded && (notLoaded || isStale)) {
                            loadProductsForGroup(key, null);
                          }
                        }
                      }}
                      title="Товары без группы"
                    >
                      <span className="create-sale-document__group-expander">
                        <ChevronDown
                          size={14}
                          style={{
                            transform: isExpanded
                              ? "rotate(0deg)"
                              : "rotate(-90deg)",
                          }}
                        />
                      </span>
                      <span className="create-sale-document__group-icon">
                        {isExpanded ? (
                          <FolderOpen size={16} />
                        ) : (
                          <Folder size={16} />
                        )}
                      </span>
                      <span className="create-sale-document__group-name">
                        Все товары
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="create-sale-document__group-body">
                        <div className="create-sale-document__group-products">
                          {entry?.loading ? (
                            <div className="create-sale-document__group-products-empty">
                              Загрузка…
                            </div>
                          ) : entry?.error ? (
                            <div className="create-sale-document__group-products-empty">
                              Не удалось загрузить товары
                            </div>
                          ) : getUngroupedProducts(entry?.items).length ===
                            0 ? (
                            <div className="create-sale-document__group-products-empty">
                              Нет товаров
                            </div>
                          ) : (
                            (() => {
                              const visibleProducts = sortProductsByDate(
                                getUngroupedProducts(entry?.items),
                              );
                              const currentIndex =
                                typeof groupKeyboardIndexMap[key] === "number"
                                  ? groupKeyboardIndexMap[key]
                                  : 0;

                              return (
                                <div
                                  role="listbox"
                                  className="create-sale-document__group-products-list"
                                  tabIndex={0}
                                  ref={(el) => {
                                    if (el) productListRefs.current[key] = el;
                                  }}
                                  onFocus={() => {
                                    setActiveGroupKeyForKeyboard(key);
                                    setGroupKeyboardIndexMap((prev) => ({
                                      ...(prev || {}),
                                      [key]:
                                        typeof prev?.[key] === "number"
                                          ? prev[key]
                                          : 0,
                                    }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.defaultPrevented) return;
                                    if (!visibleProducts.length) return;
                                    if (e.key === "ArrowDown") {
                                      e.preventDefault();
                                      const nextIndex =
                                        currentIndex >=
                                        visibleProducts.length - 1
                                          ? 0
                                          : currentIndex + 1;
                                      setActiveGroupKeyForKeyboard(key);
                                      setGroupKeyboardIndexMap((prev) => ({
                                        ...(prev || {}),
                                        [key]: nextIndex,
                                      }));
                                    } else if (e.key === "ArrowUp") {
                                      e.preventDefault();
                                      const nextIndex =
                                        currentIndex <= 0
                                          ? visibleProducts.length - 1
                                          : currentIndex - 1;
                                      setActiveGroupKeyForKeyboard(key);
                                      setGroupKeyboardIndexMap((prev) => ({
                                        ...(prev || {}),
                                        [key]: nextIndex,
                                      }));
                                    } else if (e.key === "Enter") {
                                      e.preventDefault();
                                      const selectedByKeyboard =
                                        visibleProducts[currentIndex] ||
                                        visibleProducts[0];
                                      if (selectedByKeyboard) {
                                        openProductSelectModal(
                                          selectedByKeyboard,
                                        );
                                      }
                                    }
                                  }}
                                >
                                  {visibleProducts.map((product, index) => {
                                    const isSelected = selectedProductIds.has(
                                      String(product.id),
                                    );
                                    const isInCart = cartItems.some(
                                      (item) =>
                                        String(item.productId) ===
                                        String(product.id),
                                    );
                                    const isKeyboardActive =
                                      activeGroupKeyForKeyboard === key &&
                                      currentIndex === index;
                                    return (
                                      <div
                                        key={product.id}
                                        className={`create-sale-document__group-product-item ${
                                          isSelected || isInCart ? "active" : ""
                                        } ${isKeyboardActive ? "active" : ""}`}
                                        onMouseEnter={() => {
                                          setActiveGroupKeyForKeyboard(key);
                                          setGroupKeyboardIndexMap((prev) => ({
                                            ...(prev || {}),
                                            [key]: index,
                                          }));
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAddProduct(product);
                                        }}
                                      >
                                        <div className="create-sale-document__group-product-main">
                                          <FullNamePopover
                                            fullText={product.name}
                                            className="create-sale-document__group-product-name"
                                          >
                                            {product.name}
                                          </FullNamePopover>
                                          <div className="create-sale-document__group-product-meta">
                                            <span className="create-sale-document__group-product-price">
                                              {formatPrice(
                                                getProductPriceForDocument(
                                                  product,
                                                ),
                                              )}{" "}
                                              сом
                                            </span>
                                            <span className="create-sale-document__group-product-stock">
                                              {product.quantity ?? 0}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {groupsLoading ? (
              <div className="create-sale-document__groups-empty">
                Загрузка…
              </div>
            ) : groupsError ? (
              <div className="create-sale-document__groups-empty">
                Не удалось загрузить группы
              </div>
            ) : groups.length === 0 ? (
              <div className="create-sale-document__groups-empty">
                Групп нет
              </div>
            ) : (
              <div className="create-sale-document__group-tree">
                {renderGroupTree(null, 0)}
              </div>
            )}
          </div>

          <button
            type="button"
            className="create-sale-document__create-product-btn"
            onClick={() =>
              navigate(
                `/crm/warehouse/stocks/add-product${warehouse ? `?warehouse_id=${warehouse}` : ""}`,
                {
                  state: {
                    returnTo: "create-document",
                    docType,
                    warehouse: warehouse || undefined,
                  },
                },
              )
            }
          >
            <Plus size={18} />
            Создать товар
          </button>
        </div>

        {/* Основная область */}
        <div className="create-sale-document__main">
          <div className="create-sale-document__header">
            <div className="create-sale-document__header-left">
              <button
                type="button"
                className="create-sale-document__back-btn"
                onClick={() => {
                  if (cartItems.length === 0) {
                    navigate(documentsListPath);
                  } else {
                    setShowExitModal(true);
                  }
                }}
                aria-label="Назад к списку документов"
              >
                <ArrowLeft size={20} />
                Назад
              </button>
              <div className="create-sale-document__header-titles">
                <h1 className="create-sale-document__doc-title">
                  {docType === "SALE" && "Продажа"}
                  {docType === "PURCHASE" && "Покупка"}
                  {docType === "SALE_RETURN" && "Возврат продажи"}
                  {docType === "PURCHASE_RETURN" && "Возврат покупки"}
                  {docType === "INVENTORY" && "Инвентаризация"}
                  {docType === "RECEIPT" && "Приход"}
                  {docType === "WRITE_OFF" && "Списание"}
                  {docType === "TRANSFER" && "Перемещение"}
                  {!docType && "Документ"}{" "}
                  {documentId ? `#${documentId.slice(4, 12)}` : ""}
                </h1>
                <p className="create-sale-document__doc-subtitle">
                  Создание документа продажи
                </p>
              </div>
              <div className="create-sale-document__header-meta">
                <div
                  className="create-sale-document__date"
                  onClick={() => {
                    const input = dateInputRef.current;
                    if (input) input.showPicker?.() || input.click();
                  }}
                >
                  <Calendar size={18} />
                  {displayDate}
                </div>
                <label className="create-sale-document__toggle">
                  <input
                    type="checkbox"
                    className="create-sale-document__toggle-input"
                    checked={isDocumentPosted}
                    onChange={(e) => setIsDocumentPosted(e.target.checked)}
                  />
                  <span className="create-sale-document__toggle-track">
                    <span className="create-sale-document__toggle-thumb">
                      <Check size={14} strokeWidth={2.5} />
                    </span>
                  </span>
                  <span className="create-sale-document__toggle-label">
                    Документ проведён
                  </span>
                </label>
                {isPaymentKindRelevant && (
                  <div className="create-sale-document__payment-kind create-sale-document__payment-kind--header">
                    <label className="create-sale-document__payment-option">
                      <input
                        type="radio"
                        name="payment_kind"
                        value="cash"
                        checked={paymentKind === "cash"}
                        onChange={() => {
                          setPaymentKind("cash");
                          setPrepaymentAmount("");
                        }}
                      />
                      <span>Сразу</span>
                    </label>
                    <label className="create-sale-document__payment-option">
                      <input
                        type="radio"
                        name="payment_kind"
                        value="credit"
                        checked={paymentKind === "credit"}
                        onChange={() => setShowPrepaymentModal(true)}
                      />
                      <span>В долг</span>
                    </label>
                    {paymentKind === "credit" && (
                      <div className="create-sale-document__prepayment-badge">
                        <span className="create-sale-document__prepayment-badge-label">
                          Предоплата:{" "}
                          {prepaymentAmount
                            ? `${formatPrice(Number(prepaymentAmount) || 0)} сом`
                            : "0 сом"}
                        </span>
                        <button
                          type="button"
                          className="create-sale-document__prepayment-badge-btn"
                          onClick={() => setShowPrepaymentModal(true)}
                        >
                          Изменить
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <input
                ref={dateInputRef}
                type="date"
                id="document-date-picker"
                className="create-sale-document__date-input"
                value={documentDateValue}
                onChange={(e) => setDocumentDateValue(e.target.value)}
                aria-hidden
              />
            </div>
            <div className="create-sale-document__header-actions">
              <button
                type="button"
                className="create-sale-document__save-btn"
                onClick={handleSave}
              >
                <Save size={18} />
                Сохранить
              </button>
              <div className="create-sale-document__save-print-wrapper">
                <button
                  type="button"
                  className="create-sale-document__save-print-btn"
                  onClick={() => setShowSavePrintMenu(!showSavePrintMenu)}
                >
                  <Printer size={18} />
                  Печать
                  <ChevronDown size={16} />
                </button>
                {showSavePrintMenu && (
                  <div className="create-sale-document__save-print-menu">
                    <button onClick={() => handleSaveAndPrint("invoice")}>
                      Накладная
                    </button>
                    <button onClick={() => handleSaveAndPrint("receipt")}>
                      Товарный чек
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="create-sale-document__content">
            <div className="create-sale-document__fields">
              <div className="create-sale-document__field create-sale-document__field--with-icon">
                <Package
                  size={18}
                  className="create-sale-document__field-icon"
                />
                <div className="create-sale-document__field-inner">
                  <label>
                    Склад {isWarehouseToRequired ? "отправитель" : ""} *
                  </label>
                  <SearchSelect
                    value={warehouse}
                    onChange={(v) => setWarehouse(String(v || ""))}
                    options={
                      isWarehouseToRequired && warehouseTo
                        ? warehouseOptions.filter(
                            (o) => String(o.value) !== String(warehouseTo),
                          )
                        : warehouseOptions
                    }
                    placeholder="Выберите склад"
                  />
                </div>
              </div>
              {isWarehouseToRequired && (
                <div className="create-sale-document__field">
                  <label>Склад получатель *</label>
                  <SearchSelect
                    value={warehouseTo}
                    onChange={(v) => setWarehouseTo(String(v || ""))}
                    options={warehouseToOptions}
                    placeholder="Выберите склад получатель"
                  />
                </div>
              )}
              {isCounterpartyRequired && (
                <>
                  <div className="create-sale-document__field create-sale-document__field--with-icon">
                    <User
                      size={18}
                      className="create-sale-document__field-icon"
                    />
                    <div className="create-sale-document__field-inner">
                      <label>Агент</label>
                      <SearchSelect
                        value={agentId}
                        onChange={(v) => setAgentId(String(v || ""))}
                        options={[
                          {
                            value: "",
                            label: "Все агенты",
                            searchText: "Все агенты",
                          },
                          ...agentOptions,
                        ]}
                        placeholder="Выберите агента (необязательно)"
                        emptyText="Агенты не найдены"
                      />
                    </div>
                  </div>
                  <div className="create-sale-document__field create-sale-document__field--with-icon">
                    <User
                      size={18}
                      className="create-sale-document__field-icon"
                    />
                    <div className="create-sale-document__field-inner">
                      <label>Контрагент *</label>
                      <SearchSelect
                        value={clientId}
                        onChange={(v) => setClientId(String(v || ""))}
                        options={counterpartyOptions}
                        placeholder={
                          docType === "SALE" || docType === "SALE_RETURN"
                            ? "Выберите клиента"
                            : "Выберите поставщика"
                        }
                        emptyText="Контрагенты не найдены"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <h3 className="create-sale-document__section-title">
              Товары в документе
            </h3>
            <div className="create-sale-document__document-search">
              <Search size={18} />
              <input
                type="text"
                placeholder="Поиск по товарам..."
                value={documentSearch}
                onChange={(e) => setDocumentSearch(e.target.value)}
              />
            </div>
            {docType === "INVENTORY" && (
              <p className="create-sale-document__inventory-hint">
                Для инвентаризации укажите <strong>фактический остаток</strong>{" "}
                по каждой позиции; при проведении будет создано движение на
                разницу с текущим остатком.
              </p>
            )}
            <div className="create-sale-document__table-wrapper">
              <table className="create-sale-document__table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>НАИМЕНОВАНИЕ</th>
                    <th>ЕД. ИЗМ.</th>
                    <th>
                      {docType === "INVENTORY" ? "ФАКТ. ОСТАТОК" : "КОЛ-ВО"}
                    </th>
                    <th>ЦЕНА</th>
                    <th>СКИДКА %</th>
                    <th>СУММА</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocumentItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="create-sale-document__empty-table"
                      >
                        Нет товаров в документе
                      </td>
                    </tr>
                  ) : (
                    filteredDocumentItems.map((item, index) => {
                      const itemName = item.productName || item.name || "Товар";
                      const itemPrice = Number(
                        item.price || item.unit_price || 0,
                      );
                      const itemQuantity = Number(item.quantity);
                      const itemDiscount = Number(
                        item.discount_percent ?? item.discount ?? 0,
                      );
                      const itemTotal =
                        itemPrice * itemQuantity * (1 - itemDiscount / 100);

                      return (
                        <tr key={item.id || index}>
                          <td>{index + 1}</td>
                          <td title={itemName}>{itemName}</td>
                          <td>{(item.unit || "шт").toUpperCase()}</td>
                          <td>
                            <input
                              type="text"
                              min="0"
                              value={itemQuantity}
                              onChange={(e) =>
                                handleQuantityChange(item.id, e.target.value)
                              }
                              className="create-sale-document__qty-input"
                              title={
                                isStockLimitRequired &&
                                item.stock != null &&
                                item.stock > 0
                                  ? `Остаток на складе: ${item.stock}`
                                  : undefined
                              }
                              placeholder={
                                isStockLimitRequired &&
                                item.stock != null &&
                                item.stock > 0
                                  ? `макс. ${item.stock}`
                                  : undefined
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={itemPrice}
                              onChange={(e) =>
                                handlePriceChange(item.id, e.target.value)
                              }
                              className="create-sale-document__price-input"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={itemDiscount}
                              onChange={(e) =>
                                handleDiscountChange(item.id, e.target.value)
                              }
                              className="create-sale-document__discount-cell-input"
                            />
                          </td>
                          <td className="create-sale-document__cell-sum">
                            {formatPrice(itemTotal)} сом
                          </td>
                          <td>
                            <button
                              type="button"
                              className="create-sale-document__remove-btn"
                              onClick={() => handleRemoveProduct(item.id)}
                              aria-label="Удалить"
                            >
                              <X size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="create-sale-document__content-grid">
              <div className="create-sale-document__content-main">
                <div className="create-sale-document__comment-section">
                  <label className="create-sale-document__comment-label">
                    Комментарий
                  </label>
                  <textarea
                    className="create-sale-document__comment-textarea"
                    placeholder="Добавить комментарий к документу..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <aside className="create-sale-document__summary">
                <h3 className="create-sale-document__summary-title">
                  ИТОГОВАЯ ИНФОРМАЦИЯ
                </h3>
                <div className="create-sale-document__summary-row">
                  <span>Всего товаров:</span>
                  <span>
                    {cartItems.reduce(
                      (acc, it) => acc + Number(it.quantity || 0),
                      0,
                    )}{" "}
                    шт
                  </span>
                </div>
                <div className="create-sale-document__summary-row">
                  <span>Подытог:</span>
                  <span>{formatPrice(totals.subtotal)} сом</span>
                </div>
                <div className="create-sale-document__summary-row create-sale-document__summary-row--discount">
                  <span>Скидка документа:</span>
                  <div className="create-sale-document__discount-input-wrapper">
                    <input
                      type="text"
                      min="0"
                      max="100"
                      value={documentDiscount}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "") setDocumentDiscount("");
                        else {
                          const numValue = Number(value);
                          if (
                            !isNaN(numValue) &&
                            numValue >= 0 &&
                            numValue <= 100
                          )
                            setDocumentDiscount(value);
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (
                          value === "" ||
                          value === null ||
                          isNaN(Number(value))
                        ) {
                          setDocumentDiscount("0");
                        } else {
                          const numValue = Number(value);
                          if (numValue < 0) setDocumentDiscount("0");
                          else if (numValue > 100) setDocumentDiscount("100");
                          else setDocumentDiscount(String(numValue));
                        }
                      }}
                      className="create-sale-document__discount-input"
                    />
                    <span>%</span>
                  </div>
                </div>
                <div className="create-sale-document__summary-row create-sale-document__summary-row--total">
                  <span>Итого:</span>
                  <span>{formatPrice(totals.displayTotal)} сом</span>
                </div>
                {isPaymentKindRelevant && paymentKind === "credit" && (
                  <div className="create-sale-document__summary-row">
                    <span>Предоплата:</span>
                    <span>{formatPrice(totals.prepayment)} сом</span>
                  </div>
                )}
                <div className="create-sale-document__summary-row">
                  <span>Оплачено:</span>
                  <span>{formatPrice(totals.paid)} сом</span>
                </div>
                <div className="create-sale-document__summary-row create-sale-document__summary-row--due">
                  <span>К оплате:</span>
                  <span>
                    {formatPrice(totals.displayTotal - totals.paid)} сом
                  </span>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>

      {/* Модальное окно при выходе с несохранёнными товарами */}
      {showExitModal && (
        <div
          className="create-sale-document__prepayment-overlay"
          onClick={() => setShowExitModal(false)}
        >
          <div
            className="create-sale-document__prepayment-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="create-sale-document__prepayment-modal-header">
              <h2 className="create-sale-document__prepayment-modal-title">
                В документе есть добавленные товары
              </h2>
              <button
                type="button"
                className="create-sale-document__prepayment-modal-close"
                onClick={() => setShowExitModal(false)}
                aria-label="Закрыть"
              >
                <X size={20} />
              </button>
            </div>
            <div className="create-sale-document__prepayment-modal-content">
              <p className="create-sale-document__prepayment-modal-hint">
                Выберите: выйти без сохранения или сохранить документ как
                черновик и выйти.
              </p>
            </div>
            <div className="create-sale-document__prepayment-modal-actions">
              <button
                type="button"
                className="create-sale-document__prepayment-modal-cancel"
                onClick={() => {
                  setShowExitModal(false);
                  navigate(documentsListPath);
                }}
              >
                Выйти без сохранения
              </button>
              <button
                type="button"
                className="create-sale-document__prepayment-modal-save"
                onClick={() => {
                  setShowExitModal(false);
                  handleSave();
                }}
              >
                Сохранить как черновик
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно выбора количества для товара (выбор по Enter) */}
      {showProductSelectModal && productSelectModalProduct && (
        <div
          className="create-sale-document__prepayment-overlay"
          onClick={closeProductSelectModal}
        >
          <div
            className="create-sale-document__prepayment-modal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                closeProductSelectModal();
              } else if (e.key === "Enter") {
                e.preventDefault();
                handleConfirmProductSelect();
              }
            }}
            tabIndex={-1}
          >
            <div className="create-sale-document__prepayment-modal-header">
              <h2 className="create-sale-document__prepayment-modal-title">
                Добавить товар
              </h2>
              <button
                type="button"
                className="create-sale-document__prepayment-modal-close"
                onClick={closeProductSelectModal}
                aria-label="Закрыть"
              >
                <X size={20} />
              </button>
            </div>
            <div className="create-sale-document__prepayment-modal-content">
              <input
                ref={productSelectQtyInputRef}
                type="text"
                inputMode="decimal"
                className="create-sale-document__prepayment-modal-input"
                placeholder="1"
                value={productSelectModalQty}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    setProductSelectModalQty("");
                  } else {
                    const num = Number(v.replace(",", "."));
                    if (!isNaN(num) && num >= 0) setProductSelectModalQty(v);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleConfirmProductSelect();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    closeProductSelectModal();
                  }
                }}
              />
            </div>
            <div className="create-sale-document__prepayment-modal-actions">
              <button
                type="button"
                className="create-sale-document__prepayment-modal-cancel"
                onClick={closeProductSelectModal}
              >
                Отмена
              </button>
              <button
                type="button"
                className="create-sale-document__prepayment-modal-save"
                onClick={handleConfirmProductSelect}
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно предоплаты (при выборе «В долг») */}
      {showPrepaymentModal && (
        <div
          className="create-sale-document__prepayment-overlay"
          onClick={() => setShowPrepaymentModal(false)}
        >
          <div
            className="create-sale-document__prepayment-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="create-sale-document__prepayment-modal-header">
              <h2 className="create-sale-document__prepayment-modal-title">
                Предоплата по документу
              </h2>
              <button
                type="button"
                className="create-sale-document__prepayment-modal-close"
                onClick={() => setShowPrepaymentModal(false)}
                aria-label="Закрыть"
              >
                <X size={20} />
              </button>
            </div>
            <div className="create-sale-document__prepayment-modal-content">
              <p className="create-sale-document__prepayment-modal-hint">
                Укажите сумму предоплаты. При проведении документа будет создан
                приход денег на эту сумму.
              </p>
              <label className="create-sale-document__prepayment-modal-label">
                Сумма предоплаты, сом
              </label>
              <input
                type="text"
                inputMode="decimal"
                className="create-sale-document__prepayment-modal-input"
                placeholder="0"
                value={modalPrepaymentValue}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    setModalPrepaymentValue("");
                  } else {
                    const num = Number(v.replace(",", "."));
                    if (!isNaN(num) && num >= 0) setModalPrepaymentValue(v);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const num = Number(
                      String(modalPrepaymentValue).replace(",", "."),
                    );
                    if (!isNaN(num) && num >= 0) {
                      setPrepaymentAmount(num.toFixed(2));
                      setPaymentKind("credit");
                      setShowPrepaymentModal(false);
                    }
                  }
                }}
              />
            </div>
            <div className="create-sale-document__prepayment-modal-actions">
              <button
                type="button"
                className="create-sale-document__prepayment-modal-cancel"
                onClick={() => setShowPrepaymentModal(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="create-sale-document__prepayment-modal-save"
                onClick={() => {
                  const num = Number(
                    String(modalPrepaymentValue).replace(",", "."),
                  );
                  if (!isNaN(num) && num >= 0) {
                    setPrepaymentAmount(num.toFixed(2));
                    setPaymentKind("credit");
                  }
                  setShowPrepaymentModal(false);
                }}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateSaleDocument;
