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
  FaChevronDown,
} from "react-icons/fa";
import api from "../../../../api";
import { getAll as getAllClients, createClient } from "../Clients/clientStore";
import "./Orders.scss";
import WaiterModal from "./WaiterModal";
import CookModal from "./CookModal";

import {
  attachUsbListenersOnce,
  checkPrinterConnection,
  printOrderReceiptJSONViaUSBWithDialog,
} from "./OrdersPrintService";

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

const normalizeOrderPayload = (f) =>
  stripEmpty({
    table: toId(f.table),
    waiter: toId(f.waiter),
    client: toId(f.client),
    guests: Math.max(0, Number(f.guests) || 0),
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

/* =========================================================
   Searchable Combobox (SearchSelect) — один открытый и закрывается после выбора
   ========================================================= */
const SearchSelect = ({
  id,
  openId,
  setOpenId,
  label,
  placeholder = "Выберите…",
  value,
  onChange,
  options = [],
  disabled = false,
  hint,
  allowClear = true,
}) => {
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const open = openId === id;

  const [q, setQ] = useState("");
  const [dir, setDir] = useState("down"); // down | up

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;

    return options.filter((o) => {
      const hay = String(o.search ?? o.label ?? "").toLowerCase();
      return hay.includes(s);
    });
  }, [options, q]);

  const closeDropdown = useCallback(() => {
    setOpenId(null);
    setQ("");
  }, [setOpenId]);

  const computeDir = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const viewportH = window.innerHeight || 0;

    const estimated = Math.min(320, 56 + (options?.length || 0) * 44);
    const spaceBelow = viewportH - r.bottom;
    const spaceAbove = r.top;

    if (spaceBelow < estimated && spaceAbove > spaceBelow) setDir("up");
    else setDir("down");
  }, [options]);

  useEffect(() => {
    if (!open) return;

    const onDoc = (e) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) closeDropdown();
    };

    const onKey = (e) => {
      if (e.key === "Escape") closeDropdown();
    };

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", computeDir, { passive: true });
    window.addEventListener("scroll", computeDir, { passive: true });

    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", computeDir);
      window.removeEventListener("scroll", computeDir);
    };
  }, [open, computeDir, closeDropdown]);

  useEffect(() => {
    if (!open) {
      setQ("");
      return;
    }
    computeDir();
    const t = window.setTimeout(() => inputRef.current?.focus?.(), 0);
    return () => window.clearTimeout(t);
  }, [open, computeDir]);

  const openDropdown = () => {
    if (disabled) return;
    setOpenId(id);
    setQ("");
  };

  const toggleDropdown = () => {
    if (disabled) return;
    setOpenId((prev) => {
      const next = prev === id ? null : id;
      return next;
    });
    setQ("");
  };

  const pick = (opt) => {
    onChange?.(opt.value);
    closeDropdown();
  };

  const clear = () => {
    onChange?.("");
    closeDropdown();
  };

  const shownValue = open ? q : selected?.label || "";

  return (
    <div ref={rootRef} className={`sselect ${open ? "sselect--open" : ""}`}>
      {label ? <div className="sselect__label">{label}</div> : null}

      <div
        className={`sselect__control ${open ? "sselect__control--open" : ""} ${
          disabled ? "sselect__control--disabled" : ""
        }`}
        onMouseDown={(e) => {
          if (disabled) return;
          e.preventDefault();

          // если уже открыто и клик по input — не сворачиваем, чтобы можно было выделять текст
          if (open && e.target === inputRef.current) return;

          toggleDropdown();
        }}
        role="combobox"
        aria-expanded={open}
        aria-disabled={disabled}
      >
        <input
          ref={inputRef}
          className="sselect__input"
          value={shownValue}
          onChange={(e) => {
            if (!open) setOpenId(id);
            setQ(e.target.value);
          }}
          onFocus={() => openDropdown()}
          placeholder={placeholder}
          readOnly={!open}
          disabled={disabled}
        />

        {allowClear && !disabled && value ? (
          <button
            type="button"
            className="sselect__clear"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              clear();
            }}
            aria-label="Очистить"
            title="Очистить"
          >
            <FaTimes />
          </button>
        ) : null}

        <span className="sselect__icon" aria-hidden>
          <FaChevronDown />
        </span>

        {open && (
          <div
            className={`sselect__dropdown ${dir === "up" ? "sselect__dropdown--up" : ""}`}
            role="listbox"
            onMouseDown={(e) => {
              // важно: иначе событие долетит до control и снова откроет/закроет
              e.stopPropagation();
            }}
          >
            <div className="sselect__list">
              {filtered.length ? (
                filtered.map((opt) => {
                  const active = String(opt.value) === String(value);
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      className={`sselect__item ${active ? "sselect__item--active" : ""}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        pick(opt);
                      }}
                      title={opt.label}
                    >
                      <span className="sselect__itemLabel">{opt.label}</span>
                    </button>
                  );
                })
              ) : (
                <div className="sselect__empty">Ничего не найдено</div>
              )}
            </div>
          </div>
        )}
      </div>

      {hint ? <div className="sselect__hint">{hint}</div> : null}
    </div>
  );
};

/* =========================================================
   Правая панель меню
   ========================================================= */
const RightMenuPanel = ({ open, onClose, menuItems, menuImageUrl, onPick }) => {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return menuItems || [];
    return (menuItems || []).filter((m) => String(m?.title || "").toLowerCase().includes(s));
  }, [menuItems, q]);

  if (!open) return null;

  return (
    <aside className="orders-rpanel" aria-label="Меню">
      <div className="orders-rpanel__head">
        <div className="orders-rpanel__title">Меню</div>
        <button
          type="button"
          className="orders-rpanel__close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          <FaTimes />
        </button>
      </div>

      <div className="orders-rpanel__search">
        <FaSearch className="orders-rpanel__searchIcon" />
        <input
          className="orders-rpanel__searchInput"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск блюд…"
        />
      </div>

      <div className="orders-rpanel__list">
        {filtered.length ? (
          filtered.map((m) => {
            const img = menuImageUrl?.(m.id);
            return (
              <button
                key={m.id}
                type="button"
                className="orders-rpanel__item"
                onClick={() => onPick(m)}
                title={m.title}
              >
                <span className="orders-rpanel__thumb" aria-hidden>
                  {img ? <img src={img} alt="" /> : <FaClipboardList />}
                </span>

                <span className="orders-rpanel__meta">
                  <span className="orders-rpanel__name">{m.title}</span>
                  <span className="orders-rpanel__price">{fmtMoney(m.price)} сом</span>
                </span>

                <span className="orders-rpanel__add" aria-hidden>
                  <FaPlus />
                </span>
              </button>
            );
          })
        ) : (
          <div className="orders-rpanel__empty">Ничего не найдено</div>
        )}
      </div>

      <div className="orders-rpanel__footer">
        <button
          type="button"
          className="orders__btn orders__btn--primary orders__btn--wide"
          onClick={onClose}
        >
          Готов
        </button>
      </div>
    </aside>
  );
};

/* =========================================================
   Orders
   ========================================================= */
const Orders = () => {
  const [tables, setTables] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const menuCacheRef = useRef(new Map());
  const [loading, setLoading] = useState(true);

  const [cashboxes, setCashboxes] = useState([]);
  const [cashboxId, setCashboxId] = useState("");

  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState("");

  const originalTableRef = useRef(null);

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

  const fetchMenu = async () => {
    const arr = listFrom(await api.get("/cafe/menu-items/")) || [];
    setMenuItems(arr);
    for (const m of arr) menuCacheRef.current.set(String(m.id), m);
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

  const fetchOrders = async () => {
    const base = listFrom(await api.get("/cafe/orders/")) || [];
    const full = await hydrateOrdersDetails(base);
    setOrders(full);
  };

  useEffect(() => {
    try {
      attachUsbListenersOnce();
    } catch (e) {
      console.error("Print init error:", e);
    }

    (async () => {
      try {
        await Promise.all([fetchTables(), fetchEmployees(), fetchMenu(), fetchCashboxes()]);
        await fetchOrders();
      } catch (e) {
        console.error("Ошибка загрузки:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const handler = () => fetchOrders();
    window.addEventListener("orders:refresh", handler);
    return () => window.removeEventListener("orders:refresh", handler);
  }, []);

  const tablesMap = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);

  const waiters = useMemo(
    () =>
      employees
        .filter((u) => /официант|waiter/i.test(u.role_display || ""))
        .map((u) => ({ id: u.id, name: fullName(u) })),
    [employees]
  );
  const waitersMap = useMemo(() => new Map(waiters.map((w) => [w.id, w])), [waiters]);

  const menuMap = useMemo(() => {
    const m = new Map();
    menuItems.forEach((mi) =>
      m.set(String(mi.id), {
        title: mi.title,
        price: toNum(mi.price),
        image_url: mi.image_url || "",
      })
    );
    return m;
  }, [menuItems]);

  const menuImageUrl = (id) => {
    const key = String(id ?? "");
    return menuMap.get(key)?.image_url || (menuCacheRef.current.get(key)?.image_url ?? "");
  };

  const busyTableIds = useMemo(() => {
    const set = new Set();
    for (const o of orders) if (isUnpaidStatus(o.status)) set.add(o.table);
    return set;
  }, [orders]);

  const filtered = useMemo(() => {
    const qv = query.trim().toLowerCase();
    const base = (orders || []).filter((o) => isUnpaidStatus(o.status));
    if (!qv) return base;

    return base.filter((o) => {
      const tNum = String(tablesMap.get(o.table)?.number ?? "").toLowerCase();
      const wName = String(waitersMap.get(o.waiter)?.name ?? "").toLowerCase();
      const guests = String(o.guests ?? "").toLowerCase();
      const status = String(o.status ?? "").toLowerCase();
      return tNum.includes(qv) || wName.includes(qv) || guests.includes(qv) || status.includes(qv);
    });
  }, [orders, query, tablesMap, waitersMap]);

  const roleFiltered = useMemo(() => {
    if (userRole === "официант") {
      return filtered.filter((item) => String(item.waiter) === String(userId));
    }
    return filtered;
  }, [filtered, userRole, userId]);

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

  /* ===== печать ===== */
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
        console.error("Print error:", e);
        alert(e?.message || "Не удалось распечатать чек.");
      } finally {
        setPrintingId(null);
      }
    },
    [buildPrintPayload, printingId]
  );

  /* ===== модалка ===== */
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
      const msg = e2?.response?.data
        ? formatApiErrors(e2.response.data)
        : "Не удалось создать клиента";
      alert(msg);
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
    originalTableRef.current = null;
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

    originalTableRef.current = String(order.table ?? "");
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
          items: prev.items.map((i) =>
            String(i.menu_item) === idStr ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          { menu_item: idStr, title: menu.title, price: toNum(menu.price), quantity: 1 },
        ],
      };
    });
  };

  const changeItemQty = (id, nextQty) => {
    const q = Math.max(1, Number(nextQty) || 1);
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        String(i.menu_item) === String(id) ? { ...i, quantity: q } : i
      ),
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
        const basePayload = normalizeOrderPayload(form);
        const res = await postWithWaiterFallback("/cafe/orders/", basePayload, "post");

        try {
          await api.patch(`/cafe/tables/${toId(form.table)}/`, { status: "busy" });
        } catch {}

        setOrders((prev) => [...prev, res.data]);
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
      console.error("Ошибка сохранения заказа:", err);
      const r = err?.response;
      const msg = r?.data ? formatApiErrors(r.data) : err?.message || "Ошибка при сохранении.";
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  /* ===== ОПЛАТА ===== */
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

  const markOrderPaid = async (id) => {
    try {
      await api.post(`/cafe/orders/${id}/pay/`);
      return true;
    } catch {}
    try {
      await api.patch(`/cafe/orders/${id}/`, { status: "paid" });
      return true;
    } catch {}
    try {
      await api.patch(`/cafe/orders/${id}/`, { status: "оплачен" });
      return true;
    } catch {}
    return false;
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

  const confirmPay = async () => {
    if (!payOrder?.id) return;

    setPaying(true);
    try {
      const totals = calcTotals(payOrder);

      await createCashflowIncome(payOrder, totals.total);

      const ok = await markOrderPaid(payOrder.id);
      if (!ok) {
        alert("Не удалось пометить заказ как оплаченный.");
        return;
      }

      setOrders((prev) => (prev || []).filter((x) => String(x.id) !== String(payOrder.id)));

      try {
        window.dispatchEvent(new CustomEvent("orders:refresh"));
      } catch {}

      setPayOpen(false);
      setPayOrder(null);
    } catch (e) {
      console.error("Ошибка оплаты:", e);
      alert(e?.message || "Ошибка при оплате.");
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
    return [
      { value: "", label: "— Без официанта —", search: "без официанта" },
      ...waiters.map((w) => ({ value: String(w.id), label: w.name, search: w.name })),
    ];
  }, [waiters]);

  const clientOptions = useMemo(() => {
    return (clients || []).map((c) => ({
      value: String(c.id),
      label: String(c.full_name || "Без имени").trim() || "Без имени",
      search: `${c.full_name || ""} ${c.phone || ""}`.trim(),
    }));
  }, [clients]);

  return (
    <section className="orders">
      <div className="orders__header">
        <div>
          <h2 className="orders__title">Заказы</h2>
          <div className="orders__subtitle">
            После оплаты заказ исчезает здесь и появляется в кассе как приход.
          </div>
        </div>

        <div className="orders__actions">
          <div className="orders__search">
            <FaSearch className="orders__searchIcon" />
            <input
              className="orders__searchInput"
              placeholder="Поиск: стол, официант, гости, статус…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {userRole === "повара" ? null : (
            <button className="orders__btn orders__btn--primary" onClick={openCreate} type="button">
              <FaPlus /> Новый заказ
            </button>
          )}
        </div>
      </div>

      {!loading && roleFiltered.length > ORDERS_COLLAPSE_LIMIT && (
        <div className="orders__collapseRow">
          <button
            type="button"
            className="orders__btn orders__btn--secondary"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Свернуть" : `Показать все (${roleFiltered.length})`}
          </button>
        </div>
      )}

      <div className="orders__list">
        {loading && <div className="orders__alert">Загрузка…</div>}

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
              <article key={o.id} className="orders__receipt">
                <div className="orders__receiptHeader">
                  <div className="orders__receiptTable">СТОЛ {t?.number || "—"}</div>
                  {orderDate && <div className="orders__receiptDate">{orderDate}</div>}
                </div>

                <div className="orders__receiptDivider" />

                <div className="orders__receiptItems">
                  {sliceItems.map((it, i) => {
                    const itemPrice = linePrice(it);
                    const itemTitle = it.menu_item_title || it.title || "Позиция";
                    const itemQty = Number(it.quantity) || 0;
                    const sum = itemPrice * itemQty;

                    return (
                      <div key={it.id || it.menu_item || i} className="orders__receiptItem">
                        <span className="orders__receiptItemName">{itemTitle}</span>
                        <span className="orders__receiptItemQty">x{itemQty}</span>
                        <span className="orders__receiptItemPrice">{fmtShort(sum)}</span>
                      </div>
                    );
                  })}

                  {!expanded && rest > 0 && (
                    <button
                      type="button"
                      className="orders__moreItemsBtn"
                      onClick={() => toggleExpandedOrder(o.id)}
                    >
                      Ещё {rest} поз.
                    </button>
                  )}

                  {expanded && items.length > CARD_ITEMS_LIMIT && (
                    <button
                      type="button"
                      className="orders__moreItemsBtn"
                      onClick={() => toggleExpandedOrder(o.id)}
                    >
                      Свернуть позиции ({items.length})
                    </button>
                  )}
                </div>

                <div className="orders__receiptFooter">
                  <div className="orders__receiptDivider orders__receiptDivider--dashed" />

                  <div className="orders__receiptTotal">
                    <span className="orders__receiptTotalLabel">ИТОГО</span>
                    <span className="orders__receiptTotalAmount">{fmtShort(totals.total)}</span>
                  </div>

                  {/* ✅ УБРАЛИ "Чек" из карточек. Остаётся только в оплате */}
                  <div className="orders__receiptActions">
                    <button
                      className="orders__btn orders__btn--secondary"
                      onClick={() => openEdit(o)}
                      type="button"
                      disabled={saving || paying || printingId === o.id}
                    >
                      <FaEdit /> Редактировать
                    </button>

                    <button
                      className="orders__btn orders__btn--primary"
                      onClick={() => openPay(o)}
                      type="button"
                      disabled={saving || paying || printingId === o.id}
                    >
                      <FaCheckCircle /> Оплатить
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

        {!loading && !roleFiltered.length && (
          <div className="orders__alert orders__alert--muted">
            Ничего не найдено по «{query}».
          </div>
        )}
      </div>

      {/* Modal create/edit/view */}
      {modalOpen &&
        (userRole === "повара" ? (
          <CookModal />
        ) : userRole === "официант" ? (
          <WaiterModal />
        ) : (
          <div
            className="orders-modal__overlay"
            onClick={() => {
              if (!saving) {
                setModalOpen(false);
                setMenuOpen(false);
                setShowAddClient(false);
                setOpenSelectId(null);
              }
            }}
          >
            <div className="orders-modal__shell" onClick={(e) => e.stopPropagation()}>
              <div className="orders-modal__card">
                <div className="orders-modal__header">
                  <h3 className="orders-modal__title">
                    {isEditing ? "Редактировать заказ" : "Новый заказ"}
                  </h3>
                  <button
                    className="orders-modal__close"
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

                <form className="orders__form" onSubmit={saveForm}>
                  <div className="orders__formGrid">
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

                    <div className="orders__field">
                      <label className="orders__label">Гостей</label>
                      <input
                        type="number"
                        min={0}
                        className="orders__input"
                        value={form.guests}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            guests: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                        disabled={saving}
                      />
                    </div>

                    <div className="orders__field" style={{ gridColumn: "1 / -1" }}>
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
                  <div className="orders__itemsBlock">
                    <div className="orders__clientTopRow">
                      <div className="orders__clientTopLeft">
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

                      <div className="orders__clientTopRight">
                        <button
                          type="button"
                          className="orders__btn orders__btn--secondary"
                          onClick={() => setShowAddClient((v) => !v)}
                          disabled={saving}
                        >
                          <FaPlus /> Добавить
                        </button>
                      </div>
                    </div>

                    {showAddClient && (
                      <div className="orders__clientAdd">
                        <input
                          className="orders__input"
                          placeholder="Имя *"
                          value={newClientName}
                          onChange={(e) => setNewClientName(e.target.value)}
                          disabled={addClientSaving || saving}
                        />
                        <input
                          className="orders__input"
                          placeholder="Телефон"
                          value={newClientPhone}
                          onChange={(e) => setNewClientPhone(e.target.value)}
                          disabled={addClientSaving || saving}
                        />
                        <button
                          type="button"
                          className="orders__btn orders__btn--primary"
                          onClick={handleCreateClient}
                          disabled={addClientSaving || saving}
                        >
                          {addClientSaving ? "Сохранение…" : "Сохранить"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Позиции */}
                  <div className="orders__itemsBlock">
                    <div className="orders__itemsHead">
                      <h4 className="orders__itemsHeadTitle">Позиции заказа</h4>

                      <button
                        type="button"
                        className="orders__btn orders__btn--primary"
                        onClick={() => {
                          setOpenSelectId(null);
                          setMenuOpen(true);
                        }}
                        disabled={saving}
                      >
                        <FaPlus /> Добавить блюда
                      </button>
                    </div>

                    {/* ✅ Никакого красного текста сразу. Если позиций нет — просто пусто */}
                    {form.items.length ? (
                      <div className="orders__itemsList">
                        {form.items.map((it) => {
                          const img = menuImageUrl(it.menu_item);
                          const qty = Math.max(1, Number(it.quantity) || 1);
                          const price = toNum(it.price);
                          const sum = price * qty;

                          return (
                            <div key={it.menu_item} className="orders__itemRow">
                              <div className="orders__itemLeft">
                                <span className="orders__thumb orders__thumb--sm" aria-hidden>
                                  {img ? <img src={img} alt="" /> : <FaClipboardList />}
                                </span>

                                <div className="orders__itemInfo">
                                  <div className="orders__itemTitle" title={it.title}>
                                    {it.title}
                                  </div>
                                  <div className="orders__itemMeta">
                                    <span>{fmtMoney(price)} сом</span>
                                    <span className="orders__dot">•</span>
                                    <span>{fmtMoney(sum)} сом</span>
                                  </div>
                                </div>
                              </div>

                              <div className="orders__itemRight">
                                <div className="orders__qty">
                                  <button
                                    type="button"
                                    className="orders__qtyBtn"
                                    onClick={() => decItem(it.menu_item)}
                                    disabled={saving || qty <= 1}
                                    aria-label="Уменьшить"
                                  >
                                    <FaMinus />
                                  </button>

                                  <input
                                    className="orders__qtyInput"
                                    value={qty}
                                    onChange={(e) => changeItemQty(it.menu_item, e.target.value)}
                                    disabled={saving}
                                    inputMode="numeric"
                                  />

                                  <button
                                    type="button"
                                    className="orders__qtyBtn"
                                    onClick={() => incItem(it.menu_item)}
                                    disabled={saving}
                                    aria-label="Увеличить"
                                  >
                                    <FaPlus />
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  className="orders__btn orders__btn--danger orders__itemRemove"
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

                        <div className="orders__itemsFooter">
                          <div className="orders__itemsTotalLine">
                            <span>Итого</span>
                            <span>
                              {fmtMoney(
                                form.items.reduce(
                                  (s, i) => s + toNum(i.price) * (Number(i.quantity) || 0),
                                  0
                                )
                              )}{" "}
                              сом
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="orders__formActions">
                    <button
                      type="submit"
                      className="orders__btn orders__btn--primary"
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
              />
            </div>
          </div>
        ))}

      {/* Pay modal (чек перед оплатой) */}
      {payOpen && payOrder && (
        <div className="orders-modal__overlay" onClick={closePay}>
          <div className="orders-modal__shell" onClick={(e) => e.stopPropagation()}>
            <div className="orders-modal__card">
              <div className="orders-modal__header">
                <h3 className="orders-modal__title">Чек перед оплатой</h3>
                <button
                  className="orders-modal__close"
                  onClick={closePay}
                  disabled={paying || printingId === payOrder.id}
                  aria-label="Закрыть"
                  type="button"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="orders-pay">
                {(() => {
                  const t = tablesMap.get(payOrder?.table);
                  const dt = formatReceiptDate(payOrder?.created_at || payOrder?.date || payOrder?.created);
                  const items = Array.isArray(payOrder?.items) ? payOrder.items : [];
                  const totals = calcTotals(payOrder);

                  return (
                    <>
                      <div className="orders-pay__top">
                        <div className="orders-pay__table">СТОЛ {t?.number ?? "—"}</div>
                        <div className="orders-pay__date">{dt || ""}</div>
                      </div>

                      <div className="orders-pay__divider" />

                      <div className="orders-pay__list">
                        {items.length ? (
                          items.map((it, idx) => {
                            const title = it.menu_item_title || it.title || "Позиция";
                            const qty = Number(it.quantity) || 0;
                            const price = linePrice(it);
                            const sum = price * qty;

                            return (
                              <div key={it.id || it.menu_item || idx} className="orders-pay__row">
                                <span className="orders-pay__name" title={title}>
                                  {title}
                                </span>
                                <span className="orders-pay__qty">x{qty}</span>
                                <span className="orders-pay__sum">{fmtShort(sum)}</span>
                              </div>
                            );
                          })
                        ) : (
                          <div className="orders-pay__empty">Позиции заказа не найдены.</div>
                        )}
                      </div>

                      <div className="orders-pay__divider orders-pay__divider--dashed" />

                      <div className="orders-pay__total">
                        <span>ИТОГО</span>
                        <span>{fmtShort(totals.total)}</span>
                      </div>
                    </>
                  );
                })()}

                <div className="orders-pay__actions">
                  <button
                    type="button"
                    className="orders__btn orders__btn--secondary"
                    onClick={closePay}
                    disabled={paying || printingId === payOrder.id}
                  >
                    Отмена
                  </button>

                  <button
                    type="button"
                    className="orders__btn orders__btn--secondary"
                    onClick={() => printOrder(payOrder)}
                    disabled={paying || printingId === payOrder.id}
                    title="Распечатать чек"
                  >
                    <FaClipboardList /> {printingId === payOrder.id ? "Печать…" : "Чек"}
                  </button>

                  <button
                    type="button"
                    className="orders__btn orders__btn--primary"
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
