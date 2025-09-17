// src/components/ClientRequests/ClientRequests.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import "./client-requests.scss";
import { FaPlus, FaSearch, FaTimes, FaEdit, FaTrash } from "react-icons/fa";

/* ====== LOCAL STORAGE ====== */
const LS_REQS = "nurcrm_requests_v1";
const LS_CLIENTS = "nurcrm_clients_v1";

const lsGet = (k, fallback) => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const lsSet = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};
const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/* ===== helpers ===== */
const clean = (s) => String(s || "").trim();
const toLocalDT = (iso) => (iso ? new Date(iso).toLocaleString() : "—");
const statusRu = (v) =>
  ({ new: "Новая", in_work: "В работе", done: "Завершена", canceled: "Отменена" }[v] || "—");

/* нормализация */
const normalizeReq = (r) => ({
  id: r.id,
  client: r.client ?? null, // id клиента
  client_name: r.client_name ?? "",
  title: r.title ?? "",
  status: r.status ?? "new",
  note: r.note ?? "",
  created_at: r.created_at || new Date().toISOString(),
  updated_at: r.updated_at || r.created_at || new Date().toISOString(),
});

const normalizeClient = (c) => ({
  id: c.id,
  full_name: c.full_name ?? c.name ?? "",
  phone: c.phone ?? "",
});

