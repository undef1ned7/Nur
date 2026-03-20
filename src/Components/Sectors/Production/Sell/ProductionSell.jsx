import { Search } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "../../../../hooks/useDebounce";
import { getAgentSalesList, agentSaleReturn } from "../../../../api/agentSales";
import { useUser } from "../../../../store/slices/userSlice";
import DataContainer from "../../../common/DataContainer/DataContainer";
import ProductionSellDetail from "./ProductionSellDetail";
import "../../../pages/Sell/sell.scss";
import "./ProductionSell.scss";

const STATUS_OPTIONS = [
  { value: "", label: "Все" },
  { value: "new", label: "Новая" },
  { value: "paid", label: "Оплачена" },
  { value: "debt", label: "Долг" },
  { value: "canceled", label: "Отменена" },
];

const ORDERING_OPTIONS = [
  { value: "-created_at", label: "Дата (новые)" },
  { value: "created_at", label: "Дата (старые)" },
  { value: "-total", label: "Сумма (убыв.)" },
  { value: "total", label: "Сумма (возр.)" },
  { value: "status", label: "Статус" },
];

const kindTranslate = {
  new: "Новая",
  paid: "Оплачена",
  canceled: "Отменена",
  debt: "Долг",
};

const paymentMethodTranslate = {
  cash: "Наличные",
  card: "Карта",
  transfer: "Перевод",
  debt: "Долг",
};

