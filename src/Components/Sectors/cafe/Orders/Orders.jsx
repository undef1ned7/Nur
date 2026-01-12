// // src/.../Orders.jsx
// import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
// import {
//   FaSearch,
//   FaPlus,
//   FaTimes,
//   FaClipboardList,
//   FaTrash,
//   FaEdit,
//   FaCheckCircle,
// } from "react-icons/fa";
// import api from "../../../../api";
// import { getAll as getAllClients, createClient } from "../Clients/clientStore";
// import "./Orders.scss";
// import WaiterModal from "./WaiterModal";
// import CookModal from "./CookModal";
// import PrinterSelect from "./PrinterSelect";

// // ВАЖНО: поправь путь под свой проект
// import {
//   printOrderReceiptJSONViaUSB,
//   attachUsbListenersOnce,
//   checkPrinterConnection,
// } from "./OrdersPrintService";
// import { printOrderReceiptJSONViaUSBWithDialog } from "./OrdersPrintService";




// /* ==== helpers ==== */
// const listFrom = (res) => res?.data?.results || res?.data || [];

// const toNum = (x) => {
//   if (x === null || x === undefined) return 0;
//   const n = Number(String(x).replace(",", "."));
//   return Number.isFinite(n) ? n : 0;
// };

// const fmtMoney = (n) =>
//   new Intl.NumberFormat("ru-RU", {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   }).format(toNum(n));

// const fmtShort = (n) => String(Math.round(toNum(n)));

// const numStr = (n) => String(Number(n) || 0).replace(",", ".");

// /* ВАЖНО: «оплачено» учтено */
// const isUnpaidStatus = (s) => {
//   const v = (s || "").toString().toLowerCase();
//   return ![
//     "paid",
//     "оплачен",
//     "оплачено",
//     "canceled",
//     "cancelled",
//     "отменён",
//     "отменен",
//     "closed",
//     "done",
//     "completed",
//   ].includes(v);
// };

// const fullName = (u) =>
//   [u?.last_name || "", u?.first_name || ""].filter(Boolean).join(" ").trim() ||
//   u?.email ||
//   "Без имени";

// const toId = (v) => {
//   if (v === "" || v === undefined || v === null) return null;
//   const s = String(v);
//   return /^\d+$/.test(s) ? Number(s) : s;
// };

// const formatApiErrors = (e) => {
//   if (!e) return "Неизвестная ошибка";
//   if (typeof e === "string") return e;
//   if (Array.isArray(e)) return e.join("; ");
//   try {
//     return Object.entries(e)
//       .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
//       .join("\n");
//   } catch {
//     return JSON.stringify(e, null, 2);
//   }
// };

// const stripEmpty = (obj) =>
//   Object.fromEntries(
//     Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
//   );

// const normalizeOrderPayload = (f) =>
//   stripEmpty({
//     table: toId(f.table),
//     waiter: toId(f.waiter),
//     client: toId(f.client),
//     guests: Math.max(0, Number(f.guests) || 0),
//     items: (f.items || [])
//       .filter((i) => i && i.menu_item && Number(i.quantity) > 0)
//       .map((i) =>
//         stripEmpty({
//           menu_item: toId(i.menu_item),
//           quantity: Math.max(1, Number(i.quantity) || 1),
//         })
//       ),
//   });

// /* normalize staff from /users/employees/ */
// const normalizeEmployee = (e = {}) => ({
//   id: e.id,
//   email: e.email ?? "",
//   first_name: e.first_name ?? "",
//   last_name: e.last_name ?? "",
//   role_display: e.role_display ?? "",
// });

// const safeUserData = () => {
//   try {
//     const raw = localStorage.getItem("userData");
//     return raw ? JSON.parse(raw) : null;
//   } catch {
//     return null;
//   }
// };

// const Orders = () => {
//   // каталоги
//   const [tables, setTables] = useState([]);
//   const [employees, setEmployees] = useState([]);
//   const [menuItems, setMenuItems] = useState([]);
//   const menuCacheRef = useRef(new Map()); // id -> полный объект menu_item (с image_url)
//   const [loading, setLoading] = useState(true);

//   // заказы
//   const [orders, setOrders] = useState([]);

//   // поиск
//   const [query, setQuery] = useState("");

//   // для редактирования
//   const originalItemsRef = useRef([]); // [{menu_item, quantity}]
//   const originalTableRef = useRef(null); // id стола

//   // пользователь
//   const userData = useMemo(() => safeUserData(), []);
//   const userRole = userData?.role || "";
//   const userId = localStorage.getItem("userId");

//   // печать
//   const [printingId, setPrintingId] = useState(null);

//   /* ===== API loaders ===== */
//   const fetchTables = async () => setTables(listFrom(await api.get("/cafe/tables/")));

//   const fetchEmployees = async () => {
//     const arr = listFrom(await api.get("/users/employees/")) || [];
//     setEmployees(arr.map(normalizeEmployee));
//   };

//   const fetchMenu = async () => {
//     const arr = listFrom(await api.get("/cafe/menu-items/")) || [];
//     setMenuItems(arr);
//     for (const m of arr) menuCacheRef.current.set(String(m.id), m);
//   };

//   // если items не пришли в списке — дотянем деталями
//   const hydrateOrdersDetails = async (list) => {
//     const ids = list
//       .filter((o) => !Array.isArray(o.items) || o.items.length === 0)
//       .map((o) => o.id);
//     if (!ids.length) return list;

//     const details = await Promise.all(
//       ids.map((id) =>
//         api
//           .get(`/cafe/orders/${id}/`)
//           .then((r) => ({ id, data: r.data }))
//           .catch(() => null)
//       )
//     );

//     return list.map((o) => {
//       const d = details.find((x) => x && x.id === o.id)?.data;
//       return d ? { ...o, ...d } : o;
//     });
//   };

//   const fetchOrders = async () => {
//     const base = listFrom(await api.get("/cafe/orders/")) || [];
//     const full = await hydrateOrdersDetails(base);
//     setOrders(full);
//   };

//   useEffect(() => {
//     // WebUSB авто-коннект слушатели (безопасно вызвать 1 раз)
//     try {
//       attachUsbListenersOnce();
//     } catch (e) {
//       // тут только диагностика — не спамим
//       console.error("Print init error:", e);
//     }

//     (async () => {
//       try {
//         await Promise.all([fetchTables(), fetchEmployees(), fetchMenu()]);
//         await fetchOrders();
//       } catch (e) {
//         console.error("Ошибка загрузки:", e);
//       } finally {
//         setLoading(false);
//       }
//     })();
//   }, []);

//   // Рефреш по событию от кассы
//   useEffect(() => {
//     const handler = () => {
//       fetchOrders();
//     };
//     window.addEventListener("orders:refresh", handler);
//     return () => window.removeEventListener("orders:refresh", handler);
//   }, []);

//   /* справочники */
//   const tablesMap = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);

//   const waiters = useMemo(
//     () =>
//       employees
//         .filter((u) => /официант|waiter/i.test(u.role_display || ""))
//         .map((u) => ({ id: u.id, name: fullName(u) })),
//     [employees]
//   );

//   const waitersMap = useMemo(() => new Map(waiters.map((w) => [w.id, w])), [waiters]);

//   const menuMap = useMemo(() => {
//     const m = new Map();
//     menuItems.forEach((mi) =>
//       m.set(String(mi.id), {
//         title: mi.title,
//         price: toNum(mi.price),
//         image_url: mi.image_url || "",
//       })
//     );
//     return m;
//   }, [menuItems]);

//   const menuImageUrl = (id) => {
//     const key = String(id ?? "");
//     return menuMap.get(key)?.image_url || (menuCacheRef.current.get(key)?.image_url ?? "");
//   };

//   // занятость столов только по НЕоплаченным
//   const busyTableIds = useMemo(() => {
//     const set = new Set();
//     for (const o of orders) if (isUnpaidStatus(o.status)) set.add(o.table);
//     return set;
//   }, [orders]);

//   // показываем все заказы (и оплаченные тоже)
//   const filtered = useMemo(() => {
//     const q = query.trim().toLowerCase();
//     const base = orders;
//     if (!q) return base;
//     return base.filter((o) => {
//       const tNum = String(tablesMap.get(o.table)?.number ?? "").toLowerCase();
//       const wName = String(waitersMap.get(o.waiter)?.name ?? "").toLowerCase();
//       const guests = String(o.guests ?? "").toLowerCase();
//       const status = String(o.status ?? "").toLowerCase();
//       return tNum.includes(q) || wName.includes(q) || guests.includes(q) || status.includes(q);
//     });
//   }, [orders, query, tablesMap, waitersMap]);

//   const linePrice = (it) => {
//     if (it?.menu_item_price != null) return toNum(it.menu_item_price);
//     if (it?.price != null) return toNum(it.price);
//     const key = String(it?.menu_item ?? "");
//     if (menuMap.has(key)) return toNum(menuMap.get(key).price);
//     return 0;
//   };

//   const calcTotals = (o) => {
//     const items = Array.isArray(o.items) ? o.items : [];
//     const count = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
//     const total = items.reduce((s, it) => s + linePrice(it) * (Number(it.quantity) || 0), 0);
//     return { count, total };
//   };

