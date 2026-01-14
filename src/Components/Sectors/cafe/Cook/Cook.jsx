// src/.../Cook.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import api from "../../../../api";
import {
  fetchKitchenTasksAsync,
  claimKitchenTaskAsync,
  readyKitchenTaskAsync,
} from "../../../../store/creators/cafeOrdersCreators";
import CookHeader from "./CookHeader";
import CookReceiptCard from "./CookReceiptCard";
import "./Cook.scss";

/* ==== helpers ==== */
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

const pickOrderId = (t) =>
  t?.order ?? t?.order_id ?? t?.orderId ?? t?.order_pk ?? null;

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

const extractPortionsFromTask = (t) =>
  Math.max(
    1,
    Number(
      firstDefined(t?.quantity, t?.qty, t?.count, t?.portions, t?.amount, 1)
    ) || 1
  );

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
    } catch {
      // next
    }
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
  const candidates = [
    menuFull.ingredients,
    menuFull.recipe,
    menuFull.recipe_items,
    menuFull.components,
  ];
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

const extractRecipeAmount = (row) =>
  firstDefined(row?.amount, row?.qty, row?.quantity, row?.count, 0);

/* ==== user-friendly messages ==== */
const toUserMessage = (err) => {
  const raw = String(err?.message || err?.detail || err?.error || err || "").trim();
  const lower = raw.toLowerCase();

  // Рецепт/ингредиенты не настроены
  if (
    lower.includes("ингредиенты пустые") ||
    lower.includes("ingredients") ||
    lower.includes("menu-items") ||
    lower.includes("menu items")
  ) {
    return "Нельзя отметить «Готово»: у блюда не настроены ингредиенты. Обратитесь к администратору.";
  }

  // Склад/остатки
  if (lower.includes("недостаточно на складе") || lower.includes("нет на складе")) {
    return "Нельзя отметить «Готово»: на складе не хватает ингредиентов. Проверьте остатки.";
  }

  // Не найдено
  if (lower.includes("не найдено") || lower.includes("404")) {
    return "Нельзя отметить «Готово»: блюдо не найдено. Обратитесь к администратору.";
  }

  // Сеть/сервер
  if (lower.includes("network") || lower.includes("failed to fetch")) {
    return "Нет связи с сервером. Попробуйте ещё раз.";
  }

  return "Не удалось выполнить действие. Попробуйте ещё раз.";
};

