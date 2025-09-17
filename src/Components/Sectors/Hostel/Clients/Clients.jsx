// src/components/Clients/Clients.jsx
// (полный файл)

import React, { useEffect, useMemo, useState } from "react";
import "./Clients.scss";
import api from "../../../../api";
import {
  getAll,
  createClient,
  updateClient,
  removeClient,
} from "./clientStore";

/* ===== helpers ===== */
const fmtMoney = (v) => (Number(v) || 0).toLocaleString() + " с";
const phoneNorm = (p) => (p || "").replace(/[^\d+]/g, "");
const statusRu = (v) =>
  ({
    new: "Новое",
    created: "Создано",
    paid: "Оплачено",
    completed: "Завершено",
    canceled: "Отменено",
    active: "Активно",
    history: "История",
  }[v] ||
  v ||
  "—");
const asArray = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
const num = (v) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const toYmd = (iso) => (iso ? String(iso).slice(0, 10) : "");
const ts = (d) => {
  const t = Date.parse(d || "");
  return Number.isFinite(t) ? t : 0;
};
const toLocalDT = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

/* misc */
const nightsBetween = (a, b) => {
  if (!a || !b) return 1;
  const ms = new Date(b) - new Date(a);
  const d = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return Math.max(1, d);
};

/* ===== normalizers ===== */
const normalizeBooking = (b) => ({
  id: b.id,
  client: b.client == null ? null : String(b.client),
  hotel: b.hotel ?? null,
  room: b.room ?? null,
  bed: b.bed ?? null,
  qty: Number(b.qty ?? 1) || 1,
  start_time: b.start_time || "",
  end_time: b.end_time || "",
  status: b.status || "created",
  purpose: b.purpose || "",
  total: num(b.total ?? b.amount ?? 0),
  created_at: b.created_at || null,
});

/* история бронирований (архив) */
const normalizeHistory = (h) => {
  const nights = nightsBetween(h.start_time, h.end_time);
  const snapPrice = num(h.target_price);
  return {
    id: `hist_${h.id}`, // чтобы не конфликтовало с обычными
    client: h.client == null ? null : String(h.client),
    // refs могут быть null — используем снапшот имени
    hotel: h.hotel ?? null,
    room: h.room ?? null,
    bed: h.bed ?? null,
    qty: 1, // в истории qty нет — считаем 1
    start_time: h.start_time || "",
    end_time: h.end_time || "",
    status: "history",
    purpose: h.purpose || "",
    total: nights * snapPrice, // считаем по снапшоту цены
    created_at: h.archived_at || null,
    // передадим снапшот типа/имени дальше в рендер
    obj_type: h.target_type || null, // "hotel" | "room" | "bed"
    obj_name: h.target_name || h.client_label || "",
  };
};

/* справочники */
const normalizeHotel = (h) => ({
  id: h.id,
  name: h.name ?? "",
  price: num(h.price ?? 0),
});
const normalizeRoom = (r) => ({
  id: r.id,
  name: r.name ?? "",
  price: num(r.price ?? 0),
});
const normalizeBed = (b) => ({
  id: b.id,
  name: b.name ?? "",
  price: num(b.price ?? 0),
  capacity: Number(b.capacity ?? 0),
});

/* самая свежая дата по броням клиента (ISO string или null) */
const calcClientUpdatedAt = (bookings) => {
  if (!bookings?.length) return null;
  let maxTs = 0;
  for (const b of bookings) {
    const t1 = ts(b.end_time);
    const t2 = ts(b.start_time);
    const t3 = ts(b.created_at);
    const cur = Math.max(t1, t2, t3);
    if (cur > maxTs) maxTs = cur;
  }
  return maxTs ? new Date(maxTs).toISOString() : null;
};

