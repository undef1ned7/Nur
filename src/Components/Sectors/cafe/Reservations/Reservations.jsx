import React, { useEffect, useMemo, useState } from "react";
import {
  FaSearch,
  FaPlus,
  FaTimes,
  FaConciergeBell,
  FaUser,
  FaPhone,
  FaEdit,
  FaTrash,
} from "react-icons/fa";
import api from "../../../../api";
import SearchableCombobox from "../../../common/SearchableCombobox/SearchableCombobox";
import "./reservations.scss";

const STATUSES = [
  { value: "booked", label: "Забронировано" },
  { value: "arrived", label: "Пришли" },
  { value: "no_show", label: "Не пришли" },
  { value: "cancelled", label: "Отменено" },
];

// универсально достаём список из пагинации/без неё
const listFrom = (res) => res?.data?.results || res?.data || [];

// нормализуем модификатор для BEM (no_show -> no-show)
const statusMod = (s) => (s === "no_show" ? "no-show" : s);

// отобразить метку статуса
const StatusPill = ({ s }) => {
  const map = {
    booked: "Забронировано",
    arrived: "Пришли",
    no_show: "Не пришли",
    cancelled: "Отменено",
  };
  return (
    <span className={`cafeReservations__status cafeReservations__status--${statusMod(s)}`}>
      {map[s] || s}
    </span>
  );
};

