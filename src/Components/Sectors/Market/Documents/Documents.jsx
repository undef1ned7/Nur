import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Filter,
  Calendar,
  Eye,
  Pencil,
  Printer,
  Plus,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";
import {
  fetchDocuments,
  getReceiptJson,
  getInvoiceJson,
} from "../../../../store/creators/saleThunk";
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

const Documents = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    documents,
    documentsCount,
    documentsNext,
    documentsPrevious,
    documentsLoading,
  } = useSelector((state) => state.sale);

  const [searchParams, setSearchParams] = useSearchParams();
  const pageFromUrl = parseInt(searchParams.get("page") || "1", 10);

  const [activeTab, setActiveTab] = useState("receipts");
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
  const PAGE_SIZE = 100;
  const getDocumentNumber = (index, prefix = "ЧЕК") => {
    const sequentialNumber = (currentPage - 1) * PAGE_SIZE + index + 1;
    return `${prefix}-${String(sequentialNumber).padStart(5, "0")}`;
  };

  // Маппинг данных из Redux в формат для отображения
  const receiptsData = useMemo(() => {
    if (activeTab !== "receipts") return [];
    return (documents || []).map((sale, index) => ({
      id: sale.id,
      number: getDocumentNumber(index, "ЧЕК"),
      date: sale.created_at
        ? new Date(sale.created_at).toLocaleString("ru-RU", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
      client:
        sale.client?.full_name ||
        sale.client_name ||
        sale.client ||
        "Без клиента",
      products: sale.items?.length || 0,
      amount: sale.total || "0.00",
      status: sale.status === "paid" ? "Проведен" : "Черновик",
      statusType: sale.status === "paid" ? "approved" : "draft",
    }));
  }, [documents, activeTab, currentPage]);

  const invoicesData = useMemo(() => {
    if (activeTab !== "invoices") return [];
    return (documents || []).map((sale, index) => ({
      id: sale.id,
      number: getDocumentNumber(index, "НАКЛ"),
      date: sale.created_at
        ? new Date(sale.created_at).toLocaleDateString("ru-RU", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "—",
      counterparty:
        sale.client?.full_name ||
        sale.client_name ||
        sale.client ||
        "Без контрагента",
      positions: sale.items?.length || 0,
      amount: sale.total || "0.00",
      status: sale.status === "paid" ? "Проведен" : "Черновик",
      statusType: sale.status === "paid" ? "approved" : "draft",
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

  // Сброс страницы при смене таба
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // Загрузка данных через Redux при изменении таба, страницы или поиска
  useEffect(() => {
    if (activeTab === "receipts" || activeTab === "invoices") {
      dispatch(
        fetchDocuments({
          page: currentPage,
          search: debouncedSearchTerm,
        })
      );
    }
  }, [dispatch, activeTab, currentPage, debouncedSearchTerm]);

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
      dispatch(
        fetchDocuments({
          page: currentPage,
          search: debouncedSearchTerm,
        })
      );
    }
  };

  const handlePrint = async (item) => {
    if (!item?.id) return;

    try {
      if (activeTab === "invoices") {
        // Для накладной получаем JSON данные и генерируем PDF через InvoicePdfDocument
        const result = await dispatch(getInvoiceJson(item.id));
        if (getInvoiceJson.fulfilled.match(result)) {
          const invoiceData = result.payload;

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
            "Принтер не подключен. Пожалуйста, подключите принтер перед печатью."
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
        "Ошибка при печати: " + (printError.message || "Неизвестная ошибка")
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
            onClick={() => navigate("/crm/market/documents/create")}
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

      {/* Tabs */}
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

      {/* Table */}
      <div className="documents__table-wrapper">
        <table className="documents__table">
          <thead>
            <tr>
              {activeTab === "receipts" && (
                <>
                  <th>Номер</th>
                  <th>Дата и время</th>
                  <th>Клиент</th>
                  <th>Товаров</th>
                  <th>Сумма</th>
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
                  <th>Статус</th>
                  <th>Действия</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {documentsLoading ? (
              <tr>
                <td colSpan={7} className="documents__empty">
                  Загрузка...
                </td>
              </tr>
            ) : getCurrentData().length === 0 ? (
              <tr>
                <td colSpan={7} className="documents__empty">
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
          onClose={() => setPreviewReceiptId(null)}
          onEdit={handleEditFromPreview}
        />
      )}

      {previewInvoiceId && (
        <InvoicePreviewModal
          invoiceId={previewInvoiceId}
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
