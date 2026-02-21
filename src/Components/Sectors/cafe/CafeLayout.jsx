import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useCafeWebSocketManager } from '../../../hooks/useCafeWebSocket'
import NotificationCafeSound from '../../common/Notification/NotificationCafeSound'
import { useUser } from '../../../store/slices/userSlice'
import api from '../../../api'
import { checkPrinterConnection, parsePrinterBinding, printOrderReceiptJSONViaUSB, printViaWiFiSimple, setActivePrinterByKey } from './Orders/OrdersPrintService'

export default function CafeLayout() {
    const { orders, tables } = useCafeWebSocketManager();
    const [notificationDeps, setNotificationDeps] = useState(null);
    const [notificationOrder, setNotificationOrder] = useState(null)
    const [notificationOptions, setNotificationOptions] = useState(null);
    const { profile } = useUser();
    const location = useLocation();
    const notifiedTasksRef = useRef(new Set()); // taskKey -> notified once on this device

    const printedOrdersRef = useRef(new Set()); // orderId -> printed successfully once on this device
    const printingOrdersRef = useRef(new Set()); // orderId -> currently printing (avoid parallel)
    const printedReceiptsRef = useRef(new Set()); // orderId -> cashier receipt printed once on this device
    const printingReceiptsRef = useRef(new Set()); // orderId -> cashier receipt printing now
    const printingKitchenDiffRef = useRef(new Set()); // orderId -> diff printing now
    const retryTimersRef = useRef(new Map()); // orderId -> timeoutId
    const notifiedOrdersRef = useRef(new Set()); // orderId -> notified once on this device (cook page)
    const kitchensCacheRef = useRef(null); // Map(kitchenId -> kitchen)
    const menuKitchenCacheRef = useRef(new Map()); // menuItemId -> kitchenId
    const bridgeHealthRef = useRef({ checkedAt: 0, ok: null }); // cache health
    const POLL_RECENT_ORDERS_MS = 15 * 1000; // 15 sec — fallback when order created from another device (e.g. phone)
    const RECENT_ORDER_AGE_MS = 3 * 60 * 1000; // consider orders from last 3 minutes for auto-print
    const KITCHEN_PRINT_LOCK_TTL_MS = 30 * 1000;
    const RECEIPT_PRINT_LOCK_TTL_MS = 30 * 1000;
    const TAKEAWAY_LABEL = "С собой";
    const UUID_RE =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const isAutoKitchenPrintEnabled = useMemo(() => {
        try {
            return localStorage.getItem("cafe_auto_kitchen_print") === "true";
        } catch {
            return false;
        }
    }, []);

    const shouldAutoPrintNow = async () => {
        // If explicitly disabled -> never auto print
        try {
            const v = localStorage.getItem("cafe_auto_kitchen_print");
            if (v === "false") return false;
            if (v === "true") return true;
        } catch { }

        // Auto-enable if this device looks like a print-station:
        // - Wi‑Fi printers: local printer-bridge reachable
        // - USB printers: WebUSB printer is connected/authorized
        const now = Date.now();
        if (bridgeHealthRef.current.ok === true && now - bridgeHealthRef.current.checkedAt < 30_000) return true;
        if (bridgeHealthRef.current.ok === false && now - bridgeHealthRef.current.checkedAt < 10_000) return false;

        let bridgeUrl = "http://127.0.0.1:5179/print";
        try {
            bridgeUrl = localStorage.getItem("cafe_printer_bridge_url") || bridgeUrl;
        } catch { }
        const healthUrl = String(bridgeUrl).replace(/\/print\/?$/i, "/health");

        try {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 800);
            const r = await fetch(healthUrl, { method: "GET", signal: controller.signal });
            clearTimeout(t);
            const ok = r.ok;
            bridgeHealthRef.current = { checkedAt: Date.now(), ok };
            if (ok) {
                try { localStorage.setItem("cafe_auto_kitchen_print", "true"); } catch { }
                return true;
            }
        } catch {
            bridgeHealthRef.current = { checkedAt: Date.now(), ok: false };
        }

        // No bridge → try USB (no dialogs; only already-authorized devices)
        try {
            const okUsb = await checkPrinterConnection().catch(() => false);
            if (okUsb) {
                try { localStorage.setItem("cafe_auto_kitchen_print", "true"); } catch { }
                return true;
            }
        } catch { }

        return false;
    }

    const isCookPage = useMemo(() => {
        const p = String(location?.pathname || "");
        return p.includes("/cafe/cook");
    }, [location?.pathname]);

    const tablesMap = useMemo(() => {
        const m = new Map();
        const list =
            Array.isArray(tables) ? tables :
                Array.isArray(tables?.tables) ? tables.tables :
                    Array.isArray(tables?.results) ? tables.results :
                        Array.isArray(tables?.data?.results) ? tables.data.results :
                            [];

        list.forEach((t) => {
            if (t?.id === null || t?.id === undefined || t?.id === "") return;
            m.set(String(t.id), t);
        });
        return m;
    }, [tables]);

    const fullName = useCallback((u = {}) =>
        [u?.last_name || "", u?.first_name || ""].filter(Boolean).join(" ").trim() ||
        u?.email ||
        "Без имени", []);

    const formatReceiptDate = useCallback((dateStr) => {
        if (!dateStr) return "";
        try {
            const d = new Date(dateStr);
            if (Number.isNaN(d.getTime())) return String(dateStr);
            const day = String(d.getDate()).padStart(2, "0");
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const year = d.getFullYear();
            const hours = String(d.getHours()).padStart(2, "0");
            const minutes = String(d.getMinutes()).padStart(2, "0");
            return `${day}.${month}.${year} ${hours}:${minutes}`;
        } catch {
            return String(dateStr);
        }
    }, []);

    const normalizeTableLabel = useCallback((raw) => {
        if (raw === null || raw === undefined) return "";
        const v = String(raw).trim();
        if (!v) return "";
        if (UUID_RE.test(v)) return "";
        return v;
    }, []);

    const resolveTableLabelFromOrder = useCallback((order) => {
        const tableId =
            order?.table_id ??
            order?.tableId ??
            order?.table?.id ??
            order?.table;

        const hasTable = !(tableId === null || tableId === undefined || tableId === "");
        if (!hasTable) return TAKEAWAY_LABEL;

        const t = tablesMap.get(String(tableId));
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
        if (t?.number !== null && t?.number !== undefined && t?.number !== "") return String(t.number);

        const fallback = normalizeTableLabel(
            order?.table_name || order?.table_label || order?.table_title || order?.table_number
        );
        if (fallback) return fallback;

        const raw = normalizeTableLabel(tableId);
        return raw || "—";
    }, [TAKEAWAY_LABEL, normalizeTableLabel, tablesMap]);

    const linePrice = useCallback((it) => {
        const v =
            it?.price ??
            it?.menu_item_price ??
            it?.price_each ??
            it?.unit_price ??
            it?.menu_item?.price ??
            0;
        const n = Number(String(v).replace(",", "."));
        return Number.isFinite(n) ? n : 0;
    }, []);

    const orderItemsSnapshotKey = useCallback((orderId) => `cafe_order_items_snapshot_${orderId}`, []);

    const readOrderItemsSnapshot = useCallback((orderId) => {
        try {
            const raw = localStorage.getItem(orderItemsSnapshotKey(orderId));
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }, [orderItemsSnapshotKey]);

    const writeOrderItemsSnapshot = useCallback((orderId, snapshot) => {
        try {
            localStorage.setItem(orderItemsSnapshotKey(orderId), JSON.stringify(snapshot || null));
        } catch { }
    }, [orderItemsSnapshotKey]);

    const isPaidStatus = useCallback((order) => {
        if (order?.is_paid === true) return true;
        const s = String(order?.status || "").toLowerCase().trim();
        return ["paid", "оплачен", "оплачено", "оплачён", "closed", "done", "completed"].includes(s);
    }, []);

    const buildReceiptPayload = useCallback((orderDetail) => {
        const dt = formatReceiptDate(orderDetail?.created_at || orderDetail?.date || orderDetail?.created);
        const tableLabel = resolveTableLabelFromOrder(orderDetail);
        const items = Array.isArray(orderDetail?.items) ? orderDetail.items : [];
        const isTakeaway = tableLabel === TAKEAWAY_LABEL;
    
        return {
            company: localStorage.getItem("company_name") || "КАССА",
            doc_no: isTakeaway ? TAKEAWAY_LABEL : `СТОЛ ${tableLabel}`,
            created_at: dt,
            cashier_name: fullName(profile || {}),
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
    }, [formatReceiptDate, linePrice, fullName, profile, resolveTableLabelFromOrder, TAKEAWAY_LABEL]);

    const printReceiptForOrder = useCallback(async (orderId) => {
        const oid = String(orderId || "");
        if (!oid) return;
        if (printedReceiptsRef.current.has(oid)) return;
        if (printingReceiptsRef.current.has(oid)) return;
        try {
            const alreadyPrinted = localStorage.getItem(`cafe_receipt_printed_${oid}`);
            if (alreadyPrinted) return;
        } catch { }
        if (!acquireReceiptPrintLock(oid)) return;

        printingReceiptsRef.current.add(oid);
        try {
            const receiptBinding = localStorage.getItem("cafe_receipt_printer") || "";
            if (!receiptBinding) return;

            await checkPrinterConnection().catch(() => false);
            const detail = await api.get(`/cafe/orders/${encodeURIComponent(oid)}/`).then((r) => r?.data || null);
            if (!detail) return;

            const payload = buildReceiptPayload(detail);
            const parsed = parsePrinterBinding(receiptBinding);
            if (parsed.kind === "ip") {
                await printViaWiFiSimple(payload, parsed.ip, parsed.port);
            } else if (parsed.kind === "usb") {
                await setActivePrinterByKey(parsed.usbKey);
                await printOrderReceiptJSONViaUSB(payload);
            }

            printedReceiptsRef.current.add(oid);
            try {
                localStorage.setItem(`cafe_receipt_printed_${oid}`, "true");
            } catch { }
        } catch (e) {
            console.error("Auto receipt print error:", e);
        } finally {
            printingReceiptsRef.current.delete(oid);
            releaseReceiptPrintLock(oid);
        }
    }, [buildReceiptPayload]);

    const readKitchenPrinterMap = () => {
        try {
            const raw = localStorage.getItem("kitchen_printer_map");
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    const kitchenPrintLockKey = (orderId) => `cafe_kitchen_print_lock_${orderId}`;
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
    }

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
    }

    const releaseKitchenPrintLock = (orderId) => {
        try {
            localStorage.removeItem(kitchenPrintLockKey(orderId));
        } catch { }
    }

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
    }

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
    }

    const releaseReceiptPrintLock = (orderId) => {
        try {
            localStorage.removeItem(receiptPrintLockKey(orderId));
        } catch { }
    }

    const ensureKitchensMap = async () => {
        if (kitchensCacheRef.current) return kitchensCacheRef.current;
        const res = await api.get("/cafe/kitchens/");
        const list = res?.data?.results || res?.data || [];
        const m = new Map();
        for (const k of list) {
            const id = String(k?.id ?? "");
            if (id) m.set(id, k);
        }
        kitchensCacheRef.current = m;
        return m;
    }

    const kitchenLabel = (k) => {
        const title = String(k?.title || k?.name || "Кухня").trim();
        const number = k?.number;
        return `${title}${number !== undefined && number !== null && number !== "" ? ` №${number}` : ""}`;
    }

    const resolveKitchenPrinterBinding = (kitchensMap, kitchenId) => {
        const kid = String(kitchenId || "");
        if (!kid) return "";
        const k = kitchensMap.get(kid);
        const direct = String(
            k?.printer ||
            k?.printer_key ||
            k?.printerKey ||
            k?.printer_id ||
            k?.printerId ||
            ""
        ).trim();
        if (direct) return direct;
        const ls = readKitchenPrinterMap();
        return String(ls?.[kid] || "").trim();
    }

    const resolveMenuKitchenId = async (menuItemId) => {
        const mid = String(menuItemId || "");
        if (!mid) return null;
        if (menuKitchenCacheRef.current.has(mid)) return menuKitchenCacheRef.current.get(mid);
        try {
            const r = await api.get(`/cafe/menu-items/${encodeURIComponent(mid)}/`);
            const mi = r?.data || null;
            const kitchenId = mi?.kitchen ?? null;
            menuKitchenCacheRef.current.set(mid, kitchenId);
            return kitchenId;
        } catch {
            menuKitchenCacheRef.current.set(mid, null);
            return null;
        }
    }

    const buildItemsQtyMap = useCallback((items) => {
        const map = new Map(); // menuId -> { qty, title }
        const arr = Array.isArray(items) ? items : [];
        for (const it of arr) {
            const menuId = it?.menu_item || it?.menu_item_id || it?.menuItem;
            const mid = String(menuId || "");
            if (!mid) continue;
            const qty = Number(it?.quantity) || 0;
            if (!qty) continue;
            const title = String(it?.menu_item_title || it?.title || "Позиция");
            map.set(mid, { qty, title });
        }
        return map;
    }, []);

    const printKitchenTicketsForOrder = async (orderId, attempt = 0) => {
        const oid = String(orderId || "");
        if (!oid) return;
        if (printedOrdersRef.current.has(oid)) return;
        if (printingOrdersRef.current.has(oid)) return;
        try {
            if (localStorage.getItem(`cafe_kitchen_printed_${oid}`)) return;
        } catch { }
        if (!acquireKitchenPrintLock(oid)) return;
        printingOrdersRef.current.add(oid);

        const scheduleRetry = (why) => {
            // retry a few times because order detail may not be available immediately after WS event
            const maxAttempts = 5;
            if (attempt >= maxAttempts) {
                console.warn("Auto kitchen print: give up", { orderId: oid, attempt, why });
                return;
            }
            const delay = [400, 800, 1500, 2500, 4000][attempt] || 2000;
            if (retryTimersRef.current.has(oid)) return;
            const t = setTimeout(() => {
                retryTimersRef.current.delete(oid);
                printKitchenTicketsForOrder(oid, attempt + 1);
            }, delay);
            retryTimersRef.current.set(oid, t);
        };

        try {
            const detail = await api.get(`/cafe/orders/${encodeURIComponent(oid)}/`).then((r) => r?.data || null);
            if (!detail) {
                scheduleRetry("no-detail");
                return;
            }

            const items = Array.isArray(detail?.items) ? detail.items : [];
            if (!items.length) {
                scheduleRetry("no-items");
                return;
            }

            const kitchensMap = await ensureKitchensMap();

            // group items by kitchenId
            const groups = new Map(); // kid -> items
            for (const it of items) {
                const menuId = it?.menu_item || it?.menu_item_id || it?.menuItem;
                if (!menuId) continue;

                // eslint-disable-next-line no-await-in-loop
                const kitchenId = await resolveMenuKitchenId(menuId);
                if (!kitchenId) continue;

                const kid = String(kitchenId);
                if (!groups.has(kid)) groups.set(kid, []);
                groups.get(kid).push(it);
            }

            if (!groups.size) {
                scheduleRetry("no-kitchen-groups");
                return;
            }

            const dtRaw = detail?.created_at || detail?.date || detail?.created;
            const dt = formatReceiptDate(dtRaw || new Date().toISOString());
            const tableLabel = resolveTableLabelFromOrder(detail);
            const cashier = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || profile?.email || "";
            const kitchenDocNo = tableLabel === TAKEAWAY_LABEL ? TAKEAWAY_LABEL : `СТОЛ ${tableLabel}`;

            for (const [kid, kitItems] of groups.entries()) {
                const k = kitchensMap.get(String(kid));
                const label = kitchenLabel(k);
                const binding = resolveKitchenPrinterBinding(kitchensMap, kid);
                const parsed = parsePrinterBinding(binding);
                if (parsed.kind !== "ip" && parsed.kind !== "usb") continue;

                const payload = {
                    company: localStorage.getItem("company_name") || "КУХНЯ",
                    doc_no: `${label} • ${kitchenDocNo}`,
                    created_at: dt,
                    cashier_name: cashier,
                    discount: 0,
                    tax: 0,
                    paid_cash: 0,
                    paid_card: 0,
                    change: 0,
                    kitchen_id: Number(kid) || kid,
                    items: (kitItems || []).map((it) => ({
                        name: String(it.menu_item_title || it.title || "Позиция"),
                        qty: Math.max(1, Number(it.quantity) || 1),
                        // price not needed for kitchen ticket
                    })),
                };

                if (parsed.kind === "ip") {
                    // eslint-disable-next-line no-await-in-loop
                    await printViaWiFiSimple(payload, parsed.ip, parsed.port);
                } else if (parsed.kind === "usb") {
                    // eslint-disable-next-line no-await-in-loop
                    await setActivePrinterByKey(parsed.usbKey);
                    // eslint-disable-next-line no-await-in-loop
                    await printOrderReceiptJSONViaUSB(payload);
                }
            }

            // Mark as printed only after successful run (no early dedupe)
            printedOrdersRef.current.add(oid);
            try {
                localStorage.setItem(`cafe_kitchen_printed_${oid}`, "true");
            } catch { }

            // Snapshot items after successful print (for diff printing on edits)
            try {
                const snapMap = buildItemsQtyMap(detail?.items);
                const snapObj = {};
                for (const [mid, v] of snapMap.entries()) snapObj[mid] = v;
                writeOrderItemsSnapshot(oid, { orderId: oid, savedAt: Date.now(), items: snapObj });
            } catch { }
        } catch (e) {
            console.error("Auto kitchen print error:", e);
            // retry on transient errors
            try {
                const msg = String(e?.message || e);
                scheduleRetry(msg);
            } catch { }
        } finally {
            printingOrdersRef.current.delete(oid);
            releaseKitchenPrintLock(oid);
        }
    }

    const shouldPrintKitchenDiffForStatus = useCallback((order) => {
        const s = String(order?.status || "").toLowerCase().trim();
        if (isPaidStatus(order)) return false;
        if (["cancelled", "canceled", "отменен", "отменён"].includes(s)) return false;
        return true;
    }, [isPaidStatus]);

    const printKitchenDiffTicketsForOrder = useCallback(async (orderId) => {
        const oid = String(orderId || "");
        if (!oid) return;
        if (printingKitchenDiffRef.current.has(oid)) return;

        const enabled = await shouldAutoPrintNow().catch(() => false);
        if (!enabled) return;

        if (!acquireKitchenPrintLock(oid)) return;
        printingKitchenDiffRef.current.add(oid);

        try {
            const detail = await api.get(`/cafe/orders/${encodeURIComponent(oid)}/`).then((r) => r?.data || null);
            if (!detail) return;

            if (!shouldPrintKitchenDiffForStatus(detail)) return;

            const newMap = buildItemsQtyMap(detail?.items);
            const prevSnap = readOrderItemsSnapshot(oid);
            const prevItems = prevSnap?.items && typeof prevSnap.items === "object" ? prevSnap.items : {};
            const oldMap = new Map(); // menuId -> { qty, title }
            for (const [k, v] of Object.entries(prevItems || {})) {
                const mid = String(k || "");
                if (!mid) continue;
                const qty = Number(v?.qty) || 0;
                if (!qty) continue;
                const title = String(v?.title || "Позиция");
                oldMap.set(mid, { qty, title });
            }

            const allMenuIds = Array.from(new Set([...Array.from(oldMap.keys()), ...Array.from(newMap.keys())]));
            if (!allMenuIds.length) {
                // nothing to diff; still store snapshot
                const snapObj = {};
                for (const [mid, v] of newMap.entries()) snapObj[mid] = v;
                writeOrderItemsSnapshot(oid, { orderId: oid, savedAt: Date.now(), items: snapObj });
                return;
            }

            const kitchensMap = await ensureKitchensMap();

            // Resolve kitchen for each menu item id (cached)
            const menuToKitchen = new Map(); // mid -> kid
            for (const mid of allMenuIds) {
                // eslint-disable-next-line no-await-in-loop
                const kid = await resolveMenuKitchenId(mid);
                if (kid) menuToKitchen.set(mid, String(kid));
            }

            const addedByKitchen = new Map(); // kid -> [{name, qty}]
            const removedByKitchen = new Map(); // kid -> [{name, qty}]

            for (const mid of allMenuIds) {
                const kid = menuToKitchen.get(mid);
                if (!kid) continue;

                const oldQty = oldMap.get(mid)?.qty ?? 0;
                const newQty = newMap.get(mid)?.qty ?? 0;
                if (oldQty === newQty) continue;

                const title = newMap.get(mid)?.title || oldMap.get(mid)?.title || "Позиция";

                if (newQty > oldQty) {
                    const qty = Math.max(1, Number(newQty - oldQty) || 0);
                    if (!addedByKitchen.has(kid)) addedByKitchen.set(kid, []);
                    addedByKitchen.get(kid).push({ name: String(title), qty });
                } else {
                    const qty = Math.max(1, Number(oldQty - newQty) || 0);
                    if (!removedByKitchen.has(kid)) removedByKitchen.set(kid, []);
                    removedByKitchen.get(kid).push({ name: String(title), qty });
                }
            }

            if (!addedByKitchen.size && !removedByKitchen.size) {
                // no changes
                return;
            }

            const dtRaw = detail?.updated_at || detail?.updated || detail?.modified_at || detail?.created_at || detail?.date || new Date().toISOString();
            const dt = formatReceiptDate(dtRaw);
            const tableLabel = resolveTableLabelFromOrder(detail);
            const cashier = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || profile?.email || "";
            const diffDocNo = tableLabel === TAKEAWAY_LABEL ? TAKEAWAY_LABEL : `СТОЛ ${tableLabel}`;

            const printOne = async (kid, menuTitle, items) => {
                const k = kitchensMap.get(String(kid));
                const label = kitchenLabel(k);
                const binding = resolveKitchenPrinterBinding(kitchensMap, kid);
                const parsed = parsePrinterBinding(binding);
                if (parsed.kind !== "ip" && parsed.kind !== "usb") return;

                const payload = {
                    company: localStorage.getItem("company_name") || "КУХНЯ",
                    doc_no: `${label} | ${diffDocNo} | ИЗМЕНЕНИЕ`,
                    created_at: dt,
                    cashier_name: cashier,
                    discount: 0,
                    tax: 0,
                    paid_cash: 0,
                    paid_card: 0,
                    change: 0,
                    kitchen_id: Number(kid) || kid,
                    menu_title: menuTitle,
                    items: (items || []).map((it) => ({
                        name: String(it.name || "Позиция"),
                        qty: Math.max(1, Number(it.qty) || 1),
                    })),
                };

                if (parsed.kind === "ip") {
                    await printViaWiFiSimple(payload, parsed.ip, parsed.port);
                } else if (parsed.kind === "usb") {
                    await setActivePrinterByKey(parsed.usbKey);
                    await printOrderReceiptJSONViaUSB(payload);
                }
            };

            // Print added first, then removed (per kitchen)
            for (const [kid, items] of addedByKitchen.entries()) {
                // eslint-disable-next-line no-await-in-loop
                await printOne(kid, "ДОБАВИТЬ", items);
            }
            for (const [kid, items] of removedByKitchen.entries()) {
                // eslint-disable-next-line no-await-in-loop
                await printOne(kid, "УБРАТЬ", items);
            }

            // Update snapshot only after successful diff print
            const snapObj = {};
            for (const [mid, v] of newMap.entries()) snapObj[mid] = v;
            writeOrderItemsSnapshot(oid, { orderId: oid, savedAt: Date.now(), items: snapObj });
        } catch (e) {
            console.error("Auto kitchen diff print error:", e);
        } finally {
            printingKitchenDiffRef.current.delete(oid);
            releaseKitchenPrintLock(oid);
        }
    }, [
        buildItemsQtyMap,
        ensureKitchensMap,
        formatReceiptDate,
        profile?.email,
        profile?.first_name,
        profile?.last_name,
        readOrderItemsSnapshot,
        releaseKitchenPrintLock,
        resolveKitchenPrinterBinding,
        resolveMenuKitchenId,
        resolveTableLabelFromOrder,
        shouldAutoPrintNow,
        shouldPrintKitchenDiffForStatus,
        TAKEAWAY_LABEL,
        writeOrderItemsSnapshot,
    ]);

    // Fallback: poll recent orders and print kitchen tickets for any unprinted (when order was created from another device, e.g. phone)
    const pollRecentOrdersAndPrint = useCallback(async () => {
        const enabled = await shouldAutoPrintNow();
        if (!enabled) return;
        try {
            let res;
            try {
                res = await api.get("/cafe/orders/", {
                    params: { page_size: 50, ordering: "-created_at" },
                });
            } catch {
                res = await api.get("/cafe/orders/", { params: { page_size: 50 } });
            }
            const list = res?.data?.results ?? res?.data ?? [];
            if (!Array.isArray(list)) return;
            const cutoff = Date.now() - RECENT_ORDER_AGE_MS;
            for (const o of list) {
                const oid = String(o?.id ?? "");
                if (!oid) continue;
                const created = o?.created_at ?? o?.date;
                const createdMs = created ? new Date(created).getTime() : 0;
                if (createdMs < cutoff) continue;
                if (printedOrdersRef.current.has(oid)) continue;
                if (printingOrdersRef.current.has(oid)) continue;
                await printKitchenTicketsForOrder(oid);
            }
        } catch (e) {
            console.warn("CafeLayout poll recent orders:", e?.message || e);
        }
    }, []);

    useEffect(() => {
        const lastMessage = orders?.lastMessage;
        if (!lastMessage) return;
        const { type, data } = lastMessage;

        if (type === "kitchen_task_ready" && data?.task?.waiter === profile?.id) {
            const t = data?.task;
            const key = `kitchen_task_ready-${t?.id || t?.uuid || t?.created_at || ""}`;
            if (!notifiedTasksRef.current.has(key)) {
                notifiedTasksRef.current.add(key);
                setNotificationDeps(key);
                setNotificationOrder(`${t?.menu_item_title} \nдля стола: №: ${t?.table_number} готово`);
                setNotificationOptions({ variant: "waiter", sticky: true });
            }
        }

        // Auto print to kitchen printers on order created (for the device that has printers configured)
        if (type === "order_created") {
            // Notify cook (only on Kitchen page)
            if (isCookPage) {
                const oid = String(data?.order?.id || "");
                if (oid && !notifiedOrdersRef.current.has(oid)) {
                    notifiedOrdersRef.current.add(oid);
                    const tableLabel = resolveTableLabelFromOrder(data?.order || {});
                    const msg = `Новый заказ \nстол: ${tableLabel}`;
                    const key = `order_created-${oid}`;
                    setNotificationDeps(key);
                    setNotificationOrder(msg);
                    setNotificationOptions({ variant: "default", sticky: false });
                }
            }

            const orderId = data?.order?.id;
            if (orderId) {
                shouldAutoPrintNow().then((enabled) => {
                    if (enabled) printKitchenTicketsForOrder(orderId);
                }).catch(() => { });
            }
        }

        // Auto print receipt on order paid (from any device)
        if (type === "order_updated") {
            const updatedOrder = data?.order;
            const orderId = updatedOrder?.id;
            if (orderId && isPaidStatus(updatedOrder)) {
                printReceiptForOrder(orderId);
            }
            // Auto print kitchen diff on order edit (added/removed items)
            if (orderId && !isPaidStatus(updatedOrder)) {
                printKitchenDiffTicketsForOrder(orderId);
            }
        }
    }, [orders?.lastMessage, profile?.id, isCookPage, isPaidStatus, printReceiptForOrder, printKitchenDiffTicketsForOrder]);

    // Fallback polling: when order is created from another device (e.g. phone), this device (notebook) may not get WebSocket event — poll recent orders and print
    useEffect(() => {
        const intervalId = setInterval(pollRecentOrdersAndPrint, POLL_RECENT_ORDERS_MS);
        return () => clearInterval(intervalId);
    }, [pollRecentOrdersAndPrint]);

    // When user returns to this tab (e.g. notebook), immediately check for new orders to print
    useEffect(() => {
        const onVisibility = () => {
            if (document.visibilityState === "visible") pollRecentOrdersAndPrint();
        };
        document.addEventListener("visibilitychange", onVisibility);
        return () => document.removeEventListener("visibilitychange", onVisibility);
    }, [pollRecentOrdersAndPrint]);

    return (
        <>
            <NotificationCafeSound
                notification={notificationOrder}
                notificationKey={notificationDeps}
                notificationOptions={notificationOptions}
            />
            <Outlet context={{
                socketOrders: orders,
                socketTables: tables
            }} />
        </>
    )
}
