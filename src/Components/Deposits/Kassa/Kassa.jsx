import React, { useEffect, useMemo, useState } from "react";
import {
  useNavigate,
  useParams,
  Link,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { Search, Plus, Table2, LayoutGrid } from "lucide-react";
import api from "../../../api";
import Reports from "./Reports/Reports";
import "./kassa.scss";
import { useUser } from "../../../store/slices/userSlice";

/* Base path */
const BASE = "/crm/kassa";

/* helpers */
const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
const listFrom = (res) => res?.data?.results || res?.data || [];
const money = (v) =>
  (Number(v) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 0 }) + " c";
const when = (iso) => (iso ? new Date(iso).toLocaleDateString() : "—");
const toNum = (x) => Number(String(x).replace(",", ".")) || 0;
const numStr = (n) => String(Number(n) || 0).replace(",", ".");

// НЕОПЛАЧЕН = любой, КРОМЕ paid / отменён / закрыт
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

/* ───────────────────────────────────────────────── */
/* Рендер по pathname, чтобы контент гарантированно показывался (вложенные Routes могут не матчить в RR v6) */
const CafeKassa = () => {
  const { pathname } = useLocation();
  const normalized = pathname.replace(/\/+$/, "") || BASE;
  const baseNorm = BASE.replace(/\/+$/, "");

  if (normalized !== baseNorm) {
    const afterBase = normalized.slice(baseNorm.length + 1);
    const idSegment = afterBase.split("/")[0];
    if (idSegment) return <CashboxDetail id={idSegment} />;
  }
  return <CashboxList />;
};

/* Шапка страницы кассы */
const HeaderTabs = ({ rightAction }) => (
  <div className="kassa-header">
    <div className="kassa-header__left">
      <div className="kassa-header__icon-box">💰</div>
      <div className="kassa-header__title-section">
        <h1 className="kassa-header__title">Касса</h1>
      </div>
    </div>
    <div className="kassa-header__right">{rightAction}</div>
  </div>
);

/* ──────────────────────────────── Список касс */
const VIEW_STORAGE_KEY = "kassa-view-mode";
const getInitialViewMode = () => {
  if (typeof window === "undefined") return "table";
  const saved = localStorage.getItem(VIEW_STORAGE_KEY);
  if (saved === "table" || saved === "cards") return saved;
  return "table";
};