//   // Форматирование даты для чека
//   const formatReceiptDate = (dateStr) => {
//     if (!dateStr) return "";
//     try {
//       const d = new Date(dateStr);
//       const day = String(d.getDate()).padStart(2, "0");
//       const month = String(d.getMonth() + 1).padStart(2, "0");
//       const year = String(d.getFullYear()).slice(-2);
//       const hours = String(d.getHours()).padStart(2, "0");
//       const minutes = String(d.getMinutes()).padStart(2, "0");
//       return `${day}.${month}.${year} ${hours}:${minutes}`;
//     } catch {
//       return dateStr;
//     }
//   };

//   /* ===== печать чека (JSON → ESC/POS) ===== */
// const buildPrintPayload = useCallback(
//   (order) => {
//     const t = tablesMap.get(order?.table);
//     const dt = formatReceiptDate(order?.created_at || order?.date || order?.created);
//     const cashier = fullName(userData || {});
//     const items = Array.isArray(order?.items) ? order.items : [];

//     return {
//       company: localStorage.getItem("company_name") || "КАССА",
//       // ВАЖНО: убрали UUID полностью
//       doc_no: `СТОЛ ${t?.number ?? "—"}`,
//       created_at: dt,
//       cashier_name: cashier,
//       discount: 0,
//       tax: 0,
//       paid_cash: 0,
//       paid_card: 0,
//       change: 0,
// items: items.map((it) => ({
//   name: String(it.menu_item_title || it.title || "Позиция"),
//   qty: Math.max(1, Number(it.quantity) || 1),
//   price: linePrice(it),
// })),


//     };
//   },
//   [tablesMap, userData]
// );


// const printOrder = useCallback(
//   async (order) => {
//     if (!order?.id) return;
//     if (printingId) return;

//     setPrintingId(order.id);
//     try {
//       await checkPrinterConnection().catch(() => false);

//       const payload = buildPrintPayload(order);
// await printOrderReceiptJSONViaUSBWithDialog(payload);
//     } catch (e) {
//       console.error("Print error:", e);
//       alert(e?.message || "Не удалось распечатать чек.");
//     } finally {
//       setPrintingId(null);
//     }
//   },
//   [buildPrintPayload, printingId, checkPrinterConnection, printOrderReceiptJSONViaUSB]
// );


//   /* ===== модалка создания/редактирования ===== */
//   const [modalOpen, setModalOpen] = useState(false);
//   const [saving, setSaving] = useState(false);
//   const [editingId, setEditingId] = useState(null);
//   const isEditing = editingId != null;

//   const [form, setForm] = useState({
//     table: "",
//     guests: 2,
//     waiter: "",
//     client: "",
//     items: [],
//   });

//   const [addingId, setAddingId] = useState("");
//   const [addingQty, setAddingQty] = useState(1);

//   // ====== КЛИЕНТЫ ======
//   const [clientQ, setClientQ] = useState("");
//   const [clients, setClients] = useState([]);
//   const [clientsLoading, setClientsLoading] = useState(false);
//   const [clientsErr, setClientsErr] = useState("");
//   const [showAddClient, setShowAddClient] = useState(false);
//   const [newClientName, setNewClientName] = useState("");
//   const [newClientPhone, setNewClientPhone] = useState("");
//   const [addClientSaving, setAddClientSaving] = useState(false);

//   useEffect(() => {
//     if (!modalOpen) return;
//     let mounted = true;

//     (async () => {
//       try {
//         setClientsLoading(true);
//         setClientsErr("");
//         const data = await getAllClients();
//         if (mounted) setClients(Array.isArray(data) ? data : []);
//       } catch (e) {
//         console.error("Ошибка загрузки клиентов:", e);
//         if (mounted) setClientsErr("Не удалось загрузить клиентов");
//       } finally {
//         if (mounted) setClientsLoading(false);
//       }
//     })();

//     return () => {
//       mounted = false;
//     };
//   }, [modalOpen]);

//   const filteredClients = useMemo(() => {
//     const s = clientQ.trim().toLowerCase();
//     if (!s) return clients;
//     return clients.filter((c) => `${c.full_name} ${c.phone}`.toLowerCase().includes(s));
//   }, [clients, clientQ]);

//   async function handleCreateClient(e) {
//     e?.preventDefault?.();
//     if (!newClientName.trim()) return;
//     try {
//       setAddClientSaving(true);
//       const c = await createClient({
//         full_name: newClientName.trim(),
//         phone: newClientPhone.trim(),
//         notes: "",
//       });
//       setClients((prev) => [c, ...prev]);
//       setForm((f) => ({ ...f, client: c.id }));
//       setNewClientName("");
//       setNewClientPhone("");
//       setClientQ(c.full_name || c.phone || "");
//       setShowAddClient(false);
//       try {
//         window.dispatchEvent(new CustomEvent("clients:refresh", { detail: { client: c } }));
//       } catch {}
//     } catch (e2) {
//       const msg = e2?.response?.data ? formatApiErrors(e2.response.data) : "Не удалось создать клиента";
//       alert(msg);
//     } finally {
//       setAddClientSaving(false);
//     }
//   }

//   const openCreate = () => {
//     const free = tables.find((t) => !busyTableIds.has(t.id));
//     setForm({
//       table: free?.id ?? "",
//       guests: 2,
//       waiter: "",
//       client: "",
//       items: [],
//     });
//     setAddingId("");
//     setAddingQty(1);
//     originalItemsRef.current = [];
//     originalTableRef.current = null;
//     setEditingId(null);
//     setModalOpen(true);
//   };

//   const openEdit = (order) => {
//     setEditingId(order.id);
//     const itemsNormalized = Array.isArray(order.items)
//       ? order.items.map((it) => ({
//           menu_item: String(it.menu_item || it.id),
//           title: it.menu_item_title || it.title,
//           price: linePrice(it),
//           quantity: Number(it.quantity) || 1,
//         }))
//       : [];
//     setForm({
//       table: String(order.table ?? ""),
//       guests: Number(order.guests) || 0,
//       waiter: order.waiter ? String(order.waiter) : "",
//       client: order.client ? String(order.client) : "",
//       items: itemsNormalized,
//     });
//     originalItemsRef.current = itemsNormalized.map(({ menu_item, quantity }) => ({ menu_item, quantity }));
//     originalTableRef.current = String(order.table ?? "");
//     setAddingId("");
//     setAddingQty(1);
//     setModalOpen(true);
//   };

//   // меню c ингредиентами (кэш)
//   const getMenuWithIngredients = async (id) => {
//     if (!id) return null;
//     const idStr = String(id);
//     if (menuCacheRef.current.has(idStr)) return menuCacheRef.current.get(idStr);
//     const local = menuItems.find((m) => String(m.id) === idStr);
//     if (local) {
//       menuCacheRef.current.set(idStr, local);
//       return local;
//     }
//     const r = await api.get(`/cafe/menu-items/${idStr}/`);
//     const full = r?.data || null;
//     if (full) menuCacheRef.current.set(idStr, full);
//     return full;
//   };

//   // потребность склада по блюдам заказа
//   const buildConsumption = async (orderItems) => {
//     const need = new Map();
//     for (const it of orderItems) {
//       const full = await getMenuWithIngredients(it.menu_item);
//       const recipe = Array.isArray(full?.ingredients) ? full.ingredients : [];
//       for (const r of recipe) {
//         if (!r?.product) continue;
//         const perPortion = toNum(r.amount);
//         const add = perPortion * (Number(it.quantity) || 0);
//         const key = String(r.product);
//         need.set(key, (need.get(key) || 0) + add);
//       }
//     }
//     return need;
//   };

//   const updateWarehouseItem = async (item, nextRem) => {
//     try {
//       await api.patch(`/cafe/warehouse/${item.id}/`, { remainder: numStr(nextRem) });
//     } catch {
//       try {
//         await api.put(`/cafe/warehouse/${item.id}/`, {
//           title: item.title,
//           unit: item.unit,
//           remainder: numStr(nextRem),
//           minimum: numStr(item.minimum),
//         });
//       } catch (e) {
//         console.error("Не удалось обновить остаток:", item?.title || item?.id);
//       }
//     }
//   };

//   const applyWarehouseDelta = async (deltaMap) => {
//     if (!deltaMap || !deltaMap.size) return true;

//     const wr = await api.get("/cafe/warehouse/");
//     const stock = listFrom(wr) || [];
//     const stockMap = new Map(stock.map((s) => [String(s.id), s]));

//     const lacks = [];
//     for (const [pid, delta] of deltaMap.entries()) {
//       if (delta > 0) {
//         const s = stockMap.get(String(pid));
//         const have = toNum(s?.remainder);
//         if (have < delta) lacks.push(`${s?.title || pid}: надо ${delta}, есть ${have}`);
//       }
//     }
//     if (lacks.length) {
//       alert("Недостаточно на складе:\n" + lacks.join("\n"));
//       return false;
//     }

//     await Promise.all(
//       Array.from(deltaMap.entries()).map(async ([pid, delta]) => {
//         const s = stockMap.get(String(pid));
//         const nextRem = Math.max(0, toNum(s?.remainder) - delta);
//         await updateWarehouseItem(s, nextRem);
//       })
//     );

//     return true;
//   };

