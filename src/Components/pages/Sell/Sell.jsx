import { Plus, Search } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useDispatch } from "react-redux";
import { useSearchParams } from "react-router-dom";
// import "./Sklad.scss";

import api from "../../../api";
import { useDebounce } from "../../../hooks/useDebounce";
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
import { useUser } from "../../../store/slices/userSlice";
import AddCashFlowsModal from "../../Deposits/Kassa/AddCashFlowsModal/AddCashFlowsModal";
import RefundPurchase from "./RefundPurchase";
import SellBuildingModal from "./SellBuildingModal";
import SellDetail from "./SellDetail";
import SellModal from "./SellModal";
import SellMainStart from "./SellMainStart";
import "./sell.scss";

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
  phone = '',
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
const PAGE_SIZE = 50;

const Sell = () => {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { company } = useUser();
  const { list: cashBoxes } = useCash();
  const {
    history,
    start,
    historyObjects,
    historyCount,
    historyNext,
    historyPrevious,
    historyObjectsCount,
    historyObjectsNext,
    historyObjectsPrevious,
    loading
  } = useSale();

  // Получаем текущую страницу из URL
  const currentPage = useMemo(
    () => parseInt(searchParams.get("page") || "1", 10),
    [searchParams]
  );

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
  const [itemId, setItemId] = useState({});
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [error, setError] = useState(null);

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
    filterField,
    count,
    totalPages,
    hasNextPage,
    hasPrevPage
  } = useMemo(() => {
    const sectorName = company?.sector?.name?.trim().toLowerCase() ?? "";
    const isBuildingCompany = sectorName === "строительная компания";
    const hidden = hiddenIds;
    const filterSell = (Array.isArray(history) ? history : []).filter(
      (item) =>
        item.status !== "canceled" && !hidden.has(String(item?.id ?? ""))
    );
    const filterObjects = (Array.isArray(historyObjects) ? historyObjects : []).filter(
      (item) => !hidden.has(String(item?.id ?? ""))
    );
    const filterField = isBuildingCompany ? filterObjects : filterSell;
    const count = isBuildingCompany ? historyObjectsCount : historyCount;
    const next = isBuildingCompany ? historyObjectsNext : historyNext;
    const previous = isBuildingCompany ? historyObjectsPrevious : historyPrevious;
    const totalPages = count && PAGE_SIZE ? Math.ceil(count / PAGE_SIZE) : 1
    return {
      sectorName,
      isBuildingCompany,
      filterSell,
      filterField,
      count,
      next,
      previous,
      totalPages,
      hasNextPage: !!next,
      hasPrevPage: !!previous
    }
  }, [
    company,
    history,
    historyObjects,
    hiddenIds,
    historyObjectsCount,
    historyObjectsNext,
    historyObjectsPrevious,
    historyPrevious,
    historyCount,
    historyNext,
  ])
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // поиск по истории (дебаунс)
  const debouncedSearch = useDebounce((v) => {
    dispatch(historySellProduct({ search: v, page: 1 }));
    dispatch(historySellObjects({ search: v, page: 1 }));
    // Сбрасываем на первую страницу при поиске
    const params = new URLSearchParams(searchParams);
    params.delete("page");
    setSearchParams(params, { replace: true });
  }, 600);
  const onChange = (e) => debouncedSearch(e.target.value);

  useEffect(() => {
    if (showSellMainStart) return;
    dispatch(historySellProduct({ search: "", page: currentPage }));
    dispatch(historySellObjects({ search: "", page: currentPage }));
  }, [dispatch, showSellMainStart, currentPage]);

  // Плавно прокручиваем страницу вверх при изменении страницы
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
  const handleOpen = (id) => {
    setItemId(id);
    setShowRefundModal(true);
  };



  const formatMoney = (v) => {
    const s = String(v ?? "").trim().replace(/,/g, ".");
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

  const handleAddCashbox = async () => {
    try {
      dispatch(addCashFlows({ ...newCashbox, cashbox: selectCashBox1 }));

      setShowAddCashboxModal(false);
      setNewCashbox({ name: "", amount: 0, type: "expense" }); // Сброс формы
    } catch (err) {
      console.error("Failed to add cashflow:", err);
      setError(
        "Не удалось добавить операцию по кассе. Пожалуйста, проверьте данные и попробуйте еще раз."
      );
    }
  };

  // массовое удаление выбранных
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Удалить выбранные ${selectedIds.size} запись(и)?`))
      return;
    try {
      setBulkDeleting(true);
      const res = await fetch(
        "https://app.nurcrm.kg/api/main/sales/bulk-delete/",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          credentials: "include",
          body: JSON.stringify({
            ids: Array.from(selectedIds),
            allow_paid: false,
          }),
        }
      );
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      clearSelection();
      alert("Выбранные записи удалены");
      dispatch(historySellProduct({ search: "", page: currentPage }));
      dispatch(historySellObjects({ search: "", page: currentPage }));
    } catch (e) {
      alert("Не удалось удалить: " + e.message);
    } finally {
      setBulkDeleting(false);
    }
  };

  // очистить ВСЮ историю
  const handleClearAllHistory = async () => {
    if (!window.confirm("Удалить ВСЮ историю? Действие необратимо.")) return;
    try {
      setClearing(true);
      const list = Array.isArray(filterField) ? filterField : [];
      const ids = list.map((i) => i.id);
      if (ids.length === 0) throw new Error("Нечего удалять");
      const res = await fetch(
        "https://app.nurcrm.kg/api/main/sales/bulk-delete/",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          credentials: "include",
          body: JSON.stringify({ ids, allow_paid: false }),
        }
      );
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      clearSelection();
      alert("История удалена");
      // После удаления всех записей возвращаемся на первую страницу
      const params = new URLSearchParams(searchParams);
      params.delete("page");
      setSearchParams(params, { replace: true });
      dispatch(historySellProduct({ search: "", page: 1 }));
      dispatch(historySellObjects({ search: "", page: 1 }));
    } catch (e) {
      alert("Не удалось очистить историю: " + e.message);
    } finally {
      setClearing(false);
    }
  };

  const SelectionActions = ({ pageItems }) => {
    const allOnPageChecked =
      pageItems.length > 0 && pageItems.every((i) => selectedIds.has(i.id));
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <>
          {/* <span style={{ opacity: 0.75 }}>Выбрано: {selectedIds.size}</span> */}
          <button
            className="sell__delete"
            // style={{ background: "#e53935" }}
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            title="Массовое удаление выбранных"
          >
            {bulkDeleting ? "Удаляем..." : "Удалить"}
          </button>
          <button
            className="sell__reset"
            onClick={clearSelection}
            style={{ cursor: "pointer" }}
            title="Снять выбор"
          >
            Очистить
          </button>
        </>
      </div>
    );
  };

  return (
    <div>
      <>
        <div className="sell__header">
          <div className="sell__header-left">
            <div className="sell__header-input">
              <input className="w-full" onChange={onChange} type="text" placeholder="Поиск" />
              <span>
                <Search size={15} color="#91929E" />
              </span>
            </div>
          </div>
          <div className="sell__header-left">
            {selectedIds.size > 0 ? (
              <SelectionActions pageItems={filterField} />
            ) : (
              <>
                {isBuildingCompany ? (
                  <button
                    className="sklad__add"
                    onClick={() => setShowBuilding(true)}
                  >
                    <Plus size={16} style={{ marginRight: 4 }} /> Продать
                    квартиру
                  </button>
                ) : (
                  <>
                    <button
                      className="sell__header-btn"
                      onClick={() => setShowAddCashboxModal(true)}
                    >
                      Прочие расходы
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <div className="sell__history">
          <div className="sell__history-toolbar">
            <label className="sell__selectAll">
              <input
                type="checkbox"
                checked={
                  filterField.length > 0 &&
                  filterField.every((i) => selectedIds.has(i.id))
                }
                onChange={() => toggleSelectAllOnPage(filterField)}
              />
              <span>Выбрать все на странице</span>
            </label>
            <div className="sell__history-meta">
              <span>Показано: {filterField.length}</span>
              <span>Всего: {count || 0}</span>
            </div>
          </div>

          {filterField.length === 0 ? (
            <div className="sell__empty">Ничего не найдено</div>
          ) : (
            <div className="sell__cards">
              {filterField.map((item, idx) => {
                const thumb = getSaleThumb(item);
                const itemsCount = getItemsCount(item);
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
                            <b>{translatePaymentMethod(item.payment_method)}</b>
                          </div>
                          <div className="sellCard__kv">
                            <span>Сумма</span>
                            <b>{formatMoney(item.total)} сом</b>
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
                        {company?.sector?.name === "Магазин" && (
                          <button
                            className="sellCard__refund"
                            onClick={() => handleOpen(item)}
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
              disabled={loading || !hasNextPage || (totalPages && currentPage >= totalPages)}
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
      {showRefundModal && (
        <RefundPurchase
          item={itemId}
          onClose={() => setShowRefundModal(false)}
          onChanged={() => {
            hideSaleId(itemId?.id);
            setShowRefundModal(false);
            dispatch(historySellProduct({ search: "", page: currentPage }));
            dispatch(historySellObjects({ search: "", page: currentPage }));
          }}
        />
      )}
      {showBuilding && (
        <SellBuildingModal onClose={() => setShowBuilding(false)} />
      )}
      {showDetailSell && (
        <SellDetail onClose={() => setShowDetailSell(false)} id={sellId} />
      )}
    </div>
  );
};

export default Sell;
