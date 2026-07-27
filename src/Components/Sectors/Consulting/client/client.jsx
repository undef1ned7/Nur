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
import { FaPlus, FaSearch, FaTimes, FaEdit, FaTrash } from "react-icons/fa";
import SubscriptionMatrix from "./SubscriptionMatrix";

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
  const { list: rows = [], loading = false, error: err = "" } = useClient();

  const [tab, setTab] = useState("list");
  const [q, setQ] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editId, setEditId] = useState(null);

  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    dispatch(fetchClientsAsync());
  }, [dispatch]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    let base = (rows || []).slice();
    if (t) {
      base = base.filter((r) =>
        [
          r.full_name,
          r.phone,
          r.seller,
          r.salesperson_display,
          r.service,
          r.service_display,
        ]
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
      await dispatch(deleteClientAsync(id)).unwrap();
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };
  const navigate = useNavigate();

  const totalCount = (rows || []).length;
  const shownCount = filtered.length;

  return (
    <section className="clients">
      <header className="clients__header">
        <div className="clients__heading">
          <h2 className="clients__title">Клиенты</h2>
          <p className="clients__subtitle">
            Контакты, услуги и история продаж
          </p>
        </div>

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

            <button
              type="button"
              className="clients__btn clients__btn--primary"
              onClick={onCreate}
            >
              <FaPlus aria-hidden /> Клиент
            </button>
          </div>
        )}
      </header>

      <div className="clients__tabsRow">
        <div className="clients__tabs" role="tablist" aria-label="Разделы клиентов">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "list"}
            className={`clients__tab ${tab === "list" ? "is-active" : ""}`}
            onClick={() => setTab("list")}
          >
            Список
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "matrix"}
            className={`clients__tab ${tab === "matrix" ? "is-active" : ""}`}
            onClick={() => setTab("matrix")}
          >
            Абонентская матрица
          </button>
        </div>

        {tab === "list" && !loading && (
          <span className="clients__count">
            {q.trim()
              ? `${shownCount} из ${totalCount}`
              : `${totalCount} ${pluralClients(totalCount)}`}
          </span>
        )}
      </div>

      {tab === "matrix" && <SubscriptionMatrix />}

      {tab === "list" && (
        <>
          {!!err && <div className="clients__error">{String(err)}</div>}

          <div className="clients__tableWrap">
            <table className="clients__table">
              <thead>
                <tr>
                  <th className="clients__colClient">Клиент</th>
                  <th className="clients__colDate">Дата</th>
                  <th className="clients__colSeller">Продавец</th>
                  <th className="clients__colService">Услуга</th>
                  <th className="clients__colSum">Сумма</th>
                  <th className="clients__colActions" aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="clients__empty" colSpan={6}>
                      Загрузка списка клиентов…
                    </td>
                  </tr>
                ) : filtered.length ? (
                  filtered.map((c) => {
                    const isConfirm = String(c.id) === String(confirmId);
                    const isDeleting = String(c.id) === String(deletingId);
                    return (
                      <tr
                        key={c.id}
                        className="clients__row"
                        onClick={() =>
                          navigate(`/crm/consulting/client/${c.id}`)
                        }
                      >
                        <td className="clients__colClient">
                          <div className="clients__person">
                            <span className="clients__avatar" aria-hidden>
                              {initials(c.full_name)}
                            </span>
                            <div className="clients__personText">
                              <div
                                className="clients__name"
                                title={c.full_name}
                              >
                                {c.full_name || "Без имени"}
                              </div>
                              <div
                                className="clients__phone"
                                title={c.phone || undefined}
                              >
                                {c.phone || "Телефон не указан"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="clients__colDate clients__date">
                          {fmtDate(c.date || c.created_at)}
                        </td>
                        <td
                          className="clients__colSeller"
                          title={c.salesperson_display || undefined}
                        >
                          <span className="clients__cellText">
                            {c.salesperson_display || "—"}
                          </span>
                        </td>
                        <td
                          className="clients__colService"
                          title={c.service_display || undefined}
                        >
                          <span className="clients__cellText">
                            {c.service_display || "—"}
                          </span>
                        </td>
                        <td className="clients__colSum clients__money">
                          {fmtMoney(c.score)}
                        </td>
                        <td
                          className="clients__colActions"
                          onClick={(e) => e.stopPropagation()}
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
                            <div className="clients__rowActions">
                              <button
                                type="button"
                                className="clients__btn clients__btn--sm"
                                onClick={() => onEdit(c.id)}
                                title="Изменить"
                              >
                                <FaEdit aria-hidden />
                                <span>Изм.</span>
                              </button>
                              <button
                                type="button"
                                className="clients__btn clients__btn--sm clients__btn--danger"
                                onClick={() => askDelete(c.id)}
                                title="Удалить"
                              >
                                <FaTrash aria-hidden />
                                <span>Удал.</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="clients__empty" colSpan={6}>
                      <div className="clients__emptyState">
                        <strong>
                          {q.trim()
                            ? "Ничего не найдено"
                            : "Пока нет клиентов"}
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
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {isFormOpen && (
        <ClientForm id={editId} onClose={() => setIsFormOpen(false)} />
      )}
    </section>
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
