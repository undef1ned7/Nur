import React, { useEffect, useMemo, useState } from "react";
import FinishedGoods from "../FinishedGoods/FinishedGoods";
import RawMaterialsWarehouse from "../RawMaterialsWarehouse/RawMaterialsWarehouse";
import TransferStatusModal from "../TransferStatus/TransferStatus";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchProductsAsync,
  updateProductAsync,
} from "../../../../store/creators/productCreators";
import api from "../../../../api";
import {
  X,
  Search,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Package,
} from "lucide-react";
import { useProducts } from "../../../../store/slices/productSlice";
import "./PendingModal.scss";
import AlertModal from "../../../common/AlertModal/AlertModal";
import {
  fetchTransfersAsync,
  fetchReturnsAsync,
  approveReturnAsync,
} from "../../../../store/creators/transferCreators";
import { useDepartments } from "../../../../store/slices/departmentSlice";
import { getEmployees } from "../../../../store/creators/departmentCreators";
import { useUser } from "../../../../store/slices/userSlice";
import {
  listAgentCartsAsync,
  approveAgentCartAsync,
  rejectAgentCartAsync,
} from "../../../../store/creators/agentCartCreators";
import ReactPortal from "../../../common/Portal/ReactPortal";
import { useDebouncedValue } from "../../../../hooks/useDebounce";

/**
 * Склеивает возвраты (returns) с передачами (transfers).
 * @param {Array} transfers  Массив передач [{ id, agent, agent_name, product, product_name, ... }]
 * @param {Array} returnsArr Массив возвратов [{ subreal, qty }]
 * @param {Object} [opts]
 * @param {string} [opts.agentId]  фильтр по id агента
 * @param {string} [opts.query]    поиск по product_name / agent_name
 * @param {boolean} [opts.group]   агрегировать по subreal (по умолчанию true)
 * @returns {Array} массив для таблицы
 */
export function buildReturnRowsFromArrays(
  transfers,
  returnsArr,
  { agentId = "", query = "", group = true } = {}
) {
  const tById = new Map((transfers || []).map((t) => [t.id, t]));

  let rows = (returnsArr || [])
    .map((r) => {
      const t = tById.get(r.subreal);
      if (!t) return null;
      return {
        // ключи
        id: `${r.subreal}__${Math.random().toString(36).slice(2, 8)}`,
        subreal: r.subreal,

        // данные возврата
        qty: Number(r.qty) || 0,

        // данные передачи
        agent: t.agent,
        agent_name: t.agent_name,
        product: t.product,
        product_name: t.product_name,
        created_at: t.created_at,
        status: t.status,

        // доп. поля из передачи (по желанию)
        qty_transferred: t.qty_transferred,
        qty_accepted: t.qty_accepted,
        qty_returned: t.qty_returned,
        qty_remaining: t.qty_remaining,
        qty_on_agent: t.qty_on_agent,
      };
    })
    .filter(Boolean);

  if (group) {
    const bySubreal = new Map();
    for (const x of rows) {
      const prev = bySubreal.get(x.subreal);
      if (prev) prev.qty += x.qty;
      else bySubreal.set(x.subreal, { ...x });
    }
    rows = Array.from(bySubreal.values());
  }

  if (agentId) rows = rows.filter((x) => x.agent === agentId);

  if (query) {
    const q = String(query).toLowerCase();
    rows = rows.filter(
      (x) =>
        String(x.product_name || "")
          .toLowerCase()
          .includes(q) ||
        String(x.agent_name || "")
          .toLowerCase()
          .includes(q)
    );
  }

  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return rows;
}