//   const addItem = () => {
//     if (!addingId) return;
//     const idStr = String(addingId);
//     const menu = menuItems.find((m) => String(m.id) === idStr) || menuCacheRef.current.get(idStr);
//     if (!menu) return;

//     const qty = Math.max(1, Number(addingQty) || 1);

//     setForm((prev) => {
//       const ex = prev.items.find((i) => String(i.menu_item) === idStr);
//       if (ex) {
//         return {
//           ...prev,
//           items: prev.items.map((i) =>
//             String(i.menu_item) === idStr ? { ...i, quantity: i.quantity + qty } : i
//           ),
//         };
//       }
//       return {
//         ...prev,
//         items: [...prev.items, { menu_item: idStr, title: menu.title, price: toNum(menu.price), quantity: qty }],
//       };
//     });

//     setAddingQty(1);
//   };

//   const changeItemQty = (id, qty) => {
//     const q = Math.max(1, Number(qty) || 1);
//     setForm((prev) => ({
//       ...prev,
//       items: prev.items.map((i) => (String(i.menu_item) === String(id) ? { ...i, quantity: q } : i)),
//     }));
//   };

//   const removeItem = (id) => {
//     setForm((prev) => ({ ...prev, items: prev.items.filter((i) => String(i.menu_item) !== String(id)) }));
//   };

//   // POST/PUT/PATCH с фолбэком по waiter
//   const postWithWaiterFallback = async (url, payload, method = "post") => {
//     try {
//       if (method === "post") return await api.post(url, payload);
//       if (method === "patch") return await api.patch(url, payload);
//       if (method === "put") return await api.put(url, payload);
//       throw new Error("Unsupported method");
//     } catch (err) {
//       const r = err?.response;
//       const waiterErrors = r?.status === 400 && r?.data && r.data.waiter;
//       if (waiterErrors) {
//         const payloadNoWaiter = { ...payload };
//         delete payloadNoWaiter.waiter;
//         if (method === "post") return await api.post(url, payloadNoWaiter);
//         if (method === "patch") return await api.patch(url, payloadNoWaiter);
//         if (method === "put") return await api.put(url, payloadNoWaiter);
//       }
//       throw err;
//     }
//   };

// const saveForm = async (e) => {
//   e.preventDefault();
//   if (!form.table || !form.items.length) return;

//   setSaving(true);
//   try {
//     if (!isEditing) {
//       const basePayload = normalizeOrderPayload(form);

//       // СОЗДАНИЕ: без status: "payment" и без склада
//       const res = await postWithWaiterFallback("/cafe/orders/", basePayload, "post");

//       // стол → busy
//       try {
//         await api.patch(`/cafe/tables/${toId(form.table)}/`, { status: "busy" });
//       } catch {
//         try {
//           const cur = tablesMap.get(form.table) || {};
//           await api.put(`/cafe/tables/${toId(form.table)}/`, {
//             number: cur.number,
//             zone: toId(cur.zone?.id || cur.zone),
//             places: cur.places,
//             status: "busy",
//           });
//         } catch {}
//       }

//       setOrders((prev) => [...prev, res.data]);

//       try {
//         window.dispatchEvent(
//           new CustomEvent("clients:order-created", { detail: { order: res.data } })
//         );
//       } catch {}
//     } else {
//       // РЕДАКТИРОВАНИЕ: тоже без склада
//       const payload = normalizeOrderPayload(form);
//       await postWithWaiterFallback(`/cafe/orders/${editingId}/`, payload, "patch");

//       // пересадка на другой стол — статусы
//       const wasTable = originalTableRef.current;
//       if (wasTable && String(wasTable) !== String(form.table)) {
//         try {
//           await api.patch(`/cafe/tables/${toId(form.table)}/`, { status: "busy" });
//         } catch {
//           try {
//             const curNew = tablesMap.get(form.table) || {};
//             await api.put(`/cafe/tables/${toId(form.table)}/`, {
//               number: curNew.number,
//               zone: toId(curNew.zone?.id || curNew.zone),
//               places: curNew.places,
//               status: "busy",
//             });
//           } catch {}
//         }

//         const hasOther = orders.some(
//           (o) =>
//             o.id !== editingId &&
//             isUnpaidStatus(o.status) &&
//             String(o.table) === String(wasTable)
//         );

//         if (!hasOther) {
//           try {
//             await api.patch(`/cafe/tables/${toId(wasTable)}/`, { status: "free" });
//           } catch {
//             try {
//               const curOld = tablesMap.get(wasTable) || {};
//               await api.put(`/cafe/tables/${toId(wasTable)}/`, {
//                 number: curOld.number,
//                 zone: toId(curOld.zone?.id || curOld.zone),
//                 places: curOld.places,
//                 status: "free",
//               });
//             } catch {}
//           }
//         }
//       }
//     }

//     setModalOpen(false);
//     await fetchOrders();
//   } catch (err) {
//     console.error("Ошибка сохранения заказа:", err);
//     const r = err?.response;
//     const msg = r?.data ? formatApiErrors(r.data) : err?.message || "Ошибка при сохранении.";
//     alert(msg);
//   } finally {
//     setSaving(false);
//   }
// };


//   /* ===== ОПЛАТА (без window.confirm) ===== */
//   const [payOpen, setPayOpen] = useState(false);
//   const [paying, setPaying] = useState(false);
//   const [payOrder, setPayOrder] = useState(null);

//   const openPay = (order) => {
//     setPayOrder(order);
//     setPayOpen(true);
//   };

//   const closePay = () => {
//     if (paying) return;
//     setPayOpen(false);
//     setPayOrder(null);
//   };

//   const markOrderPaid = async (id) => {
//     try {
//       await api.post(`/cafe/orders/${id}/pay/`);
//       return true;
//     } catch {}
//     try {
//       await api.patch(`/cafe/orders/${id}/`, { status: "paid" });
//       return true;
//     } catch {}
//     try {
//       await api.patch(`/cafe/orders/${id}/`, { status: "оплачен" });
//       return true;
//     } catch {}
//     try {
//       await api.put(`/cafe/orders/${id}/`, { status: "paid" });
//       return true;
//     } catch {}
//     return false;
//   };

//   const confirmPay = async () => {
//     if (!payOrder?.id) return;

//     setPaying(true);
//     try {
//       const ok = await markOrderPaid(payOrder.id);
//       if (!ok) {
//         alert("Не удалось пометить заказ как оплаченный.");
//         setPaying(false);
//         return;
//       }

//       // Освободить стол, если нет других неоплаченных заказов
//       const hasOther = orders.some(
//         (o) => o.id !== payOrder.id && isUnpaidStatus(o.status) && String(o.table) === String(payOrder.table)
//       );

//       if (!hasOther && payOrder.table) {
//         try {
//           await api.patch(`/cafe/tables/${toId(payOrder.table)}/`, { status: "free" });
//         } catch {
//           try {
//             const cur = tablesMap.get(payOrder.table) || {};
//             await api.put(`/cafe/tables/${toId(payOrder.table)}/`, {
//               number: cur.number,
//               zone: toId(cur.zone?.id || cur.zone),
//               places: cur.places,
//               status: "free",
//             });
//           } catch {}
//         }
//       }

//       await fetchOrders();
//       try {
//         window.dispatchEvent(new CustomEvent("orders:refresh"));
//       } catch {}

//       setPayOpen(false);
//       setPayOrder(null);
//     } catch (e) {
//       console.error("Ошибка оплаты:", e);
//       alert("Ошибка при оплате.");
//     } finally {
//       setPaying(false);
//     }
//   };

//   return (
//     <section className="orders">
//       {/* Header */}
//       <div className="orders__header">
//         <div>
//           <h2 className="orders__title">Заказы</h2>
//           <div className="orders__subtitle">
//             Новые заказы попадают в «Оплата». После оплаты заказ остаётся здесь как архив.
//           </div>
//         </div>


//         <div className="orders__actions">
//           <div className="orders__search">
//             <FaSearch className="orders__searchIcon" />
//             <input
//               className="orders__searchInput"
//               placeholder="Поиск: стол, официант, гости, статус…"
//               value={query}
//               onChange={(e) => setQuery(e.target.value)}
//             />
//           </div>

//           {userRole === "повара" ? null : (
//             <button className="orders__btn orders__btn--primary" onClick={openCreate} type="button">
//               <FaPlus /> Новый заказ
//             </button>
//           )}
//         </div>
//       </div>

//       {/* List */}
//       <div className="orders__list">
//         {loading && <div className="orders__alert">Загрузка…</div>}

//         {!loading &&
//           (userRole === "официант" ? filtered.filter((item) => String(item.waiter) === String(userId)) : filtered).map(
//             (o) => {
//               const t = tablesMap.get(o.table);
//               const totals = calcTotals(o);
//               const isPaid = !isUnpaidStatus(o.status);
//               const orderDate = formatReceiptDate(o.created_at || o.date || o.created);

//               return (
//                 <article key={o.id} className={`orders__receipt ${isPaid ? "orders__receipt--paid" : ""}`}>
//                   <div className="orders__receiptHeader">
//                     <div className="orders__receiptTable">СТОЛ {t?.number || "—"}</div>
//                     {orderDate && <div className="orders__receiptDate">{orderDate}</div>}
//                   </div>

//                   <div className="orders__receiptDivider"></div>

