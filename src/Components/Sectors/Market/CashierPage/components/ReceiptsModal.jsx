import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Search,
  Calendar,
  User,
  Store,
  ChevronDown,
  Eye,
} from "lucide-react";
import { useDispatch } from "react-redux";
import api from "../../../../../api";
import { getReceiptJson } from "../../../../../store/creators/saleThunk";
import { useClient } from "../../../../../store/slices/ClientSlice";
import { useProducts } from "../../../../../store/slices/productSlice";
import ReceiptPreviewModal from "../../Documents/components/ReceiptPreviewModal";
import "./ReceiptsModal.scss";

const ReceiptsModal = ({ onClose }) => {
  const dispatch = useDispatch();
  const { list: clients } = useClient();
  const { list: products } = useProducts();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewReceiptId, setPreviewReceiptId] = useState(null);
  const [previewReceiptData, setPreviewReceiptData] = useState(null);

  // Фильтры
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [documentNumber, setDocumentNumber] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [receiptsDetails, setReceiptsDetails] = useState(new Map()); // Кэш деталей чеков с items

  // Функция для загрузки всех страниц
  const fetchAllReceipts = async () => {
    const allReceipts = [];
    let nextUrl = "/main/pos/sales/";
    let guard = 0;
    const maxPages = 100;

    while (nextUrl && guard < maxPages) {
      try {
        const { data } = await api.get(nextUrl);
        const results = Array.isArray(data?.results) ? data.results : [];
        allReceipts.push(...results);
        nextUrl = data?.next || null;
        guard += 1;
      } catch (error) {
        console.error("Ошибка при загрузке чеков:", error);
        break;
      }
    }

    return allReceipts;
  };

  // Загрузка деталей чека (для получения items)
  const loadReceiptDetails = async (receiptId) => {
    if (receiptsDetails.has(receiptId)) {
      return receiptsDetails.get(receiptId);
    }

    try {
      const { data } = await api.get(`/main/pos/sales/${receiptId}/`);
      setReceiptsDetails((prev) => new Map(prev).set(receiptId, data));
      return data;
    } catch (error) {
      console.error(`Ошибка при загрузке деталей чека ${receiptId}:`, error);
      return null;
    }
  };

  useEffect(() => {
    const loadReceipts = async () => {
      try {
        setLoading(true);
        const allReceipts = await fetchAllReceipts();
        setReceipts(allReceipts);
      } catch (error) {
        console.error("Ошибка при загрузке чеков:", error);
      } finally {
        setLoading(false);
      }
    };

    loadReceipts();
  }, []);

  // Фильтрация клиентов
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients.slice(0, 10);
    const searchLower = clientSearch.toLowerCase();
    return clients
      .filter(
        (client) =>
          (client.full_name || client.name || "")
            .toLowerCase()
            .includes(searchLower) ||
          (client.phone || "").includes(clientSearch)
      )
      .slice(0, 10);
  }, [clients, clientSearch]);

  // Фильтрация товаров
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 10);
    const searchLower = productSearch.toLowerCase();
    return products
      .filter((product) =>
        (product.name || "").toLowerCase().includes(searchLower)
      )
      .slice(0, 10);
  }, [products, productSearch]);

  // Фильтрация чеков
  const filteredReceipts = useMemo(() => {
    let filtered = [...receipts];

    // Фильтр по дате
    if (selectedDate) {
      const selectedDateStr = new Date(selectedDate)
        .toISOString()
        .split("T")[0];
      filtered = filtered.filter((receipt) => {
        if (!receipt.created_at) return false;
        try {
          const receiptDate = new Date(receipt.created_at)
            .toISOString()
            .split("T")[0];
          return receiptDate === selectedDateStr;
        } catch {
          return false;
        }
      });
    }

    // Фильтр по номеру документа
    if (documentNumber.trim()) {
      const searchTerm = documentNumber.toLowerCase().trim();
      filtered = filtered.filter((receipt) => {
        const receiptId = String(receipt.id || "");
        return receiptId.toLowerCase().includes(searchTerm);
      });
    }

    // Фильтр по клиенту
    if (selectedClient) {
      filtered = filtered.filter((receipt) => {
        // client может быть null или объектом с id
        if (!receipt.client) return false;
        const clientId =
          typeof receipt.client === "object"
            ? receipt.client.id
            : receipt.client;
        return String(clientId) === String(selectedClient.id);
      });
    }

    // Фильтр по товару (проверяем first_item_name)
    if (selectedProduct) {
      filtered = filtered.filter((receipt) => {
        // Проверяем first_item_name (быстрая проверка)
        const firstItemName = (receipt.first_item_name || "").toLowerCase();
        const productName = (selectedProduct.name || "").toLowerCase();
        if (firstItemName.includes(productName)) {
          return true;
        }

        // Если есть детали в кэше, проверяем items
        const details = receiptsDetails.get(receipt.id);
        if (details?.items && Array.isArray(details.items)) {
          return details.items.some((item) => {
            const itemProductId = item.product || item.product_id;
            return String(itemProductId) === String(selectedProduct.id);
          });
        }

        // Если деталей нет, загружаем их асинхронно (но пока исключаем из результатов)
        // В реальном приложении можно было бы загрузить детали заранее
        return false;
      });
    }

    return filtered;
  }, [
    receipts,
    selectedDate,
    documentNumber,
    selectedClient,
    selectedProduct,
    receiptsDetails,
  ]);

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const day = date.getDate();
      const month = date.toLocaleDateString("ru-RU", { month: "long" });
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${day} ${month} ${hours}:${minutes}`;
    } catch {
      return "";
    }
  };

  const getStatusInfo = (receipt) => {
    const status = receipt.status || "";
    const total = parseFloat(receipt.total || 0);
    const debt = parseFloat(receipt.debt || 0);

    if (status === "paid" || status === "Оплачен") {
      return {
        type: "paid",
        text: "Оплачен",
        icon: "✓",
      };
    } else if (debt > 0 || status === "debt" || status === "Долг") {
      return {
        type: "debt",
        text: `Долг ${debt.toFixed(2)}сом`,
        icon: "!",
      };
    }
    return {
      type: "pending",
      text: "Новый",
      icon: "?",
    };
  };

  const handlePreviewReceipt = async (receiptId) => {
    setPreviewReceiptId(receiptId);

    // Загружаем данные чека через getReceiptJson (как в Documents)
    try {
      const result = await dispatch(getReceiptJson(receiptId));
      if (result.type === "products/getReceiptJson/fulfilled") {
        setPreviewReceiptData(result.payload);
      } else {
        // Если не удалось загрузить через getReceiptJson, используем детали из кэша
        let receiptData = receiptsDetails.get(receiptId);
        if (!receiptData) {
          receiptData = await loadReceiptDetails(receiptId);
        }
        setPreviewReceiptData(receiptData);
      }
    } catch (error) {
      console.warn("Ошибка при загрузке данных чека:", error);
      // Fallback: используем данные из кэша
      let receiptData = receiptsDetails.get(receiptId);
      if (!receiptData) {
        receiptData = await loadReceiptDetails(receiptId);
      }
      setPreviewReceiptData(receiptData);
    }
  };

  const handleClosePreview = () => {
    setPreviewReceiptId(null);
    setPreviewReceiptData(null);
  };

  // Обработка нажатия ESC
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [onClose]);

  return (
    <div className="receipts-modal-overlay" onClick={onClose}>
      <div className="receipts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="receipts-modal__container">
          {/* Левая панель с фильтрами */}
          <div className="receipts-modal__filters">
            <div className="receipts-modal__filters-header">
              <h3 className="receipts-modal__filters-title">Фильтр</h3>
              <button
                className="receipts-modal__reset-btn"
                onClick={() => {
                  setSelectedDate(new Date().toISOString().split("T")[0]);
                  setDocumentNumber("");
                  setClientSearch("");
                  setProductSearch("");
                  setSelectedClient(null);
                  setSelectedProduct(null);
                  setShowClientDropdown(false);
                  setShowProductDropdown(false);
                }}
              >
                Сбросить
              </button>
            </div>

            <div className="receipts-modal__filter-group">
              <div className="receipts-modal__date-display">
                <Calendar size={18} />
                <span>
                  {formatDateShort(new Date(selectedDate).toISOString())}
                </span>
              </div>
              <div className="receipts-modal__date-wrapper">
                <input
                  type="date"
                  id="receipt-date-picker"
                  className="receipts-modal__date-input"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
                <button
                  type="button"
                  className="receipts-modal__date-btn"
                  onClick={() => {
                    const input = document.getElementById(
                      "receipt-date-picker"
                    );
                    if (input) {
                      input.showPicker?.() || input.click();
                    }
                  }}
                >
                  <Calendar size={18} />
                  ВЫБЕРИТЕ ДАТУ
                </button>
              </div>
            </div>

            <div className="receipts-modal__filter-group">
              <label className="receipts-modal__filter-label">
                Номер документа
              </label>
              <input
                type="text"
                className="receipts-modal__filter-input"
                placeholder="Введите номер"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
              />
            </div>

            <div className="receipts-modal__filter-group">
              <label className="receipts-modal__filter-label">Клиенты</label>
              <div className="receipts-modal__search-wrapper">
                <input
                  type="text"
                  className="receipts-modal__filter-input"
                  placeholder="Поиск по клиентам"
                  value={clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    if (!e.target.value.trim()) {
                      setSelectedClient(null);
                    }
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                />
                <ChevronDown
                  size={18}
                  className="receipts-modal__dropdown-icon"
                  onClick={() => setShowClientDropdown(!showClientDropdown)}
                />
                {showClientDropdown && filteredClients.length > 0 && (
                  <div className="receipts-modal__dropdown">
                    {filteredClients.map((client) => (
                      <div
                        key={client.id}
                        className="receipts-modal__dropdown-item"
                        onClick={() => {
                          setSelectedClient(client);
                          setClientSearch(
                            client.full_name || client.name || ""
                          );
                          setShowClientDropdown(false);
                        }}
                      >
                        {client.full_name || client.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="receipts-modal__filter-group">
              <label className="receipts-modal__filter-label">Товары</label>
              <div className="receipts-modal__search-wrapper">
                <input
                  type="text"
                  className="receipts-modal__filter-input"
                  placeholder="Поиск по товарам"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    if (!e.target.value.trim()) {
                      setSelectedProduct(null);
                    }
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                />
                <ChevronDown
                  size={18}
                  className="receipts-modal__dropdown-icon"
                  onClick={() => setShowProductDropdown(!showProductDropdown)}
                />
                {showProductDropdown && filteredProducts.length > 0 && (
                  <div className="receipts-modal__dropdown">
                    {filteredProducts.map((product) => (
                      <div
                        key={product.id}
                        className="receipts-modal__dropdown-item"
                        onClick={() => {
                          setSelectedProduct(product);
                          setProductSearch(product.name || "");
                          setShowProductDropdown(false);
                        }}
                      >
                        {product.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Правая панель со списком чеков */}
          <div className="receipts-modal__content">
            <div className="receipts-modal__header">
              <h2 className="receipts-modal__title">Журнал чеков</h2>
              <button className="receipts-modal__close" onClick={onClose}>
                <X size={24} />
              </button>
            </div>

            <div className="receipts-modal__list">
              {loading ? (
                <div className="receipts-modal__loading">Загрузка...</div>
              ) : filteredReceipts.length === 0 ? (
                <div className="receipts-modal__empty">Чеки не найдены</div>
              ) : (
                filteredReceipts.map((receipt, idx) => {
                  const statusInfo = getStatusInfo(receipt);
                  const total = parseFloat(receipt.total || 0);

                  return (
                    <div key={receipt.id} className="receipts-modal__receipt">
                      <div className="receipts-modal__receipt-header">
                        <h3 className="receipts-modal__receipt-title">
                          Продажа #{idx + 1}
                        </h3>
                        <div className="receipts-modal__receipt-actions">
                          <button
                            className="receipts-modal__action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewReceipt(receipt.id);
                            }}
                          >
                            <Eye size={16} />
                            ПРОСМОТР
                          </button>
                          {/* <button className="receipts-modal__action-btn">
                            ВОЗВРАТ
                          </button> */}
                        </div>
                      </div>

                      <div className="receipts-modal__receipt-details">
                        <div className="receipts-modal__receipt-detail">
                          <Calendar size={16} />
                          <span>
                            {formatDateShort(
                              receipt.created_at || receipt.date
                            )}
                          </span>
                        </div>
                        <div className="receipts-modal__receipt-detail">
                          <User size={16} />
                          <span>
                            {receipt.client
                              ? typeof receipt.client === "object"
                                ? receipt.client.full_name ||
                                  receipt.client.name
                                : "Клиент"
                              : "Без клиента"}
                          </span>
                        </div>
                        <div className="receipts-modal__receipt-detail">
                          <Store size={16} />
                          <span>Мой магазин</span>
                        </div>
                        <div className="receipts-modal__receipt-detail">
                          <User size={16} />
                          <span>
                            {receipt.created_by_name ||
                              receipt.user_display ||
                              "стар"}
                          </span>
                        </div>
                      </div>

                      <div className="receipts-modal__receipt-footer">
                        <div
                          className={`receipts-modal__status receipts-modal__status--${statusInfo.type}`}
                        >
                          <span className="receipts-modal__status-icon">
                            {statusInfo.icon}
                          </span>
                          <span>{statusInfo.text}</span>
                        </div>
                        <div className="receipts-modal__receipt-amount">
                          {total.toFixed(2)}сом
                        </div>
                        <ChevronDown
                          size={20}
                          className="receipts-modal__expand-icon"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="receipts-modal__footer">
              <button className="receipts-modal__close-btn" onClick={onClose}>
                ЗАКРЫТЬ [ESC]
              </button>
            </div>
          </div>
        </div>
      </div>

      {previewReceiptId && (
        <ReceiptPreviewModal
          receiptId={previewReceiptId}
          receiptData={previewReceiptData}
          onClose={handleClosePreview}
        />
      )}
    </div>
  );
};

export default ReceiptsModal;
