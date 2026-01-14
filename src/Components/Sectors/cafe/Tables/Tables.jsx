// src/.../Tables.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaChair, FaMapMarkedAlt, FaTimes, FaPlus } from "react-icons/fa";
import api from "../../../../api";
import TablesHall from "./TablesHall";
import TablesZones from "./TablesZones";
import "./Tables.scss";

const listFrom = (r) => r?.data?.results || r?.data || [];
const asKey = (v) => (v === null || v === undefined ? "" : String(v));

const isActiveOrderStatus = (s) => {
  const v = String(s || "").toLowerCase();
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

const Tables = () => {
  const [activeTab, setActiveTab] = useState("tables"); // tables | zones
  const [tablesView, setTablesView] = useState("hall"); // hall | manage

  const [zones, setZones] = useState([]);
  const [tables, setTables] = useState([]);
  const [ordersActive, setOrdersActive] = useState([]);

  // confirm modal (no window.confirm)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmType, setConfirmType] = useState(""); // zone | table
  const [confirmId, setConfirmId] = useState(null);

  // ✅ прокидываем в Zones: открыть создание зоны из header
  const [zonesCreatePing, setZonesCreatePing] = useState(0);
  const pingCreateZone = () => setZonesCreatePing((n) => n + 1);

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
      const active = (Array.isArray(allOrders) ? allOrders : []).filter((ord) => {
        const tableId = ord?.table?.id ?? ord?.table;
        return tableId && isActiveOrderStatus(ord?.status);
      });

      const full = await hydrateOrdersDetails(active);
      setOrdersActive(full);
    } catch (e) {
      console.error("Ошибка начальной загрузки:", e);
    }
  }, [hydrateOrdersDetails]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const handler = () => loadAll();
    window.addEventListener("orders:refresh", handler);
    return () => window.removeEventListener("orders:refresh", handler);
  }, [loadAll]);

  const zonesMap = useMemo(() => new Map((zones || []).map((z) => [asKey(z.id), z.title])), [zones]);

  const zoneTitleByAny = useCallback(
    (zoneField) => {
      if (!zoneField) return "";
      if (typeof zoneField === "string" || typeof zoneField === "number") {
        return zonesMap.get(asKey(zoneField)) || String(zoneField);
      }
      return zoneField.title || zonesMap.get(asKey(zoneField.id)) || "";
    },
    [zonesMap]
  );

  const activeByTable = useMemo(() => {
    const m = new Map();
    for (const o of ordersActive || []) {
      const rawId = o?.table?.id ?? o?.table;
      const key = asKey(rawId);
      if (!key) continue;

      const ex = m.get(key) || { orders: [] };
      ex.orders.push(o);
      m.set(key, ex);
    }

    for (const v of m.values()) {
      v.orders.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    }
    return m;
  }, [ordersActive]);

  // auto-free
  useEffect(() => {
    const toFree = (tables || []).filter((t) => {
      const tKey = asKey(t?.id);
      return t && t.status !== "free" && tKey && !activeByTable.has(tKey);
    });
    if (!toFree.length) return;

    (async () => {
      for (const t of toFree) {
        try {
          await api.patch(`/cafe/tables/${t.id}/`, { status: "free" });
          setTables((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: "free" } : x)));
        } catch (e) {
          console.error("Не удалось освободить стол:", t.id, e);
        }
      }
    })();
  }, [activeByTable, tables]);

  // ===== zones CRUD =====
  const createZone = async (title) => {
    try {
      const res = await api.post("/cafe/zones/", { title });
      setZones((prev) => [...prev, res.data]);
      return true;
    } catch (e) {
      console.error("Ошибка создания зоны:", e);
      return false;
    }
  };

  const updateZone = async (id, title) => {
    try {
      const res = await api.put(`/cafe/zones/${id}/`, { title });
      setZones((prev) => prev.map((z) => (z.id === id ? res.data : z)));
      return true;
    } catch (e) {
      console.error("Ошибка обновления зоны:", e);
      return false;
    }
  };

  const removeZone = async (id) => {
    try {
      await api.delete(`/cafe/zones/${id}/`);
      setZones((prev) => prev.filter((z) => z.id !== id));
      setTables((prev) => prev.map((t) => ((t.zone?.id || t.zone) === id ? { ...t, zone: "" } : t)));
      return true;
    } catch (e) {
      console.error("Ошибка удаления зоны:", e);
      return false;
    }
  };

  // ===== tables CRUD =====
  const createTable = async (payload) => {
    try {
      const res = await api.post("/cafe/tables/", payload);
      setTables((prev) => [...prev, res.data]);
      return true;
    } catch (e) {
      console.error("Ошибка создания стола:", e);
      return false;
    }
  };

  const updateTable = async (id, payload) => {
    try {
      const res = await api.put(`/cafe/tables/${id}/`, payload);
      setTables((prev) => prev.map((t) => (t.id === id ? res.data : t)));
      return true;
    } catch (e) {
      console.error("Ошибка обновления стола:", e);
      return false;
    }
  };

  const removeTable = async (id) => {
    try {
      await api.delete(`/cafe/tables/${id}/`);
      setTables((prev) => prev.filter((t) => t.id !== id));
      return true;
    } catch (e) {
      console.error("Ошибка удаления стола:", e);
      return false;
    }
  };

  const headerTitle = activeTab === "tables" ? "Зал кафе" : "Зоны";
  const headerSubtitle =
    activeTab === "tables"
      ? "В “Зале” видно, какие блюда сейчас заказаны на каждом столе."
      : "Создавайте зоны и распределяйте по ним столы.";

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
      if (confirmType === "zone") {
        const ok = await removeZone(confirmId);
        if (ok) closeConfirm();
      }
      if (confirmType === "table") {
        const ok = await removeTable(confirmId);
        if (ok) closeConfirm();
      }
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <section className="tables">
      <div className="tables__header">
        <div className="tables__headLeft">
          <h2 className="tables__title">{headerTitle}</h2>
          <div className="tables__subtitle">{headerSubtitle}</div>
        </div>

        <div className="tables__headRight">
          <div className="tables__topActions">
            {activeTab === "tables" && (
              <div className="tables__viewSwitch" title="Режим отображения">
                <button
                  type="button"
                  className={`tables__viewBtn ${tablesView === "manage" ? "tables__viewBtn--active" : ""}`}
                  onClick={() => setTablesView("manage")}
                  aria-label="Список"
                >
                  ≡
                </button>
                <button
                  type="button"
                  className={`tables__viewBtn ${tablesView === "hall" ? "tables__viewBtn--active" : ""}`}
                  onClick={() => setTablesView("hall")}
                  aria-label="Зал"
                >
                  ▦
                </button>
              </div>
            )}

            {/* ✅ ВМЕСТЕ: переключатель + кнопка создания зоны (только в Зонах) */}
            <div className="tables__headGroup">
              <div className="tables__switch">
                <button
                  type="button"
                  className={`tables__switchBtn ${activeTab === "tables" ? "tables__switchBtn--active" : ""}`}
                  onClick={() => setActiveTab("tables")}
                >
                  <FaChair /> Столы
                </button>
                <button
                  type="button"
                  className={`tables__switchBtn ${activeTab === "zones" ? "tables__switchBtn--active" : ""}`}
                  onClick={() => setActiveTab("zones")}
                >
                  <FaMapMarkedAlt /> Зоны
                </button>
              </div>

              {activeTab === "zones" && (
                <button type="button" className="tables__btn tables__btn--success" onClick={pingCreateZone}>
                  <FaPlus /> Новая зона
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {activeTab === "tables" ? (
        <TablesHall
          zones={zones}
          tables={tables}
          activeByTable={activeByTable}
          zoneTitleByAny={zoneTitleByAny}
          tablesView={tablesView}
          createTable={createTable}
          updateTable={updateTable}
          openConfirm={openConfirm}
        />
      ) : (
        <TablesZones
          zones={zones}
          tables={tables}
          createZone={createZone}
          updateZone={updateZone}
          openConfirm={openConfirm}
          createPing={zonesCreatePing}
        />
      )}

      {confirmOpen && (
        <div className="tables__modalOverlay" onClick={closeConfirm}>
          <div className="tables__modal tables__modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="tables__modalHeader">
              <h3 className="tables__modalTitle">{confirmText.title}</h3>
              <button className="tables__iconBtn" type="button" onClick={closeConfirm} aria-label="Закрыть" disabled={confirmBusy}>
                <FaTimes />
              </button>
            </div>

            <div className="tables__confirmBody">
              <div className="tables__confirmText">{confirmText.body}</div>

              <div className="tables__formActions">
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
