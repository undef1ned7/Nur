// src/.../Orders.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaSearch,
} from "react-icons/fa";
import api from "../../../../api";
import "./Orders.scss";

import {
  attachUsbListenersOnce,
} from "./OrdersPrintService";

import SearchableCombobox from "../../../common/SearchableCombobox/SearchableCombobox";
import { SimpleStamp } from "../../../UI/SimpleStamp";
import { useDebouncedValue } from "../../../../hooks/useDebounce";
import { useCafeWebSocketManager } from "../../../../hooks/useCafeWebSocket";
import Pagination from "../../Market/Warehouse/components/Pagination";
import { useOutletContext } from "react-router-dom";
import DataContainer from "../../../common/DataContainer/DataContainer";

/* ==== helpers ==== */
const listFrom = (res) => res?.data?.results || res?.data || [];

const toNum = (x) => {
  if (x === null || x === undefined) return 0;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const fmtShort = (n) => String(Math.round(toNum(n)));


const safeUserData = () => {
  try {
    const raw = localStorage.getItem("userData");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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

  const userData = useMemo(() => safeUserData(), []);
  const userRole = userData?.role || "";
  const userId = localStorage.getItem("userId");


  const [expandedOrders, setExpandedOrders] = useState(() => new Set());
  const CARD_ITEMS_LIMIT = 4;


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
      console.error("Print init error:", e);
    }

    (async () => {
      try {
        await Promise.all([fetchTables(), fetchEmployees(), fetchMenu()]);
      } catch (e) {
        console.error("Ошибка загрузки:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchOrders]);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const params = {
          search: debouncedOrderSearchQuery,
          status__in: ['closed', 'cancelled'].toString(),
          waiter: waiterFilter,
          page: ordersPagination.currentPage
        };
        if (statusFilter) {
          params['status'] = statusFilter;
          delete params['status__in'];
        }
        await fetchOrders(params);
      } catch (e) {
        console.error("Ошибка загрузки:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [debouncedOrderSearchQuery, statusFilter, waiterFilter, socketOrders?.orders, ordersPagination?.currentPage])
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
    if (userRole === "официант") {
      return orders.filter((item) => String(item.waiter) === String(userId));
    }
    return orders;
  }, [orders, userRole, userId]);

  const visibleOrders = useMemo(() => {
    return roleFiltered;
  }, [roleFiltered]);

  const linePrice = (it) => {
    if (it?.menu_item_price != null) return toNum(it.menu_item_price);
    if (it?.price != null) return toNum(it.price);
    const key = String(it?.menu_item ?? "");
    if (menuMap.has(key)) return toNum(menuMap.get(key).price);
    return 0;
  };

  const calcTotals = (o) => {
    const items = Array.isArray(o.items) ? o.items : [];
    const total = items.reduce((s, it) => s + linePrice(it) * (Number(it.quantity) || 0), 0);
    const count = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    return { count, total };
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
          <div className="cafeOrders__filter">
            <SearchableCombobox
              value={waiterFilter}
              onChange={setWaiterFilter}
              options={waiterOptions}
              placeholder="Сотрудники"
              classNamePrefix="cafeOrders__combo"
            />
          </div>
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

              const items = Array.isArray(o.items) ? o.items : [];
              const expanded = expandedOrders.has(String(o.id));
              const sliceItems = expanded ? items : items.slice(0, CARD_ITEMS_LIMIT);
              const rest = Math.max(0, items.length - Math.min(items.length, CARD_ITEMS_LIMIT));
              return (
                <article key={o.id} className="cafeOrders__receipt relative">
                  <SimpleStamp date={o.status === 'closed' ? o.paid_at : ''} className="bottom-10 left-20" type={o.status} size={'md'} />
                  <div className="cafeOrders__receiptHeader">
                    <div className="cafeOrders__receiptTable">СТОЛ {t?.number || "—"}</div>
                    {orderDate && <div className="cafeOrders__receiptDate">{orderDate}</div>}
                  </div>

                  <div className="cafeOrders__receiptDivider" />

                  <div className="cafeOrders__receiptItems">
                    {sliceItems.map((it, i) => {
                      const itemPrice = linePrice(it);
                      const itemTitle = it.menu_item_title || it.title || "Позиция";
                      const itemQty = Number(it.quantity) || 0;
                      const sum = itemPrice * itemQty;
                      return (
                        <div key={it.id || it.menu_item || i} className="cafeOrders__receiptItem">
                          <span className="cafeOrders__receiptItemName">{itemTitle}</span>
                          <span className="cafeOrders__receiptItemQty">x{itemQty}</span>
                          <span className="cafeOrders__receiptItemPrice">{fmtShort(sum)}</span>
                        </div>
                      );
                    })}
                    {!expanded && rest > 0 && (
                      <button type="button" className="cafeOrders__moreItemsBtn" onClick={() => toggleExpandedOrder(o.id)}>
                        Ещё {rest} поз.
                      </button>
                    )}
                    {expanded && items.length > CARD_ITEMS_LIMIT && (
                      <button type="button" className="cafeOrders__moreItemsBtn" onClick={() => toggleExpandedOrder(o.id)}>
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
    </section>
  );
};

export default CafeOrderHistory;