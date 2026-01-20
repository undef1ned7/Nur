// src/Components/Sectors/cafe/Clients/ClientsModals.jsx
import React, { useEffect, useRef, useState } from "react";
import { FaTimes } from "react-icons/fa";

/* ===== confirm delete ===== */
const ConfirmDeleteModal = ({ busy, onClose, onConfirm }) => {
  return (
    <div
      className="cafeclients__modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      onClick={onClose}
    >
      <div className="cafeclients__modal" onClick={(e) => e.stopPropagation()}>
        <div className="cafeclients__modalHeader">
          <div id="confirm-delete-title" className="cafeclients__modalTitle">
            Удалить гостя
          </div>
          <button
            className="cafeclients__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
            type="button"
          >
            <FaTimes />
          </button>
        </div>

        <div className="cafeclients__modalBody">
          <div className="cafeclients__confirmText">
            Вы уверены? Это действие нельзя отменить.
          </div>
        </div>

        <div className="cafeclients__modalFooter">
          <button
            className="cafeclients__btn"
            onClick={onClose}
            disabled={busy}
            type="button"
          >
            Отмена
          </button>
          <button
            className="cafeclients__btn cafeclients__btn--primary"
            onClick={onConfirm}
            disabled={busy}
            type="button"
          >
            {busy ? "Удаление…" : "Удалить"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ===== form ===== */
const ClientForm = ({
  id,
  onClose,
  afterSave,
  rows,
  phoneNorm,
  createClient,
  updateClient,
}) => {
  const editing = !!id;

  const [full_name, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const nameRef = useRef(null);

  // синхронизируем поля при смене id/rows
  useEffect(() => {
    const current = editing
      ? (rows || []).find((c) => String(c.id) === String(id)) || null
      : null;

    setFullName(current?.full_name || "");
    setPhone(current?.phone || "");
    setNotes(current?.notes || "");
    setErr("");
  }, [editing, id, rows]);

  useEffect(() => {
    nameRef.current?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    if (!full_name.trim()) {
      setErr("Введите имя");
      return;
    }

    const normalizedPhone = phoneNorm(phone);
    const others = (rows || []).filter(
      (c) => !editing || String(c.id) !== String(id)
    );

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
      setErr("Не удалось сохранить гостя");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="cafeclients__modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-form-title"
      onClick={onClose}
    >
      <div className="cafeclients__modal" onClick={(e) => e.stopPropagation()}>
        <div className="cafeclients__modalHeader">
          <div id="client-form-title" className="cafeclients__modalTitle">
            {editing ? "Редактировать гостя" : "Новый гость"}
          </div>
          <button
            className="cafeclients__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
            type="button"
          >
            <FaTimes />
          </button>
        </div>

        <div className="cafeclients__modalBody">
          {err && <div className="cafeclients__error">{err}</div>}

          <form className="cafeclients__form" onSubmit={submit}>
            <div className="cafeclients__formGrid">
              <div className="cafeclients__field">
                <label className="cafeclients__label">Имя *</label>
                <input
                  ref={nameRef}
                  className="cafeclients__input"
                  value={full_name}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>

              <div className="cafeclients__field">
                <label className="cafeclients__label">Телефон</label>
                <input
                  className="cafeclients__input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+996700000000"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>

              <div className="cafeclients__field cafeclients__field--full">
                <label className="cafeclients__label">Заметки</label>
                <textarea
                  className="cafeclients__input"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="cafeclients__formActions">
              <button
                type="button"
                className="cafeclients__btn"
                onClick={onClose}
                disabled={saving}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="cafeclients__btn cafeclients__btn--primary"
                disabled={saving}
              >
                {saving ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

/* ===== card ===== */
const ClientCard = ({
  id,
  onClose,
  tablesMap,
  useMediaQuery,
  fetchAll,
  getAll,
  getOrdersByClient,
  toNum,
  fmtMoney,
}) => {
  const [tab, setTab] = useState("profile");
  const [client, setClient] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openOrder, setOpenOrder] = useState(null);
  const [menuMap, setMenuMap] = useState(new Map());

  const isNarrow = useMediaQuery("(max-width: 640px)");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const allMenu = await fetchAll("/cafe/menu-items/");
        const m = new Map(
          (Array.isArray(allMenu) ? allMenu : []).map((x) => [
            String(x.id),
            { title: x.title, price: toNum(x.price) },
          ])
        );
        if (mounted) setMenuMap(m);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchAll, toNum]);

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

        const all = await getAll();
        const c = all.find((x) => String(x.id) === String(id)) || null;

        const ords = await getOrdersByClient(id);

        if (mounted) {
          setClient(c);
          setOrders(Array.isArray(ords) ? ords : []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, getAll, getOrdersByClient]);

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

  if (!client) return null;

  const ordersSorted = orders
    .slice()
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  const lastUpdated =
    ordersSorted.map((o) => o.created_at).filter(Boolean).slice(0, 1)[0] ||
    client.updated_at ||
    client.updated_at_derived ||
    null;

  const tableLabel = (order) => {
    if (order.table_name) return String(order.table_name);
    const t = tablesMap.get(String(order.table));
    if (t?.number != null) return `Стол ${t.number}`;
    return "Стол —";
  };

  const itemName = (it) => {
    const direct =
      it?.menu_item_title ??
      it?.menu_title ??
      it?.menu_item_name ??
      it?.menu_item?.title ??
      it?.menu_item?.name ??
      it?.name ??
      it?.title ??
      "";

    const viaId =
      (it?.menu_item != null && menuMap.get(String(it.menu_item))?.title) ||
      (it?.menu_item_id != null && menuMap.get(String(it.menu_item_id))?.title) ||
      "";

    return String(direct || viaId || "").trim() || "Без названия";
  };

  const itemPrice = (it) => {
    const direct = toNum(it.menu_item_price ?? it.price ?? it.price_each ?? 0);
    if (direct > 0) return direct;

    const byId =
      (it?.menu_item != null && menuMap.get(String(it.menu_item))?.price) ||
      (it?.menu_item_id != null && menuMap.get(String(it.menu_item_id))?.price) ||
      0;

    return toNum(byId);
  };

  const itemQty = (it) => Number(it.quantity) || 0;
  const lineTotal = (it) => itemPrice(it) * itemQty(it);

  const orderTotal = (o) => {
    const t = toNum(o.total ?? o.total_amount ?? o.sum ?? o.amount);
    if (t > 0) return t;
    const items = Array.isArray(o.items) ? o.items : [];
    return items.reduce((s, it) => s + lineTotal(it), 0);
  };

  return (
    <div
      className="cafeclients__modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-card-title"
      onClick={onClose}
    >
      <div
        className="cafeclients__modalWide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cafeclients__modalHeader">
          <div id="client-card-title" className="cafeclients__modalTitle">
            Гость — {client.full_name || "—"}
          </div>
          <button
            className="cafeclients__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
            type="button"
          >
            <FaTimes />
          </button>
        </div>

        <div
          className={`cafeclients__modalBody ${
            openOrder ? "cafeclients__modalBody--locked" : ""
          }`}
        >
          <div className="cafeclients__cardHeader">
            <div className="cafeclients__profile">
              <div>
                <strong>Телефон:</strong> {client.phone || "—"}
              </div>
            </div>

            <div className="cafeclients__stats">
              <div className="cafeclients__statBox">
                <div className="cafeclients__statVal">{orders.length}</div>
                <div className="cafeclients__statLabel">Заказы</div>
              </div>
              <div className="cafeclients__statBox">
                <div className="cafeclients__statVal">
                  {lastUpdated ? new Date(lastUpdated).toLocaleString() : "—"}
                </div>
                <div className="cafeclients__statLabel">Обновлён</div>
              </div>
            </div>
          </div>

          <div className="cafeclients__tabs">
            <button
              className={`cafeclients__tab ${
                tab === "profile" ? "cafeclients__tab--active" : ""
              }`}
              onClick={() => setTab("profile")}
              type="button"
            >
              Профиль
            </button>
            <button
              className={`cafeclients__tab ${
                tab === "orders" ? "cafeclients__tab--active" : ""
              }`}
              onClick={() => setTab("orders")}
              type="button"
            >
              Заказы
            </button>
          </div>

          {tab === "profile" && (
            <div className="cafeclients__profileBody">
              <div className="cafeclients__notes">
                <strong>Заметки:</strong>
                <div className="cafeclients__noteArea">{client.notes || "—"}</div>
              </div>
            </div>
          )}

          {tab === "orders" && (
            <>
              {!isNarrow ? (
                <div className="cafeclients__tableWrap">
                  <table className="cafeclients__table">
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
                          <td className="cafeclients__empty" colSpan={5}>
                            Загрузка…
                          </td>
                        </tr>
                      ) : ordersSorted.length ? (
                        ordersSorted.map((o) => (
                          <tr
                            key={o.id}
                            className="cafeclients__rowClickable"
                            style={{ cursor: "pointer" }}
                            onClick={() => setOpenOrder(o)}
                            title="Открыть детали заказа"
                          >
                            <td>{tableLabel(o)}</td>
                            <td>{o.guests ?? "—"}</td>
                            <td>{o.status || "—"}</td>
                            <td>{fmtMoney(orderTotal(o))}</td>
                            <td>
                              {o.created_at
                                ? new Date(o.created_at).toLocaleString()
                                : "—"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="cafeclients__empty" colSpan={5}>
                            Заказов нет
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="cafeclients__ordersList">
                  {loading ? (
                    <div className="cafeclients__empty">Загрузка…</div>
                  ) : ordersSorted.length ? (
                    ordersSorted.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        className="cafeclients__orderCard"
                        onClick={() => setOpenOrder(o)}
                        title="Открыть детали заказа"
                      >
                        <div className="cafeclients__orderTop">
                          <div className="cafeclients__orderTitle">
                            {tableLabel(o)}
                          </div>
                          <div className="cafeclients__orderSum">
                            {fmtMoney(orderTotal(o))}
                          </div>
                        </div>
                        <div className="cafeclients__orderMeta">
                          <div>
                            <span className="cafeclients__muted">Гостей:</span>{" "}
                            {o.guests ?? "—"}
                          </div>
                          <div>
                            <span className="cafeclients__muted">Статус:</span>{" "}
                            {o.status || "—"}
                          </div>
                          <div>
                            <span className="cafeclients__muted">Создан:</span>{" "}
                            {o.created_at
                              ? new Date(o.created_at).toLocaleString()
                              : "—"}
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="cafeclients__empty">Заказов нет</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="cafeclients__modalFooter">
          <button className="cafeclients__btn" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>
      </div>

      {/* ───────────── модалка «Детали заказа» ───────────── */}
      {openOrder && (
        <div
          className="cafeclients__modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-detail-title"
          onClick={(e) => {
            e.stopPropagation();
            setOpenOrder(null);
          }}
        >
          <div className="cafeclients__modal" onClick={(e) => e.stopPropagation()}>
            <div className="cafeclients__modalHeader">
              <div id="order-detail-title" className="cafeclients__modalTitle">
                Детали заказа
              </div>
              <button
                className="cafeclients__iconBtn"
                onClick={() => setOpenOrder(null)}
                aria-label="Закрыть"
                type="button"
              >
                <FaTimes />
              </button>
            </div>

            <div className="cafeclients__modalBody">
              <div className="cafeclients__formGrid">
                <div className="cafeclients__field">
                  <label className="cafeclients__label">Стол</label>
                  <div>{tableLabel(openOrder)}</div>
                </div>
                <div className="cafeclients__field">
                  <label className="cafeclients__label">Гостей</label>
                  <div>{openOrder.guests ?? "—"}</div>
                </div>
                <div className="cafeclients__field">
                  <label className="cafeclients__label">Статус</label>
                  <div>{openOrder.status || "—"}</div>
                </div>
                <div className="cafeclients__field">
                  <label className="cafeclients__label">Создан</label>
                  <div>
                    {openOrder.created_at
                      ? new Date(openOrder.created_at).toLocaleString()
                      : "—"}
                  </div>
                </div>
              </div>

              <div className="cafeclients__tableWrap" style={{ marginTop: 10 }}>
                <table className="cafeclients__table">
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
                        <tr key={it?.id || it?.menu_item || i}>
                          <td className="cafeclients__ellipsis" title={itemName(it)}>
                            {itemName(it)}
                          </td>
                          <td>{itemQty(it)}</td>
                          <td>{fmtMoney(itemPrice(it))}</td>
                          <td>{fmtMoney(lineTotal(it))}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="cafeclients__empty" colSpan={4}>
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
                        <th>{fmtMoney(orderTotal(openOrder))}</th>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            </div>

            <div className="cafeclients__modalFooter">
              <button
                className="cafeclients__btn"
                onClick={() => setOpenOrder(null)}
                type="button"
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

export { ConfirmDeleteModal, ClientForm, ClientCard };
