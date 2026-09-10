// src/components/ClientRequests/ClientRequests.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import "./client-requests.scss";
import {
  FaPlus,
  FaSearch,
  FaTimes,
  FaEdit,
  FaTrash,
  FaCheck,
} from "react-icons/fa";
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
import { useAlert, useConfirm } from "../../../../hooks/useDialog";
import ConsultingShell from "../common/ConsultingShell";
import useConsultingList from "../common/useConsultingList";
import { Pagination } from "../common/ListControls";
import { plural } from "../common/listUtils";
import {
  listConsultingRequests,
  acceptConsultingRequest,
  declineConsultingRequest,
} from "../../../../api/consultingCatalog";
import api from "../../../../api";
import { useUser } from "../../../../store/slices/userSlice";

const clean = (s) => String(s || "").trim();
const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
const employeeName = (e) =>
  [e?.last_name || "", e?.first_name || ""].filter(Boolean).join(" ").trim() ||
  e?.full_name ||
  e?.email ||
  "—";
const toLocalDT = (iso) => (iso ? new Date(iso).toLocaleString() : "—");
const statusRu = (v) =>
  ({
    new: "Новая",
    in_work: "В работе",
    done: "Завершена",
    canceled: "Отменена",
  }[v] || "—");
const badgeClassFor = (v) =>
  v === "new"
    ? "is-new"
    : v === "in_work"
    ? "is-work"
    : v === "done"
    ? "is-done"
    : "is-canceled";
const initials = (name) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
};

