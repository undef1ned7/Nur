// src/.../Orders.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaSearch,
  FaPlus,
  FaTimes,
  FaClipboardList,
  FaTrash,
  FaEdit,
  FaCheckCircle,
  FaMinus,
} from "react-icons/fa";
import api from "../../../../api";
import { getAll as getAllClients, createClient } from "../Clients/clientStore";
import "./Orders.scss";

import {
  attachUsbListenersOnce,
  checkPrinterConnection,
  fetchCafeWaiterLabelByEmployeeId,
  parsePrinterBinding,
  pickCafeOrderWaiterName,
  printOrderReceiptJSONViaUSB,
  setActivePrinterByKey,
  printViaWiFiSimple,
} from "./OrdersPrintService";

import { RightMenuPanel, SearchSelect } from "./components/OrdersParts";
import SearchableCombobox from "../../../common/SearchableCombobox/SearchableCombobox";
import { SimpleStamp } from "../../../UI/SimpleStamp";
import { useDebouncedValue } from "../../../../hooks/useDebounce";
import { useCafeWebSocketManager } from "../../../../hooks/useCafeWebSocket";
import { useUser } from "../../../../store/slices/userSlice";
import { isStartPlan as checkStartPlan } from "../../../../utils/subscriptionPlan";
import Pagination from "../../Market/Counterparties/components/Pagination";
import { useOutletContext } from "react-router-dom";
import DataContainer from "../../../common/DataContainer/DataContainer";
import { useAlert } from "../../../../hooks/useDialog";
import * as logger from "../../../../utils/logger";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import {
  MAX_QTY,
  normalizeOrderPayload,
  numStr,
  stripEmpty,
  toId,
} from "./cafeOrderItemPayload";

/* ==== helpers ==== */
const listFrom = (res) => res?.data?.results || res?.data || [];

const toNum = (x) => {
  if (x === null || x === undefined) return 0;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const fmtMoney = (n) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNum(n));

const fmtShort = (n) => String(Math.round(toNum(n)));

const isUnpaidStatus = (s) => {
  const v = (s || "").toString().trim().toLowerCase();
  return ![
    "paid",
    "оплачен",
    "оплачено",
    "оплачён",
    "canceled",
    "cancelled",
    "отменён",
    "отменен",
    "closed",
    "done",
    "completed",
  ].includes(v);
};

const fullName = (u) =>
  [u?.last_name || "", u?.first_name || ""].filter(Boolean).join(" ").trim() ||
  u?.email ||
  "Без имени";

const formatApiErrors = (e) => {
  if (!e) return "Неизвестная ошибка";
  if (typeof e === "string") return e;
  if (Array.isArray(e)) return e.join("; ");
  try {
    return Object.entries(e)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
      .join("\n");
  } catch {
    return JSON.stringify(e, null, 2);
  }
};

const hasNestedOrderRequiredError = (err) => {
  const items = err?.response?.data?.items;
  if (!Array.isArray(items)) return false;
  return items.some((row) => {
    const orderErr = row?.order;
    if (!orderErr) return false;
    if (Array.isArray(orderErr)) {
      return orderErr.some((msg) =>
        String(msg || "").toLowerCase().includes("обязательное поле"),
      );
    }
    return String(orderErr || "").toLowerCase().includes("обязательное поле");
  });
};

const newIdempotencyKey = () => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

const getOrderClientId = (order) => {
  const c = order?.client;
  if (c == null || c === "") {
    const raw = order?.client_id;
    return raw != null && raw !== "" ? String(raw).trim() : "";
  }
  if (typeof c === "object") return String(c.id ?? c.uuid ?? "").trim();
  return String(c).trim();
};

const PAY_CHECKOUT_METHODS = [
  { value: "cash", label: "Наличные", search: "наличные нал cash" },
  { value: "card", label: "Карта", search: "карта card" },
  { value: "transfer", label: "Перевод", search: "перевод transfer" },
  { value: "debt", label: "В долг", search: "долг debt" },
];

const normalizePaymentMethod = (v) => {
  const m = String(v || "").trim().toLowerCase();
  if (["наличные", "нал", "cash"].includes(m)) return "cash";
  if (["карта", "card"].includes(m)) return "card";
  if (["перевод", "transfer"].includes(m)) return "transfer";
  if (["долг", "в долг", "debt"].includes(m)) return "debt";
  if (["cash", "card", "transfer", "debt"].includes(m)) return m;
  return "";
};

const pickClientLabel = (c) =>
  String(c?.full_name || c?.name || c?.title || c?.company_name || "Без имени").trim() ||
  "Без имени";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TAKEAWAY_LABEL = "С собой";

const normalizeTableLabel = (raw) => {
  if (raw === null || raw === undefined) return "";
  const v = String(raw).trim();
  if (!v) return "";
  if (UUID_RE.test(v)) return "";
  return v;
};

/** Заголовок позиции в UI / печати (меню или услуга). */
const orderItemTitle = (it) => {
  const lk = String(it?.line_kind || "menu").toLowerCase();
  if (lk === "service") {
    const t = String(it.service_title || it.title || "").trim();
    return t || "Услуга";
  }
  return String(it.menu_item_title || it.title || "Позиция");
};

const normalizeEmployee = (e = {}) => ({
  id: e.id,
  email: e.email ?? "",
  first_name: e.first_name ?? "",
  last_name: e.last_name ?? "",
  role_display: e.role_display ?? "",
});

