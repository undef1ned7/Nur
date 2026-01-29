import React, { act, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import api from "../../../../api";
import {
  fetchKitchenTasksAsync,
  claimKitchenTaskAsync,
  readyKitchenTaskAsync,
} from "../../../../store/creators/cafeOrdersCreators";
import CookHeader from "./components/CookHeader";
import CookReceiptCard from "./components/CookReceiptCard";
import KitchenCreateModal from "./components/KitchenCreateModal";
import "./Cook.scss";
import { useCafeOrdersWebSocket } from "../../../../hooks/useCafeWebSocket";
import { useDebouncedValue } from "../../../../hooks/useDebounce";
import NotificationCadeSound from "../../../common/Notification/NotificationCadeSound";
import Pagination from "../../Market/Warehouse/components/Pagination";
import { removeAfterReady } from "../../../../store/slices/cafeOrdersSlice";

const listFrom = (res) => res?.data?.results || res?.data || [];

const toNum = (x) => {
  if (x === null || x === undefined) return 0;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const numStr = (n) => String(Number(n) || 0).replace(",", ".");

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
    return String(dateStr);
  }
};

const toMinuteKey = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
};

const pickOrderId = (t) => t?.order ?? t?.order_id ?? t?.orderId ?? t?.order_pk ?? null;

const computeGroupStatus = (items) => {
  const s = (items || []).map((x) => String(x?.status || ""));
  if (s.includes("pending")) return "pending";
  if (s.includes("in_progress")) return "in_progress";
  if (s.length && s.every((v) => v === "ready")) return "ready";
  if (s.includes("cancelled") || s.includes("canceled")) return "cancelled";
  return s[0] || "pending";
};

const getStatusLabel = (status) => {
  const labels = {
    pending: "Ожидает",
    in_progress: "В работе",
    ready: "Готов",
    cancelled: "Отменён",
    canceled: "Отменён",
    open: "Открыт",
    closed: "Закрыт",
  };
  return labels[status] || status;
};

const firstDefined = (...vals) => {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
  return "";
};

const extractMenuIdFromTask = (t) =>
  firstDefined(
    t?.menu_item,
    t?.menu_item_id,
    t?.menuItem,
    t?.menuItemId,
    t?.menu_item_uuid,
    t?.menu_item?.id,
    t?.menu_item?.uuid
  );

const extractMenuTitleFromTask = (t) =>
  String(
    firstDefined(
      t?.menu_item_title,
      t?.menuItemTitle,
      t?.menu_item_name,
      t?.menuItemName,
      t?.title,
      t?.name,
      t?.menu_item?.title,
      t?.menu_item?.name
    )
  ).trim();

const extractPortionsFromTask = (t) =>
  Math.max(1, Number(firstDefined(t?.quantity, t?.qty, t?.count, t?.portions, t?.amount, 1)) || 1);

const tryFetchTaskDetail = async (taskId) => {
  const id = String(taskId || "");
  if (!id) return null;

  const candidates = [
    `/cafe/kitchen-tasks/${id}/`,
    `/cafe/kitchen_tasks/${id}/`,
    `/cafe/kitchen/tasks/${id}/`,
    `/cafe/kitchen/${id}/`,
    `/cafe/tasks/${id}/`,
  ];

  for (const url of candidates) {
    try {
      const r = await api.get(url);
      if (r?.data) return r.data;
    } catch { }
  }
  return null;
};

const coerceArray = (v) => {
  if (Array.isArray(v)) return v;

  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  if (v && typeof v === "object") {
    if (Array.isArray(v.results)) return v.results;
    if (Array.isArray(v.items)) return v.items;
  }

  return [];
};

const extractRecipeRows = (menuFull) => {
  if (!menuFull) return [];
  const candidates = [menuFull.ingredients, menuFull.recipe, menuFull.recipe_items, menuFull.components];
  for (const c of candidates) {
    const arr = coerceArray(c);
    if (arr.length) return arr;
  }
  return [];
};

