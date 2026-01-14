// src/.../Tables.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  FaSearch,
  FaPlus,
  FaTimes,
  FaChair,
  FaTrash,
  FaEdit,
  FaMapMarkedAlt,
  FaListUl,
  FaThLarge,
} from "react-icons/fa";
import api from "../../../../api";
import "./Tables.scss";

const STATUSES = [
  { value: "free", label: "Свободен" },
  { value: "busy", label: "Занят" },
];

const listFrom = (r) => r?.data?.results || r?.data || [];

const isActiveOrderStatus = (s) => {
  const v = (s || "").toString().toLowerCase();
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

const toId = (v) => {
  if (v === "" || v === undefined || v === null) return null;
  const s = String(v);
  return /^\d+$/.test(s) ? Number(s) : s;
};

const toNum = (x) => {
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const formatHallDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm}.${yy} ${hh}:${mi}`;
  } catch {
    return String(dateStr);
  }
};

const pickItemTitle = (it) =>
  String(
    it?.menu_item_title ??
      it?.menu_title ??
      it?.menu_item?.title ??
      it?.menu_item?.name ??
      it?.title ??
      it?.name ??
      ""
  ).trim();

const Tables = () => {
  const [activeTab, setActiveTab] = useState("tables");

  // ✅ 2 кнопки справа: управление / зал
  const [tablesView, setTablesView] = useState("manage"); // manage | hall

  // zones
  const [zones, setZones] = useState([]);
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [zoneEditId, setZoneEditId] = useState(null);
  const [zoneTitle, setZoneTitle] = useState("");

  // tables
  const [tables, setTables] = useState([]);
  const [query, setQuery] = useState("");
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [tableEditId, setTableEditId] = useState(null);
  const [form, setForm] = useState({
    number: "",
    zone: "",
    places: 2,
    status: "free",
  });

  // orders (активные по статусу)
  const [ordersActive, setOrdersActive] = useState([]);

  // confirm modal (no window.confirm)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmType, setConfirmType] = useState(""); // "zone" | "table"
  const [confirmId, setConfirmId] = useState(null);

  const openConfirm = (type, id) => {
    setConfirmType(type);
    setConfirmId(id);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (confirmBusy) return;
    setConfirmOpen(false);
    setConfirmType("");
    setConfirmId(null);
  };

  const fetchZones = useCallback(async () => {
    const z = await api.get("/cafe/zones/");
    setZones(listFrom(z) || []);
  }, []);

  const fetchTables = useCallback(async () => {
    const t = await api.get("/cafe/tables/");
    setTables(listFrom(t) || []);
  }, []);

  // если items не пришли — дотянем деталями (только нужные)
  const hydrateOrdersDetails = useCallback(async (list) => {
    const needIds = (list || [])
      .filter((o) => o?.id && (!Array.isArray(o.items) || o.items.length === 0))
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

    return (list || []).map((o) => {
      const d = details.find((x) => x && x.id === o.id)?.data;
      return d ? { ...o, ...d } : o;
    });
  }, []);

  const fetchOrdersActive = useCallback(async () => {
    const o = await api.get("/cafe/orders/");
    const all = listFrom(o) || [];
    const active = (Array.isArray(all) ? all : [])
      .filter((ord) => ord?.table && isActiveOrderStatus(ord.status));

    const full = await hydrateOrdersDetails(active);
    setOrdersActive(full);
  }, [hydrateOrdersDetails]);

  const loadAll = useCallback(async () => {
    try {
      const [z, t, o] = await Promise.all([
        api.get("/cafe/zones/"),
        api.get("/cafe/tables/"),
        api.get("/cafe/orders/"),
      ]);

      setZones(listFrom(z) || []);
      setTables(listFrom(t) || []);

      const allOrders = listFrom(o) || [];
      const active = (Array.isArray(allOrders) ? allOrders : [])
        .filter((ord) => ord?.table && isActiveOrderStatus(ord.status));

      const full = await hydrateOrdersDetails(active);
      setOrdersActive(full);
    } catch (e) {
      console.error("Ошибка начальной загрузки:", e);
    }
  }, [hydrateOrdersDetails]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // refresh after changes
  useEffect(() => {
    const handler = () => {
      fetchOrdersActive();
      fetchTables();
    };
    window.addEventListener("orders:refresh", handler);
    return () => window.removeEventListener("orders:refresh", handler);
  }, [fetchOrdersActive, fetchTables]);

  // dictionaries
  const zonesMap = useMemo(() => new Map(zones.map((z) => [String(z.id), z.title])), [zones]);

  const zoneTitleByAny = useCallback(
    (zoneField) => {
      if (!zoneField) return "";
      if (typeof zoneField === "string" || typeof zoneField === "number") {
        return zonesMap.get(String(zoneField)) || String(zoneField);
      }
      return zoneField.title || zonesMap.get(String(zoneField.id)) || "";
    },
    [zonesMap]
  );

  // активные заказы по столам
  const activeByTable = useMemo(() => {
    const m = new Map();
    for (const o of ordersActive) {
      const key = o.table;
      if (!key) continue;
      const ex = m.get(key) || { orders: [] };
      ex.orders.push(o);
      m.set(key, ex);
    }
    // сортируем внутри каждого стола по created_at
    for (const v of m.values()) {
      v.orders.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    }
    return m;
  }, [ordersActive]);

  // auto-free: если у стола нет активных заказов — переводим в free
  useEffect(() => {
    const toFree = tables.filter((t) => t && t.status !== "free" && !activeByTable.has(t.id));
    if (!toFree.length) return;

    (async () => {
      for (const t of toFree) {
        try {
          await api.patch(`/cafe/tables/${t.id}/`, { status: "free" });
          setTables((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: "free" } : x)));
        } catch {
          try {
            await api.put(`/cafe/tables/${t.id}/`, {
              number: t.number,
              zone: toId(t.zone?.id || t.zone),
              places: t.places,
              status: "free",
            });
            setTables((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: "free" } : x)));
          } catch (e2) {
            console.error("Не удалось освободить стол", t.id, e2);
          }
        }
      }
    })();
  }, [activeByTable, tables]);

  // ✅ сортировка столов по номеру + поиск (нумерация по порядку)
  const filteredTables = useMemo(() => {
    const q = query.trim().toLowerCase();

    const sorted = [...tables].sort((a, b) => {
      const an = Number(a?.number) || 0;
      const bn = Number(b?.number) || 0;
      if (an !== bn) return an - bn;
      return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
    });

    if (!q) return sorted;

    return sorted.filter((t) => {
      const num = String(t.number || "").toLowerCase();
      const zoneTxt = (zoneTitleByAny(t.zone) || "").toLowerCase();
      const st = String(t.status || "").toLowerCase();
      return num.includes(q) || zoneTxt.includes(q) || st.includes(q);
    });
  }, [tables, query, zoneTitleByAny]);

  /* ───────── ZONES ───────── */
  const openCreateZone = () => {
    setZoneEditId(null);
    setZoneTitle("");
    setZoneModalOpen(true);
  };

  const openEditZone = (z) => {
    setZoneEditId(z.id);
    setZoneTitle(z.title || "");
    setZoneModalOpen(true);
  };

  const saveZone = async (e) => {
    e.preventDefault();
    const payload = { title: zoneTitle.trim() };
    if (!payload.title) return;

    try {
      if (zoneEditId) {
        const res = await api.put(`/cafe/zones/${zoneEditId}/`, payload);
        setZones((prev) => prev.map((z) => (z.id === zoneEditId ? res.data : z)));
      } else {
        const res = await api.post("/cafe/zones/", payload);
        setZones((prev) => [...prev, res.data]);
      }
      setZoneModalOpen(false);
    } catch (e2) {
      console.error("Ошибка сохранения зоны:", e2);
    }
  };

  const doRemoveZone = async (id) => {
    try {
      await api.delete(`/cafe/zones/${id}/`);
      setZones((prev) => prev.filter((z) => z.id !== id));
      setTables((prev) => prev.map((t) => ((t.zone?.id || t.zone) === id ? { ...t, zone: "" } : t)));
    } catch (e) {
      console.error("Ошибка удаления зоны:", e);
    }
  };

  /* ───────── TABLES ───────── */
  const openCreateTable = () => {
    setTableEditId(null);
    setForm({
      number: "",
      zone: zones[0]?.id || "",
      places: 2,
      status: "free",
    });
    setTableModalOpen(true);
  };

  const openEditTable = (row) => {
    setTableEditId(row.id);
    setForm({
      number: row.number ?? "",
      zone: row.zone?.id || row.zone || "",
      places: row.places ?? 1,
      status: row.status || "free",
    });
    setTableModalOpen(true);
  };

  const saveTable = async (e) => {
    e.preventDefault();
    const payload = {
      number: Number(form.number) || 0,
      zone: toId(form.zone),
      places: Math.max(1, Number(form.places) || 1),
      status: ["free", "busy"].includes(form.status) ? form.status : "free",
    };
    if (!payload.number || !payload.zone) return;

    try {
      if (tableEditId) {
        const res = await api.put(`/cafe/tables/${tableEditId}/`, payload);
        setTables((prev) => prev.map((t) => (t.id === tableEditId ? res.data : t)));
      } else {
        const res = await api.post("/cafe/tables/", payload);
        setTables((prev) => [...prev, res.data]);
      }
      setTableModalOpen(false);
    } catch (e2) {
      console.error("Ошибка сохранения стола:", e2);
    }
  };

  const doRemoveTable = async (id) => {
    try {
      await api.delete(`/cafe/tables/${id}/`);
      setTables((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error("Ошибка удаления стола:", e);
    }
  };

  const confirmText = useMemo(() => {
    if (!confirmOpen) return { title: "", body: "" };
    if (confirmType === "zone") return { title: "Удалить зону?", body: "Зона будет удалена. Это действие нельзя отменить." };
    if (confirmType === "table") return { title: "Удалить стол?", body: "Стол будет удалён. Это действие нельзя отменить." };
    return { title: "Подтверждение", body: "" };
  }, [confirmOpen, confirmType]);

  const confirmDelete = async () => {
    if (!confirmType || !confirmId) return;
    setConfirmBusy(true);
    try {
      if (confirmType === "zone") await doRemoveZone(confirmId);
      if (confirmType === "table") await doRemoveTable(confirmId);
      closeConfirm();
    } finally {
      setConfirmBusy(false);
    }
  };

  // ========= UI Renders =========

  const renderManageList = () => (
    <div className="tables__list">
      {filteredTables.map((t) => {
        const hasActive = !!activeByTable.get(t.id);
        return (
          <article key={t.id} className={`tables__card ${hasActive ? "tables__card--busy" : ""}`}>
            <div className="tables__card-left">
              <div className="tables__avatar" aria-hidden>
                <FaChair />
              </div>
              <div className="tables__cardBody">
                <h3 className="tables__name">Стол {t.number}</h3>
                <div className="tables__meta">
                  <span className="tables__muted">Зона: {zoneTitleByAny(t.zone) || "—"}</span>
                  <span className="tables__muted">Мест: {t.places}</span>
                  <span className={`tables__pill ${hasActive ? "tables__pill--busy" : "tables__pill--free"}`}>
                    {hasActive ? "ЗАНЯТ" : "СВОБОДЕН"}
                  </span>
                </div>
              </div>
            </div>

            <div className="tables__rowActions">
              <button className="tables__btn tables__btn--secondary" onClick={() => openEditTable(t)} type="button">
                <FaEdit /> Изменить
              </button>
              <button className="tables__btn tables__btn--danger" onClick={() => openConfirm("table", t.id)} type="button">
                <FaTrash /> Удалить
              </button>
            </div>
          </article>
        );
      })}

      {!filteredTables.length && <div className="tables__alert">Ничего не найдено по запросу «{query}».</div>}
    </div>
  );

  // ✅ дизайн “как на скрине”: карточка стола + блюда + нижняя полоса статуса
  const renderHall = () => (
    <div className="tables__hallGrid">
      {filteredTables.map((t) => {
        const group = activeByTable.get(t.id);
        const latest = group?.orders?.[0] || null;

        const items = group?.orders?.flatMap((o) => (Array.isArray(o.items) ? o.items : [])) || [];

        // собрать блюдо -> qty (чтобы не было дублей, но можно показать x2)
        const agg = new Map();
        for (const it of items) {
          const title = pickItemTitle(it);
          if (!title) continue;
          const qty = Math.max(1, Number(it?.quantity) || 1);
          agg.set(title, (agg.get(title) || 0) + qty);
        }

        const dishes = Array.from(agg.entries())
          .sort((a, b) => a[0].localeCompare(b[0], "ru"))
          .map(([title, qty]) => (qty > 1 ? `${title} x${qty}` : title));

        const isBusy = dishes.length > 0; // занято, если есть активные блюда
        const date = formatHallDate(latest?.created_at || latest?.created || latest?.date);

        return (
          <article key={t.id} className="tables__hallCard">
            <div className="tables__hallHead">
              <div className="tables__hallTitle">СТОЛ {t.number}</div>
              <div className="tables__hallDate">{date}</div>
            </div>

            <div className="tables__hallBody">
              {dishes.length ? (
                <div className="tables__dishes">
                  {dishes.slice(0, 6).map((name, idx) => (
                    <div key={`${t.id}-${idx}`} className="tables__dish">
                      {name}
                    </div>
                  ))}
                  {dishes.length > 6 && (
                    <div className="tables__dish tables__dish--more">+ ещё {dishes.length - 6}</div>
                  )}
                </div>
              ) : (
                <div className="tables__hallEmpty">Нет активного заказа</div>
              )}
            </div>

            <div className={`tables__hallStatus ${isBusy ? "tables__hallStatus--busy" : "tables__hallStatus--free"}`}>
              {isBusy ? "ЗАНЯТ" : "СВОБОДЕН"}
            </div>
          </article>
        );
      })}
    </div>
  );

  return (
    <section className="tables">
      <div className="tables__header">
        <div className="tables__headLeft">
          <h2 className="tables__title">Зал кафе</h2>
          <div className="tables__subtitle">В “Зале” видно, какие блюда сейчас заказаны на каждом столе.</div>
        </div>

        <div className="tables__headRight">
          {activeTab === "tables" && (
            <div className="tables__viewSwitch" title="Режим отображения">
              <button
                type="button"
                className={`tables__viewBtn ${tablesView === "manage" ? "tables__viewBtn--active" : ""}`}
                onClick={() => setTablesView("manage")}
                aria-label="Управление"
              >
                <FaListUl />
              </button>
              <button
                type="button"
                className={`tables__viewBtn ${tablesView === "hall" ? "tables__viewBtn--active" : ""}`}
                onClick={() => setTablesView("hall")}
                aria-label="Зал"
              >
                <FaThLarge />
              </button>
            </div>
          )}

          <div className="tables__actions">
            <button
              type="button"
              className={`tables__btn ${activeTab === "tables" ? "tables__btn--primary" : "tables__btn--secondary"}`}
              onClick={() => setActiveTab("tables")}
            >
              <FaChair /> Столы
            </button>
            <button
              type="button"
              className={`tables__btn ${activeTab === "zones" ? "tables__btn--primary" : "tables__btn--secondary"}`}
              onClick={() => setActiveTab("zones")}
            >
              <FaMapMarkedAlt /> Зоны
            </button>
          </div>
        </div>
      </div>

      {activeTab === "tables" && (
        <>
          <div className="tables__actions tables__actions--sub">
            <div className="tables__search">
              <FaSearch className="tables__search-icon" />
              <input
                className="tables__search-input"
                placeholder="Поиск по столам: номер, зона, статус…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {tablesView === "manage" && (
              <button
                type="button"
                className="tables__btn tables__btn--primary"
                onClick={openCreateTable}
                disabled={!zones.length}
                title={!zones.length ? "Сначала добавьте зону" : ""}
              >
                <FaPlus /> Добавить стол
              </button>
            )}
          </div>

          {tablesView === "manage" ? renderManageList() : renderHall()}
        </>
      )}

      {activeTab === "zones" && (
        <>
          <div className="tables__actions tables__actions--sub">
            <button type="button" className="tables__btn tables__btn--success" onClick={openCreateZone}>
              <FaPlus /> Новая зона
            </button>
          </div>

          <div className="tables__list">
            {zones.map((z) => (
              <article key={z.id} className="tables__card">
                <div className="tables__card-left">
                  <div className="tables__avatar" aria-hidden>
                    {(z.title || "Z")[0]}
                  </div>
                  <div className="tables__cardBody">
                    <h3 className="tables__name">{z.title}</h3>
                    <div className="tables__meta">
                      <span className="tables__muted">
                        Столов: {tables.filter((t) => (t.zone?.id || t.zone) === z.id).length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="tables__rowActions">
                  <button type="button" className="tables__btn tables__btn--secondary" onClick={() => openEditZone(z)}>
                    <FaEdit /> Изменить
                  </button>
                  <button type="button" className="tables__btn tables__btn--danger" onClick={() => openConfirm("zone", z.id)}>
                    <FaTrash /> Удалить
                  </button>
                </div>
              </article>
            ))}

            {!zones.length && <div className="tables__alert">Зон пока нет.</div>}
          </div>
        </>
      )}

      {/* Zone modal */}
      {zoneModalOpen && (
        <div className="tables__modal-overlay" onClick={() => setZoneModalOpen(false)}>
          <div className="tables__modal" onClick={(e) => e.stopPropagation()}>
            <div className="tables__modal-header">
              <h3 className="tables__modal-title">{zoneEditId ? "Редактировать зону" : "Новая зона"}</h3>
              <button className="tables__icon-btn" type="button" onClick={() => setZoneModalOpen(false)} aria-label="Закрыть">
                <FaTimes />
              </button>
            </div>

            <form className="tables__form" onSubmit={saveZone}>
              <div className="tables__field tables__field--full">
                <label className="tables__label">Название зоны</label>
                <input
                  className="tables__input"
                  value={zoneTitle}
                  onChange={(e) => setZoneTitle(e.target.value)}
                  placeholder="Например: Этаж 1, VIP, Терраса"
                  required
                  maxLength={255}
                />
              </div>

              <div className="tables__form-actions">
                <button type="button" className="tables__btn tables__btn--secondary" onClick={() => setZoneModalOpen(false)}>
                  Отмена
                </button>
                <button type="submit" className="tables__btn tables__btn--primary">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table modal */}
      {tableModalOpen && (
        <div className="tables__modal-overlay" onClick={() => setTableModalOpen(false)}>
          <div className="tables__modal" onClick={(e) => e.stopPropagation()}>
            <div className="tables__modal-header">
              <h3 className="tables__modal-title">{tableEditId ? "Редактировать стол" : "Новый стол"}</h3>
              <button className="tables__icon-btn" type="button" onClick={() => setTableModalOpen(false)} aria-label="Закрыть">
                <FaTimes />
              </button>
            </div>

            <form className="tables__form" onSubmit={saveTable}>
              <div className="tables__form-grid">
                <div className="tables__field">
                  <label className="tables__label">Номер</label>
                  <input
                    type="number"
                    className="tables__input"
                    value={form.number}
                    onChange={(e) => setForm((f) => ({ ...f, number: Number(e.target.value) }))}
                    required
                  />
                </div>

                <div className="tables__field">
                  <label className="tables__label">Зона</label>
                  <select
                    className="tables__input"
                    value={form.zone}
                    onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
                    required
                  >
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="tables__field">
                  <label className="tables__label">Мест</label>
                  <input
                    type="number"
                    min="1"
                    className="tables__input"
                    value={form.places}
                    onChange={(e) => setForm((f) => ({ ...f, places: Number(e.target.value) }))}
                    required
                  />
                </div>

                <div className="tables__field">
                  <label className="tables__label">Статус</label>
                  <select
                    className="tables__input"
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="tables__form-actions">
                <button type="button" className="tables__btn tables__btn--secondary" onClick={() => setTableModalOpen(false)}>
                  Отмена
                </button>
                <button type="submit" className="tables__btn tables__btn--primary">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirmOpen && (
        <div className="tables__modal-overlay" onClick={closeConfirm}>
          <div className="tables__modal tables__modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="tables__modal-header">
              <h3 className="tables__modal-title">{confirmText.title}</h3>
              <button className="tables__icon-btn" type="button" onClick={closeConfirm} aria-label="Закрыть" disabled={confirmBusy}>
                <FaTimes />
              </button>
            </div>

            <div className="tables__confirmBody">
              <div className="tables__confirmText">{confirmText.body}</div>

              <div className="tables__form-actions">
                <button type="button" className="tables__btn tables__btn--secondary" onClick={closeConfirm} disabled={confirmBusy}>
                  Отмена
                </button>
                <button type="button" className="tables__btn tables__btn--danger" onClick={confirmDelete} disabled={confirmBusy}>
                  {confirmBusy ? "Удаление…" : "Удалить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Tables;