const CashboxList = () => {
  const { company } = useUser();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [checked, setChecked] = useState(false);
  const [viewMode, setViewMode] = useState(getInitialViewMode);
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const load = async () => {
    try {
      setErr("");
      setLoading(true);
      const { data } = await api.get("/construction/cashboxes/");
      setRows(asArray(data));
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить кассы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      [r.department_name, r.name].some((x) =>
        String(x || "")
          .toLowerCase()
          .includes(t)
      )
    );
  }, [rows, q]);

  const onCreate = async () => {
    const title = (name || "").trim();
    if (!title) return alert("Введите название кассы");
    try {
      await api.post("/construction/cashboxes/", {
        name: title,
        is_consumption: checked,
      });
      setCreateOpen(false);
      setName("");
      load();
    } catch (e) {
      console.error(e);
      alert("Не удалось создать кассу");
    }
  };

  return (
    <div className="kassa-page">
      <HeaderTabs
        rightAction={
          <button
            className="kassa-header__create-btn"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} />
            {company?.subscription_plan?.name === "Старт"
              ? "Создать кассу"
              : "Создать кассу для прочих расходов"}
          </button>
        }
      />

      <div className="kassa-search-section">
        <div className="kassa-search">
          <Search className="kassa-search__icon" size={18} />
          <input
            type="text"
            className="kassa-search__input"
            placeholder="Поиск по названию или отделу…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="kassa-search__meta">
          <span className="kassa-search__info">Всего: {filtered.length}</span>
          <div className="kassa-search__view-toggle">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`kassa-view-btn ${
                viewMode === "table" ? "kassa-view-btn--active" : ""
              }`}
              title="Таблица"
            >
              <Table2 size={16} />
              Таблица
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`kassa-view-btn ${
                viewMode === "cards" ? "kassa-view-btn--active" : ""
              }`}
              title="Карточки"
            >
              <LayoutGrid size={16} />
              Карточки
            </button>
          </div>
        </div>
      </div>

      {err && <div className="kassa__alert kassa__alert--error">{err}</div>}

      <div className="kassa-table-container">
        {viewMode === "table" && (
          <div className="kassa-table-scroll">
            <table className="kassa-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Название отдела</th>
                <th>Приход</th>
                <th>Расход</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="kassa-table__loading">
                    Загрузка…
                  </td>
                </tr>
              ) : filtered.length ? (
                filtered.map((r, i) => (
                  <tr
                    key={r.id}
                    className="kassa__rowClickable"
                    onClick={() => navigate(`${BASE}/${r.id}`)}
                  >
                    <td>{i + 1}</td>
                    <td>
                      <b>{r.department_name || r.name || "—"}</b>
                    </td>
                    <td>{money(r.analytics?.income_total || 0)}</td>
                    <td>{money(r.analytics?.expense_total || 0)}</td>
                    <td>
                      <button
                        className="kassa__btn kassa__btn--secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`${BASE}/${r.id}`);
                        }}
                      >
                        Открыть
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="kassa-table__empty">
                    Нет данных
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}

        {viewMode === "cards" && (
          <div className="kassa-cards-wrapper">
            {loading ? (
              <div className="kassa-cards-loading">Загрузка…</div>
            ) : filtered.length === 0 ? (
              <div className="kassa-cards-empty">Нет данных</div>
            ) : (
              <div className="kassa-cards">
                {filtered.map((r, i) => (
                  <div
                    key={r.id}
                    className="kassa-card"
                    onClick={() => navigate(`${BASE}/${r.id}`)}
                  >
                    <div className="kassa-card__header">
                      <span className="kassa-card__num">{i + 1}</span>
                      <h3 className="kassa-card__title">
                        {r.department_name || r.name || "—"}
                      </h3>
                    </div>
                    <div className="kassa-card__fields">
                      <div className="kassa-card__field">
                        <span className="kassa-card__label">Приход</span>
                        <span className="kassa-card__value kassa-card__value--income">
                          {money(r.analytics?.income_total || 0)}
                        </span>
                      </div>
                      <div className="kassa-card__field">
                        <span className="kassa-card__label">Расход</span>
                        <span className="kassa-card__value kassa-card__value--expense">
                          {money(r.analytics?.expense_total || 0)}
                        </span>
                      </div>
                    </div>
                    <div className="kassa-card__actions">
                      <button
                        type="button"
                        className="kassa__btn kassa__btn--secondary kassa-card__btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`${BASE}/${r.id}`);
                        }}
                      >
                        Открыть
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {createOpen && (
        <div className="kassa-modal" style={{ display: "block" }}>
          <div
            className="kassa-modal__overlay"
            onClick={() => setCreateOpen(false)}
          />
          <div
            className="kassa-modal__card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kassa-modal__header">
              <h3 className="kassa-modal__title">Создать кассу</h3>
              <button
                className="kassa-modal__close"
                onClick={() => setCreateOpen(false)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="kassa-modal__section">
              <label className="kassa-modal__label">Название кассы *</label>
              <input
                className="kassa-modal__input"
                type="text"
                placeholder="Например: касса №1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            {/* {console.log(checked)} */}
            <div className="kassa-modal__section" style={{ display: "flex" }}>
              <label className="kassa-modal__label">Прочие расходы *</label>
              <input
                className="kassa-modal__input"
                type="checkbox"
                placeholder="Например: касса №1"
                style={{ width: "max-content" }}
                value={checked}
                onChange={(e) => setChecked(!checked)}
                required
              />
            </div>
            <div className="kassa-modal__footer">
              <button
                className="kassa__btn kassa__btn--primary"
                onClick={onCreate}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ──────────────────────────────── Вкладка ОПЛАТА */
const CashboxPayment = () => {
  const [tables, setTables] = useState([]);
  const [zones, setZones] = useState([]);
  const [ordersUnpaid, setOrdersUnpaid] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [boxId, setBoxId] = useState("");
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState("");

  // Если у заказа нет items — подтягиваем подробности
  const hydrateOrdersDetails = async (list) => {
    const needIds = list
      .filter((o) => !Array.isArray(o.items) || o.items.length === 0)
      .map((o) => o.id);
    if (!needIds.length) return list;
    const details = await Promise.all(
      needIds.map((id) =>
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

  const loadAll = async () => {
    setLoading(true);
    try {
      const [tRes, zRes, oRes, bRes] = await Promise.all([
        api.get("/cafe/tables/"),
        api.get("/cafe/zones/"),
        api.get("/cafe/orders/"),
        api.get("/construction/cashboxes/").catch(() => ({ data: [] })),
      ]);

      const tablesArr = listFrom(tRes) || [];
      const zonesArr = listFrom(zRes) || [];
      setTables(tablesArr);
      setZones(zonesArr);

      const allOrders = listFrom(oRes) || [];
      const unpaid = allOrders.filter(
        (o) => o.table && isUnpaidStatus(o.status)
      );
      const full = await hydrateOrdersDetails(unpaid);
      setOrdersUnpaid(full);

      const allBoxes = listFrom(bRes) || [];
      const boxesArr = asArray(allBoxes);
      setBoxes(boxesArr);
      setBoxId(boxesArr[0]?.id || boxesArr[0]?.uuid || "");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Всегда выбираем первую кассу по индексу
  useEffect(() => {
    if (boxes.length > 0) {
      const firstBoxId = boxes[0]?.id || boxes[0]?.uuid || "";
      if (firstBoxId && firstBoxId !== boxId) {
        setBoxId(firstBoxId);
      }
    }
  }, [boxes, boxId]);

  const tablesMap = useMemo(
    () => new Map(tables.map((t) => [t.id, t])),
    [tables]
  );
  const zonesMap = useMemo(
    () => new Map(zones.map((z) => [z.id, z.title])),
    [zones]
  );
  const zoneTitleByAny = (zoneField) => {
    if (!zoneField) return "—";
    if (typeof zoneField === "string")
      return zonesMap.get(zoneField) || zoneField;
    return zoneField.title || zonesMap.get(zoneField.id) || "—";
  };

  const orderSum = (o) => {
    const totalField = Number(o.total ?? o.total_amount ?? o.sum ?? o.amount);
    if (Number.isFinite(totalField) && totalField > 0) return totalField;
    const items = Array.isArray(o.items) ? o.items : [];
    const linePrice = (it) => {
      if (it?.menu_item_price != null) return toNum(it.menu_item_price);
      if (it?.price != null) return toNum(it.price);
      return 0;
    };
    return items.reduce(
      (s, it) => s + linePrice(it) * (Number(it.quantity) || 0),
      0
    );
  };

  // Сгруппировать неоплаченные по столам
  const groups = useMemo(() => {
    const byTable = new Map();
    for (const o of ordersUnpaid) {
      const sum = orderSum(o);
      const acc = byTable.get(o.table) || { total: 0, orders: [] };
      acc.total += sum;
      acc.orders.push(o);
      byTable.set(o.table, acc);
    }
    return [...byTable.entries()].map(([tableId, v]) => ({
      table: tablesMap.get(tableId),
      tableId,
      total: v.total,
      orders: v.orders,
    }));
  }, [ordersUnpaid, tablesMap]);

  // Проставить заказу "paid" (с запасными вариантами)
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

  // Оплата
  const payTable = async (grp) => {
    if (!boxId) {
      alert("Создайте кассу в разделе «Кассы», чтобы принимать оплату.");
      return;
    }
    const t = grp.table;
    if (
      !window.confirm(
        `Оплатить стол ${t?.number ?? "—"} на сумму ${money(grp.total)} ?`
      )
    )
      return;

    setPayingId(grp.tableId);
    try {
      // 1) Приход в кассу
      await api.post("/construction/cashflows/", {
        cashbox: boxId,
        type: "income",
        name: `Оплата стол ${t?.number ?? ""}`,
        amount: numStr(grp.total),
      });

      // 2) Все заказы -> paid
      const okIds = [];
      await Promise.all(
        grp.orders.map(async (o) => {
          if (await markOrderPaid(o.id)) okIds.push(o.id);
        })
      );

      // 3) Попробовать удалить на сервере (если разрешено)
      await Promise.all(
        okIds.map(async (id) => {
          try {
            await api.delete(`/cafe/orders/${id}/`);
          } catch {}
        })
      );

      // 4) Убрать оплаченные из локального состояния
      setOrdersUnpaid((prev) => prev.filter((o) => !okIds.includes(o.id)));

      // 5) Освободить стол
      if (grp.tableId) {
        try {
          await api.patch(`/cafe/tables/${grp.tableId}/`, { status: "free" });
        } catch {
          try {
            await api.put(`/cafe/tables/${grp.tableId}/`, {
              number: grp.table?.number,
              zone: grp.table?.zone?.id || grp.table?.zone,
              places: grp.table?.places,
              status: "free",
            });
          } catch {}
        }
      }

      // 6) Сообщить вкладке Orders
      try {
        window.dispatchEvent(
          new CustomEvent("orders:refresh", {
            detail: { tableId: grp.tableId, orderIds: okIds },
          })
        );
      } catch {}

      // 7) Финальная синхронизация
      await loadAll();
    } catch (e) {
      console.error(e);
      alert("Не удалось провести оплату.");
    } finally {
      setPayingId("");
    }
  };

  return (
    <div className="kassa-page">
      <HeaderTabs />

      <div className="kassa-header">
        <div className="kassa-header__left">
          <div className="kassa-header__icon-box">💳</div>
          <div className="kassa-header__title-section">
            <h2 className="kassa-header__title">Оплата</h2>
            <p className="kassa-header__subtitle">
              Столы к оплате: {groups.length}
            </p>
          </div>
        </div>
      </div>

      <div className="kassa-search-section">
        <span className="kassa-search__info">
          {!boxId && boxes.length === 0 && (
            <span className="kassa__alert" style={{ color: "var(--danger)" }}>
              Создайте кассу в разделе «Кассы», чтобы принимать оплату.
            </span>
          )}
        </span>
        {boxId && boxes.length > 0 && (
          <select
            className="kassa-search__input"
            style={{ maxWidth: 280, paddingLeft: 12 }}
            value={boxId}
            onChange={(e) => setBoxId(e.target.value)}
          >
            {boxes.map((b) => (
              <option key={b.id || b.uuid} value={b.id || b.uuid}>
                {b.department_name || b.name || b.id}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="kassa-table-container">
        <table className="kassa-table">
          <thead>
            <tr>
              <th>Стол</th>
              <th>Зона</th>
              <th>Сумма к оплате</th>
              <th>Заказы</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="kassa-table__loading">
                  Загрузка…
                </td>
              </tr>
            ) : groups.length ? (
              groups.map((g) => (
                <tr key={g.tableId} className="kassa__rowPay">
                  <td>
                    <b>{g.table ? `Стол ${g.table.number}` : "—"}</b>
                  </td>
                  <td>{g.table ? zoneTitleByAny(g.table.zone) : "—"}</td>
                  <td>{money(g.total)}</td>
                  <td>{g.orders.length}</td>
                  <td>
                    <button
                      className="kassa__btn kassa__btn--primary"
                      onClick={() => payTable(g)}
                      disabled={payingId === g.tableId}
                    >
                      {payingId === g.tableId ? "Оплата…" : "Оплатить"}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="kassa-table__empty">
                  Нет столов, ожидающих оплаты
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ──────────────────────────────── Обёртка с отчётом */
const CashboxReports = () => (
  <div className="kassa-page">
    <HeaderTabs />
    <Reports />
  </div>
);

/* ──────────────────────────────── Детали кассы */
const CashboxDetail = ({ id: idProp }) => {
  const { id: idFromParams } = useParams();
  const id = idProp ?? idFromParams;
  const [searchParams, setSearchParams] = useSearchParams();
  const [box, setBox] = useState(null);
  const [ops, setOps] = useState([]);
  const tabFromUrl = searchParams.get("tab");
  const [tab, setTab] = useState(tabFromUrl || "all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Синхронизация tab с URL параметром
  useEffect(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab && ["income", "expense", "all"].includes(urlTab)) {
      if (urlTab !== tab) {
        setTab(urlTab);
      }
    } else if (!urlTab && tab !== "all") {
      // Если параметр удален из URL, сбрасываем на "all"
      setTab("all");
    }
  }, [searchParams, tab]);

  // Обновление URL при изменении tab
  const handleTabChange = (newTab) => {
    setTab(newTab);
    const params = new URLSearchParams(searchParams);
    if (newTab === "all") {
      params.delete("tab");
    } else {
      params.set("tab", newTab);
    }
    setSearchParams(params, { replace: true });
  };

  const fromAny = (res) => {
    const d = res?.data ?? res ?? [];
    if (Array.isArray(d?.results)) return d.results;
    if (Array.isArray(d)) return d;
    return [];
  };

  const load = async () => {
    setErr("");
    setLoading(true);
    try {
      let detail = null;
      try {
        detail = (await api.get(`/construction/cashboxes/${id}/detail/owner/`))
          .data;
      } catch {}
      if (!detail) {
        try {
          detail = (await api.get(`/construction/cashboxes/${id}/detail/`))
            .data;
        } catch {}
      }
      if (!detail) {
        detail = (await api.get(`/construction/cashboxes/${id}/`)).data;
      }

      setBox(detail);

      let flows =
        fromAny({ data: detail?.operations }) ||
        fromAny({ data: detail?.flows }) ||
        fromAny({ data: detail?.transactions });

      if (!flows.length) {
        try {
          const r1 = await api.get(`/construction/cashflows/`, {
            params: { cashbox: id },
          });
          flows = fromAny(r1);
        } catch {}
      }
      if (!flows.length && detail?.uuid) {
        try {
          const r2 = await api.get(`/construction/cashflows/`, {
            params: { cashbox: detail.uuid },
          });
          flows = fromAny(r2);
        } catch {}
      }

      const mapped = (flows || []).map((x, i) => {
        const amt = Number(x.amount ?? x.sum ?? x.value ?? x.total ?? 0) || 0;
        let type = String(x.type ?? x.kind ?? x.direction ?? "").toLowerCase();
        if (type !== "income" && type !== "expense")
          type = amt >= 0 ? "income" : "expense";
        return {
          id: x.id || x.uuid || `${i}`,
          type,
          title:
            x.title ||
            x.name ||
            x.description ||
            x.note ||
            (type === "income" ? "Приход" : "Расход"),
          amount: Math.abs(amt),
          created_at:
            x.created_at ||
            x.created ||
            x.date ||
            x.timestamp ||
            x.createdAt ||
            null,
        };
      });

      setOps(mapped);
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить детали кассы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const shown = useMemo(() => {
    if (tab === "income") return ops.filter((o) => o.type === "income");
    if (tab === "expense") return ops.filter((o) => o.type === "expense");
    return ops;
  }, [ops, tab]);

  return (
    <div className="kassa-page">
      <div className="kassa-header">
        <div className="kassa-header__left">
          <div className="kassa-header__icon-box">📦</div>
          <div className="kassa-header__title-section">
            <h2 className="kassa-header__title">
              {box?.department_name || box?.name || "Касса"}
            </h2>
            <p className="kassa-header__subtitle">Операции по кассе</p>
          </div>
        </div>
        <nav className="kassa-header__nav-tabs">
          <Link className="kassa-header__nav-tab" to={BASE}>
            ← Назад
          </Link>
          <Link className="kassa-header__nav-tab" to={`${BASE}/pay`}>
            Оплата
          </Link>
          <Link className="kassa-header__nav-tab" to={`${BASE}/reports`}>
            Отчёты
          </Link>
        </nav>
      </div>

      <div className="kassa-search-section">
        <div className="kassa-chip-group">
          <button
            className={`kassa-chip ${
              tab === "expense" ? "kassa-chip--active" : ""
            }`}
            onClick={() => handleTabChange("expense")}
          >
            Расход
          </button>
          <button
            className={`kassa-chip ${
              tab === "income" ? "kassa-chip--active" : ""
            }`}
            onClick={() => handleTabChange("income")}
          >
            Приход
          </button>
          <button
            className={`kassa-chip ${
              tab === "all" ? "kassa-chip--active" : ""
            }`}
            onClick={() => handleTabChange("all")}
          >
            Все
          </button>
        </div>
        <button
          className="kassa-header__create-btn"
          onClick={() =>
            alert(
              "Добавление операции делается через API. Здесь доступен только просмотр."
            )
          }
        >
          <Plus size={16} />
          Добавить операцию
        </button>
      </div>

      <div className="kassa-table-container">
        <table className="kassa-table">
          <thead>
            <tr>
              <th>Тип</th>
              <th>Наименование</th>
              <th>Сумма</th>
              <th>Дата создания</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="kassa-table__loading">
                  Загрузка…
                </td>
              </tr>
            ) : err ? (
              <tr>
                <td colSpan={4} className="kassa__alert kassa__alert--error">
                  {err}
                </td>
              </tr>
            ) : shown.length ? (
              shown.map((o) => (
                <tr key={o.id}>
                  <td>{o.type === "income" ? "Приход" : "Расход"}</td>
                  <td>{o.title}</td>
                  <td>{money(o.amount)}</td>
                  <td>{when(o.created_at)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="kassa-table__empty">
                  Нет операций
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CafeKassa;