export default function ConsultingClientRequests() {
  const dispatch = useDispatch();
  const confirm = useConfirm();
  const alert = useAlert();

  const { error } = useSelector((s) => s.consulting);
  const clients = useSelector((s) => s.client?.list ?? []); // адаптируй под свой слайс клиентов
  const { profile } = useUser();
  const myId = profile?.id ? String(profile.id) : "";

  /**
   * Запросы клиентов грузятся с сервера: поиск и статус уходят в параметры
   * запроса, а не фильтруют весь массив на клиенте.
   */
  const requestsList = useConsultingList({
    fetcher: listConsultingRequests,
    filters: { status: "" },
    prefix: "rq",
  });
  const requests = requestsList.items;
  const loading = requestsList.loading;

  /* ui */
  const q = requestsList.searchInput;
  const setQ = requestsList.setSearch;
  const status = requestsList.filters.status || "all";
  const setStatus = (value) =>
    requestsList.setFilter("status", value === "all" ? "" : value);
  const [formOpen, setFormOpen] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  /* форма */
  const emptyForm = {
    client: "",
    title: "",
    status: "new",
    note: "",
    assigned_to: "",
  };
  const [form, setForm] = useState(emptyForm);

  /* сотрудники — для назначения ответственного по заявке */
  const [employees, setEmployees] = useState([]);
  const empById = useMemo(() => {
    const m = new Map();
    employees.forEach((e) => m.set(String(e.id), e));
    return m;
  }, [employees]);
  const assigneeName = (row) =>
    row?.assigned_to_display ||
    (row?.assigned_to
      ? employeeName(empById.get(String(row.assigned_to))) || "—"
      : "");

  /* просмотр (для done) */
  const [viewOpen, setViewOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);

  /* принятие/отказ от назначенной заявки (только назначенный сотрудник) */
  const [decisionBusyId, setDecisionBusyId] = useState(null);
  const [declineFor, setDeclineFor] = useState(null);
  const [declineReason, setDeclineReason] = useState("");
  const [declineErr, setDeclineErr] = useState("");

  // Заявка ждёт ответа исполнителя: бэк ставит acceptance="pending" при
  // назначении; пока поля нет — считаем ожидающей новую назначенную заявку.
  const isPendingAccept = (r) =>
    !!r?.assigned_to &&
    (r.acceptance === "pending" ||
      (!r.acceptance && r.status === "new")) &&
    r.status !== "done" &&
    r.status !== "canceled";
  const needsMyDecision = (r) =>
    isPendingAccept(r) && String(r.assigned_to) === myId;

  const acceptRequest = async (r) => {
    setDecisionBusyId(r.id);
    try {
      await acceptConsultingRequest(r.id);
      reloadRequests();
      alert("Заявка принята — переведена в работу.");
    } catch (e) {
      alert(
        (typeof e === "string" ? e : e?.detail) || "Не удалось принять заявку.",
        true,
      );
    } finally {
      setDecisionBusyId(null);
    }
  };

  const submitDecline = async () => {
    const reason = declineReason.trim();
    if (!reason) {
      setDeclineErr("Укажите причину отказа.");
      return;
    }
    setDecisionBusyId(declineFor.id);
    try {
      await declineConsultingRequest(declineFor.id, reason);
      setDeclineFor(null);
      setDeclineReason("");
      setDeclineErr("");
      reloadRequests();
      alert("Вы отказались от заявки. Владельцу отправлено уведомление.");
    } catch (e) {
      setDeclineErr(
        (typeof e === "string" ? e : e?.detail) || "Не удалось отправить отказ.",
      );
    } finally {
      setDecisionBusyId(null);
    }
  };

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

  useEffect(() => {
    const controller = new AbortController();
    api
      .get("/users/employees/", { signal: controller.signal })
      .then((res) => setEmployees(asArray(res.data)))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // После создания/изменения/удаления перечитываем текущую страницу.
  const reloadRequests = requestsList.refresh;

  /* индексы по клиентам */
  const clientById = useMemo(() => {
    const m = new Map();
    (clients || []).forEach((c) => m.set(String(c.id), c));
    return m;
  }, [clients]);

  /* Поиск и фильтр по статусу делает сервер — здесь только порядок вывода. */
  const filtered = useMemo(
    () =>
      requests
        .slice()
        .sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at || 0) -
            new Date(a.updated_at || a.created_at || 0)
        ),
    [requests]
  );

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
      assigned_to: r.assigned_to ? String(r.assigned_to) : "",
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
      // Ответственный сотрудник. Пустое → null (снять назначение). Бэк по
      // смене assigned_to шлёт сотруднику WS-уведомление.
      assigned_to: form.assigned_to || null,
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
      reloadRequests();
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

  const removeReq = (r) => {
    if (!r?.id) return;
    confirm(`Удалить заявку «${r.name || "—"}»?`, async (result) => {
      if (!result) return;
      try {
        await dispatch(deleteConsultingRequest(r.id)).unwrap();
        // можно рефетчнуть при необходимости:
        reloadRequests();
      } catch (e) {
        console.error(e);
        alert("Не удалось удалить заявку.", true);
      }
    });
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
    <ConsultingShell
      eyebrow="Консалтинг · Заявки"
      title="Запросы клиентов"
      subtitle="Лиды/заявки по услугам (сервер)"
      panelTitle="Очередь заявок"
      headerActions={
        <button
          type="button"
          className="cShell__btn cShell__btn--primary"
          onClick={openCreate}
        >
          <FaPlus aria-hidden /> Новая заявка
        </button>
      }
    >
      <div className="clientreqs clientreqs--embedded">
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
        </div>

        {loading && <div className="clientreqs__alert">Загрузка…</div>}
        {!!error && (
          <div className="clientreqs__alert clientreqs__alert--error">
            {String(error)}
          </div>
        )}

        {!loading && (
          <ul className="cShell__feed" aria-label="Заявки">
            {filtered.length ? (
              filtered.map((r) => {
                const isDone = r.status === "done";
                const isCanceled = r.status === "canceled";
                const clientName =
                  r.client_display ||
                  clientById.get(String(r.client))?.full_name ||
                  "—";
                const who = assigneeName(r);
                const decide = needsMyDecision(r);
                const waitingOther = isPendingAccept(r) && !decide;
                const busyDecision = decisionBusyId === r.id;
                return (
                  <li key={r.id} className="cShell__card">
                    <div className="cShell__cardMain">
                      <span className="cShell__avatar" aria-hidden>
                        {initials(clientName)}
                      </span>
                      <div className="cShell__cardBody">
                        <div className="cShell__cardTitle" title={r.name}>
                          {r.name || "—"}
                        </div>
                        <div className="cShell__cardMeta">
                          {clientName} · {toLocalDT(r.created_at)}{" "}
                          <span
                            className={`clientreqs__badge ${badgeClassFor(
                              r.status
                            )}`}
                          >
                            {statusRu(r.status)}
                          </span>
                          <span
                            className={`clientreqs__assignee${
                              who ? "" : " clientreqs__assignee--none"
                            }`}
                          >
                            {who || "Не назначен"}
                          </span>
                          {decide && (
                            <span className="clientreqs__assignTag clientreqs__assignTag--me">
                              Вам назначена
                            </span>
                          )}
                          {waitingOther && (
                            <span className="clientreqs__assignTag clientreqs__assignTag--wait">
                              Ждёт ответа сотрудника
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="cShell__cardActions">
                      {decide ? (
                        <>
                          <button
                            className="clientreqs__btn clientreqs__btn--primary"
                            onClick={() => acceptRequest(r)}
                            title="Принять заявку в работу"
                            disabled={busyDecision}
                          >
                            <FaCheck /> Принять
                          </button>
                          <button
                            className="clientreqs__btn clientreqs__btn--danger"
                            onClick={() => {
                              setDeclineFor(r);
                              setDeclineReason("");
                              setDeclineErr("");
                            }}
                            title="Отказаться от заявки"
                            disabled={busyDecision}
                          >
                            <FaTimes /> Отказать
                          </button>
                        </>
                      ) : isDone ? (
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
                    </div>
                  </li>
                );
              })
            ) : (
              <li className="clientreqs__empty">Ничего не найдено</li>
            )}
          </ul>
        )}

        <Pagination
          page={requestsList.page}
          totalPages={requestsList.totalPages}
          count={requestsList.count}
          pageSize={requestsList.pageSize}
          onPage={requestsList.setPage}
          onPageSize={requestsList.setPageSize}
          unitLabel={plural.requests}
          loading={requestsList.loading}
        />

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

              <form
                className="clientreqs__form"
                onSubmit={submitForm}
                noValidate
              >
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
                            <label className="clientreqs__miniLabel">
                              ФИО *
                            </label>
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
                              {creatingClient
                                ? "Создание…"
                                : "Создать клиента"}
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
                  {/* Ответственный сотрудник */}
                  <div className="clientreqs__field">
                    <label className="clientreqs__label">Сотрудник</label>
                    <select
                      className="clientreqs__input clientreqs__control"
                      value={form.assigned_to}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, assigned_to: e.target.value }))
                      }
                    >
                      <option value="">— не назначен —</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={String(emp.id)}>
                          {employeeName(emp)}
                        </option>
                      ))}
                    </select>
                  </div>

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
                <h3 className="clientreqs__modalTitle">
                  Заявка — подробности
                </h3>
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
                  <span>Сотрудник</span>
                  <b>{assigneeName(viewRow) || "Не назначен"}</b>
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
                  <b className="clientreqs__pre">
                    {viewRow.description || "—"}
                  </b>
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

        {/* Отказ от назначенной заявки — причина обязательна */}
        {declineFor && (
          <div
            className="clientreqs__overlay"
            role="dialog"
            aria-modal="true"
            onClick={() => decisionBusyId !== declineFor.id && setDeclineFor(null)}
          >
            <div
              className="clientreqs__modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="clientreqs__modalHeader">
                <h3 className="clientreqs__modalTitle">Отказаться от заявки</h3>
                <button
                  className="clientreqs__iconBtn"
                  onClick={() => setDeclineFor(null)}
                  aria-label="Закрыть"
                >
                  <FaTimes />
                </button>
              </div>

              {!!declineErr && (
                <div className="clientreqs__alert clientreqs__alert--error">
                  {declineErr}
                </div>
              )}

              <div className="clientreqs__form">
                <div className="clientreqs__field clientreqs__field--full">
                  <label className="clientreqs__label">
                    Причина отказа <span className="clientreqs__req">*</span>
                  </label>
                  <textarea
                    className="clientreqs__input"
                    rows={3}
                    autoFocus
                    placeholder="Например: занят другими заявками, не мой профиль"
                    value={declineReason}
                    onChange={(e) => {
                      setDeclineReason(e.target.value);
                      setDeclineErr("");
                    }}
                  />
                  <div className="clientreqs__hint">
                    Заявка вернётся владельцу, ему придёт уведомление.
                  </div>
                </div>
              </div>

              <div className="clientreqs__formActions">
                <button
                  type="button"
                  className="clientreqs__btn"
                  onClick={() => setDeclineFor(null)}
                  disabled={decisionBusyId === declineFor.id}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="clientreqs__btn clientreqs__btn--danger"
                  onClick={submitDecline}
                  disabled={decisionBusyId === declineFor.id}
                >
                  {decisionBusyId === declineFor.id
                    ? "Отправка…"
                    : "Отказаться"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ConsultingShell>
  );
}