/* ===== компонент ===== */
export default function ConsultingClientRequests() {
  /* данные */
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);

  /* ui */
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  /* поиск/фильтр */
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  // селект «Все клиенты» убран — фильтр по клиенту не применяем
  const [clientId] = useState("");

  /* форма заявки */
  const emptyForm = { client: "", title: "", status: "new", note: "" };
  const [form, setForm] = useState(emptyForm);
  const [formErr, setFormErr] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  /* просмотр (для done) */
  const [viewOpen, setViewOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);

  /* inline-клиент */
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({ full_name: "", phone: "" });
  const [newClientErr, setNewClientErr] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  /* ref для селекта клиента — вернём фокус после создания клиента */
  const clientSelectRef = useRef(null);

  /* загрузка локальных данных */
  useEffect(() => {
    setLoading(true);
    setErr("");
    try {
      const r = (lsGet(LS_REQS, []) || []).map(normalizeReq);
      const c0 = lsGet(LS_CLIENTS, []);
      const c = (Array.isArray(c0) && c0.length
        ? c0
        : [
            { id: genId(), full_name: "Иван Петров", phone: "+996 700 111 222" },
            { id: genId(), full_name: "Алия Жумалиева", phone: "+996 555 333 444" },
          ]).map(normalizeClient);

      setRows(r);
      setClients(c);
      lsSet(LS_CLIENTS, c);
    } catch (e) {
      console.error(e);
      setErr("Не удалось прочитать локальные данные.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* индексы */
  const clientById = useMemo(() => {
    const m = new Map();
    (clients || []).forEach((c) => m.set(String(c.id), c));
    return m;
  }, [clients]);

  /* фильтрация */
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    let base = rows.slice();
    if (t) {
      base = base.filter((r) =>
        [r.client_name, r.title, r.note]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(t))
      );
    }
    if (status !== "all") base = base.filter((r) => r.status === status);
    if (clientId) base = base.filter((r) => String(r.client) === String(clientId));
    return base.sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at || 0) -
        new Date(a.updated_at || a.created_at || 0)
    );
  }, [rows, q, status, clientId]);

  /* CRUD (локально) */
  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormErr("");
    setFormOpen(true);
    setNewClientOpen(false);
    setNewClientErr("");
  };

  const openEdit = (r) => {
    if (r.status === "done") return;
    setEditingId(r.id);
    setForm({
      client: r.client || "",
      title: r.title || "",
      status: r.status || "new",
      note: r.note || "",
    });
    setFormErr("");
    setFormOpen(true);
    setNewClientOpen(false);
    setNewClientErr("");
  };

  const openView = (r) => {
    setViewRow(r);
    setViewOpen(true);
  };

  const submitForm = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!clean(form.client)) return setFormErr("Выберите клиента.");
    if (!clean(form.title)) return setFormErr("Введите название заявки.");

    const payload = {
      client: form.client,
      client_name: clientById.get(String(form.client))?.full_name || "",
      title: clean(form.title),
      status: form.status || "new",
      note: clean(form.note),
    };

    setSaving(true);
    try {
      if (editingId) {
        const upd = normalizeReq({
          ...rows.find((x) => String(x.id) === String(editingId)),
          ...payload,
          updated_at: new Date().toISOString(),
        });
        setRows((prev) => {
          const n = prev.map((x) => (String(x.id) === String(editingId) ? upd : x));
          lsSet(LS_REQS, n);
          return n;
        });
      } else {
        const added = normalizeReq({
          id: genId(),
          ...payload,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        setRows((prev) => {
          const n = [added, ...prev];
          lsSet(LS_REQS, n);
          return n;
        });
      }
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setNewClientOpen(false);
      setNewClient({ full_name: "", phone: "" });
    } catch (e2) {
      console.error(e2);
      setFormErr("Не удалось сохранить (локально).");
    } finally {
      setSaving(false);
    }
  };

  const removeReq = (r) => {
    if (!r?.id) return;
    if (!window.confirm(`Удалить заявку «${r.title || "—"}»?`)) return;

    // мягкое удаление из локального списка/LS
    setRows((prev) => {
      const n = prev.filter((x) => String(x.id) !== String(r.id));
      lsSet(LS_REQS, n);
      return n;
    });
  };

  /* inline клиент */
  const stopEnterSubmit = (e) => {
    if (e.key === "Enter") e.preventDefault();
  };

  const submitNewClient = () => {
    if (creatingClient) return;
    setNewClientErr("");

    const full = clean(newClient.full_name);
    if (!full) return setNewClientErr("Введите имя клиента.");
    if (full.length < 2 || full.length > 120) return setNewClientErr("Имя: 2–120 символов.");

    setCreatingClient(true);
    try {
      const created = normalizeClient({
        id: genId(),
        full_name: full,
        phone: clean(newClient.phone || ""),
      });

      setClients((prev) => {
        const n = [created, ...prev];
        lsSet(LS_CLIENTS, n);
        return n;
      });

      setForm((p) => ({ ...p, client: created.id }));
      setNewClientOpen(false);
      setNewClient({ full_name: "", phone: "" });
      setTimeout(() => clientSelectRef.current?.focus(), 0);
    } catch (e) {
      console.error(e);
      setNewClientErr("Не удалось создать клиента (локально).");
    } finally {
      setCreatingClient(false);
    }
  };

  return (
    <section className="clientreqs">
      <header className="clientreqs__header">
        <div>
          <h2 className="clientreqs__title">Заявки клиентов</h2>
          <p className="clientreqs__subtitle">Лиды/заявки по услугам (локальный режим)</p>
        </div>

        <div className="clientreqs__toolbar">
          <div className="clientreqs__search">
            <FaSearch className="clientreqs__searchIcon" aria-hidden />
            <input
              className="clientreqs__input"
              placeholder="Поиск по клиенту и заявке…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <select
            className="clientreqs__input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            title="Статус"
          >
            <option value="all">Все статусы</option>
            <option value="new">Новая</option>
            <option value="in_work">В работе</option>
            <option value="done">Завершена</option>
            <option value="canceled">Отменена</option>
          </select>

          <button className="clientreqs__btn clientreqs__btn--primary" onClick={openCreate}>
            <FaPlus /> Новая заявка
          </button>
        </div>
      </header>

      {loading && <div className="clientreqs__alert">Загрузка…</div>}
      {!!err && <div className="clientreqs__alert clientreqs__alert--error">{err}</div>}

      {!loading && (
        <div className="clientreqs__tableWrap">
          <table className="clientreqs__table">
            <thead>
              <tr>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((r) => {
                  const isDone = r.status === "done";
                  const isCanceled = r.status === "canceled";

                  return (
                    <tr key={r.id} className={`clientreqs__row status-${r.status}`}>
                      <td className="clientreqs__ellipsis" title={r.client_name}>
                        {r.client_name || (clientById.get(String(r.client))?.full_name ?? "—")}
                      </td>
                      <td className="clientreqs__ellipsis" title={r.title}>
                        {r.title || "—"}
                      </td>
                      <td>
                        <span
                          className={`clientreqs__badge ${
                            r.status === "new"
                              ? "is-new"
                              : r.status === "in_work"
                              ? "is-work"
                              : r.status === "done"
                              ? "is-done"
                              : "is-canceled"
                          }`}
                        >
                          {statusRu(r.status)}
                        </span>
                      </td>
                      <td>{toLocalDT(r.created_at)}</td>
                      <td className="clientreqs__rowActions">
                        {isDone ? (
                          <button
                            className="clientreqs__btn clientreqs__btn--secondary"
                            onClick={() => openView(r)}
                            title="Открыть"
                          >
                            <FaSearch /> Открыть
                          </button>
                        ) : (
                          <>
                            <button
                              className="clientreqs__btn clientreqs__btn--secondary"
                              onClick={() => openEdit(r)}
                              title="Изменить"
                              disabled={isCanceled}
                            >
                              <FaEdit /> Изм.
                            </button>
                            <button
                              className="clientreqs__btn clientreqs__btn--danger"
                              onClick={() => removeReq(r)}
                              title="Удалить"
                            >
                              <FaTrash /> Удалить
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="clientreqs__empty" colSpan={5}>
                    Ничего не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ====== Модалка формы ====== */}
{formOpen && (
  <div
    className="clientreqs__overlay"
    role="dialog"
    aria-modal="true"
    onClick={() => !saving && setFormOpen(false)}
  >
    <div className="clientreqs__modal" onClick={(e) => e.stopPropagation()}>
      <div className="clientreqs__modalHeader">
        <h3 className="clientreqs__modalTitle">
          {editingId ? "Изменить заявку" : "Новая заявка"}
        </h3>
        <button
          className="clientreqs__iconBtn"
          onClick={() => !saving && setFormOpen(false)}
          aria-label="Закрыть"
        >
          <FaTimes />
        </button>
      </div>

      {!!formErr && (
        <div className="clientreqs__alert clientreqs__alert--error">{formErr}</div>
      )}

      <form className="clientreqs__form" onSubmit={submitForm} noValidate>
        <div className="clientreqs__grid">
          {/* Клиент (левая колонка) */}
          <div className="clientreqs__field">
            <label className="clientreqs__label">
              Клиент <span className="clientreqs__req">*</span>
            </label>
            <div className="clientreqs__row">
              <select
                ref={clientSelectRef}
                className="clientreqs__input clientreqs__control"
                value={form.client}
                onChange={(e) => setForm((p) => ({ ...p, client: e.target.value }))}
                required
              >
                <option value="">— выберите клиента —</option>
                {clients.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.full_name || "—"}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="clientreqs__btn clientreqs__btn--secondary clientreqs__control"
                onClick={() => {
                  setNewClientOpen((v) => !v);
                  setNewClientErr("");
                }}
              >
                {newClientOpen ? "Отмена" : "Новый клиент"}
              </button>
            </div>

            {newClientOpen && (
              <div className="clientreqs__inlineCard">
                <div className="clientreqs__inlineGrid">
                  <div className="clientreqs__miniCol">
                    <label className="clientreqs__miniLabel">ФИО *</label>
                    <input
                      className="clientreqs__input clientreqs__control"
                      placeholder="Например: Алия Жумалиева"
                      value={newClient.full_name}
                      onChange={(e) =>
                        setNewClient((p) => ({ ...p, full_name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="clientreqs__miniCol">
                    <label className="clientreqs__miniLabel">Телефон</label>
                    <input
                      className="clientreqs__input clientreqs__control"
                      placeholder="+996 700 000 000"
                      value={newClient.phone}
                      onChange={(e) =>
                        setNewClient((p) => ({ ...p, phone: e.target.value }))
                      }
                    />
                  </div>
                  <div className="clientreqs__miniCol clientreqs__miniCol--actions">
                    <button
                      type="button"
                      className="clientreqs__btn clientreqs__btn--primary clientreqs__control"
                      onClick={submitNewClient}
                      disabled={creatingClient}
                    >
                      {creatingClient ? "Создание…" : "Создать клиента"}
                    </button>
                    {!!newClientErr && (
                      <div className="clientreqs__miniErr">{newClientErr}</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Заявка (правая колонка) */}
          <div className="clientreqs__field">
            <label className="clientreqs__label">
              Заявка <span className="clientreqs__req">*</span>
            </label>
            <input
              className="clientreqs__input clientreqs__control"
              placeholder="Например: Консультация по визе"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              required
            />
          </div>

          {/* Статус (левая), справа пусто для симметрии */}
          <div className="clientreqs__field">
            <label className="clientreqs__label">Статус</label>
            <select
              className="clientreqs__input clientreqs__control"
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
            >
              <option value="new">Новая</option>
              <option value="in_work">В работе</option>
              <option value="done">Завершена</option>
              <option value="canceled">Отменена</option>
            </select>
          </div>
          <div />

          {/* Заметка на всю ширину */}
          <div className="clientreqs__field clientreqs__field--full">
            <label className="clientreqs__label">Заметка</label>
            <textarea
              className="clientreqs__input"
              rows={4}
              placeholder="Комментарий по заявке"
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
            />
          </div>
        </div>

        <div className="clientreqs__actions">
          <button
            type="button"
            className="clientreqs__btn"
            onClick={() => setFormOpen(false)}
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="submit"
            className="clientreqs__btn clientreqs__btn--primary"
            disabled={saving}
          >
            {saving ? "Сохранение…" : editingId ? "Сохранить изменения" : "Создать заявку"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}


      {/* Просмотр (read-only) для «Завершена» */}
      {viewOpen && viewRow && (
        <div className="clientreqs__overlay" role="dialog" aria-modal="true" onClick={() => setViewOpen(false)}>
          <div className="clientreqs__modal" onClick={(e) => e.stopPropagation()}>
            <div className="clientreqs__modalHeader">
              <h3 className="clientreqs__modalTitle">Заявка — подробности</h3>
              <button className="clientreqs__iconBtn" onClick={() => setViewOpen(false)} aria-label="Закрыть">
                <FaTimes />
              </button>
            </div>

            <div className="clientreqs__view">
              <div className="clientreqs__viewRow">
                <span>Клиент</span>
                <b>{viewRow.client_name || clientById.get(String(viewRow.client))?.full_name || "—"}</b>
              </div>
              <div className="clientreqs__viewRow">
                <span>Заявка</span>
                <b>{viewRow.title || "—"}</b>
              </div>
              <div className="clientreqs__viewRow">
                <span>Статус</span>
                <b>{statusRu(viewRow.status)}</b>
              </div>
              <div className="clientreqs__viewRow">
                <span>Создано</span>
                <b>{toLocalDT(viewRow.created_at)}</b>
              </div>
              <div className="clientreqs__viewRow">
                <span>Обновлено</span>
                <b>{toLocalDT(viewRow.updated_at)}</b>
              </div>
              <div className="clientreqs__viewRow clientreqs__viewRow--full">
                <span>Заметка</span>
                <b className="clientreqs__pre">{viewRow.note || "—"}</b>
              </div>
            </div>

            <div className="clientreqs__formActions">
              <button className="clientreqs__btn" onClick={() => setViewOpen(false)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