//                   {Array.isArray(o.items) && o.items.length > 0 ? (
//                     <div className="orders__receiptItems">
//                       {o.items.map((it, i) => {
//                         const itemPrice = linePrice(it);
//                         const itemTitle = it.menu_item_title || it.title || "Позиция";
//                         const itemQty = Number(it.quantity) || 0;
//                         const sum = itemPrice * itemQty;

//                         return (
//                           <div key={it.id || it.menu_item || i} className="orders__receiptItem">
//                             <span className="orders__receiptItemName">{itemTitle}</span>
//                             <span className="orders__receiptItemQty">x{itemQty}</span>
//                             {/* в карточке — как на скрине (без ,00) */}
//                             <span className="orders__receiptItemPrice">{fmtShort(sum)}</span>
//                           </div>
//                         );
//                       })}
//                     </div>
//                   ) : (
//                     <div className="orders__receiptItems">
//                       <div className="orders__receiptItem">
//                         <span className="orders__receiptItemName">Нет позиций</span>
//                       </div>
//                     </div>
//                   )}

//                   <div className="orders__receiptDivider orders__receiptDivider--dashed"></div>

//                   <div className="orders__receiptTotal">
//                     <span className="orders__receiptTotalLabel">ИТОГО</span>
//                     <span className="orders__receiptTotalAmount">{fmtShort(totals.total)}</span>
//                   </div>

//                   {isUnpaidStatus(o.status) && (
//                     <div className="orders__receiptActions">
//                       {userRole !== "повара" ? (
//                         <>
//                           <button
//                             className="orders__btn orders__btn--secondary"
//                             onClick={() => openEdit(o)}
//                             type="button"
//                             title="Изменить стол, официанта, гостей и позиции"
//                             disabled={saving || paying || printingId === o.id}
//                           >
//                             <FaEdit /> Редактировать
//                           </button>

//                           <button
//                             className="orders__btn orders__btn--secondary"
//                             onClick={() => printOrder(o)}
//                             type="button"
//                             title="Распечатать чек на ESC/POS"
//                             disabled={saving || paying || printingId === o.id}
//                           >
//                             <FaClipboardList /> {printingId === o.id ? "Печать…" : "Чек"}
//                           </button>

//                           <button
//                             className="orders__btn orders__btn--primary"
//                             onClick={() => openPay(o)}
//                             type="button"
//                             title="Показать чек и оплатить"
//                             disabled={saving || paying || printingId === o.id}
//                           >
//                             <FaCheckCircle /> Оплатить
//                           </button>
//                         </>
//                       ) : (
//                         <button
//                           className="orders__btn orders__btn--secondary"
//                           onClick={() => openEdit(o)}
//                           type="button"
//                           title="Посмотреть заказ"
//                           disabled={saving || paying || printingId === o.id}
//                         >
//                           Посмотреть
//                         </button>
//                       )}
//                     </div>
//                   )}

//                   {isPaid && (
//                     <div className="orders__receiptPaid">
//                       <span className="orders__receiptPaidBadge">Оплачен</span>
//                     </div>
//                   )}
//                 </article>
//               );
//             }
//           )}

//         {!loading && !filtered.length && <div className="orders__alert">Ничего не найдено по «{query}».</div>}
//       </div>

//       {/* Modal create/edit/view */}
//       {modalOpen &&
//         (userRole === "повара" ? (
//           <CookModal
//             saving={saving}
//             setModalOpen={setModalOpen}
//             saveForm={saveForm}
//             form={form}
//             setForm={setForm}
//             isEditing={isEditing}
//             tables={tables}
//             waiters={waiters}
//             busyTableIds={busyTableIds}
//             clientQ={clientQ}
//             setClientQ={setClientQ}
//             showAddClient={showAddClient}
//             setShowAddClient={setShowAddClient}
//             newClientName={newClientName}
//             setNewClientName={setNewClientName}
//             handleCreateClient={handleCreateClient}
//             addClientSaving={addClientSaving}
//             newClientPhone={newClientPhone}
//             setNewClientPhone={setNewClientPhone}
//             clientsErr={clientsErr}
//             clientsLoading={clientsLoading}
//             filteredClients={filteredClients}
//             addingId={addingId}
//             setAddingId={setAddingId}
//             menuItems={menuItems}
//             fmtMoney={fmtMoney}
//             menuImageUrl={menuImageUrl}
//             menuMap={menuMap}
//             addingQty={addingQty}
//             setAddingQty={setAddingQty}
//             addItem={addItem}
//             changeItemQty={changeItemQty}
//             toNum={toNum}
//             removeItem={removeItem}
//           />
//         ) : userRole === "официант" ? (
//           <WaiterModal
//             saving={saving}
//             setModalOpen={setModalOpen}
//             saveForm={saveForm}
//             form={form}
//             setForm={setForm}
//             isEditing={isEditing}
//             tables={tables}
//             waiters={waiters}
//             busyTableIds={busyTableIds}
//             clientQ={clientQ}
//             setClientQ={setClientQ}
//             showAddClient={showAddClient}
//             setShowAddClient={setShowAddClient}
//             newClientName={newClientName}
//             setNewClientName={setNewClientName}
//             handleCreateClient={handleCreateClient}
//             addClientSaving={addClientSaving}
//             newClientPhone={newClientPhone}
//             setNewClientPhone={setNewClientPhone}
//             clientsErr={clientsErr}
//             clientsLoading={clientsLoading}
//             filteredClients={filteredClients}
//             addingId={addingId}
//             setAddingId={setAddingId}
//             menuItems={menuItems}
//             fmtMoney={fmtMoney}
//             menuImageUrl={menuImageUrl}
//             menuMap={menuMap}
//             addingQty={addingQty}
//             setAddingQty={setAddingQty}
//             addItem={addItem}
//             changeItemQty={changeItemQty}
//             toNum={toNum}
//             removeItem={removeItem}
//           />
//         ) : (
//           <div className="orders-modal__overlay" onClick={() => !saving && setModalOpen(false)}>
//             <div className="orders-modal__card" onClick={(e) => e.stopPropagation()}>
//               <div className="orders-modal__header">
//                 <h3 className="orders-modal__title">{isEditing ? "Редактировать заказ" : "Новый заказ"}</h3>
//                 <button
//                   className="orders-modal__close"
//                   onClick={() => !saving && setModalOpen(false)}
//                   disabled={saving}
//                   title={saving ? "Сохранение…" : "Закрыть"}
//                   aria-label="Закрыть"
//                   type="button"
//                 >
//                   <FaTimes />
//                 </button>
//               </div>

//               {/* ... твой текущий админ-форму блок без изменений ... */}
//               <form className="orders__form" onSubmit={saveForm}>
//                 <div className="orders__formGrid">
//                   <div className="orders__field">
//                     <label className="orders__label">Стол</label>
//                     <select
//                       className="orders__input"
//                       value={form.table ?? ""}
//                       onChange={(e) => setForm((f) => ({ ...f, table: e.target.value }))}
//                       required
//                       disabled={saving}
//                     >
//                       {!isEditing && <option value="">— Выберите стол —</option>}
//                       {tables
//                         .filter((t) => !busyTableIds.has(t.id) || String(t.id) === String(form.table))
//                         .map((t) => (
//                           <option key={t.id} value={t.id}>
//                             {`Стол ${t.number}${t.places ? ` • ${t.places} мест` : ""}`}
//                           </option>
//                         ))}
//                     </select>
//                     {busyTableIds.size > 0 && <div className="orders__hint">Занятые столы скрыты до оплаты.</div>}
//                   </div>

//                   <div className="orders__field">
//                     <label className="orders__label">Гостей</label>
//                     <input
//                       type="number"
//                       min={0}
//                       className="orders__input"
//                       value={form.guests}
//                       onChange={(e) =>
//                         setForm((f) => ({ ...f, guests: Math.max(0, Number(e.target.value) || 0) }))
//                       }
//                       disabled={saving}
//                     />
//                   </div>

//                   <div className="orders__field">
//                     <label className="orders__label">Официант</label>
//                     <select
//                       className="orders__input"
//                       value={form.waiter ?? ""}
//                       onChange={(e) => setForm((f) => ({ ...f, waiter: e.target.value }))}
//                       disabled={saving}
//                       title="Если сервер ругается на waiter, оставьте «Без официанта» — заказ сохранится."
//                     >
//                       <option value="">— Без официанта —</option>
//                       {waiters.map((w) => (
//                         <option key={w.id} value={w.id}>
//                           {w.name}
//                         </option>
//                       ))}
//                     </select>
//                   </div>

//                   <div className="orders__field orders__field--full">
//   <div className="orders__subtitle">
//     {isEditing ? "Можно менять стол, состав заказа и кол-во гостей." : null}
//   </div>
// </div>
//                 </div>

//                 {/* Клиент */}
//                 <div className="orders__itemsBlock">
//                   <h4 className="orders__subtitle">Клиент</h4>

//                   <div className="orders__clientRow">
//                     <input
//                       className="orders__input orders__input--grow"
//                       placeholder="Найти клиента по имени или телефону…"
//                       value={clientQ}
//                       onChange={(e) => setClientQ(e.target.value)}
//                       disabled={saving}
//                     />
//                     <button
//                       type="button"
//                       className="orders__btn orders__btn--secondary"
//                       onClick={() => setShowAddClient((v) => !v)}
//                       disabled={saving}
//                     >
//                       + Добавить клиента
//                     </button>
//                   </div>

