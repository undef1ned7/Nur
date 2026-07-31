import React, { useEffect, useMemo, useState } from "react";
import "./client.scss";
import { useDispatch } from "react-redux";
import {
  fetchClientsAsync,
  createClientAsync,
  updateClientAsync,
  deleteClientAsync,
} from "../../../../store/creators/clientCreators";
import { useClient } from "../../../../store/slices/ClientSlice";
import { useNavigate } from "react-router-dom";
import { useConsulting } from "../../../../store/slices/consultingSlice";
import { getConsultingServices } from "../../../../store/creators/consultingThunk";
import { getProfile, useUser } from "../../../../store/slices/userSlice";
import {
  FaPlus,
  FaSearch,
  FaTimes,
  FaEdit,
  FaTrash,
  FaTh,
  FaUsers,
} from "react-icons/fa";
import SubscriptionMatrix from "./SubscriptionMatrix";
import ConsultingShell from "../common/ConsultingShell";
import useConsultingList from "../common/useConsultingList";
import { Pagination } from "../common/ListControls";
import { plural } from "../common/listUtils";
import { listConsultingClients } from "../../../../api/consultingCatalog";

const CLIENT_NAV = [
  {
    value: "list",
    label: "Список",
    hint: "Контакты и продажи",
    icon: FaUsers,
  },
  {
    value: "matrix",
    label: "Абонентка",
    hint: "Матрица подписок",
    icon: FaTh,
  },
];

const fmtMoney = (v) =>
  (Number(v) || 0).toLocaleString("ru-RU") + " с";

const fmtDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("ru-RU");
};

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

