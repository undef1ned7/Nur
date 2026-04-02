import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
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
  Download,
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
  createSaleFromAgentCartAsync,
} from "../../../../store/creators/warehouseThunk";
import { useUser } from "../../../../store/slices/userSlice";
import {
  handleCheckoutResponseForPrinting,
  checkPrinterConnection,
} from "../../../pages/Sell/services/printService";
import ReconciliationModal from "./components/ReconciliationModal";
import CreateSaleFromCartModal from "./components/CreateSaleFromCartModal";
import ReceiptPreviewModal from "./components/ReceiptPreviewModal";
import ReceiptEditModal from "./components/ReceiptEditModal";
import InvoicePreviewModal from "./components/InvoicePreviewModal";
import InvoicePdfDocument from "./components/InvoicePdfDocument";
import "./Documents.scss";
import { useAlert, useConfirm } from "../../../../hooks/useDialog";
import DataContainer from "../../../common/DataContainer/DataContainer";
import warehouseAPI, { getOwnerAnalytics } from "../../../../api/warehouse";

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

/** Дата/время в списке документов: 02.04.2026:00:35:20 */
const formatDocumentDateTime = (value) => {
  if (value == null || value === "") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}:${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const Documents = () => {
  const alert = useAlert();
  const confirm = useConfirm();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { docType: docTypeParam } = useParams();
  const { company, profile } = useUser();
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

  const [activeTab, setActiveTab] = useState("invoices");
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

  // Фильтр по агенту (только для продаж; владелец/админ)
  const showAgentFilter =
    docType === "SALE" &&
    (profile?.role === "owner" || profile?.role === "admin");
  const [agentFilterId, setAgentFilterId] = useState("");
  const [agentsList, setAgentsList] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  // Продажи по заявкам (одобренные заявки агентов, только для SALE)
  const [agentSalesCarts, setAgentSalesCarts] = useState([]);
  const [agentSalesLoading, setAgentSalesLoading] = useState(false);
  const [agentSalesError, setAgentSalesError] = useState("");
  const [agentSaleDocumentById, setAgentSaleDocumentById] = useState({});
  const [createSaleModalCart, setCreateSaleModalCart] = useState(null);

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

  // Загрузка списка агентов для фильтра (продажи, владелец/админ)
  useEffect(() => {
    if (!showAgentFilter) {
      setAgentsList([]);
      return;
    }
    let cancelled = false;
    setAgentsLoading(true);
    getOwnerAnalytics({ period: "month" })
      .then((data) => {
        if (cancelled) return;
        const top = data?.top_agents || {};
        const bySales = top.by_sales || [];
        const byReceived = top.by_received || [];
        const map = new Map();
        [...bySales, ...byReceived].forEach((a) => {
          const id = a.agent_id;
          if (id && !map.has(id)) {
            map.set(id, a.agent_name || id);
          }
        });
        setAgentsList(
          Array.from(map.entries()).map(([id, name]) => ({ id, name })),
        );
      })
      .catch(() => {
        if (!cancelled) setAgentsList([]);
      })
      .finally(() => {
        if (!cancelled) setAgentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showAgentFilter]);

  // Загрузка продаж по заявкам (все одобренные заявки агентов)
  const loadAgentSalesCarts = useCallback(async () => {
    if (docType !== "SALE") return;
    setAgentSalesLoading(true);
    setAgentSalesError("");
    try {
      const data = await warehouseAPI.listAgentCarts({
        status: "approved",
        page_size: 200,
      });
      const list = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
          ? data
          : [];
      setAgentSalesCarts(list);
    } catch (e) {
      console.error("Ошибка загрузки продаж по заявкам:", e);
      setAgentSalesCarts([]);
      setAgentSalesError(
        e?.detail || e?.message || "Не удалось загрузить продажи по заявкам",
      );
    } finally {
      setAgentSalesLoading(false);
    }
  }, [docType]);

  useEffect(() => {
    if (activeTab === "agent_sales" && docType === "SALE") {
      loadAgentSalesCarts();
    }
  }, [activeTab, docType, loadAgentSalesCarts]);

  // Кэш «уже запрошены» для подгрузки документов заявок (избегаем дублей и лишних зависимостей)
  const agentSaleDocRequestedRef = useRef({});
  // Подгрузка документов для заявок, у которых уже есть sale_document (для статуса и кнопок)
  useEffect(() => {
    if (activeTab !== "agent_sales" || agentSalesCarts.length === 0) return;
    const ids = agentSalesCarts
      .filter((c) => c.sale_document)
      .map((c) => c.sale_document);
    if (ids.length === 0) return;
    let cancelled = false;
    ids.forEach((docId) => {
      if (agentSaleDocRequestedRef.current[docId]) return;
      agentSaleDocRequestedRef.current[docId] = true;
      warehouseAPI
        .getDocumentById(docId)
        .then((doc) => {
          if (!cancelled)
            setAgentSaleDocumentById((prev) => ({ ...prev, [docId]: doc }));
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, agentSalesCarts]);

  // Функция для генерации порядкового номера чека/накладной
  // Используем фиксированный размер страницы (обычно API возвращает 20 элементов)
  const PAGE_SIZE = 50;
  const getDocumentNumber = (index, prefix = "ЧЕК") => {
    const sequentialNumber = (currentPage - 1) * PAGE_SIZE + index + 1;
    return `${prefix}-${String(sequentialNumber).padStart(5, "0")}`;
  };

  // Сумма документа: если total не пришёл (черновик), считаем по позициям
  const getDocumentAmount = (doc) => {
    const fromBackend = Number(doc.total);
    if (fromBackend > 0) return fromBackend;
    const items = doc.items;
    if (!Array.isArray(items) || items.length === 0) return 0;
    const subtotal = items.reduce(
      (sum, item) =>
        sum +
        (Number(item.price ?? item.unit_price ?? 0) || 0) *
          (Number(item.qty ?? item.quantity ?? 0) || 0),
      0,
    );
    const itemsDiscountTotal = items.reduce(
      (sum, item) =>
        sum +
        ((Number(item.price ?? item.unit_price ?? 0) || 0) *
          (Number(item.qty ?? item.quantity ?? 0) || 0) *
          (Number(item.discount_percent ?? 0) || 0)) /
          100,
      0,
    );
    const docDiscountAmount = Number(doc.discount_amount ?? 0) || 0;
    const totalDiscount = itemsDiscountTotal + docDiscountAmount;
    return Math.max(0, subtotal - totalDiscount);
  };

  // Маппинг статусов: DRAFT | SALE_REQUEST | CASH_PENDING | POSTED | REJECTED
  const getStatusLabel = (status) => {
    switch (status) {
      case "POSTED":
        return "Проведён";
      case "CASH_PENDING":
        return "Ожидает кассы";
      case "REJECTED":
        return "Отклонён";
      case "SALE_REQUEST":
        return "Заявка на продажу";
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
      case "SALE_REQUEST":
        return "sale_request";
      default:
        return "draft";
    }
  };

  /** Черновик и заявка на продажу — одни и те же действия (редактирование, проведение). */
  const isSaleDraftLikeStatus = (status) =>
    status === "DRAFT" || status === "SALE_REQUEST";
  const isSaleRequestStatus = (status) => status === "SALE_REQUEST";

  // Нормализация статуса согласно бизнес-правилу:
  // SALE + is_sale_request=true -> SALE_REQUEST.
  const resolveDocumentStatus = (doc) => {
    if (!doc) return "";
    if (doc.doc_type === "SALE" && doc.is_sale_request === true) {
      return "SALE_REQUEST";
    }
    return doc.status;
  };

  // Фильтрация по агенту (для продаж)
  const filteredDocuments = useMemo(() => {
    const list = documents || [];
    if (docType !== "SALE" || !agentFilterId) return list;
    return list.filter(
      (doc) => String(doc.agent || "") === String(agentFilterId),
    );
  }, [documents, docType, agentFilterId]);

  // В табе "Продажи по заявкам" источник — /warehouse/documents?doc_type=SALE,
  // и показываем только SALE_REQUEST.
  const agentSalesRequestDocuments = useMemo(() => {
    return (documents || []).filter((doc) => {
      const resolvedStatus = resolveDocumentStatus(doc);
      const byAgent =
        !agentFilterId || String(doc.agent || "") === String(agentFilterId);
      return (
        doc.doc_type === "SALE" &&
        isSaleRequestStatus(resolvedStatus) &&
        byAgent
      );
    });
  }, [documents, agentFilterId]);

  // Маппинг данных из Redux в формат для отображения
  const receiptsData = useMemo(() => {
    if (activeTab !== "receipts") return [];
    return (filteredDocuments || []).map((doc, index) => {
      const resolvedStatus = resolveDocumentStatus(doc);
      return {
        id: doc.id,
        number: doc.number || getDocumentNumber(index, "ЧЕК"),
        date: formatDocumentDateTime(doc.date || doc.created_at),
        client:
          doc.counterparty?.name ||
          doc.counterparty_display_name ||
          doc.counterparty ||
          "Без клиента",
        products: doc.items?.length || 0,
        amount: getDocumentAmount(doc),
        discount_percent: doc.discount_percent ?? null,
        discount_amount: doc.discount_amount ?? null,
        status: getStatusLabel(resolvedStatus),
        statusType: getStatusType(resolvedStatus),
        rawStatus: resolvedStatus,
        payment_kind: doc.payment_kind,
        document: doc,
        agentDisplay:
          doc.agent_display?.trim?.() ||
          (doc.agent ? `${String(doc.agent).slice(0, 8)}…` : "—"),
      };
    });
  }, [filteredDocuments, activeTab, currentPage]);

  const invoicesData = useMemo(() => {
    if (activeTab !== "invoices") return [];
    return (filteredDocuments || []).map((doc, index) => {
      const resolvedStatus = resolveDocumentStatus(doc);
      return {
        id: doc.id,
        number: doc.number || getDocumentNumber(index, "НАКЛ"),
        date: formatDocumentDateTime(doc.date || doc.created_at),
        counterparty:
          doc.counterparty?.name ||
          doc.counterparty_display_name ||
          doc.counterparty ||
          "Без контрагента",
        positions: doc.items?.length || 0,
        amount: getDocumentAmount(doc),
        discount_percent: doc.discount_percent ?? null,
        discount_amount: doc.discount_amount ?? null,
        status: getStatusLabel(resolvedStatus),
        statusType: getStatusType(resolvedStatus),
        rawStatus: resolvedStatus,
        payment_kind: doc.payment_kind,
        document: doc,
        agentDisplay:
          doc.agent_display?.trim?.() ||
          (doc.agent ? `${String(doc.agent).slice(0, 8)}…` : "—"),
      };
    });
  }, [filteredDocuments, activeTab, currentPage]);

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

  // Сброс страницы и фильтра по агенту при смене таба или типа документа
  useEffect(() => {
    setCurrentPage(1);
    if (docType !== "SALE") setAgentFilterId("");
  }, [activeTab, docType]);

  // Загрузка данных через Redux при изменении таба, страницы, типа документа или поиска
  useEffect(() => {
    if (
      activeTab === "receipts" ||
      activeTab === "invoices" ||
      activeTab === "agent_sales"
    ) {
      const requestDocType = activeTab === "agent_sales" ? "SALE" : docType;
      // Используем новый warehouse API
      const params = {
        page: currentPage,
        page_size: 100, // По умолчанию 100 согласно документации
        ...(requestDocType && { doc_type: requestDocType }),
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

  // Редактирование черновика: переход на страницу редактирования по id документа
  const handleEditDraft = (item) => {
    navigate(`/crm/warehouse/documents/edit/${item.id}`);
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
    if (
      activeTab === "receipts" ||
      activeTab === "invoices" ||
      activeTab === "agent_sales"
    ) {
      const requestDocType = activeTab === "agent_sales" ? "SALE" : docType;
      const params = {
        page: currentPage,
        page_size: 100,
        ...(requestDocType && { doc_type: requestDocType }),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
      };
      dispatch(fetchWarehouseDocuments(params));
    }
  };

  // Для SALE_REQUEST из списка документов открываем модалку создания продажи
  // по связанной заявке агента (cart.sale_document === document.id).
  const handleOpenCreateSaleFromRequest = async (doc) => {
    if (!doc?.id) return;
    let linkedCart = (agentSalesCarts || []).find(
      (cart) => String(cart.sale_document || "") === String(doc.id),
    );
    // Fallback: локальный список заявок может быть неполным (например, из-за фильтров по статусу).
    if (!linkedCart) {
      try {
        const data = await warehouseAPI.listAgentCarts({ page_size: 500 });
        const list = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
            ? data
            : [];
        linkedCart = list.find(
          (cart) => String(cart.sale_document || "") === String(doc.id),
        );
        if (linkedCart) {
          setAgentSalesCarts(list);
        }
      } catch (e) {
        console.error("Ошибка поиска связанной заявки:", e);
      }
    }
    if (!linkedCart) {
      alert(
        "Не найдена связанная заявка агента для этого документа. Возможно, заявка недоступна в текущем списке.",
        true,
      );
      return;
    }
    setCreateSaleModalCart(linkedCart);
  };

  // Обновить документ в локальном кэше (для продаж по заявкам)
  const refetchAgentSaleDoc = useCallback((docId) => {
    warehouseAPI
      .getDocumentById(docId)
      .then((doc) =>
        setAgentSaleDocumentById((prev) => ({ ...prev, [docId]: doc })),
      )
      .catch(() => {});
  }, []);

  // Проведение документа (options.onSuccess — для обновления UI продаж по заявкам)
  const handlePost = async (item, options) => {
    if (!item?.id) return;
    confirm(`Провести документ ${item.number}?`, async (ok) => {
      if (!ok) return;
      try {
        const result = await dispatch(
          postWarehouseDocument({ id: item.id, allowNegative: false }),
        );
        if (postWarehouseDocument.fulfilled.match(result)) {
          alert("Документ успешно проведен");
          handleSaved();
          options?.onSuccess?.();
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
          true,
        );
      }
    });
  };

  // Отмена проведения документа (DRAFT или CASH_PENDING → откат склада, документ в DRAFT)
  const handleUnpost = async (item, options) => {
    if (!item?.id) return;

    confirm(`Отменить проведение документа ${item.number}?`, async (ok) => {
      if (!ok) return;
      try {
        const result = await dispatch(unpostWarehouseDocument(item.id));
        if (unpostWarehouseDocument.fulfilled.match(result)) {
          alert("Проведение документа отменено");
          handleSaved();
          options?.onSuccess?.();
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
          true,
        );
      }
    });
  };

  // Подтвердить кассой (CASH_PENDING → POSTED, при payment_kind=cash создаётся денежный документ)
  const handleCashApprove = async (item, options) => {
    if (!item?.id) return;
    confirm(`Подтвердить документ ${item.number} в кассе?`, async (ok) => {
      if (!ok) return;
      try {
        const result = await dispatch(
          cashApproveWarehouseDocument({ id: item.id }),
        );
        if (cashApproveWarehouseDocument.fulfilled.match(result)) {
          alert("Документ подтверждён кассой");
          handleSaved();
          options?.onSuccess?.();
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
  const handleCashReject = async (item, options) => {
    if (!item?.id) return;
    confirm(
      `Отклонить документ ${item.number}? Склад будет откатан.`,
      async (ok) => {
        if (!ok) return;
        try {
          const result = await dispatch(
            cashRejectWarehouseDocument({ id: item.id }),
          );
          if (cashRejectWarehouseDocument.fulfilled.match(result)) {
            alert("Документ отклонён");
            handleSaved();
            options?.onSuccess?.();
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
      },
    );
  };

  const buildInvoiceDataFromDocument = (doc) => {
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
    const buyer =
      doc.counterparty && typeof doc.counterparty === "object"
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
        : doc.counterparty_display_name
          ? {
              id: String(doc.counterparty || ""),
              name: doc.counterparty_display_name || "",
              inn: "",
              okpo: "",
              score: "",
              bik: "",
              address: "",
              phone: null,
              email: null,
            }
          : null;
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
            total: String(lineTotal.toFixed(2)),
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
    const warehouseName = doc.warehouse_from?.name || doc.warehouse?.name || "";
    const warehouseToName = doc.warehouse_to?.name || "";

    return {
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
  };

  const printInvoicePdfBlob = (blob) => {
    if (typeof window === "undefined" || !window.URL || !window.document) {
      throw new Error("Печать доступна только в браузере");
    }

    const url = window.URL.createObjectURL(blob);
    const iframe = window.document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.src = url;
    window.document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } finally {
          setTimeout(() => {
            window.URL.revokeObjectURL(url);
            iframe.remove();
          }, 2000);
        }
      }, 200);
    };
  };

  const handlePrint = async (item, options = {}) => {
    if (!item?.id) return;

    try {
      if (activeTab === "invoices") {
        // Для накладной используем warehouse API
        const result = await dispatch(getWarehouseDocumentById(item.id));
        if (getWarehouseDocumentById.fulfilled.match(result)) {
          const doc = result.payload;
          const invoiceData = buildInvoiceDataFromDocument(doc);

          if (!invoiceData) {
            throw new Error("Нет данных для генерации PDF");
          }

          const blob = await pdf(
            <InvoicePdfDocument data={invoiceData} />,
          ).toBlob();
          if (options.directPrint) {
            printInvoicePdfBlob(blob);
          } else {
            const fileName = `invoice_${
              invoiceData?.document?.number || item.id
            }.pdf`;
            const url = window.URL.createObjectURL(blob);
            const a = window.document.createElement("a");
            a.href = url;
            a.download = fileName;
            window.document.body.appendChild(a);
            a.click();
            window.document.body.removeChild(a);
            setTimeout(() => window.URL.revokeObjectURL(url), 1000);
          }
        } else {
          throw new Error("Не удалось загрузить данные накладной");
        }
      } else {
        // Для чека печатаем через USB принтер
        const isPrinterConnected = await checkPrinterConnection();

        if (!isPrinterConnected) {
          alert(
            "Принтер не подключен. Пожалуйста, подключите принтер перед печатью.",
            true,
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
                documentData.totals?.discount_total || 0,
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
          (printError.message || "Неизвестная ошибка", true),
      );
    }
  };

  const handleDirectInvoicePrint = async (item) => {
    await handlePrint(item, { directPrint: true });
  };

  const formatAmount = (amount) => {
    return parseFloat(amount || 0).toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  /** Скидка по документу: бэкенд может отдать только % (discount_amount = 0) — тогда показываем сумму от подытога или хотя бы %. */
  const formatDocumentDiscountCell = (item) => {
    const pct = Number(item.discount_percent ?? 0);
    const amt = Number(item.discount_amount ?? 0);
    if (amt !== 0) {
      return `${formatAmount(amt)} сом${
        pct !== 0 ? ` (${item.discount_percent}%)` : ""
      }`;
    }
    if (pct !== 0) {
      const doc = item.document;
      if (doc && Array.isArray(doc.items) && doc.items.length > 0) {
        const subtotal = doc.items.reduce(
          (s, it) =>
            s +
            (Number(it.price ?? it.unit_price ?? 0) || 0) *
              (Number(it.qty ?? it.quantity ?? 0) || 0),
          0,
        );
        const itemsDisc = doc.items.reduce((sum, it) => {
          const p = Number(it.price ?? it.unit_price ?? 0) || 0;
          const q = Number(it.qty ?? it.quantity ?? 0) || 0;
          const d = Number(it.discount_percent ?? 0) || 0;
          return sum + (p * q * d) / 100;
        }, 0);
        const net = subtotal - itemsDisc;
        const fromPct = (net * pct) / 100;
        return `${formatAmount(fromPct)} сом (${item.discount_percent}%)`;
      }
      return `${item.discount_percent}%`;
    }
    return "—";
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
        {showAgentFilter && (
          <div className="documents__agent-filter">
            <label className="documents__agent-filter-label">Агент:</label>
            <select
              className="documents__agent-filter-select"
              value={agentFilterId}
              onChange={(e) => {
                setAgentFilterId(e.target.value);
                setCurrentPage(1);
              }}
              disabled={agentsLoading}
              title="Показать продажи только этого агента"
            >
              <option value="">Все агенты</option>
              {agentsList.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
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
          {docType === "SALE" && (
            <button
              className={`documents__tab ${
                activeTab === "agent_sales" ? "documents__tab--active" : ""
              }`}
              onClick={() => setActiveTab("agent_sales")}
            >
              Продажи по заявкам
            </button>
          )}
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
        {viewMode === "table" && activeTab !== "agent_sales" && (
          <div className="documents__table-wrapper">
            <table className="documents__table">
              <thead>
                <tr>
                  {activeTab === "receipts" && (
                    <>
                      <th>Номер</th>
                      <th>Дата и время</th>
                      <th>Контрагент</th>
                      {docType === "SALE" && <th>Агент</th>}
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
                      {docType === "SALE" && <th>Агент</th>}
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
                    <td
                      colSpan={docType === "SALE" ? 9 : 8}
                      className="documents__empty"
                    >
                      Загрузка...
                    </td>
                  </tr>
                ) : getCurrentData().length === 0 ? (
                  <tr>
                    <td
                      colSpan={docType === "SALE" ? 9 : 8}
                      className="documents__empty"
                    >
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
                          {docType === "SALE" && (
                            <td>{item.agentDisplay ?? "—"}</td>
                          )}
                          <td>{item.products}</td>
                          <td>{formatAmount(item.amount)} сом</td>
                          <td>{formatDocumentDiscountCell(item)}</td>
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
                              {isSaleDraftLikeStatus(item.rawStatus) && (
                                <button
                                  className="documents__action-btn"
                                  onClick={() => handleEditDraft(item)}
                                  title="Редактировать черновик"
                                >
                                  <Pencil size={18} />
                                </button>
                              )}
                              <button
                                className="documents__action-btn"
                                onClick={() => handlePrint(item)}
                                title="Печать"
                              >
                                <Printer size={18} />
                              </button>
                              {isSaleDraftLikeStatus(item.rawStatus) && (
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
                          {docType === "SALE" && (
                            <td>{item.agentDisplay ?? "—"}</td>
                          )}
                          <td>{item.positions}</td>
                          <td>{formatAmount(item.amount)} сом</td>
                          <td>{formatDocumentDiscountCell(item)}</td>
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
                              {isSaleDraftLikeStatus(item.rawStatus) && (
                                <button
                                  className="documents__action-btn"
                                  onClick={() => handleEditDraft(item)}
                                  title="Редактировать черновик"
                                >
                                  <Pencil size={18} />
                                </button>
                              )}
                              <button
                                className="documents__action-btn"
                                onClick={() => handleDirectInvoicePrint(item)}
                                title="Сразу на печать"
                              >
                                <Printer size={18} />
                              </button>
                              <button
                                className="documents__action-btn"
                                onClick={() => handlePrint(item)}
                                title="Печать"
                              >
                                <Download size={18} />
                              </button>
                              {isSaleDraftLikeStatus(item.rawStatus) && (
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

        {/* Таблица продаж по заявкам (одобренные заявки агентов) */}
        {viewMode === "table" && activeTab === "agent_sales" && (
          <div className="documents__table-wrapper">
            <table className="documents__table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Агент</th>
                  <th>Склад</th>
                  <th>Позиций</th>
                  <th>Номер продажи</th>
                  <th>Статус заявки</th>
                  <th>Статус документа</th>
                  {/* <th>Действия</th> */}
                </tr>
              </thead>
              <tbody>
                {documentsLoading ? (
                  <tr>
                    <td colSpan={8} className="documents__empty">
                      Загрузка...
                    </td>
                  </tr>
                ) : agentSalesRequestDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="documents__empty">
                      Заявок на продажу нет
                    </td>
                  </tr>
                ) : (
                  agentSalesRequestDocuments.map((doc, index) => {
                    const resolvedDocStatus = resolveDocumentStatus(doc);
                    const docStatusLabel = getStatusLabel(resolvedDocStatus);
                    const docStatusType = getStatusType(resolvedDocStatus);
                    const agentItem = {
                      id: doc.id,
                      number: doc.number || "",
                      rawStatus: resolvedDocStatus,
                      document: doc,
                    };
                    return (
                      <tr key={doc.id}>
                        <td>{index + 1}</td>
                        <td>
                          {doc.agent_display?.trim?.() ||
                            (doc.agent
                              ? `${String(doc.agent).slice(0, 8)}…`
                              : "—")}
                        </td>
                        <td>
                          {doc.warehouse_from?.name ||
                            doc.warehouse?.name ||
                            "—"}
                        </td>
                        <td>
                          {Array.isArray(doc.items) ? doc.items.length : "—"}
                        </td>
                        <td>{doc.number || "—"}</td>
                        <td>Заявка на продажу</td>
                        <td>
                          <span
                            className={`documents__status documents__status--${docStatusType}`}
                          >
                            {docStatusLabel}
                          </span>
                        </td>
                        <td>
                          <div className="documents__actions">
                            {/* <button
                              type="button"
                              className="documents__action-btn"
                              onClick={() =>
                                navigate(
                                  `/crm/warehouse/documents/edit/${doc.id}`,
                                )
                              }
                              title="Открыть документ"
                            >
                              <Eye size={18} />
                            </button> */}
                            {/* {isSaleRequestStatus(agentItem.rawStatus) && (
                              <button
                                type="button"
                                className="documents__action-btn documents__action-btn--create-sale !w-auto !h-auto !py-1"
                                onClick={() =>
                                  handleOpenCreateSaleFromRequest(doc)
                                }
                                title="Создать продажу по заявке"
                              >
                                <Plus size={18} />
                                Создать продажу
                              </button>
                            )} */}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Карточки */}
        {viewMode === "cards" && activeTab !== "agent_sales" && (
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
                    {docType === "SALE" && (
                      <div className="documents__card-row">
                        <span className="documents__card-label">Агент</span>
                        <span className="documents__card-value">
                          {item.agentDisplay ?? "—"}
                        </span>
                      </div>
                    )}
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
                    {(Number(item.discount_amount ?? 0) !== 0 ||
                      Number(item.discount_percent ?? 0) !== 0) && (
                      <div className="documents__card-row documents__card-row--discount">
                        <span className="documents__card-label">Скидка</span>
                        <span className="documents__card-value">
                          {formatDocumentDiscountCell(item)}
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
                    {isSaleDraftLikeStatus(item.rawStatus) && (
                      <button
                        className="documents__action-btn"
                        onClick={() => handleEditDraft(item)}
                        title="Редактировать черновик"
                      >
                        <Pencil size={18} />
                      </button>
                    )}
                    <button
                      className="documents__action-btn"
                      onClick={() => handlePrint(item)}
                      title="Печать"
                    >
                      <Printer size={18} />
                    </button>
                    {activeTab === "invoices" && (
                      <button
                        className="documents__action-btn"
                        onClick={() => handleDirectInvoicePrint(item)}
                        title="Сразу на печать"
                      >
                        <Download size={18} />
                      </button>
                    )}
                    {isSaleDraftLikeStatus(item.rawStatus) && (
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

        {viewMode === "cards" && activeTab === "agent_sales" && (
          <div className="documents__cards">
            {documentsLoading ? (
              <div className="documents__cards-empty">Загрузка...</div>
            ) : agentSalesRequestDocuments.length === 0 ? (
              <div className="documents__cards-empty">
                Заявок на продажу нет
              </div>
            ) : (
              agentSalesRequestDocuments.map((doc, index) => {
                const resolvedDocStatus = resolveDocumentStatus(doc);
                const docStatusLabel = getStatusLabel(resolvedDocStatus);
                const docStatusType = getStatusType(resolvedDocStatus);
                const agentItem = {
                  id: doc.id,
                  number: doc.number || "",
                  rawStatus: resolvedDocStatus,
                  document: doc,
                };
                return (
                  <div key={doc.id} className="documents__card">
                    <div className="documents__card-header">
                      <span className="documents__card-number">
                        Заявка #{index + 1}
                      </span>
                      <span
                        className={
                          docStatusType
                            ? `documents__status documents__status--${docStatusType}`
                            : "documents__status"
                        }
                      >
                        {doc.number || "—"}
                      </span>
                    </div>
                    <div className="documents__card-body">
                      <div className="documents__card-row">
                        <span className="documents__card-label">Агент</span>
                        <span className="documents__card-value">
                          {doc.agent_display?.trim?.() ||
                            (doc.agent
                              ? `${String(doc.agent).slice(0, 8)}…`
                              : "—")}
                        </span>
                      </div>
                      <div className="documents__card-row">
                        <span className="documents__card-label">Склад</span>
                        <span className="documents__card-value">
                          {doc.warehouse_from?.name ||
                            doc.warehouse?.name ||
                            "—"}
                        </span>
                      </div>
                      <div className="documents__card-row">
                        <span className="documents__card-label">Позиций</span>
                        <span className="documents__card-value">
                          {Array.isArray(doc.items) ? doc.items.length : "—"}
                        </span>
                      </div>
                      <div className="documents__card-row">
                        <span className="documents__card-label">
                          Статус документа
                        </span>
                        <span className="documents__card-value">
                          {docStatusLabel}
                        </span>
                      </div>
                      <div className="documents__card-row">
                        <span className="documents__card-label">Одобрена</span>
                        <span className="documents__card-value">
                          {formatDocumentDateTime(doc.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="documents__card-actions">
                      <button
                        className="documents__action-btn"
                        onClick={() =>
                          navigate(`/crm/warehouse/documents/edit/${doc.id}`)
                        }
                        title="Открыть документ"
                      >
                        <Eye size={18} />
                      </button>
                      {isSaleRequestStatus(agentItem.rawStatus) && (
                        <button
                          className="documents__action-btn documents__action-btn--create-sale !w-auto !h-auto !py-1"
                          onClick={() => handleOpenCreateSaleFromRequest(doc)}
                          title="Создать продажу по заявке"
                        >
                          <Plus size={18} />
                          Создать продажу
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </DataContainer>

      {/* Пагинация для чеков и накладных */}
      {totalPages > 1 && activeTab !== "agent_sales" && (
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

      <CreateSaleFromCartModal
        open={!!createSaleModalCart}
        onClose={() => setCreateSaleModalCart(null)}
        cart={createSaleModalCart}
        onSuccess={(doc) => {
          setCreateSaleModalCart(null);
          setAgentSaleDocumentById((prev) => ({ ...prev, [doc.id]: doc }));
          loadAgentSalesCarts();
          alert("Продажа создана");
          navigate(`/crm/warehouse/documents/edit/${doc.id}`);
        }}
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