//                   {showAddClient && (
//                     <div className="orders__clientAdd">
//                       <input
//                         className="orders__input"
//                         placeholder="Имя *"
//                         value={newClientName}
//                         onChange={(e) => setNewClientName(e.target.value)}
//                         onKeyDown={(e) => {
//                           if (e.key === "Enter") {
//                             e.preventDefault();
//                             handleCreateClient(e);
//                           }
//                         }}
//                         required
//                         disabled={addClientSaving || saving}
//                       />
//                       <input
//                         className="orders__input"
//                         placeholder="Телефон"
//                         value={newClientPhone}
//                         onChange={(e) => setNewClientPhone(e.target.value)}
//                         onKeyDown={(e) => {
//                           if (e.key === "Enter") {
//                             e.preventDefault();
//                             handleCreateClient(e);
//                           }
//                         }}
//                         disabled={addClientSaving || saving}
//                       />
//                       <button
//                         type="button"
//                         className="orders__btn orders__btn--primary"
//                         onClick={handleCreateClient}
//                         disabled={addClientSaving || saving}
//                         title={addClientSaving ? "Сохранение…" : "Сохранить клиента"}
//                       >
//                         {addClientSaving ? "Сохранение…" : "Сохранить"}
//                       </button>
//                     </div>
//                   )}

//                   <div className="orders__clientList">
//                     {clientsErr && <div className="orders__clientErr">{clientsErr}</div>}
//                     {clientsLoading ? (
//                       <div className="orders__clientLoading">Загрузка…</div>
//                     ) : filteredClients.length ? (
//                       filteredClients.map((c) => (
//                         <button
//                           key={c.id}
//                           type="button"
//                           onClick={() => setForm((f) => ({ ...f, client: c.id }))}
//                           className={`orders__clientItem ${
//                             String(form.client) === String(c.id) ? "orders__clientItem--active" : ""
//                           }`}
//                           title={c.full_name}
//                           disabled={saving}
//                         >
//                           <span className="orders__clientName">{c.full_name || "—"}</span>
//                           <span className="orders__clientPhone">{c.phone || ""}</span>
//                         </button>
//                       ))
//                     ) : (
//                       <div className="orders__clientLoading">Ничего не найдено</div>
//                     )}
//                   </div>
//                 </div>

//                 {/* Позиции */}
//                 <div className="orders__itemsBlock">
//                   <h4 className="orders__subtitle">Позиции заказа</h4>

//                   <div className="orders__formGrid">
//                     <div className="orders__field">
//                       <label className="orders__label">Позиция меню</label>
//                       <select
//                         className="orders__input"
//                         value={addingId}
//                         onChange={(e) => setAddingId(e.target.value)}
//                         disabled={saving}
//                       >
//                         <option value="">— Выберите позицию —</option>
//                         {menuItems.map((m) => (
//                           <option key={m.id} value={m.id}>
//                             {m.title} — {fmtMoney(m.price)} сом
//                           </option>
//                         ))}
//                       </select>

//                       {addingId && (
//                         <div className="orders__selectPreview">
//                           <span className="orders__thumb orders__thumb--sm" aria-hidden>
//                             {menuImageUrl(addingId) ? <img src={menuImageUrl(addingId)} alt="" /> : <FaClipboardList />}
//                           </span>
//                           <span className="orders__selectPreviewText">
//                             {menuMap.get(String(addingId))?.title || "Позиция меню"}
//                           </span>
//                         </div>
//                       )}
//                     </div>

//                     <div className="orders__field">
//                       <label className="orders__label">Кол-во</label>
//                       <input
//                         type="number"
//                         min={1}
//                         className="orders__input"
//                         value={addingQty}
//                         onChange={(e) => setAddingQty(Math.max(1, Number(e.target.value) || 1))}
//                         disabled={saving}
//                       />
//                     </div>

//                     <div className="orders__field">
//                       <label className="orders__label">&nbsp;</label>
//                       <button
//                         type="button"
//                         className="orders__btn orders__btn--primary"
//                         onClick={addItem}
//                         disabled={!addingId || saving}
//                       >
//                         <FaPlus /> Добавить позицию
//                       </button>
//                     </div>
//                   </div>

//                   {form.items.length ? (
//                     <div className="orders__tableWrap">
//                       <table className="orders__table">
//                         <thead>
//                           <tr>
//                             <th>Блюдо</th>
//                             <th>Цена</th>
//                             <th>Кол-во</th>
//                             <th>Сумма</th>
//                             <th></th>
//                           </tr>
//                         </thead>
//                         <tbody>
//                           {form.items.map((it) => {
//                             const img = menuImageUrl(it.menu_item);
//                             return (
//                               <tr key={it.menu_item}>
//                                 <td>
//                                   <div className="orders__dishCell">
//                                     <span className="orders__thumb orders__thumb--sm" aria-hidden>
//                                       {img ? <img src={img} alt="" /> : <FaClipboardList />}
//                                     </span>
//                                     <span>{it.title}</span>
//                                   </div>
//                                 </td>
//                                 <td>{fmtMoney(it.price)} сом</td>
//                                 <td className="orders__qtyCell">
//                                   <input
//                                     type="number"
//                                     min={1}
//                                     className="orders__input"
//                                     value={it.quantity}
//                                     onChange={(e) => changeItemQty(it.menu_item, e.target.value)}
//                                     disabled={saving}
//                                   />
//                                 </td>
//                                 <td>
//                                   {fmtMoney(toNum(it.price) * (Number(it.quantity) || 0))} сом
//                                 </td>
//                                 <td>
//                                   <button
//                                     type="button"
//                                     className="orders__btn orders__btn--danger"
//                                     onClick={() => removeItem(it.menu_item)}
//                                     title="Удалить позицию"
//                                     disabled={saving}
//                                   >
//                                     <FaTrash />
//                                   </button>
//                                 </td>
//                               </tr>
//                             );
//                           })}
//                         </tbody>
//                         <tfoot>
//                           <tr>
//                             <td colSpan={2}>
//                               <b>Итого</b>
//                             </td>
//                             <td>
//                               <b>{form.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)}</b>
//                             </td>
//                             <td>
//                               <b>
//                                 {fmtMoney(form.items.reduce((s, i) => s + toNum(i.price) * (Number(i.quantity) || 0), 0))} сом
//                               </b>
//                             </td>
//                             <td></td>
//                           </tr>
//                         </tfoot>
//                       </table>
//                     </div>
//                   ) : (
//                     <div className="orders__alert">Добавьте блюдо из меню.</div>
//                   )}
//                 </div>

//                 <div className="orders__formActions">
//                   <button
//                     type="submit"
//                     className="orders__btn orders__btn--primary"
//                     disabled={saving || !form.table || !form.items.length}
//                   >
//                     {saving ? "Сохраняем…" : isEditing ? "Сохранить" : "Добавить"}
//                   </button>
//                 </div>
//               </form>
//             </div>
//           </div>
//         ))}

//       {/* Pay modal (чек) */}
//       {payOpen && payOrder && (
//         <div className="orders-modal__overlay" onClick={closePay}>
//           <div className="orders-modal__card" onClick={(e) => e.stopPropagation()}>
//             <div className="orders-modal__header">
//               <h3 className="orders-modal__title">Чек перед оплатой</h3>
//               <button
//                 className="orders-modal__close"
//                 onClick={closePay}
//                 disabled={paying || printingId === payOrder.id}
//                 title={paying ? "Оплата…" : "Закрыть"}
//                 aria-label="Закрыть"
//                 type="button"
//               >
//                 <FaTimes />
//               </button>
//             </div>

//             {(() => {
//               const t = tablesMap.get(payOrder.table);
//               const totals = calcTotals(payOrder);
//               const orderDate = formatReceiptDate(payOrder.created_at || payOrder.date || payOrder.created);

//               return (
//                 <div className="orders__receipt orders__receipt--preview">
//                   <div className="orders__receiptHeader">
//                     <div className="orders__receiptTable">СТОЛ {t?.number || "—"}</div>
//                     {orderDate && <div className="orders__receiptDate">{orderDate}</div>}
//                   </div>

//                   <div className="orders__receiptDivider"></div>

//                   {Array.isArray(payOrder.items) && payOrder.items.length ? (
//                     <div className="orders__receiptItems">
//                       {payOrder.items.map((it, i) => {
//                         const title = it.menu_item_title || it.title || "Позиция";
//                         const qty = Number(it.quantity) || 0;
//                         const price = linePrice(it);
//                         const sum = price * qty;
//                         return (
//                           <div key={it.id || it.menu_item || i} className="orders__receiptItem">
//                             <span className="orders__receiptItemName">{title}</span>
//                             <span className="orders__receiptItemQty">x{qty}</span>
//                             <span className="orders__receiptItemPrice">{fmtMoney(sum)}</span>
//                           </div>
//                         );
//                       })}
//                     </div>
//                   ) : (
//                     <div className="orders__receiptItems">
//                       <div className="orders__receiptItem">
//                         <span className="orders__receiptItemName">Нет позиций</span>
//                       </div>
//                     </div>
//                   )}