export default function ConsultingClients() {
  const dispatch = useDispatch();
  const { error: err = "" } = useClient();

  /**
   * Клиенты грузятся с сервера постранично: поиск уходит в `search`.
   * Redux-список остаётся для форм (выпадающие списки клиентов).
   */
  const clientsList = useConsultingList({
    fetcher: listConsultingClients,
    prefix: "cl",
  });
  const rows = clientsList.items;
  const loading = clientsList.loading;

  const [tab, setTab] = useState("list");
  const q = clientsList.searchInput;
  const setQ = clientsList.setSearch;
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editId, setEditId] = useState(null);

  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    dispatch(fetchClientsAsync());
  }, [dispatch]);

  /* Поиск и постраничность на сервере — здесь только порядок вывода. */
  const filtered = useMemo(
    () =>
      rows
        .slice()
        .sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at || 0) -
            new Date(a.updated_at || a.created_at || 0)
        ),
    [rows]
  );

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
      await dispatch(deleteClientAsync(id)).unwrap();
      clientsList.refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };
  const navigate = useNavigate();

  const totalCount = clientsList.count;
  const shownCount = filtered.length;

  return (
    <ConsultingShell
      eyebrow="Консалтинг · Клиенты"
      title="Клиенты"
      subtitle="Контакты, услуги и история продаж"
      nav={CLIENT_NAV}
      navValue={tab}
      onNavChange={setTab}
      headerActions={
        tab === "list" ? (
          <button
            type="button"
            className="cShell__btn cShell__btn--primary"
            onClick={onCreate}
          >
            <FaPlus aria-hidden /> Клиент
          </button>
        ) : null
      }
    >
      <div className="clients clients--embedded">
        {tab === "list" && (
          <div className="clients__toolbar">
            <label className="clients__search">
              <FaSearch className="clients__searchIcon" aria-hidden />
              <input
                className="clients__searchInput"
                placeholder="Поиск…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Поиск клиентов"
              />
              {!!q && (
                <button
                  type="button"
                  className="clients__searchClear"
                  onClick={() => setQ("")}
                  aria-label="Очистить поиск"
                >
                  <FaTimes />
                </button>
              )}
            </label>
            {!loading && (
              <span className="clients__count">
                {q.trim()
                  ? `${shownCount} из ${totalCount}`
                  : `${totalCount} ${pluralClients(totalCount)}`}
              </span>
            )}
          </div>
        )}

        {tab === "matrix" && <SubscriptionMatrix />}

        {tab === "list" && (
          <>
            {!!err && <div className="clients__error">{String(err)}</div>}

            {loading ? (
              <div className="clients__state">Загрузка списка клиентов…</div>
            ) : filtered.length ? (
              <ul className="cShell__feed clients__feed" aria-label="Клиенты">
                {filtered.map((c) => {
                  const isConfirm = String(c.id) === String(confirmId);
                  const isDeleting = String(c.id) === String(deletingId);
                  return (
                    <li
                      key={c.id}
                      className="cShell__card clients__card"
                      onClick={() =>
                        navigate(`/crm/consulting/client/${c.id}`)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          navigate(`/crm/consulting/client/${c.id}`);
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="cShell__cardMain">
                        <span className="cShell__avatar" aria-hidden>
                          {initials(c.full_name)}
                        </span>
                        <div className="cShell__cardBody">
                          <div className="cShell__cardTop">
                            <div>
                              <div
                                className="cShell__cardTitle"
                                title={c.full_name}
                              >
                                {c.full_name || "Без имени"}
                              </div>
                              <div className="cShell__cardMeta">
                                {c.phone || "Телефон не указан"}
                              </div>
                            </div>
                            <span className="clients__money">
                              {fmtMoney(c.score)}
                            </span>
                          </div>
                          <div className="clients__cardFoot">
                            <span>{fmtDate(c.date || c.created_at)}</span>
                            <span>{c.service_display || "Без услуги"}</span>
                            <span>{c.salesperson_display || "—"}</span>
                          </div>
                        </div>
                      </div>
                      <div
                        className="cShell__cardActions"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {isConfirm ? (
                          <div className="clients__confirm">
                            <span className="clients__confirmText">
                              Удалить?
                            </span>
                            <button
                              type="button"
                              className="clients__btn clients__btn--sm clients__btn--danger"
                              onClick={() => doDelete(c.id)}
                              disabled={isDeleting}
                            >
                              {isDeleting ? "…" : "Да"}
                            </button>
                            <button
                              type="button"
                              className="clients__btn clients__btn--sm"
                              onClick={cancelDelete}
                              disabled={isDeleting}
                            >
                              Нет
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="clients__btn clients__btn--sm"
                              onClick={() => onEdit(c.id)}
                              title="Изменить"
                            >
                              <FaEdit aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="clients__btn clients__btn--sm clients__btn--danger"
                              onClick={() => askDelete(c.id)}
                              title="Удалить"
                            >
                              <FaTrash aria-hidden />
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="clients__emptyState">
                <strong>
                  {q.trim() ? "Ничего не найдено" : "Пока нет клиентов"}
                </strong>
                <p>
                  {q.trim()
                    ? "Попробуйте изменить запрос или очистить поиск."
                    : "Добавьте первого клиента, чтобы вести продажи и абонентку."}
                </p>
                {!q.trim() && (
                  <button
                    type="button"
                    className="clients__btn clients__btn--primary"
                    onClick={onCreate}
                  >
                    <FaPlus aria-hidden /> Добавить клиента
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {tab === "list" && (
          <Pagination
            page={clientsList.page}
            totalPages={clientsList.totalPages}
            count={clientsList.count}
            pageSize={clientsList.pageSize}
            onPage={clientsList.setPage}
            onPageSize={clientsList.setPageSize}
            unitLabel={plural.clients}
            loading={clientsList.loading}
          />
        )}

        {isFormOpen && (
          <ClientForm id={editId} onClose={() => setIsFormOpen(false)} />
        )}
      </div>
    </ConsultingShell>
  );
}

function pluralClients(n) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "клиентов";
  if (last === 1) return "клиент";
  if (last >= 2 && last <= 4) return "клиента";
  return "клиентов";
}

/* ===== форма клиента ===== */
const ClientForm = ({ id, onClose }) => {
  const dispatch = useDispatch();
  const { list: rows = [] } = useClient();
  const { profile } = useUser();
  const editing = !!id;
  const current = editing
    ? rows.find((c) => String(c.id) === String(id))
    : null;

  const [full_name, setFullName] = useState(current?.full_name || "");
  const [phone, setPhone] = useState(current?.phone || "");
  const [date, setDate] = useState(current?.date || "");
  const [service, setService] = useState(current?.service || "");
  const [price, setPrice] = useState(
    current?.price != null
      ? String(current.price)
      : current?.score != null
        ? String(current.score)
        : ""
  );
  const { services: availableServices } = useConsulting();

  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const handleServiceChange = (e) => {
    const selectedServiceId = e.target.value;
    const selectedService = availableServices.find(
      (s) => String(s.id) === String(selectedServiceId)
    );

    setService(selectedServiceId);
    if (selectedService) {
      setPrice(String(selectedService.price));
    }
  };

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    dispatch(getProfile());
    dispatch(getConsultingServices());
  }, [dispatch]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    const name = String(full_name || "").trim();
    if (!name) return setErr("Введите имя клиента.");
    if (name.length < 2 || name.length > 120)
      return setErr("Имя: 2–120 символов.");

    const amount =
      price === "" ? 0 : Number(String(price).replace(",", ".")) || 0;

    const dtoCreate = {
      full_name: name,
      phone: String(phone || "").trim(),
      salesperson: profile?.id,
      date: date,
      score: amount,
      service: String(service || "").trim() || null,
    };

    const dtoEdit = {
      full_name: name,
      phone: String(phone || "").trim(),
      date: date,
      salesperson: profile?.id,
      score: amount,
      service: String(service || "").trim() || null,
    };

    setSaving(true);
    try {
      if (editing) {
        await dispatch(
          updateClientAsync({ clientId: current.id, updatedData: dtoEdit })
        ).unwrap();
      } else {
        await dispatch(createClientAsync(dtoCreate)).unwrap();
      }
      onClose();
    } catch (e2) {
      console.error(e2);
      setErr(
        (typeof e2 === "string" ? e2 : e2?.detail) ||
          "Не удалось сохранить клиента."
      );
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
            type="button"
            className="clients__iconBtn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>

        {!!err && (
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
                autoFocus
                placeholder="ФИО клиента"
              />
            </div>

            <div className="clients__field">
              <label className="clients__label">Телефон</label>
              <input
                className="clients__input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+996 700 000 000"
              />
            </div>

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
              <label className="clients__label">Услуга</label>
              <select
                className="clients__input"
                value={service}
                onChange={handleServiceChange}
              >
                <option value="">— Выберите услугу —</option>
                {availableServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {Number(s.price || 0).toLocaleString("ru-RU")} с
                  </option>
                ))}
              </select>
            </div>

            <div className="clients__field">
              <label className="clients__label">Сумма, с</label>
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
