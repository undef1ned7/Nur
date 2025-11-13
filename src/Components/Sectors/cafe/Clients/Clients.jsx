import React, { useEffect, useMemo, useState } from "react";
import api from "../../../../api";
import {
  getAll,
  createClient,
  updateClient,
  removeClient,
  getOrdersByClient,
  getOrdersStatsByClient,
} from "./clientStore";
import "./clients.scss";

/* ===== helpers ===== */
const fmtMoney = (v) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(v) || 0) + " с";

const phoneNorm = (p) => (p || "").replace(/[^\d+]/g, "");
const asArray = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
const toNum = (v) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* DRF fetch-all (для столов) */
async function fetchAll(url0) {
  let url = url0;
  const acc = [];
  let guard = 0;
  while (url && guard < 80) {
    const { data } = await api.get(url);
    const arr = asArray(data);
    acc.push(...arr);
    url = data?.next || null;
    guard += 1;
  }
  return acc;
}

/* Блокировка скролла без «прыжков» при открытии модалок */
function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return;

    const scrollY =
      window.scrollY ||
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      0;

    const original = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflowY: document.body.style.overflowY,
      paddingRight: document.body.style.paddingRight,
    };

    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflowY = "scroll";
    if (scrollbarW > 0) {
      document.body.style.paddingRight = `${scrollbarW}px`;
    }
    document.body.classList.add("modal-open");

    return () => {
      const y = Math.abs(parseInt(document.body.style.top || "0", 10)) || 0;

      document.body.style.position = original.position;
      document.body.style.top = original.top;
      document.body.style.width = original.width;
      document.body.style.overflowY = original.overflowY;
      document.body.style.paddingRight = original.paddingRight;
      document.body.classList.remove("modal-open");

      window.scrollTo(0, y);
    };
  }, [active]);
}

