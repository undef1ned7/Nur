import {
  Banknote,
  CheckSquare,
  Eye,
  Plus,
  Receipt,
  Search,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
// import "./Sklad.scss";

import api from "../../../api";
import { useDebounce } from "../../../hooks/useDebounce";
import { fetchClientsAsync } from "../../../store/creators/clientCreators";
import {
  historySellObjects,
  historySellProduct,
  startSale,
} from "../../../store/creators/saleThunk";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../store/slices/cashSlice";
import { useSale } from "../../../store/slices/saleSlice";
import { useClient } from "../../../store/slices/ClientSlice";
import { useUser } from "../../../store/slices/userSlice";
import AddCashFlowsModal from "../../Deposits/Kassa/AddCashFlowsModal/AddCashFlowsModal";
import RefundPurchase from "./RefundPurchase";
import SellBuildingModal from "./SellBuildingModal";
import SellDetail from "./SellDetail";
import SellModal from "./SellModal";
import SellMainStart from "./SellMainStart";
import "./sell.scss";
import { useAlert, useConfirm } from "../../../hooks/useDialog";
import DataContainer from "../../common/DataContainer/DataContainer";
import Modal from "../../common/Modal/Modal";
import {
  hasMarketReturnPermission,
  isMarketSectorName,
  isProfileOwnerOrAdmin,
  isReturnableSaleStatus,
} from "../../../tools/saleReturn";

/**
 * Создание долга для клиента.
 *
 * Ожидаемые аргументы:
 * - clientId: string (uuid клиента)
 * - title: string (заголовок, например "Долг Мирлан")
 * - amount: string | number (сумма, например "30.00")
 * - debtMonths?: number (срок в месяцах, по умолчанию 0)
 * - firstDueDate?: string | null (дата первого платежа "YYYY-MM-DD", если работаем по дате)
 * - note?: string (опциональный комментарий)
 */
export async function createDebt({
  clientId,
  title,
  amount,
  debtMonths = 0,
  firstDueDate = null,
  phone = "",
  name = "",
  note = "",
}) {
  const payload = {
    client: clientId,
    kind: "debt",
    title,
    name,
    phone,
    note: note || "",
    amount, // "30.00" или число — как у тебя принято
    debt_months: Number(debtMonths ?? 0), // <-- всегда отправляем, минимум 0
  };

  // Если работаем с датой (режим "день") — отправляем first_due_date
  if (firstDueDate) {
    payload.first_due_date = firstDueDate; // "YYYY-MM-DD"
  }

  const res = await api.post("/main/debts/", payload);
  return res.data;
}

const STATUSES = [
  { value: "new", label: "Новая" },
  { value: "paid", label: "Оплачена" },
  { value: "canceled", label: "Отменена" },
];

export const DEAL_STATUS_RU = ["Продажа", "Долги", "Предоплата"];
const kindTranslate = {
  new: "Новый",
  paid: "Оплаченный",
  canceled: "возвращенный",
  debt: "Долг",
};

const paymentMethodTranslate = {
  cash: "Наличные",
  card: "Карта",
  transfer: "Перевод",
  debt: "Долг",
};
const PAGE_SIZE = 100;

const Sell = () => {
  const navigate = useNavigate();
  const alert = useAlert();
  const confirmDialog = useConfirm();
  const askConfirm = useCallback(
    (message) =>
      new Promise((resolve) => {
        confirmDialog(message, (ok) => resolve(Boolean(ok)));
      }),
    [confirmDialog],
  );
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { company, profile, userId } = useUser();
  const { list: clientsRaw } = useClient();
  const { list: cashBoxes } = useCash();
  const {
    history,
    start,
    historyObjects,
    historyCount,
    historyTotalAmount,
    historyNext,
    historyPrevious,
    historyObjectsCount,
    historyObjectsTotalAmount,
    historyObjectsNext,
    historyObjectsPrevious,
    loading,
  } = useSale();

  // Получаем текущую страницу из URL
  const currentPage = useMemo(
    () => parseInt(searchParams.get("page") || "1", 10),
    [searchParams],
  );
  const currentUserId = String(profile?.id || userId || "").trim();
  const isOwnerOrAdmin = isProfileOwnerOrAdmin(profile);
  const canMarketEmployeeReturn = hasMarketReturnPermission(profile);
  const userParam = String(searchParams.get("user") || "").trim();

  const [showDetailSell, setShowDetailSell] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showSellMainStart, setShowSellMainStart] = useState(false);
  const [showAddCashboxModal, setShowAddCashboxModal] = useState(false);
  const [showBuilding, setShowBuilding] = useState(false);
  const [sellId, setSellId] = useState("");
  const [selectCashBox, setSelectCashBox] = useState("");
  const [selectCashBox1, setSelectCashBox1] = useState("");
  const [clearing, setClearing] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [itemId, setItemId] = useState(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [error, setError] = useState(null);
  const [historyView, setHistoryView] = useState("table"); // table | cards (по умолчанию таблица)
  const [dateFrom, setDateFrom] = useState(searchParams.get("date_from") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("date_to") || "");
  const [clientFilter, setClientFilter] = useState(
    searchParams.get("client") || "",
  );
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || "",
  );
  const clients = useMemo(
    () =>
      Array.isArray(clientsRaw?.results)
        ? clientsRaw.results
        : Array.isArray(clientsRaw)
          ? clientsRaw
          : [],
    [clientsRaw],
  );

  const [newCashbox, setNewCashbox] = useState({
    name: "",
    amount: 0,
    cashbox: selectCashBox1,
    type: "expense", // Дефолтный тип для новой операции
  });

  // выбор строк
  const [selectedIds, setSelectedIds] = useState(new Set());
  // оптимистическое скрытие после возврата (чтобы карточка исчезала сразу)
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const isSelected = (id) => selectedIds.has(id);
  const toggleRow = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleSelectAllOnPage = (items) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const all = items.length > 0 && items.every((i) => next.has(i.id));
      items.forEach((i) => (all ? next.delete(i.id) : next.add(i.id)));
      return next;
    });
  const clearSelection = () => setSelectedIds(new Set());

  const hideSaleId = (id) => {
    const sid = String(id || "");
    if (!sid) return;
    setHiddenIds((prev) => new Set(prev).add(sid));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(sid);
      return next;
    });
  };

  // если данные перезагрузились — чистим "скрытые" id, которых уже нет в выдаче
  useEffect(() => {
    const all = new Set([
      ...(Array.isArray(history) ? history.map((x) => String(x.id)) : []),
      ...(Array.isArray(historyObjects)
        ? historyObjects.map((x) => String(x.id))
        : []),
    ]);
    setHiddenIds((prev) => {
      if (!prev || prev.size === 0) return prev;
      const next = new Set();
      for (const id of prev) {
        if (all.has(String(id))) next.add(String(id));
      }
      return next;
    });
  }, [history, historyObjects]);

  // смена страницы/поиска — можно безопасно сбросить локальные скрытия
  useEffect(() => {
    setHiddenIds(new Set());
  }, [currentPage]);

  const {
    isBuildingCompany,
    isMarketCompany,
    isStartPlanCompany,
    filterField,
    count,
    listTotalAmount,
    totalPages,
    hasNextPage,
    hasPrevPage,
  } = useMemo(() => {
    const sectorName = company?.sector?.name?.trim().toLowerCase() ?? "";
    const isBuildingCompany = sectorName === "строительная компания";
    const isMarketCompany = isMarketSectorName(sectorName);
    const planName = company?.subscription_plan?.name?.trim().toLowerCase() ?? "";
    const isStartPlanCompany = planName === "старт";
    const hidden = hiddenIds;
    const filterSell = (Array.isArray(history) ? history : []).filter(
      (item) =>
        item.status !== "canceled" && !hidden.has(String(item?.id ?? "")),
    );
    const filterObjects = (
      Array.isArray(historyObjects) ? historyObjects : []
    ).filter((item) => !hidden.has(String(item?.id ?? "")));
    const filterField = isBuildingCompany ? filterObjects : filterSell;
    const count = isBuildingCompany ? historyObjectsCount : historyCount;
    const listTotalAmount = isBuildingCompany
      ? historyObjectsTotalAmount
      : historyTotalAmount;
    const next = isBuildingCompany ? historyObjectsNext : historyNext;
    const previous = isBuildingCompany
      ? historyObjectsPrevious
      : historyPrevious;
    const totalPages = count && PAGE_SIZE ? Math.ceil(count / PAGE_SIZE) : 1;
    return {
      sectorName,
      isBuildingCompany,
      isMarketCompany,
      isStartPlanCompany,
      filterSell,
      filterField,
      count,
      listTotalAmount,
      next,
      previous,
      totalPages,
      hasNextPage: !!next,
      hasPrevPage: !!previous,
    };
  }, [
    company,
    history,
    historyObjects,
    hiddenIds,
    historyObjectsCount,
    historyObjectsTotalAmount,
    historyObjectsNext,
    historyObjectsPrevious,
    historyPrevious,
    historyCount,
    historyTotalAmount,
    historyNext,
  ]);

  useEffect(() => {
    if (!isMarketCompany || isOwnerOrAdmin || !currentUserId || userParam) return;
    const params = new URLSearchParams(searchParams);
    params.set("user", currentUserId);
    params.delete("page");
    setSearchParams(params, { replace: true });
  }, [
    currentUserId,
    isMarketCompany,
    isOwnerOrAdmin,
    searchParams,
    setSearchParams,
    userParam,
  ]);

  const effectiveUserParam =
    userParam || (isMarketCompany && !isOwnerOrAdmin ? currentUserId : "");

  const historyBaseParams = useMemo(
    () => ({
      ...(effectiveUserParam ? { user: effectiveUserParam } : {}),
      ...(isMarketCompany && dateFrom ? { date_from: dateFrom } : {}),
      ...(isMarketCompany && dateTo ? { date_to: dateTo } : {}),
      ...(isMarketCompany && clientFilter ? { client: clientFilter } : {}),
      ...(isMarketCompany && statusFilter ? { status: statusFilter } : {}),
    }),
    [effectiveUserParam, isMarketCompany, dateFrom, dateTo, clientFilter, statusFilter],
  );
  // Синхронизация URL с состоянием страницы

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (currentPage > 1) {
      params.set("page", currentPage.toString());
    } else {
      params.delete("page");
    }
    const newSearchString = params.toString();
    const currentSearchString = searchParams.toString();
    if (newSearchString !== currentSearchString) {
      setSearchParams(params, { replace: true });
    }
  }, [currentPage, searchParams, setSearchParams]);

  // Обработчик смены страницы
  const handlePageChange = (newPage) => {
    if (newPage < 1 || (totalPages && newPage > totalPages)) return;
    const params = new URLSearchParams(searchParams);
    if (newPage > 1) {
      params.set("page", newPage.toString());
    } else {
      params.delete("page");
    }
    setSearchParams(params, { replace: true });
    // Плавно прокручиваем страницу вверх при смене страницы
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // поиск по истории (дебаунс)
  const debouncedSearch = useDebounce((v) => {
    const requestParams = { ...historyBaseParams, search: v, page: 1, limit: PAGE_SIZE };
    dispatch(historySellProduct(requestParams));
    if (isBuildingCompany) {
      dispatch(historySellObjects(requestParams));
    }
    // Сбрасываем на первую страницу при поиске
    const urlParams = new URLSearchParams(searchParams);
    urlParams.delete("page");
    setSearchParams(urlParams, { replace: true });
  }, 600);
  const onChange = (e) => debouncedSearch(e.target.value);

  useEffect(() => {
    if (showSellMainStart) return;
    const params = { ...historyBaseParams, search: "", page: currentPage, limit: PAGE_SIZE };
    dispatch(
      historySellProduct(params),
    );
    if (isBuildingCompany) {
      dispatch(historySellObjects(params));
    }
  }, [
    dispatch,
    showSellMainStart,
    currentPage,
    historyBaseParams,
    isBuildingCompany,
  ]);

  useEffect(() => {
    if (!isMarketCompany) return;
    dispatch(fetchClientsAsync());
  }, [dispatch, isMarketCompany]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (dateFrom) params.set("date_from", dateFrom);
    else params.delete("date_from");
    if (dateTo) params.set("date_to", dateTo);
    else params.delete("date_to");
    if (clientFilter) params.set("client", clientFilter);
    else params.delete("client");
    if (statusFilter) params.set("status", statusFilter);
    else params.delete("status");
    if (currentPage > 1) params.delete("page");
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, clientFilter, statusFilter]);

  // Плавно прокручиваем страницу вверх при изменении страницы
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage]);

  useEffect(() => {
    if (showSellModal) dispatch(startSale({ discount_total: 0 }));
    if (showSellMainStart) dispatch(startSale({ discount_total: 0 }));
  }, [showSellModal, showSellMainStart, dispatch]);

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === "Escape") {
        setShowSellModal(false);
        setShowSellMainStart(false);
        setShowDetailSell(false);
        setShowBuilding(false);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  useEffect(() => {
    dispatch(getCashBoxes());
  }, [dispatch]);

  // Автоматически выбираем первую кассу по индексу
  useEffect(() => {
    if (cashBoxes && cashBoxes.length > 0 && !selectCashBox) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setSelectCashBox(firstCashBoxId);
      }
    }
  }, [cashBoxes, selectCashBox]);

  const handleSellModal = (id) => {
    setSellId(id);
    setShowDetailSell(true);
  };
  const handleOpenRefund = (sale, event) => {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    setItemId(sale);
    setShowRefundModal(true);
  };

  const formatMoney = (v) => {
    const s = String(v ?? "")
      .trim()
      .replace(/,/g, ".");
    const n = Number(s);
    if (!Number.isFinite(n)) return String(v ?? "-");
    return n.toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "-";
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(dateString);
    }
  };

  const getSaleThumb = (sale) => {
    return (
      sale?.first_item_image_url ||
      sale?.first_item_image ||
      sale?.primary_image_url ||
      sale?.first_item?.primary_image_url ||
      sale?.items?.[0]?.primary_image_url ||
      sale?.products?.[0]?.primary_image_url ||
      sale?.products?.[0]?.image_url ||
      "/images/placeholder.avif"
    );
  };

  const getItemsCount = (sale) => {
    const v =
      sale?.items_count ??
      sale?.products_count ??
      (Array.isArray(sale?.items) ? sale.items.length : null) ??
      (Array.isArray(sale?.products) ? sale.products.length : null);
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const getStatusVariant = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "paid") return "paid";
    if (s === "canceled" || s === "cancelled") return "canceled";
    if (s === "debt") return "debt";
    return "new";
  };

  const translatePaymentMethod = (method) => {
    if (!method) return "-";
    const lowerMethod = method.toLowerCase();
    return paymentMethodTranslate[lowerMethod] || method;
  };

  const canReturnSale = (sale) => {
    if (!isMarketCompany) return false;
    if (!canMarketEmployeeReturn) return false;
    return isReturnableSaleStatus(sale?.status);
  };

  const handleAddCashbox = async () => {
    try {
      dispatch(addCashFlows({ ...newCashbox, cashbox: selectCashBox1 }));

      setShowAddCashboxModal(false);
      setNewCashbox({ name: "", amount: 0, type: "expense" }); // Сброс формы
    } catch (err) {
      console.error("Failed to add cashflow:", err);
      setError(
        "Не удалось добавить операцию по кассе. Пожалуйста, проверьте данные и попробуйте еще раз.",
      );
    }
  };

  const bulkDeleteSales = async (ids, { cancelPaidMessage, successMessage, reloadPage }) => {
    const doRequest = async (allowPaid) => {
      const res = await fetch("https://app.nurcrm.kg/api/main/sales/bulk-delete/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        credentials: "include",
        body: JSON.stringify({
          ids,
          allow_paid: allowPaid,
        }),
      });
      return res;
    };

    let res = await doRequest(false);

    if (!res.ok && res.status === 400) {
      let data = null;
      try {
        data = await res.json();
      } catch {
        // оставляем data = null
      }

      const paidIds = Array.isArray(data?.paid_ids) ? data.paid_ids : [];
      if (paidIds.length > 0) {
        const msg =
          data?.detail ||
          "Среди выбранных продаж есть оплаченные. Удалить их тоже?";
        const confirmPaid = await askConfirm(
          `${msg}\n\nОплаченные продажи:\n${paidIds.join("\n")}`,
        );
        if (!confirmPaid) {
          alert(cancelPaidMessage);
          return false;
        }
        res = await doRequest(true);
      } else {
        throw new Error(data?.detail || "Запрос отклонён (400)");
      }
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }

    clearSelection();
    alert(successMessage);
    dispatch(
      historySellProduct({
        ...historyBaseParams,
        search: "",
        page: reloadPage,
        limit: PAGE_SIZE,
      }),
    );
    if (isBuildingCompany) {
      dispatch(
        historySellObjects({
          ...historyBaseParams,
          search: "",
          page: reloadPage,
          limit: PAGE_SIZE,
        }),
      );
    }
    return true;
  };

  // массовое удаление выбранных
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await askConfirm(`Удалить выбранные ${selectedIds.size} запись(и)?`);
    if (!ok) return;

    try {
      setBulkDeleting(true);
      const ids = Array.from(selectedIds);
      await bulkDeleteSales(ids, {
        cancelPaidMessage: "Удаление отменено. Оплаченные продажи не были удалены.",
        successMessage: "Выбранные записи удалены",
        reloadPage: currentPage,
      });
    } catch (e) {
      alert("Не удалось удалить: " + e.message, true);
    } finally {
      setBulkDeleting(false);
    }
  };

  // очистить ВСЮ историю
  const handleClearAllHistory = async () => {
    const ok = await askConfirm("Удалить ВСЮ историю? Действие необратимо.");
    if (!ok) return;

    try {
      setClearing(true);
      const list = Array.isArray(filterField) ? filterField : [];
      const ids = list.map((i) => i.id);
      if (ids.length === 0) throw new Error("Нечего удалять");

      const deleted = await bulkDeleteSales(ids, {
        cancelPaidMessage:
          "Очистка отменена. Оплаченные продажи не были удалены, история сохранена.",
        successMessage: "История удалена",
        reloadPage: 1,
      });

      if (deleted) {
        const params = new URLSearchParams(searchParams);
        params.delete("page");
        setSearchParams(params, { replace: true });
      }
    } catch (e) {
      alert("Не удалось очистить историю: " + e.message, true);
    } finally {
      setClearing(false);
    }
  };

  const allOnPageSelected =
    filterField.length > 0 && filterField.every((i) => selectedIds.has(i.id));

  return (
    <div>
      <>
        <div className="sell__header">
          <div className="sell__header-left">
            <div className="sell__header-input sell__search-wrap">
              <input
                className="w-full"
                onChange={onChange}
                type="text"
                placeholder="Поиск"
              />
              <span>
                <Search size={15} color="#91929E" />
              </span>
            </div>
            {isMarketCompany && (
              <button
                className="sell__header-btn sell__filter-btn"
                onClick={() => setShowFiltersModal(true)}
              >
                Фильтр
              </button>
            )}
          </div>
          {!isStartPlanCompany && !isMarketCompany && (
            <button
              className="sell__header-btn "
              onClick={() => navigate("start")}
            >
              Начать продажу
            </button>
          )}
          {isBuildingCompany ? (
            <button
              className="sklad__add"
              onClick={() => setShowBuilding(true)}
            >
              <Plus size={16} style={{ marginRight: 4 }} /> Продать квартиру
            </button>
          ) : !isStartPlanCompany && !isMarketCompany ? (
            <button
              className="sell__header-btn"
              onClick={() => setShowAddCashboxModal(true)}
            >
              Прочие расходы
            </button>
          ) : null}
        </div>
        <div className="sell__history">
          <div className="sell__history-toolbar">
            <div className="sell__history-toolbarLeft">
              <button
                type="button"
                className={`sell__iconBtn sell__iconBtn--select${allOnPageSelected ? " sell__iconBtn--active" : ""}`}
                onClick={() => toggleSelectAllOnPage(filterField)}
                disabled={filterField.length === 0 || loading}
                title={
                  allOnPageSelected
                    ? "Снять выбор со страницы"
                    : "Выбрать все на странице"
                }
                aria-label={
                  allOnPageSelected
                    ? "Снять выбор со страницы"
                    : "Выбрать все на странице"
                }
                aria-pressed={allOnPageSelected}
              >
                {allOnPageSelected ? (
                  <CheckSquare size={20} strokeWidth={2.2} />
                ) : (
                  <Square size={20} strokeWidth={2.2} />
                )}
              </button>

              {selectedIds.size > 0 && (
                <div
                  className="sell__history-selectionActions"
                  role="group"
                  aria-label="Действия с выбранными продажами"
                >
                  <button
                    type="button"
                    className="sell__iconBtn sell__iconBtn--danger"
                    onClick={() => void handleBulkDelete()}
                    disabled={bulkDeleting}
                    title={`Удалить выбранные (${selectedIds.size})`}
                    aria-label={`Удалить выбранные (${selectedIds.size})`}
                  >
                    <Trash2 size={18} strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    className="sell__iconBtn sell__iconBtn--muted"
                    onClick={clearSelection}
                    disabled={bulkDeleting}
                    title="Снять выбор"
                    aria-label="Снять выбор"
                  >
                    <X size={18} strokeWidth={2.2} />
                  </button>
                </div>
              )}
            </div>

            <div className="sell__history-toolbarRight">
              <div
                className={`sell__history-stats${loading ? " sell__history-stats--loading" : ""}`}
                aria-label="Сводка по продажам"
              >
                <div className="sell__history-stat">
                  <span
                    className="sell__history-stat-icon sell__history-stat-icon--sales"
                    aria-hidden
                  >
                    <Receipt size={18} strokeWidth={2.2} />
                  </span>
                  <div className="sell__history-stat-body">
                    <span className="sell__history-stat-label">Всего продаж</span>
                    <strong className="sell__history-stat-value">{count || 0}</strong>
                  </div>
                </div>
                <div className="sell__history-stat">
                  <span
                    className="sell__history-stat-icon sell__history-stat-icon--amount"
                    aria-hidden
                  >
                    <Banknote size={18} strokeWidth={2.2} />
                  </span>
                  <div className="sell__history-stat-body">
                    <span className="sell__history-stat-label">Общая сумма</span>
                    <strong className="sell__history-stat-value">
                      {listTotalAmount != null
                        ? `${formatMoney(listTotalAmount)} сом`
                        : "—"}
                    </strong>
                  </div>
                </div>
                <div className="sell__history-stat sell__history-stat--page">
                  <span
                    className="sell__history-stat-icon sell__history-stat-icon--page"
                    aria-hidden
                  >
                    <Eye size={18} strokeWidth={2.2} />
                  </span>
                  <div className="sell__history-stat-body">
                    <span className="sell__history-stat-label">На странице</span>
                    <strong className="sell__history-stat-value">{filterField.length}</strong>
                  </div>
                </div>
              </div>

              <div
                className="sell__viewToggle"
                role="group"
                aria-label="Вид списка"
              >
                <button
                  type="button"
                  className={`sell__viewBtn ${
                    historyView === "table" ? "sell__viewBtn--active" : ""
                  }`}
                  onClick={() => setHistoryView("table")}
                >
                  Таблица
                </button>
                <button
                  type="button"
                  className={`sell__viewBtn ${
                    historyView === "cards" ? "sell__viewBtn--active" : ""
                  }`}
                  onClick={() => setHistoryView("cards")}
                >
                  Карточки
                </button>
              </div>
            </div>
          </div>

          {filterField.length === 0 ? (
            <div className="sell__empty">Ничего не найдено</div>
          ) : (
            <DataContainer>
              {historyView === "table" ? (
                <div className="sellTable__wrap">
                  <table className="sellTable">
                    <thead>
                      <tr>
                        <th />
                        <th>№</th>
                        <th>Статус</th>
                        <th>Товар</th>
                        <th>Оплата</th>
                        <th>Сумма</th>
                        <th>Скидка</th>
                        <th>Позиции</th>
                        <th>Дата</th>
                        <th>Клиент</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filterField.map((item, idx) => {
                        const itemsCount = getItemsCount(item);
                        const discountTotal = Number(item.discount_total || 0);
                        const statusLabel =
                          kindTranslate[item.status] || item.status || "-";
                        const statusVariant = getStatusVariant(item.status);
                        const saleNo = (currentPage - 1) * PAGE_SIZE + idx + 1;
                        return (
                          <tr
                            key={item.id}
                            className="sellTable__row"
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setSellId(item.id);
                              setShowDetailSell(true);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                setSellId(item.id);
                                setShowDetailSell(true);
                              }
                            }}
                          >
                            <td
                              className="sellTable__check"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected(item.id)}
                                onChange={() => toggleRow(item.id)}
                              />
                            </td>
                            <td className="sellTable__no">№ {saleNo}</td>
                            <td>
                              <span
                                className={`sellBadge sellBadge--${statusVariant}`}
                              >
                                {statusLabel}
                              </span>
                            </td>

                            <td className="sellTable__title">
                              {item.first_item_name || item.title || "—"}
                            </td>

                            <td>
                              {translatePaymentMethod(item.payment_method)}
                            </td>
                            <td className="">{formatMoney(item.total)} сом</td>
                            <td className="sellTable__money">
                              {discountTotal > 0
                                ? `-${formatMoney(discountTotal)} сом`
                                : "0 сом"}
                            </td>
                            <td className="sellTable__count">
                              {itemsCount !== null ? itemsCount : "—"}
                            </td>
                            <td className="sellTable__date">
                              {formatDateTime(item.created_at)}
                            </td>
                            <td className="sellTable__client">
                              {item.client_name || "-"}
                            </td>
                            <td
                              className="sellTable__actions"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {canReturnSale(item) && (
                                <button
                                  type="button"
                                  className="sellTable__refund"
                                  onClick={(event) => handleOpenRefund(item, event)}
                                >
                                  Возврат
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="sell__cards">
                  {filterField.map((item, idx) => {
                    const itemsCount = getItemsCount(item);
                    const discountTotal = Number(item.discount_total || 0);
                    const statusLabel =
                      kindTranslate[item.status] || item.status || "-";
                    const statusVariant = getStatusVariant(item.status);
                    const saleNo = (currentPage - 1) * PAGE_SIZE + idx + 1;

                    return (
                      <div
                        key={item.id}
                        className="sellCard"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSellId(item.id);
                          setShowDetailSell(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setSellId(item.id);
                            setShowDetailSell(true);
                          }
                        }}
                      >
                        <div className="sellCard__top">
                          <label
                            className="sellCard__check"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected(item.id)}
                              onChange={() => toggleRow(item.id)}
                            />
                            <span className="sellCard__no">№ {saleNo}</span>
                          </label>
                          <div className="sellCard__right">
                            <span
                              className={`sellBadge sellBadge--${statusVariant}`}
                            >
                              {statusLabel}
                            </span>
                            <span className="sellCard__date">
                              {formatDateTime(item.created_at)}
                            </span>
                          </div>
                        </div>

                        <div className="sellCard__body">
                          <div className="sellCard__main">
                            <div className="sellCard__title">
                              {item.first_item_name || item.title || "—"}
                            </div>
                            <div className="sellCard__subtitle">
                              Клиент: <b>{item.client_name || "-"}</b>
                              {itemsCount !== null && itemsCount > 1 && (
                                <span className="sellCard__count">
                                  + ещё {itemsCount - 1}
                                </span>
                              )}
                            </div>

                            <div className="sellCard__grid">
                              <div className="sellCard__kv">
                                <span>Оплата</span>
                                <b>
                                  {translatePaymentMethod(item.payment_method)}
                                </b>
                              </div>
                              <div className="sellCard__kv">
                                <span>Сумма</span>
                                <b>{formatMoney(item.total)} сом</b>
                              </div>
                              <div className="sellCard__kv">
                                <span>Скидка</span>
                                <b>
                                  {discountTotal > 0
                                    ? `-${formatMoney(discountTotal)} сом`
                                    : "0 сом"}
                                </b>
                              </div>
                              <div className="sellCard__kv">
                                <span>Документ</span>
                                <b>#{String(item.id).slice(0, 8)}</b>
                              </div>
                              <div className="sellCard__kv">
                                <span>Позиции</span>
                                <b>{itemsCount !== null ? itemsCount : "—"}</b>
                              </div>
                            </div>
                          </div>

                          <div
                            className="sellCard__actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {canReturnSale(item) && (
                              <button
                                type="button"
                                className="sellCard__refund"
                                onClick={(event) => handleOpenRefund(item, event)}
                              >
                                Возврат
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </DataContainer>
          )}
        </div>

        {/* Пагинация */}
        {totalPages > 1 && (
          <div className="sell__pagination">
            <button
              type="button"
              className="sell__pagination-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading || !hasPrevPage}
            >
              Назад
            </button>
            <span className="sell__pagination-info">
              Страница {currentPage} из {totalPages}
              {count ? ` (${count} записей)` : ""}
            </span>
            <button
              type="button"
              className="sell__pagination-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={
                loading ||
                !hasNextPage ||
                (totalPages && currentPage >= totalPages)
              }
            >
              Вперед
            </button>
          </div>
        )}
      </>
      {showAddCashboxModal && (
        <AddCashFlowsModal onClose={() => setShowAddCashboxModal(false)} />
      )}

      {showSellModal && (
        <SellModal
          id={start?.id}
          selectCashBox={selectCashBox}
          onClose={() => setShowSellModal(false)}
        />
      )}
      {showRefundModal && itemId?.id && (
        <RefundPurchase
          item={itemId}
          onClose={() => {
            setShowRefundModal(false);
            setItemId(null);
          }}
          onChanged={(updatedSale) => {
            if (String(updatedSale?.status || "").toLowerCase() === "canceled") {
              hideSaleId(updatedSale?.id || itemId?.id);
            }
            setShowRefundModal(false);
            dispatch(
              historySellProduct({
                ...historyBaseParams,
                search: "",
                page: currentPage,
              }),
            );
            if (isBuildingCompany) {
              dispatch(
                historySellObjects({
                  ...historyBaseParams,
                  search: "",
                  page: currentPage,
                }),
              );
            }
          }}
        />
      )}
      {showBuilding && (
        <SellBuildingModal onClose={() => setShowBuilding(false)} />
      )}
      {showDetailSell && (
        <SellDetail onClose={() => setShowDetailSell(false)} id={sellId} />
      )}
      {isMarketCompany && showFiltersModal && (
        <Modal
          open={showFiltersModal}
          onClose={() => setShowFiltersModal(false)}
          title="Фильтры"
          className="sellFiltersModal"
          contentClassName="sellFiltersModal__content"
        >
          <div className="sellFiltersModal__grid">
            <label className="sellFiltersModal__field">
              <span>Дата начала</span>
              <input
                type="date"
                className="sell__filter-field"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label className="sellFiltersModal__field">
              <span>Дата конца</span>
              <input
                type="date"
                className="sell__filter-field"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
            <label className="sellFiltersModal__field">
              <span>Клиент</span>
              <select
                className="sell__filter-field"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
              >
                <option value="">Все клиенты</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name || client.name || client.phone || "Клиент"}
                  </option>
                ))}
              </select>
            </label>
            <label className="sellFiltersModal__field">
              <span>Статус</span>
              <select
                className="sell__filter-field"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Все статусы</option>
                <option value="new">Новый</option>
                <option value="paid">Оплаченный</option>
                <option value="debt">Долг</option>
                <option value="canceled">Отмененный</option>
              </select>
            </label>
          </div>
          <div className="sellFiltersModal__actions">
            <button
              type="button"
              className="sell__reset"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setClientFilter("");
                setStatusFilter("");
              }}
            >
              Сбросить
            </button>
            <button
              type="button"
              className="sell__header-btn"
              onClick={() => setShowFiltersModal(false)}
            >
              Применить
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Sell;