const PendingModal = ({ onClose, onChanged }) => {
  const dispatch = useDispatch();

  const { list: returns, loading: returnsLoading } = useSelector(
    (state) => state.return || { list: [], loading: false }
  );
  const { profile } = useUser();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [acceptingReturn, setAcceptingReturn] = useState(null);
  const [activeTab, setActiveTab] = useState(1);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [alertModal, setAlertModal] = useState({
    open: false,
    type: "success",
    title: "",
    message: "",
  });

  // Сброс поиска при переключении вкладок
  const handleTabChange = (index) => {
    setActiveTab(index);
    setSearchQuery("");
    setExpandedRows(new Set());
  };

  // Переключение расширения строки
  const toggleRowExpansion = (cartId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(cartId)) {
      newExpanded.delete(cartId);
    } else {
      newExpanded.add(cartId);
    }
    setExpandedRows(newExpanded);
  };

  // ---------------- ФИЛЬТРАЦИЯ ТОЛЬКО PENDING ----------------
  const filterReturns = useMemo(() => returns.filter((item) => item.status === "pending"), [returns]);
  // -----------------------------------------------------------

  useEffect(() => {
    dispatch(fetchReturnsAsync());
    // если владелец — тянем все передачи, иначе только по агенту
    dispatch(
      fetchTransfersAsync(
        profile?.role === "owner" ? {} : { agent: profile?.id }
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const handleAcceptReturn = async (agentId) => {
    const group = groupedReturns.find((g) => g.agentId === agentId);
    if (!group) return;

    setAcceptingReturn(agentId);
    try {
      // Принимаем все возвраты агента
      const promises = group.returns.map((returnItem) =>
        dispatch(approveReturnAsync(returnItem.id)).unwrap()
      );
      await Promise.all(promises);

      setAlertModal({
        open: true,
        type: "success",
        title: "Успешно",
        message: `Все возвраты агента "${group.agentName}" успешно приняты! Всего: ${group.returns.length} возвратов, количество: ${group.totalQty}`,
      });
      onChanged?.();
      dispatch(fetchReturnsAsync());
      setTimeout(() => {
        onClose?.();
      }, 1500);
    } catch (error) {
      console.error("Accept returns failed:", error);
      setAlertModal({
        open: true,
        type: "error",
        title: "Ошибка",
        message: `Ошибка при принятии возвратов: ${error?.message || "неизвестная ошибка"
          }`,
      });
    } finally {
      setAcceptingReturn(null);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await dispatch(
        listAgentCartsAsync({ status: "submitted" })
      ).unwrap();
      const list = Array.isArray(data) ? data : data?.results || [];
      setRows(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    dispatch(getEmployees());
  }, []);
  // Группировка возвратов по агенту
  const groupedReturns = useMemo(() => {
    const grouped = new Map();

    filterReturns.forEach((returnItem) => {
      const agentId = returnItem.agent || returnItem.agent_id || "unknown";
      const agentName =
        returnItem.agent_name || returnItem.agent || "Неизвестный агент";

      if (!grouped.has(agentId)) {
        grouped.set(agentId, {
          agentId,
          agentName,
          returns: [],
          totalQty: 0,
          earliestDate: null,
        });
      }

      const group = grouped.get(agentId);
      group.returns.push(returnItem);
      group.totalQty += Number(returnItem.qty || 0);

      if (returnItem.returned_at) {
        const date = new Date(returnItem.returned_at);
        if (!group.earliestDate || date < group.earliestDate) {
          group.earliestDate = date;
        }
      }
    });

    return Array.from(grouped.values());
  }, [filterReturns]);

  // Фильтрация сгруппированных возвратов по поисковому запросу
  const filteredReturns = useMemo(() => {
    if (!searchQuery.trim()) return groupedReturns;
    const q = searchQuery.toLowerCase().trim();
    return groupedReturns.filter(
      (group) =>
        String(group.agentName || "")
          .toLowerCase()
          .includes(q) ||
        group.returns.some((item) =>
          String(item.product || "")
            .toLowerCase()
            .includes(q)
        )
    );
  }, [groupedReturns, searchQuery]);

  // Группировка корзин по агенту
  const groupedCarts = useMemo(() => {
    const grouped = new Map();

    (rows || []).forEach((cart) => {
      const agentId = cart?.agent?.id || cart?.agent_id || "unknown";
      const agentName =
        cart?.agent_name ||
        [cart?.agent?.first_name, cart?.agent?.last_name]
          .filter(Boolean)
          .join(" ") ||
        "Неизвестный агент";

      if (!grouped.has(agentId)) {
        grouped.set(agentId, {
          agentId,
          agentName,
          carts: [],
          totalItems: 0,
          allItems: [],
          earliestDate: null,
        });
      }

      const group = grouped.get(agentId);
      group.carts.push(cart);
      group.totalItems += Array.isArray(cart?.items) ? cart.items.length : 0;

      // Собираем все товары из всех корзин агента
      if (Array.isArray(cart?.items)) {
        group.allItems.push(...cart.items);
      }

      if (cart?.submitted_at) {
        const date = new Date(cart.submitted_at);
        if (!group.earliestDate || date < group.earliestDate) {
          group.earliestDate = date;
        }
      }
    });

    return Array.from(grouped.values());
  }, [rows]);

  // Фильтрация сгруппированных корзин
  const filteredRows = useMemo(() => {
    let filtered = groupedCarts;

    if (selectedAgent) {
      filtered = filtered.filter(
        (group) => String(group.agentId) === String(selectedAgent)
      );
    }

    const q = String(searchQuery || "")
      .toLowerCase()
      .trim();
    if (q) {
      filtered = filtered.filter((group) => {
        const agentName = String(group.agentName || "").toLowerCase();
        const hasMatchingClient = group.carts.some((cart) =>
          String(cart?.client_name || cart?.client?.full_name || "")
            .toLowerCase()
            .includes(q)
        );
        const hasMatchingProduct = group.allItems.some((item) =>
          String(item?.product_name || item?.name || "")
            .toLowerCase()
            .includes(q)
        );
        return agentName.includes(q) || hasMatchingClient || hasMatchingProduct;
      });
    }

    return filtered;
  }, [groupedCarts, selectedAgent, searchQuery]);

  const handleApprove = async (agentId) => {
    const group = groupedCarts.find((g) => g.agentId === agentId);
    if (!group) return;

    setActionLoadingId(agentId);
    try {
      // Одобряем все корзины агента
      const approvePromises = group.carts.map((cart) =>
        dispatch(approveAgentCartAsync(cart.id)).unwrap()
      );
      await Promise.all(approvePromises);

      // Уменьшаем количество товаров на складе для всех товаров всех корзин
      for (const item of group.allItems) {
        const productId = item.product;
        const quantityToDeduct = Number(
          item.quantity_requested || item.total_quantity || 0
        );

        if (!productId || quantityToDeduct <= 0) {
          console.warn(
            `Пропущен товар: productId=${productId}, quantity=${quantityToDeduct}`
          );
          continue;
        }

        try {
          // Получаем текущий товар для получения актуального количества
          const { data: currentProduct } = await api.get(
            `/main/products/${productId}/`
          );

          const currentQuantity = Number(currentProduct?.quantity || 0);
          const newQuantity = Math.max(0, currentQuantity - quantityToDeduct);

          // Обновляем количество товара на складе через PATCH запрос
          await dispatch(
            updateProductAsync({
              productId,
              updatedData: {
                quantity: newQuantity,
              },
            })
          ).unwrap();
        } catch (productError) {
          console.error(
            `Ошибка при обновлении количества товара ${productId}:`,
            productError
          );
          // Продолжаем обработку других товаров даже при ошибке
        }
      }

      setAlertModal({
        open: true,
        type: "success",
        title: "Успешно",
        message: `Все корзины агента "${group.agentName}" одобрены! Всего: ${group.carts.length} корзин`,
      });
      // Обновляем список корзин
      await load();
      // Обновляем список товаров на складе, чтобы отобразить актуальные количества
      dispatch(fetchProductsAsync());
      // Вызываем callback для обновления данных в родительском компоненте
      onChanged?.();
    } catch (e) {
      console.error("Ошибка при одобрении корзин:", e);
      setAlertModal({
        open: true,
        type: "error",
        title: "Ошибка",
        message: `Ошибка при одобрении корзин: ${e?.message || "неизвестная ошибка"
          }`,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (agentId) => {
    const group = groupedCarts.find((g) => g.agentId === agentId);
    if (!group) return;

    setActionLoadingId(agentId);
    try {
      // Отклоняем все корзины агента
      const rejectPromises = group.carts.map((cart) =>
        dispatch(rejectAgentCartAsync({ id: cart.id })).unwrap()
      );
      await Promise.all(rejectPromises);

      setAlertModal({
        open: true,
        type: "success",
        title: "Успешно",
        message: `Все корзины агента "${group.agentName}" отклонены! Всего: ${group.carts.length} корзин`,
      });
      await load();
    } catch (e) {
      setAlertModal({
        open: true,
        type: "error",
        title: "Ошибка",
        message: "Ошибка при отклонении корзин",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const tabs = [
    {
      label: "Возвращенные товары",
      content: (
        <div className="pending-modal__content">
          {/* Фильтры */}
          <div className="pending-modal__filters">
            <div style={{ position: "relative", flex: 1 }}>
              <Search
                size={18}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#9ca3af",
                }}
              />
              <input
                type="text"
                placeholder="Поиск по товару или агенту"
                className="pending-modal__search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: "40px" }}
              />
            </div>
          </div>

          {returnsLoading ? (
            <div className="pending-modal__loading">Загрузка возвратов…</div>
          ) : filteredReturns.length === 0 ? (
            <div className="pending-modal__empty">
              {searchQuery
                ? "По запросу ничего не найдено"
                : "Нет возвратов в статусе pending"}
            </div>
          ) : (
            <div className="pending-modal__table-wrapper">
              <table className="pending-modal__table">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Товары</th>
                    <th>Агент</th>
                    <th>Кол-во</th>
                    <th>Дата возврата</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReturns.map((group, idx) => {
                    const isExpanded = expandedRows.has(group.agentId);
                    return (
                      <React.Fragment key={group.agentId}>
                        <tr
                          style={{ cursor: "pointer" }}
                          onClick={() => toggleRowExpansion(group.agentId)}
                        >
                          <td data-label="№">
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              {isExpanded ? (
                                <ChevronUp
                                  size={16}
                                  style={{ color: "#6b7280" }}
                                />
                              ) : (
                                <ChevronDown
                                  size={16}
                                  style={{ color: "#6b7280" }}
                                />
                              )}
                              {idx + 1}
                            </div>
                          </td>
                          <td data-label="Товары">
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <Package size={14} style={{ color: "#6b7280" }} />
                              {group.returns.length} возвратов
                            </div>
                          </td>
                          <td data-label="Агент">{group.agentName}</td>
                          <td data-label="Кол-во">{group.totalQty}</td>
                          <td data-label="Дата возврата">
                            {group.earliestDate
                              ? group.earliestDate.toLocaleString("ru-RU", {
                                timeZone: "Asia/Bishkek",
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                              : "—"}
                          </td>
                          <td
                            data-label="Действия"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="pending-modal__btn pending-modal__btn--primary"
                              onClick={() => handleAcceptReturn(group.agentId)}
                              disabled={acceptingReturn === group.agentId}
                              title="Принять все возвраты агента"
                            >
                              <CheckCircle
                                size={16}
                                style={{ marginRight: "6px" }}
                              />
                              {acceptingReturn === group.agentId
                                ? "Принятие..."
                                : "Принять все"}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && group.returns.length > 0 && (
                          <tr className="pending-modal__expanded-row">
                            <td colSpan={6}>
                              <div className="pending-modal__items-list">
                                <div className="pending-modal__items-header">
                                  <Package size={16} />
                                  <span>
                                    Возвраты агента ({group.returns.length})
                                  </span>
                                </div>
                                <div className="pending-modal__items-grid">
                                  {group.returns.map((returnItem, itemIdx) => (
                                    <div
                                      key={returnItem.id || itemIdx}
                                      className="pending-modal__item-card"
                                    >
                                      <div className="pending-modal__item-name">
                                        {returnItem.product ||
                                          "Товар без названия"}
                                      </div>
                                      <div className="pending-modal__item-details">
                                        <span className="pending-modal__item-quantity">
                                          Количество:{" "}
                                          <strong>{returnItem.qty || 0}</strong>
                                        </span>
                                        {returnItem.returned_at && (
                                          <span className="pending-modal__item-price">
                                            Дата:{" "}
                                            <strong>
                                              {new Date(
                                                returnItem.returned_at
                                              ).toLocaleString("ru-RU", {
                                                timeZone: "Asia/Bishkek",
                                                day: "2-digit",
                                                month: "2-digit",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                              })}
                                            </strong>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ),
    },
    {
      label: "Запрос на передачу",
      content: (
        <div className="pending-modal__content">
          {/* Фильтры */}
          <div className="pending-modal__filters">
            <div style={{ position: "relative", flex: 1 }}>
              <Search
                size={18}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#9ca3af",
                }}
              />
              <input
                type="text"
                placeholder="Поиск по агенту или клиенту"
                className="pending-modal__search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: "40px" }}
              />
            </div>
          </div>

          {loading ? (
            <div className="pending-modal__loading">Загрузка…</div>
          ) : filteredRows.length === 0 ? (
            <div className="pending-modal__empty">
              {searchQuery
                ? "По запросу ничего не найдено"
                : "Нет корзин в статусе submitted"}
            </div>
          ) : (
            <div className="pending-modal__table-wrapper">
              <table className="pending-modal__table">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Агент</th>
                    <th>Клиент</th>
                    <th>Комментарий</th>
                    <th>Отправлено</th>
                    <th>Позиций</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((group, idx) => {
                    const isExpanded = expandedRows.has(group.agentId);
                    const allClients = Array.from(
                      new Set(
                        group.carts
                          .map(
                            (cart) =>
                              cart?.client_name || cart?.client?.full_name
                          )
                          .filter(Boolean)
                      )
                    );

                    return (
                      <React.Fragment key={group.agentId}>
                        <tr
                          style={{ cursor: "pointer" }}
                          onClick={() => toggleRowExpansion(group.agentId)}
                        >
                          <td data-label="№">
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              {isExpanded ? (
                                <ChevronUp
                                  size={16}
                                  style={{ color: "#6b7280" }}
                                />
                              ) : (
                                <ChevronDown
                                  size={16}
                                  style={{ color: "#6b7280" }}
                                />
                              )}
                              {idx + 1}
                            </div>
                          </td>
                          <td data-label="Агент">{group.agentName}</td>
                          <td data-label="Клиенты">
                            {allClients.length > 0
                              ? allClients.length === 1
                                ? allClients[0]
                                : `${allClients.length} клиентов`
                              : "—"}
                          </td>
                          <td data-label="Комментарий">
                            {group.carts.length} корзин
                          </td>
                          <td data-label="Отправлено">
                            {group.earliestDate
                              ? group.earliestDate.toLocaleString("ru-RU")
                              : "—"}
                          </td>
                          <td data-label="Позиций">
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <Package size={14} style={{ color: "#6b7280" }} />
                              {group.allItems.length}
                            </div>
                          </td>
                          <td
                            data-label="Действия"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div
                              className="flex gap-2 items-center flex-wrap"

                            >
                              <button
                                className="pending-modal__btn pending-modal__btn--primary"
                                onClick={() => handleApprove(group.agentId)}
                                disabled={actionLoadingId === group.agentId}
                                title="Одобрить все корзины агента"
                              >
                                <CheckCircle
                                  size={16}
                                  style={{ marginRight: "6px" }}
                                />
                                {actionLoadingId === group.agentId
                                  ? "…"
                                  : "Одобрить все"}
                              </button>
                              <button
                                className="pending-modal__btn pending-modal__btn--secondary"
                                onClick={() => handleReject(group.agentId)}
                                disabled={actionLoadingId === group.agentId}
                                title="Отклонить все корзины агента"
                              >
                                <XCircle
                                  size={16}
                                  style={{ marginRight: "6px" }}
                                />
                                Отклонить все
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && group.allItems.length > 0 && (
                          <tr className="pending-modal__expanded-row">
                            <td colSpan={7}>
                              <div className="pending-modal__items-list">
                                <div className="pending-modal__items-header">
                                  <Package size={16} />
                                  <span>
                                    Товары агента ({group.allItems.length} из{" "}
                                    {group.carts.length} корзин)
                                  </span>
                                </div>
                                <div className="pending-modal__items-grid">
                                  {group.allItems.map((item, itemIdx) => (
                                    <div
                                      key={item.id || itemIdx}
                                      className="pending-modal__item-card"
                                    >
                                      <div className="pending-modal__item-name">
                                        {item.product_name ||
                                          item.name ||
                                          "Товар без названия"}
                                      </div>
                                      <div className="pending-modal__item-details">
                                        <span className="pending-modal__item-quantity">
                                          Количество:{" "}
                                          <strong>
                                            {item.quantity_requested ||
                                              item.total_quantity ||
                                              item.quantity ||
                                              0}
                                          </strong>
                                        </span>
                                        {item.unit_price && (
                                          <span className="pending-modal__item-price">
                                            Цена:{" "}
                                            <strong>
                                              {Number(item.unit_price).toFixed(
                                                2
                                              )}
                                            </strong>
                                          </span>
                                        )}
                                        {item.total && (
                                          <span className="pending-modal__item-total">
                                            Итого:{" "}
                                            <strong>
                                              {Number(item.total).toFixed(2)}
                                            </strong>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="pending-modal-overlay z-101!" onClick={onClose}>
      <div
        className="pending-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="pending-modal__header">
          <h2 className="pending-modal__title">Запросы</h2>
          <button className="pending-modal__close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="pending-modal__tabs">
          {tabs.map((tab, index) => (
            <button
              key={index}
              className={`pending-modal__tab ${index === activeTab ? "pending-modal__tab--active" : ""
                }`}
              onClick={() => handleTabChange(index)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {tabs[activeTab].content}

        <div className="pending-modal__actions">
          <button
            className="pending-modal__btn pending-modal__btn--secondary"
            onClick={onClose}
          >
            Закрыть
          </button>
          <button
            className="pending-modal__btn pending-modal__btn--primary"
            onClick={() => {
              if (activeTab === 0) {
                dispatch(fetchReturnsAsync());
              } else {
                load();
              }
              onChanged?.();
            }}
          >
            <RefreshCw size={16} style={{ marginRight: "6px" }} />
            Обновить список
          </button>
        </div>
      </div>
      <AlertModal
        open={alertModal.open}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        onClose={() => setAlertModal({ ...alertModal, open: false })}
      />
    </div>

  );
};

const ProductionWarehouse = () => {
  const [activeTab, setActiveTab] = useState(0);
  const dispatch = useDispatch();
  const { list: products } = useProducts();

  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showAgentCartsModal, setShowAgentCartsModal] = useState(false);
  const [showTransferStatusModal, setShowTransferStatusModal] = useState(false);

  const tabs = [
    {
      label: "Склад готовой продукции",
      content: (
        <FinishedGoods
          products={products}
          onChanged={() => dispatch(fetchProductsAsync())}
        />
      ),
    },
    {
      label: "Склад сырья",
      content: <RawMaterialsWarehouse />,
    },
  ];
  useEffect(() => {
    dispatch(fetchProductsAsync());
  }, []);

  return (
    <section className="warehouseP sklad">
      <div className="vitrina__header" style={{ margin: "15px 0" }}>
        <div className="vitrina__tabs flex-wrap px-0! md:w-full md:justify-center lg:justify-start">
          {tabs.map((tab, index) => {
            return (
              <span
                key={index}
                className={`vitrina__tab ${index === activeTab && "vitrina__tab--active"
                  } flex-1/2 md:flex-none`}
                style={{ cursor: "pointer" }}
                onClick={() => setActiveTab(index)}
              >
                {tab.label}
              </span>
            );
          })}
          {activeTab === 0 && (
            <>
              <span
                onClick={() => setShowPendingModal(true)}
                className={`vitrina__tab flex-3 md:flex-none`}
                style={{ cursor: "pointer" }}
              >
                Запросы
              </span>
              {/* <span
                onClick={() => setShowTransferStatusModal(true)}
                className={`vitrina__tab`}
                style={{ cursor: "pointer" }}
              >
                Статус передач
              </span> */}
            </>
          )}
        </div>
      </div>
      <>{tabs[activeTab].content}</>
      {showPendingModal && (
        <PendingModal
          onClose={() => setShowPendingModal(false)}
          onChanged={() => dispatch(fetchProductsAsync())}
        />
      )}
      {showAgentCartsModal && (
        <AgentCartsPendingModal
          onClose={() => setShowAgentCartsModal(false)}
          onChanged={() => dispatch(fetchProductsAsync())}
        />
      )}
      {showTransferStatusModal && (
        <TransferStatusModal
          onClose={() => setShowTransferStatusModal(false)}
          onChanged={() => dispatch(fetchProductsAsync())}
        />
      )}
    </section>
  );
};

export default ProductionWarehouse;

// Модалка: список агентских корзин в статусе SUBMITTED
const AgentCartsPendingModal = ({ onClose, onChanged }) => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [alertModal, setAlertModal] = useState({
    open: false,
    type: "success",
    title: "",
    message: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await dispatch(
        listAgentCartsAsync({ status: "submitted" })
      ).unwrap();
      const list = Array.isArray(data) ? data : data?.results || [];
      setRows(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleApprove = async (id) => {
    setActionLoadingId(id);
    try {
      // Получаем данные корзины перед одобрением, чтобы знать какие товары и в каком количестве
      const cart = rows.find((c) => c.id === id);
      if (!cart || !cart.items || !Array.isArray(cart.items)) {
        throw new Error("Не удалось найти данные корзины");
      }

      // Одобряем корзину
      await dispatch(approveAgentCartAsync(id)).unwrap();

      // Уменьшаем количество товаров на складе для каждого товара в корзине
      for (const item of cart.items) {
        const productId = item.product;
        const quantityToDeduct = Number(
          item.quantity_requested || item.total_quantity || 0
        );

        if (!productId || quantityToDeduct <= 0) {
          console.warn(
            `Пропущен товар: productId=${productId}, quantity=${quantityToDeduct}`
          );
          continue;
        }

        try {
          // Получаем текущий товар для получения актуального количества
          const { data: currentProduct } = await api.get(
            `/main/products/${productId}/`
          );

          const currentQuantity = Number(currentProduct?.quantity || 0);
          const newQuantity = Math.max(0, currentQuantity - quantityToDeduct);

          // Обновляем количество товара на складе через PATCH запрос
          await dispatch(
            updateProductAsync({
              productId,
              updatedData: {
                quantity: newQuantity,
              },
            })
          ).unwrap();
        } catch (productError) {
          console.error(
            `Ошибка при обновлении количества товара ${productId}:`,
            productError
          );
          // Продолжаем обработку других товаров даже при ошибке
        }
      }

      setAlertModal({
        open: true,
        type: "success",
        title: "Успешно",
        message: "Корзина одобрена",
      });
      // Обновляем список корзин
      await load();
      // Обновляем список товаров на складе, чтобы отобразить актуальные количества
      dispatch(fetchProductsAsync());
      // Вызываем callback для обновления данных в родительском компоненте
      onChanged?.();
    } catch (e) {
      console.error("Ошибка при одобрении корзины:", e);
      setAlertModal({
        open: true,
        type: "error",
        title: "Ошибка",
        message: `Ошибка при одобрении корзины: ${e?.message || "неизвестная ошибка"
          }`,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id) => {
    setActionLoadingId(id);
    try {
      await dispatch(rejectAgentCartAsync({ id })).unwrap();
      setAlertModal({
        open: true,
        type: "success",
        title: "Успешно",
        message: "Корзина отклонена",
      });
      await load();
    } catch (e) {
      setAlertModal({
        open: true,
        type: "error",
        title: "Ошибка",
        message: "Ошибка при отклонении корзины",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const { employees } = useDepartments();
  const [selectedAgent, setSelectedAgent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const filteredRows = useMemo(() => (rows || []).filter((cart) => {
    // agent filter by id if available
    const agId = cart?.agent?.id || cart?.agent_id || "";
    if (selectedAgent && String(agId) !== String(selectedAgent)) return false;
    const agentName =
      cart?.agent_name ||
      [cart?.agent?.first_name, cart?.agent?.last_name]
        .filter(Boolean)
        .join(" ");
    const clientName = cart?.client_name || cart?.client?.full_name || "";
    const q = String(debouncedSearchQuery || "")
      .toLowerCase()
      .trim();
    if (!q) return true;
    return (
      String(agentName || "")
        .toLowerCase()
        .includes(q) ||
      String(clientName || "")
        .toLowerCase()
        .includes(q)
    );
  }), [selectedAgent, debouncedSearchQuery]);

  return (
    <div className="add-modal accept">
      <div className="add-modal__overlay" onClick={onClose} />
      <div
        className="add-modal__content"
        role="dialog"
        aria-modal="true"
        style={{ height: "500px", overflow: "auto" }}
      >
        <div className="add-modal__header">
          <h3>Корзины на подтверждение</h3>
          <X className="add-modal__close-icon" size={20} onClick={onClose} />
        </div>

        <div
          className="add-modal__section"
          style={{ display: "flex", gap: "10px", marginBottom: "15px" }}
        >
          <select
            className="add-modal__input"
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            style={{ width: "240px" }}
          >
            <option value="">Все агенты</option>
            {(employees || []).map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.first_name} {employee.last_name}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Поиск по агенту или клиенту"
            className="add-modal__input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>

        {loading ? (
          <div className="add-modal__section">Загрузка…</div>
        ) : filteredRows.length === 0 ? (
          <div className="add-modal__section">
            Нет корзин в статусе submitted.
          </div>
        ) : (
          <div
            className="table-wrapper"
            style={{ maxHeight: 420, overflow: "auto" }}
          >
            <table className="sklad__table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Агент</th>
                  <th>Клиент</th>
                  <th>Комментарий</th>
                  <th>Отправлено</th>
                  <th>Позиций</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((cart, idx) => (
                  <tr key={cart.id}>
                    <td data-label="№">{idx + 1}</td>
                    <td data-label="Агент">
                      {cart?.agent_name ||
                        `${cart?.agent?.first_name || ""} ${cart?.agent?.last_name || ""
                        }`}
                    </td>
                    <td data-label="Клиент">
                      {cart?.client_name || cart?.client?.full_name || "—"}
                    </td>
                    <td data-label="Комментарий">{cart?.note || "—"}</td>
                    <td data-label="Отправлено">
                      {cart?.submitted_at
                        ? new Date(cart.submitted_at).toLocaleString("ru-RU")
                        : "—"}
                    </td>
                    <td data-label="Позиций">
                      {Array.isArray(cart?.items) ? cart.items.length : 0}
                    </td>
                    <td data-label="">
                      <button
                        className="add-modal__save"
                        style={{ marginRight: 8 }}
                        onClick={() => handleApprove(cart.id)}
                        disabled={actionLoadingId === cart.id}
                        title="Одобрить корзину"
                      >
                        {actionLoadingId === cart.id ? "…" : "Одобрить"}
                      </button>
                      <button
                        className="add-modal__cancel"
                        onClick={() => handleReject(cart.id)}
                        disabled={actionLoadingId === cart.id}
                        title="Отклонить корзину"
                      >
                        Отклонить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="add-modal__footer" style={{ marginTop: "15px" }}>
          <button className="add-modal__cancel" onClick={onClose}>
            Закрыть
          </button>
          <button className="add-modal__save" onClick={load}>
            Обновить список
          </button>
        </div>
      </div>
      <AlertModal
        open={alertModal.open}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        onClose={() => setAlertModal({ ...alertModal, open: false })}
      />
    </div>
  );
};
