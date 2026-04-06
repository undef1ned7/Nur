// src/.../Orders.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "../../../../store/slices/userSlice";
import { isStartPlan } from "../../../../utils/subscriptionPlan";
import {
  FaSearch,
  FaTimes,
  FaClipboardList,
  FaEdit,
} from "react-icons/fa";
import api from "../../../../api";
import "./Orders.scss";

import {
  attachUsbListenersOnce,
  checkPrinterConnection,
  parsePrinterBinding,
  printOrderReceiptJSONViaUSB,
  printViaWiFiSimple,
  setActivePrinterByKey,
} from "./OrdersPrintService";

import SearchableCombobox from "../../../common/SearchableCombobox/SearchableCombobox";
import { SimpleStamp } from "../../../UI/SimpleStamp";
import { useDebouncedValue } from "../../../../hooks/useDebounce";
import { useCafeWebSocketManager } from "../../../../hooks/useCafeWebSocket";
import Pagination from "../../Market/Warehouse/components/Pagination";
import { useOutletContext } from "react-router-dom";
import DataContainer from "../../../common/DataContainer/DataContainer";
import { useAlert } from "../../../../hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";

/* ==== helpers ==== */
const listFrom = (res) => res?.data?.results || res?.data || [];

const toNum = (x) => {
  if (x === null || x === undefined) return 0;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const fmtShort = (n) => String(Math.round(toNum(n)));

const orderItemTitle = (it) => {
  const lk = String(it?.line_kind || "menu").toLowerCase();
  if (lk === "service") {
    const t = String(it.service_title || it.title || "").trim();
    return t || "Услуга";
  }
  return String(it.menu_item_title || it.title || "Позиция");
};

/** Сколько единиц по строке уже возвращено (частичный refund API). */
const itemRefundedQty = (it) => {
  const qty = Math.max(0, Math.floor(Number(it.quantity) || 0));
  const r = Math.max(0, Math.floor(Number(it.refunded_quantity) || 0));
  return Math.min(r, qty);
};

/** Остаток к оплате по строке (без учёта полностью отклонённых позиций). */
const itemNetQty = (it) => {
  if (it.is_rejected) return 0;
  const qty = Math.max(0, Math.floor(Number(it.quantity) || 0));
  return Math.max(0, qty - itemRefundedQty(it));
};

const returnQtyInputValue = (q) => (q === "" ? "" : String(q));

/** Разрешить стереть поле и набрать новое число; ограничение — доступный возврат. */
const parseReturnQtyDigits = (raw, maxRefund) => {
  const s = String(raw ?? "").replace(/\D/g, "");
  if (s === "") return "";
  let n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n === 0) return "";
  const max = Math.max(1, Math.floor(Number(maxRefund) || 1));
  if (n > max) n = max;
  return n;
};

