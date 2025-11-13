// src/components/ClientRequests/ClientRequests.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import "./client-requests.scss";
import { FaPlus, FaSearch, FaTimes, FaEdit, FaTrash } from "react-icons/fa";
import { useDispatch } from "react-redux";
import {
  getConsultingRequests,
  createConsultingRequest,
  editConsultingRequest,
  deleteConsultingRequest,
} from "../../../../store/creators/consultingThunk";
import {
  fetchClientsAsync,
  createClientAsync,
} from "../../../../store/creators/clientCreators";
import { useSelector } from "react-redux";

const clean = (s) => String(s || "").trim();
const toLocalDT = (iso) => (iso ? new Date(iso).toLocaleString() : "—");
const statusRu = (v) =>
  ({
    new: "Новая",
    in_work: "В работе",
    done: "Завершена",
    canceled: "Отменена",
  }[v] || "—");

export default function ConsultingClientRequests() {
  const dispatch = useDispatch();

  const { requests = [], loading, error } = useSelector((s) => s.consulting);
  const clients = useSelector((s) => s.client?.list ?? []); // адаптируй под свой слайс клиентов

  /* ui */
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  /* форма */
  const emptyForm = { client: "", title: "", status: "new", note: "" };
  const [form, setForm] = useState(emptyForm);

  /* просмотр (для done) */
  const [viewOpen, setViewOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);

  /* inline-клиент */
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({ full_name: "", phone: "" });
  const [newClientErr, setNewClientErr] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);
  const clientSelectRef = useRef(null);

  useEffect(() => {
    dispatch(fetchClientsAsync());
    dispatch(getConsultingRequests());
  }, [dispatch]);

  /* индексы по клиентам */
  const clientById = useMemo(() => {
    const m = new Map();
    (clients || []).forEach((c) => m.set(String(c.id), c));
    return m;
  }, [clients]);

  /* фильтрация */
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    let base = (requests || []).slice();
    if (t) {
      base = base.filter((r) =>
        [
          r.client_display,
          r.name, // заголовок заявки
          r.description, // заметка
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(t))
      );
    }
    if (status !== "all") base = base.filter((r) => r.status === status);
    return base.sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at || 0) -
        new Date(a.updated_at || a.created_at || 0)
    );
  }, [requests, q, status]);

  /* CRUD */
  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormErr("");
    setFormOpen(true);
    setNewClientOpen(false);
    setNewClientErr("");
  };

  const openEdit = (r) => {
    if (r.status === "done") return; // просмотр только через view
    setEditingId(r.id);
    setForm({
      client: r.client ? String(r.client) : "",
      title: r.name || "",
      status: r.status || "new",
      note: r.description || "",
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
      client: form.client, // id клиента (uuid/number)
      name: clean(form.title), // бэку нужен name
      status: form.status || "new",
      description: clean(form.note), // бэку нужен description
    };

    setSaving(true);
    try {
      if (editingId) {
        await dispatch(
          editConsultingRequest({ id: editingId, data: payload })
        ).unwrap();
      } else {
        await dispatch(createConsultingRequest(payload)).unwrap();
      }
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setNewClientOpen(false);
      setNewClient({ full_name: "", phone: "" });
      // Перезагрузить список (если редьюсер сам не обновляет):
      // await dispatch(getConsultingRequests());
    } catch (e2) {
      console.error(e2);
      setFormErr(
        (typeof e2 === "string" ? e2 : e2?.detail) ||
          "Не удалось сохранить заявку."
      );
    } finally {
      setSaving(false);
    }
  };

  const removeReq = async (r) => {
    if (!r?.id) return;
    if (!window.confirm(`Удалить заявку «${r.name || "—"}»?`)) return;
    try {
      await dispatch(deleteConsultingRequest(r.id)).unwrap();
      // можно рефетчнуть при необходимости:
      // await dispatch(getConsultingRequests());
    } catch (e) {
      console.error(e);
      alert("Не удалось удалить заявку.");
    }
  };

  /* inline клиент */
  const submitNewClient = async () => {
    if (creatingClient) return;
    setNewClientErr("");

    const full = clean(newClient.full_name);
    if (!full) return setNewClientErr("Введите имя клиента.");
    if (full.length < 2 || full.length > 120)
      return setNewClientErr("Имя: 2–120 символов.");

    setCreatingClient(true);
    try {
      const created = await dispatch(
        createClientAsync({
          full_name: full,
          phone: clean(newClient.phone || ""),
        })
      ).unwrap();

      if (created?.id) {
        setForm((p) => ({ ...p, client: String(created.id) }));
      }
      setNewClientOpen(false);
      setNewClient({ full_name: "", phone: "" });
      setTimeout(() => clientSelectRef.current?.focus(), 0);
      // актуализируем список клиентов:
      dispatch(fetchClientsAsync());
    } catch (e) {
      console.error(e);
      setNewClientErr(
        (typeof e === "string" ? e : e?.detail) || "Не удалось создать клиента."
      );
    } finally {
      setCreatingClient(false);
    }
  };

  return (
    <section className="clientreqs">
      <header className="clientreqs__header">
        <div>
          <h2 className="clientreqs__title">Запросы клиентов</h2>
          <p className="clientreqs__subtitle">
            Лиды/заявки по услугам (сервер)
          </p>
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

          <button
            className="clientreqs__btn clientreqs__btn--primary"
            onClick={openCreate}
          >
            <FaPlus /> Новая заявка
          </button>
        </div>
      </header>

      {loading && <div className="clientreqs__alert">Загрузка…</div>}
      {!!error && (
        <div className="clientreqs__alert clientreqs__alert--error">
          {String(error)}
        </div>
      )}

      {!loading && (
        <div className="clientreqs__tableWrap">
          <table className="clientreqs__table">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Заявка</th>
                <th>Статус</th>
                <th>Создано</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((r) => {
                  const isDone = r.status === "done";
                  const isCanceled = r.status === "canceled";
                  return (
                    <tr key={r.id} className={`status-${r.status}`}>
                      <td
                        className="clientreqs__ellipsis"
                        title={r.client_display}
                      >
                        {r.client_display ||
                          clientById.get(String(r.client))?.full_name ||
                          "—"}
                      </td>
                      <td className="clientreqs__ellipsis" title={r.name}>
                        {r.name || "—"}
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
          <div
            className="clientreqs__modal"
            onClick={(e) => e.stopPropagation()}
          >
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
              <div className="clientreqs__alert clientreqs__alert--error">
                {formErr}
              </div>
            )}

            <form className="clientreqs__form" onSubmit={submitForm} noValidate>
              <div className="clientreqs__grid">
                {/* Клиент */}
                <div className="clientreqs__field">
                  <label className="clientreqs__label">
                    Клиент <span className="clientreqs__req">*</span>
                  </label>
                  <div className="clientreqs__row">
                    <select
                      ref={clientSelectRef}
                      className="clientreqs__input clientreqs__control"
                      value={form.client}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, client: e.target.value }))
                      }
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
                              setNewClient((p) => ({
                                ...p,
                                full_name: e.target.value,
                              }))
                            }
                            required
                          />
                        </div>
                        <div className="clientreqs__miniCol">
                          <label className="clientreqs__miniLabel">
                            Телефон
                          </label>
                          <input
                            className="clientreqs__input clientreqs__control"
                            placeholder="+996 700 000 000"
                            value={newClient.phone}
                            onChange={(e) =>
                              setNewClient((p) => ({
                                ...p,
                                phone: e.target.value,
                              }))
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
                            <div className="clientreqs__miniErr">
                              {newClientErr}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Заявка */}
                <div className="clientreqs__field">
                  <label className="clientreqs__label">
                    Заявка <span className="clientreqs__req">*</span>
                  </label>
                  <input
                    className="clientreqs__input clientreqs__control"
                    placeholder="Например: Консультация по визе"
                    value={form.title}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, title: e.target.value }))
                    }
                    required
                  />
                </div>

                {/* Статус */}
                <div className="clientreqs__field">
                  <label className="clientreqs__label">Статус</label>
                  <select
                    className="clientreqs__input clientreqs__control"
                    value={form.status}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, status: e.target.value }))
                    }
                  >
                    <option value="new">Новая</option>
                    <option value="in_work">В работе</option>
                    <option value="done">Завершена</option>
                    <option value="canceled">Отменена</option>
                  </select>
                </div>
                <div />

                {/* Заметка */}
                <div className="clientreqs__field clientreqs__field--full">
                  <label className="clientreqs__label">Заметка</label>
                  <textarea
                    className="clientreqs__input"
                    rows={4}
                    placeholder="Комментарий по заявке"
                    value={form.note}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, note: e.target.value }))
                    }
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
                  {saving
                    ? "Сохранение…"
                    : editingId
                    ? "Сохранить изменения"
                    : "Создать заявку"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Просмотр (read-only) для «Завершена» */}
      {viewOpen && viewRow && (
        <div
          className="clientreqs__overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setViewOpen(false)}
        >
          <div
            className="clientreqs__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="clientreqs__modalHeader">
              <h3 className="clientreqs__modalTitle">Заявка — подробности</h3>
              <button
                className="clientreqs__iconBtn"
                onClick={() => setViewOpen(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            <div className="clientreqs__view">
              <div className="clientreqs__viewRow">
                <span>Клиент</span>
                <b>
                  {viewRow.client_display ||
                    clientById.get(String(viewRow.client))?.full_name ||
                    "—"}
                </b>
              </div>
              <div className="clientreqs__viewRow">
                <span>Заявка</span>
                <b>{viewRow.name || "—"}</b>
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
                <b className="clientreqs__pre">{viewRow.description || "—"}</b>
              </div>
            </div>

            <div className="clientreqs__formActions">
              <button
                className="clientreqs__btn"
                onClick={() => setViewOpen(false)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
