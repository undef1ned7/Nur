// src/.../Orders.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  printOrderReceiptJSONViaUSBWithDialog,
  printOrderReceiptJSONViaUSB,
  setActivePrinterByKey,
} from "./OrdersPrintService";

import { RightMenuPanel, SearchSelect } from "./components/OrdersParts";
import SearchableCombobox from "../../../common/SearchableCombobox/SearchableCombobox";
import { SimpleStamp } from "../../../UI/SimpleStamp";
import { useDebouncedValue } from "../../../../hooks/useDebounce";

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
const numStr = (n) => String(Number(n) || 0).replace(",", ".");

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

const toId = (v) => {
  if (v === "" || v === undefined || v === null) return null;
  const s = String(v);
  return /^\d+$/.test(s) ? Number(s) : s;
};

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

const stripEmpty = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );

const normalizeOrderPayload = (f, isNew = false) =>
  stripEmpty({
    table: toId(f.table),
    waiter: toId(f.waiter),
    client: toId(f.client),
    guests: Math.max(0, Number(f.guests) || 0),
    status: isNew ? "open" : undefined,
    items: (f.items || [])
      .filter((i) => i && i.menu_item && Number(i.quantity) > 0)
      .map((i) =>
        stripEmpty({
          menu_item: toId(i.menu_item),
          quantity: Math.max(1, Number(i.quantity) || 1),
        })
      ),
  });

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
  const [tables, setTables] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const menuCacheRef = useRef(new Map());
  const [loading, setLoading] = useState(true);

  const [kitchens, setKitchens] = useState([]);

  const [cashboxes, setCashboxes] = useState([]);
  const [cashboxId, setCashboxId] = useState("");

  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState("");
  const debouncedOrderSearchQuery = useDebouncedValue(query, 400);
  const [statusFilter, setStatusFilter] = useState("");

  const userData = useMemo(() => safeUserData(), []);
  const userRole = userData?.role || "";
  const userId = localStorage.getItem("userId");

  const [printingId, setPrintingId] = useState(null);

  const [showAll, setShowAll] = useState(false);
  const ORDERS_COLLAPSE_LIMIT = 6;

  const [expandedOrders, setExpandedOrders] = useState(() => new Set());
  const CARD_ITEMS_LIMIT = 4;

  const [openSelectId, setOpenSelectId] = useState(null);

  /* ===== API ===== */
  const fetchTables = async () => setTables(listFrom(await api.get("/cafe/tables/")));

  const fetchEmployees = async () => {
    const arr = listFrom(await api.get("/users/employees/")) || [];
    setEmployees(arr.map(normalizeEmployee));
  };

  const fetchKitchens = async () => {
    try {
      const r = await api.get("/cafe/kitchens/");
      setKitchens(listFrom(r) || []);
    } catch (e) {
      console.error("Ошибка загрузки кухонь:", e);
      setKitchens([]);
    }
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

  const fetchOrders = useCallback(async (params = {}) => {
    const base = listFrom(await api.get("/cafe/orders/", {
      params
    })) || [];
    const full = await hydrateOrdersDetails(base);
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
        await Promise.all([fetchTables(), fetchEmployees(), fetchMenu(), fetchKitchens(), fetchCashboxes()]);
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
        await fetchOrders({
          search: debouncedOrderSearchQuery,
          status: statusFilter || null
        });
      } catch (e) {
        console.error("Ошибка загрузки:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [debouncedOrderSearchQuery, statusFilter])

  useEffect(() => {
    const handler = () => fetchOrders();
    window.addEventListener("orders:refresh", handler);
    return () => window.removeEventListener("orders:refresh", handler);
  }, [fetchOrders]);

  const tablesMap = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);

  const waiters = useMemo(
    () =>
      employees
        .filter((u) => /официант|waiter/i.test(u.role_display || ""))
        .map((u) => ({ id: u.id, name: fullName(u) })),
    [employees]
  );
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
    if (userRole === "официант") {
      return base.filter((item) => String(item.waiter) === String(userId));
    }
    return orders;
  }, [orders, userRole, userId]);

  const visibleOrders = useMemo(() => {
    if (showAll) return roleFiltered;
    if (roleFiltered.length > ORDERS_COLLAPSE_LIMIT) return roleFiltered.slice(0, ORDERS_COLLAPSE_LIMIT);
    return roleFiltered;
  }, [roleFiltered, showAll]);

  useEffect(() => {
    if (roleFiltered.length <= ORDERS_COLLAPSE_LIMIT && showAll) setShowAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFiltered.length]);

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

  /* ===== печать (оплата/чек) ===== */
  const buildPrintPayload = useCallback(
    (order) => {
      const t = tablesMap.get(order?.table);
      const dt = formatReceiptDate(order?.created_at || order?.date || order?.created);
      const cashier = fullName(userData || {});
      const items = Array.isArray(order?.items) ? order.items : [];

      return {
        company: localStorage.getItem("company_name") || "КАССА",
        doc_no: `СТОЛ ${t?.number ?? "—"}`,
        created_at: dt,
        cashier_name: cashier,
        discount: 0,
        tax: 0,
        paid_cash: 0,
        paid_card: 0,
        change: 0,
        items: items.map((it) => ({
          name: String(it.menu_item_title || it.title || "Позиция"),
          qty: Math.max(1, Number(it.quantity) || 1),
          price: linePrice(it),
        })),
      };
    },
    [tablesMap, userData]
  );

  const printOrder = useCallback(
    async (order) => {
      if (!order?.id) return;
      if (printingId) return;

      setPrintingId(order.id);
      try {
        await checkPrinterConnection().catch(() => false);
        const payload = buildPrintPayload(order);
        await printOrderReceiptJSONViaUSBWithDialog(payload);
      } catch (e) {
        // Ошибка печати чека
      } finally {
        setPrintingId(null);
      }
    },
    [buildPrintPayload, printingId]
  );

  /* ===== АВТОПЕЧАТЬ НА КУХНЮ ПОСЛЕ СОЗДАНИЯ ЗАКАЗА ===== */
  const buildKitchenTicketPayload = useCallback(
    ({ order, kitchenId, kitchenLabel, items }) => {
      const t = tablesMap.get(order?.table);
      const dt = formatReceiptDate(order?.created_at || order?.date || order?.created);
      const cashier = fullName(userData || {});

      return {
        company: localStorage.getItem("company_name") || "КАССА",
        doc_no: `${kitchenLabel || "КУХНЯ"} • СТОЛ ${t?.number ?? "—"}`,
        created_at: dt,
        cashier_name: cashier,
        discount: 0,
        tax: 0,
        paid_cash: 0,
        paid_card: 0,
        change: 0,
        kitchen_id: kitchenId,
        items: (items || []).map((it) => ({
          name: String(it.menu_item_title || it.title || "Позиция"),
          qty: Math.max(1, Number(it.quantity) || 1),
          price: linePrice(it),
        })),
      };
    },
    [tablesMap, userData]
  );

  const getKitchenPrinterKey = useCallback(
    (kitchenId) => {
      const kid = String(kitchenId || "");
      if (!kid) return "";

      const k = kitchensMap.get(kid);
      const direct = String(k?.printer_key || k?.printerKey || k?.printer || k?.printer_id || "").trim();
      if (direct) return direct;

      const ls = readKitchenPrinterMap();
      return String(ls?.[kid] || "").trim();
    },
    [kitchensMap]
  );

  const autoPrintKitchenTickets = useCallback(
    async (createdOrderId) => {
      if (!createdOrderId) return;

      try {
        const detail = await api.get(`/cafe/orders/${createdOrderId}/`).then((r) => r?.data || null);
        if (!detail) return;

        const items = Array.isArray(detail?.items) ? detail.items : [];
        if (!items.length) return;

        const groups = new Map();
        for (const it of items) {
          const menuId = it?.menu_item || it?.menu_item_id || it?.menuItem || it?.id;
          const kitchenId = getMenuKitchenId(menuId);
          if (!kitchenId) continue;

          const key = String(kitchenId);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(it);
        }

        if (!groups.size) return;

        for (const [kitchenId, kitItems] of groups.entries()) {
          const k = kitchensMap.get(String(kitchenId));
          const kitchenLabel = k?.label || k?.title || k?.name || "Кухня";
          const printerKey = getKitchenPrinterKey(kitchenId);

          if (!printerKey) {
            console.error("Kitchen print skipped: no printer_key for kitchen", kitchenId);
            continue;
          }

          const payload = buildKitchenTicketPayload({
            order: detail,
            kitchenId,
            kitchenLabel,
            items: kitItems,
          });

          await setActivePrinterByKey(printerKey);
          await printOrderReceiptJSONViaUSB(payload);
        }
      } catch (e) {
        console.error("Auto kitchen print error:", e);
        // Ошибка отправки чека на кухню
      }
    },
    [buildKitchenTicketPayload, getKitchenPrinterKey, getMenuKitchenId, kitchensMap]
  );

  /* ===== модалка create/edit ===== */
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const isEditing = editingId != null;

  const [form, setForm] = useState({
    table: "",
    guests: 2,
    waiter: "",
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
        console.error("Ошибка загрузки клиентов:", e);
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
    const free = tables.find((t) => !busyTableIds.has(t.id));
    setForm({
      table: free?.id ?? "",
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
      ? order.items.map((it) => ({
        menu_item: String(it.menu_item || it.id),
        title: it.menu_item_title || it.title,
        price: linePrice(it),
        quantity: Number(it.quantity) || 1,
      }))
      : [];

    setForm({
      table: String(order.table ?? ""),
      guests: Number(order.guests) || 0,
      waiter: order.waiter ? String(order.waiter) : "",
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

    setForm((prev) => {
      const ex = prev.items.find((i) => String(i.menu_item) === idStr);
      if (ex) {
        return {
          ...prev,
          items: prev.items.map((i) => (String(i.menu_item) === idStr ? { ...i, quantity: i.quantity + 1 } : i)),
        };
      }
      return {
        ...prev,
        items: [...prev.items, { menu_item: idStr, title: menu.title, price: toNum(menu.price), quantity: 1 }],
      };
    });
  };

  const changeItemQty = (id, nextQty) => {
    const q = Math.max(1, Number(nextQty) || 1);
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((i) => (String(i.menu_item) === String(id) ? { ...i, quantity: q } : i)),
    }));
  };

  const incItem = (id) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        String(i.menu_item) === String(id)
          ? { ...i, quantity: Math.max(1, (Number(i.quantity) || 1) + 1) }
          : i
      ),
    }));
  };

  const decItem = (id) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        String(i.menu_item) === String(id)
          ? { ...i, quantity: Math.max(1, (Number(i.quantity) || 1) - 1) }
          : i
      ),
    }));
  };

  const removeItem = (id) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((i) => String(i.menu_item) !== String(id)),
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
    if (!form.table || !form.items.length) return;

    setSaving(true);
    try {
      if (!isEditing) {
        const basePayload = normalizeOrderPayload(form, true);
        const res = await postWithWaiterFallback("/cafe/orders/", basePayload, "post");

        try {
          await api.patch(`/cafe/tables/${toId(form.table)}/`, { status: "busy" });
        } catch {
          // молча
        }

        setOrders((prev) => [...prev, res.data]);

        await autoPrintKitchenTickets(res?.data?.id);
      } else {
        const payload = normalizeOrderPayload(form);
        await postWithWaiterFallback(`/cafe/orders/${editingId}/`, payload, "patch");
      }

      setModalOpen(false);
      setMenuOpen(false);
      setShowAddClient(false);
      setOpenSelectId(null);

      await fetchOrders();
    } catch (err) {
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
    const name = `Оплата стол ${t?.number ?? "—"}`;

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
      console.error("Не удалось освободить стол:", e);
    }
  };


  /* ===== ОПЛАТА (DELETE order после прихода) ===== */
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payOrder, setPayOrder] = useState(null);

  const openPay = (order) => {
    setPayOrder(order);
    setPayOpen(true);
  };

  const closePay = () => {
    if (paying) return;
    setPayOpen(false);
    setPayOrder(null);
  };

  const paidGuardKey = useCallback((orderId) => `orders_paid_income_created_${orderId}`, []);

  const confirmPay = async () => {
    if (!payOrder?.id) return;

    setPaying(true);
    try {
      const totals = calcTotals(payOrder);

      // 1) Создаём приход (если ещё не создавали)
      const guardKey = paidGuardKey(payOrder.id);
      const alreadyCreated = localStorage.getItem(guardKey);

      if (!alreadyCreated) {
        const income = await createCashflowIncome(payOrder, totals.total);
        localStorage.setItem(guardKey, String(income?.id || income?.uuid || "1"));
      }

      // 2) Оплачиваем заказ
      await api.post(`/cafe/orders/${payOrder.id}/pay/`);

      // 3) Освобождаем стол
      await freeTable(payOrder.table);

      // 4) Сразу убираем из UI
      setOrders((prev) => (prev || []).filter((o) => String(o.id) !== String(payOrder.id)));

      // 5) Закрываем модалку
      setPayOpen(false);
      setPayOrder(null);

      // 6) Синхронизация с сервером
      await fetchOrders();

      // успех — снимаем guard
      localStorage.removeItem(guardKey);
    } catch (e) {
      console.error("Ошибка оплаты (delete order):", e);

      // Ошибка оплаты заказа
    } finally {
      setPaying(false);
    }
  };


  /* options */
  const tableOptions = useMemo(() => {
    return (tables || [])
      .filter((t) => !busyTableIds.has(t.id) || String(t.id) === String(form.table))
      .map((t) => ({
        value: String(t.id),
        label: `Стол ${t.number}${t.places ? ` • ${t.places} мест` : ""}`,
        search: `стол ${t.number} ${t.places || ""}`.trim(),
      }));
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
      label: String(c.full_name || "Без имени").trim() || "Без имени",
      search: `${c.full_name || ""} ${c.phone || ""}`.trim(),
    }));
  }, [clients]);

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

          <div className="cafeOrders__filter">
            <SearchableCombobox
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusFilterOptions}
              placeholder="Статус"
              classNamePrefix="cafeOrders__combo"
            />
          </div>

          {userRole === "повара" ? null : (
            <button className="cafeOrders__btn cafeOrders__btn--primary" onClick={openCreate} type="button">
              <FaPlus /> Новый заказ
            </button>
          )}
        </div>
      </div>

      {!loading && roleFiltered.length > ORDERS_COLLAPSE_LIMIT && (
        <div className="cafeOrders__collapseRow">
          <button
            type="button"
            className="cafeOrders__btn cafeOrders__btn--secondary"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Свернуть" : `Показать все (${roleFiltered.length})`}
          </button>
        </div>
      )}

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
                <SimpleStamp date={o.paid_at} className="bottom-10 left-20" type={o.status} size={'md'} />
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

                  <div className="cafeOrders__receiptActions">
                    {
                      !o.is_paid && o.status == 'open' && (<button
                        className="cafeOrders__btn cafeOrders__btn--secondary"
                        onClick={() => openEdit(o)}
                        type="button"
                        disabled={saving || paying || printingId === o.id}
                      >
                        <FaEdit /> Редактировать
                      </button>)
                    }

                    {
                      !o.is_paid && o.status == 'open' && (<button
                        className="cafeOrders__btn cafeOrders__btn--primary"
                        onClick={() => openPay(o)}
                        type="button"
                        disabled={saving || paying || printingId === o.id}
                      >
                        <FaCheckCircle /> Оплатить
                      </button>)
                    }
                  </div>
                </div>
              </article>
            );
          })}

        {!loading && !roleFiltered.length && (
          <div className="cafeOrders__alert cafeOrders__alert--muted">Ничего не найдено по «{query}».</div>
        )}
      </div>

      {/* Modal create/edit */}
      {modalOpen && (
        <div
          className="cafeOrdersModal__overlay"
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
            <div className="cafeOrdersModal__card">
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
                    placeholder="— Выберите стол —"
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
                        const img = menuImageUrl(it.menu_item);
                        const qty = Math.max(1, Number(it.quantity) || 1);
                        const price = toNum(it.price);
                        const sum = price * qty;

                        return (
                          <div key={it.menu_item} className="cafeOrders__itemRow">
                            <div className="cafeOrders__itemLeft">
                              <span className="cafeOrders__thumb cafeOrders__thumb--sm" aria-hidden>
                                {img ? <img src={img} alt="" /> : <FaClipboardList />}
                              </span>

                              <div className="cafeOrders__itemInfo">
                                <div className="cafeOrders__itemTitle" title={it.title}>
                                  {it.title}
                                </div>
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
                                  onClick={() => decItem(it.menu_item)}
                                  disabled={saving || qty <= 1}
                                  aria-label="Уменьшить"
                                >
                                  <FaMinus />
                                </button>

                                <input
                                  className="cafeOrders__qtyInput"
                                  value={qty}
                                  onChange={(e) => changeItemQty(it.menu_item, e.target.value)}
                                  disabled={saving}
                                  inputMode="numeric"
                                />

                                <button
                                  type="button"
                                  className="cafeOrders__qtyBtn"
                                  onClick={() => incItem(it.menu_item)}
                                  disabled={saving}
                                  aria-label="Увеличить"
                                >
                                  <FaPlus />
                                </button>
                              </div>

                              <button
                                type="button"
                                className="cafeOrders__btn cafeOrders__btn--danger cafeOrders__itemRemove"
                                onClick={() => removeItem(it.menu_item)}
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
                          await fetchOrders();
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
                    disabled={saving || !form.table || !form.items.length}
                  >
                    {saving ? "Сохраняем…" : isEditing ? "Сохранить" : "Добавить"}
                  </button>
                </div>
              </form>
            </div>

            <RightMenuPanel
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              menuItems={menuItems}
              menuImageUrl={menuImageUrl}
              onPick={(m) => addOrIncMenuItem(m)}
              fmtMoney={fmtMoney}
            />
          </div>
        </div>
      )}

      {/* Pay modal */}
      {payOpen && payOrder && (
        <div className="cafeOrdersModal__overlay" onClick={closePay}>
          <div className="cafeOrdersModal__shell" onClick={(e) => e.stopPropagation()}>
            <div className="cafeOrdersModal__card">
              <div className="cafeOrdersModal__header">
                <h3 className="cafeOrdersModal__title">Чек перед оплатой</h3>
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
                  const t = tablesMap.get(payOrder?.table);
                  const dt = formatReceiptDate(payOrder?.created_at || payOrder?.date || payOrder?.created);
                  const items = Array.isArray(payOrder?.items) ? payOrder.items : [];
                  const totals = calcTotals(payOrder);

                  return (
                    <>
                      <div className="cafeOrdersPay__top">
                        <div className="cafeOrdersPay__table">СТОЛ {t?.number ?? "—"}</div>
                        <div className="cafeOrdersPay__date">{dt || ""}</div>
                      </div>

                      <div className="cafeOrdersPay__divider" />

                      <div className="cafeOrdersPay__list">
                        {items.length ? (
                          items.map((it, idx) => {
                            const title = it.menu_item_title || it.title || "Позиция";
                            const qty = Number(it.quantity) || 0;
                            const price = linePrice(it);
                            const sum = price * qty;

                            return (
                              <div key={it.id || it.menu_item || idx} className="cafeOrdersPay__row">
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
                        <span>ИТОГО</span>
                        <span>{fmtShort(totals.total)}</span>
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
                    onClick={confirmPay}
                    disabled={paying || printingId === payOrder.id}
                  >
                    {paying ? "Оплата…" : "Оплатить"}
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