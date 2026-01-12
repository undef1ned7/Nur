// src/.../Cook.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FaSearch, FaCheckCircle, FaClock } from "react-icons/fa";
import api from "../../../../api";
import {
  fetchKitchenTasksAsync,
  claimKitchenTaskAsync,
  readyKitchenTaskAsync,
} from "../../../../store/creators/cafeOrdersCreators";
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
    cancelled: "Отменен",
    canceled: "Отменен",
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
      // try next
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

const Cook = () => {
  const dispatch = useDispatch();
  const { tasks, loading, error, updatingStatus } = useSelector(
    (state) => state.cafeOrders
  );

  const [activeTab, setActiveTab] = useState("current"); // "current" | "history"
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState({}); // { [groupKey]: boolean }

  const menuCacheRef = useRef(new Map()); // menuId -> full menu object

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

  const isUpdating = (taskId) => updatingStatus?.[taskId] === true;

  const getMenuWithIngredients = async (menuId) => {
    const key = String(menuId || "");
    if (!key) return null;

    if (menuCacheRef.current.has(key)) return menuCacheRef.current.get(key);

    const r = await api.get(`/cafe/menu-items/${encodeURIComponent(key)}/`);
    const full = r?.data || null;
    if (full) menuCacheRef.current.set(key, full);
    return full;
  };

  const buildNeedForTask = async (task) => {
    let menuId = extractMenuIdFromTask(task);

    if (!menuId && task?.id) {
      const detail = await tryFetchTaskDetail(task.id);
      if (detail) menuId = extractMenuIdFromTask(detail);
    }

    if (!menuId) {
      throw new Error(
        "В задаче кухни нет menu_item id. Нужен ID блюда (uuid), а не только title."
      );
    }

    let full = null;
    try {
      full = await getMenuWithIngredients(menuId);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 404) {
        throw new Error(
          `Блюдо меню не найдено: GET /cafe/menu-items/${menuId}/ вернул 404. Проверь, что kitchen task отдаёт правильный menu_item id.`
        );
      }
      throw new Error(
        `Не удалось получить блюдо меню (id=${menuId}). Ошибка API: ${
          status || "network"
        }`
      );
    }

    if (!full) throw new Error(`Не удалось получить блюдо меню (id=${menuId}).`);

    const recipeRows = extractRecipeRows(full);
    if (!recipeRows.length) {
      throw new Error(
        `У блюда (id=${menuId}) ингредиенты пустые. Проверь, что ingredients сохраняются и GET /cafe/menu-items/${menuId}/ отдаёт ingredients.`
      );
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
      throw new Error(
        `ingredients у блюда (id=${menuId}) есть, но в строках нет поля product. По swagger должно быть row.product.`
      );
    }

    return need;
  };

  const updateWarehouseItem = async (item, nextRem) => {
    if (!item?.id) throw new Error("Позиция склада без id.");

    try {
      await api.patch(`/cafe/warehouse/${item.id}/`, {
        remainder: numStr(nextRem),
      });
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
  };

  const applyWarehouseDecreaseSafe = async (needMap) => {
    if (!needMap || !needMap.size) return { ok: true };

    const wr = await api.get("/cafe/warehouse/");
    const stock = listFrom(wr) || [];
    const stockMap = new Map(stock.map((s) => [String(s.id), s]));

    const lacks = [];
    for (const [pid, needQty] of needMap.entries()) {
      const s = stockMap.get(String(pid));
      if (!s) {
        lacks.push(`${pid}: нет на складе`);
        continue;
      }
      const have = toNum(s?.remainder);
      if (have < needQty) {
        lacks.push(`${s?.title || pid}: надо ${needQty}, есть ${have}`);
      }
    }

    if (lacks.length) {
      return { ok: false, message: "Недостаточно на складе:\n" + lacks.join("\n") };
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
  };

  const applyWarehouseIncreaseSafe = async (needMap) => {
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
  };

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

    const q = query.trim().toLowerCase();
    if (q) {
      const stLabels = {
        pending: "ожидает",
        in_progress: "в работе",
        ready: "готов",
        cancelled: "отменен",
        canceled: "отменен",
      };

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
  }, [tasks, query]);

  const toggleGroup = (key) => {
    setCollapsed((p) => ({ ...p, [key]: !p[key] }));
  };

  const handleClaimOne = async (taskId) => {
    try {
      await dispatch(claimKitchenTaskAsync(taskId)).unwrap();
      refetch();
    } catch (e) {
      console.error("Не удалось взять порцию в работу:", e);
      alert(
        `Не удалось взять в работу: ${
          e?.message || e?.detail || e?.error || "Ошибка"
        }`
      );
    }
  };

  const handleReadyOne = async (task) => {
    const taskId = task?.id;
    if (!taskId) return;

    let needMap = null;

    try {
      needMap = await buildNeedForTask(task);

      const dec = await applyWarehouseDecreaseSafe(needMap);
      if (!dec.ok) {
        alert(dec.message || "Недостаточно на складе.");
        refetch();
        return;
      }

      try {
        await dispatch(readyKitchenTaskAsync(taskId)).unwrap();
      } catch (eReady) {
        try {
          await applyWarehouseIncreaseSafe(needMap);
        } catch {
          // ignore
        }

        alert(
          `Не удалось отметить как готово: ${
            eReady?.message || eReady?.detail || eReady?.error || "Ошибка"
          }`
        );
        refetch();
        return;
      }

      refetch();
      try {
        window.dispatchEvent(new CustomEvent("orders:refresh"));
      } catch {
        // ignore
      }
    } catch (e) {
      console.error("Списание/готово ошибка:", e);
      alert(
        `Списание не выполнено: ${e?.message || e?.detail || e?.error || "Ошибка"}`
      );
      refetch();
    }
  };

  return (
    <section className="cook">
      <div className="cook__header">
        <div>
          <h2 className="cook__title">Заказы повара</h2>
          <div className="cook__subtitle">
            Управление текущими задачами и просмотр истории
          </div>
        </div>

        <div className="cook__search">
          <FaSearch className="cook__searchIcon" />
          <input
            className="cook__searchInput"
            placeholder="Поиск: стол, клиент, блюдо, статус…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            autoComplete="off"
          />
          {query && (
            <button
              className="cook__searchClear"
              onClick={() => setQuery("")}
              title="Очистить поиск"
              type="button"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="cook__tabs">
        <button
          className={`cook__tab ${
            activeTab === "current" ? "cook__tab--active" : ""
          }`}
          onClick={() => setActiveTab("current")}
          type="button"
        >
          <FaClock /> Текущие задачи
        </button>
        <button
          className={`cook__tab ${
            activeTab === "history" ? "cook__tab--active" : ""
          }`}
          onClick={() => setActiveTab("history")}
          type="button"
        >
          <FaCheckCircle /> История
        </button>
      </div>

      <div className="cook__list">
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
          groups.map((g) => {
            const headerDate = formatReceiptDate(g.created_at);
            const isCollapsed = collapsed[g.key] === true;

            return (
              <article key={g.key} className="cook__receipt">
                <div className="cook__receiptHeader">
                  <div>
                    <div className="cook__receiptTable">
                      СТОЛ {g.table_number || "—"}
                    </div>
                    {g.guest ? (
                      <div className="cook__receiptClient">{g.guest}</div>
                    ) : null}
                    {g.waiter_label ? (
                      <div className="cook__receiptWaiter">
                        Официант: {g.waiter_label}
                      </div>
                    ) : null}
                  </div>

                  <div className="cook__receiptMeta">
                    {headerDate ? (
                      <div className="cook__receiptDate">{headerDate}</div>
                    ) : null}
                    <span
                      className={`cook__receiptStatusBadge cook__receiptStatusBadge--${g.status}`}
                      title="Общий статус заказа"
                    >
                      {getStatusLabel(g.status)}
                    </span>
                  </div>
                </div>

                <div className="cook__receiptDivider"></div>

                <div className="cook__summary">
                  <button
                    type="button"
                    className="cook__toggle"
                    onClick={() => toggleGroup(g.key)}
                    title={isCollapsed ? "Показать позиции" : "Свернуть позиции"}
                  >
                    {isCollapsed
                      ? `Показать позиции (${g.items.length})`
                      : `Свернуть позиции (${g.items.length})`}
                  </button>
                </div>

                {!isCollapsed && (
                  <div className="cook__rows">
                    {(g.items || []).map((t, idx) => {
                      const status = String(t?.status || "");
                      const isPending = status === "pending";
                      const isInProgress = status === "in_progress";
                      const isReady = status === "ready";
                      const updating = isUpdating(t.id);

                      const portions = extractPortionsFromTask(t);

                      return (
                        <div
                          key={t.id || idx}
                          className="cook__row"
                          title={
                            status === "in_progress" && t?.started_at
                              ? `Начато: ${formatReceiptDate(t.started_at)}`
                              : status === "ready" && t?.finished_at
                              ? `Готово: ${formatReceiptDate(t.finished_at)}`
                              : ""
                          }
                        >
                          <div className="cook__rowLeft">
                            <div className="cook__rowTitle">
                              {t?.menu_item_title || "Блюдо"}
                            </div>
                            <div className="cook__rowSub">
                              Кол-во: {portions}
                            </div>
                          </div>

                          <div className="cook__rowRight">
                            <div className="cook__rowPrice">
                              {toNum(t?.price)}
                            </div>

                            <span
                              className={`cook__receiptStatusBadge cook__receiptStatusBadge--${status}`}
                            >
                              {getStatusLabel(status)}
                            </span>

                            {activeTab === "current" ? (
                              <>
                                {isPending && (
                                  <button
                                    className="cook__btn cook__btn--inProgress cook__btn--compact"
                                    onClick={() => handleClaimOne(t.id)}
                                    disabled={updating}
                                    type="button"
                                  >
                                    {updating ? "…" : "В работу"}
                                  </button>
                                )}

                                {isInProgress && (
                                  <button
                                    className="cook__btn cook__btn--ready cook__btn--compact"
                                    onClick={() => handleReadyOne(t)}
                                    disabled={updating}
                                    type="button"
                                    title="ГОТОВ (списывает склад)"
                                  >
                                    {updating ? "…" : "Готов"}
                                  </button>
                                )}

                                {isReady && (
                                  <button
                                    className="cook__btn cook__btn--ready cook__btn--compact"
                                    disabled
                                    type="button"
                                  >
                                    Готов
                                  </button>
                                )}
                              </>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeTab === "history" && g.status === "ready" ? (
                  <div className="cook__receiptPaid">
                    <span className="cook__receiptPaidBadge">ГОТОВ</span>
                  </div>
                ) : null}
              </article>
            );
          })}
      </div>
    </section>
  );
};

export default Cook;