/* ===== основной компонент ===== */
const Clients = () => {
  const [rows, setRows] = useState([]); // клиенты + {orders_count, updated_at_derived}
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editId, setEditId] = useState(null);

  const [openId, setOpenId] = useState(null); // карточка клиента

  const [tablesMap, setTablesMap] = useState(new Map()); // id -> {number, places}

  // Блокировка скролла, когда открыта любая модалка
  const anyModalOpen = isFormOpen || !!openId;
  useBodyScrollLock(anyModalOpen);

  // прогрессивная подгрузка «Заказы/Обновлён» для таблицы (concurrency 4)
  const hydrateStats = async (clientsList) => {
    const ids = clientsList.map((c) => c.id);
    let idx = 0;
    const POOL = 4;

    const worker = async () => {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const i = idx++;
        if (i >= ids.length) break;
        const id = ids[i];
        try {
          const stats = await getOrdersStatsByClient(id);
          setRows((prev) => {
            const next = prev.map((c) =>
              String(c.id) === String(id)
                ? {
                    ...c,
                    orders_count: stats.orders_count,
                    updated_at_derived: stats.updated_at_derived,
                  }
                : c
            );
            return next.sort(
              (a, b) =>
                new Date(b.updated_at_derived || b.updated_at || 0) -
                new Date(a.updated_at_derived || a.updated_at || 0)
            );
          });
        } catch (_) {
          /* ignore */
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(POOL, ids.length) }, worker)
    );
  };

  /* ===== загрузка: клиенты + столы ===== */
  const load = async () => {
    try {
      setLoading(true);
      setErr("");

      const [clients, tables] = await Promise.all([
        getAll(), // /cafe/clients/
        fetchAll("/cafe/tables/"), // для номера стола
      ]);

      const tablesM = new Map(
        tables.map((t) => [
          String(t.id),
          { id: t.id, number: t.number, places: t.places },
        ])
      );
      setTablesMap(tablesM);

      // первичное заполнение (если сервер вернёт embedded orders)
      const augmented = clients.map((c) => {
        const arr = Array.isArray(c.orders) ? c.orders : [];
        const updated_at_derived = arr.length
          ? arr
              .map((o) => o.created_at)
              .filter(Boolean)
              .sort()
              .slice(-1)[0]
          : null;

        return {
          ...c,
          orders_count: arr.length || 0,
          updated_at_derived,
        };
      });

      setRows(
        augmented.sort(
          (a, b) =>
            new Date(b.updated_at_derived || b.updated_at || 0) -
            new Date(a.updated_at_derived || a.updated_at || 0)
        )
      );

      // догрузка статистики для таблицы
      hydrateStats(augmented);
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить клиентов");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // клиент создан из Orders -> добавить сразу
  useEffect(() => {
    const onClientsRefresh = (e) => {
      const c = e?.detail?.client;
      if (!c) return;
      setRows((prev) => {
        const exists = prev.some((x) => String(x.id) === String(c.id));
        const row = {
          ...c,
          orders_count: 0,
          updated_at_derived: c.updated_at || null,
        };
        const next = exists
          ? prev.map((x) => (String(x.id) === String(c.id) ? row : x))
          : [row, ...prev];
        return next.sort(
          (a, b) =>
            new Date(b.updated_at_derived || b.updated_at || 0) -
            new Date(a.updated_at_derived || a.updated_at || 0)
        );
      });
      // подгрузим stats для нового клиента
      getOrdersStatsByClient(c.id)
        .then((stats) =>
          setRows((prev) =>
            prev.map((x) =>
              String(x.id) === String(c.id)
                ? {
                    ...x,
                    orders_count: stats.orders_count,
                    updated_at_derived: stats.updated_at_derived,
                  }
                : x
            )
          )
        )
        .catch(() => {});
    };
    window.addEventListener("clients:refresh", onClientsRefresh);
    return () =>
      window.removeEventListener("clients:refresh", onClientsRefresh);
  }, []);

  // заказ создан -> увеличить счётчик и время обновления
  useEffect(() => {
    const onOrderCreated = (e) => {
      const o = e?.detail?.order;
      if (!o?.client) return;
      setRows((prev) =>
        prev.map((c) =>
          String(c.id) === String(o.client)
            ? {
                ...c,
                orders_count: (Number(c.orders_count) || 0) + 1,
                updated_at_derived: new Date().toISOString(),
              }
            : c
        )
      );
    };
    window.addEventListener("clients:order-created", onOrderCreated);
    return () =>
      window.removeEventListener("clients:order-created", onOrderCreated);
  }, []);

  /* ===== CRUD клиента ===== */
  const onCreate = () => {
    setEditId(null);
    setIsFormOpen(true);
  };
  const onEdit = (id) => {
    setEditId(id);
    setIsFormOpen(true);
  };
  const onDelete = async (id) => {
    if (!window.confirm("Удалить клиента?")) return;
    try {
      await removeClient(id);
      await load();
    } catch (e) {
      console.error(e);
      alert("Ошибка удаления");
    }
  };

  const onOpenCard = (id) => setOpenId(id);
  const onCloseCard = () => setOpenId(null);

  /* ===== поиск ===== */
  const filtered = useMemo(() => {
    const sterm = q.trim().toLowerCase();
    if (!sterm) return rows;
    return rows.filter((r) =>
      `${r.full_name} ${r.phone}`.toLowerCase().includes(sterm)
    );
  }, [rows, q]);

  /* ===== Render ===== */
  return (
    <section className="clients">
      <header className="clients__header">
        <div>
          <h2 className="clients__title">Гости</h2>
        </div>
        <div className="clients__actions">
          <div className="clients__search">
            <span className="clients__searchIcon">🔎</span>
            <input
              className="clients__searchInput"
              placeholder="Поиск по имени и телефону…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button
            className="clients__btn clients__btn--primary"
            onClick={onCreate}
          >
            + Гость
          </button>
        </div>
      </header>

      {err && <div className="clients__error">{err}</div>}

      <div className="clients__tableWrap">
        <table className="clients__table">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Телефон</th>
              <th>Заказы</th>
              <th>Обновлён</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="clients__empty" colSpan={5}>
                  Загрузка…
                </td>
              </tr>
            ) : filtered.length ? (
              filtered.map((c) => {
                const updated = c.updated_at_derived || c.updated_at;
                return (
                  <tr key={c.id}>
                    <td className="clients__ellipsis" title={c.full_name}>
                      {c.full_name || "—"}
                    </td>
                    <td>{c.phone || "—"}</td>
                    <td>{c.orders_count ?? 0}</td>
                    <td>
                      {updated ? new Date(updated).toLocaleString() : "—"}
                    </td>
                    <td className="clients__rowActions">
                      <button
                        className="clients__btn"
                        onClick={() => onOpenCard(c.id)}
                      >
                        Открыть
                      </button>
                      <button
                        className="clients__btn"
                        onClick={() => onEdit(c.id)}
                      >
                        Изм.
                      </button>
                      <button
                        className="clients__btn clients__btn--secondary"
                        onClick={() => onDelete(c.id)}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="clients__empty" colSpan={5}>
                  Ничего не найдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <ClientForm
          id={editId}
          onClose={() => setIsFormOpen(false)}
          afterSave={load}
          rows={rows}
        />
      )}

      {openId && (
        <ClientCard id={openId} onClose={onCloseCard} tablesMap={tablesMap} />
      )}
    </section>
  );
};

/* ===== форма клиента ===== */
const ClientForm = ({ id, onClose, afterSave, rows }) => {
  const editing = !!id;
  const current = editing ? rows.find((c) => c.id === id) : null;

  const [full_name, setFullName] = useState(current?.full_name || "");
  const [phone, setPhone] = useState(current?.phone || "");
  const [notes, setNotes] = useState(current?.notes || "");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    if (!full_name.trim()) {
      setErr("Введите имя");
      return;
    }

    const normalizedPhone = phoneNorm(phone);
    const others = (rows || []).filter((c) => !editing || c.id !== id);
    if (
      normalizedPhone &&
      others.some((c) => phoneNorm(c.phone) === normalizedPhone)
    ) {
      setErr("Такой телефон уже есть");
      return;
    }

    setSaving(true);
    try {
      const dto = {
        full_name: full_name.trim(),
        phone: normalizedPhone,
        notes: (notes || "").trim(),
      };
      if (editing) {
        await updateClient(id, dto);
      } else {
        const created = await createClient(dto);
        window.dispatchEvent(
          new CustomEvent("clients:refresh", { detail: { client: created } })
        );
      }
      await afterSave?.();
      onClose();
    } catch (e2) {
      console.error(e2);
      setErr("Не удалось сохранить клиента");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="clients__modalOverlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="clients__modal" onClick={(e) => e.stopPropagation()}>
        <div className="clients__modalHeader">
          <div className="clients__modalTitle">
            {editing ? "Редактировать гостя" : "Новый гость"}
          </div>
          <button
            className="clients__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        {err && (
          <div className="clients__error" style={{ marginTop: 8 }}>
            {err}
          </div>
        )}

        <form className="clients__form" onSubmit={submit}>
          <div className="clients__formGrid">
            <div className="clients__field">
              <label className="clients__label">Имя *</label>
              <input
                className="clients__input"
                value={full_name}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="clients__field">
              <label className="clients__label">Телефон</label>
              <input
                className="clients__input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+996700000000"
              />
            </div>

            <div className="clients__field" style={{ gridColumn: "1/-1" }}>
              <label className="clients__label">Заметки</label>
              <textarea
                className="clients__input"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="clients__formActions">
            <button
              type="button"
              className="clients__btn"
              onClick={onClose}
              disabled={saving}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="clients__btn clients__btn--primary"
              disabled={saving}
            >
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ===== карточка клиента + модалка деталей заказа ===== */
const ClientCard = ({ id, onClose, tablesMap }) => {
  const [tab, setTab] = useState("profile");
  const [client, setClient] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openOrder, setOpenOrder] = useState(null); // ← МОДАЛКА ДЕТАЛЕЙ

  // закрытие по ESC (включая модалку заказа)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (openOrder) setOpenOrder(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, openOrder]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const all = await getAll(); // клиенты
        const c = all.find((x) => String(x.id) === String(id)) || null;
        const ords = await getOrdersByClient(id); // активные + история
        if (mounted) {
          setClient(c);
          setOrders(ords);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  // live-обновления
  useEffect(() => {
    const onOrderCreated = (e) => {
      const o = e?.detail?.order;
      if (!o || String(o.client) !== String(id)) return;
      setOrders((prev) => {
        const exists = prev.some((x) => String(x.id) === String(o.id));
        if (exists) return prev;
        const basic = {
          id: o.id,
          table: o.table ?? null,
          table_name: o.table_name ?? o.table_label ?? o.table_number ?? "",
          guests: o.guests ?? 0,
          status: o.status ?? "",
          created_at: o.created_at || new Date().toISOString(),
          items: Array.isArray(o.items) ? o.items : [],
          total: Number(o.total) || 0,
        };
        return [basic, ...prev];
      });
    };

    const onClientsRefresh = (e) => {
      const c = e?.detail?.client;
      if (!c || String(c.id) !== String(id)) return;
      setClient((prev) => ({ ...(prev || {}), ...c }));
    };

    window.addEventListener("clients:order-created", onOrderCreated);
    window.addEventListener("clients:refresh", onClientsRefresh);
    return () => {
      window.removeEventListener("clients:order-created", onOrderCreated);
      window.removeEventListener("clients:refresh", onClientsRefresh);
    };
  }, [id]);

  if (!client) return loading ? null : null;

  const lastUpdated =
    orders
      .map((o) => o.created_at)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] ||
    client.updated_at ||
    client.updated_at_derived ||
    null;

  const tableLabel = (order) => {
    if (order.table_name) return String(order.table_name);
    const t = tablesMap.get(String(order.table));
    if (t?.number != null) return `Стол ${t.number}`;
    return "Стол —";
  };

  // ——— helpers для модалки заказа ———
  const itemName = (it) =>
    it?.menu_item_name || it?.name || it?.title || "Без названия";
  const itemPrice = (it) =>
    toNum(it.menu_item_price ?? it.price ?? it.price_each ?? 0);
  const itemQty = (it) => Number(it.quantity) || 0;
  const lineTotal = (it) => itemPrice(it) * itemQty(it);

  return (
    <div
      className="clients__modalOverlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="clients__modalWide" onClick={(e) => e.stopPropagation()}>
        <div className="clients__modalHeader">
          <div className="clients__modalTitle">Клиент — {client.full_name}</div>
          <button
            className="clients__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="clients__cardHeader">
          <div className="clients__profile">
            <div>
              <strong>Телефон:</strong> {client.phone || "—"}
            </div>
          </div>
          <div className="clients__stats">
            <div className="clients__statBox">
              <div className="clients__statVal">{orders.length}</div>
              <div className="clients__statLabel">Заказы</div>
            </div>
            <div className="clients__statBox">
              <div className="clients__statVal">
                {lastUpdated ? new Date(lastUpdated).toLocaleString() : "—"}
              </div>
              <div className="clients__statLabel">Обновлён</div>
            </div>
          </div>
        </div>

        <div className="clients__tabs">
          <button
            className={`clients__tab ${
              tab === "profile" ? "clients__tab--active" : ""
            }`}
            onClick={() => setTab("profile")}
          >
            Профиль
          </button>
          <button
            className={`clients__tab ${
              tab === "orders" ? "clients__tab--active" : ""
            }`}
            onClick={() => setTab("orders")}
          >
            Заказы
          </button>
        </div>

        {tab === "profile" && (
          <div className="clients__profileBody">
            <div className="clients__notes">
              <strong>Заметки:</strong>
              <div className="clients__noteArea">{client.notes || "—"}</div>
            </div>
          </div>
        )}

        {tab === "orders" && (
          <div className="clients__tableWrap">
            <table className="clients__table">
              <thead>
                <tr>
                  <th>Стол</th>
                  <th>Гостей</th>
                  <th>Статус</th>
                  <th>Сумма</th>
                  <th>Создан</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="clients__empty" colSpan={5}>
                      Загрузка…
                    </td>
                  </tr>
                ) : orders.length ? (
                  orders
                    .slice()
                    .sort((a, b) =>
                      (b.created_at || "").localeCompare(a.created_at || "")
                    )
                    .map((o) => (
                      <tr
                        key={o.id}
                        className="clients__rowClickable"
                        style={{ cursor: "pointer" }}
                        onClick={() => setOpenOrder(o)}
                        title="Открыть детали заказа"
                      >
                        <td>{tableLabel(o)}</td>
                        <td>{o.guests ?? "—"}</td>
                        <td>{o.status || "—"}</td>
                        <td>{fmtMoney(o.total)}</td>
                        <td>
                          {o.created_at
                            ? new Date(o.created_at).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td className="clients__empty" colSpan={5}>
                      Заказов нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="clients__modalFooter">
          <button className="clients__btn" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>

      {/* ───────────── модалка «Детали заказа» ───────────── */}
      {openOrder && (
        <div
          className="clients__modalOverlay"
          onClick={() => setOpenOrder(null)}
        >
          <div
            className="clients__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="clients__modalHeader">
              <div id="order-detail-title" className="clients__modalTitle">
                🧾 Детали заказа
              </div>
              <button
                className="clients__iconBtn"
                onClick={() => setOpenOrder(null)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            {/* Краткая сводка */}
            <div className="clients__form" style={{ paddingTop: 0 }}>
              <div className="clients__formGrid">
                <div className="clients__field">
                  <label className="clients__label">Стол</label>
                  <div>{tableLabel(openOrder)}</div>
                </div>
                <div className="clients__field">
                  <label className="clients__label">Гостей</label>
                  <div>{openOrder.guests ?? "—"}</div>
                </div>
                <div className="clients__field">
                  <label className="clients__label">Статус</label>
                  <div>{openOrder.status || "—"}</div>
                </div>
                <div className="clients__field">
                  <label className="clients__label">Создан</label>
                  <div>
                    {openOrder.created_at
                      ? new Date(openOrder.created_at).toLocaleString()
                      : "—"}
                  </div>
                </div>
              </div>

              {/* Таблица позиций */}
              <div className="clients__tableWrap" style={{ marginTop: 10 }}>
                <table className="clients__table">
                  <thead>
                    <tr>
                      <th>Позиция</th>
                      <th>Кол-во</th>
                      <th>Цена</th>
                      <th>Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(openOrder.items || []).length ? (
                      openOrder.items.map((it, i) => (
                        <tr key={i}>
                          <td
                            className="clients__ellipsis"
                            title={itemName(it)}
                          >
                            {itemName(it)}
                          </td>
                          <td>{itemQty(it)}</td>
                          <td>{fmtMoney(itemPrice(it))}</td>
                          <td>{fmtMoney(lineTotal(it))}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="clients__empty" colSpan={4}>
                          Нет позиций
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {openOrder.items?.length ? (
                    <tfoot>
                      <tr>
                        <th colSpan={3} style={{ textAlign: "right" }}>
                          Итого:
                        </th>
                        <th>{fmtMoney(openOrder.total)}</th>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            </div>

            <div className="clients__modalFooter">
              <button
                className="clients__btn"
                onClick={() => setOpenOrder(null)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
