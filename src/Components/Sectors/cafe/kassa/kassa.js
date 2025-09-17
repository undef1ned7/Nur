import React, { useEffect, useMemo, useState } from "react";
import {
  Routes,
  Route,
  useNavigate,
  useParams,
  Link,
  useLocation,
} from "react-router-dom";
import api from "../../../../api";
import Reports from "../Reports/Reports";
import "./kassa.scss";

/* Base path */
const BASE = "/crm/cafe/kassa";

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
const CafeKassa = () => (
  <Routes>
    <Route index element={<CashboxList />} />
    <Route path="pay" element={<CashboxPayment />} />
    <Route path="reports" element={<CashboxReports />} />
    <Route path=":id" element={<CashboxDetail />} />
  </Routes>
);

/* Верхние вкладки */
const HeaderTabs = () => {
  const { pathname } = useLocation();
  const isList = /\/kassa\/?$/.test(pathname);
  const isReports = /\/kassa\/reports\/?$/.test(pathname);
  const isPay = /\/kassa\/pay\/?$/.test(pathname);

  return (
    <div className="kassa__header">
      <div className="kassa__tabs">
        <Link
          className={`kassa__tab ${isList ? "kassa__tab--active" : ""}`}
          to={BASE}
        >
          Кассы
        </Link>
        <Link
          className={`kassa__tab ${isPay ? "kassa__tab--active" : ""}`}
          to={`${BASE}/pay`}
        >
          Оплата
        </Link>
        <Link
          className={`kassa__tab ${isReports ? "kassa__tab--active" : ""}`}
          to={`${BASE}/reports`}
        >
          Отчёты
        </Link>
      </div>
    </div>
  );
};

/* ──────────────────────────────── Список касс */
const CashboxList = () => {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const navigate = useNavigate();

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
      await api.post("/construction/cashboxes/", { name: title });
      setCreateOpen(false);
      setName("");
      load();
    } catch (e) {
      console.error(e);
      alert("Не удалось создать кассу");
    }
  };

  return (
    <div className="kassa">
      <HeaderTabs />

      <div className="kassa__toolbar">
        <div className="kassa__toolbarGroup">
          <span className="kassa__total">Всего: {filtered.length}</span>
        </div>

        <div className="kassa__controls">
          <div className="kassa__searchWrap">
            <input
              className="kassa__input"
              type="text"
              placeholder="Поиск…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button
            className="kassa__btn kassa__btn--primary"
            onClick={() => setCreateOpen(true)}
          >
            Создать кассу
          </button>
        </div>
      </div>

      {err && <div className="kassa__alert kassa__alert--error">{err}</div>}

      <div className="kassa__tableWrap">
        <table className="kassa__table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Название Отдела</th>
              <th>Приход</th>
              <th>Расход</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>Загрузка…</td>
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
                  <td>{money(r.analytics?.income?.total || 0)}</td>
                  <td>{money(r.analytics?.expense?.total || 0)}</td>
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
                <td colSpan={5} className="kassa__center">
                  Нет данных
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <div className="kassa-modal">
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
    <div className="kassa">
      <HeaderTabs />

      <div className="kassa__toolbar">
        <div className="kassa__toolbarGroup">
          <span className="kassa__total">К оплате столов: {groups.length}</span>
        </div>

        <div className="kassa__controls">
          <select
            className="kassa__input"
            value={boxId}
            onChange={(e) => setBoxId(e.target.value)}
            title="Касса для приёма оплаты"
          >
            {boxes.map((b) => (
              <option key={b.id || b.uuid} value={b.id || b.uuid}>
                {b.department_name || b.name || "Касса"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="kassa__tableWrap">
        <table className="kassa__table">
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
                <td colSpan={5}>Загрузка…</td>
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
                <td colSpan={5} className="kassa__center">
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
  <div className="kassa">
    <HeaderTabs />
    <Reports />
  </div>
);

/* ──────────────────────────────── Детали кассы */
const CashboxDetail = () => {
  const { id } = useParams();
  const [box, setBox] = useState(null);
  const [ops, setOps] = useState([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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
    <div className="kassa">
      <div className="kassa__header">
        <div className="kassa__tabs">
          <Link className="kassa__tab" to={BASE}>
            ← Назад
          </Link>
          <span className="kassa__tab kassa__tab--active">
            {box?.department_name || box?.name || "Касса"}
          </span>
          <Link className="kassa__tab" to={`${BASE}/pay`}>
            Оплата
          </Link>
          <Link className="kassa__tab" to={`${BASE}/reports`}>
            Отчёты
          </Link>
        </div>
      </div>

      <div className="kassa__switch">
        <button
          className={`kassa__chip ${
            tab === "expense" ? "kassa__chip--active" : ""
          }`}
          onClick={() => setTab("expense")}
        >
          Расход
        </button>
        <button
          className={`kassa__chip ${
            tab === "income" ? "kassa__chip--active" : ""
          }`}
          onClick={() => setTab("income")}
        >
          Приход
        </button>
        <button
          className={`kassa__chip ${
            tab === "all" ? "kassa__chip--active" : ""
          }`}
          onClick={() => setTab("all")}
        >
          Все
        </button>
        <div className="kassa__grow" />
        <button
          className="kassa__btn kassa__btn--primary"
          onClick={() =>
            alert(
              "Добавление операции делается через API. Здесь доступен только просмотр."
            )
          }
        >
          Добавить операцию
        </button>
      </div>

      <div className="kassa__tableWrap">
        <table className="kassa__table">
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
                <td colSpan={4}>Загрузка…</td>
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
                <td colSpan={4}>Нет операций</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CafeKassa;
