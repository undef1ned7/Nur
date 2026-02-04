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
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsPage, setProductsPage] = useState(1);
  const [productsPagination, setProductsPagination] = useState({
    count: 0,
    next: null,
    previous: null,
  });
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());
  const [addingProduct, setAddingProduct] = useState(false);

  const PRODUCTS_PAGE_SIZE = 100;

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
  const [cartItems, setCartItems] = useState([]);
  const [documentId] = useState(
    () => `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );

  const debounceTimerRef = useRef(null);

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

  // Загрузка товаров через новый warehouse API
  // Загружаем товары только выбранного склада (не используем /main/products/list/)
  useEffect(() => {
    // Не загружаем товары, если склад не выбран
    if (!warehouse) {
      setProducts([]);
      return;
    }

    const loadProducts = async () => {
      setProductsLoading(true);
      try {
        const params = {
          warehouse: warehouse, // Всегда передаем warehouse, чтобы использовать warehouse/${warehouse}/products/
          search: debouncedProductSearch || undefined,
          page_size: showMoreProducts ? 50 : 20,
        };

        const result = await dispatch(fetchProductsAsync(params));
        if (fetchProductsAsync.fulfilled.match(result)) {
          // Обрабатываем стандартный формат DRF пагинации
          setProducts(
            result.payload?.results ||
              (Array.isArray(result.payload) ? result.payload : [])
          );
        }
      } catch (error) {
        console.error("Ошибка загрузки товаров:", error);
      } finally {
        setProductsLoading(false);
      }
    };
    loadProducts();
  }, [dispatch, debouncedProductSearch, showMoreProducts, warehouse]);

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
              return {
                ...item,
                stock,
                quantity: stock > 0 && qty > stock ? stock : item.quantity,
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
  }, [warehouse]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Итоговая сумма с учетом всех скидок
    const total = subtotalAfterItemsDiscount - documentDiscountAmount;
    const paid = isDocumentPosted ? total : 0;

    return {
      subtotal,
      itemsDiscount,
      documentDiscount: documentDiscountAmount,
      totalDiscount,
      total,
      paid,
      taxes: 0,
    };
  }, [cartItems, documentDiscount, isDocumentPosted]);

  // Добавление товара в корзину
  const handleAddProduct = async (productId) => {
    if (addingProduct) return; // Предотвращаем множественные клики

    setAddingProduct(true);
    try {
      // Находим товар в списке продуктов
      const product = products.find((p) => p.id === productId);
      if (!product) {
        alert("Товар не найден");
        return;
      }

      // Проверяем, есть ли уже этот товар в корзине
      const existingItemIndex = cartItems.findIndex(
        (item) => item.productId === productId
      );

      const stock = Number(product.quantity ?? 0);

      if (existingItemIndex >= 0) {
        const existing = cartItems[existingItemIndex];
        const currentQty = Number(existing.quantity || 0);
        const maxQty = Number(existing.stock ?? stock);
        if (currentQty >= maxQty) {
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
        if (stock < 1) {
          alert("Нет остатка на складе");
          return;
        }
        const newItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          productId: product.id,
          productName: product.name,
          name: product.name,
          price: Number(product.price || 0),
          unit_price: Number(product.price || 0),
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
      setSelectedProductIds((prev) => new Set([...prev, productId]));
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
    if (qty <= 0 || isNaN(qty)) {
      setCartItems((prev) => prev.filter((i) => i.id !== itemId));
      return;
    }

    const unit = item.unit || "шт";
    const isPiece =
      unit.toLowerCase() === "шт" || unit.toLowerCase() === "штук";
    let finalQty = isPiece ? Math.floor(qty) : qty;
    const maxQty = Number(item.stock ?? 0);
    if (maxQty > 0 && finalQty > maxQty) {
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

      // Проверка: количество не больше остатка на складе
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
      // Формируем данные для создания документа через новый API
      const documentData = {
        doc_type: docType,
        warehouse_from: warehouse,
        ...(isWarehouseToRequired && { warehouse_to: warehouseTo }),
        ...(isCounterpartyRequired && clientId && { counterparty: clientId }),
        comment: comment || "",
        items: cartItems.map((item) => {
          const unit = item.unit || "шт";
          const isPiece =
            unit.toLowerCase() === "шт" || unit.toLowerCase() === "штук";
          const qty = Number(item.quantity || 1);
          const finalQty = isPiece ? Math.floor(qty) : qty;

          return {
            product: item.productId,
            qty: String(finalQty),
            price: String((item.price || item.unit_price || 0).toFixed(2)),
            discount_percent: String(
              Math.max(
                0,
                Math.min(
                  100,
                  Number(item.discount_percent || item.discount || 0)
                )
              )
            ),
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
      const documentData = {
        doc_type: docType,
        warehouse_from: warehouse,
        ...(isWarehouseToRequired && { warehouse_to: warehouseTo }),
        ...(isCounterpartyRequired && clientId && { counterparty: clientId }),
        comment: comment || "",
        items: cartItems.map((item) => {
          const unit = item.unit || "шт";
          const isPiece =
            unit.toLowerCase() === "шт" || unit.toLowerCase() === "штук";
          const qty = Number(item.quantity || 1);
          const finalQty = isPiece ? Math.floor(qty) : qty;

          return {
            product: item.productId,
            qty: String(finalQty),
            price: String((item.price || item.unit_price || 0).toFixed(2)),
            discount_percent: String(
              Math.max(
                0,
                Math.min(
                  100,
                  Number(item.discount_percent || item.discount || 0)
                )
              )
            ),
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

      // Получаем данные компании и контрагента
      const selectedCounterparty = filteredCounterparties.find(
        (c) => c.id === clientId
      );
      const warehouseName = warehouse
        ? warehouses.find((w) => w.id === warehouse)?.name ||
          cashBoxes?.find((b) => b.id === warehouse)?.name ||
          warehouse
        : null;
      const warehouseToName = warehouseTo
        ? warehouses.find((w) => w.id === warehouseTo)?.name ||
          cashBoxes?.find((b) => b.id === warehouseTo)?.name ||
          warehouseTo
        : null;

      // Получаем скидку по документу
      const discountPercent = Number(documentDiscount) || 0;

      // Формируем данные для PDF из текущей корзины
      const items = cartItems.map((item, idx) => {
        const itemName = item.productName || item.name || "Товар";
        const itemPrice = Number(item.price || item.unit_price || 0);
        const itemQty = Number(item.quantity || 1);
        const itemDiscount = Number(
          item.discount_percent || item.discount || 0
        );
        const itemSubtotal = itemPrice * itemQty;

        // Скидка по позиции
        const itemDiscountAmount = (itemSubtotal * itemDiscount) / 100;
        const itemSubtotalAfterItemDiscount = itemSubtotal - itemDiscountAmount;

        // Применяем скидку по документу к товару после скидки по позиции
        // Скидка по документу применяется пропорционально к каждому товару
        const documentDiscountAmount =
          (itemSubtotalAfterItemDiscount * discountPercent) / 100;
        const itemTotal =
          itemSubtotalAfterItemDiscount - documentDiscountAmount;

        return {
          id: item.id || idx,
          name: itemName,
          qty: String(itemQty),
          unit_price: String(itemPrice.toFixed(2)),
          total: String(itemTotal.toFixed(2)),
          unit: item.unit || "ШТ",
          article: item.article || "",
          discount_percent: itemDiscount,
          price_before_discount: String(itemPrice.toFixed(2)), // Цена без скидки (исходная цена товара)
        };
      });

      // Используем данные из созданного документа
      const docNumber =
        createdDocument.number || documentId.substring(0, 8) || "00001";
      const currentDate =
        createdDocument.date || documentDateValue
          ? new Date(createdDocument.date || documentDateValue)
          : new Date();

      if (printType === "invoice") {
        // Формируем данные для накладной
        const invoiceData = {
          doc_type: docType, // Передаем тип документа
          document: {
            type: "sale_invoice",
            doc_type: docType,
            title: "Накладная",
            id: createdDocument.id || documentId,
            number: docNumber,
            date: currentDate.toISOString().split("T")[0],
            datetime: currentDate.toISOString(),
            created_at: createdDocument.created_at || currentDate.toISOString(),
            discount_percent: discountPercent, // Передаем скидку по документу
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
                name: selectedCounterparty.name || "",
                inn: selectedCounterparty.inn || "",
                okpo: selectedCounterparty.okpo || "",
                score: selectedCounterparty.score || "",
                bik: selectedCounterparty.bik || "",
                address: selectedCounterparty.address || "",
                phone: selectedCounterparty.phone || null,
                email: selectedCounterparty.email || null,
              }
            : null,
          items: items,
          totals: {
            subtotal: String(totals.subtotal.toFixed(2)),
            discount_total: String(totals.totalDiscount.toFixed(2)),
            tax_total: "0.00",
            total: String(totals.total.toFixed(2)),
          },
          warehouse: warehouseName,
          warehouse_to: warehouseToName, // Склад получатель для TRANSFER
        };

        // Генерируем PDF накладной
        const blob = await pdf(
          <InvoicePdfDocument data={invoiceData} />
        ).toBlob();
        downloadBlob(blob, `invoice_${docNumber}.pdf`);
      } else if (printType === "receipt") {
        // Формируем данные для чека
        const receiptData = {
          document: {
            type: "receipt",
            title: "Товарный чек",
            id: createdDocument.id || documentId,
            number: docNumber,
            doc_no: docNumber,
            date: currentDate.toISOString().split("T")[0],
            created_at: createdDocument.created_at || currentDate.toISOString(),
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
                full_name: selectedCounterparty.name || "",
              }
            : null,
          items: items,
          totals: {
            subtotal: String(totals.subtotal.toFixed(2)),
            discount_total: String(totals.totalDiscount.toFixed(2)),
            tax_total: "0.00",
            total: String(totals.total.toFixed(2)),
          },
          payment: {
            method: "cash",
            cash_received: String(totals.total.toFixed(2)),
            change: "0.00",
            paid_at: currentDate.toISOString(),
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

          {/* <button
            type="button"
            className="create-sale-document__create-product-btn"
          >
            <Plus size={18} />
            Новый товар
          </button> */}

          <div className="create-sale-document__products-list">
            {productsLoading ? (
              <div className="create-sale-document__loading">Загрузка...</div>
            ) : products.length === 0 ? (
              <div className="create-sale-document__empty">
                Товары не найдены
              </div>
            ) : (
              products.map((product) => {
                const isSelected = selectedProductIds.has(product.id);
                const isInCart = cartItems.some(
                  (item) => String(item.productId) === String(product.id)
                );

                return (
                  <div
                    key={product.id}
                    className={`create-sale-document__product-item ${
                      isSelected || isInCart ? "active" : ""
                    }`}
                    onClick={() => handleAddProduct(product.id)}
                    style={{
                      cursor: addingProduct ? "wait" : "pointer",
                      opacity: addingProduct ? 0.6 : 1,
                    }}
                  >
                    <div className="create-sale-document__product-info">
                      {/* <div className="create-sale-document__product-id">
                        {product.id}
                      </div> */}
                      <div className="create-sale-document__product-name">
                        {product.name}
                      </div>
                      <div className="create-sale-document__product-details">
                        <span className="create-sale-document__product-price">
                          {formatPrice(product.price)} сом
                        </span>
                        <span className="create-sale-document__product-qty">
                          Остаток: {product.quantity ?? 0}
                        </span>
                      </div>
                    </div>
                    <Package
                      size={18}
                      className="create-sale-document__product-icon"
                    />
                  </div>
                );
              })
            )}
          </div>

          {products.length > 0 && (
            <button
              type="button"
              className="create-sale-document__show-more"
              onClick={() => setShowMoreProducts(!showMoreProducts)}
            >
              Показать ещё
            </button>
          )}
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
            <div className="create-sale-document__table-wrapper">
              <table className="create-sale-document__table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>НАИМЕНОВАНИЕ</th>
                    <th>ЕД. ИЗМ.</th>
                    <th>КОЛ-ВО</th>
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
                      const itemQuantity = Number(item.quantity || 1);
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
                                item.stock != null && item.stock > 0
                                  ? `Остаток на складе: ${item.stock}`
                                  : undefined
                              }
                              placeholder={
                                item.stock != null && item.stock > 0
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
                  <span>{formatPrice(totals.total)} сом</span>
                </div>
                <div className="create-sale-document__summary-row">
                  <span>Оплачено:</span>
                  <span>{formatPrice(totals.paid)} сом</span>
                </div>
                <div className="create-sale-document__summary-row create-sale-document__summary-row--due">
                  <span>К оплате:</span>
                  <span>{formatPrice(totals.total - totals.paid)} сом</span>
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
