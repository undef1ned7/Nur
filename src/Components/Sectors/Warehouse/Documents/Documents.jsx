import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Filter,
  Calendar,
  Eye,
  Pencil,
  Printer,
  Plus,
  Check,
  X,
  Undo2,
  LayoutGrid,
  List,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";
import {
  getReceiptJson,
  getInvoiceJson,
} from "../../../../store/creators/saleThunk";
import {
  fetchWarehouseDocuments,
  postWarehouseDocument,
  unpostWarehouseDocument,
  cashApproveWarehouseDocument,
  cashRejectWarehouseDocument,
  getWarehouseDocumentById,
} from "../../../../store/creators/warehouseThunk";
import { useUser } from "../../../../store/slices/userSlice";
import {
  handleCheckoutResponseForPrinting,
  checkPrinterConnection,
} from "../../../pages/Sell/services/printService";
import ReconciliationModal from "./components/ReconciliationModal";
import ReceiptPreviewModal from "./components/ReceiptPreviewModal";
import ReceiptEditModal from "./components/ReceiptEditModal";
import InvoicePreviewModal from "./components/InvoicePreviewModal";
import InvoicePdfDocument from "./components/InvoicePdfDocument";
import "./Documents.scss";
import { useAlert, useConfirm } from "../../../../hooks/useDialog";
import DataContainer from "../../../common/DataContainer/DataContainer";

// Маппинг URL-параметра (path) в значение doc_type для API
const DOC_TYPE_FROM_PARAM = {
  all: "",
  sale: "SALE",
  purchase: "PURCHASE",
  sale_return: "SALE_RETURN",
  purchase_return: "PURCHASE_RETURN",
  inventory: "INVENTORY",
  receipt: "RECEIPT",
  write_off: "WRITE_OFF",
  transfer: "TRANSFER",
};

