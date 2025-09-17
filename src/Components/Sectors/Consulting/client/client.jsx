// src/components/Clients/Clients.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./client.scss";
import api from "../../../../api";
import {
  getAll,
  createClient,
  updateClient,
  removeClient,
} from "./clientStore";

const fmtMoney = (v) => (Number(v) || 0).toLocaleString() + " с";

export default function ConsultingClients() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editId, setEditId] = useState(null);

  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      const list = await getAll();
      setRows(
        list
          .slice()
          .sort(
            (a, b) =>
              new Date(b.updated_at || b.created_at || 0) -
              new Date(a.updated_at || a.created_at || 0)
          )
      );
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить клиентов (локально).");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    let base = rows.slice();
    if (t) {
      base = base.filter((r) =>
        [r.full_name, r.phone, r.seller, r.service]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(t))
      );
    }
    return base.sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at || 0) -
        new Date(a.updated_at || a.created_at || 0)
    );
  }, [rows, q]);

  const onCreate = () => {
    setEditId(null);
    setIsFormOpen(true);
  };
  const onEdit = (id) => {
    setEditId(id);
    setIsFormOpen(true);
  };

  const askDelete = (id) => setConfirmId(String(id));
  const cancelDelete = () => setConfirmId(null);
  const doDelete = async (id) => {
    const idStr = String(id);
    setDeletingId(idStr);
    try {
      await removeClient(id);
      setRows((prev) => prev.filter((c) => String(c.id) !== idStr));
    } catch (e) {
      console.error(e);
      setErr("Не удалось удалить клиента (локально).");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  return (
    <section className="clients">
      <header className="clients__header">
        <div>
          <h2 className="clients__title">Клиенты</h2>
          <p className="clients__subtitle">Локальный справочник (без бэка)</p>
        </div>

        <div className="clients__actions">
          <div className="clients__search">
            <span className="clients__searchIcon" aria-hidden>
              🔎
            </span>
            <input
              className="clients__searchInput"
              placeholder="Поиск по имени, телефону, продавцу, услуге…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Поиск клиентов"
            />
          </div>

          <button
            className="clients__btn clients__btn--primary"
            onClick={onCreate}
          >
            + Клиент
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
              <th>Дата</th>
              <th>Продавец</th>
              <th>Услуга</th>
              <th>Цена</th>
              <th aria-label="Действия" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="clients__empty" colSpan={7}>
                  Загрузка…
                </td>
              </tr>
            ) : filtered.length ? (
              filtered.map((c) => {
                const isConfirm = String(c.id) === String(confirmId);
                const isDeleting = String(c.id) === String(deletingId);
                return (
                  <tr key={c.id}>
                    <td className="clients__ellipsis" title={c.full_name}>
                      {c.full_name || "—"}
                    </td>
                    <td>{c.phone || "—"}</td>
                    <td>{c.date || "—"}</td>
                    <td className="clients__ellipsis" title={c.seller}>
                      {c.seller || "—"}
                    </td>
                    <td className="clients__ellipsis" title={c.service}>
                      {c.service || "—"}
                    </td>
                    <td>{fmtMoney(c.price)}</td>
                    <td className="clients__rowActions">
                      {isConfirm ? (
                        <>
                          <span
                            className="clients__muted"
                            style={{ marginRight: 8 }}
                          >
                            Удалить?
                          </span>
                          <button
                            className="clients__btn"
                            onClick={() => doDelete(c.id)}
                            disabled={isDeleting}
                          >
                            Да
                          </button>
                          <button
                            className="clients__btn clients__btn--secondary"
                            onClick={cancelDelete}
                            disabled={isDeleting}
                          >
                            Нет
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="clients__btn"
                            onClick={() => onEdit(c.id)}
                          >
                            Изм.
                          </button>
                          <button
                            className="clients__btn clients__btn--secondary"
                            onClick={() => askDelete(c.id)}
                          >
                            Удалить
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="clients__empty" colSpan={7}>
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
    </section>
  );
}

/* ===== форма клиента =====
 * Создание: только Имя и Телефон
 * Редактирование: полный набор полей
 */
const ClientForm = ({ id, onClose, afterSave, rows }) => {
  const editing = !!id;
  const current = editing
    ? rows.find((c) => String(c.id) === String(id))
    : null;

  // базовые поля (всегда)
  const [full_name, setFullName] = useState(current?.full_name || "");
  const [phone, setPhone] = useState(current?.phone || "");

  // расширенные (показываем только в режиме редактирования)
  const [date, setDate] = useState(current?.date || "");
  const [seller, setSeller] = useState(current?.seller || "");
  const [service, setService] = useState(current?.service || "");
  const [price, setPrice] = useState(
    current?.price != null ? String(current.price) : ""
  );

  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    const name = full_name.trim();
    if (!name) return setErr("Введите имя клиента.");
    if (name.length < 2 || name.length > 120)
      return setErr("Имя: 2–120 символов.");

    const dtoCreate = {
      full_name: name,
      phone: (phone || "").trim(),
      // остальные поля при создании НЕ требуются
    };

    const dtoEdit = {
      full_name: name,
      phone: (phone || "").trim(),
      date: (date || "").trim(),
      seller: (seller || "").trim(),
      service: (service || "").trim(),
      price: price === "" ? 0 : Number(String(price).replace(",", ".")) || 0,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateClient(current.id, dtoEdit);
      } else {
        await createClient(dtoCreate);
      }
      await afterSave?.();
      onClose();
    } catch (e2) {
      console.error(e2);
      setErr("Не удалось сохранить клиента (локально).");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="clients__modalOverlay" onClick={onClose}>
      <div
        className="clients__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clients-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="clients__modalHeader">
          <div id="clients-form-title" className="clients__modalTitle">
            {editing ? "Редактировать клиента" : "Новый клиент"}
          </div>
          <button
            className="clients__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        {!!err && (
          <div className="clients__error" style={{ marginTop: 8 }}>
            {err}
          </div>
        )}

        <form className="clients__form" onSubmit={submit}>
          <div className="clients__formGrid">
            {/* всегда видимые поля */}
            <div className="clients__field">
              <label className="clients__label">Имя *</label>
              <input
                className="clients__input"
                value={full_name}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
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

            {/* расширенные — только при редактировании */}
            {editing && (
              <>
                <div className="clients__field">
                  <label className="clients__label">Дата</label>
                  <input
                    type="date"
                    className="clients__input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>

                <div className="clients__field">
                  <label className="clients__label">Продавец</label>
                  <input
                    className="clients__input"
                    value={seller}
                    onChange={(e) => setSeller(e.target.value)}
                    placeholder="ФИО продавца"
                  />
                </div>

                <div className="clients__field">
                  <label className="clients__label">Услуга</label>
                  <input
                    className="clients__input"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    placeholder="Название услуги"
                  />
                </div>

                <div className="clients__field">
                  <label className="clients__label">Цена, с</label>
                  <input
                    className="clients__input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </>
            )}
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