//                   <div className="orders__receiptDivider orders__receiptDivider--dashed"></div>

//                   <div className="orders__receiptTotal">
//                     <span className="orders__receiptTotalLabel">ИТОГО</span>
//                     <span className="orders__receiptTotalAmount">{fmtMoney(totals.total)}</span>
//                   </div>

//                   <div className="orders__formActions" style={{ marginTop: 14 }}>
//                     <button
//                       type="button"
//                       className="orders__btn orders__btn--secondary"
//                       onClick={closePay}
//                       disabled={paying || printingId === payOrder.id}
//                     >
//                       Отмена
//                     </button>

//                     <button
//                       type="button"
//                       className="orders__btn orders__btn--secondary"
//                       onClick={() => printOrder(payOrder)}
//                       disabled={paying || printingId === payOrder.id}
//                       title="Печать чека на принтер"
//                     >
//                       <FaClipboardList /> {printingId === payOrder.id ? "Печать…" : "Чек"}
//                     </button>

//                     <button
//                       type="button"
//                       className="orders__btn orders__btn--primary"
//                       onClick={confirmPay}
//                       disabled={paying || printingId === payOrder.id}
//                       title={paying ? "Оплата…" : "Оплатить"}
//                     >
//                       {paying ? "Оплата…" : "Оплатить"}
//                     </button>
//                   </div>
//                 </div>
//               );
//             })()}
//           </div>
//         </div>
//       )}
//     </section>
//   );
// };

// export default Orders;



// src/.../Orders.jsx
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  FaSearch,
  FaPlus,
  FaTimes,
  FaClipboardList,
  FaTrash,
  FaEdit,
  FaCheckCircle,
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

/* НЕОПЛАЧЕН = любой, КРОМЕ paid / отменён / закрыт */
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
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ""));

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