const ProductionSell = () => {
  const navigate = useNavigate();
  const { profile } = useUser();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const [detailId, setDetailId] = useState("");
  const [historyView, setHistoryView] = useState("table");

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("-created_at");
  const [returningId, setReturningId] = useState(null);

  const debouncedSetSearch = useDebounce((value) => setSearch(value), 500);

  const fetchList = useCallback(() => {
    setLoading(true);
    setError("");
    const params = { ordering };
    if (start) params.start = start;
    if (end) params.end = end;
    if (status) params.status = status;
    if (search) params.search = search;

    getAgentSalesList(params)
      .then((data) => {
        const arr = Array.isArray(data) ? data : (data?.results ?? []);
        setList(arr);
      })
      .catch((err) => {
        const msg =
          err?.response?.data?.detail ||
          err?.message ||
          "Не удалось загрузить список продаж";
        setError(msg);
        setList([]);
      })
      .finally(() => setLoading(false));
  }, [start, end, status, ordering, search]);

  const canReturnSale = (sale) => {
    const s = (sale?.status || "").toLowerCase();
    return s === "paid" || s === "debt";
  };

  const handleReturn = useCallback(
    async (item) => {
      if (!item?.id || !canReturnSale(item)) return;
      if (
        !window.confirm(
          "Выполнить возврат? Статус продажи станет «Возвращена», товар вернётся на склад или агенту.",
        )
      )
        return;
      setReturningId(item.id);
      setError("");
      try {
        await agentSaleReturn(item.id);
        fetchList();
      } catch (err) {
        const msg =
          err?.response?.data?.detail ||
          err?.message ||
          "Не удалось выполнить возврат";
        setError(msg);
      } finally {
        setReturningId(null);
      }
    },
    [fetchList],
  );

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const formatMoney = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "—";
    try {
      return new Date(dateString).toLocaleString("ru-RU", {
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

  const getItemsCount = (sale) => {
    const items = sale?.items;
    if (Array.isArray(items)) return items.length;
    const n = Number(sale?.items_count ?? sale?.items_count);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const getStatusVariant = (s) => {
    const v = String(s || "").toLowerCase();
    if (v === "paid") return "paid";
    if (v === "canceled" || v === "cancelled") return "canceled";
    if (v === "debt") return "debt";
    return "new";
  };

  const translatePaymentMethod = (method) =>
    paymentMethodTranslate[method?.toLowerCase()] || method || "—";

  const firstItemName = (sale) =>
    sale?.first_item_name ??
    sale?.items?.[0]?.product_name ??
    sale?.items?.[0]?.name ??
    "—";

  const isOwner = profile?.role === "owner";

  return (
    <div>
      <div className="sell__header">
        <div className="sell__header-left">
          <div className="sell__header-input">
            <input
              className="w-full"
              type="text"
              placeholder="Поиск по ID"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                debouncedSetSearch(e.target.value);
              }}
            />
            <span>
              <Search size={15} color="#91929E" />
            </span>
          </div>
        </div>
        {isOwner && (
          <button
            type="button"
            className="sell__header-btn production-sell__start-btn"
            onClick={() => navigate("start")}
          >
            Начать продажу
          </button>
        )}
      </div>

      <div className="sell__history production-sell">
        <div className="sell__history-toolbar">
          <div className="production-sell-filters">
            <div className="production-sell-filters__field">
              <span className="production-sell-filters__label">Период от</span>
              <input
                type="date"
                className="production-sell-filters__input"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                aria-label="Дата начала периода"
              />
            </div>
            <div className="production-sell-filters__field">
              <span className="production-sell-filters__label">Период до</span>
              <input
                type="date"
                className="production-sell-filters__input"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                aria-label="Дата окончания периода"
              />
            </div>
            <div className="production-sell-filters__field">
              <span className="production-sell-filters__label">Статус</span>
              <select
                className="production-sell-filters__input"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="Фильтр по статусу"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="production-sell-filters__field">
              <span className="production-sell-filters__label">Сортировка</span>
              <select
                className="production-sell-filters__input"
                value={ordering}
                onChange={(e) => setOrdering(e.target.value)}
                aria-label="Сортировка списка"
              >
                {ORDERING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="sell__history-toolbarRight">
            <div
              className="sell__viewToggle"
              role="group"
              aria-label="Вид списка"
            >
              <button
                type="button"
                className={`sell__viewBtn ${historyView === "table" ? "sell__viewBtn--active" : ""}`}
                onClick={() => setHistoryView("table")}
              >
                Таблица
              </button>
              <button
                type="button"
                className={`sell__viewBtn ${historyView === "cards" ? "sell__viewBtn--active" : ""}`}
                onClick={() => setHistoryView("cards")}
              >
                Карточки
              </button>
            </div>
            <div className="sell__history-meta">
              <span>Показано: {list.length}</span>
            </div>
          </div>
        </div>

        {error && <p style={{ color: "#b91c1c", padding: 12 }}>{error}</p>}

        {loading && <div className="sell__empty">Загрузка...</div>}

        {!loading && list.length === 0 && !error && (
          <div className="sell__empty">Ничего не найдено</div>
        )}

        {!loading && list.length > 0 && (
          <DataContainer>
            {historyView === "table" ? (
              <div className="sellTable__wrap">
                <table className="sellTable">
                  <thead>
                    <tr>
                      <th>№</th>
                      <th>Статус</th>
                      <th>Товар</th>
                      <th>Оплата</th>
                      <th>Сумма</th>
                      <th>Позиции</th>
                      <th>Дата</th>
                      <th>Клиент</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((item, idx) => {
                      const statusLabel =
                        kindTranslate[item.status] || item.status || "—";
                      const statusVariant = getStatusVariant(item.status);
                      const itemsCount = getItemsCount(item);
                      return (
                        <tr
                          key={item.id}
                          className="sellTable__row"
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setDetailId(item.id);
                            setShowDetail(true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              setDetailId(item.id);
                              setShowDetail(true);
                            }
                          }}
                        >
                          <td className="sellTable__no">№ {idx + 1}</td>
                          <td>
                            <span
                              className={`sellBadge sellBadge--${statusVariant}`}
                            >
                              {statusLabel}
                            </span>
                          </td>
                          <td className="sellTable__title">
                            {firstItemName(item)}
                          </td>
                          <td>{translatePaymentMethod(item.payment_method)}</td>
                          <td>{formatMoney(item.total)} сом</td>
                          <td className="sellTable__count">
                            {itemsCount !== null ? itemsCount : "—"}
                          </td>
                          <td className="sellTable__date">
                            {formatDateTime(item.created_at)}
                          </td>
                          <td className="sellTable__client">
                            {item.client_name ?? "—"}
                          </td>
                          <td
                            className="sellTable__actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {canReturnSale(item) && (
                              <button
                                type="button"
                                className="sellTable__refund"
                                onClick={() => handleReturn(item)}
                                disabled={returningId === item.id}
                              >
                                {returningId === item.id
                                  ? "Возврат…"
                                  : "Возврат"}
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
                {list.map((item, idx) => {
                  const statusLabel =
                    kindTranslate[item.status] || item.status || "—";
                  const statusVariant = getStatusVariant(item.status);
                  const itemsCount = getItemsCount(item);
                  return (
                    <div
                      key={item.id}
                      className="sellCard"
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setDetailId(item.id);
                        setShowDetail(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setDetailId(item.id);
                          setShowDetail(true);
                        }
                      }}
                    >
                      <div className="sellCard__top">
                        <span className="sellCard__no">№ {idx + 1}</span>
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
                            {firstItemName(item)}
                          </div>
                          <div className="sellCard__subtitle">
                            Клиент: <b>{item.client_name ?? "—"}</b>
                            {itemsCount != null && itemsCount > 1 && (
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
                              <span>Позиции</span>
                              <b>{itemsCount != null ? itemsCount : "—"}</b>
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
                              onClick={() => handleReturn(item)}
                              disabled={returningId === item.id}
                            >
                              {returningId === item.id ? "Возврат…" : "Возврат"}
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

      {showDetail && detailId && (
        <ProductionSellDetail
          id={detailId}
          onClose={() => {
            setShowDetail(false);
            setDetailId("");
          }}
          onReturnSuccess={fetchList}
        />
      )}
    </div>
  );
};

export default ProductionSell;
