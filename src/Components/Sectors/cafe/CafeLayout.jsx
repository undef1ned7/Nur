import React, { useEffect, useMemo, useRef, useState } from 'react'
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
    const { profile } = useUser();
    const location = useLocation();
    const notifiedTasksRef = useRef(new Set()); // taskKey -> notified once on this device

    const printedOrdersRef = useRef(new Set()); // orderId -> printed successfully once on this device
    const printingOrdersRef = useRef(new Set()); // orderId -> currently printing (avoid parallel)
    const retryTimersRef = useRef(new Map()); // orderId -> timeoutId
    const notifiedOrdersRef = useRef(new Set()); // orderId -> notified once on this device (cook page)
    const kitchensCacheRef = useRef(null); // Map(kitchenId -> kitchen)
    const menuKitchenCacheRef = useRef(new Map()); // menuItemId -> kitchenId
    const bridgeHealthRef = useRef({ checkedAt: 0, ok: null }); // cache health

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

    const readKitchenPrinterMap = () => {
        try {
            const raw = localStorage.getItem("kitchen_printer_map");
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
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
        const direct = String(k?.printer || k?.printer_key || "").trim();
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

    const printKitchenTicketsForOrder = async (orderId, attempt = 0) => {
        const oid = String(orderId || "");
        if (!oid) return;
        if (printedOrdersRef.current.has(oid)) return;
        if (printingOrdersRef.current.has(oid)) return;
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

            const dt = detail?.created_at || detail?.date || new Date().toISOString();
            const tableNo = detail?.table_number ?? detail?.table ?? "—";
            const cashier = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || profile?.email || "";

            for (const [kid, kitItems] of groups.entries()) {
                const k = kitchensMap.get(String(kid));
                const label = kitchenLabel(k);
                const binding = resolveKitchenPrinterBinding(kitchensMap, kid);
                const parsed = parsePrinterBinding(binding);
                if (parsed.kind !== "ip" && parsed.kind !== "usb") continue;

                const payload = {
                    company: localStorage.getItem("company_name") || "КУХНЯ",
                    doc_no: `${label} • СТОЛ ${tableNo}`,
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
        } catch (e) {
            console.error("Auto kitchen print error:", e);
            // retry on transient errors
            try {
                const msg = String(e?.message || e);
                scheduleRetry(msg);
            } catch { }
        } finally {
            printingOrdersRef.current.delete(oid);
        }
    }
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
            }
        }

        // Auto print to kitchen printers on order created (for the device that has printers configured)
        if (type === "order_created") {
            // Notify cook (only on Kitchen page)
            if (isCookPage) {
                const oid = String(data?.order?.id || "");
                if (oid && !notifiedOrdersRef.current.has(oid)) {
                    notifiedOrdersRef.current.add(oid);
                    const tableNo = data?.order?.table_number ?? data?.order?.table ?? "—";
                    const msg = `Новый заказ \nстол №: ${tableNo}`;
                    const key = `order_created-${oid}`;
                    setNotificationDeps(key);
                    setNotificationOrder(msg);
                }
            }

            const orderId = data?.order?.id;
            if (orderId) {
                shouldAutoPrintNow().then((enabled) => {
                    if (enabled) printKitchenTicketsForOrder(orderId);
                }).catch(() => { });
            }
        }
    }, [orders?.lastMessage, profile?.id, isCookPage])
    return (
        <>
            <NotificationCafeSound notification={notificationOrder} notificationKey={notificationDeps} />
            <Outlet context={{
                socketOrders: orders,
                socketTables: tables
            }} />
        </>
    )
}