const extractRecipeProductId = (row) =>
  firstDefined(
    row?.product,
    row?.product_id,
    row?.warehouse_item,
    row?.warehouse_item_id,
    row?.stock_item,
    row?.stock_item_id,
    row?.item,
    row?.item_id
  );

const extractRecipeAmount = (row) => firstDefined(row?.amount, row?.qty, row?.quantity, row?.count, 0);

const toUserMessage = (err) => {
  const raw = String(err?.message || err?.detail || err?.error || err || "").trim();
  const lower = raw.toLowerCase();

  if (
    lower.includes("ингредиенты пустые") ||
    lower.includes("ingredients") ||
    lower.includes("menu-items") ||
    lower.includes("menu items")
  ) {
    return "Нельзя отметить «Готово»: у блюда не настроены ингредиенты. Обратитесь к администратору.";
  }

  if (lower.includes("недостаточно на складе") || lower.includes("нет на складе")) {
    return "Нельзя отметить «Готово»: на складе не хватает ингредиентов. Проверьте остатки.";
  }

  if (lower.includes("не найдено") || lower.includes("404")) {
    return "Нельзя отметить «Готово»: блюдо не найдено. Обратитесь к администратору.";
  }

  if (lower.includes("network") || lower.includes("failed to fetch")) {
    return "Нет связи с сервером. Попробуйте ещё раз.";
  }

  return "Не удалось выполнить действие. Попробуйте ещё раз.";
};


const historyFilterOptions = [
  { value: null, label: "Все статусы" },
  { value: "cancelled", label: "Отменён" },
  { value: "ready", label: "Готов" },
];

const currentFilterOptions = [
  { value: null, label: "Все статусы" },
  { value: "pending", label: "Ожидает" },
  { value: "in_progress", label: "В работе" },
];

const stLabels = {
  pending: "ожидает",
  in_progress: "в работе",
  ready: "готов",
  cancelled: "отменён",
};

