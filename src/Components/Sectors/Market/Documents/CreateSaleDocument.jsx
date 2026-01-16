import React, { useState, useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  Check,
  X,
  ChevronDown,
  Pencil,
  Folder,
} from "lucide-react";
import { fetchClientsAsync } from "../../../../store/creators/clientCreators";
import { pdf } from "@react-pdf/renderer";
import ReceiptPdfDocument from "./components/ReceiptPdfDocument";
import InvoicePdfDocument from "./components/InvoicePdfDocument";
import { fetchProductsAsync } from "../../../../store/creators/productCreators";
import { useCash } from "../../../../store/slices/cashSlice";
import { useClient } from "../../../../store/slices/ClientSlice";
import { useUser } from "../../../../store/slices/userSlice";
import "./CreateSaleDocument.scss";

const CreateSaleDocument = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { company, profile: userProfile } = useUser();
  const { list: cashBoxes } = useCash();
  const { list: clients } = useClient();

  const [productSearch, setProductSearch] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());
  const [showMoreProducts, setShowMoreProducts] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);

  const [warehouse, setWarehouse] = useState("");
  const [clientId, setClientId] = useState("");
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

  // Загрузка товаров
  useEffect(() => {
    const loadProducts = async () => {
      setProductsLoading(true);
      try {
        const result = await dispatch(
          fetchProductsAsync({
            search: debouncedProductSearch || undefined,
            page_size: showMoreProducts ? 50 : 20,
          })
        );
        if (fetchProductsAsync.fulfilled.match(result)) {
          setProducts(result.payload?.results || result.payload || []);
        }
      } catch (error) {
        console.error("Ошибка загрузки товаров:", error);
      } finally {
        setProductsLoading(false);
      }
    };
    loadProducts();
  }, [dispatch, debouncedProductSearch, showMoreProducts]);

  // Загрузка клиентов
  useEffect(() => {
    dispatch(fetchClientsAsync({ type: "client" }));
  }, [dispatch]);

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

  // Фильтрация клиентов
  const filterClient = useMemo(
    () => (clients || []).filter((c) => c.type === "client"),
    [clients]
  );

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

      if (existingItemIndex >= 0) {
        // Увеличиваем количество существующего товара
        setCartItems((prev) => {
          const updated = [...prev];
          updated[existingItemIndex] = {
            ...updated[existingItemIndex],
            quantity: updated[existingItemIndex].quantity + 1,
          };
          return updated;
        });
      } else {
        // Добавляем новый товар в корзину
        const newItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          productId: product.id,
          productName: product.name,
          name: product.name,
          price: Number(product.price || 0),
          unit_price: Number(product.price || 0),
          quantity: 1,
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
    const qty = Number(newQuantity);
    if (qty <= 0) {
      // Удаляем товар из корзины
      setCartItems((prev) => prev.filter((item) => item.id !== itemId));
    } else {
      // Обновляем количество товара
      setCartItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, quantity: qty } : item
        )
      );
    }
  };

  // Удаление товара
  const handleRemoveProduct = (itemId) => {
    setCartItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  // Сохранение документа
  const handleSave = async () => {
    // Просто переходим на страницу документов
    // Документ находится в локальной корзине (cartItems), поэтому сохранение не требуется
    navigate("/crm/market/documents");
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
    if (!cartItems || cartItems.length === 0) {
      alert("Добавьте товары в документ");
      return;
    }

    try {
      // Получаем данные компании и клиента
      const selectedClient = filterClient.find((c) => c.id === clientId);
      const warehouseName = warehouse
        ? cashBoxes?.find((b) => b.id === warehouse)?.name || warehouse
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

      // Формируем номер документа
      const docNumber = documentId.substring(0, 8) || "00001";
      const currentDate = documentDateValue
        ? new Date(documentDateValue)
        : new Date();

      if (printType === "invoice") {
        // Формируем данные для накладной
        const invoiceData = {
          document: {
            type: "sale_invoice",
            title: "Накладная",
            id: documentId,
            number: docNumber,
            date: currentDate.toISOString().split("T")[0],
            datetime: currentDate.toISOString(),
            created_at: currentDate.toISOString(),
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
          buyer: selectedClient
            ? {
                id: selectedClient.id,
                name: selectedClient.full_name || selectedClient.name || "",
                inn: selectedClient.inn || "",
                okpo: selectedClient.okpo || "",
                score: selectedClient.score || "",
                bik: selectedClient.bik || "",
                address: selectedClient.address || "",
                phone: selectedClient.phone || null,
                email: selectedClient.email || null,
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
            id: documentId,
            number: docNumber,
            doc_no: docNumber,
            date: currentDate.toISOString().split("T")[0],
            created_at: currentDate.toISOString(),
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
          client: selectedClient
            ? {
                id: selectedClient.id,
                full_name:
                  selectedClient.full_name || selectedClient.name || "",
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

      navigate("/crm/market/documents");
    } catch (error) {
      console.error("Ошибка генерации PDF:", error);
      alert("Ошибка: " + (error.message || "Не удалось сгенерировать PDF"));
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
        {/* Левая панель с товарами */}
        <div className="create-sale-document__sidebar">
          <div className="create-sale-document__search-wrapper">
            <div className="create-sale-document__search">
              <Search size={18} className="create-sale-document__search-icon" />
              <input
                type="text"
                placeholder="Поиск товаров"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </div>
            <div className="create-sale-document__search-actions">
              <Folder size={18} />
              <Check size={18} />
            </div>
          </div>

          <button className="create-sale-document__create-product-btn">
            <Plus size={16} />
            Создать товар
          </button>

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
                      <div className="create-sale-document__product-name">
                        {product.name}
                      </div>
                      <div className="create-sale-document__product-details">
                        <span className="create-sale-document__product-price">
                          {formatPrice(product.price)} сом
                        </span>
                        <span className="create-sale-document__product-qty">
                          {product.qty_on_hand || 0} {product.unit || "шт"}
                        </span>
                      </div>
                    </div>
                    {(isSelected || isInCart) && (
                      <Check
                        size={18}
                        className="create-sale-document__product-check"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {products.length > 0 && (
            <button
              className="create-sale-document__show-more"
              onClick={() => setShowMoreProducts(!showMoreProducts)}
            >
              ПОКАЗАТЬ ЕЩЕ
            </button>
          )}
        </div>

        {/* Основная область */}
        <div className="create-sale-document__main">
          {/* Верхняя панель */}
          <div className="create-sale-document__header">
            <div className="create-sale-document__header-left">
              <button
                className="create-sale-document__save-btn"
                onClick={handleSave}
              >
                Сохранить
              </button>
              <div className="create-sale-document__save-print-wrapper">
                <button
                  className="create-sale-document__save-print-btn"
                  onClick={() => setShowSavePrintMenu(!showSavePrintMenu)}
                >
                  Сохранить и распечатать.
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
            <div className="create-sale-document__header-right">
              <label className="create-sale-document__toggle">
                <input
                  type="checkbox"
                  checked={isDocumentPosted}
                  onChange={(e) => setIsDocumentPosted(e.target.checked)}
                />
                <span>Документ проведён</span>
              </label>
              {/* <label className="create-sale-document__checkbox">
                <input
                  type="checkbox"
                  checked={isOrder}
                  onChange={(e) => setIsOrder(e.target.checked)}
                />
                <span>Заказ</span>
              </label> */}
              <div className="create-sale-document__date-wrapper">
                <input
                  ref={dateInputRef}
                  type="date"
                  id="document-date-picker"
                  className="create-sale-document__date-input"
                  value={documentDateValue}
                  onChange={(e) => setDocumentDateValue(e.target.value)}
                />
                <div
                  className="create-sale-document__date"
                  onClick={() => {
                    const input = dateInputRef.current;
                    if (input) {
                      input.showPicker?.() || input.click();
                    }
                  }}
                >
                  {displayDate}
                  <Pencil size={14} />
                </div>
              </div>
            </div>
          </div>

          {/* Основной контент */}
          <div className="create-sale-document__content">
            <h2 className="create-sale-document__title">
              Продажа{" "}
              {documentId ? `#${documentId.slice(0, 8)}` : "(новый документ)"}
            </h2>

            <div className="create-sale-document__fields">
              <div className="create-sale-document__field">
                <label>Клиент</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">Выберите клиента</option>
                  {filterClient.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name || client.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Вкладки */}
            <div className="create-sale-document__tabs">
              <button
                className={`create-sale-document__tab ${
                  activeTab === "products" ? "active" : ""
                }`}
                onClick={() => setActiveTab("products")}
              >
                Товары
              </button>
              {/* <button
                className={`create-sale-document__tab ${
                  activeTab === "payment" ? "active" : ""
                }`}
                onClick={() => setActiveTab("payment")}
              >
                Счета и оплата
              </button> */}
            </div>

            {/* Поиск по товарам в документе */}
            {activeTab === "products" && (
              <>
                <div className="create-sale-document__document-search">
                  <Search size={18} />
                  <input
                    type="text"
                    placeholder="Поиск по товарам в документе"
                    value={documentSearch}
                    onChange={(e) => setDocumentSearch(e.target.value)}
                  />
                </div>

                {/* Таблица товаров */}
                <div className="create-sale-document__table-wrapper">
                  <table className="create-sale-document__table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Наименование</th>
                        <th>Ед. изм.</th>
                        <th>Кол-во</th>
                        <th>Цена, сом</th>
                        <th>Скидка, %</th>
                        <th>Итог</th>
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
                          const itemName =
                            item.productName || item.name || "Товар";
                          const itemPrice = Number(
                            item.price || item.unit_price || 0
                          );
                          const itemQuantity = Number(item.quantity || 1);
                          const itemTotal = itemPrice * itemQuantity;

                          return (
                            <tr key={item.id || index}>
                              <td>{index + 1}</td>
                              <td>{itemName}</td>
                              <td>{item.unit || "шт"}</td>
                              <td>
                                <input
                                  type="text"
                                  min="0"
                                  value={itemQuantity}
                                  onChange={(e) =>
                                    handleQuantityChange(
                                      item.id,
                                      e.target.value
                                    )
                                  }
                                  className="create-sale-document__qty-input"
                                />
                              </td>
                              <td>{formatPrice(itemPrice)}</td>
                              <td>
                                {item.discount_percent || item.discount || 0}%
                              </td>
                              <td>{formatPrice(itemTotal)}</td>
                              <td>
                                <button
                                  className="create-sale-document__remove-btn"
                                  onClick={() => handleRemoveProduct(item.id)}
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

                {/* Итоги */}
                <div className="create-sale-document__totals">
                  <div className="create-sale-document__total-row">
                    <span>Итог:</span>
                    <span>{formatPrice(totals.total)} сом</span>
                  </div>
                  <div className="create-sale-document__total-row">
                    <span>Оплаченные:</span>
                    <span>{formatPrice(totals.paid)} сом</span>
                  </div>
                  {/* <div className="create-sale-document__total-row">
                    <span>
                      Налоги:
                      <span className="create-sale-document__help-icon">?</span>
                    </span>
                    <span>{formatPrice(totals.taxes)} сом</span>
                  </div> */}
                  <div className="create-sale-document__total-row">
                    <span>Скидка по документу:</span>
                    <div className="create-sale-document__discount-input-wrapper">
                      <input
                        type="text"
                        min="0"
                        max="100"
                        value={documentDiscount}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Разрешаем пустое значение во время ввода
                          if (value === "") {
                            setDocumentDiscount("");
                          } else {
                            const numValue = Number(value);
                            if (
                              !isNaN(numValue) &&
                              numValue >= 0 &&
                              numValue <= 100
                            ) {
                              setDocumentDiscount(value);
                            }
                          }
                        }}
                        onBlur={(e) => {
                          const value = e.target.value;
                          // При потере фокуса валидируем и устанавливаем 0, если пусто
                          if (
                            value === "" ||
                            value === null ||
                            isNaN(Number(value))
                          ) {
                            setDocumentDiscount("0");
                          } else {
                            const numValue = Number(value);
                            if (numValue < 0) {
                              setDocumentDiscount("0");
                            } else if (numValue > 100) {
                              setDocumentDiscount("100");
                            } else {
                              setDocumentDiscount(String(numValue));
                            }
                          }
                        }}
                        className="create-sale-document__discount-input"
                      />
                      <span>%</span>
                    </div>
                  </div>
                  <div className="create-sale-document__total-row">
                    <span>Общая скидка:</span>
                    <span>
                      {documentDiscount > 0 || totals.itemsDiscount > 0
                        ? `${(
                            (totals.totalDiscount / totals.subtotal) *
                            100
                          ).toFixed(2)}% (${formatPrice(
                            totals.totalDiscount
                          )} сом)`
                        : `% (${formatPrice(0)} сом)`}
                    </span>
                  </div>
                </div>

                {/* Комментарий */}
                <div className="create-sale-document__comment-section">
                  <label className="create-sale-document__comment-label">
                    Комментарий
                  </label>
                  <textarea
                    className="create-sale-document__comment-textarea"
                    placeholder="Введите комментарий..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                  />
                </div>
              </>
            )}

            {activeTab === "payment" && (
              <div className="create-sale-document__payment-tab">
                <p>Раздел "Счета и оплата" в разработке</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateSaleDocument;
