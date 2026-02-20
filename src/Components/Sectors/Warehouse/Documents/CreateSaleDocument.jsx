import React, { useState, useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
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
} from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import ReceiptPdfDocument from "./components/ReceiptPdfDocument";
import InvoicePdfDocument from "./components/InvoicePdfDocument";
import {
  fetchWarehouseCounterparties,
  fetchWarehouses,
  postWarehouseDocument,
} from "../../../../store/creators/warehouseThunk";
import { fetchProductsAsync } from "../../../../store/creators/productCreators";
import warehouseAPI from "../../../../api/warehouse";
import { useCash } from "../../../../store/slices/cashSlice";
import { useCounterparty } from "../../../../store/slices/counterpartySlice";
import { useUser } from "../../../../store/slices/userSlice";
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

const CreateSaleDocument = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { company, profile: userProfile } = useUser();
  const { list: cashBoxes } = useCash();
  const { list: counterparties } = useCounterparty();
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
  const [docType, setDocType] = useState(initialDocType);
  const [activeTab, setActiveTab] = useState("products");
  const [documentSearch, setDocumentSearch] = useState("");
  const [isDocumentPosted, setIsDocumentPosted] = useState(false);
  const [isOrder, setIsOrder] = useState(false);
  const [documentDateValue, setDocumentDateValue] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [showSavePrintMenu, setShowSavePrintMenu] = useState(false);
  const dateInputRef = useRef(null);
  const [documentDiscount, setDocumentDiscount] = useState("");
  const [comment, setComment] = useState("");
  const [paymentKind, setPaymentKind] = useState("cash"); // cash — сразу, credit — в долг (API: payment_kind)
  const [cartItems, setCartItems] = useState([]);
  const [documentId] = useState(
    () => `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );

  const debounceTimerRef = useRef(null);
  const warehouseRef = useRef(warehouse);

  useEffect(() => {
    warehouseRef.current = warehouse;
  }, [warehouse]);

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
    documentDateValue ? new Date(documentDateValue).toISOString() : null
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
        String(a?.name || "").localeCompare(String(b?.name || ""))
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
      const cachedCount = Array.isArray(cached?.items) ? cached.items.length : 0;
      const count =
        g?.products_count !== undefined && g?.products_count !== null
          ? Number(g.products_count) || 0
          : cachedCount;

      return (
        <div key={gKey} className="create-sale-document__group-node">
          <div
            className={`create-sale-document__group-item ${isExpanded ? "is-open" : ""}`}
            style={{ paddingLeft: 10 + depth * 14 }}
            role="button"
            tabIndex={0}
            onClick={() => {
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
            <span className="create-sale-document__group-name">{g?.name || "—"}</span>
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
                ) : Array.isArray(cached?.items) && cached.items.length === 0 ? (
                  <div className="create-sale-document__group-products-empty">
                    Нет товаров
                  </div>
                ) : (
                  (cached?.items || []).map((product) => {
                    const isSelected = selectedProductIds.has(String(product.id));
                    const isInCart = cartItems.some(
                      (item) => String(item.productId) === String(product.id)
                    );
                    return (
                      <div
                        key={product.id}
                        className={`create-sale-document__group-product-item ${
                          isSelected || isInCart ? "active" : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddProduct(product);
                        }}
                      >
                        <div className="create-sale-document__group-product-main">
                          <div className="create-sale-document__group-product-name">
                            {product.name}
                          </div>
                          <div className="create-sale-document__group-product-meta">
                            <span className="create-sale-document__group-product-price">
                              {formatPrice(
                                getProductPriceForDocument(product)
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
                  })
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

  // Автоматически выбираем первый склад по умолчанию
  useEffect(() => {
    // Если склад уже выбран, не меняем его
    if (warehouse) return;

    // Сначала пробуем выбрать из warehouses
    if (warehouses.length > 0) {
      const firstWarehouse = warehouses[0];
      setWarehouse(firstWarehouse.id || firstWarehouse.uuid || "");
      return;
    }
  }, [warehouses, warehouse]);

  // Цена для подстановки в позицию: при покупке — закупочная, при продаже — цена продажи
  const getProductPriceForDocument = (product) => {
    if (!product) return 0;
    const isPurchase =
      docType === "PURCHASE" || docType === "PURCHASE_RETURN";
    return Number(
      isPurchase
        ? product.purchase_price ?? product.price ?? 0
        : product.price ?? 0
    );
  };

  // Ограничение по остатку только для операций отгрузки (продажа, возврат поставщику, списание, перемещение).
  const isStockLimitRequired = useMemo(() => {
    return ["SALE", "PURCHASE_RETURN", "WRITE_OFF", "TRANSFER"].includes(
      docType
    );
  }, [docType]);

  // При смене склада удаляем из корзины товары, которых нет на новом складе
  useEffect(() => {
    if (!warehouse || !cartItems.length) return;

    let cancelled = false;
    (async () => {
      try {
        const result = await dispatch(
          fetchProductsAsync({ warehouse, page_size: 1000 })
        );
        if (cancelled) return;
        if (fetchProductsAsync.fulfilled.match(result)) {
          const list =
            result.payload?.results ||
            (Array.isArray(result.payload) ? result.payload : []);
          const productById = new Map(
            list.map((p) => [String(p.id), { id: p.id, quantity: p.quantity }])
          );
          setCartItems((prev) => {
            const filtered = prev.filter((item) =>
              productById.has(String(item.productId ?? item.product_id))
            );
            return filtered.map((item) => {
              const p = productById.get(
                String(item.productId ?? item.product_id)
              );
              const stock = Number(p?.quantity ?? 0);
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
  }, [warehouse, isStockLimitRequired]);

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

  // Определяем, требуется ли контрагент для текущего типа документа
  const isCounterpartyRequired = useMemo(() => {
    return ["SALE", "SALE_RETURN", "PURCHASE", "PURCHASE_RETURN"].includes(
      docType
    );
  }, [docType]);

  // payment_kind (оплата сразу / в долг) только для SALE, PURCHASE, SALE_RETURN, PURCHASE_RETURN
  const isPaymentKindRelevant = useMemo(() => {
    return ["SALE", "PURCHASE", "SALE_RETURN", "PURCHASE_RETURN"].includes(
      docType
    );
  }, [docType]);

  // Определяем, требуется ли второй склад (для TRANSFER)
  const isWarehouseToRequired = useMemo(() => {
    return docType === "TRANSFER";
  }, [docType]);

  // Фильтрация товаров в документе
  const filteredDocumentItems = useMemo(() => {
    if (!cartItems || cartItems.length === 0) return [];
    const search = documentSearch.toLowerCase();
    return cartItems.filter((item) => {
      const name = item.productName || item.name || "";
      return name.toLowerCase().includes(search);
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
      0
    );

    // Скидка по позициям (сумма всех скидок на товары)
    const itemsDiscount = items.reduce((sum, item) => {
      const itemPrice = Number(item.price || item.unit_price || 0);
      const itemQty = Number(item.quantity || 0);
      const itemDiscountPercent = Number(
        item.discount_percent || item.discount || 0
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

    // Итоговая сумма с учетом всех скидок (в черновике показываем 0 до проведения)
    const total = subtotalAfterItemsDiscount - documentDiscountAmount;
    const paid = isDocumentPosted ? total : 0;
    const displayTotal = isDocumentPosted ? total : 0;

    return {
      subtotal,
      itemsDiscount,
      documentDiscount: documentDiscountAmount,
      totalDiscount,
      total,
      displayTotal,
      paid,
      taxes: 0,
    };
  }, [cartItems, documentDiscount, isDocumentPosted]);

  // Добавление товара в корзину
  const handleAddProduct = async (productOrId) => {
    if (addingProduct) return; // Предотвращаем множественные клики

    setAddingProduct(true);
    try {
      const product =
        typeof productOrId === "object" && productOrId
          ? productOrId
          : null;

      if (!product?.id) {
        alert("Товар не найден");
        return;
      }

      // Проверяем, есть ли уже этот товар в корзине
      const existingItemIndex = cartItems.findIndex(
        (item) => String(item.productId) === String(product.id)
      );

      const stock = Number(product.quantity ?? 0);

      if (existingItemIndex >= 0) {
        const existing = cartItems[existingItemIndex];
        const currentQty = Number(existing.quantity || 0);
        const maxQty = Number(existing.stock ?? stock);
        if (
          isStockLimitRequired &&
          maxQty > 0 &&
          currentQty >= maxQty
        ) {
          alert(`Нельзя добавить больше остатка. Остаток: ${maxQty}`);
          return;
        }
        setCartItems((prev) => {
          const updated = [...prev];
          updated[existingItemIndex] = {
            ...updated[existingItemIndex],
            quantity: updated[existingItemIndex].quantity + 1,
            stock: maxQty,
          };
          return updated;
        });
      } else {
        if (isStockLimitRequired && stock < 1) {
          alert("Нет остатка на складе");
          return;
        }
        const priceForDoc = getProductPriceForDocument(product);
        const newItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          productId: product.id,
          productName: product.name,
          name: product.name,
          price: priceForDoc,
          unit_price: priceForDoc,
          quantity: 1,
          stock,
          unit: product.unit || "шт",
          discount: 0,
          discount_percent: 0,
          article: product.article || "",
        };
        setCartItems((prev) => [...prev, newItem]);
      }

      // Добавляем товар в список выбранных
      setSelectedProductIds((prev) => new Set([...prev, String(product.id)]));
    } catch (error) {
      console.error("Ошибка при добавлении товара:", error);
      alert("Ошибка при добавлении товара");
    } finally {
      setAddingProduct(false);
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
    if (
      isStockLimitRequired &&
      maxQty > 0 &&
      finalQty > maxQty
    ) {
      finalQty = maxQty;
    }
    setCartItems((prev) =>
      prev.map((i) =>
        i.id === itemId ? { ...i, quantity: finalQty } : i
      )
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
        item.id === itemId ? { ...item, price: num, unit_price: num } : item
      )
    );
  };

  // Изменение скидки по позиции в таблице
  const handleDiscountChange = (itemId, newDiscount) => {
    const num = Math.max(0, Math.min(100, Number(newDiscount) || 0));
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, discount_percent: num, discount: num }
          : item
      )
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
        item.discount_percent || item.discount || 0
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
          (Number(item.price || item.unit_price) || 0) * (Number(item.quantity) || 0),
        0
      );
      const itemsDiscountSum = cartItems.reduce(
        (sum, item) => {
          const p = Number(item.price || item.unit_price) || 0;
          const q = Number(item.quantity) || 0;
          const d = Number(item.discount_percent || item.discount || 0);
          return sum + (p * q * d) / 100;
        },
        0
      );
      const subtotalAfterItems = subtotalForDoc - itemsDiscountSum;
      const documentDiscountAmount =
        (subtotalAfterItems * discountPercentNum) / 100;

      // Формируем данные для создания документа через новый API
      const documentData = {
        doc_type: docType,
        ...(isPaymentKindRelevant && { payment_kind: paymentKind }),
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
            Math.min(100, Number(item.discount_percent || item.discount || 0))
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

      // Используем типовой эндпоинт для соответствующего doc_type
      let createdDocument;
      try {
        createdDocument = await createDocumentByType(documentData);
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
          })
        );
        if (!postWarehouseDocument.fulfilled.match(postResult)) {
          const postError = postResult.payload || postResult.error;
          alert(
            "Документ создан, но не проведен: " + formatApiError(postError)
          );
          navigate("/crm/warehouse/documents");
          return;
        }
      }

      alert(
        "Документ успешно сохранен" + (isDocumentPosted ? " и проведен" : "")
      );

      // Очищаем локальное состояние
      setCartItems([]);
      setSelectedProductIds(new Set());
      setClientId("");
      setWarehouseTo("");
      setDocumentDiscount("");
      setComment("");
      setDocumentSearch("");

      navigate("/crm/warehouse/documents");
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
          (Number(item.price || item.unit_price) || 0) * (Number(item.quantity) || 0),
        0
      );
      const itemsDiscountSum = cartItems.reduce(
        (sum, item) => {
          const p = Number(item.price || item.unit_price) || 0;
          const q = Number(item.quantity) || 0;
          const d = Number(item.discount_percent || item.discount || 0);
          return sum + (p * q * d) / 100;
        },
        0
      );
      const subtotalAfterItems = subtotalForDoc - itemsDiscountSum;
      const documentDiscountAmount =
        (subtotalAfterItems * discountPercentNum) / 100;

      const documentData = {
        doc_type: docType,
        ...(isPaymentKindRelevant && { payment_kind: paymentKind }),
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
            Math.min(100, Number(item.discount_percent || item.discount || 0))
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

      // Создаём документ через типовой эндпоинт
      let createdDocument;
      try {
        createdDocument = await createDocumentByType(documentData);
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
          })
        );
        if (!postWarehouseDocument.fulfilled.match(postResult)) {
          const postError = postResult.payload || postResult.error;
          alert(
            "Документ создан, но не проведен: " + formatApiError(postError)
          );
          navigate("/crm/warehouse/documents");
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
                Number(item.line_total ?? item.total ?? lineTotal).toFixed(2)
              ),
              unit: item.product?.unit ?? item.unit ?? "ШТ",
              article:
                String(
                  item.product?.article ??
                    item.article ??
                    item.product_article ??
                    ""
                ).trim() || "",
              discount_percent: Number(item.discount_percent || 0),
              discount_amount: Number(item.discount_amount || 0),
              price_before_discount: String(price.toFixed(2)),
            };
          })
        : [];

      const subtotal = items.reduce(
        (sum, item) => sum + Number(item.unit_price) * Number(item.qty),
        0
      );
      const itemsDiscountTotal = items.reduce(
        (sum, item) =>
          sum +
          (Number(item.unit_price) *
            Number(item.qty) *
            Number(item.discount_percent || 0)) /
            100,
        0
      );
      const totalDiscount = itemsDiscountTotal + docDiscountAmount;
      const total = Number(doc.total) || subtotal - totalDiscount;

      const docNumber =
        doc.number || documentId.substring(0, 8) || "00001";
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
        (c) => c.id === (doc.counterparty || clientId)
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
          <InvoicePdfDocument data={invoiceData} />
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
          <ReceiptPdfDocument data={receiptData} />
        ).toBlob();
        downloadBlob(blob, `receipt_${docNumber}.pdf`);
      }

      // Очищаем корзину после успешного скачивания PDF
      setCartItems([]);

      // Сбрасываем локальное состояние
      setSelectedProductIds(new Set());
      setClientId("");
      setDocumentDiscount("");
      setComment("");
      setDocumentSearch("");

      navigate("/crm/warehouse/documents");
    } catch (error) {
      console.error("Ошибка генерации PDF:", error);
      // Если это ошибка API, используем formatApiError, иначе обычное сообщение
      const errorMessage =
        error?.response?.data || error?.payload || error?.error
          ? formatApiError(
              error?.response?.data || error?.payload || error?.error
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
                        toggleGroupExpand(key);
                        if (!isExpanded && (notLoaded || isStale)) {
                          loadProductsForGroup(key, null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
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
                          ) : getUngroupedProducts(entry?.items).length === 0 ? (
                            <div className="create-sale-document__group-products-empty">
                              Нет товаров
                            </div>
                          ) : (
                            getUngroupedProducts(entry?.items).map((product) => {
                              const isSelected = selectedProductIds.has(
                                String(product.id)
                              );
                              const isInCart = cartItems.some(
                                (item) =>
                                  String(item.productId) === String(product.id)
                              );
                              return (
                                <div
                                  key={product.id}
                                  className={`create-sale-document__group-product-item ${
                                    isSelected || isInCart ? "active" : ""
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddProduct(product);
                                  }}
                                >
                                  <div className="create-sale-document__group-product-main">
                                    <div className="create-sale-document__group-product-name">
                                      {product.name}
                                    </div>
                                    <div className="create-sale-document__group-product-meta">
                                      <span className="create-sale-document__group-product-price">
                                        {formatPrice(
                                          getProductPriceForDocument(product)
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
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {groupsLoading ? (
              <div className="create-sale-document__groups-empty">Загрузка…</div>
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

          {/* <button
            type="button"
            className="create-sale-document__create-product-btn"
          >
            <Plus size={18} />
            Новый товар
          </button> */}

        </div>

        {/* Основная область */}
        <div className="create-sale-document__main">
          <div className="create-sale-document__header">
            <div className="create-sale-document__header-left">
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
                    checked={isDocumentPosted}
                    onChange={(e) => setIsDocumentPosted(e.target.checked)}
                  />
                  <span>Документ проведён</span>
                </label>
                {isPaymentKindRelevant && (
                  <div className="create-sale-document__payment-kind create-sale-document__payment-kind--header">
                    <label className="create-sale-document__payment-option">
                      <input
                        type="radio"
                        name="payment_kind"
                        value="cash"
                        checked={paymentKind === "cash"}
                        onChange={() => setPaymentKind("cash")}
                      />
                      <span>Сразу</span>
                    </label>
                    <label className="create-sale-document__payment-option">
                      <input
                        type="radio"
                        name="payment_kind"
                        value="credit"
                        checked={paymentKind === "credit"}
                        onChange={() => setPaymentKind("credit")}
                      />
                      <span>В долг</span>
                    </label>
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
                  <select
                    value={warehouse}
                    onChange={(e) => setWarehouse(e.target.value)}
                    required
                  >
                    <option value="">Выберите склад</option>
                    {warehouses
                      .filter(
                        (wh) => !isWarehouseToRequired || wh.id !== warehouseTo
                      )
                      .map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.name || wh.title || wh.id}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              {isWarehouseToRequired && (
                <div className="create-sale-document__field">
                  <label>Склад получатель *</label>
                  <select
                    value={warehouseTo}
                    onChange={(e) => setWarehouseTo(e.target.value)}
                    required
                  >
                    <option value="">Выберите склад получатель</option>
                    {warehouses
                      .filter((wh) => wh.id !== warehouse)
                      .map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.name || wh.title || wh.id}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              {isCounterpartyRequired && (
                <div className="create-sale-document__field create-sale-document__field--with-icon">
                  <User
                    size={18}
                    className="create-sale-document__field-icon"
                  />
                  <div className="create-sale-document__field-inner">
                    <label>Контрагент *</label>
                    <select
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      required={isCounterpartyRequired}
                    >
                      <option value="">
                        {docType === "SALE" || docType === "SALE_RETURN"
                          ? "Выберите клиента"
                          : "Выберите поставщика"}
                      </option>
                      {filteredCounterparties.map((counterparty) => (
                        <option key={counterparty.id} value={counterparty.id}>
                          {counterparty.name || "Без названия"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
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
                Для инвентаризации укажите <strong>фактический остаток</strong> по каждой позиции; при проведении будет создано движение на разницу с текущим остатком.
              </p>
            )}
            <div className="create-sale-document__table-wrapper">
              <table className="create-sale-document__table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>НАИМЕНОВАНИЕ</th>
                    <th>ЕД. ИЗМ.</th>
                    <th>{docType === "INVENTORY" ? "ФАКТ. ОСТАТОК" : "КОЛ-ВО"}</th>
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
                        item.price || item.unit_price || 0
                      );
                      const itemQuantity = Number(item.quantity);
                      const itemDiscount = Number(
                        item.discount_percent ?? item.discount ?? 0
                      );
                      const itemTotal =
                        itemPrice * itemQuantity * (1 - itemDiscount / 100);

                      return (
                        <tr key={item.id || index}>
                          <td>{index + 1}</td>
                          <td>{itemName}</td>
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
                      0
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
                <div className="create-sale-document__summary-row">
                  <span>Оплачено:</span>
                  <span>{formatPrice(totals.paid)} сом</span>
                </div>
                <div className="create-sale-document__summary-row create-sale-document__summary-row--due">
                  <span>К оплате:</span>
                  <span>{formatPrice(totals.displayTotal - totals.paid)} сом</span>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateSaleDocument;