const Cook = () => {
  const dispatch = useDispatch();
  const { tasks, loading, error, updatingStatus } = useSelector((state) => state.cafeOrders);
  const [activeTab, setActiveTab] = useState("current");
  const [query, setQuery] = useState("");
  const debouncedTaskSearchQuery = useDebouncedValue(query, 400);
  const [statusFilter, setStatusFilter] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const [notice, setNotice] = useState(null);

  const [kitchenModalOpen, setKitchenModalOpen] = useState(false);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const menuCacheRef = useRef(new Map()); // menuId -> full menu item
  const titleCacheRef = useRef(new Map()); // menuId -> title (быстрый доступ)
  const noticeTimerRef = useRef(null);
  const { orders } = useCafeOrdersWebSocket()
  // чтобы перерендерить, когда догрузили title
  const [titlesTick, setTitlesTick] = useState(0);
  // глушим возможный внешний orders:refresh сразу после смены статуса
  const suppressNextRefreshRef = useRef(false);

  const showNotice = useCallback((type, text) => {
    setNotice({ type, text });
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 3500);
  }, []);

  const refetchTask = useCallback(async () => {
    const params = {
      search: debouncedTaskSearchQuery,
      status: statusFilter,
      ordering: '-created_at'
    }
    if (!statusFilter) {
      if (activeTab === 'history') {
        params['status'] = historyFilterOptions.map(el => el.value).filter(Boolean).toString()
      } else {
        params['status'] = currentFilterOptions.map(el => el.value).filter(Boolean).toString()
      }
    }

    if (!debouncedTaskSearchQuery) delete params['search'];
    dispatch(fetchKitchenTasksAsync(params));
  }, [debouncedTaskSearchQuery, statusFilter, activeTab])

  const refetch = useCallback(async () => {
    // История: закрытые заказы + готовые задачи (даже если заказ ещё открыт)
    setHistoryLoading(true);
    try {
      await refetchTask()
    } catch (err) {
      setHistoryOrders([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [orders, refetchTask, activeTab]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const handler = () => {
      if (suppressNextRefreshRef.current) {
        suppressNextRefreshRef.current = false;
        return;
      }
      refetch();
    };
    window.addEventListener("orders:refresh", handler);
    return () => window.removeEventListener("orders:refresh", handler);
  }, [refetch]);

  const isUpdating = useCallback((taskId) => updatingStatus?.[taskId] === true, [updatingStatus]);

  const getMenuWithIngredients = useCallback(async (menuId) => {
    const key = String(menuId || "");
    if (!key) return null;

    if (menuCacheRef.current.has(key)) return menuCacheRef.current.get(key);

    const r = await api.get(`/cafe/menu-items/${encodeURIComponent(key)}/`);
    const full = r?.data || null;

    if (full) {
      menuCacheRef.current.set(key, full);
      const title = String(firstDefined(full?.title, full?.name, full?.menu_item_title, full?.menuItemTitle) || "").trim();
      if (title) titleCacheRef.current.set(key, title);
    }

    return full;
  }, []);

  // ДОГРУЗКА НАЗВАНИЙ, если tasks не содержат menu_item_title
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const base = Array.isArray(tasks) ? tasks : [];
      const missing = [];

      for (const t of base) {
        const localTitle = extractMenuTitleFromTask(t);
        if (localTitle) continue;

        const mid = extractMenuIdFromTask(t);
        const key = String(mid || "");
        if (!key) continue;

        if (titleCacheRef.current.has(key)) continue;

        missing.push(key);
      }

      // уникальные, и ограничим, чтобы не долбить сервер пачкой
      const uniq = Array.from(new Set(missing)).slice(0, 30);
      if (!uniq.length) return;

      for (const id of uniq) {
        if (cancelled) return;
        try {
          const full = await getMenuWithIngredients(id);
          const title = String(firstDefined(full?.title, full?.name, full?.menu_item_title, full?.menuItemTitle) || "").trim();
          if (title) {
            titleCacheRef.current.set(String(id), title);
            if (!cancelled) setTitlesTick((x) => x + 1);
          }
        } catch {
          // молча
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [tasks, getMenuWithIngredients]);

  const buildNeedForTask = useCallback(
    async (task) => {
      let menuId = extractMenuIdFromTask(task);

      if (!menuId && task?.id) {
        const detail = await tryFetchTaskDetail(task.id);
        if (detail) menuId = extractMenuIdFromTask(detail);
      }

      if (!menuId) throw new Error("У блюда не найден ID для списания со склада.");

      let full = null;
      try {
        full = await getMenuWithIngredients(menuId);
      } catch (e) {
        const status = e?.response?.status;
        if (status === 404) throw new Error("Блюдо не найдено в меню. Обратитесь к администратору.");
        throw new Error("Не удалось получить данные блюда. Попробуйте ещё раз.");
      }

      if (!full) throw new Error("Не удалось получить данные блюда. Попробуйте ещё раз.");

      const recipeRows = extractRecipeRows(full);
      if (!recipeRows.length) throw new Error("У блюда не настроены ингредиенты. Обратитесь к администратору.");

      const portions = extractPortionsFromTask(task);
      const need = new Map();

      for (const row of recipeRows) {
        const pid = extractRecipeProductId(row);
        if (!pid) continue;

        const perPortion = toNum(extractRecipeAmount(row));
        const add = perPortion * portions;

        const k = String(pid);
        need.set(k, (need.get(k) || 0) + add);
      }

      if (!need.size) throw new Error("У блюда не настроены ингредиенты. Обратитесь к администратору.");
      return need;
    },
    [getMenuWithIngredients]
  );

  const updateWarehouseItem = useCallback(async (item, nextRem) => {
    if (!item?.id) throw new Error("Позиция склада без ID.");
    try {
      await api.patch(`/cafe/warehouse/${item.id}/`, { remainder: numStr(nextRem) });
      return;
    } catch { }
    await api.put(`/cafe/warehouse/${item.id}/`, {
      title: item.title,
      unit: item.unit,
      remainder: numStr(nextRem),
      minimum: numStr(item.minimum),
    });
  }, []);

  const applyWarehouseDecreaseSafe = useCallback(
    async (needMap) => {
      if (!needMap || !needMap.size) return { ok: true };

      const wr = await api.get("/cafe/warehouse/");
      const stock = listFrom(wr) || [];
      const stockMap = new Map(stock.map((s) => [String(s.id), s]));

      const lacks = [];
      for (const [pid, needQty] of needMap.entries()) {
        const s = stockMap.get(String(pid));
        if (!s) {
          lacks.push(String(pid));
          continue;
        }
        const have = toNum(s?.remainder);
        if (have < needQty) lacks.push(String(pid));
      }

      if (lacks.length) {
        return { ok: false, message: "Нельзя отметить «Готово»: на складе не хватает ингредиентов." };
      }

      const applied = [];
      try {
        for (const [pid, needQty] of needMap.entries()) {
          const s = stockMap.get(String(pid));
          const prev = toNum(s?.remainder);
          const next = Math.max(0, prev - needQty);

          await updateWarehouseItem(s, next);
          applied.push({ item: s, prev });
        }
        return { ok: true };
      } catch (e) {
        try {
          for (let i = applied.length - 1; i >= 0; i -= 1) {
            const { item, prev } = applied[i];
            await updateWarehouseItem(item, prev);
          }
        } catch { }
        throw e;
      }
    },
    [updateWarehouseItem]
  );

  const applyWarehouseIncreaseSafe = useCallback(
    async (needMap) => {
      if (!needMap || !needMap.size) return;

      const wr = await api.get("/cafe/warehouse/");
      const stock = listFrom(wr) || [];
      const stockMap = new Map(stock.map((s) => [String(s.id), s]));

      for (const [pid, qty] of needMap.entries()) {
        const s = stockMap.get(String(pid));
        if (!s) continue;
        const cur = toNum(s?.remainder);
        const next = cur + qty;
        try {
          await updateWarehouseItem(s, next);
        } catch { }
      }
    },
    [updateWarehouseItem]
  );

  // const groups = useMemo(() => {
  //   const uniqueList = new Set(tasks.map(el => el.order + '/' + el.menu_item));
  //   const result = [];
  //   uniqueList.forEach(el => {
  //     const [order, menu_item] = el.split('/');
  //     const orderObj = {};
  //     const filteredItems = tasks.filter(el => el.order == order && menu_item == el.menu_item);
  //     const template = filteredItems[0]
  //     if (!template) return;
  //     result.push({
  //       ...template,
  //       quantity: filteredItems.length
  //     })
  //   })
  //   return result
  // }, [tasks]);

  // useEffect(() => {
  //   if (!groups?.length) return;
  //   setCollapsed((prev) => {
  //     const next = { ...prev };
  //     for (const g of groups) if (next[g.key] === undefined) next[g.key] = true;
  //     return next;
  //   });
  // }, [groups]);

  // const toggleGroup = useCallback((key) => {
  //   setCollapsed((p) => ({ ...p, [key]: !p[key] }));
  // }, []);
  const buildPrintPayload = useCallback(
    (order) => {
      const t = order.table_number;
      const dt = formatReceiptDate(order?.created_at || order?.date || order?.created);
      return {
        company: localStorage.getItem("company_name") || "КУХНЯ",
        doc_no: `СТОЛ ${t ?? "—"}`,
        created_at: dt,
        menu_title: order.menu_item_title
      };
    },
    []
  );
  const handleClaimOne = useCallback(
    async (taskId, e) => {
      if (e?.preventDefault) e.preventDefault();
      try {
        suppressNextRefreshRef.current = true;
        const response = await dispatch(claimKitchenTaskAsync(taskId)).unwrap();
        // await checkPrinterConnection().catch(() => false);
        // const payload = buildPrintPayload(response);
        // await printOrderReceiptJSONViaUSBWithDialog(payload);
      } catch (err) {
        suppressNextRefreshRef.current = false;
        console.error("Claim error:", err);
        showNotice("error", toUserMessage(err));
      }
    },
    [dispatch, showNotice]
  );

  const handleReadyOne = useCallback(
    async (task, e) => {
      if (e?.preventDefault) e.preventDefault();

      const taskId = task?.id;
      if (!taskId) return;

      try {
        suppressNextRefreshRef.current = true;
        try {
          await dispatch(readyKitchenTaskAsync(taskId)).unwrap();
          showNotice("ok", "Отмечено как готово.");
        } catch (eReady) {
          try {
            await applyWarehouseIncreaseSafe(needMap);
          } catch { }
          suppressNextRefreshRef.current = false;
          console.error("Ready error:", eReady);
          showNotice("error", toUserMessage(eReady));
          return;
        }
      } catch (err) {
        suppressNextRefreshRef.current = false;
        console.error("Ready pipeline error:", err);
        showNotice("error", toUserMessage(err));
      }
    },
    [dispatch, showNotice, applyWarehouseDecreaseSafe, applyWarehouseIncreaseSafe]
  );

  const statusOptions = useMemo(
    () => {
      if (activeTab === "history") {
        return historyFilterOptions;
      } else {
        return currentFilterOptions;
      }
    },
    [activeTab]
  );

  const removeAfterReadyTask = useCallback((id) => {
    dispatch(removeAfterReady(id))
  }, []);
  useEffect(() => {
    setQuery('');
    setStatusFilter(null);
  }, [activeTab])
  return (
    <section className="cafeCook">
      <NotificationCadeSound deps={orders} />
      <CookHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        query={query}
        setQuery={setQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        statusOptions={statusOptions}
        onCreateKitchen={() => setKitchenModalOpen(true)}
      />

      {notice?.text ? (
        <div className={`cafeCook__notice cafeCook__notice--${notice.type}`}>
          <div className="cafeCook__noticeText">{notice.text}</div>
          <button
            className="cafeCook__noticeClose"
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Закрыть"
            title="Закрыть"
          >
            ×
          </button>
        </div>
      ) : null}

      <div className="cafeCook__list" aria-busy={loading ? "true" : "false"}>
        {loading && <div className="cafeCook__alert cafeCook__alert--neutral">Загрузка…</div>}

        {error && <div className="cafeCook__alert">Ошибка: {error?.message || error?.detail || String(error)}</div>}

        {!loading && !historyLoading && !error && tasks?.length === 0 && (
          <div className="cafeCook__alert cafeCook__alert--neutral">
            {query.trim()
              ? `Ничего не найдено по запросу «${query}»`
              : activeTab === "current"
                ? "Нет текущих задач"
                : "История пуста"}
          </div>
        )}

        {!loading &&
          !error &&
          tasks.map((g) => (
            <CookReceiptCard
              key={g.id}
              group={g}
              activeTab={activeTab}
              collapsed={collapsed[g.key] !== false}
              onToggle={() => toggleGroup(g.key)}
              formatReceiptDate={formatReceiptDate}
              getStatusLabel={getStatusLabel}
              extractPortionsFromTask={extractPortionsFromTask}
              toNum={toNum}
              isUpdating={(id) => isUpdating(id)}
              onClaimOne={handleClaimOne}
              onReadyOne={handleReadyOne}
              onRemoveAfterReady={removeAfterReadyTask}
            />
          ))}
      </div>
      {/* <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        next={next}
        previous={previous}
        loading={loading}
        creating={creating}
        updating={updating}
        deleting={deleting}
        onNextPage={onNextPage}
        onPreviousPage={onPreviousPage}
      /> */}
      <KitchenCreateModal
        open={kitchenModalOpen}
        onClose={() => setKitchenModalOpen(false)}
        onCreated={() => {
          try {
            window.dispatchEvent(new CustomEvent("orders:refresh"));
          } catch { }
        }}
      />
    </section>
  );
};

export default Cook;