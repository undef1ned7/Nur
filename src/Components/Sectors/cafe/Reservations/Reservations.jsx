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
    <span className={`reservations__status reservations__status--${statusMod(s)}`}>
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
        console.error("Ошибка загрузки броней/столов:", e);
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
      console.error("Ошибка сохранения брони:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить бронь?")) return;
    try {
      await api.delete(`/cafe/bookings/${id}/`);
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("Ошибка удаления брони:", err);
    }
  };

  return (
    <section className="reservations">
      <div className="reservations__header">
        <div>
          <h2 className="reservations__title">Бронь</h2>
          <div className="reservations__subtitle">Резервы столов по дате и времени.</div>
        </div>

        <div className="reservations__actions">
          <div className="reservations__search">
            <FaSearch className="reservations__search-icon" />
            <input
              className="reservations__search-input"
              placeholder="Поиск: гость, телефон, стол (номер), статус…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <button
            className="reservations__btn reservations__btn--primary"
            onClick={openCreate}
            disabled={!tables.length}
            title={!tables.length ? "Сначала добавьте столы" : ""}
          >
            <FaPlus /> Новая бронь
          </button>
        </div>
      </div>

      <div className="reservations__list">
        {loading && <div className="reservations__alert">Загрузка…</div>}

        {!loading &&
          filtered.map((r) => (
            <article key={r.id} className="reservations__card">
              <div className="reservations__card-left">
                <div className="reservations__avatar">
                  <FaConciergeBell />
                </div>
                <div>
                  <h3 className="reservations__name">
                    {r.date} • {r.time}
                  </h3>
                  <div className="reservations__meta">
                    <span className="reservations__muted">
                      <FaUser />
                      &nbsp;{r.guest} · {r.guests} чел.
                    </span>
                    {r.phone && (
                      <span className="reservations__muted">
                        <FaPhone />
                        &nbsp;{r.phone}
                      </span>
                    )}
                    <span className="reservations__muted">{tableTitle(r.table)}</span>
                    <StatusPill s={r.status} />
                  </div>
                </div>
              </div>

              <div className="reservations__rowActions">
                <button className="reservations__btn reservations__btn--secondary" onClick={() => openEdit(r)}>
                  <FaEdit /> Изменить
                </button>
                <button className="reservations__btn reservations__btn--danger" onClick={() => handleDelete(r.id)}>
                  <FaTrash /> Удалить
                </button>
              </div>
            </article>
          ))}

        {!loading && !filtered.length && (
          <div className="reservations__alert">Ничего не найдено по «{query}».</div>
        )}
      </div>

      {/* Модалка: создать/редактировать */}
      {modalOpen && (
        <div className="reservations__modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="reservations__modal" onClick={(e) => e.stopPropagation()}>
            <div className="reservations__modal-header">
              <h3 className="reservations__modal-title">{editingId == null ? "Новая бронь" : "Изменить бронь"}</h3>
              <button className="reservations__icon-btn" onClick={() => setModalOpen(false)}>
                <FaTimes />
              </button>
            </div>

            <form className="reservations__form" onSubmit={saveReservation}>
              <div className="reservations__form-grid">
                <div className="reservations__field">
                  <label className="reservations__label">Гость</label>
                  <input
                    className="reservations__input"
                    value={form.guest}
                    onChange={(e) => setForm((f) => ({ ...f, guest: e.target.value }))}
                    required
                    maxLength={255}
                  />
                </div>

                <div className="reservations__field">
                  <label className="reservations__label">Телефон</label>
                  <input
                    className="reservations__input"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    maxLength={32}
                  />
                </div>

                <div className="reservations__field">
                  <label className="reservations__label">Дата</label>
                  <input
                    type="date"
                    className="reservations__input"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    required
                  />
                </div>

                <div className="reservations__field">
                  <label className="reservations__label">Время</label>
                  <input
                    type="time"
                    className="reservations__input"
                    value={form.time}
                    onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                    required
                  />
                </div>

                <div className="reservations__field">
                  <label className="reservations__label">Гостей</label>
                  <input
                    type="number"
                    min={1}
                    max={32767}
                    className="reservations__input"
                    value={form.guests}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, guests: Math.max(1, Number(e.target.value) || 1) }))
                    }
                  />
                </div>

                <div className="reservations__field">
                  <label className="reservations__label">Стол</label>
                  {tables.length ? (
                    <select
                      className="reservations__input"
                      value={form.table}
                      onChange={(e) => setForm((f) => ({ ...f, table: e.target.value }))}
                      required
                    >
                      {tables.map((t) => (
                        <option key={t.id} value={t.id}>
                          Стол {t.number}
                          {t.places ? ` · ${t.places} мест` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="reservations__alert">Нет столов. Добавьте их во вкладке «Столы».</div>
                  )}
                </div>

                <div className="reservations__field">
                  <label className="reservations__label">Статус</label>
                  <select
                    className="reservations__input"
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="reservations__form-actions">
                <button type="button" className="reservations__btn reservations__btn--secondary" onClick={() => setModalOpen(false)}>
                  Отмена
                </button>
                <button type="submit" className="reservations__btn reservations__btn--primary">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default Reservations;