const Documents = () => {
  const alert = useAlert();
  const confirm = useConfirm();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { docType: docTypeParam } = useParams();
  const { company } = useUser();
  const {
    documents,
    documentsCount,
    documentsNext,
    documentsPrevious,
    documentsLoading,
  } = useSelector((state) => state.sale);

  const [searchParams, setSearchParams] = useSearchParams();
  const pageFromUrl = parseInt(searchParams.get("page") || "1", 10);

  // Тип документа из URL (sidebar): all, sale, purchase, ...
  const docType = DOC_TYPE_FROM_PARAM[docTypeParam] ?? DOC_TYPE_FROM_PARAM.all;

  const [activeTab, setActiveTab] = useState("receipts");
  const [viewMode, setViewMode] = useState("table"); // "table" | "cards"
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(pageFromUrl || 1);
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [previewReceiptId, setPreviewReceiptId] = useState(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState(null);
  const [editReceiptId, setEditReceiptId] = useState(null);
  const [editReceiptData, setEditReceiptData] = useState(null);
  const debounceTimerRef = useRef(null);

  // Debounce для поиска
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Сбрасываем на первую страницу при изменении поиска
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm]);

  // Функция для генерации порядкового номера чека/накладной
  // Используем фиксированный размер страницы (обычно API возвращает 20 элементов)
  const PAGE_SIZE = 50;
  const getDocumentNumber = (index, prefix = "ЧЕК") => {
    const sequentialNumber = (currentPage - 1) * PAGE_SIZE + index + 1;
    return `${prefix}-${String(sequentialNumber).padStart(5, "0")}`;
  };

  // Маппинг статусов по API (9): DRAFT | CASH_PENDING | POSTED | REJECTED
  const getStatusLabel = (status) => {
    switch (status) {
      case "POSTED":
        return "Проведён";
      case "CASH_PENDING":
        return "Ожидает кассы";
      case "REJECTED":
        return "Отклонён";
      default:
        return "Черновик";
    }
  };
  const getStatusType = (status) => {
    switch (status) {
      case "POSTED":
        return "approved";
      case "CASH_PENDING":
        return "cash_pending";
      case "REJECTED":
        return "rejected";
      default:
        return "draft";
    }
  };

  // Маппинг данных из Redux в формат для отображения
  const receiptsData = useMemo(() => {
    if (activeTab !== "receipts") return [];
    return (documents || []).map((doc, index) => ({
      id: doc.id,
      number: doc.number || getDocumentNumber(index, "ЧЕК"),
      date:
        doc.date || doc.created_at
          ? new Date(doc.date || doc.created_at).toLocaleString("ru-RU", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—",
      client:
        doc.counterparty?.name ||
        doc.counterparty_display_name ||
        doc.counterparty ||
        "Без клиента",
      products: doc.items?.length || 0,
      amount: doc.total || "0.00",
      discount_percent: doc.discount_percent ?? null,
      discount_amount: doc.discount_amount ?? null,
      status: getStatusLabel(doc.status),
      statusType: getStatusType(doc.status),
      rawStatus: doc.status,
      payment_kind: doc.payment_kind,
      document: doc,
    }));
  }, [documents, activeTab, currentPage]);

  const invoicesData = useMemo(() => {
    if (activeTab !== "invoices") return [];
    return (documents || []).map((doc, index) => ({
      id: doc.id,
      number: doc.number || getDocumentNumber(index, "НАКЛ"),
      date:
        doc.date || doc.created_at
          ? new Date(doc.date || doc.created_at).toLocaleDateString("ru-RU", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "—",
      counterparty:
        doc.counterparty?.name ||
        doc.counterparty_display_name ||
        doc.counterparty ||
        "Без контрагента",
      positions: doc.items?.length || 0,
      amount: doc.total || "0.00",
      discount_percent: doc.discount_percent ?? null,
      discount_amount: doc.discount_amount ?? null,
      status: getStatusLabel(doc.status),
      statusType: getStatusType(doc.status),
      rawStatus: doc.status,
      payment_kind: doc.payment_kind,
      document: doc,
    }));
  }, [documents, activeTab, currentPage]);

  // Обновление URL только при изменении страницы (без поиска)
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage > 1) {
      params.set("page", currentPage.toString());
    }
    const newSearchString = params.toString();
    const currentSearchString = searchParams.toString();
    // Обновляем URL только если параметры действительно изменились
    if (newSearchString !== currentSearchString) {
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Сброс страницы при смене таба или типа документа
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, docType]);

  // Загрузка данных через Redux при изменении таба, страницы, типа документа или поиска
  useEffect(() => {
    if (activeTab === "receipts" || activeTab === "invoices") {
      // Используем новый warehouse API
      const params = {
        page: currentPage,
        page_size: 100, // По умолчанию 100 согласно документации
        ...(docType && { doc_type: docType }), // Добавляем doc_type только если выбран
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        // Дополнительные фильтры из документации:
        // status, warehouse_from, warehouse_to, counterparty - можно добавить позже через UI
      };
      dispatch(fetchWarehouseDocuments(params));
    }
  }, [dispatch, activeTab, currentPage, debouncedSearchTerm, docType]);

  const getCurrentData = () => {
    switch (activeTab) {
      case "receipts":
        return receiptsData;
      case "invoices":
        return invoicesData;
      default:
        return [];
    }
  };

  // Расчет пагинации
  // Используем фиксированный размер страницы
  // Если есть next или previous, значит есть еще страницы
  const hasNextPage = !!documentsNext;
  const hasPrevPage = !!documentsPrevious;

  // Если есть следующая страница, значит текущая не последняя
  // Если есть предыдущая страница, значит текущая не первая
  // Рассчитываем общее количество страниц на основе count и размера страницы
  const totalPages =
    documentsCount && PAGE_SIZE ? Math.ceil(documentsCount / PAGE_SIZE) : 1;

  const handlePageChange = (newPage) => {
    if (newPage < 1 || (totalPages && newPage > totalPages)) return;
    setCurrentPage(newPage);
  };

  const handleView = (item) => {
    if (activeTab === "receipts") {
      setPreviewReceiptId(item.id);
    } else if (activeTab === "invoices") {
      setPreviewInvoiceId(item.id);
    }
  };

  const handleEdit = (item) => {
    setEditReceiptId(item.id);
    setEditReceiptData({
      ...item,
      documentType: activeTab === "invoices" ? "invoice" : "receipt",
    });
  };

  const handleEditFromPreview = (receiptData) => {
    setPreviewReceiptId(null);
    setPreviewInvoiceId(null);
    setEditReceiptId(receiptData.id);
    setEditReceiptData({
      ...receiptData,
      documentType: activeTab === "invoices" ? "invoice" : "receipt",
    });
  };

  const handleSaved = () => {
    // Перезагружаем документы после сохранения
    if (activeTab === "receipts" || activeTab === "invoices") {
      const params = {
        page: currentPage,
        page_size: 100,
        ...(docType && { doc_type: docType }),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
      };
      dispatch(fetchWarehouseDocuments(params));
    }
  };

  // Проведение документа
  const handlePost = async (item) => {
    if (!item?.id) return;
    confirm(`Провести документ ${item.number}?`, async (ok) => {
      if (!ok) return;
      try {
        const result = await dispatch(
          postWarehouseDocument({ id: item.id, allowNegative: false })
        );
        if (postWarehouseDocument.fulfilled.match(result)) {
          alert("Документ успешно проведен");
          // Перезагружаем список документов
          handleSaved();
        } else {
          const error = result.payload || result.error;
          const errorMessage =
            error?.detail ||
            error?.message ||
            "Ошибка при проведении документа";
          alert("Ошибка: " + errorMessage);
        }
      } catch (error) {
        console.error("Ошибка при проведении документа:", error);
        alert(
          "Ошибка: " + (error?.message || "Не удалось провести документ"),
          true
        );
      }
    });
  };

  // Отмена проведения документа (DRAFT или CASH_PENDING → откат склада, документ в DRAFT)
  const handleUnpost = async (item) => {
    if (!item?.id) return;

    confirm(`Отменить проведение документа ${item.number}?`, async (ok) => {
      if (!ok) return;
      try {
        const result = await dispatch(unpostWarehouseDocument(item.id));
        if (unpostWarehouseDocument.fulfilled.match(result)) {
          alert("Проведение документа отменено");
          handleSaved();
        } else {
          const error = result.payload || result.error;
          const errorMessage =
            error?.detail || error?.message || "Ошибка при отмене проведения";
          alert("Ошибка: " + errorMessage);
        }
      } catch (error) {
        console.error("Ошибка при отмене проведения документа:", error);
        alert(
          "Ошибка: " +
            (error?.message || "Не удалось отменить проведение документа"),
          true
        );
      }
    });
  };

  // Подтвердить кассой (CASH_PENDING → POSTED, при payment_kind=cash создаётся денежный документ)
  const handleCashApprove = async (item) => {
    if (!item?.id) return;
    confirm(`Подтвердить документ ${item.number} в кассе?`, async (ok) => {
      if (!ok) return;
      try {
        const result = await dispatch(
          cashApproveWarehouseDocument({ id: item.id })
        );
        if (cashApproveWarehouseDocument.fulfilled.match(result)) {
          alert("Документ подтверждён кассой");
          handleSaved();
        } else {
          const error = result.payload || result.error;
          const errorMessage =
            error?.detail ||
            error?.message ||
            "Ошибка при подтверждении кассой";
          alert("Ошибка: " + errorMessage);
        }
      } catch (error) {
        console.error("Ошибка при подтверждении кассой:", error);
        alert("Ошибка: " + (error?.message || "Не удалось подтвердить"), true);
      }
    });
  };

  // Отклонить кассой (склад откатывается, документ → REJECTED)
  const handleCashReject = async (item) => {
    if (!item?.id) return;
    confirm(
      `Отклонить документ ${item.number}? Склад будет откатан.`,
      async (ok) => {
        if (!ok) return;
        try {
          const result = await dispatch(
            cashRejectWarehouseDocument({ id: item.id })
          );
          if (cashRejectWarehouseDocument.fulfilled.match(result)) {
            alert("Документ отклонён");
            handleSaved();
          } else {
            const error = result.payload || result.error;
            const errorMessage =
              error?.detail || error?.message || "Ошибка при отклонении";
            alert("Ошибка: " + errorMessage);
          }
        } catch (error) {
          console.error("Ошибка при отклонении:", error);
          alert("Ошибка: " + (error?.message || "Не удалось отклонить"), true);
        }
      }
    );
  };

  const handlePrint = async (item) => {
    if (!item?.id) return;

    try {
      if (activeTab === "invoices") {
        // Для накладной используем новый warehouse API
        const result = await dispatch(getWarehouseDocumentById(item.id));
        if (getWarehouseDocumentById.fulfilled.match(result)) {
          const doc = result.payload;

          // Преобразуем данные в формат для PDF
          const seller = {
            id: company?.id || "",
            name: company?.name || "",
            inn: company?.inn || "",
            okpo: company?.okpo || "",
            score: company?.score || "",
            bik: company?.bik || "",
            address: company?.address || "",
            phone: company?.phone || null,
            email: company?.email || null,
          };
          const buyer = doc.counterparty
            ? {
                id: doc.counterparty.id,
                name: doc.counterparty.name || "",
                inn: doc.counterparty.inn || "",
                okpo: doc.counterparty.okpo || "",
                score: doc.counterparty.score || "",
                bik: doc.counterparty.bik || "",
                address: doc.counterparty.address || "",
                phone: doc.counterparty.phone || null,
                email: doc.counterparty.email || null,
              }
            : null;
          const docDiscountPercent = Number(doc.discount_percent || 0);
          const docDiscountAmount = Number(doc.discount_amount || 0);

          const items = Array.isArray(doc.items)
            ? doc.items.map((item) => {
                const price = Number(item.price || 0);
                const qty = Number(item.qty || 0);
                // Сумма по строке = цена × кол-во (как на накладной из CreateSaleDocument), не используем line_total с бэка
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
                  total: String(lineTotal.toFixed(2)),
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
          const warehouseName =
            doc.warehouse_from?.name || doc.warehouse?.name || "";
          const warehouseToName = doc.warehouse_to?.name || "";

          const invoiceData = {
            doc_type: doc.doc_type || "SALE",
            document: {
              type: doc.doc_type?.toLowerCase() || "sale_invoice",
              doc_type: doc.doc_type || "SALE",
              title: "Накладная",
              id: doc.id,
              number: doc.number || "",
              date: doc.date || doc.created_at?.split("T")[0] || "",
              datetime: doc.created_at || doc.date || "",
              created_at: doc.created_at || "",
              discount_percent: docDiscountPercent,
              discount_amount: docDiscountAmount,
              discount_total: docDiscountAmount,
            },
            seller,
            buyer,
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

          if (!invoiceData) {
            throw new Error("Нет данных для генерации PDF");
          }

          // Генерируем PDF из JSON используя InvoicePdfDocument
          const blob = await pdf(
            <InvoicePdfDocument data={invoiceData} />
          ).toBlob();

          const fileName = `invoice_${
            invoiceData?.document?.number || item.id
          }.pdf`;

          // Скачиваем файл
          const url = window.URL.createObjectURL(blob);
          const a = window.document.createElement("a");
          a.href = url;
          a.download = fileName;
          window.document.body.appendChild(a);
          a.click();
          window.document.body.removeChild(a);
          setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        } else {
          throw new Error("Не удалось загрузить данные накладной");
        }
      } else {
        // Для чека печатаем через USB принтер
        const isPrinterConnected = await checkPrinterConnection();

        if (!isPrinterConnected) {
          alert(
            "Принтер не подключен. Пожалуйста, подключите принтер перед печатью.",
            true
          );
          return;
        }

        const result = await dispatch(getReceiptJson(item.id));
        if (result.type === "products/getReceiptJson/fulfilled") {
          const documentData = result.payload;

          if (documentData && Array.isArray(documentData.items)) {
            // Преобразуем данные в формат для печати
            const printData = {
              items: documentData.items.map((item) => ({
                name: item.name,
                qty: parseFloat(item.qty),
                price: parseFloat(item.unit_price),
                total: parseFloat(item.total),
              })),
              total: parseFloat(documentData.totals?.total || 0),
              subtotal: parseFloat(documentData.totals?.subtotal || 0),
              discount_total: parseFloat(
                documentData.totals?.discount_total || 0
              ),
              company: documentData.company?.name || "",
              payment: documentData.payment || {},
            };
            await handleCheckoutResponseForPrinting(printData);
          } else {
            throw new Error("Нет данных для печати");
          }
        } else {
          throw new Error("Не удалось загрузить данные чека для печати");
        }
      }
    } catch (printError) {
      console.error("Ошибка при печати:", printError);
      alert(
        "Ошибка при печати: " +
          (printError.message || "Неизвестная ошибка", true)
      );
    }
  };

  const formatAmount = (amount) => {
    return parseFloat(amount || 0).toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="documents">
      {/* Header with search and filters */}
      <div className="documents__header">
        <div className="documents__search">
          <Search size={20} className="documents__search-icon" />
          <input
            type="text"
            className="documents__search-input"
            placeholder="Поиск по номеру или контрагенту..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="documents__header-actions">
          <button
            className="documents__create-btn"
            onClick={() =>
              navigate("/crm/warehouse/documents/create", {
                state: { docType: docType || "SALE" },
              })
            }
          >
            <Plus size={18} />
            Создать
          </button>
          <button
            className="documents__filter-btn"
            onClick={() => setShowReconciliationModal(true)}
            style={{ marginRight: 10 }}
          >
            Создать акт сверки
          </button>
          {/* <button className="documents__filter-btn">
            <Filter size={18} />
            Фильтры
          </button> */}
          {/* <button className="documents__period-btn">
            <Calendar size={18} />
            Период
          </button> */}
        </div>
      </div>

      {/* Tabs + view mode */}
      <div className="documents__tabs-row">
        <div className="documents__tabs">
          <button
            className={`documents__tab ${
              activeTab === "receipts" ? "documents__tab--active" : ""
            }`}
            onClick={() => setActiveTab("receipts")}
          >
            Чеки
          </button>
          <button
            className={`documents__tab ${
              activeTab === "invoices" ? "documents__tab--active" : ""
            }`}
            onClick={() => setActiveTab("invoices")}
          >
            Накладные
          </button>
        </div>
        <div className="documents__view-toggle">
          <button
            type="button"
            className={`documents__view-btn ${
              viewMode === "table" ? "documents__view-btn--active" : ""
            }`}
            onClick={() => setViewMode("table")}
            title="Таблица"
          >
            <List size={18} />
          </button>
          <button
            type="button"
            className={`documents__view-btn ${
              viewMode === "cards" ? "documents__view-btn--active" : ""
            }`}
            onClick={() => setViewMode("cards")}
            title="Карточки"
          >
            <LayoutGrid size={18} />
          </button>
        </div>
      </div>
      <DataContainer>
        {/* Table */}
        {viewMode === "table" && (
          <div className="documents__table-wrapper">
            <table className="documents__table">
              <thead>
                <tr>
                  {activeTab === "receipts" && (
                    <>
                      <th>Номер</th>
                      <th>Дата и время</th>
                      <th>Контрагент</th>
                      <th>Товаров</th>
                      <th>Сумма</th>
                      <th>Скидка</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </>
                  )}
                  {activeTab === "invoices" && (
                    <>
                      <th>Номер</th>
                      <th>Дата</th>
                      <th>Контрагент</th>
                      <th>Позиций</th>
                      <th>Сумма</th>
                      <th>Скидка</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {documentsLoading ? (
                  <tr>
                    <td colSpan={8} className="documents__empty">
                      Загрузка...
                    </td>
                  </tr>
                ) : getCurrentData().length === 0 ? (
                  <tr>
                    <td colSpan={8} className="documents__empty">
                      Документы не найдены
                    </td>
                  </tr>
                ) : (
                  getCurrentData().map((item, idx) => (
                    <tr key={item.id}>
                      {activeTab === "receipts" && (
                        <>
                          <td>{item.number}</td>
                          <td>{item.date}</td>
                          <td>{item.client}</td>
                          <td>{item.products}</td>
                          <td>{formatAmount(item.amount)} сом</td>
                          <td>
                            {item.discount_amount != null &&
                            Number(item.discount_amount) !== 0
                              ? `${formatAmount(item.discount_amount)} сом${
                                  item.discount_percent != null &&
                                  Number(item.discount_percent) !== 0
                                    ? ` (${item.discount_percent}%)`
                                    : ""
                                }`
                              : "—"}
                          </td>
                          <td>
                            <span
                              className={`documents__status documents__status--${item.statusType}`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td>
                            <div className="documents__actions">
                              <button
                                className="documents__action-btn"
                                onClick={() => handleView(item)}
                                title="Просмотр"
                              >
                                <Eye size={18} />
                              </button>
                              {/* <button
                            className="documents__action-btn"
                            onClick={() => handleEdit(item)}
                            title="Редактировать"
                          >
                            <Pencil size={18} />
                          </button> */}
                              <button
                                className="documents__action-btn"
                                onClick={() => handlePrint(item)}
                                title="Печать"
                              >
                                <Printer size={18} />
                              </button>
                              {item.rawStatus === "DRAFT" && (
                                <button
                                  className="documents__action-btn"
                                  onClick={() => handlePost(item)}
                                  title="Провести документ"
                                >
                                  <Check size={18} />
                                </button>
                              )}
                              {item.rawStatus === "CASH_PENDING" && (
                                <>
                                  <button
                                    type="button"
                                    className="documents__action-btn documents__action-btn--approve"
                                    onClick={() => handleCashApprove(item)}
                                    title="Подтвердить кассой"
                                  >
                                    <Check size={18} />
                                  </button>
                                  <button
                                    type="button"
                                    className="documents__action-btn documents__action-btn--reject"
                                    onClick={() => handleCashReject(item)}
                                    title="Отклонить"
                                  >
                                    <X size={18} />
                                  </button>
                                  <button
                                    type="button"
                                    className="documents__action-btn documents__action-btn--unpost"
                                    onClick={() => handleUnpost(item)}
                                    title="Отменить проведение"
                                  >
                                    <Undo2 size={18} />
                                  </button>
                                </>
                              )}
                              {item.rawStatus === "POSTED" && (
                                <button
                                  type="button"
                                  className="documents__action-btn documents__action-btn--unpost"
                                  onClick={() => handleUnpost(item)}
                                  title="Отменить проведение"
                                >
                                  <Undo2 size={18} />
                                </button>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                      {activeTab === "invoices" && (
                        <>
                          <td>{item.number}</td>
                          <td>{item.date}</td>
                          <td>{item.counterparty}</td>
                          <td>{item.positions}</td>
                          <td>{formatAmount(item.amount)} сом</td>
                          <td>
                            {item.discount_amount != null &&
                            Number(item.discount_amount) !== 0
                              ? `${formatAmount(item.discount_amount)} сом${
                                  item.discount_percent != null &&
                                  Number(item.discount_percent) !== 0
                                    ? ` (${item.discount_percent}%)`
                                    : ""
                                }`
                              : "—"}
                          </td>
                          <td>
                            <span
                              className={`documents__status documents__status--${item.statusType}`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td>
                            <div className="documents__actions">
                              <button
                                className="documents__action-btn"
                                onClick={() => handleView(item)}
                                title="Просмотр"
                              >
                                <Eye size={18} />
                              </button>
                              {/* <button
                            className="documents__action-btn"
                            onClick={() => handleEdit(item)}
                            title="Редактировать"
                          >
                            <Pencil size={18} />
                          </button> */}
                              <button
                                className="documents__action-btn"
                                onClick={() => handlePrint(item)}
                                title="Печать"
                              >
                                <Printer size={18} />
                              </button>
                              {item.rawStatus === "DRAFT" && (
                                <button
                                  className="documents__action-btn"
                                  onClick={() => handlePost(item)}
                                  title="Провести документ"
                                >
                                  <Check size={18} />
                                </button>
                              )}
                              {item.rawStatus === "CASH_PENDING" && (
                                <>
                                  <button
                                    type="button"
                                    className="documents__action-btn documents__action-btn--approve"
                                    onClick={() => handleCashApprove(item)}
                                    title="Подтвердить кассой"
                                  >
                                    <Check size={18} />
                                  </button>
                                  <button
                                    type="button"
                                    className="documents__action-btn documents__action-btn--reject"
                                    onClick={() => handleCashReject(item)}
                                    title="Отклонить"
                                  >
                                    <X size={18} />
                                  </button>
                                  <button
                                    type="button"
                                    className="documents__action-btn documents__action-btn--unpost"
                                    onClick={() => handleUnpost(item)}
                                    title="Отменить проведение"
                                  >
                                    <Undo2 size={18} />
                                  </button>
                                </>
                              )}
                              {item.rawStatus === "POSTED" && (
                                <button
                                  type="button"
                                  className="documents__action-btn documents__action-btn--unpost"
                                  onClick={() => handleUnpost(item)}
                                  title="Отменить проведение"
                                >
                                  <Undo2 size={18} />
                                </button>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Карточки */}
        {viewMode === "cards" && (
          <div className="documents__cards">
            {documentsLoading ? (
              <div className="documents__cards-empty">Загрузка...</div>
            ) : getCurrentData().length === 0 ? (
              <div className="documents__cards-empty">Документы не найдены</div>
            ) : (
              getCurrentData().map((item) => (
                <div key={item.id} className="documents__card">
                  <div className="documents__card-header">
                    <span className="documents__card-number">
                      {item.number}
                    </span>
                    <span
                      className={`documents__status documents__status--${item.statusType}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div className="documents__card-body">
                    <div className="documents__card-row">
                      <span className="documents__card-label">
                        {activeTab === "receipts" ? "Дата и время" : "Дата"}
                      </span>
                      <span className="documents__card-value">{item.date}</span>
                    </div>
                    <div className="documents__card-row">
                      <span className="documents__card-label">Контрагент</span>
                      <span className="documents__card-value">
                        {activeTab === "receipts"
                          ? item.client
                          : item.counterparty}
                      </span>
                    </div>
                    <div className="documents__card-row">
                      <span className="documents__card-label">
                        {activeTab === "receipts" ? "Товаров" : "Позиций"}
                      </span>
                      <span className="documents__card-value">
                        {activeTab === "receipts"
                          ? item.products
                          : item.positions}
                      </span>
                    </div>
                    <div className="documents__card-row documents__card-row--amount">
                      <span className="documents__card-label">Сумма</span>
                      <span className="documents__card-value">
                        {formatAmount(item.amount)} сом
                      </span>
                    </div>
                    {item.discount_amount != null &&
                      Number(item.discount_amount) !== 0 && (
                        <div className="documents__card-row documents__card-row--discount">
                          <span className="documents__card-label">Скидка</span>
                          <span className="documents__card-value">
                            {formatAmount(item.discount_amount)} сом
                            {item.discount_percent != null &&
                            Number(item.discount_percent) !== 0
                              ? ` (${item.discount_percent}%)`
                              : ""}
                          </span>
                        </div>
                      )}
                  </div>
                  <div className="documents__card-actions">
                    <button
                      className="documents__action-btn"
                      onClick={() => handleView(item)}
                      title="Просмотр"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      className="documents__action-btn"
                      onClick={() => handlePrint(item)}
                      title="Печать"
                    >
                      <Printer size={18} />
                    </button>
                    {item.rawStatus === "DRAFT" && (
                      <button
                        className="documents__action-btn"
                        onClick={() => handlePost(item)}
                        title="Провести документ"
                      >
                        <Check size={18} />
                      </button>
                    )}
                    {item.rawStatus === "CASH_PENDING" && (
                      <>
                        <button
                          type="button"
                          className="documents__action-btn documents__action-btn--approve"
                          onClick={() => handleCashApprove(item)}
                          title="Подтвердить кассой"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          type="button"
                          className="documents__action-btn documents__action-btn--reject"
                          onClick={() => handleCashReject(item)}
                          title="Отклонить"
                        >
                          <X size={18} />
                        </button>
                        <button
                          type="button"
                          className="documents__action-btn documents__action-btn--unpost"
                          onClick={() => handleUnpost(item)}
                          title="Отменить проведение"
                        >
                          <Undo2 size={18} />
                        </button>
                      </>
                    )}
                    {item.rawStatus === "POSTED" && (
                      <button
                        type="button"
                        className="documents__action-btn documents__action-btn--unpost"
                        onClick={() => handleUnpost(item)}
                        title="Отменить проведение"
                      >
                        <Undo2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </DataContainer>

      {/* Пагинация для чеков и накладных */}
      {totalPages > 1 && (
        <div className="documents__pagination">
          <button
            type="button"
            className="documents__pagination-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={
              currentPage === 1 || documentsLoading || !documentsPrevious
            }
          >
            Назад
          </button>
          <span className="documents__pagination-info">
            Страница {currentPage} из {totalPages || 1}
            {documentsCount && ` (${documentsCount} документов)`}
          </span>
          <button
            type="button"
            className="documents__pagination-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={
              documentsLoading ||
              !documentsNext ||
              (totalPages && currentPage >= totalPages)
            }
          >
            Вперед
          </button>
        </div>
      )}

      <ReconciliationModal
        open={showReconciliationModal}
        onClose={() => setShowReconciliationModal(false)}
      />

      {previewReceiptId && (
        <ReceiptPreviewModal
          receiptId={previewReceiptId}
          document={
            receiptsData.find((item) => item.id === previewReceiptId)?.document
          }
          onClose={() => setPreviewReceiptId(null)}
          onEdit={handleEditFromPreview}
        />
      )}

      {previewInvoiceId && (
        <InvoicePreviewModal
          invoiceId={previewInvoiceId}
          document={
            invoicesData.find((item) => item.id === previewInvoiceId)?.document
          }
          onClose={() => setPreviewInvoiceId(null)}
          onEdit={handleEditFromPreview}
        />
      )}

      {editReceiptId && (
        <ReceiptEditModal
          receiptId={editReceiptId}
          receiptData={editReceiptData}
          documentType={activeTab === "invoices" ? "invoice" : "receipt"}
          onClose={() => {
            setEditReceiptId(null);
            setEditReceiptData(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

export default Documents;