const Orders = () => {
  // каталоги
  const [tables, setTables] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const menuCacheRef = useRef(new Map());
  const [loading, setLoading] = useState(true);

  // кассы (всегда первая)
  const [cashboxes, setCashboxes] = useState([]);
  const [cashboxId, setCashboxId] = useState("");

  // заказы
  const [orders, setOrders] = useState([]);

  // поиск
  const [query, setQuery] = useState("");

  // для редактирования
  const originalTableRef = useRef(null);

  // пользователь
  const userData = useMemo(() => safeUserData(), []);
  const userRole = userData?.role || "";
  const userId = localStorage.getItem("userId");

  // печать
  const [printingId, setPrintingId] = useState(null);

  /* ===== API loaders ===== */
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
    const handler = () => {
      fetchOrders();
    };
    window.addEventListener("orders:refresh", handler);
    return () => window.removeEventListener("orders:refresh", handler);
  }, []);

  /* справочники */
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

  // занятость столов только по НЕоплаченным
  const busyTableIds = useMemo(() => {
    const set = new Set();
    for (const o of orders) if (isUnpaidStatus(o.status)) set.add(o.table);
    return set;
  }, [orders]);

  // ПОКАЗЫВАЕМ ТОЛЬКО НЕОПЛАЧЕННЫЕ (после оплаты исчезают отсюда)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = (orders || []).filter((o) => isUnpaidStatus(o.status));
    if (!q) return base;

    return base.filter((o) => {
      const tNum = String(tablesMap.get(o.table)?.number ?? "").toLowerCase();
      const wName = String(waitersMap.get(o.waiter)?.name ?? "").toLowerCase();
      const guests = String(o.guests ?? "").toLowerCase();
      const status = String(o.status ?? "").toLowerCase();
      return tNum.includes(q) || wName.includes(q) || guests.includes(q) || status.includes(q);
    });
  }, [orders, query, tablesMap, waitersMap]);

  const linePrice = (it) => {
    if (it?.menu_item_price != null) return toNum(it.menu_item_price);
    if (it?.price != null) return toNum(it.price);
    const key = String(it?.menu_item ?? "");
    if (menuMap.has(key)) return toNum(menuMap.get(key).price);
    return 0;
  };

  const calcTotals = (o) => {
    const items = Array.isArray(o.items) ? o.items : [];
    const count = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    const total = items.reduce((s, it) => s + linePrice(it) * (Number(it.quantity) || 0), 0);
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

  /* ===== печать чека ===== */
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

  /* ===== модалка создания/редактирования ===== */
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

  const [addingId, setAddingId] = useState("");
  const [addingQty, setAddingQty] = useState(1);

  // ====== КЛИЕНТЫ ======
  const [clientQ, setClientQ] = useState("");
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

  const filteredClients = useMemo(() => {
    const s = clientQ.trim().toLowerCase();
    if (!s) return clients;
    return clients.filter((c) => `${c.full_name} ${c.phone}`.toLowerCase().includes(s));
  }, [clients, clientQ]);

  async function handleCreateClient(e) {
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
      setForm((f) => ({ ...f, client: c.id }));
      setNewClientName("");
      setNewClientPhone("");
      setClientQ(c.full_name || c.phone || "");
      setShowAddClient(false);
      try {
        window.dispatchEvent(new CustomEvent("clients:refresh", { detail: { client: c } }));
      } catch {}
    } catch (e2) {
      const msg = e2?.response?.data ? formatApiErrors(e2.response.data) : "Не удалось создать клиента";
      alert(msg);
    } finally {
      setAddClientSaving(false);
    }
  }

  const openCreate = () => {
    const free = tables.find((t) => !busyTableIds.has(t.id));
    setForm({
      table: free?.id ?? "",
      guests: 2,
      waiter: "",
      client: "",
      items: [],
    });
    setAddingId("");
    setAddingQty(1);
    originalTableRef.current = null;
    setEditingId(null);
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
    setAddingId("");
    setAddingQty(1);
    setModalOpen(true);
  };

  const addItem = () => {
    if (!addingId) return;
    const idStr = String(addingId);
    const menu = menuItems.find((m) => String(m.id) === idStr) || menuCacheRef.current.get(idStr);
    if (!menu) return;

    const qty = Math.max(1, Number(addingQty) || 1);

    setForm((prev) => {
      const ex = prev.items.find((i) => String(i.menu_item) === idStr);
      if (ex) {
        return {
          ...prev,
          items: prev.items.map((i) =>
            String(i.menu_item) === idStr ? { ...i, quantity: i.quantity + qty } : i
          ),
        };
      }
      return {
        ...prev,
        items: [...prev.items, { menu_item: idStr, title: menu.title, price: toNum(menu.price), quantity: qty }],
      };
    });

    setAddingQty(1);
  };

  const changeItemQty = (id, qty) => {
    const q = Math.max(1, Number(qty) || 1);
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((i) => (String(i.menu_item) === String(id) ? { ...i, quantity: q } : i)),
    }));
  };

  const removeItem = (id) => {
    setForm((prev) => ({ ...prev, items: prev.items.filter((i) => String(i.menu_item) !== String(id)) }));
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
        } catch {
          try {
            const cur = tablesMap.get(form.table) || {};
            await api.put(`/cafe/tables/${toId(form.table)}/`, {
              number: cur.number,
              zone: toId(cur.zone?.id || cur.zone),
              places: cur.places,
              status: "busy",
            });
          } catch {}
        }

        setOrders((prev) => [...prev, res.data]);

        try {
          window.dispatchEvent(new CustomEvent("clients:order-created", { detail: { order: res.data } }));
        } catch {}
      } else {
        const payload = normalizeOrderPayload(form);
        await postWithWaiterFallback(`/cafe/orders/${editingId}/`, payload, "patch");

        const wasTable = originalTableRef.current;
        if (wasTable && String(wasTable) !== String(form.table)) {
          try {
            await api.patch(`/cafe/tables/${toId(form.table)}/`, { status: "busy" });
          } catch {
            try {
              const curNew = tablesMap.get(form.table) || {};
              await api.put(`/cafe/tables/${toId(form.table)}/`, {
                number: curNew.number,
                zone: toId(curNew.zone?.id || curNew.zone),
                places: curNew.places,
                status: "busy",
              });
            } catch {}
          }

          const hasOther = orders.some(
            (o) => o.id !== editingId && isUnpaidStatus(o.status) && String(o.table) === String(wasTable)
          );

          if (!hasOther) {
            try {
              await api.patch(`/cafe/tables/${toId(wasTable)}/`, { status: "free" });
            } catch {
              try {
                const curOld = tablesMap.get(wasTable) || {};
                await api.put(`/cafe/tables/${toId(wasTable)}/`, {
                  number: curOld.number,
                  zone: toId(curOld.zone?.id || curOld.zone),
                  places: curOld.places,
                  status: "free",
                });
              } catch {}
            }
          }
        }
      }

      setModalOpen(false);
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

  /* ===== ОПЛАТА (без window.confirm) ===== */
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
    try {
      await api.put(`/cafe/orders/${id}/`, { status: "paid" });
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

  const tryRollbackCashflow = async (cashflowData) => {
    const id = cashflowData?.id || cashflowData?.uuid;
    if (!id) return;
    try {
      await api.delete(`/construction/cashflows/${id}/`);
    } catch {}
  };

  const confirmPay = async () => {
    if (!payOrder?.id) return;

    setPaying(true);
    let cashflowData = null;

    try {
      const totals = calcTotals(payOrder);

      // 1) приход в кассу (всегда в первую кассу)
      cashflowData = await createCashflowIncome(payOrder, totals.total);

      // 2) пометить заказ оплаченным
      const ok = await markOrderPaid(payOrder.id);
      if (!ok) {
        await tryRollbackCashflow(cashflowData);
        alert("Не удалось пометить заказ как оплаченный.");
        return;
      }

      // 3) освободить стол, если нет других неоплаченных
      const hasOther = orders.some(
        (o) => o.id !== payOrder.id && isUnpaidStatus(o.status) && String(o.table) === String(payOrder.table)
      );

      if (!hasOther && payOrder.table) {
        try {
          await api.patch(`/cafe/tables/${toId(payOrder.table)}/`, { status: "free" });
        } catch {
          try {
            const cur = tablesMap.get(payOrder.table) || {};
            await api.put(`/cafe/tables/${toId(payOrder.table)}/`, {
              number: cur.number,
              zone: toId(cur.zone?.id || cur.zone),
              places: cur.places,
              status: "free",
            });
          } catch {}
        }
      }

      // 4) убрать заказ из списка СРАЗУ
      setOrders((prev) => (prev || []).filter((x) => String(x.id) !== String(payOrder.id)));

      // 5) если бэк поддерживает удаление — удалим (молча)
      try {
        await api.delete(`/cafe/orders/${payOrder.id}/`);
      } catch {}

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

  return (
    <section className="orders">
      {/* Header */}
      <div className="orders__header">
        <div>
          <h2 className="orders__title">Заказы</h2>
          <div className="orders__subtitle">
            После оплаты заказ исчезает отсюда и появляется в кассе (приход).
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

      {/* List */}
      <div className="orders__list">
        {loading && <div className="orders__alert">Загрузка…</div>}

        {!loading &&
          (userRole === "официант" ? filtered.filter((item) => String(item.waiter) === String(userId)) : filtered).map(
            (o) => {
              const t = tablesMap.get(o.table);
              const totals = calcTotals(o);
              const orderDate = formatReceiptDate(o.created_at || o.date || o.created);

              return (
                <article key={o.id} className="orders__receipt">
                  <div className="orders__receiptHeader">
                    <div className="orders__receiptTable">СТОЛ {t?.number || "—"}</div>
                    {orderDate && <div className="orders__receiptDate">{orderDate}</div>}
                  </div>

                  <div className="orders__receiptDivider"></div>

                  {Array.isArray(o.items) && o.items.length > 0 ? (
                    <div className="orders__receiptItems">
                      {o.items.map((it, i) => {
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
                    </div>
                  ) : (
                    <div className="orders__receiptItems">
                      <div className="orders__receiptItem">
                        <span className="orders__receiptItemName">Нет позиций</span>
                      </div>
                    </div>
                  )}

                  <div className="orders__receiptDivider orders__receiptDivider--dashed"></div>

                  <div className="orders__receiptTotal">
                    <span className="orders__receiptTotalLabel">ИТОГО</span>
                    <span className="orders__receiptTotalAmount">{fmtShort(totals.total)}</span>
                  </div>

                  <div className="orders__receiptActions">
                    {userRole !== "повара" ? (
                      <>
                        <button
                          className="orders__btn orders__btn--secondary"
                          onClick={() => openEdit(o)}
                          type="button"
                          title="Изменить стол, официанта, гостей и позиции"
                          disabled={saving || paying || printingId === o.id}
                        >
                          <FaEdit /> Редактировать
                        </button>

                        <button
                          className="orders__btn orders__btn--secondary"
                          onClick={() => printOrder(o)}
                          type="button"
                          title="Распечатать чек на ESC/POS"
                          disabled={saving || paying || printingId === o.id}
                        >
                          <FaClipboardList /> {printingId === o.id ? "Печать…" : "Чек"}
                        </button>

                        <button
                          className="orders__btn orders__btn--primary"
                          onClick={() => openPay(o)}
                          type="button"
                          title="Показать чек и оплатить"
                          disabled={saving || paying || printingId === o.id}
                        >
                          <FaCheckCircle /> Оплатить
                        </button>
                      </>
                    ) : (
                      <button
                        className="orders__btn orders__btn--secondary"
                        onClick={() => openEdit(o)}
                        type="button"
                        title="Посмотреть заказ"
                        disabled={saving || paying || printingId === o.id}
                      >
                        Посмотреть
                      </button>
                    )}
                  </div>
                </article>
              );
            }
          )}

        {!loading && !filtered.length && <div className="orders__alert">Ничего не найдено по «{query}».</div>}
      </div>

      {/* Modal create/edit/view */}
      {modalOpen &&
        (userRole === "повара" ? (
          <CookModal
            saving={saving}
            setModalOpen={setModalOpen}
            saveForm={saveForm}
            form={form}
            setForm={setForm}
            isEditing={isEditing}
            tables={tables}
            waiters={waiters}
            busyTableIds={busyTableIds}
            clientQ={clientQ}
            setClientQ={setClientQ}
            showAddClient={showAddClient}
            setShowAddClient={setShowAddClient}
            newClientName={newClientName}
            setNewClientName={setNewClientName}
            handleCreateClient={handleCreateClient}
            addClientSaving={addClientSaving}
            newClientPhone={newClientPhone}
            setNewClientPhone={setNewClientPhone}
            clientsErr={clientsErr}
            clientsLoading={clientsLoading}
            filteredClients={filteredClients}
            addingId={addingId}
            setAddingId={setAddingId}
            menuItems={menuItems}
            fmtMoney={fmtMoney}
            menuImageUrl={menuImageUrl}
            menuMap={menuMap}
            addingQty={addingQty}
            setAddingQty={setAddingQty}
            addItem={addItem}
            changeItemQty={changeItemQty}
            toNum={toNum}
            removeItem={removeItem}
          />
        ) : userRole === "официант" ? (
          <WaiterModal
            saving={saving}
            setModalOpen={setModalOpen}
            saveForm={saveForm}
            form={form}
            setForm={setForm}
            isEditing={isEditing}
            tables={tables}
            waiters={waiters}
            busyTableIds={busyTableIds}
            clientQ={clientQ}
            setClientQ={setClientQ}
            showAddClient={showAddClient}
            setShowAddClient={setShowAddClient}
            newClientName={newClientName}
            setNewClientName={setNewClientName}
            handleCreateClient={handleCreateClient}
            addClientSaving={addClientSaving}
            newClientPhone={newClientPhone}
            setNewClientPhone={setNewClientPhone}
            clientsErr={clientsErr}
            clientsLoading={clientsLoading}
            filteredClients={filteredClients}
            addingId={addingId}
            setAddingId={setAddingId}
            menuItems={menuItems}
            fmtMoney={fmtMoney}
            menuImageUrl={menuImageUrl}
            menuMap={menuMap}
            addingQty={addingQty}
            setAddingQty={setAddingQty}
            addItem={addItem}
            changeItemQty={changeItemQty}
            toNum={toNum}
            removeItem={removeItem}
          />
        ) : (
          <div className="orders-modal__overlay" onClick={() => !saving && setModalOpen(false)}>
            <div className="orders-modal__card" onClick={(e) => e.stopPropagation()}>
              <div className="orders-modal__header">
                <h3 className="orders-modal__title">{isEditing ? "Редактировать заказ" : "Новый заказ"}</h3>
                <button
                  className="orders-modal__close"
                  onClick={() => !saving && setModalOpen(false)}
                  disabled={saving}
                  title={saving ? "Сохранение…" : "Закрыть"}
                  aria-label="Закрыть"
                  type="button"
                >
                  <FaTimes />
                </button>
              </div>

              <form className="orders__form" onSubmit={saveForm}>
                <div className="orders__formGrid">
                  <div className="orders__field">
                    <label className="orders__label">Стол</label>
                    <select
                      className="orders__input"
                      value={form.table ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, table: e.target.value }))}
                      required
                      disabled={saving}
                    >
                      {!isEditing && <option value="">— Выберите стол —</option>}
                      {tables
                        .filter((t) => !busyTableIds.has(t.id) || String(t.id) === String(form.table))
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {`Стол ${t.number}${t.places ? ` • ${t.places} мест` : ""}`}
                          </option>
                        ))}
                    </select>
                    {busyTableIds.size > 0 && <div className="orders__hint">Занятые столы скрыты до оплаты.</div>}
                  </div>

                  <div className="orders__field">
                    <label className="orders__label">Гостей</label>
                    <input
                      type="number"
                      min={0}
                      className="orders__input"
                      value={form.guests}
                      onChange={(e) => setForm((f) => ({ ...f, guests: Math.max(0, Number(e.target.value) || 0) }))}
                      disabled={saving}
                    />
                  </div>

                  <div className="orders__field">
                    <label className="orders__label">Официант</label>
                    <select
                      className="orders__input"
                      value={form.waiter ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, waiter: e.target.value }))}
                      disabled={saving}
                      title="Если сервер ругается на waiter, оставьте «Без официанта» — заказ сохранится."
                    >
                      <option value="">— Без официанта —</option>
                      {waiters.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="orders__field orders__field--full">
                    <div className="orders__subtitle">{isEditing ? "Можно менять стол, состав заказа и кол-во гостей." : null}</div>
                  </div>
                </div>

                {/* Клиент */}
                <div className="orders__itemsBlock">
                  <h4 className="orders__subtitle">Клиент</h4>

                  <div className="orders__clientRow">
                    <input
                      className="orders__input orders__input--grow"
                      placeholder="Найти клиента по имени или телефону…"
                      value={clientQ}
                      onChange={(e) => setClientQ(e.target.value)}
                      disabled={saving}
                    />
                    <button
                      type="button"
                      className="orders__btn orders__btn--secondary"
                      onClick={() => setShowAddClient((v) => !v)}
                      disabled={saving}
                    >
                      + Добавить клиента
                    </button>
                  </div>

                  {showAddClient && (
                    <div className="orders__clientAdd">
                      <input
                        className="orders__input"
                        placeholder="Имя *"
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleCreateClient(e);
                          }
                        }}
                        required
                        disabled={addClientSaving || saving}
                      />
                      <input
                        className="orders__input"
                        placeholder="Телефон"
                        value={newClientPhone}
                        onChange={(e) => setNewClientPhone(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleCreateClient(e);
                          }
                        }}
                        disabled={addClientSaving || saving}
                      />
                      <button
                        type="button"
                        className="orders__btn orders__btn--primary"
                        onClick={handleCreateClient}
                        disabled={addClientSaving || saving}
                        title={addClientSaving ? "Сохранение…" : "Сохранить клиента"}
                      >
                        {addClientSaving ? "Сохранение…" : "Сохранить"}
                      </button>
                    </div>
                  )}

                  <div className="orders__clientList">
                    {clientsErr && <div className="orders__clientErr">{clientsErr}</div>}
                    {clientsLoading ? (
                      <div className="orders__clientLoading">Загрузка…</div>
                    ) : filteredClients.length ? (
                      filteredClients.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, client: c.id }))}
                          className={`orders__clientItem ${
                            String(form.client) === String(c.id) ? "orders__clientItem--active" : ""
                          }`}
                          title={c.full_name}
                          disabled={saving}
                        >
                          <span className="orders__clientName">{c.full_name || "—"}</span>
                          <span className="orders__clientPhone">{c.phone || ""}</span>
                        </button>
                      ))
                    ) : (
                      <div className="orders__clientLoading">Ничего не найдено</div>
                    )}
                  </div>
                </div>

                {/* Позиции */}
                <div className="orders__itemsBlock">
                  <h4 className="orders__subtitle">Позиции заказа</h4>

                  <div className="orders__formGrid">
                    <div className="orders__field">
                      <label className="orders__label">Позиция меню</label>
                      <select
                        className="orders__input"
                        value={addingId}
                        onChange={(e) => setAddingId(e.target.value)}
                        disabled={saving}
                      >
                        <option value="">— Выберите позицию —</option>
                        {menuItems.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.title} — {fmtMoney(m.price)} сом
                          </option>
                        ))}
                      </select>

                      {addingId && (
                        <div className="orders__selectPreview">
                          <span className="orders__thumb orders__thumb--sm" aria-hidden>
                            {menuImageUrl(addingId) ? <img src={menuImageUrl(addingId)} alt="" /> : <FaClipboardList />}
                          </span>
                          <span className="orders__selectPreviewText">
                            {menuMap.get(String(addingId))?.title || "Позиция меню"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="orders__field">
                      <label className="orders__label">Кол-во</label>
                      <input
                        type="number"
                        min={1}
                        className="orders__input"
                        value={addingQty}
                        onChange={(e) => setAddingQty(Math.max(1, Number(e.target.value) || 1))}
                        disabled={saving}
                      />
                    </div>

                    <div className="orders__field">
                      <label className="orders__label">&nbsp;</label>
                      <button type="button" className="orders__btn orders__btn--primary" onClick={addItem} disabled={!addingId || saving}>
                        <FaPlus /> Добавить позицию
                      </button>
                    </div>
                  </div>

                  {form.items.length ? (
                    <div className="orders__tableWrap">
                      <table className="orders__table">
                        <thead>
                          <tr>
                            <th>Блюдо</th>
                            <th>Цена</th>
                            <th>Кол-во</th>
                            <th>Сумма</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.items.map((it) => {
                            const img = menuImageUrl(it.menu_item);
                            return (
                              <tr key={it.menu_item}>
                                <td>
                                  <div className="orders__dishCell">
                                    <span className="orders__thumb orders__thumb--sm" aria-hidden>
                                      {img ? <img src={img} alt="" /> : <FaClipboardList />}
                                    </span>
                                    <span>{it.title}</span>
                                  </div>
                                </td>
                                <td>{fmtMoney(it.price)} сом</td>
                                <td className="orders__qtyCell">
                                  <input
                                    type="number"
                                    min={1}
                                    className="orders__input"
                                    value={it.quantity}
                                    onChange={(e) => changeItemQty(it.menu_item, e.target.value)}
                                    disabled={saving}
                                  />
                                </td>
                                <td>{fmtMoney(toNum(it.price) * (Number(it.quantity) || 0))} сом</td>
                                <td>
                                  <button
                                    type="button"
                                    className="orders__btn orders__btn--danger"
                                    onClick={() => removeItem(it.menu_item)}
                                    title="Удалить позицию"
                                    disabled={saving}
                                  >
                                    <FaTrash />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={2}>
                              <b>Итого</b>
                            </td>
                            <td>
                              <b>{form.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)}</b>
                            </td>
                            <td>
                              <b>{fmtMoney(form.items.reduce((s, i) => s + toNum(i.price) * (Number(i.quantity) || 0), 0))} сом</b>
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="orders__alert">Добавьте блюдо из меню.</div>
                  )}
                </div>

                <div className="orders__formActions">
                  <button type="submit" className="orders__btn orders__btn--primary" disabled={saving || !form.table || !form.items.length}>
                    {saving ? "Сохраняем…" : isEditing ? "Сохранить" : "Добавить"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ))}

      {/* Pay modal (чек) */}
      {payOpen && payOrder && (
        <div className="orders-modal__overlay" onClick={closePay}>
          <div className="orders-modal__card" onClick={(e) => e.stopPropagation()}>
            <div className="orders-modal__header">
              <h3 className="orders-modal__title">Чек перед оплатой</h3>
              <button
                className="orders-modal__close"
                onClick={closePay}
                disabled={paying || printingId === payOrder.id}
                title={paying ? "Оплата…" : "Закрыть"}
                aria-label="Закрыть"
                type="button"
              >
                <FaTimes />
              </button>
            </div>

            {(!cashboxId && !cashboxes.length) && (
              <div className="orders__alert" style={{ margin: "12px 0" }}>
                Нет кассы. Создайте кассу в разделе «Кассы».
              </div>
            )}

            {(() => {
              const t = tablesMap.get(payOrder.table);
              const totals = calcTotals(payOrder);
              const orderDate = formatReceiptDate(payOrder.created_at || payOrder.date || payOrder.created);

              return (
                <div className="orders__receipt orders__receipt--preview">
                  <div className="orders__receiptHeader">
                    <div className="orders__receiptTable">СТОЛ {t?.number || "—"}</div>
                    {orderDate && <div className="orders__receiptDate">{orderDate}</div>}
                  </div>

                  <div className="orders__receiptDivider"></div>

                  {Array.isArray(payOrder.items) && payOrder.items.length ? (
                    <div className="orders__receiptItems">
                      {payOrder.items.map((it, i) => {
                        const title = it.menu_item_title || it.title || "Позиция";
                        const qty = Number(it.quantity) || 0;
                        const price = linePrice(it);
                        const sum = price * qty;
                        return (
                          <div key={it.id || it.menu_item || i} className="orders__receiptItem">
                            <span className="orders__receiptItemName">{title}</span>
                            <span className="orders__receiptItemQty">x{qty}</span>
                            <span className="orders__receiptItemPrice">{fmtMoney(sum)}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="orders__receiptItems">
                      <div className="orders__receiptItem">
                        <span className="orders__receiptItemName">Нет позиций</span>
                      </div>
                    </div>
                  )}

                  <div className="orders__receiptDivider orders__receiptDivider--dashed"></div>

                  <div className="orders__receiptTotal">
                    <span className="orders__receiptTotalLabel">ИТОГО</span>
                    <span className="orders__receiptTotalAmount">{fmtMoney(totals.total)}</span>
                  </div>

                  <div className="orders__formActions" style={{ marginTop: 14 }}>
                    <button type="button" className="orders__btn orders__btn--secondary" onClick={closePay} disabled={paying || printingId === payOrder.id}>
                      Отмена
                    </button>

                    <button
                      type="button"
                      className="orders__btn orders__btn--secondary"
                      onClick={() => printOrder(payOrder)}
                      disabled={paying || printingId === payOrder.id}
                      title="Печать чека на принтер"
                    >
                      <FaClipboardList /> {printingId === payOrder.id ? "Печать…" : "Чек"}
                    </button>

                    <button
                      type="button"
                      className="orders__btn orders__btn--primary"
                      onClick={confirmPay}
                      disabled={paying || printingId === payOrder.id || (!cashboxId && !cashboxes.length)}
                      title={paying ? "Оплата…" : "Оплатить (создать приход в кассу)"}
                    >
                      {paying ? "Оплата…" : "Оплатить"}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </section>
  );
};

export default Orders;