const Reservations = () => {
  // данные
  const [items, setItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  // поиск
  const [query, setQuery] = useState("");

  // активный таб (фильтр по статусу)
  const [activeTab, setActiveTab] = useState("all"); // all | booked | arrived | no_show | cancelled

  // модалка
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    guest: "",
    phone: "",
    date: "",
    time: "",
    guests: 2,
    table: "", // UUID стола
    status: "booked",
  });

  // модалка подтверждения удаления
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // карты по столам
  const tablesMap = useMemo(() => {
    const m = new Map();
    tables.forEach((t) => m.set(t.id, t));
    return m;
  }, [tables]);

  const tableTitle = (id) => {
    const t = tablesMap.get(id);
    if (!t) return "—";
    const num = t.number ?? "?";
    const places = t.places ? ` · ${t.places} мест` : "";
    return `Стол ${num}${places}`;
  };

  // Загрузка: столы + брони
  useEffect(() => {
    (async () => {
      try {
        const [tRes, bRes] = await Promise.all([api.get("/cafe/tables/"), api.get("/cafe/bookings/")]);
        setTables(listFrom(tRes));
        setItems(listFrom(bRes));
      } catch (e) {
        // Ошибка загрузки данных
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Поиск
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) => {
      const guest = (r.guest || "").toLowerCase();
      const phone = (r.phone || "").toLowerCase();
      const status = (r.status || "").toLowerCase();
      const tableNum = String(tablesMap.get(r.table)?.number ?? "").toLowerCase().trim();
      return guest.includes(q) || phone.includes(q) || status.includes(q) || (tableNum && tableNum.includes(q));
    });
  }, [items, query, tablesMap]);

  // CRUD
  const openCreate = () => {
    setEditingId(null);
    setForm({
      guest: "",
      phone: "",
      date: "",
      time: "",
      guests: 2,
      table: tables[0]?.id || "",
      status: "booked",
    });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      guest: row.guest || "",
      phone: row.phone || "",
      date: row.date || "",
      time: row.time || "",
      guests: row.guests ?? 1,
      table: row.table || "",
      status: row.status || "booked",
    });
    setModalOpen(true);
  };

  const saveReservation = async (e) => {
    e.preventDefault();
    const payload = {
      guest: (form.guest || "").trim(),
      phone: (form.phone || "").trim(),
      date: form.date,
      time: form.time,
      guests: Math.max(1, Number(form.guests) || 1),
      table: form.table, // UUID из селекта
      status: form.status,
    };
    if (!payload.guest || !payload.date || !payload.time || !payload.table) return;

    try {
      if (editingId == null) {
        const res = await api.post("/cafe/bookings/", payload);
        setItems((prev) => [...prev, res.data]);
      } else {
        const res = await api.put(`/cafe/bookings/${editingId}/`, payload);
        setItems((prev) => prev.map((r) => (r.id === editingId ? res.data : r)));
      }
      setModalOpen(false);
    } catch (err) {
      // Ошибка сохранения брони
    }
  };

  const openDeleteConfirm = (id) => {
    setDeleteId(id);
    setConfirmOpen(true);
  };

  const closeDeleteConfirm = () => {
    if (deleteBusy) return;
    setConfirmOpen(false);
    setDeleteId(null);
  };

  const handleDelete = async () => {
    if (!deleteId || deleteBusy) return;

    setDeleteBusy(true);
    try {
      await api.delete(`/cafe/bookings/${deleteId}/`);
      setItems((prev) => prev.filter((r) => r.id !== deleteId));
      closeDeleteConfirm();
    } catch (err) {
      // Ошибка удаления брони
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <section className="cafeReservations">
      <div className="cafeReservations__header">
        <div>
          <h2 className="cafeReservations__title">Бронь</h2>
          <div className="cafeReservations__subtitle">Резервы столов по дате и времени.</div>
        </div>

        <div className="cafeReservations__actions">
          <div className="cafeReservations__search">
            <FaSearch className="cafeReservations__searchIcon" />
            <input
              className="cafeReservations__searchInput"
              placeholder="Поиск: гость, телефон, стол (номер), статус…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <button
            className="cafeReservations__btn cafeReservations__btn--primary"
            onClick={openCreate}
            disabled={!tables.length}
            title={!tables.length ? "Сначала добавьте столы" : ""}
            type="button"
          >
            <FaPlus /> Новая бронь
          </button>
        </div>
      </div>

      {/* Табы */}
      <div className="cafeReservations__tabs">
        <button
          type="button"
          className={`cafeReservations__tab ${activeTab === "all" ? "cafeReservations__tab--active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          Все
        </button>
        <button
          type="button"
          className={`cafeReservations__tab ${activeTab === "booked" ? "cafeReservations__tab--active" : ""}`}
          onClick={() => setActiveTab("booked")}
        >
          Забронировано
        </button>
        <button
          type="button"
          className={`cafeReservations__tab ${activeTab === "arrived" ? "cafeReservations__tab--active" : ""}`}
          onClick={() => setActiveTab("arrived")}
        >
          Пришли
        </button>
        <button
          type="button"
          className={`cafeReservations__tab ${activeTab === "no_show" ? "cafeReservations__tab--active" : ""}`}
          onClick={() => setActiveTab("no_show")}
        >
          Не пришли
        </button>
        <button
          type="button"
          className={`cafeReservations__tab ${activeTab === "cancelled" ? "cafeReservations__tab--active" : ""}`}
          onClick={() => setActiveTab("cancelled")}
        >
          Отменено
        </button>
      </div>

      <div className="cafeReservations__list">
        {loading && <div className="cafeReservations__alert">Загрузка…</div>}

        {!loading &&
          filtered.map((r) => (
            <article key={r.id} className="cafeReservations__card">
              <div className="cafeReservations__cardLeft">
                <div className="cafeReservations__avatar">
                  <FaConciergeBell />
                </div>
                <div>
                  <h3 className="cafeReservations__name">
                    {r.date} • {r.time}
                  </h3>
                  <div className="cafeReservations__meta">
                    <span className="cafeReservations__muted">
                      <FaUser />
                      &nbsp;{r.guest} · {r.guests} чел.
                    </span>
                    {r.phone && (
                      <span className="cafeReservations__muted">
                        <FaPhone />
                        &nbsp;{r.phone}
                      </span>
                    )}
                    <span className="cafeReservations__muted">{tableTitle(r.table)}</span>
                    <StatusPill s={r.status} />
                  </div>
                </div>
              </div>

              <div className="cafeReservations__rowActions">
                <button
                  className="cafeReservations__btn cafeReservations__btn--secondary"
                  onClick={() => openEdit(r)}
                  type="button"
                >
                  <FaEdit /> Изменить
                </button>
                <button
                  className="cafeReservations__btn cafeReservations__btn--danger"
                  onClick={() => openDeleteConfirm(r.id)}
                  type="button"
                >
                  <FaTrash /> Удалить
                </button>
              </div>
            </article>
          ))}

        {!loading && !filtered.length && (
          <div className="cafeReservations__alert">Ничего не найдено по «{query}».</div>
        )}
      </div>

      {/* Модалка: создать/редактировать */}
      {modalOpen && (
        <div className="cafeReservations__modalOverlay" onClick={() => setModalOpen(false)}>
          <div className="cafeReservations__modal" onClick={(e) => e.stopPropagation()}>
            <div className="cafeReservations__modalHeader">
              <h3 className="cafeReservations__modalTitle">{editingId == null ? "Новая бронь" : "Изменить бронь"}</h3>
              <button
                className="cafeReservations__iconBtn"
                onClick={() => setModalOpen(false)}
                type="button"
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            <form className="cafeReservations__form" onSubmit={saveReservation}>
              <div className="cafeReservations__formGrid">
                <div className="cafeReservations__field">
                  <label className="cafeReservations__label">Гость</label>
                  <input
                    className="cafeReservations__input"
                    value={form.guest}
                    onChange={(e) => setForm((f) => ({ ...f, guest: e.target.value }))}
                    required
                    maxLength={255}
                  />
                </div>

                <div className="cafeReservations__field">
                  <label className="cafeReservations__label">Телефон</label>
                  <input
                    className="cafeReservations__input"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    maxLength={32}
                  />
                </div>

                <div className="cafeReservations__field">
                  <label className="cafeReservations__label">Дата</label>
                  <input
                    type="date"
                    className="cafeReservations__input"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    required
                  />
                </div>

                <div className="cafeReservations__field">
                  <label className="cafeReservations__label">Время</label>
                  <input
                    type="time"
                    className="cafeReservations__input"
                    value={form.time}
                    onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                    required
                  />
                </div>

                <div className="cafeReservations__field">
                  <label className="cafeReservations__label">Гостей</label>
                  <input
                    type="number"
                    min={1}
                    max={32767}
                    className="cafeReservations__input"
                    value={form.guests}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, guests: Math.max(1, Number(e.target.value) || 1) }))
                    }
                  />
                </div>

                <div className="cafeReservations__field">
                  <label className="cafeReservations__label">Стол</label>
                  {tables.length ? (
                    <SearchableCombobox
                      value={form.table}
                      onChange={(v) => setForm((f) => ({ ...f, table: v }))}
                      options={tables.map((t) => ({
                        value: t.id,
                        label: `Стол ${t.number}${t.places ? ` · ${t.places} мест` : ""}`,
                      }))}
                      placeholder="Выберите стол…"
                      classNamePrefix="cafeReservationsCombo"
                    />
                  ) : (
                    <div className="cafeReservations__alert">Нет столов. Добавьте их во вкладке «Столы».</div>
                  )}
                </div>

                <div className="cafeReservations__field">
                  <label className="cafeReservations__label">Статус</label>
                  <SearchableCombobox
                    value={form.status}
                    onChange={(v) => setForm((f) => ({ ...f, status: v }))}
                    options={STATUSES}
                    placeholder="Выберите статус…"
                    classNamePrefix="cafeReservationsCombo"
                  />
                </div>
              </div>

              <div className="cafeReservations__formActions">
                <button
                  type="button"
                  className="cafeReservations__btn cafeReservations__btn--secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Отмена
                </button>
                <button type="submit" className="cafeReservations__btn cafeReservations__btn--primary">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка подтверждения удаления */}
      {confirmOpen && (
        <div className="cafeReservations__modalOverlay" onClick={closeDeleteConfirm}>
          <div className="cafeReservations__modal cafeReservations__modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="cafeReservations__modalHeader">
              <h3 className="cafeReservations__modalTitle">Удалить бронь?</h3>
              <button
                className="cafeReservations__iconBtn"
                onClick={closeDeleteConfirm}
                type="button"
                aria-label="Закрыть"
                disabled={deleteBusy}
              >
                <FaTimes />
              </button>
            </div>

            <div className="cafeReservations__confirmBody">
              <div className="cafeReservations__confirmText">Бронь будет удалена. Это действие нельзя отменить.</div>

              <div className="cafeReservations__formActions">
                <button
                  type="button"
                  className="cafeReservations__btn cafeReservations__btn--secondary"
                  onClick={closeDeleteConfirm}
                  disabled={deleteBusy}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="cafeReservations__btn cafeReservations__btn--danger"
                  onClick={handleDelete}
                  disabled={deleteBusy}
                >
                  {deleteBusy ? "Удаление…" : "Удалить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Reservations;