const Clients = () => {
  const [rows, setRows] = useState([]); // клиенты + bookings
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");

  const [objType, setObjType] = useState("all"); // all | hotel | room | bed
  const [objId, setObjId] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editId, setEditId] = useState(null);

  const [openId, setOpenId] = useState(null);

  const [hotelsMap, setHotelsMap] = useState({});
  const [roomsMap, setRoomsMap] = useState({});
  const [bedsMap, setBedsMap] = useState({});

  // inline confirm + deleting
  const [confirmId, setConfirmId] = useState(null); // id клиента, у которого спрашиваем подтверждение
  const [deletingId, setDeletingId] = useState(null); // id клиента, который сейчас удаляется

  /* ===== загрузка клиентов + брони + ИСТОРИЯ ===== */
  const load = async () => {
    try {
      setLoading(true);
      setErr("");

      const clients = await getAll();

      const [hotelsRes, roomsRes, bedsRes, bookingsAll, historyAll] =
        await Promise.all([
          fetchAll("/booking/hotels/"),
          fetchAll("/booking/rooms/"),
          fetchAll("/booking/beds/"),
          fetchAll("/booking/bookings/"),
          fetchAll("/booking/booking/history/"), // архив
        ]);

      const hotels = hotelsRes.map(normalizeHotel);
      const rooms = roomsRes.map(normalizeRoom);
      const beds = bedsRes.map(normalizeBed);

      const hotelsMapLocal = Object.fromEntries(
        hotels.map((h) => [String(h.id), h])
      );
      const roomsMapLocal = Object.fromEntries(
        rooms.map((r) => [String(r.id), r])
      );
      const bedsMapLocal = Object.fromEntries(
        beds.map((b) => [String(b.id), b])
      );
      setHotelsMap(hotelsMapLocal);
      setRoomsMap(roomsMapLocal);
      setBedsMap(bedsMapLocal);

      const incoming = bookingsAll.map(normalizeBooking);
      const archived = historyAll.map(normalizeHistory);

      // группировка по клиенту (обычные + архив), без дублей
      const byClient = new Map();
      const add = (b) => {
        const key = b.client ? String(b.client) : null;
        if (!key) return;
        if (!byClient.has(key)) byClient.set(key, []);
        const arr = byClient.get(key);
        if (!arr.some((x) => String(x.id) === String(b.id))) arr.push(b);
      };
      incoming.forEach(add);
      archived.forEach(add);

      // сортировка сырых записей по дате убыв.
      for (const [, arr] of byClient) {
        arr.sort(
          (a, b) =>
            (ts(b.end_time) || ts(b.start_time) || ts(b.created_at)) -
            (ts(a.end_time) || ts(a.start_time) || ts(a.created_at))
        );
      }

      // сборка строк UI + финальная сортировка по sortKey
      const merged = clients.map((c) => {
        const clientId = String(c.id);
        const bookingsForClient = byClient.get(clientId) || [];

        const rowsForClient = bookingsForClient
          .map((b) =>
            toClientBookingRow(b, {
              hotelsMap: hotelsMapLocal,
              roomsMap: roomsMapLocal,
              bedsMap: bedsMapLocal,
            })
          )
          .sort((a, b) => (b.sortKey || 0) - (a.sortKey || 0));

        const updated_at = rowsForClient.length
          ? new Date(rowsForClient[0].sortKey).toISOString()
          : calcClientUpdatedAt(bookingsForClient);

        return {
          ...c,
          updated_at,
          bookings: rowsForClient,
        };
      });

      setRows(merged);
    } catch (e) {
      console.error(e);
      setErr("Не удалось загрузить клиентов или брони");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* ===== Реакция на сохранение/удаление брони из Bookings.jsx ===== */
  useEffect(() => {
    const onSaved = (e) => {
      const raw = e?.detail?.booking;
      if (!raw || raw.client == null) return;
      const b = normalizeBooking(raw);
      const row = toClientBookingRow(b, { hotelsMap, roomsMap, bedsMap });

      setRows((prev) =>
        prev.map((c) => {
          if (String(c.id) !== String(b.client)) return c;

          const existing = c.bookings || [];
          const has = existing.some((x) => String(x.id) === String(b.id));
          const next = has
            ? existing.map((x) => (String(x.id) === String(b.id) ? row : x))
            : [row, ...existing];

          next.sort((a, bb) => (bb.sortKey || 0) - (a.sortKey || 0));

          const updated_at = next.length
            ? new Date(next[0].sortKey).toISOString()
            : c.updated_at || null;

          return { ...c, bookings: next, updated_at };
        })
      );
    };

    const onDeleted = (e) => {
      const id = e?.detail?.id;
      if (!id) return;
      setRows((prev) =>
        prev.map((c) => {
          const next = (c.bookings || []).filter(
            (b) => String(b.id) !== String(id)
          );
          next.sort((a, bb) => (bb.sortKey || 0) - (a.sortKey || 0));
          const updated_at = next.length
            ? new Date(next[0].sortKey).toISOString()
            : c.updated_at || null;
          return { ...c, bookings: next, updated_at };
        })
      );
    };

    window.addEventListener("clients:booking-saved", onSaved);
    window.addEventListener("clients:booking-deleted", onDeleted);
    return () => {
      window.removeEventListener("clients:booking-saved", onSaved);
      window.removeEventListener("clients:booking-deleted", onDeleted);
    };
  }, [hotelsMap, roomsMap, bedsMap]);

  /* ===== индекс объектов для фильтра ===== */
  const objectIndex = useMemo(() => {
    const hotels = new Map(),
      rooms = new Map(),
      beds = new Map();
    (rows || []).forEach((r) => {
      (r.bookings || []).forEach((b) => {
        if (b.obj_type === "hotel" && b.obj_id)
          hotels.set(String(b.obj_id), b.obj_name || `ID ${b.obj_id}`);
        if (b.obj_type === "room" && b.obj_id)
          rooms.set(String(b.obj_id), b.obj_name || `ID ${b.obj_id}`);
        if (b.obj_type === "bed" && b.obj_id)
          beds.set(String(b.obj_id), b.obj_name || `ID ${b.obj_id}`);
      });
    });
    return {
      hotels: Array.from(hotels, ([id, name]) => ({ id, name })),
      rooms: Array.from(rooms, ([id, name]) => ({ id, name })),
      beds: Array.from(beds, ([id, name]) => ({ id, name })),
    };
  }, [rows]);

  /* ===== поиск + фильтры ===== */
  const filtered = useMemo(() => {
    const sterm = q.trim().toLowerCase();
    let res = !sterm
      ? rows
      : rows.filter((r) =>
          `${r.full_name} ${r.phone}`.toLowerCase().includes(sterm)
        );
    if (objType !== "all") {
      res = res.filter((r) =>
        (r.bookings || []).some((b) => b.obj_type === objType)
      );
    }
    if (objType !== "all" && objId) {
      const idStr = String(objId);
      res = res.filter((r) =>
        (r.bookings || []).some(
          (b) => b.obj_type === objType && String(b.obj_id) === idStr
        )
      );
    }
    return [...res].sort(
      (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
    );
  }, [rows, q, objType, objId]);

  /* ===== CRUD клиента ===== */
  const onCreate = () => {
    setEditId(null);
    setIsFormOpen(true);
  };
  const onEdit = (id) => {
    setEditId(id);
    setIsFormOpen(true);
  };

  // inline-confirm: запросить удаление
  const askDelete = (id) => setConfirmId(String(id));
  const cancelDelete = () => setConfirmId(null);

  // inline-confirm: выполнить удаление
  const doDelete = async (id) => {
    const idStr = String(id);
    setDeletingId(idStr);
    try {
      await removeClient(id);
      // локально убираем клиента из списка
      setRows((prev) => prev.filter((c) => String(c.id) !== idStr));
      // если была открыта карточка этого клиента — закрываем
      if (String(openId) === idStr) setOpenId(null);
    } catch (e) {
      console.error(e);
      setErr("Не удалось удалить клиента");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  const onOpenCard = (id) => setOpenId(id);
  const onCloseCard = () => setOpenId(null);

  const lastObjectLabel = (c) => {
    const list = c.bookings || [];
    if (!list.length) return "—";
    // самый поздний по sortKey
    const last = list.reduce(
      (best, cur) => ((cur.sortKey || 0) > (best.sortKey || 0) ? cur : best),
      list[0]
    );
    if (!last || !last.obj_type) return "—";
    if (last.obj_type === "hotel")
      return `Гостиница: ${last.obj_name || last.obj_id}`;
    if (last.obj_type === "room") return `Зал: ${last.obj_name || last.obj_id}`;
    if (last.obj_type === "bed")
      return `Койко-место: ${last.obj_name || last.obj_id}`;
    return "—";
  };

  return (
    <section className="clients">
      <header className="clients__header">
        <div>
          <h2 className="clients__title">Клиенты</h2>
          <p className="clients__subtitle">
            Список гостей, поиск, фильтр по объектам
          </p>
        </div>

        <div className="clients__actions">
          <div className="clients__search">
            <span className="clients__searchIcon" aria-hidden>
              🔎
            </span>
            <input
              className="clients__searchInput"
              placeholder="Поиск по имени и телефону…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Поиск клиентов"
            />
          </div>

          <div
            className="clients__filterRow"
            role="group"
            aria-label="Фильтр по объектам"
          >
            <select
              className="clients__input"
              value={objType}
              onChange={(e) => {
                setObjType(e.target.value);
                setObjId("");
              }}
            >
              <option value="all">Все объекты</option>
              <option value="hotel">Комнаты</option>
              <option value="room">Залы</option>
              <option value="bed">Койко-места</option>
            </select>

            {objType !== "all" && (
              <select
                className="clients__input"
                value={objId}
                onChange={(e) => setObjId(e.target.value)}
              >
                <option value="">Все</option>
                {(objType === "hotel"
                  ? objectIndex.hotels
                  : objType === "room"
                  ? objectIndex.rooms
                  : objectIndex.beds
                ).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            )}
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
              <th>Брони</th>
              <th>Последний объект</th>
              <th>Обновлён</th>
              <th aria-label="Действия" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="clients__empty" colSpan={6}>
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
                    <td>{c.bookings?.length ?? 0}</td>
                    <td>{lastObjectLabel(c)}</td>
                    <td>
                      {c.updated_at
                        ? new Date(c.updated_at).toLocaleString()
                        : "—"}
                    </td>
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
                <td className="clients__empty" colSpan={6}>
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
      {openId && <ClientCard id={openId} onClose={onCloseCard} rows={rows} />}
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

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
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

    const normalizedPhone = (phone || "").replace(/[^\d+]/g, "");
    const others = (rows || []).filter((c) => !editing || c.id !== id);
    if (
      normalizedPhone &&
      others.some(
        (c) => (c.phone || "").replace(/[^\d+]/g, "") === normalizedPhone
      )
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
      if (editing) await updateClient(id, dto);
      else await createClient(dto);
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

/* ===== карточка клиента ===== */
const ClientCard = ({ id, onClose, rows }) => {
  const [tab, setTab] = useState("profile");
  const [openBooking, setOpenBooking] = useState(null); // модалка деталей брони

  useEffect(() => {
    const onKey = (e) =>
      e.key === "Escape" && (openBooking ? setOpenBooking(null) : onClose());
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, openBooking]);

  // блокируем «прыжок» страницы на время открытой карточки/модалки
  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  const client = rows.find((c) => c.id === id);
  if (!client) return null;

  const objectLabel = (b) => {
    if (!b || !b.obj_type) return "—";
    if (b.obj_type === "hotel") return `Гостиница: ${b.obj_name || b.obj_id}`;
    if (b.obj_type === "room") return `Зал: ${b.obj_name || b.obj_id}`;
    if (b.obj_type === "bed")
      return `Койко-место: ${b.obj_name || b.obj_id}${
        b.qty ? ` × ${b.qty}` : ""
      }`;
    return "—";
  };

  const nights = (b) => nightsBetween(b.from, b.to);
  const pricePerNight = (b) => {
    const n = nights(b) || 1;
    const total = Number(b.total) || 0;
    return total && n ? Math.round(total / n) : 0;
  };

  return (
    <div className="clients__modalOverlay" onClick={onClose}>
      <div
        className="clients__modalWide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clients-card-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="clients__modalHeader">
          <div id="clients-card-title" className="clients__modalTitle">
            Клиент — {client.full_name}
          </div>
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
              <div className="clients__statVal">
                {client.bookings?.length || 0}
              </div>
              <div className="clients__statLabel">Брони</div>
            </div>
          </div>
        </div>

        <div
          className="clients__tabs"
          role="tablist"
          aria-label="Вкладки клиента"
        >
          <button
            className={`clients__tab ${
              tab === "profile" ? "clients__tab--active" : ""
            }`}
            role="tab"
            aria-selected={tab === "profile"}
            onClick={() => setTab("profile")}
          >
            Профиль
          </button>
          <button
            className={`clients__tab ${
              tab === "bookings" ? "clients__tab--active" : ""
            }`}
            role="tab"
            aria-selected={tab === "bookings"}
            onClick={() => setTab("bookings")}
          >
            Брони
          </button>
        </div>

        {tab === "profile" && (
          <div className="clients__profileBody">
            <div className="clients__notes">
              <strong>Заметки:</strong>
              <div className="clients__noteArea">{client.notes || "—"}</div>
            </div>
            <div className="clients__muted">
              Создан:{" "}
              {client.created_at
                ? new Date(client.created_at).toLocaleString()
                : "—"}{" "}
              • Обновлён:{" "}
              {client.updated_at
                ? new Date(client.updated_at).toLocaleString()
                : "—"}
            </div>
          </div>
        )}

        {tab === "bookings" && (
          <div className="clients__tableWrap">
            <table className="clients__table">
              <thead>
                <tr>
                  <th>Статус</th>
                  <th>Объект</th>
                  <th>С</th>
                  <th>По</th>
                  <th>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {(client.bookings || []).length ? (
                  [...client.bookings]
                    .sort((a, b) => (b.sortKey || 0) - (a.sortKey || 0))
                    .map((b) => (
                      <tr
                        key={b.id}
                        className="clients__rowClickable"
                        style={{ cursor: "pointer" }}
                        onClick={() => setOpenBooking(b)}
                        title="Открыть детали брони"
                      >
                        <td>{statusRu(b.status)}</td>
                        <td>{objectLabel(b)}</td>
                        <td>{b.from}</td>
                        <td>{b.to}</td>
                        <td>{fmtMoney(b.total)}</td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td className="clients__empty" colSpan={5}>
                      Нет броней
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

      {/* ───────────── улучшенная модалка «Детали брони» ───────────── */}
      {openBooking && (
        <div
          className="clients__modalOverlay"
          onClick={() => setOpenBooking(null)}
        >
          <div
            className="clients__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="clients__modalHeader">
              <div id="booking-detail-title" className="clients__modalTitle">
                🧾 Детали брони
              </div>
              <button
                className="clients__iconBtn"
                onClick={() => setOpenBooking(null)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            {/* Верхний краткий блок */}
            <div className="clients__notes" style={{ marginBottom: 6 }}>
              <strong>Объект:</strong>
              <div className="clients__noteArea">
                {objectLabel(openBooking)}
              </div>
            </div>

            {/* Сетка ключевых полей */}
            <div className="clients__form" style={{ paddingTop: 0 }}>
              <div className="clients__formGrid">
                <div className="clients__field">
                  <label className="clients__label">Статус</label>
                  <div>{statusRu(openBooking.status)}</div>
                </div>

                <div className="clients__field">
                  <label className="clients__label">Создано</label>
                  <div>{toLocalDT(openBooking.created_at)}</div>
                </div>

                <div className="clients__field">
                  <label className="clients__label">Период</label>
                  <div>
                    {openBooking.from || "—"} — {openBooking.to || "—"}
                  </div>
                </div>

                <div className="clients__field">
                  <label className="clients__label">Ночей</label>
                  <div>{nights(openBooking)}</div>
                </div>

                <div className="clients__field">
                  <label className="clients__label">Сумма</label>
                  <div>{fmtMoney(openBooking.total)}</div>
                </div>

                <div className="clients__field">
                  <label className="clients__label">Цена за ночь</label>
                  <div>{fmtMoney(pricePerNight(openBooking))}</div>
                </div>
              </div>

              {openBooking.purpose ? (
                <div className="clients__notes" style={{ marginTop: 6 }}>
                  <strong>Назначение:</strong>
                  <div className="clients__noteArea">{openBooking.purpose}</div>
                </div>
              ) : null}
            </div>

            <div className="clients__modalFooter">
              <button
                className="clients__btn"
                onClick={() => setOpenBooking(null)}
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

/* ===== утилиты ===== */
async function fetchAll(firstUrl) {
  let url = firstUrl;
  const acc = [];
  let guard = 0;
  while (url && guard < 40) {
    const { data } = await api.get(url);
    const arr = asArray(data);
    acc.push(...arr);
    url = data?.next || null;
    guard += 1;
  }
  return acc;
}

function toClientBookingRow(b, { hotelsMap, roomsMap, bedsMap }) {
  const from = toYmd(b.start_time);
  const to = toYmd(b.end_time);

  // сумма
  let total = num(b.total);
  if (!total) {
    const nights = nightsBetween(b.start_time, b.end_time);
    if (b.bed)
      total =
        nights *
        (bedsMap[String(b.bed)]?.price || 0) *
        Math.max(1, Number(b.qty || 1));
    else if (b.hotel) total = nights * (hotelsMap[String(b.hotel)]?.price || 0);
    else if (b.room) total = nights * (roomsMap[String(b.room)]?.price || 0);
    else total = 0;
  }

  // ключ свежести (максимум из end/start/created_at)
  const sortKey = Math.max(ts(b.end_time), ts(b.start_time), ts(b.created_at));

  // объект
  let obj_type = b.obj_type || null;
  let obj_id = null;
  let obj_name = b.obj_name || "";

  if (!obj_type) {
    if (b.hotel) {
      obj_type = "hotel";
      obj_id = b.hotel;
      obj_name = hotelsMap[String(b.hotel)]?.name || "";
    } else if (b.room) {
      obj_type = "room";
      obj_id = b.room;
      obj_name = roomsMap[String(b.room)]?.name || "";
    } else if (b.bed) {
      obj_type = "bed";
      obj_id = b.bed;
      obj_name = bedsMap[String(b.bed)]?.name || "";
    }
  } else {
    // если тип есть, а id не указан — оставим снапшот имени
    if (obj_type === "hotel") obj_id = b.hotel ?? obj_id;
    if (obj_type === "room") obj_id = b.room ?? obj_id;
    if (obj_type === "bed") obj_id = b.bed ?? obj_id;
  }

  const qty = Number(b.qty || 1) || 1;

  return {
    id: b.id,
    status: b.status || "created",
    from,
    to,
    total,
    obj_type,
    obj_id,
    obj_name,
    qty: obj_type === "bed" ? qty : undefined,
    sortKey, // для «последнего объекта»
    purpose: b.purpose || "", // для модалки
    created_at: b.created_at || null, // для модалки
  };
}

export default Clients;