const Cook = () => {
  const dispatch = useDispatch();
  const { tasks, loading, error, updatingStatus } = useSelector(
    (state) => state.cafeOrders
  );

  const [activeTab, setActiveTab] = useState("current"); // current | history
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all|pending|in_progress|ready|cancelled
  const [collapsed, setCollapsed] = useState({}); // true => collapsed
  const [notice, setNotice] = useState(null); // { type: "error"|"ok"|"info", text }

  const menuCacheRef = useRef(new Map());
  const noticeTimerRef = useRef(null);

  const showNotice = useCallback((type, text) => {
    setNotice({ type, text });
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 3500);
  }, []);

  const refetch = useCallback(() => {
    if (activeTab === "current") dispatch(fetchKitchenTasksAsync({}));
    else dispatch(fetchKitchenTasksAsync({ status: "ready" }));
  }, [dispatch, activeTab]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const handler = () => refetch();
    window.addEventListener("orders:refresh", handler);
    return () => window.removeEventListener("orders:refresh", handler);
  }, [refetch]);

  const isUpdating = useCallback(
    (taskId) => updatingStatus?.[taskId] === true,
    [updatingStatus]
  );

  const getMenuWithIngredients = useCallback(async (menuId) => {
    const key = String(menuId || "");
    if (!key) return null;

    if (menuCacheRef.current.has(key)) return menuCacheRef.current.get(key);

    const r = await api.get(`/cafe/menu-items/${encodeURIComponent(key)}/`);
    const full = r?.data || null;
    if (full) menuCacheRef.current.set(key, full);
    return full;
  }, []);

  const buildNeedForTask = useCallback(
    async (task) => {
      let menuId = extractMenuIdFromTask(task);

      if (!menuId && task?.id) {
        const detail = await tryFetchTaskDetail(task.id);
        if (detail) menuId = extractMenuIdFromTask(detail);
      }

      if (!menuId) {
        throw new Error("У блюда не найден ID для списания со склада.");
      }

      let full = null;
      try {
        full = await getMenuWithIngredients(menuId);
      } catch (e) {
        const status = e?.response?.status;
        if (status === 404) {
          throw new Error("Блюдо не найдено в меню. Обратитесь к администратору.");
        }
        throw new Error("Не удалось получить данные блюда. Попробуйте ещё раз.");
      }

      if (!full) throw new Error("Не удалось получить данные блюда. Попробуйте ещё раз.");

      const recipeRows = extractRecipeRows(full);
      if (!recipeRows.length) {
        throw new Error("У блюда не настроены ингредиенты. Обратитесь к администратору.");
      }

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

      if (!need.size) {
        throw new Error("У блюда не настроены ингредиенты. Обратитесь к администратору.");
      }

      return need;
    },
    [getMenuWithIngredients]
  );

  const updateWarehouseItem = useCallback(async (item, nextRem) => {
    if (!item?.id) throw new Error("Позиция склада без ID.");

    try {
      await api.patch(`/cafe/warehouse/${item.id}/`, { remainder: numStr(nextRem) });
      return;
    } catch {
      // fallback to PUT
    }

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
        if (have < needQty) {
          lacks.push(String(pid));
        }
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
        } catch {
          // ignore rollback failure
        }
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
        } catch {
          // ignore
        }
      }
    },
    [updateWarehouseItem]
  );

  const groups = useMemo(() => {
    const base = Array.isArray(tasks) ? tasks : [];
    const map = new Map();

    for (const t of base) {
      const orderId = pickOrderId(t);
      const minute = toMinuteKey(t?.created_at);
      const fallbackKey = `tbl:${String(t?.table_number ?? "")}|w:${String(
        t?.waiter_label ?? ""
      )}|g:${String(t?.guest ?? "")}|c:${minute}`;

      const key = orderId ? `order:${orderId}` : fallbackKey;

      if (!map.has(key)) {
        map.set(key, {
          key,
          orderId,
          table_number: t?.table_number ?? "—",
          guest: t?.guest ?? "",
          waiter_label: t?.waiter_label ?? "",
          created_at: t?.created_at ?? "",
          items: [],
        });
      }

      const g = map.get(key);
      g.items.push(t);

      const cur = new Date(g.created_at || 0).getTime();
      const next = new Date(t?.created_at || 0).getTime();
      if (next > cur) g.created_at = t?.created_at ?? g.created_at;

      if (!g.waiter_label && t?.waiter_label) g.waiter_label = t.waiter_label;
      if (!g.guest && t?.guest) g.guest = t.guest;
      if (!g.table_number && t?.table_number) g.table_number = t.table_number;
    }

    let arr = Array.from(map.values()).map((g) => {
      const items = (g.items || []).slice().sort((a, b) => {
        const ai = Number(a?.unit_index) || 0;
        const bi = Number(b?.unit_index) || 0;
        if (ai !== bi) return ai - bi;
        return String(a?.menu_item_title ?? "").localeCompare(
          String(b?.menu_item_title ?? "")
        );
      });

      return {
        ...g,
        items,
        status: computeGroupStatus(items),
      };
    });

    const stLabels = {
      pending: "ожидает",
      in_progress: "в работе",
      ready: "готов",
      cancelled: "отменён",
      canceled: "отменён",
    };

    if (statusFilter !== "all") {
      const sf = statusFilter === "cancelled" ? "cancelled" : statusFilter;
      arr = arr.filter((g) => String(g.status || "") === sf);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      arr = arr.filter((g) => {
        const tNum = String(g.table_number ?? "").toLowerCase();
        const guest = String(g.guest ?? "").toLowerCase();
        const waiter = String(g.waiter_label ?? "").toLowerCase();
        const st = String(g.status ?? "").toLowerCase();

        if (tNum.includes(q)) return true;
        if (guest.includes(q)) return true;
        if (waiter.includes(q)) return true;
        if (st.includes(q) || stLabels[st]?.includes(q)) return true;

        return (g.items || []).some((it) => {
          const title = String(it?.menu_item_title ?? "").toLowerCase();
          const unit = String(it?.unit_index ?? "").toLowerCase();
          const price = String(it?.price ?? "").toLowerCase();
          const ist = String(it?.status ?? "").toLowerCase();
          return (
            title.includes(q) ||
            unit.includes(q) ||
            price.includes(q) ||
            ist.includes(q) ||
            stLabels[ist]?.includes(q)
          );
        });
      });
    }

    return arr.sort((a, b) => {
      const da = new Date(a.created_at || 0).getTime();
      const db = new Date(b.created_at || 0).getTime();
      return db - da;
    });
  }, [tasks, query, statusFilter]);

  // default collapsed for new groups
  useEffect(() => {
    if (!groups.length) return;
    setCollapsed((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (next[g.key] === undefined) next[g.key] = true;
      }
      return next;
    });
  }, [groups]);

  const toggleGroup = useCallback((key) => {
    setCollapsed((p) => ({ ...p, [key]: !p[key] }));
  }, []);

  const handleClaimOne = useCallback(
    async (taskId, e) => {
      if (e?.preventDefault) e.preventDefault();

      try {
        await dispatch(claimKitchenTaskAsync(taskId)).unwrap();
        refetch();
      } catch (err) {
        console.error("Не удалось взять порцию в работу:", err);
        showNotice("error", toUserMessage(err));
      }
    },
    [dispatch, refetch, showNotice]
  );

  const handleReadyOne = useCallback(
    async (task, e) => {
      if (e?.preventDefault) e.preventDefault();

      const taskId = task?.id;
      if (!taskId) return;

      try {
        const needMap = await buildNeedForTask(task);

        const dec = await applyWarehouseDecreaseSafe(needMap);
        if (!dec.ok) {
          showNotice("error", dec.message || "Нельзя отметить «Готово»: не хватает ингредиентов.");
          return;
        }

        try {
          await dispatch(readyKitchenTaskAsync(taskId)).unwrap();
          showNotice("ok", "Отмечено как готово.");
        } catch (eReady) {
          try {
            await applyWarehouseIncreaseSafe(needMap);
          } catch {
            // ignore
          }
          console.error("Не удалось отметить как готово:", eReady);
          showNotice("error", toUserMessage(eReady));
          return;
        }

        // никаких browser dialogs и никаких принудительных обновлений
        refetch();
      } catch (err) {
        console.error("Списание/готово ошибка:", err);
        showNotice("error", toUserMessage(err));
        refetch();
      }
    },
    [
      dispatch,
      refetch,
      showNotice,
      buildNeedForTask,
      applyWarehouseDecreaseSafe,
      applyWarehouseIncreaseSafe,
    ]
  );

  const statusOptions = useMemo(
    () => [
      { value: "all", label: "Все статусы" },
      { value: "pending", label: "Ожидает" },
      { value: "in_progress", label: "В работе" },
      { value: "ready", label: "Готов" },
      { value: "cancelled", label: "Отменён" },
    ],
    []
  );

  return (
    <section className="cook">
      <CookHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        query={query}
        setQuery={setQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        statusOptions={statusOptions}
      />

      {notice?.text ? (
        <div className={`cook__notice cook__notice--${notice.type}`}>
          <div className="cook__noticeText">{notice.text}</div>
          <button
            className="cook__noticeClose"
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Закрыть"
            title="Закрыть"
          >
            ×
          </button>
        </div>
      ) : null}

      <div className="cook__list" aria-busy={loading ? "true" : "false"}>
        {loading && (
          <div className="cook__alert cook__alert--neutral">Загрузка…</div>
        )}

        {error && (
          <div className="cook__alert">
            Ошибка: {error?.message || error?.detail || String(error)}
          </div>
        )}

        {!loading && !error && groups.length === 0 && (
          <div className="cook__alert cook__alert--neutral">
            {query.trim()
              ? `Ничего не найдено по запросу «${query}»`
              : activeTab === "current"
              ? "Нет текущих задач"
              : "История пуста"}
          </div>
        )}

        {!loading &&
          !error &&
          groups.map((g) => (
            <CookReceiptCard
              key={g.key}
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
            />
          ))}
      </div>
    </section>
  );
};

export default Cook;