const safeUserData = () => {
  try {
    const raw = localStorage.getItem("userData");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const readKitchenPrinterMap = () => {
  try {
    const raw = localStorage.getItem("kitchen_printer_map");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const isAutoKitchenPrintEnabled = () => {
  try {
    return localStorage.getItem("cafe_auto_kitchen_print") === "true";
  } catch {
    return false;
  }
};

const KITCHEN_PRINT_LOCK_TTL_MS = 30 * 1000;

const kitchenPrintLockKey = (orderId) => `cafe_kitchen_print_lock_${orderId}`;

const RECEIPT_PRINT_LOCK_TTL_MS = 30 * 1000;

const receiptPrintLockKey = (orderId) => `cafe_receipt_print_lock_${orderId}`;

const readKitchenPrintLock = (orderId) => {
  try {
    const raw = localStorage.getItem(kitchenPrintLockKey(orderId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.ts) return null;
    if (Date.now() - Number(data.ts) > KITCHEN_PRINT_LOCK_TTL_MS) {
      localStorage.removeItem(kitchenPrintLockKey(orderId));
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

const acquireKitchenPrintLock = (orderId) => {
  try {
    if (readKitchenPrintLock(orderId)) return false;
    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = { token, ts: Date.now() };
    localStorage.setItem(kitchenPrintLockKey(orderId), JSON.stringify(payload));
    const confirmed = readKitchenPrintLock(orderId);
    return confirmed?.token === token;
  } catch {
    return true;
  }
};

const releaseKitchenPrintLock = (orderId) => {
  try {
    localStorage.removeItem(kitchenPrintLockKey(orderId));
  } catch { }
};

const readReceiptPrintLock = (orderId) => {
  try {
    const raw = localStorage.getItem(receiptPrintLockKey(orderId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.ts) return null;
    if (Date.now() - Number(data.ts) > RECEIPT_PRINT_LOCK_TTL_MS) {
      localStorage.removeItem(receiptPrintLockKey(orderId));
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

const acquireReceiptPrintLock = (orderId) => {
  try {
    if (readReceiptPrintLock(orderId)) return false;
    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = { token, ts: Date.now() };
    localStorage.setItem(receiptPrintLockKey(orderId), JSON.stringify(payload));
    const confirmed = readReceiptPrintLock(orderId);
    return confirmed?.token === token;
  } catch {
    return true;
  }
};

const releaseReceiptPrintLock = (orderId) => {
  try {
    localStorage.removeItem(receiptPrintLockKey(orderId));
  } catch { }
};

const statusFilterOptions =
  [
    { value: "", label: "Все статусы" },
    { value: "open", label: "Открыт" },
    { value: "closed", label: "Закрыт" },
    { value: "cancelled", label: "Отменен" },
  ]

/* =========================================================
   Orders
   ========================================================= */
const Orders = () => {
  const alert = useAlert();
  const { profile, company, tariff } = useUser();
  const startPlan = useMemo(
    () => checkStartPlan(tariff || company?.subscription_plan?.name),
    [tariff, company?.subscription_plan?.name],
  );
  const [tables, setTables] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const menuCacheRef = useRef(new Map());
  const [loading, setLoading] = useState(true);
  const [waiterFilter, setWaiterFilter] = useState(null);
  const [waiterOptionsFilter, setWaiterOptionsFilter] = useState([
    { value: null, label: 'Все сотрудники' }
  ])

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(null);
  const [ordersPagination, setOrderPagination] = useState({
    totalPages: 0,
    currentPage: 1,
    limit: 100,
    totalCount: 0
  })
  const { socketOrders } = useOutletContext()
  const [kitchens, setKitchens] = useState([]);

  const [cashboxes, setCashboxes] = useState([]);
  const [cashboxId, setCashboxId] = useState("");

  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState("");
  const debouncedOrderSearchQuery = useDebouncedValue(query, 400);

  // Состояние пагинации меню
  const [menuCurrentPage, setMenuCurrentPage] = useState(1);
  const [menuLoading, setMenuLoading] = useState(false);

  const { isStaff, userRole, userData, userId } = useMemo(() => {
    const userRole = profile?.role || "";
    const isStaff = !(profile?.role === 'owner' || profile?.role === 'admin');
    return {
      userData: profile,
      userRole,
      userId: profile.id,
      isStaff
    }
  }, [profile])
  const [printingId, setPrintingId] = useState(null);

  // Cash/receipt printer binding is configured in Settings (Настройки → Печать).

  const [expandedOrders, setExpandedOrders] = useState(() => new Set());
  const CARD_ITEMS_LIMIT = 4;

  const [openSelectId, setOpenSelectId] = useState(null);

  /* ===== API ===== */
  const fetchTables = async () => setTables(listFrom(await api.get("/cafe/tables/")));

  const fetchEmployees = async () => {
    const arr = listFrom(await api.get("/users/employees/")) || [];
    setWaiterOptionsFilter(prevOptions => {
      const staticOption = prevOptions[0] || ({ value: null, label: 'Все официанты' });
      const options = arr.filter(el => !(el.role === 'owner' || el.role === 'admin')).map(el => ({ value: el.id, label: el.first_name + ' ' + el.last_name }))
      options.unshift(staticOption)
      return options
    })
    setEmployees(arr.map(normalizeEmployee));
  };

  const fetchKitchens = async () => {
    try {
      const r = await api.get("/cafe/kitchens/");
      setKitchens(listFrom(r) || []);
    } catch (e) {
      const errorMessage = validateResErrors(err, "Ошибка при загрузке кухонь");
      alert(errorMessage, true);
      setKitchens([]);
    }
  };

  const fetchMenu = async (page = 1) => {
    setMenuLoading(true);
    const params = {
      category: selectedCategoryFilter
    }
    if (page > 1) {
      params['page'] = page
    }
    try {
      const res = await api.get("/cafe/menu-items/", {
        params
      });
      const data = res?.data || {};
      // Сохраняем полный объект пагинации или массив
      const itemsData = data?.results ? data : (Array.isArray(data) ? data : []);
      setMenuItems(data?.results ? data : itemsData);

      // Извлекаем массив для кэша
      const arr = Array.isArray(itemsData) ? itemsData : (data?.results || []);
      for (const m of arr) {
        menuCacheRef.current.set(String(m.id), {
          ...m,
          kitchen: m.kitchen ?? null,
        });
      }
    } catch (err) {
      const errorMessage = validateResErrors(err, "Ошибка при загрузке меню");
      alert(errorMessage, true);
    } finally {
      setMenuLoading(false);
    }
  };

  // Обработчик смены страницы меню
  const handleMenuPageChange = useCallback(async (newPage, searchQuery = "") => {
    if (newPage < 1) return;

    // Всегда загружаем данные с сервера (с поиском или без)
    setMenuLoading(true);
    try {
      const params = {
        page: newPage,
      };

      // Добавляем параметр поиска, если он есть
      if (searchQuery && searchQuery.trim().length > 0) {
        params.search = searchQuery.trim();
      }

      const res = await api.get("/cafe/menu-items/", { params });
      const data = res?.data || {};

      // Сохраняем полный объект пагинации (с count, next, previous, results)
      // или массив, если это не объект пагинации
      const itemsData = data?.results ? data : (Array.isArray(data) ? data : []);
      setMenuItems(itemsData);

      // Обновляем кэш
      const arr = Array.isArray(itemsData) ? itemsData : (data?.results || []);
      for (const m of arr) {
        menuCacheRef.current.set(String(m.id), {
          ...m,
          kitchen: m.kitchen ?? null,
        });
      }

      setMenuCurrentPage(newPage);
    } catch (err) {
      const errorMessage = validateResErrors(err, "Ошибка загрузке меню");
      alert(errorMessage, true);
    } finally {
      setMenuLoading(false);
    }
  }, []);

  const fetchCashboxes = async () => {
    try {
      const r = await api.get("/construction/cashboxes/");
      const arr = listFrom(r) || [];
      const list = Array.isArray(arr) ? arr : [];
      setCashboxes(list);

      const firstKey = String(list?.[0]?.id || list?.[0]?.uuid || "");
      setCashboxId(firstKey);
    } catch {
      setCashboxes([]);
      setCashboxId("");
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

  const fetchOrders = useCallback(async () => {
    const params = {
      search: debouncedOrderSearchQuery,
      status: 'open',
      waiter: waiterFilter
    }
    if (isStaff) {
      params['waiter'] = userId
    }
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
  }, [debouncedOrderSearchQuery, waiterFilter, socketOrders?.orders, isStaff, ordersPagination.currentPage]);
  useEffect(() => {
    fetchMenu(1)
  }, [selectedCategoryFilter])
  useEffect(() => {
    try {
      attachUsbListenersOnce();
    } catch (e) {
      console.error("Print init error:", e);
    }
    (async () => {
      try {
        await Promise.all([fetchEmployees(), fetchKitchens(), fetchCashboxes()]);
      } catch (e) {
        const errorMessage = validateResErrors(e, "Ошибка загрузки");
        alert(errorMessage, true);
      }
    })();
  }, []);
  useEffect(() => {
    (async () => {
      try {
        await fetchTables();
        setForm(prev => ({ ...prev, table: '' }))
      } catch (e) {
        const errorMessage = validateResErrors(e, "Ошибка загрузки");
        alert(errorMessage, true);
      }
    })();
  }, [socketOrders?.orders])

  // Синхронизация данных из сокетов с локальным состоянием
  useEffect(() => {
    if (!socketOrders?.orders || !Array.isArray(socketOrders.orders)) return;

    // Фильтруем только открытые заказы (как в fetchOrders)
    const socketOpenOrders = socketOrders.orders.filter(order => {
      const status = String(order.status || '').toLowerCase();
      return status === 'open' && !order.is_paid;
    });

    // Обновляем локальное состояние только если есть изменения
    setOrders((prev) => {
      const prevIds = new Set(prev.map((o) => String(o.id)));
      const socketIds = new Set(socketOpenOrders.map((o) => String(o.id)));

      if (
        prevIds.size === socketIds.size &&
        [...prevIds].every((id) => socketIds.has(id))
      ) {
        return prev;
      }

      const prevById = new Map(prev.map((o) => [String(o.id), o]));
      return socketOpenOrders.map((so) => {
        const p = prevById.get(String(so.id));
        if (!p) return so;
        const merged = { ...p, ...so };
        const pItems = Array.isArray(p.items) ? p.items : [];
        const sItems = Array.isArray(so.items) ? so.items : [];
        if (pItems.length > 0 && sItems.length === 0) {
          merged.items = pItems;
        }
        return merged;
      });
    });
  }, [socketOrders?.orders])

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        await fetchOrders();
      } catch (e) {
        const errorMessage = validateResErrors(e, "Ошибка загрузки");
        alert(errorMessage, true);
      } finally {
        setLoading(false);
      }
    })(); 
  }, [fetchOrders]) 

  useEffect(() => {
    const handler = () => fetchOrders();
    window.addEventListener("orders:refresh", handler);
    return () => window.removeEventListener("orders:refresh", handler);
  }, [fetchOrders]);

  const tablesMap = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
  const getOrderTableLabel = useCallback(
    (order) => {
      // Если стол не выбран — считаем заказ "С собой"
      if (order?.table === null || order?.table === undefined || order?.table === "") {
        return TAKEAWAY_LABEL;
      }
      const t = tablesMap.get(order?.table);
      const direct = normalizeTableLabel(
        t?.title ||
        t?.name ||
        t?.label ||
        t?.table_name ||
        t?.table_label ||
        t?.table_title ||
        ""
      );
      if (direct) return direct;
      if (t?.number != null && t?.number !== "") return String(t.number);
      const fallback = normalizeTableLabel(
        order?.table_name || order?.table_label || order?.table_title || order?.table_number
      );
      if (fallback) return fallback;
      const raw = normalizeTableLabel(order?.table);
      return raw || TAKEAWAY_LABEL;
    },
    [tablesMap]
  );

  const waiters = useMemo(
    () =>
      employees
        .filter(el => !(el?.role === 'owner' || el?.role === 'admin'))
        .map((u) => ({ id: u.id, name: fullName(u) })),
    [employees]
  );

  const waiterIdLabelMap = useMemo(() => {
    const m = new Map();
    for (const e of employees) {
      if (e?.id == null) continue;
      const label =
        [e.last_name, e.first_name].filter(Boolean).join(" ").trim() ||
        String(e.email || "").trim();
      if (label) m.set(String(e.id), label);
    }
    return m;
  }, [employees]);
  const kitchensMap = useMemo(() => {
    const m = new Map();
    (kitchens || []).forEach((k) => {
      const title = String(k?.title || k?.name || k?.kitchen_title || "Кухня").trim();
      const number = k?.number ?? k?.kitchen_number;
      const label = `${title}${number !== undefined && number !== null && number !== "" ? ` №${number}` : ""}`;
      m.set(String(k?.id), { ...k, label });
    });
    return m;
  }, [kitchens]);

  const menuMap = useMemo(() => {
    const m = new Map();
    // Извлекаем массив из объекта пагинации или используем как массив
    const itemsArray = menuItems?.results || (Array.isArray(menuItems) ? menuItems : []);
    itemsArray.forEach((mi) =>
      m.set(String(mi.id), {
        title: mi.title,
        price: toNum(mi.price),
        image_url: mi.image_url || "",
        kitchen: mi.kitchen ?? null,
      })
    );
    return m;
  }, [menuItems]);

  const menuImageUrl = (id) => {
    const key = String(id ?? "");
    return menuMap.get(key)?.image_url || (menuCacheRef.current.get(key)?.image_url ?? "");
  };

  const getMenuKitchenId = (menuId) => {
    const key = String(menuId ?? "");
    return menuMap.get(key)?.kitchen ?? menuCacheRef.current.get(key)?.kitchen ?? null;
  };

  const busyTableIds = useMemo(() => {
    const set = new Set();
    for (const o of orders) if (isUnpaidStatus(o.status)) set.add(o.table);
    return set;
  }, [orders]);

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
    const total = items.reduce((s, it) => s + linePrice(it) * (Number(it.quantity) || 0), 0);
    const count = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    return { count, total };
  };

  const formatReceiptDate = useCallback((dateStr) => {
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
  }, []);

  const toggleExpandedOrder = useCallback((id) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(String(id))) next.delete(String(id));
      else next.add(String(id));
      return next;
    });
  }, []);
  /* ===== печать (оплата/чек) ===== */
  const buildPrintPayload = useCallback(
    (order) => {
      const tableLabel = getOrderTableLabel(order);
      const dt = formatReceiptDate(order?.created_at || order?.date || order?.created);
      const cashier = fullName(userData || {});
      const items = Array.isArray(order?.items) ? order.items : [];

      const isTakeaway = tableLabel === TAKEAWAY_LABEL;
      return {
        company: localStorage.getItem("company_name") || "КАССА",
        doc_no: isTakeaway ? TAKEAWAY_LABEL : `СТОЛ ${tableLabel}`,
        created_at: dt,
        cashier_name: cashier,
        waiter_name: pickCafeOrderWaiterName(order, waiterIdLabelMap),
        discount: 0,
        tax: 0,
        paid_cash: 0,
        paid_card: 0,
        change: 0,
        items: items.map((it) => ({
          name: orderItemTitle(it),
          qty: Math.max(1, Number(it.quantity) || 1),
          price: linePrice(it),
          comment: String(it.comment || "").trim(),
        })),
      };
    },
    [getOrderTableLabel, userData, waiterIdLabelMap]
  );

  const printOrder = useCallback(
    async (order) => {
      // if (!order?.id) return;
      // if (printingId) return;
      // if (!acquireReceiptPrintLock(order.id)) return;
      // setPrintingId(order.id);
      // try {
      //   await checkPrinterConnection().catch(() => false);
      //   // Для чека берем актуальный detail заказа, чтобы не потерять comment в items.
      //   const detailedOrder = await api
      //     .get(`/cafe/orders/${order.id}/`)
      //     .then((r) => r?.data || null)
      //     .catch(() => null);
      //   const sourceOrder = detailedOrder ? { ...order, ...detailedOrder } : order;

      //   let payload = buildPrintPayload(sourceOrder);
      //   if (!String(payload.waiter_name || "").trim()) {
      //     const w = await fetchCafeWaiterLabelByEmployeeId(sourceOrder?.waiter);
      //     if (w) payload = { ...payload, waiter_name: w };
      //   }

      //   // Receipt printer (cashier)
      //   const receiptBinding = localStorage.getItem("cafe_receipt_printer") || "";
      //   if (!receiptBinding) throw new Error("Не настроен принтер кассы (чековый аппарат)");
      //   const parsed = parsePrinterBinding(receiptBinding);
      //   if (parsed.kind === "ip") {
      //     await printViaWiFiSimple(payload, parsed.ip, parsed.port);
      //   } else if (parsed.kind === "usb") {
      //     await setActivePrinterByKey(parsed.usbKey);
      //     await printOrderReceiptJSONViaUSB(payload);
      //   } else {
      //     throw new Error("Некорректная настройка принтера кассы");
      //   }
      //   try {
      //     localStorage.setItem(`cafe_receipt_printed_${order.id}`, "true");
      //   } catch { }
      // } catch (e) {
      //   const errorMessage = validateResErrors(e, "Ошибка при печати чека");
      //   alert(errorMessage, true);
      // } finally {
      //   setPrintingId(null);
      //   releaseReceiptPrintLock(order.id);
      // }
    },
    [buildPrintPayload, printingId]
  );

  /* ===== АВТОПЕЧАТЬ НА КУХНЮ ПОСЛЕ СОЗДАНИЯ ЗАКАЗА ===== */
  const buildKitchenTicketPayload = useCallback(
    ({ order, kitchenId, kitchenLabel, items }, label = 'КАССАА') => {
      const tableLabel = getOrderTableLabel(order);
      const dt = formatReceiptDate(order?.created_at || order?.date || order?.created);
      const cashier = fullName(userData || {});
      const isTakeaway = tableLabel === TAKEAWAY_LABEL;

      return {
        company: localStorage.getItem("company_name") || label,
        doc_no: isTakeaway
          ? `${kitchenLabel || "КУХНЯ"} • ${TAKEAWAY_LABEL}`
          : `${kitchenLabel || "КУХНЯ"} • СТОЛ ${tableLabel}`,
        created_at: dt,
        cashier_name: cashier,
        waiter_name: pickCafeOrderWaiterName(order, waiterIdLabelMap),
        discount: 0,
        tax: 0,
        paid_cash: 0,
        paid_card: 0,
        change: 0,
        kitchen_id: kitchenId,
        items: (items || []).map((it) => ({
          name: orderItemTitle(it),
          qty: Math.max(1, Number(it.quantity) || 1),
          comment: String(it.comment || "").trim(),
          // price: linePrice(it),
        })),
      };
    },
    [getOrderTableLabel, userData, waiterIdLabelMap]
  );

  const getKitchenPrinterKey = useCallback(
    (kitchenId) => {
      const kid = String(kitchenId || "");
      if (!kid) return "";

      const k = kitchensMap.get(kid);
      const direct = String(
        k?.printer_key ||
        k?.printerKey ||
        k?.printer ||
        k?.printer_id ||
        k?.printerId ||
        ""
      ).trim();
      if (direct) return direct;
      const ls = readKitchenPrinterMap();
      return String(ls?.[kid] || "").trim();
    },
    [kitchensMap]
  );

  const autoPrintKitchenTickets = useCallback(
    async (createdOrderId) => {
      if (!createdOrderId) return;
      if (!isAutoKitchenPrintEnabled()) return;
      try {
        if (localStorage.getItem(`cafe_kitchen_printed_${createdOrderId}`)) return;
      } catch { }
      if (!acquireKitchenPrintLock(createdOrderId)) return;

      try {
        const detail = await api.get(`/cafe/orders/${createdOrderId}/`).then((r) => r?.data || null);
        if (!detail) return;

        const items = Array.isArray(detail?.items) ? detail.items : [];
        if (!items.length) return;

        const groups = new Map();
        for (const it of items) {
          const menuId = it?.menu_item || it?.menu_item_id || it?.menuItem;
          if (!menuId) continue;
          const kitchenId = getMenuKitchenId(menuId);
          if (!kitchenId) continue;

          const key = String(kitchenId);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(it);
        }

        if (!groups.size) return;

        let kitchenWaiterName = pickCafeOrderWaiterName(detail, waiterIdLabelMap);
        if (!kitchenWaiterName) {
          kitchenWaiterName = await fetchCafeWaiterLabelByEmployeeId(
            detail?.waiter,
          );
        }

        for (const [kitchenId, kitItems] of groups.entries()) {
          const k = kitchensMap.get(String(kitchenId));
          const kitchenLabel = k?.label || k?.title || k?.name || "Кухня";

          const printerKey = getKitchenPrinterKey(kitchenId);

          // if (!printerKey) {
          //   console.error("Kitchen print skipped: no printer_key for kitchen", kitchenId);
          //   continue;
          // }

          const payload = {
            ...buildKitchenTicketPayload({
              order: detail,
              kitchenId,
              kitchenLabel,
              items: kitItems,
            }, 'КУХНЯ'),
            waiter_name: kitchenWaiterName,
          };

          const parsed = parsePrinterBinding(printerKey);
          if (parsed.kind === "ip") {
            await printViaWiFiSimple(payload, parsed.ip, parsed.port);
          } else if (parsed.kind === "usb") {
            await setActivePrinterByKey(parsed.usbKey);
            await printOrderReceiptJSONViaUSB(payload);
          } else {
            console.warn("Kitchen print skipped: invalid printer binding for kitchen", kitchenId, printerKey);
          }
        }
        try {
          localStorage.setItem(`cafe_kitchen_printed_${createdOrderId}`, "true");
        } catch { }
      } catch (e) {
        console.error("Auto kitchen print error:", e);
        // Ошибка отправки чека на кухню
      } finally {
        releaseKitchenPrintLock(createdOrderId);
      }
    },
    [
      buildKitchenTicketPayload,
      fetchCafeWaiterLabelByEmployeeId,
      getKitchenPrinterKey,
      getMenuKitchenId,
      kitchensMap,
      waiterIdLabelMap,
    ]
  );

  /* ===== модалка create/edit ===== */
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const isEditing = editingId != null;

  const [form, setForm] = useState({
    table: "",
    guests: 2,
    waiter: userId,
    client: "",
    items: [],
  });

  const [menuOpen, setMenuOpen] = useState(false);

  /* клиенты */
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsErr, setClientsErr] = useState("");
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [addClientSaving, setAddClientSaving] = useState(false);

  // Блокировка скролла фона при открытой модалке (мобильная версия: при скролле панели «Добавить блюда» не скроллится задний фон)
  useEffect(() => {
    if (!modalOpen) return;
    const scrollY = window.scrollY;
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevWidth = document.body.style.width;
    const prevTop = document.body.style.top;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.top = `-${scrollY}px`;
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.width = prevWidth;
      document.body.style.top = prevTop;
      window.scrollTo(0, scrollY);
    };
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    let mounted = true;

    (async () => {
      try {
        setClientsLoading(true);
        setClientsErr("");
        const data = await getAllClients();
        if (mounted) setClients(Array.isArray(data) ? data : []);
      } catch (e) {
        const errorMessage = validateResErrors(e, "Ошибка загрузки клиентов");
        alert(errorMessage, true);
        if (mounted) setClientsErr("Не удалось загрузить клиентов");
      } finally {
        if (mounted) setClientsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [modalOpen]);

  const handleCreateClient = async (e) => {
    e?.preventDefault?.();
    if (!newClientName.trim()) return;

    try {
      setAddClientSaving(true);
      const c = await createClient({
        full_name: newClientName.trim(),
        phone: newClientPhone.trim(),
        notes: "",
      });

      setClients((prev) => [c, ...prev]);
      setForm((f) => ({ ...f, client: String(c.id) }));

      setNewClientName("");
      setNewClientPhone("");
      setShowAddClient(false);
    } catch (e2) {
      // Ошибка создания клиента
    } finally {
      setAddClientSaving(false);
    }
  };

  const openCreate = () => {
    setForm({
      table: "",
      guests: 2,
      waiter: "",
      client: "",
      items: [],
    });
    setEditingId(null);
    setMenuOpen(false);
    setShowAddClient(false);
    setOpenSelectId(null);
    setModalOpen(true);
  };

  const openEdit = (order) => {
    setEditingId(order.id);

    const itemsNormalized = Array.isArray(order.items)
      ? order.items.map((it, idx) => {
          const lk = String(it.line_kind || "menu").toLowerCase();
          if (lk === "service") {
            return {
              _key: it.id ? `i:${it.id}` : `s:${idx}`,
              id: it.id,
              line_kind: "service",
              menu_item: "",
              service_title: it.service_title || it.title || "",
              price: toNum(it.unit_price ?? it.price),
              quantity: Number(it.quantity) || 1,
              comment: it.comment || "",
              is_rejected: !!it.is_rejected,
              rejection_reason: it.rejection_reason || "",
            };
          }
          const mid = String(it.menu_item || it.menu_item_id || "");
          return {
            _key: it.id ? `i:${it.id}` : `m:${mid}`,
            id: it.id,
            line_kind: "menu",
            menu_item: mid,
        title: it.menu_item_title || it.title,
        price: linePrice(it),
        quantity: Number(it.quantity) || 1,
            comment: it.comment || "",
            is_rejected: !!it.is_rejected,
            rejection_reason: it.rejection_reason || "",
          };
        })
      : [];

    setForm({
      table: String(order.table ?? ""),
      guests: Number(order.guests) || 0,
      waiter: startPlan ? "" : order.waiter ? String(order.waiter) : "",
      client: order.client ? String(order.client) : "",
      items: itemsNormalized,
    });

    setMenuOpen(false);
    setShowAddClient(false);
    setOpenSelectId(null);
    setModalOpen(true);
  };

  const addOrIncMenuItem = (menu) => {
    if (!menu?.id) return;
    const idStr = String(menu.id);
    const mkey = `m:${idStr}`;

    setForm((prev) => {
      const ex = prev.items.find(
        (i) => String(i.line_kind || "menu") !== "service" && String(i.menu_item) === idStr
      );
      if (ex) {
        return {
          ...prev,
          items: prev.items.map((i) =>
            i._key === ex._key
              ? {
                  ...i,
                  quantity:
                    (i.quantity === "" ? 0 : Number(i.quantity) || 0) + 1,
                }
              : i
          ),
        };
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            _key: mkey,
            line_kind: "menu",
            menu_item: idStr,
            title: menu.title,
            price: toNum(menu.price),
            quantity: 1,
            comment: "",
            is_rejected: false,
            rejection_reason: "",
          },
        ],
      };
    });
  };

  const lineQtyInputValue = (q) => (q === "" ? "" : String(q));

  const parseLineQtyDigits = (raw) => {
    const s = String(raw ?? "").replace(/\D/g, "");
    if (s === "") return "";
    let n = parseInt(s, 10);
    if (!Number.isFinite(n) || n < 0) return "";
    if (n > MAX_QTY) n = MAX_QTY;
    return n;
  };

  const lineQtyNum = (q) => {
    if (q === "" || q === null || q === undefined) return 0;
    const n = Math.floor(Number(q));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const changeItemQty = (lineKey, raw) => {
    const next = parseLineQtyDigits(raw);
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i._key === lineKey ? { ...i, quantity: next } : i)),
    }));
  };

  const changeItemComment = (lineKey, raw) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i._key === lineKey ? { ...i, comment: String(raw || "").slice(0, 500) } : i,
      ),
    }));
  };

  const incItem = (lineKey) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i._key === lineKey
          ? {
              ...i,
              quantity: (i.quantity === "" ? 0 : Number(i.quantity) || 0) + 1,
            }
          : i
      ),
    }));
  };

  const decItem = (lineKey) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items
        .map((i) =>
          i._key === lineKey
            ? {
                ...i,
                quantity: Math.max(
                  0,
                  (i.quantity === "" ? 0 : Number(i.quantity) || 0) - 1
                ),
              }
            : i
        )
        .filter((el) => Number(el.quantity) > 0),
    }));
  };

  const removeItem = (lineKey) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i._key !== lineKey),
    }));
  };

  const postWithWaiterFallback = async (url, payload, method = "post") => {
    try {
      if (method === "post") return await api.post(url, payload);
      if (method === "patch") return await api.patch(url, payload);
      if (method === "put") return await api.put(url, payload);
      throw new Error("Unsupported method");
    } catch (err) {
      const r = err?.response;
      const waiterErrors = r?.status === 400 && r?.data && r.data.waiter;
      if (waiterErrors) {
        const payloadNoWaiter = { ...payload };
        delete payloadNoWaiter.waiter;
        if (method === "post") return await api.post(url, payloadNoWaiter);
        if (method === "patch") return await api.patch(url, payloadNoWaiter);
        if (method === "put") return await api.put(url, payloadNoWaiter);
      }
      throw err;
    }
  };



  const saveForm = async (e) => {
    e.preventDefault();
    if (!form.items.length) return;

    const invalidQty = form.items.some((i) => lineQtyNum(i.quantity) < 1);
    if (invalidQty) {
      alert("Укажите количество не меньше 1 для каждой позиции.", true);
      return;
    }

    setSaving(true);
    try {
      if (!isEditing) {
        const basePayload = normalizeOrderPayload(form, true);
        if (startPlan) delete basePayload.waiter;
        else if (isStaff) basePayload.waiter = userId;
        let res;
        try {
          res = await postWithWaiterFallback("/cafe/orders/", basePayload, "post");
        } catch (createErr) {
          // Некоторые бэкенды требуют items[].order даже при создании заказа.
          // Тогда создаем "шапку" заказа и отдельным PATCH отправляем items с order=<id заказа>.
          if (!hasNestedOrderRequiredError(createErr)) throw createErr;

          const headerPayload = { ...basePayload, items: [] };
          const created = await postWithWaiterFallback(
            "/cafe/orders/",
            headerPayload,
            "post",
          );
          const createdOrderId = created?.data?.id;
          if (!createdOrderId) throw createErr;

          const patchPayload = normalizeOrderPayload(form, false, createdOrderId);
          if (startPlan) delete patchPayload.waiter;
          await postWithWaiterFallback(
            `/cafe/orders/${createdOrderId}/`,
            patchPayload,
            "patch",
          );
          res = created;
        }

        try {
          const tableId = toId(form.table);
          if (tableId) {
            await api.patch(`/cafe/tables/${tableId}/`, { status: "busy" });
          }
        } catch {
          // молча
        }

        setOrders((prev) => [...prev, res.data]);

        // Печать на кухню не должна держать saving: иначе кнопки «Редактировать» / «Оплатить»
        // у всех карточек остаются disabled, пока USB/Wi‑Fi не ответят.
        // void autoPrintKitchenTickets(res?.data?.id).catch(() => {});
      } else {
        const payload = normalizeOrderPayload(form, false, editingId);
        if (startPlan) delete payload.waiter;
        await postWithWaiterFallback(`/cafe/orders/${editingId}/`, payload, "patch");
      }

      setModalOpen(false);
      setMenuOpen(false);
      setShowAddClient(false);
      setOpenSelectId(null);

      await fetchOrders();
    } catch (err) {
      const errorMessage = validateResErrors(err, "Ошибка сохранения заказа");
      alert(errorMessage, true);
      // Ошибка сохранения заказа
    } finally {
      setSaving(false);
    }
  };



  const createCashflowIncome = async (order, amount) => {
    const firstKey = cashboxId || String(cashboxes?.[0]?.id || cashboxes?.[0]?.uuid || "");
    if (!firstKey) throw new Error("Нет кассы. Создайте кассу в разделе «Кассы».");
    if (!cashboxId) setCashboxId(firstKey);

    const t = tablesMap.get(order?.table);
    const tableLabel = getOrderTableLabel(order);
    const name =
      tableLabel === TAKEAWAY_LABEL ? `Оплата: ${TAKEAWAY_LABEL}` : `Оплата стол ${t?.number ?? tableLabel}`;

    const res = await api.post("/construction/cashflows/", {
      cashbox: firstKey,
      type: "income",
      name,
      amount: numStr(amount),
    });

    return res?.data || null;
  };

  const freeTable = async (tableId) => {
    if (!tableId) return;
    try {
      await api.patch(`/cafe/tables/${tableId}/`, { status: "free" });
    } catch (e) {
      const errorMessage = validateResErrors(e, "Не удалось освободить стол");
      alert(errorMessage, true);
    }
  };


  /* ===== ОПЛАТА: POST /cafe/orders/<id>/pay/ и /pay-debt/ ===== */
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payOrder, setPayOrder] = useState(null);
  const [payForm, setPayForm] = useState({
    paymentMethod: "cash",
    discountAmount: "0",
    payNow: "",
    usePrepaid: false,
    prepaidAmount: "",
    prepaidPaymentMethod: "cash",
    clientId: "",
    debtAmount: "",
    debtPaymentMethod: "cash",
    debtCashReceived: "",
    debtNote: "",
  });

  const checkoutDue = useCallback((order, discountStr) => {
    const itemsTotal = calcTotals(order).total;
    const disc = toNum(discountStr);
    const after = Math.max(0, itemsTotal - disc);
    const paid = toNum(order?.paid_amount);
    return Math.max(0, after - paid);
  }, []);

  const openPay = (order) => {
    setPayOrder(order);
    const due = checkoutDue(order, "0");
    const bal = toNum(order?.balance_due);
    setPayForm({
      paymentMethod: "cash",
      discountAmount: "0",
      payNow: numStr(due),
      usePrepaid: false,
      prepaidAmount: "",
      prepaidPaymentMethod: "cash",
      clientId: getOrderClientId(order),
      debtAmount: bal > 0 ? numStr(bal) : "",
      debtPaymentMethod: "cash",
      debtCashReceived: bal > 0 ? numStr(bal) : "",
      debtNote: "",
    });
    setPayOpen(true);
  };

  const closePay = () => {
    if (paying) return;
    setPayOpen(false);
    setPayOrder(null);
  };

  useEffect(() => {
    if (!payOpen) return;
    let mounted = true;
    (async () => {
      try {
        setClientsLoading(true);
        setClientsErr("");
        const data = await getAllClients();
        if (mounted) setClients(Array.isArray(data) ? data : []);
      } catch (e) {
        const errorMessage = validateResErrors(e, "Ошибка загрузки клиентов");
        alert(errorMessage, true);
        if (mounted) setClientsErr("Не удалось загрузить клиентов");
      } finally {
        if (mounted) setClientsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [payOpen]);

  const postPayCashflowDelta = async (order, paidBefore, data) => {
    const delta = toNum(data?.paid_amount) - toNum(paidBefore);
    if (!(delta > 0)) return;
    await createCashflowIncome(order, delta);
  };

  const finishPaySuccess = async (orderBefore, data) => {
    const bal = toNum(data?.balance_due);
    if (bal <= 0.005) {
      await freeTable(orderBefore.table);
    }
    try {
      printOrder({ ...orderBefore, ...data });
    } catch {
      /* ignore */
    }
    await fetchOrders();
      setPayOpen(false);
      setPayOrder(null);
  };

  const submitCheckoutPay = async () => {
    if (!payOrder?.id) return;

    const order = payOrder;
    const discount_amount = numStr(toNum(payForm.discountAmount));
    const due = checkoutDue(order, payForm.discountAmount);
    const clientId = String(payForm.clientId || getOrderClientId(order) || "").trim();

    let payload = {};
    const pm = payForm.paymentMethod;

    if (pm === "debt") {
      if (!clientId) {
        alert("Укажите гостя: для оплаты в долг нужен client_id (выберите гостя).", true);
        return;
      }
      if (payForm.usePrepaid) {
        const pre = toNum(payForm.prepaidAmount);
        if (!(pre > 0)) {
          alert("Укажите сумму предоплаты.", true);
          return;
        }
        payload = stripEmpty({
          payment_method: "debt",
          prepaid_amount: numStr(pre),
          prepaid_payment_method: payForm.prepaidPaymentMethod,
          idempotency_key: newIdempotencyKey(),
          discount_amount,
          close_order: true,
          client_id: clientId,
        });
      } else {
        payload = stripEmpty({
          payment_method: "debt",
          discount_amount,
          close_order: true,
          client_id: clientId,
        });
      }
    } else {
      const payNowNum =
        payForm.payNow.trim() === "" ? due : Math.max(0, toNum(payForm.payNow));
      const restDebt = due - payNowNum > 0.009;
      if (restDebt && !clientId) {
        alert("Выберите гостя: остаток уйдёт в долг.", true);
        return;
      }
      if (restDebt) {
        payload = stripEmpty({
          payment_method: pm,
          pay_now: numStr(payNowNum),
          idempotency_key: newIdempotencyKey(),
          client_id: clientId,
          close_order: true,
          discount_amount,
        });
      } else {
        payload = stripEmpty({
          payment_method: pm,
          discount_amount,
          close_order: true,
        });
      }
    }

    setPaying(true);
    const paidBefore = toNum(order.paid_amount);
    try {
      const { data } = await api.post(`/cafe/orders/${order.id}/pay/`, payload);
      await postPayCashflowDelta(order, paidBefore, data);
      await finishPaySuccess(order, data);
    } catch (e) {
      const errorMessage = validateResErrors(e, "Ошибка оплаты заказа");
      alert(errorMessage, true);
    } finally {
      setPaying(false);
    }
  };



  /* options */
  const tableOptions = useMemo(() => {
    const opts = (tables || [])
      .filter((t) => !busyTableIds.has(t.id) || String(t.id) === String(form.table))
      .map((t) => ({
        value: String(t.id),
        label: `Стол ${t.number}${t.places ? ` • ${t.places} мест` : ""}`,
        search: `стол ${t.number} ${t.places || ""}`.trim(),
      }));
    // value="" -> backend получит table=null (см. normalizeOrderPayload + toId)
    return [{ value: "", label: TAKEAWAY_LABEL, search: "с собой собой takeaway" }, ...opts];
  }, [tables, busyTableIds, form.table]);

  const waiterOptions = useMemo(() => {
    return [{ value: "", label: "— Без официанта —", search: "без официанта" }, ...waiters.map((w) => ({
      value: String(w.id),
      label: w.name,
      search: w.name,
    }))];
  }, [waiters]);

  const clientOptions = useMemo(() => {
    return (clients || []).map((c) => ({
      value: String(c.id),
      label: pickClientLabel(c),
      search: `${pickClientLabel(c)} ${c.phone || ""}`.trim(),
    }));
  }, [clients]);

  const payClientOptions = useMemo(() => {
    const base = [{ value: "", label: "— Не выбран —", search: "" }, ...clientOptions];
    const selectedId = String(payForm.clientId || "").trim();
    if (!selectedId) return base;
    if (base.some((o) => String(o.value) === selectedId)) return base;

    const orderClient = payOrder?.client && typeof payOrder.client === "object" ? payOrder.client : null;
    const fallbackLabel = orderClient ? pickClientLabel(orderClient) : `Клиент ${selectedId}`;
    return [{ value: selectedId, label: fallbackLabel, search: fallbackLabel }, ...base];
  }, [clientOptions, payForm.clientId, payOrder]);


  return (
    <section className="cafeOrders">
      <div className="cafeOrders__header">
        <div>
          <h2 className="cafeOrders__title">Заказы</h2>
          <div className="cafeOrders__subtitle">После оплаты заказ исчезает здесь и появляется в кассе как приход.</div>
        </div>
        <div className="cafeOrders__actions">
          <div className="cafeOrders__search">
            <FaSearch className="cafeOrders__searchIcon" />
            <input
              className="cafeOrders__searchInput"
              placeholder="Поиск: стол, официант, гости, статус…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {userRole == "owner" && !startPlan && (
              <div className="cafeOrders__filter">
                <SearchableCombobox
                  value={waiterFilter}
                  onChange={setWaiterFilter}
                  options={waiterOptionsFilter}
                  placeholder="Сотрудники"
                  classNamePrefix="cafeOrders__combo"
                />
              </div>)
          }


          {userRole === "повара" ? null : (
            <button className="cafeOrders__btn cafeOrders__btn--primary" onClick={openCreate} type="button">
              <FaPlus /> Новый заказ
            </button>
          )}
        </div>
      </div>
      <DataContainer>

        <div className="cafeOrders__list">
          {loading && <div className="cafeOrders__alert">Загрузка…</div>}
          {
            visibleOrders.map((o) => {
              const tableLabel = getOrderTableLabel(o);
              const totals = calcTotals(o);
              const orderDate = formatReceiptDate(o.created_at || o.date || o.created);
              const isTakeaway = tableLabel === TAKEAWAY_LABEL;
              const debtDue = toNum(o.balance_due);
              const showPayActions =
                String(o.status || "").toLowerCase() === "open" &&
                (!o.is_paid || debtDue > 0);

              const items = Array.isArray(o.items) ? o.items : [];
              const expanded = expandedOrders.has(String(o.id));
              const sliceItems = expanded ? items : items.slice(0, CARD_ITEMS_LIMIT);
              const rest = Math.max(0, items.length - Math.min(items.length, CARD_ITEMS_LIMIT));
              return (
                <article key={o.id} className="cafeOrders__receipt relative">
                  <SimpleStamp date={o.paid_at} className="bottom-10 left-20" type={o.status} size={'md'} />
                  <div className="cafeOrders__receiptHeader">
                    <div className="cafeOrders__receiptTable">
                      {isTakeaway ? TAKEAWAY_LABEL : `СТОЛ ${tableLabel}`}
                    </div>
                    {orderDate && <div className="cafeOrders__receiptDate">{orderDate}</div>}
                  </div>

                  <div className="cafeOrders__receiptDivider" />

                  <div className="cafeOrders__receiptItems">
                    {sliceItems.map((it, i) => {
                      const itemPrice = linePrice(it);
                      const itemTitle = orderItemTitle(it);
                      const itemQty = Number(it.quantity) || 0;
                      const sum = itemPrice * itemQty;

                      return (
                        <div key={it.id || `${it.line_kind || "menu"}-${it.menu_item || it.service_title || i}`} className="cafeOrders__receiptItem">
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

                    {toNum(o.paid_amount) > 0 && (
                      <div className="cafeOrders__receiptSubline">
                        <span>Оплачено</span>
                        <span>{fmtMoney(o.paid_amount)}</span>
                      </div>
                    )}
                    {debtDue > 0 && (
                      <div className="cafeOrders__receiptSubline cafeOrders__receiptSubline--debt">
                        <span>Долг</span>
                        <span>{fmtMoney(debtDue)}</span>
                      </div>
                    )}

                    <div className="cafeOrders__receiptActions">
                      {!o.is_paid && String(o.status || "").toLowerCase() === "open" && (
                        <button
                          className="cafeOrders__btn cafeOrders__btn--secondary"
                          onClick={() => openEdit(o)}
                          type="button"
                          disabled={saving || paying || printingId === o.id}
                        >
                          <FaEdit /> Редактировать
                        </button>
                      )}

                      {showPayActions && (
                        <button
                          className="cafeOrders__btn cafeOrders__btn--primary"
                          onClick={() => openPay(o)}
                          type="button"
                          disabled={saving || paying || printingId === o.id}
                        >
                          <FaCheckCircle />{" "}
                          {debtDue > 0 && o.is_paid ? "Долг" : "Оплатить"}
                        </button>
                      )}
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
      {/* Modal create/edit */}
      {modalOpen && (
        <div
          className="cafeOrdersModal__overlay z-100!"
          onClick={() => {
            if (!saving) {
              setModalOpen(false);
              setMenuOpen(false);
              setShowAddClient(false);
              setOpenSelectId(null);
            }
          }}
        >
          <div className="cafeOrdersModal__shell" onClick={(e) => e.stopPropagation()}>
            <div
              className="cafeOrdersModal__card"
              onClick={() => {
                if (menuOpen) setMenuOpen(false);
              }}
            >
              <div className="cafeOrdersModal__header">
                <h3 className="cafeOrdersModal__title">{isEditing ? "Редактировать заказ" : "Новый заказ"}</h3>
                <button
                  className="cafeOrdersModal__close"
                  onClick={() => {
                    if (!saving) {
                      setModalOpen(false);
                      setMenuOpen(false);
                      setShowAddClient(false);
                      setOpenSelectId(null);
                    }
                  }}
                  disabled={saving}
                  aria-label="Закрыть"
                  type="button"
                >
                  <FaTimes />
                </button>
              </div>

              <form className="cafeOrders__form" onSubmit={saveForm}>
                <div className="cafeOrders__formGrid">
                  <SearchSelect
                    id="table"
                    openId={openSelectId}
                    setOpenId={setOpenSelectId}
                    label="Стол"
                    placeholder={TAKEAWAY_LABEL}
                    value={String(form.table ?? "")}
                    onChange={(val) => setForm((f) => ({ ...f, table: val }))}
                    options={tableOptions}
                    disabled={saving}
                    hint={busyTableIds.size > 0 ? "Занятые столы скрыты до оплаты." : ""}
                  />

                  <div className="cafeOrders__field">
                    <label className="cafeOrders__label">Гостей</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="cafeOrders__input"
                      value={form.guests}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setForm((f) => ({ ...f, guests: val === "" ? "" : Math.max(0, Number(val) || 0) }));
                      }}
                      disabled={saving}
                    />
                  </div>
                  {!isStaff && !startPlan && (
                    <div className="cafeOrders__field" style={{ gridColumn: "1 / -1" }}>
                      <SearchSelect
                        id="waiter"
                        openId={openSelectId}
                        setOpenId={setOpenSelectId}
                        label="Официант"
                        placeholder="— Выберите официанта —"
                        value={String(form.waiter ?? "")}
                        onChange={(val) => setForm((f) => ({ ...f, waiter: val }))}
                        options={waiterOptions}
                        disabled={saving}
                      />
                    </div>
                  )}
                </div>

                {/* Клиент */}
                <div className="cafeOrders__itemsBlock">
                  <div className="cafeOrders__clientTopRow">
                    <div className="cafeOrders__clientTopLeft">
                      <SearchSelect
                        id="client"
                        openId={openSelectId}
                        setOpenId={setOpenSelectId}
                        label={clientsLoading ? "Клиент (загрузка…)" : "Клиент"}
                        placeholder={clientsLoading ? "Загрузка…" : "— Выберите клиента —"}
                        value={String(form.client ?? "")}
                        onChange={(val) => setForm((f) => ({ ...f, client: val }))}
                        options={clientOptions}
                        disabled={saving || clientsLoading}
                        hint={clientsErr ? clientsErr : "Поиск работает по имени и телефону."}
                      />
                    </div>

                    <div className="cafeOrders__clientTopRight">
                      <button
                        type="button"
                        className="cafeOrders__btn cafeOrders__btn--secondary"
                        onClick={() => setShowAddClient((v) => !v)}
                        disabled={saving}
                      >
                        <FaPlus /> Добавить
                      </button>
                    </div>
                  </div>

                  {showAddClient && (
                    <div className="cafeOrders__clientAdd">
                      <input
                        className="cafeOrders__input"
                        placeholder="Имя *"
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        disabled={addClientSaving || saving}
                      />
                      <input
                        className="cafeOrders__input"
                        placeholder="Телефон"
                        value={newClientPhone}
                        onChange={(e) => setNewClientPhone(e.target.value)}
                        disabled={addClientSaving || saving}
                      />
                      <button
                        type="button"
                        className="cafeOrders__btn cafeOrders__btn--primary"
                        onClick={handleCreateClient}
                        disabled={addClientSaving || saving}
                      >
                        {addClientSaving ? "Сохранение…" : "Сохранить"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Позиции */}
                <div className="cafeOrders__itemsBlock">
                  <div className="cafeOrders__itemsHead">
                    <h4 className="cafeOrders__itemsHeadTitle">Позиции заказа</h4>

                    <button
                      type="button"
                      className="cafeOrders__btn cafeOrders__btn--primary"
                      onClick={() => {
                        setOpenSelectId(null);
                        setMenuOpen(true);
                      }}
                      disabled={saving}
                    >
                      <FaPlus /> Добавить блюда
                    </button>
                  </div>

                  {form.items.length ? (
                    <div className="cafeOrders__itemsList">
                      {form.items.map((it) => {
                        const isService = String(it.line_kind || "menu").toLowerCase() === "service";
                        const img = isService ? "" : menuImageUrl(it.menu_item);
                        const qtyNum = lineQtyNum(it.quantity);
                        const price = toNum(it.price);
                        const sum = price * qtyNum;
                        const lineTitle = isService ? it.service_title || "Услуга" : it.title;

                        return (
                          <div key={it._key} className="cafeOrders__itemRow">
                            <div className="cafeOrders__itemLeft">
                              <span className="cafeOrders__thumb cafeOrders__thumb--sm" aria-hidden>
                                {img ? <img src={img} alt="" /> : <FaClipboardList />}
                              </span>

                              <div className="cafeOrders__itemInfo">
                                <div className="cafeOrders__itemTitle" title={lineTitle}>
                                  {lineTitle}
                                  {isService ? (
                                    <span className="cafeOrders__itemKind"> · услуга</span>
                                  ) : null}
                                </div>
                                <textarea
                                  className="cafeOrders__input"
                                  placeholder="Комментарий к блюду"
                                  value={it.comment || ""}
                                  onChange={(e) => changeItemComment(it._key, e.target.value)}
                                  disabled={saving}
                                  rows={2}
                                />
                                <div className="cafeOrders__itemMeta">
                                  <span>{fmtMoney(price)} сом</span>
                                  <span className="cafeOrders__dot">•</span>
                                  <span>{fmtMoney(sum)} сом</span>
                                </div>
                              </div>
                            </div>

                            <div className="cafeOrders__itemRight">
                              <div className="cafeOrders__qty">
                                <button
                                  type="button"
                                  className="cafeOrders__qtyBtn"
                                  onClick={() => decItem(it._key)}
                                  disabled={saving || qtyNum <= 0}
                                  aria-label="Уменьшить"
                                >
                                  <FaMinus />
                                </button>

                                <input
                                  className="cafeOrders__qtyInput"
                                  type="text"
                                  inputMode="numeric"
                                  autoComplete="off"
                                  value={lineQtyInputValue(it.quantity)}
                                  onChange={(e) => changeItemQty(it._key, e.target.value)}
                                  disabled={saving}
                                />

                                <button
                                  type="button"
                                  className="cafeOrders__qtyBtn"
                                  onClick={() => incItem(it._key)}
                                  disabled={saving}
                                  aria-label="Увеличить"
                                >
                                  <FaPlus />
                                </button>
                              </div>

                              <button
                                type="button"
                                className="cafeOrders__btn cafeOrders__btn--danger cafeOrders__itemRemove"
                                onClick={() => removeItem(it._key)}
                                disabled={saving}
                                title="Удалить"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      <div className="cafeOrders__itemsFooter">
                        <div className="cafeOrders__itemsTotalLine">
                          <span>Итого</span>
                          <span>
                            {fmtMoney(
                              form.items.reduce((s, i) => s + toNum(i.price) * (Number(i.quantity) || 0), 0)
                            )}{" "}
                            сом
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="cafeOrders__formActions">
                  {isEditing && (
                    <button
                      type="button"
                      className="cafeOrders__btn cafeOrders__btn--danger"
                      onClick={async () => {
                        if (!editingId || saving) return;
                        setSaving(true);
                        try {
                          await api.patch(`/cafe/orders/${editingId}/`, { status: "cancelled" });
                          setModalOpen(false);
                          await fetchOrders()
                        } catch (err) {
                          // Ошибка при отмене заказа
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                    >
                      <FaTimes /> Отменить заказ
                    </button>
                  )}
                  <button
                    type="submit"
                    className="cafeOrders__btn cafeOrders__btn--primary"
                    disabled={
                      saving ||
                      !form.items.length ||
                      form.items.some((i) => lineQtyNum(i.quantity) < 1)
                    }
                  >
                    {saving ? "Сохраняем…" : isEditing ? "Сохранить" : "Добавить"}
                  </button>
                </div>
              </form>
            </div>

            <RightMenuPanel
              open={menuOpen}
              selectedCategoryFilter={selectedCategoryFilter}
              setSelectedCategoryFilter={setSelectedCategoryFilter}
              onClose={() => {
                setMenuOpen(false);
                setMenuCurrentPage(1);
                // Загружаем первую страницу без поиска при закрытии
                handleMenuPageChange(1, "");
              }}
              cartItems={form.items}
              menuItems={menuItems}
              menuImageUrl={menuImageUrl}
              onPick={(m) => addOrIncMenuItem(m)}
              fmtMoney={fmtMoney}
              currentPage={menuCurrentPage}
              loading={menuLoading}
              onPageChange={handleMenuPageChange}
            />
          </div>
        </div>
      )}

      {/* Pay modal */}
      {payOpen && payOrder && (
        <div className="cafeOrdersModal__overlay z-100!" onClick={closePay}>
          <div className="cafeOrdersModal__shell" onClick={(e) => e.stopPropagation()}>
            <div className="cafeOrdersModal__card">
              <div className="cafeOrdersModal__header">
                <h3 className="cafeOrdersModal__title">Оплата заказа</h3>
                <button
                  className="cafeOrdersModal__close"
                  onClick={closePay}
                  disabled={paying || printingId === payOrder.id}
                  aria-label="Закрыть"
                  type="button"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="cafeOrdersPay">
                {(() => {
                  const tableLabel = getOrderTableLabel(payOrder);
                  const dt = formatReceiptDate(payOrder?.created_at || payOrder?.date || payOrder?.created);
                  const items = Array.isArray(payOrder?.items) ? payOrder.items : [];
                  const totals = calcTotals(payOrder);
                  const isTakeaway = tableLabel === TAKEAWAY_LABEL;
                  const due = checkoutDue(payOrder, payForm.discountAmount);
                  const bal = toNum(payOrder.balance_due);
                  const paidShown = toNum(payOrder.paid_amount);

                  return (
                    <>
                      <div className="cafeOrdersPay__top">
                        <div className="cafeOrdersPay__table">
                          {isTakeaway ? TAKEAWAY_LABEL : `СТОЛ ${tableLabel}`}
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
                            const sum = price * qty;

                            return (
                              <div key={it.id || `${it.line_kind || "menu"}-${it.menu_item || it.service_title || idx}`} className="cafeOrdersPay__row">
                                <span className="cafeOrdersPay__name" title={title}>
                                  {title}
                                </span>
                                <span className="cafeOrdersPay__qty">x{qty}</span>
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
                        <span>По позициям</span>
                        <span>{fmtMoney(totals.total)}</span>
                      </div>
                      {(paidShown > 0 || bal > 0) && (
                        <div className="cafeOrdersPay__summary">
                          {paidShown > 0 && (
                            <div className="cafeOrdersPay__summaryRow">
                              <span>Уже оплачено</span>
                              <span>{fmtMoney(paidShown)}</span>
                            </div>
                          )}
                          {bal > 0 && (
                            <div className="cafeOrdersPay__summaryRow cafeOrdersPay__summaryRow--debt">
                              <span>Долг</span>
                              <span>{fmtMoney(bal)}</span>
                            </div>
                          )}
                          <div className="cafeOrdersPay__summaryRow cafeOrdersPay__summaryRow--strong">
                            <span>К оплате (чек)</span>
                            <span>{fmtMoney(due)}</span>
                          </div>
                        </div>
                      )}
  <div className="cafeOrdersPay__field">
                            <label className="cafeOrdersPay__label">
                              Гость (для долга){payForm.paymentMethod === "debt" ? " *" : ""}
                            </label>
                            <SearchableCombobox
                              value={payForm.clientId}
                              onChange={(v) =>
                                setPayForm((f) => {
                                  const nextId = String(v || "").trim();
                                  if (f.paymentMethod === "debt" && !nextId) return f;
                                  return { ...f, clientId: nextId };
                                })
                              }
                              options={payClientOptions}
                              placeholder="Выберите гостя…"
                              disabled={paying}
                              hideClear={payForm.paymentMethod === "debt"}
                              classNamePrefix="cafeOrdersPayCombo"
                            />
                          </div>
                           <div className="cafeOrdersPay__field">
                            <label className="cafeOrdersPay__label">Способ оплаты</label>
                            <SearchableCombobox
                              value={payForm.paymentMethod}
                              onChange={(v) =>
                                setPayForm((f) => {
                                  const nextMethod = normalizePaymentMethod(v) || "cash";
                                  const next = { ...f, paymentMethod: nextMethod };
                                  if (nextMethod === "debt" && !String(next.clientId || "").trim()) {
                                    next.clientId = getOrderClientId(payOrder) || "";
                                  }
                                  return next;
                                })
                              }
                              options={PAY_CHECKOUT_METHODS}
                              placeholder="Способ…"
                              disabled={paying}
                              hideClear
                              classNamePrefix="cafeOrdersPayCombo"
                            />
                          </div>
                              <div className="cafeOrdersPay__field">
                                <label className="cafeOrdersPay__label">Способ предоплаты</label>
                                <SearchableCombobox
                                  value={payForm.prepaidPaymentMethod}
                                  onChange={(v) =>
                                    setPayForm((f) => ({ ...f, prepaidPaymentMethod: v }))
                                  }
                                  options={[
                                    { value: "cash", label: "Наличные" },
                                    { value: "card", label: "Карта" },
                                    { value: "transfer", label: "Перевод" },
                                  ]}
                                  placeholder="Способ…"
                                  disabled={paying}
                                  classNamePrefix="cafeOrdersPayCombo"
                                />
                              </div>

                         
                      <div className="cafeOrdersPay__form">
                          <div className="cafeOrdersPay__field">
                            <label className="cafeOrdersPay__label">Скидка (сумма)</label>
                            <input
                              className="cafeOrdersPay__input"
                              type="text"
                              inputMode="decimal"
                              value={payForm.discountAmount}
                              onChange={(e) => {
                                const v = e.target.value.replace(",", ".");
                                setPayForm((f) => {
                                  const next = { ...f, discountAmount: v };
                                  const d = checkoutDue(payOrder, v);
                                  next.payNow = numStr(d);
                                  return next;
                                });
                              }}
                            />
                          </div>

                          {payForm.paymentMethod !== "debt" && (
                            <div className="cafeOrdersPay__field">
                              <label className="cafeOrdersPay__label">
                                Сумма сейчас (остаток в долг, если меньше {fmtMoney(due)})
                              </label>
                              <input
                                className="cafeOrdersPay__input"
                                type="text"
                                inputMode="decimal"
                                value={payForm.payNow}
                                onChange={(e) =>
                                  setPayForm((f) => ({ ...f, payNow: e.target.value.replace(",", ".") }))
                                }
                              />
                            </div>
                          )}
                          {payForm.paymentMethod === "debt" && (
                            <label className="cafeOrdersPay__check">
                              <input
                                type="checkbox"
                                checked={payForm.usePrepaid}
                                onChange={(e) =>
                                  setPayForm((f) => ({ ...f, usePrepaid: e.target.checked }))
                                }
                                disabled={paying}
                              />
                              <span>Предоплата + долг на остаток</span>
                            </label>
                          )}
                          {payForm.paymentMethod === "debt" && payForm.usePrepaid && (
                            <>
                              <div className="cafeOrdersPay__field">
                                <label className="cafeOrdersPay__label">Предоплата</label>
                                <input
                                  className="cafeOrdersPay__input"
                                  type="text"
                                  inputMode="decimal"
                                  value={payForm.prepaidAmount}
                                  onChange={(e) =>
                                    setPayForm((f) => ({
                                      ...f,
                                      prepaidAmount: e.target.value.replace(",", "."),
                                    }))
                                  }
                                />
                              </div>
                          
                            </>
                          )}
                        
                      </div>
                    </>
                  );
                })()}

                <div className="cafeOrdersPay__actions">
                  <button
                    type="button"
                    className="cafeOrders__btn cafeOrders__btn--secondary"
                    onClick={closePay}
                    disabled={paying || printingId === payOrder.id}
                  >
                    Отмена
                  </button>

                  <button
                    type="button"
                    className="cafeOrders__btn cafeOrders__btn--secondary"
                    onClick={() => printOrder(payOrder)}
                    disabled={paying || printingId === payOrder.id}
                    title="Распечатать чек"
                  >
                    <FaClipboardList /> {printingId === payOrder.id ? "Печать…" : "Чек"}
                  </button>

                  <button
                    type="button"
                    className="cafeOrders__btn cafeOrders__btn--primary"
                    onClick={submitCheckoutPay}
                    disabled={paying || printingId === payOrder.id}
                  >
                    {paying ? "Оплата…" : "Провести оплату"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Orders;