const returnQtyNum = (q) => {
  if (q === "" || q === null || q === undefined) return 0;
  const n = Math.floor(Number(q));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const fullName = (u) =>
  [u?.last_name || "", u?.first_name || ""].filter(Boolean).join(" ").trim() ||
  u?.email ||
  "Без имени";


const safeUserData = () => {
  try {
    const raw = localStorage.getItem("userData");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** Как в Masters / CafeEmployEmployeeDetail: роль с бэка может быть en или ru. */
const normalizeCafeMgmtRole = (raw) => {
  const l = String(raw || "").trim().toLowerCase();
  if (["owner", "владелец"].includes(l)) return "owner";
  if (["admin", "administrator", "админ", "администратор"].includes(l)) return "admin";
  return l;
};

const newIdempotencyKey = () => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

const statusFilterOptions =
  [
    { value: "", label: "Все статусы" },
    { value: "closed", label: "Закрыт" },
    { value: "cancelled", label: "Отменен" },
  ]

/* =========================================================
   Orders
   ========================================================= */
const CafeOrderHistory = () => {
  const alert = useAlert();
  const { company, tariff, profile } = useUser();
  const startPlan = useMemo(
    () => isStartPlan(tariff || company?.subscription_plan?.name),
    [tariff, company?.subscription_plan?.name],
  );
  const [tables, setTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const menuCacheRef = useRef(new Map());
  const [loading, setLoading] = useState(true);
  const { socketOrders } = useOutletContext()
  const [waiterOptions, setWaiterOptions] = useState([
    { value: null, label: 'Все сотрудники' }
  ])


  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState("");
  const debouncedOrderSearchQuery = useDebouncedValue(query, 400);
  const [statusFilter, setStatusFilter] = useState("");
  const [waiterFilter, setWaiterFilter] = useState(null);
  const [ordersPagination, setOrderPagination] = useState({
    totalPages: 0,
    currentPage: 1,
    limit: 100,
    totalCount: 0
  })

  const userData = profile || safeUserData();
  const userRole = String(userData?.role || "");
  const userId = localStorage.getItem("userId");

  const canManageReturns = useMemo(() => {
    const m = normalizeCafeMgmtRole(profile?.role || userRole);
    return m === "owner" || m === "admin";
  }, [profile?.role, userRole]);

  const [expandedOrders, setExpandedOrders] = useState(() => new Set());
  const CARD_ITEMS_LIMIT = 4;

  const [viewOpen, setViewOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState(null);
  const [viewOrderLoading, setViewOrderLoading] = useState(false);
  const [printingId, setPrintingId] = useState(null);

  const [itemsEditOpen, setItemsEditOpen] = useState(false);
  const [itemsEditOrder, setItemsEditOrder] = useState(null);
  const [itemsEditRows, setItemsEditRows] = useState([]);
  const [itemsEditSaving, setItemsEditSaving] = useState(false);
  const [itemsRefundPaymentMethod, setItemsRefundPaymentMethod] = useState("cash");

  const openView = useCallback(async (order) => {
    if (!order) {
      setViewOrder(null);
      setViewOpen(true);
      return;
    }
    setViewOrder(order);
    setViewOpen(true);
    const noItems = !Array.isArray(order.items) || order.items.length === 0;
    if (order.id && noItems) {
      setViewOrderLoading(true);
      try {
        const r = await api.get(`/cafe/orders/${order.id}/`);
        setViewOrder((prev) => {
          if (!prev || String(prev.id) !== String(order.id)) return r.data;
          return { ...prev, ...r.data };
        });
      } catch {
        /* оставляем заказ с карточки */
      } finally {
        setViewOrderLoading(false);
      }
    }
  }, []);

  const closeView = useCallback(() => {
    setItemsEditOpen(false);
    setItemsEditOrder(null);
    setItemsEditRows([]);
    setItemsRefundPaymentMethod("cash");
    setViewOpen(false);
    setViewOrder(null);
  }, []);

  /* ===== API ===== */
  const fetchTables = async () => setTables(listFrom(await api.get("/cafe/tables/")));

  const fetchEmployees = async () => {
    const arr = listFrom(await api.get("/users/employees/")) || [];
    setWaiterOptions(prevOptions => {
      const staticOption = prevOptions[0] || ({ value: null, label: 'Все официанты' });
      const options = arr.map(el => ({ value: el.id, label: el.first_name + ' ' + el.last_name }))
      options.unshift(staticOption)
      return options
    })
  };



  const fetchMenu = async () => {
    const arr = listFrom(await api.get("/cafe/menu-items/")) || [];
    setMenuItems(arr);

    for (const m of arr) {
      menuCacheRef.current.set(String(m.id), {
        ...m,
        kitchen: m.kitchen ?? null,
      });
    }
  };



  const hydrateOrdersDetails = async (list) => {
    const ids = list
      .filter((o) => !Array.isArray(o.items) || o.items.length === 0)
      .map((o) => o.id);

    if (!ids.length) return list;

    const details = await Promise.all(
      ids.map((id) =>
        api
          .get(`/cafe/orders/${id}/`)
          .then((r) => ({ id, data: r.data }))
          .catch(() => null)
      )
    );

    return list.map((o) => {
      const d = details.find((x) => x && x.id === o.id)?.data;
      return d ? { ...o, ...d } : o;
    });
  };

  const fetchOrders = useCallback(async (params = {}) => {
    const response = await api.get("/cafe/orders/", {
      params
    })
    const base = listFrom(response) || [];
    const full = await hydrateOrdersDetails(base);
    const { data } = response;
    setOrderPagination(prev => ({
      ...prev,
      totalPages: Math.ceil(data.count / prev.limit),
      totalCount: data.count
    }))
    setOrders(full);
  }, []);

  useEffect(() => {
    try {
      attachUsbListenersOnce();
    } catch (e) {
      const errorMessage = validateResErrors(e, "Ошибка загрузки");
      alert(errorMessage, true);
    }

    (async () => {
      try {
        await Promise.all([fetchTables(), fetchEmployees(), fetchMenu()]);
        } catch (e) {
          const errorMessage = validateResErrors(e, "Ошибка загрузки");
          alert(errorMessage, true);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchOrders]);

  useEffect(() => {
    if (startPlan) setWaiterFilter(null);
  }, [startPlan]);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const params = {
          search: debouncedOrderSearchQuery,
          status__in: ['closed', 'cancelled'].toString(),
          page: ordersPagination.currentPage
        };
        if (!startPlan) {
          params.waiter = waiterFilter;
        }
        if (statusFilter) {
          params['status'] = statusFilter;
          delete params['status__in'];
        }
        await fetchOrders(params);
      } catch (e) {
        const errorMessage = validateResErrors(e, "Ошибка загрузки истории заказов");
        alert(errorMessage, true);
      } finally {
        setLoading(false);
      }
    })();
  }, [debouncedOrderSearchQuery, statusFilter, waiterFilter, socketOrders?.orders, ordersPagination?.currentPage, startPlan])
  useEffect(() => {
    const handler = () => fetchOrders();
    window.addEventListener("orders:refresh", handler);
    return () => window.removeEventListener("orders:refresh", handler);
  }, [fetchOrders]);

  const tablesMap = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);

  const menuMap = useMemo(() => {
    const m = new Map();
    menuItems.forEach((mi) =>
      m.set(String(mi.id), {
        title: mi.title,
        price: toNum(mi.price),
        image_url: mi.image_url || "",
        kitchen: mi.kitchen ?? null,
      })
    );
    return m;
  }, [menuItems]);

  const roleFiltered = useMemo(() => {
    if (userRole === "официант" && !startPlan) {
      return orders.filter((item) => String(item.waiter) === String(userId));
    }
    return orders;
  }, [orders, userRole, userId, startPlan]);

  const visibleOrders = useMemo(() => {
    return roleFiltered;
  }, [roleFiltered]);

  const linePrice = (it) => {
    const lk = String(it?.line_kind || "menu").toLowerCase();
    if (lk === "service") return toNum(it.unit_price ?? it.price);
    if (it?.menu_item_price != null) return toNum(it.menu_item_price);
    if (it?.price != null) return toNum(it.price);
    const key = String(it?.menu_item ?? "");
    if (menuMap.has(key)) return toNum(menuMap.get(key).price);
    return 0;
  };

  const calcTotals = (o) => {
    const items = Array.isArray(o.items) ? o.items : [];
    let total = 0;
    let rejectedSum = 0;
    const count = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    for (const it of items) {
      const price = linePrice(it);
      const qty = Number(it.quantity) || 0;
      if (it.is_rejected) {
        rejectedSum += price * qty;
      } else {
        total += price * itemNetQty(it);
        rejectedSum += price * itemRefundedQty(it);
      }
    }
    return { count, total, rejectedSum };
  };

  const orderItemRowKey = (it, idx) =>
    it.id != null && it.id !== ""
      ? `id:${it.id}`
      : `${it.line_kind || "menu"}-${it.menu_item || it.service_title || ""}-${idx}`;

  const openItemsEdit = () => {
    if (!viewOrder?.id || !canManageReturns) return;
    const items = Array.isArray(viewOrder.items) ? viewOrder.items : [];
    setItemsEditOrder(viewOrder);
    setItemsRefundPaymentMethod("cash");
    setItemsEditRows(
      items.map((it, i) => ({
        _key: orderItemRowKey(it, i),
        id: it.id,
        line_kind: String(it.line_kind || "menu").toLowerCase(),
        menu_item: it.menu_item,
        service_title: String(it.service_title || it.title || "").trim(),
        title: orderItemTitle(it),
        price: linePrice(it),
        quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
        is_rejected: Boolean(it.is_rejected),
        refunded_quantity: Math.max(0, Math.floor(Number(it.refunded_quantity) || 0)),
        refundable_quantity: Math.max(
          0,
          Math.floor(
            Number(
              it.refundable_quantity ??
              ((Number(it.quantity) || 0) - (Number(it.refunded_quantity) || 0))
            ) || 0
          )
        ),
        return_quantity: Math.max(
          0,
          Math.floor(
            Number(
              it.refundable_quantity ??
              ((Number(it.quantity) || 0) - (Number(it.refunded_quantity) || 0))
            ) || 0
          )
        ),
        rejection_reason: String(it.rejection_reason || "").trim(),
      }))
    );
    setItemsEditOpen(true);
  };

  const saveItemsEdit = async () => {
    if (!itemsEditOrder?.id) return;
    const missingId = itemsEditRows.some((r) => !r.id);
    if (missingId) {
      alert(
        "У части позиций нет идентификатора — сохранение невозможно. Обновите страницу.",
        true
      );
      return;
    }
    const badReason = itemsEditRows.some(
      (r) => r.is_rejected && !String(r.rejection_reason || "").trim()
    );
    if (badReason) {
      alert("Укажите причину возврата для каждой отмеченной позиции.", true);
      return;
    }
    const badReturnQty = itemsEditRows.some((r) => {
      if (!r.is_rejected) return false;
      const returnQty = returnQtyNum(r.return_quantity);
      const refundableQty = Math.max(0, Math.floor(Number(r.refundable_quantity) || 0));
      return returnQty <= 0 || returnQty > refundableQty;
    });
    if (badReturnQty) {
      alert("Проверьте количество возврата: оно должно быть > 0 и не больше доступного.", true);
      return;
    }

    const paymentMethod = String(itemsRefundPaymentMethod || "").toLowerCase();
    if (!["cash", "card", "transfer"].includes(paymentMethod)) {
      alert("Выберите способ возврата.", true);
      return;
    }
    const selectedRows = itemsEditRows.filter((r) => r.is_rejected);
    if (!selectedRows.length) {
      alert("Отметьте хотя бы одну позицию для возврата.", true);
      return;
    }

    setItemsEditSaving(true);
    try {
      for (const r of selectedRows) {
        const returnQty = returnQtyNum(r.return_quantity);
        const refundableQty = Math.max(0, Math.floor(Number(r.refundable_quantity) || 0));
        if (!(returnQty > 0) || returnQty > refundableQty) continue;
        await api.post(`/cafe/orders/${itemsEditOrder.id}/refund-item/`, {
          order_item_id: r.id,
          quantity: returnQty,
          payment_method: paymentMethod,
          idempotency_key: newIdempotencyKey(),
          note: String(r.rejection_reason || "").trim(),
        });
      }
      const detail = await api.get(`/cafe/orders/${itemsEditOrder.id}/`);
      const updated = detail?.data || {};
      const mergeOrder = (prevOrder) => {
        if (!prevOrder || String(prevOrder.id) !== String(updated.id)) return prevOrder;
        return {
          ...prevOrder,
          ...updated,
          items: Array.isArray(updated.items) ? updated.items : prevOrder.items,
        };
      };
      setOrders((prev) => prev.map((o) => mergeOrder(o) || o));
      setViewOrder((vo) => mergeOrder(vo));
      setItemsEditOpen(false);
      setItemsEditOrder(null);
      setItemsEditRows([]);
      alert("Возвраты по позициям проведены.");
      try {
        window.dispatchEvent(new Event("orders:refresh"));
      } catch {
        /* ignore */
      }
    } catch (e) {
      const msg = validateResErrors(e, "Не удалось сохранить позиции");
      alert(msg, true);
    } finally {
      setItemsEditSaving(false);
    }
  };

  const formatReceiptDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = String(d.getFullYear()).slice(-2);
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${day}.${month}.${year} ${hours}:${minutes}`;
    } catch {
      return dateStr;
    }
  };

  const buildPrintPayload = useCallback(
    (order) => {
      const t = tablesMap.get(order?.table);
      const tableLabel =
        order?.table === null || order?.table === undefined || order?.table === ""
          ? "С собой"
          : t?.number || "—";

      const dt = formatReceiptDate(order?.created_at || order?.date || order?.created);
      const cashier = fullName(userData || {});
      const items = Array.isArray(order?.items) ? order.items : [];
      const isTakeaway = tableLabel === "С собой";

      return {
        company: localStorage.getItem("company_name") || "КАССА",
        doc_no: isTakeaway ? "С собой" : `СТОЛ ${tableLabel}`,
        created_at: dt,
        cashier_name: cashier,
        discount: 0,
        tax: 0,
        paid_cash: 0,
        paid_card: 0,
        change: 0,
        items: items.map((it) => ({
          name: orderItemTitle(it),
          qty: it.is_rejected
            ? Math.max(1, Number(it.quantity) || 1)
            : Math.max(0, itemNetQty(it)),
          price: linePrice(it),
        })),
      };
    },
    [formatReceiptDate, linePrice, tablesMap, userData]
  );

  const printOrder = useCallback(
    async (order) => {
      if (!order?.id) return;
      if (printingId) return;
      setPrintingId(order.id);
      try {
        await checkPrinterConnection().catch(() => false);
        const payload = buildPrintPayload(order);

        const receiptBinding = localStorage.getItem("cafe_receipt_printer") || "";
        if (!receiptBinding) throw new Error("Не настроен принтер кассы (чековый аппарат)");
        const parsed = parsePrinterBinding(receiptBinding);
        if (parsed.kind === "ip") {
          await printViaWiFiSimple(payload, parsed.ip, parsed.port);
        } else if (parsed.kind === "usb") {
          await setActivePrinterByKey(parsed.usbKey);
          await printOrderReceiptJSONViaUSB(payload);
        } else {
          throw new Error("Некорректная настройка принтера кассы");
        }
        try {
          localStorage.setItem(`cafe_receipt_printed_${order.id}`, "true");
        } catch { }
      } catch (e) {
        const errorMessage = validateResErrors(e, "Ошибка печати чека");
        alert(errorMessage, true);
      } finally {
        setPrintingId(null);
      }
    },
    [buildPrintPayload, printingId]
  );

  const toggleExpandedOrder = (id) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(String(id))) next.delete(String(id));
      else next.add(String(id));
      return next;
    });
  };

  return (
    <section className="cafeOrders">
      <div className="cafeOrders__header items-center!">
        <h2 className="cafeOrders__title">История заказов</h2>
        <div className="cafeOrders__actions">
          <div className="cafeOrders__search">
            <FaSearch className="cafeOrders__searchIcon" />
            <input
              className="cafeOrders__searchInput w-full!"
              placeholder="Поиск: стол, официант, гости, статус…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="cafeOrders__filter">
            <SearchableCombobox
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusFilterOptions}
              placeholder="Статус"
              classNamePrefix="cafeOrders__combo"
            />
          </div>
          {!startPlan && (
            <div className="cafeOrders__filter">
              <SearchableCombobox
                value={waiterFilter}
                onChange={setWaiterFilter}
                options={waiterOptions}
                placeholder="Сотрудники"
                classNamePrefix="cafeOrders__combo"
              />
            </div>
          )}
        </div>
      </div>
      <DataContainer>
        <div className="cafeOrders__list">
          {loading && <div className="cafeOrders__alert">Загрузка…</div>}
          {!loading &&
            visibleOrders.map((o) => {
              const t = tablesMap.get(o.table);
              const totals = calcTotals(o);
              const orderDate = formatReceiptDate(o.created_at || o.date || o.created);
              const tableLabel =
                o.table === null || o.table === undefined || o.table === ""
                  ? "С собой"
                  : t?.number || "—";

              const items = Array.isArray(o.items) ? o.items : [];
              const expanded = expandedOrders.has(String(o.id));
              const sliceItems = expanded ? items : items.slice(0, CARD_ITEMS_LIMIT);
              const rest = Math.max(0, items.length - Math.min(items.length, CARD_ITEMS_LIMIT));
              return (
                <article
                  key={o.id}
                  className="cafeOrders__receipt relative cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() => openView(o)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") openView(o);
                  }}
                >
                  <SimpleStamp date={o.status === 'closed' ? o.paid_at : ''} className="bottom-10 left-20" type={o.status} size={'md'} />
                  <div className="cafeOrders__receiptHeader">
                    <div className="cafeOrders__receiptTable">
                      {tableLabel === "С собой" ? "С собой" : `СТОЛ ${tableLabel}`}
                    </div>
                    {orderDate && <div className="cafeOrders__receiptDate">{orderDate}</div>}
                  </div>

                  <div className="cafeOrders__receiptDivider" />

                  <div className="cafeOrders__receiptItems">
                    {sliceItems.map((it, i) => {
                      const itemPrice = linePrice(it);
                      const itemTitle = orderItemTitle(it);
                      const itemQty = Number(it.quantity) || 0;
                      const rej = Boolean(it.is_rejected);
                      const refunded = itemRefundedQty(it);
                      const refundable = Math.max(
                        0,
                        Math.floor(
                          Number(
                            it.refundable_quantity ??
                              itemQty - refunded
                          ) || 0
                        )
                      );
                      const sum = rej ? itemPrice * itemQty : itemPrice * itemNetQty(it);
                      const reason = String(it.rejection_reason || "").trim();
                      const refundTitle =
                        !rej && refunded > 0
                          ? `Возвращено: ${refunded}`
                          : undefined;
                      return (
                        <div
                          key={it.id || `${it.line_kind || "menu"}-${it.menu_item || it.service_title || i}`}
                          className={`cafeOrders__receiptItem${rej ? " cafeOrders__receiptItem--rejected" : ""}`}
                        >
                          <div className="cafeOrders__receiptItemNameCol">
                            <span
                              className="cafeOrders__receiptItemName"
                              title={
                                rej && reason
                                  ? `Возврат: ${reason}`
                                  : refundTitle || undefined
                              }
                            >
                              {rej ? "↩ " : ""}
                              {itemTitle}
                            </span>
                            {!rej && refunded > 0 ? (
                              <span className="cafeOrders__receiptItemMeta">
                                Возвращено: {refunded}
                                {refundable > 0 ? ` · к возврату: ${refundable}` : ""}
                              </span>
                            ) : null}
                          </div>
                          <span className="cafeOrders__receiptItemQty">×{itemQty}</span>
                          <span className="cafeOrders__receiptItemPrice">{fmtShort(sum)}</span>
                        </div>
                      );
                    })}
                    {!expanded && rest > 0 && (
                      <button
                        type="button"
                        className="cafeOrders__moreItemsBtn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpandedOrder(o.id);
                        }}
                      >
                        Ещё {rest} поз.
                      </button>
                    )}
                    {expanded && items.length > CARD_ITEMS_LIMIT && (
                      <button
                        type="button"
                        className="cafeOrders__moreItemsBtn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpandedOrder(o.id);
                        }}
                      >
                        Свернуть позиции ({items.length})
                      </button>
                    )}
                  </div>

                  <div className="cafeOrders__receiptFooter">
                    <div className="cafeOrders__receiptDivider cafeOrders__receiptDivider--dashed" />

                    <div className="cafeOrders__receiptTotal">
                      <span className="cafeOrders__receiptTotalLabel">ИТОГО</span>
                      <span className="cafeOrders__receiptTotalAmount">{fmtShort(totals.total)}</span>
                    </div>
                    {totals.rejectedSum > 0 ? (
                      <div className="cafeOrders__receiptRejectedNote">
                        Возвраты не входят в сумму: {fmtShort(totals.rejectedSum)}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}


          {!loading && !roleFiltered.length && (
            <div className="cafeOrders__alert cafeOrders__alert--muted">Ничего не найдено по «{query}».</div>
          )}

        </div>
      </DataContainer>

      <Pagination
        currentPage={ordersPagination.currentPage}
        totalPages={ordersPagination.totalPages}
        count={ordersPagination.totalCount}
        hasNextPage={ordersPagination.currentPage < ordersPagination.totalPages}
        hasPrevPage={ordersPagination.currentPage > 1}
        loading={loading}
        onPageChange={(page) => {
          setOrderPagination(prev => ({
            ...prev,
            currentPage: page
          }))
        }}
      />

      {/* View modal (like pay modal, but without pay button) */}
      {viewOpen && viewOrder && (
        <div className="cafeOrdersModal__overlay z-100!" onClick={closeView}>
          <div className="cafeOrdersModal__shell" onClick={(e) => e.stopPropagation()}>
            <div className="cafeOrdersModal__card">
              <div className="cafeOrdersModal__header">
                <h3 className="cafeOrdersModal__title">Чек</h3>
                <button
                  className="cafeOrdersModal__close"
                  onClick={closeView}
                  aria-label="Закрыть"
                  type="button"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="cafeOrdersPay">
                {(() => {
                  const t = tablesMap.get(viewOrder.table);
                  const tableLabel =
                    viewOrder.table === null || viewOrder.table === undefined || viewOrder.table === ""
                      ? "С собой"
                      : t?.number || "—";
                  const dt = formatReceiptDate(viewOrder?.created_at || viewOrder?.date || viewOrder?.created);
                  const items = Array.isArray(viewOrder?.items) ? viewOrder.items : [];
                  const totals = calcTotals(viewOrder);
                  const isTakeaway = tableLabel === "С собой";

                  return (
                    <>
                      <div className="cafeOrdersPay__top">
                        <div className="cafeOrdersPay__table">
                          {isTakeaway ? "С собой" : `СТОЛ ${tableLabel}`}
                        </div>
                        <div className="cafeOrdersPay__date">{dt || ""}</div>
                      </div>

                      <div className="cafeOrdersPay__divider" />

                      <div className="cafeOrdersPay__list">
                        {items.length ? (
                          items.map((it, idx) => {
                            const title = orderItemTitle(it);
                            const qty = Number(it.quantity) || 0;
                            const price = linePrice(it);
                            const rej = Boolean(it.is_rejected);
                            const refunded = itemRefundedQty(it);
                            const refundable = Math.max(
                              0,
                              Math.floor(
                                Number(
                                  it.refundable_quantity ??
                                    qty - refunded
                                ) || 0
                              )
                            );
                            const sum = rej ? price * qty : price * itemNetQty(it);
                            const reason = String(it.rejection_reason || "").trim();
                            const refundTitle =
                              !rej && refunded > 0
                                ? `Возвращено: ${refunded}${refundable > 0 ? ` · ещё к возврату: ${refundable}` : ""}`
                                : undefined;

                            return (
                              <div
                                key={it.id || `${it.line_kind || "menu"}-${it.menu_item || it.service_title || idx}`}
                                className={`cafeOrdersPay__row${rej ? " cafeOrdersPay__row--rejected" : ""}`}
                              >
                                <div className="cafeOrdersPay__nameCol">
                                  <span
                                    className="cafeOrdersPay__name"
                                    title={
                                      rej && reason
                                        ? `Возврат: ${reason}`
                                        : refundTitle || title
                                    }
                                  >
                                    {rej ? "↩ " : ""}
                                    {title}
                                  </span>
                                  {!rej && refunded > 0 ? (
                                    <span className="cafeOrdersPay__meta">
                                      Возвращено: {refunded}
                                    
                                    </span>
                                  ) : null}
                                </div>
                                <span className="cafeOrdersPay__qty">×{qty}</span>
                                <span className="cafeOrdersPay__sum">{fmtShort(sum)}</span>
                              </div>
                            );
                          })
                        ) : (
                          <div className="cafeOrdersPay__empty">Позиции заказа не найдены.</div>
                        )}
                      </div>

                      <div className="cafeOrdersPay__divider cafeOrdersPay__divider--dashed" />

                      <div className="cafeOrdersPay__total">
                        <span>ИТОГО</span>
                        <span>{fmtShort(totals.total)}</span>
                      </div>
                      {totals.rejectedSum > 0 ? (
                        <div className="cafeOrdersPay__rejectedLine">
                          <span>Возвраты (не в сумме)</span>
                          <span>{fmtShort(totals.rejectedSum)}</span>
                        </div>
                      ) : null}
                    </>
                  );
                })()}

                <div className="cafeOrdersPay__actions cafeOrdersPay__actions--historyView">
                  <button
                    type="button"
                    className="cafeOrders__btn cafeOrders__btn--secondary"
                    onClick={closeView}
                    disabled={printingId === viewOrder.id || itemsEditSaving}
                  >
                    Закрыть
                  </button>

                  {canManageReturns && viewOrder?.id ? (
                    <button
                      type="button"
                      className="cafeOrders__btn cafeOrders__btn--primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        openItemsEdit();
                      }}
                      disabled={
                        printingId === viewOrder.id ||
                        itemsEditSaving ||
                        viewOrderLoading ||
                        !Array.isArray(viewOrder.items) ||
                        viewOrder.items.length === 0
                      }
                      title={
                        viewOrderLoading
                          ? "Загружаем позиции заказа…"
                          : !viewOrder.items?.length
                            ? "Нет позиций в заказе"
                            : "Изменить количество, отметить возврат с причиной"
                      }
                    >
                      <FaEdit />{" "}
                      {viewOrderLoading
                        ? "Загрузка позиций…"
                        : "Позиции и возвраты"}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="cafeOrders__btn cafeOrders__btn--secondary"
                    onClick={() => printOrder(viewOrder)}
                    disabled={printingId === viewOrder.id}
                    title="Распечатать чек"
                  >
                    <FaClipboardList /> {printingId === viewOrder.id ? "Печать…" : "Чек"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {itemsEditOpen && itemsEditOrder ? (
        <div
          className="cafeOrdersModal__overlay cafeOrdersHistoryItemsEdit__overlay"
          style={{ zIndex: 120 }}
          onClick={() => {
            if (!itemsEditSaving) {
              setItemsEditOpen(false);
              setItemsEditOrder(null);
              setItemsEditRows([]);
            }
          }}
        >
          <div
            className="cafeOrdersModal__shell cafeOrdersHistoryItemsEdit__shell"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cafeOrdersModal__card cafeOrdersHistoryItemsEdit__card">
              <div className="cafeOrdersModal__header">
                <h3 className="cafeOrdersModal__title">Позиции и возвраты</h3>
                <button
                  type="button"
                  className="cafeOrdersModal__close"
                  onClick={() => {
                    if (!itemsEditSaving) {
                      setItemsEditOpen(false);
                      setItemsEditOrder(null);
                      setItemsEditRows([]);
                    }
                  }}
                  aria-label="Закрыть"
                  disabled={itemsEditSaving}
                >
                  <FaTimes />
                </button>
              </div>

              <div className="cafeOrdersHistoryItemsEdit__body">
                <p className="cafeOrdersHistoryItemsEdit__hint">
                  Для возврата отметьте позиции, укажите количество и причину.
                  Возврат проводится через новый endpoint по каждой строке заказа.
                </p>
                <div className="cafeOrdersPay__field">
                  <label className="cafeOrdersPay__label">Способ возврата</label>
                  <SearchableCombobox
                    value={itemsRefundPaymentMethod}
                    onChange={(v) => setItemsRefundPaymentMethod(v || "cash")}
                    options={[
                      { value: "cash", label: "Наличные" },
                      { value: "card", label: "Карта" },
                      { value: "transfer", label: "Перевод" },
                    ]}
                    placeholder="Способ…"
                    disabled={itemsEditSaving}
                    hideClear
                    classNamePrefix="cafeOrdersPayCombo"
                  />
                </div>

                <div className="cafeOrdersHistoryItemsEdit__list">
                  {itemsEditRows.map((row) => (
                    <div key={row._key} className="cafeOrdersHistoryItemsEdit__row">
                      <div className="cafeOrdersHistoryItemsEdit__rowHead">
                        <span
                          className="cafeOrdersHistoryItemsEdit__title"
                          title={row.title}
                        >
                          {row.title}
                        </span>
                        <div className="cafeOrdersHistoryItemsEdit__qtyBlock">
                          <span className="cafeOrdersHistoryItemsEdit__price">
                            {fmtShort(row.price)} сом
                          </span>
                          <span className="cafeOrdersHistoryItemsEdit__times" aria-hidden>
                            ×
                          </span>
                          <div className="cafeOrdersHistoryItemsEdit__qtyField">
                            <span className="cafeOrdersHistoryItemsEdit__qtyCaption">
                              Кол-во
                            </span>
                            <div className="cafeOrdersHistoryItemsEdit__qtyStatic">
                              {Math.max(1, Number(row.quantity) || 1)}
                            </div>
                          </div>
                        </div>
                      </div>
                      {!row.is_rejected ? (
                        <div className="cafeOrdersHistoryItemsEdit__refundStats">
                          {Number(row.refunded_quantity) > 0 ? (
                            <span>Уже возвращено: {row.refunded_quantity}</span>
                          ) : null}
                          <span>
                            {Number(row.refunded_quantity) > 0 ? " · " : ""}
                            К возврату:{" "}
                            {Math.max(0, Math.floor(Number(row.refundable_quantity) || 0))}
                          </span>
                        </div>
                      ) : null}
                      <label className="cafeOrdersHistoryItemsEdit__check">
                        <input
                          type="checkbox"
                          checked={row.is_rejected}
                          onChange={(e) => {
                            const on = e.target.checked;
                            const maxRefund = Math.max(0, Number(row.refundable_quantity) || 0);
                            setItemsEditRows((prev) =>
                              prev.map((x) =>
                                x._key === row._key
                                  ? {
                                      ...x,
                                      is_rejected: on,
                                      return_quantity: on
                                        ? (() => {
                                            const maxR = Math.max(1, maxRefund || 1);
                                            const n = returnQtyNum(x.return_quantity);
                                            if (x.return_quantity !== "" && n > 0 && n <= maxR) {
                                              return x.return_quantity;
                                            }
                                            return Math.min(maxR, Math.max(1, n || maxR));
                                          })()
                                        : x.return_quantity,
                                      rejection_reason: on ? x.rejection_reason : "",
                                    }
                                  : x
                              )
                            );
                          }}
                          disabled={itemsEditSaving || Math.max(0, Number(row.refundable_quantity) || 0) <= 0}
                        />
                        <span>
                          Возврат {Math.max(0, Number(row.refundable_quantity) || 0) <= 0 ? "(недоступен)" : ""}
                        </span>
                      </label>
                      {row.is_rejected ? (
                        <div className="cafeOrdersHistoryItemsEdit__reasonWrap">
                          <label className="cafeOrdersHistoryItemsEdit__reasonLabel">
                            Кол-во возврата
                          </label>
                          <label className="cafeOrdersHistoryItemsEdit__qtyField cafeOrdersHistoryItemsEdit__qtyField--return">
                            <span className="cafeOrdersHistoryItemsEdit__qtyCaption">
                              доступно {row.refundable_quantity}
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              className="cafeOrders__input cafeOrdersHistoryItemsEdit__qty"
                              value={returnQtyInputValue(row.return_quantity)}
                              onChange={(e) => {
                                const max = Math.max(1, Number(row.refundable_quantity) || 1);
                                const next = parseReturnQtyDigits(e.target.value, max);
                                setItemsEditRows((prev) =>
                                  prev.map((x) =>
                                    x._key === row._key
                                      ? { ...x, return_quantity: next }
                                      : x
                                  )
                                );
                              }}
                              disabled={itemsEditSaving}
                            />
                          </label>
                          <label className="cafeOrdersHistoryItemsEdit__reasonLabel">
                            Причина возврата
                          </label>
                          <textarea
                            className="cafeOrders__input cafeOrdersHistoryItemsEdit__reason"
                            rows={3}
                            placeholder="Укажите причину…"
                            value={row.rejection_reason}
                            onChange={(e) =>
                              setItemsEditRows((prev) =>
                                prev.map((x) =>
                                  x._key === row._key
                                    ? { ...x, rejection_reason: e.target.value }
                                    : x
                                )
                              )
                            }
                            disabled={itemsEditSaving}
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="cafeOrdersHistoryItemsEdit__footerActions">
                <button
                  type="button"
                  className="cafeOrders__btn cafeOrders__btn--secondary"
                  onClick={() => {
                    if (!itemsEditSaving) {
                      setItemsEditOpen(false);
                      setItemsEditOrder(null);
                      setItemsEditRows([]);
                    }
                  }}
                  disabled={itemsEditSaving}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="cafeOrders__btn cafeOrders__btn--primary"
                  onClick={saveItemsEdit}
                  disabled={itemsEditSaving}
                >
                  {itemsEditSaving ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default CafeOrderHistory;