// src/components/Booking/RoomsHalls.jsx
import React, { useEffect, useMemo, useState } from "react";
import { FaSearch, FaPlus, FaTimes } from "react-icons/fa";
import api from "../../../../api";
import "./rooms-halls.scss";

/* ===== helpers ===== */
const asArray = (data) =>
  Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

const prettyPrice = (p) => {
  const n = Number(p);
  return Number.isFinite(n) ? n.toLocaleString() : (p || "0");
};

/* ===== validators ===== */
const isNonEmpty = (v) => String(v ?? "").trim().length > 0;
const isNonNegInt = (v) => Number.isInteger(Number(v)) && Number(v) >= 0;
const isMoney = (v) => /^(\d+([.,]\d{1,2})?)$/.test(String(v ?? "").trim());

/* ===== normalizers ===== */
const normalizeHotel = (h) => ({
  id: h.id,
  name: h.name ?? "",
  capacity: Number(h.capacity ?? 0),
  price: typeof h.price === "string" ? h.price : String(h.price ?? ""),
  description: h.description ?? "",
});

const normalizeHall = (h) => ({
  id: h.id,
  name: h.name ?? "",
  capacity: Number(h.capacity ?? 0),
  location: h.location ?? "",
  price: typeof h.price === "string" ? h.price : String(h.price ?? ""),
});

const normalizeBed = (b) => ({
  id: b.id,
  name: b.name ?? "",
  capacity: Number(b.capacity ?? 0),
  price: typeof b.price === "string" ? b.price : String(b.price ?? ""),
  description: b.description ?? "",
});

export default function RoomsHalls() {
  const TABS = { HOTELS: "hotels", HALLS: "halls", BEDS: "beds" };
  const [tab, setTab] = useState(TABS.HOTELS);

  // Комнаты
  const [hotels, setHotels] = useState([]);
  const [loadingHotels, setLoadingHotels] = useState(true);
  const [errorHotels, setErrorHotels] = useState("");

  // Залы
  const [halls, setHalls] = useState([]);
  const [loadingHalls, setLoadingHalls] = useState(true);
  const [errorHalls, setErrorHalls] = useState("");

  // Койко-места
  const [beds, setBeds] = useState([]);
  const [loadingBeds, setLoadingBeds] = useState(true);
  const [errorBeds, setErrorBeds] = useState("");

  // Поиск
  const [q, setQ] = useState("");

  // Модалки и формы
  const [hotelModalOpen, setHotelModalOpen] = useState(false);
  const [hotelEditingId, setHotelEditingId] = useState(null);
  const [hotelForm, setHotelForm] = useState({
    name: "",
    capacity: 1,
    price: "",
    description: "",
  });
  const [hotelTouched, setHotelTouched] = useState({});
  const [hotelSubmitAttempt, setHotelSubmitAttempt] = useState(false);
  const [hotelSaveError, setHotelSaveError] = useState("");

  const [hallModalOpen, setHallModalOpen] = useState(false);
  const [hallEditingId, setHallEditingId] = useState(null);
  const [hallForm, setHallForm] = useState({
    name: "",
    capacity: 1,
    location: "",
    price: "",
  });
  const [hallTouched, setHallTouched] = useState({});
  const [hallSubmitAttempt, setHallSubmitAttempt] = useState(false);
  const [hallSaveError, setHallSaveError] = useState("");

  const [bedModalOpen, setBedModalOpen] = useState(false);
  const [bedEditingId, setBedEditingId] = useState(null);
  const [bedForm, setBedForm] = useState({
    name: "",
    capacity: 1,
    price: "",
    description: "",
  });
  const [bedTouched, setBedTouched] = useState({});
  const [bedSubmitAttempt, setBedSubmitAttempt] = useState(false);
  const [bedSaveError, setBedSaveError] = useState("");

  const [saving, setSaving] = useState(false);

  // Встроенное подтверждение удаления
  const [confirmHotelId, setConfirmHotelId] = useState(null);
  const [confirmHallId, setConfirmHallId] = useState(null);
  const [confirmBedId, setConfirmBedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  /* ===== Escape для всех модалок (фикс безусловным хуком) ===== */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setHotelModalOpen(false);
        setHallModalOpen(false);
        setBedModalOpen(false);
        setConfirmHotelId(null);
        setConfirmHallId(null);
        setConfirmBedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ===================== Load ===================== */
  useEffect(() => {
    const loadHotels = async () => {
      try {
        setLoadingHotels(true);
        setErrorHotels("");
        const { data } = await api.get("/booking/hotels/");
        setHotels(asArray(data).map(normalizeHotel));
      } catch (e) {
        console.error(e);
        setErrorHotels("Не удалось загрузить комнаты");
      } finally {
        setLoadingHotels(false);
      }
    };

    const loadHalls = async () => {
      try {
        setLoadingHalls(true);
        setErrorHalls("");
        const { data } = await api.get("/booking/rooms/");
        setHalls(asArray(data).map(normalizeHall));
      } catch (e) {
        console.error(e);
        setErrorHalls("Не удалось загрузить залы");
      } finally {
        setLoadingHalls(false);
      }
    };

    const loadBeds = async () => {
      try {
        setLoadingBeds(true);
        setErrorBeds("");
        const { data } = await api.get("/booking/beds/");
        setBeds(asArray(data).map(normalizeBed));
      } catch (e) {
        console.error(e);
        setErrorBeds("Не удалось загрузить койко-места");
      } finally {
        setLoadingBeds(false);
      }
    };

    loadHotels();
    loadHalls();
    loadBeds();
  }, []);

  /* ===================== CRUD: Hotels ===================== */
  const createHotel = async (payload) => {
    const { data } = await api.post("/booking/hotels/", payload);
    return normalizeHotel(data);
  };
  const updateHotel = async (id, payload) => {
    const { data } = await api.put(`/booking/hotels/${id}/`, payload);
    return normalizeHotel(data);
  };
  const deleteHotel = async (id) => {
    await api.delete(`/booking/hotels/${id}/`);
  };

  /* ===================== CRUD: Halls ===================== */
  const createHall = async (payload) => {
    const { data } = await api.post("/booking/rooms/", payload);
    return normalizeHall(data);
  };
  const updateHall = async (id, payload) => {
    const { data } = await api.put(`/booking/rooms/${id}/`, payload);
    return normalizeHall(data);
  };
  const deleteHall = async (id) => {
    await api.delete(`/booking/rooms/${id}/`);
  };

  /* ===================== CRUD: Beds ===================== */
  const createBed = async (payload) => {
    const { data } = await api.post("/booking/beds/", payload);
    return normalizeBed(data);
  };
  const updateBed = async (id, payload) => {
    const { data } = await api.put(`/booking/beds/${id}/`, payload);
    return normalizeBed(data);
  };
  const deleteBed = async (id) => {
    await api.delete(`/booking/beds/${id}/`);
  };

  /* ===================== Filters ===================== */
  const filteredHotels = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return hotels;
    return hotels.filter((h) =>
      [h.name, h.description, h.capacity, h.price].some((v) =>
        String(v).toLowerCase().includes(t)
      )
    );
  }, [q, hotels]);

  const filteredHalls = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return halls;
    return halls.filter((h) =>
      [h.name, h.location, h.capacity, h.price].some((v) =>
        String(v).toLowerCase().includes(t)
      )
    );
  }, [q, halls]);

  const filteredBeds = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return beds;
    return beds.filter((b) =>
      [b.name, b.description, b.capacity, b.price].some((v) =>
        String(v).toLowerCase().includes(t)
      )
    );
  }, [q, beds]);

  /* ========= per-form validation helpers ========= */
  const hotelErrors = (() => {
    const e = {};
    if (!isNonEmpty(hotelForm.name)) e.name = "Укажите название";
    if (!isNonNegInt(hotelForm.capacity)) e.capacity = "Целое число ≥ 0";
    if (!isNonEmpty(hotelForm.price)) e.price = "Укажите цену";
    else if (!isMoney(hotelForm.price)) e.price = "Формат: 3500 или 3500,50";
    if (hotelForm.description && String(hotelForm.description).length > 1000)
      e.description = "Максимум 1000 символов";
    return e;
  })();
  const hallErrors = (() => {
    const e = {};
    if (!isNonEmpty(hallForm.name)) e.name = "Укажите название";
    if (!isNonNegInt(hallForm.capacity)) e.capacity = "Целое число ≥ 0";
    if (!isNonEmpty(hallForm.location)) e.location = "Укажите локацию";
    if (!isNonEmpty(hallForm.price)) e.price = "Укажите цену";
    else if (!isMoney(hallForm.price)) e.price = "Формат: 1200 или 1200,50";
    return e;
  })();
  const bedErrors = (() => {
    const e = {};
    if (!isNonEmpty(bedForm.name)) e.name = "Укажите название";
    if (!isNonNegInt(bedForm.capacity)) e.capacity = "Целое число ≥ 0";
    if (!isNonEmpty(bedForm.price)) e.price = "Укажите цену";
    else if (!isMoney(bedForm.price)) e.price = "Формат: 700 или 700,50";
    if (bedForm.description && String(bedForm.description).length > 1000)
      e.description = "Максимум 1000 символов";
    return e;
  })();

  const hotelHasErrors = Object.keys(hotelErrors).length > 0;
  const hallHasErrors = Object.keys(hallErrors).length > 0;
  const bedHasErrors = Object.keys(bedErrors).length > 0;

  const showHotelErr = (k) => (hotelSubmitAttempt || hotelTouched[k]) && hotelErrors[k];
  const showHallErr = (k) => (hallSubmitAttempt || hallTouched[k]) && hallErrors[k];
  const showBedErr = (k) => (bedSubmitAttempt || bedTouched[k]) && bedErrors[k];

  /* ===================== Modals Open ===================== */
  const openHotelCreate = () => {
    setHotelEditingId(null);
    setHotelForm({ name: "", capacity: 1, price: "", description: "" });
    setHotelTouched({});
    setHotelSubmitAttempt(false);
    setHotelSaveError("");
    setHotelModalOpen(true);
  };
  const openHotelEdit = (h) => {
    setHotelEditingId(h.id);
    setHotelForm({
      name: h.name,
      capacity: h.capacity,
      price: h.price ?? "",
      description: h.description ?? "",
    });
    setHotelTouched({});
    setHotelSubmitAttempt(false);
    setHotelSaveError("");
    setHotelModalOpen(true);
  };

  const openHallCreate = () => {
    setHallEditingId(null);
    setHallForm({ name: "", capacity: 1, location: "", price: "" });
    setHallTouched({});
    setHallSubmitAttempt(false);
    setHallSaveError("");
    setHallModalOpen(true);
  };
  const openHallEdit = (h) => {
    setHallEditingId(h.id);
    setHallForm({
      name: h.name,
      capacity: h.capacity,
      location: h.location,
      price: h.price ?? "",
    });
    setHallTouched({});
    setHallSubmitAttempt(false);
    setHallSaveError("");
    setHallModalOpen(true);
  };

  const openBedCreate = () => {
    setBedEditingId(null);
    setBedForm({ name: "", capacity: 1, price: "", description: "" });
    setBedTouched({});
    setBedSubmitAttempt(false);
    setBedSaveError("");
    setBedModalOpen(true);
  };
  const openBedEdit = (b) => {
    setBedEditingId(b.id);
    setBedForm({
      name: b.name,
      capacity: b.capacity,
      price: b.price ?? "",
      description: b.description ?? "",
    });
    setBedTouched({});
    setBedSubmitAttempt(false);
    setBedSaveError("");
    setBedModalOpen(true);
  };

  /* ===================== Submits ===================== */
  const submitHotel = async (e) => {
    e.preventDefault();
    setHotelSubmitAttempt(true);
    setHotelSaveError("");
    if (hotelHasErrors) return;

    const payload = {
      name: hotelForm.name.trim(),
      capacity: Number(hotelForm.capacity) || 0,
      price: String(hotelForm.price ?? "").trim().replace(",", "."),
      description: hotelForm.description?.trim() || "",
    };
    try {
      setSaving(true);
      if (hotelEditingId == null) {
        const created = await createHotel(payload);
        setHotels((p) => [created, ...p]);
      } else {
        const updated = await updateHotel(hotelEditingId, payload);
        setHotels((p) => p.map((x) => (x.id === hotelEditingId ? updated : x)));
      }
      setHotelModalOpen(false);
      setHotelEditingId(null);
      setHotelForm({ name: "", capacity: 1, price: "", description: "" });
    } catch (e2) {
      console.error(e2);
      setHotelSaveError("Сохранить не удалось. Попробуйте ещё раз.");
    } finally {
      setSaving(false);
    }
  };

  const submitHall = async (e) => {
    e.preventDefault();
    setHallSubmitAttempt(true);
    setHallSaveError("");
    if (hallHasErrors) return;

    const payload = {
      name: hallForm.name.trim(),
      capacity: Number(hallForm.capacity) || 0,
      location: hallForm.location.trim(),
      price: String(hallForm.price ?? "").trim().replace(",", "."),
    };
    try {
      setSaving(true);
      if (hallEditingId == null) {
        const created = await createHall(payload);
        setHalls((p) => [created, ...p]);
      } else {
        const updated = await updateHall(hallEditingId, payload);
        setHalls((p) => p.map((x) => (x.id === hallEditingId ? updated : x)));
      }
      setHallModalOpen(false);
      setHallEditingId(null);
      setHallForm({ name: "", capacity: 1, location: "", price: "" });
    } catch (e2) {
      console.error(e2);
      setHallSaveError("Сохранить не удалось. Попробуйте ещё раз.");
    } finally {
      setSaving(false);
    }
  };

  const submitBed = async (e) => {
    e.preventDefault();
    setBedSubmitAttempt(true);
    setBedSaveError("");
    if (bedHasErrors) return;

    const payload = {
      name: bedForm.name.trim(),
      capacity: Number(bedForm.capacity) || 0,
      price: String(bedForm.price ?? "").trim().replace(",", "."),
      description: bedForm.description?.trim() || "",
    };
    try {
      setSaving(true);
      if (bedEditingId == null) {
        const created = await createBed(payload);
        setBeds((p) => [created, ...p]);
      } else {
        const updated = await updateBed(bedEditingId, payload);
        setBeds((p) => p.map((x) => (x.id === bedEditingId ? updated : x)));
      }
      setBedModalOpen(false);
      setBedEditingId(null);
      setBedForm({ name: "", capacity: 1, price: "", description: "" });
    } catch (e2) {
      console.error(e2);
      setBedSaveError("Сохранить не удалось. Попробуйте ещё раз.");
    } finally {
      setSaving(false);
    }
  };

  /* ===================== Deletions (inline confirm) ===================== */
  const onDeleteHotel = async (id) => {
    setDeletingId(id);
    try {
      await deleteHotel(id);
      setHotels((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
      setConfirmHotelId(null);
    }
  };

  const onDeleteHall = async (id) => {
    setDeletingId(id);
    try {
      await deleteHall(id);
      setHalls((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
      setConfirmHallId(null);
    }
  };

  const onDeleteBed = async (id) => {
    setDeletingId(id);
    try {
      await deleteBed(id);
      setBeds((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
      setConfirmBedId(null);
    }
  };

  /* ===================== Render ===================== */
  const isHotels = tab === TABS.HOTELS;
  const isHalls  = tab === TABS.HALLS;
  const isBeds   = tab === TABS.BEDS;

  return (
    <section className="rh">
      {/* Tabs */}
      <div className="rh__tabs">
        <button className={`rh__tab ${isHotels ? "rh__tab--active" : ""}`} onClick={() => setTab(TABS.HOTELS)}>
          Комнаты
        </button>
        <button className={`rh__tab ${isHalls ? "rh__tab--active" : ""}`} onClick={() => setTab(TABS.HALLS)}>
          Залы
        </button>
        <button className={`rh__tab ${isBeds ? "rh__tab--active" : ""}`} onClick={() => setTab(TABS.BEDS)}>
          Койко-места
        </button>
      </div>

      {/* Header */}
      <header className="rh__header">
        <div>
          <h2 className="rh__title">{isHotels ? "Комнаты" : isHalls ? "Залы" : "Койко-места"}</h2>
          <p className="rh__subtitle">
            {isHotels
              ? "Создание, редактирование и список всех комнат"
              : isHalls
              ? "Создание, редактирование и список всех залов"
              : "Создание, редактирование и список всех койко-мест (хостел)"}
          </p>
        </div>

        <div className="rh__actions">
          <div className="rh__search">
            <FaSearch className="rh__searchIcon" />
            <input
              className="rh__searchInput"
              placeholder={
                isHotels
                  ? "Поиск по названию, описанию, вместимости, цене"
                  : isHalls
                  ? "Поиск по названию, локации, вместимости и цене"
                  : "Поиск по названию, описанию, количеству мест и цене"
              }
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Поиск"
            />
          </div>

          {isHotels ? (
            <button className="rh__btn rh__btn--primary" onClick={openHotelCreate}>
              <FaPlus /> Добавить
            </button>
          ) : isHalls ? (
            <button className="rh__btn rh__btn--primary" onClick={openHallCreate}>
              <FaPlus /> Добавить
            </button>
          ) : (
            <button className="rh__btn rh__btn--primary" onClick={openBedCreate}>
              <FaPlus /> Добавить
            </button>
          )}
        </div>
      </header>

      {/* Lists */}
      {isHotels ? (
        loadingHotels ? (
          <div className="rh__empty">Загрузка…</div>
        ) : errorHotels ? (
          <div className="rh__empty">{errorHotels}</div>
        ) : (
          <div className="rh__list">
            {filteredHotels.map((h) => (
              <div key={h.id} className="rh__row">
                <div className="rh__rowLeft">
                  <div className="rh__name">{h.name}</div>
                  <div className="rh__meta">
                    <span className="rh__badge">Вместимость: {h.capacity}</span>
                    <span className="rh__price">{prettyPrice(h.price)} сом</span>
                  </div>
                  {h.description && (
                    <div className="rh__desc" title={h.description}>
                      {h.description.length > 140 ? h.description.slice(0, 140) + "…" : h.description}
                    </div>
                  )}
                </div>
                <div className="rh__rowRight">
                  {confirmHotelId === h.id ? (
                    <>
                      <span className="rh__badge">Удалить?</span>
                      <button
                        className="rh__btn rh__btn--secondary"
                        onClick={() => onDeleteHotel(h.id)}
                        disabled={deletingId === h.id}
                      >
                        Да
                      </button>
                      <button
                        className="rh__btn rh__btn--secondary"
                        onClick={() => setConfirmHotelId(null)}
                        disabled={deletingId === h.id}
                      >
                        Нет
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="rh__btn rh__btn--secondary" onClick={() => openHotelEdit(h)}>Изменить</button>
                      <button className="rh__btn rh__btn--secondary" onClick={() => setConfirmHotelId(h.id)}>Удалить</button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {filteredHotels.length === 0 && <div className="rh__empty">Ничего не найдено</div>}
          </div>
        )
      ) : isHalls ? (
        loadingHalls ? (
          <div className="rh__empty">Загрузка…</div>
        ) : errorHalls ? (
          <div className="rh__empty">{errorHalls}</div>
        ) : (
          <div className="rh__list">
            {filteredHalls.map((h) => (
              <div key={h.id} className="rh__row">
                <div className="rh__rowLeft">
                  <div className="rh__name">{h.name}</div>
                  <div className="rh__meta">
                    <span className="rh__badge">Вместимость: {h.capacity}</span>
                    <span className="rh__badge">Локация: {h.location || "—"}</span>
                    <span className="rh__price">{prettyPrice(h.price)} сом</span>
                  </div>
                </div>
                <div className="rh__rowRight">
                  {confirmHallId === h.id ? (
                    <>
                      <span className="rh__badge">Удалить?</span>
                      <button
                        className="rh__btn rh__btn--secondary"
                        onClick={() => onDeleteHall(h.id)}
                        disabled={deletingId === h.id}
                      >
                        Да
                      </button>
                      <button
                        className="rh__btn rh__btn--secondary"
                        onClick={() => setConfirmHallId(null)}
                        disabled={deletingId === h.id}
                      >
                        Нет
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="rh__btn rh__btn--secondary" onClick={() => openHallEdit(h)}>Изменить</button>
                      <button className="rh__btn rh__btn--secondary" onClick={() => setConfirmHallId(h.id)}>Удалить</button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {filteredHalls.length === 0 && <div className="rh__empty">Ничего не найдено</div>}
          </div>
        )
      ) : // Beds
      loadingBeds ? (
        <div className="rh__empty">Загрузка…</div>
      ) : errorBeds ? (
        <div className="rh__empty">{errorBeds}</div>
      ) : (
        <div className="rh__list">
          {filteredBeds.map((b) => (
            <div key={b.id} className="rh__row">
              <div className="rh__rowLeft">
                <div className="rh__name">{b.name}</div>
                <div className="rh__meta">
                  <span className="rh__badge">Мест: {b.capacity}</span>
                  <span className="rh__price">{prettyPrice(b.price)} сом</span>
                </div>
                {b.description && (
                  <div className="rh__desc" title={b.description}>
                    {b.description.length > 140 ? b.description.slice(0, 140) + "…" : b.description}
                  </div>
                )}
              </div>
              <div className="rh__rowRight">
                {confirmBedId === b.id ? (
                  <>
                    <span className="rh__badge">Удалить?</span>
                    <button
                      className="rh__btn rh__btn--secondary"
                      onClick={() => onDeleteBed(b.id)}
                      disabled={deletingId === b.id}
                    >
                      Да
                    </button>
                    <button
                      className="rh__btn rh__btn--secondary"
                      onClick={() => setConfirmBedId(null)}
                      disabled={deletingId === b.id}
                    >
                      Нет
                    </button>
                  </>
                ) : (
                  <>
                    <button className="rh__btn rh__btn--secondary" onClick={() => openBedEdit(b)}>Изменить</button>
                    <button className="rh__btn rh__btn--secondary" onClick={() => setConfirmBedId(b.id)}>Удалить</button>
                  </>
                )}
              </div>
            </div>
          ))}
          {filteredBeds.length === 0 && <div className="rh__empty">Ничего не найдено</div>}
        </div>
      )}

      {/* Модал: Комнаты */}
      {hotelModalOpen && (
        <div className="rh__modalOverlay" onClick={() => setHotelModalOpen(false)}>
          <div
            className="rh__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rh-hotel-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rh__modalHeader">
              <div id="rh-hotel-title" className="rh__modalTitle">
                {hotelEditingId == null ? "Новая комната" : "Изменить комнату"}
              </div>
              <button className="rh__iconBtn" onClick={() => setHotelModalOpen(false)} aria-label="Закрыть">
                <FaTimes />
              </button>
            </div>

            {hotelSaveError && <div className="rh__formError">{hotelSaveError}</div>}

            <form className="rh__form" onSubmit={submitHotel} noValidate>
              <div className="rh__formGrid">
                <div className="rh__field">
                  <label className="rh__label">
                    Название <span className="rh__req">*</span>
                  </label>
                  <input
                    className={`rh__input ${showHotelErr("name") ? "rh__input--invalid" : ""}`}
                    maxLength={200}
                    value={hotelForm.name}
                    onBlur={() => setHotelTouched((t) => ({ ...t, name: true }))}
                    onChange={(e) => setHotelForm({ ...hotelForm, name: e.target.value })}
                    required
                    aria-invalid={!!showHotelErr("name")}
                  />
                  {showHotelErr("name") && <div className="rh__fieldError">{hotelErrors.name}</div>}
                </div>

                <div className="rh__field">
                  <label className="rh__label">Вместимость</label>
                  <input
                    type="number"
                    min={0}
                    className={`rh__input ${showHotelErr("capacity") ? "rh__input--invalid" : ""}`}
                    value={hotelForm.capacity}
                    onBlur={() => setHotelTouched((t) => ({ ...t, capacity: true }))}
                    onChange={(e) => setHotelForm({ ...hotelForm, capacity: Number(e.target.value) })}
                    aria-invalid={!!showHotelErr("capacity")}
                  />
                  {showHotelErr("capacity") && <div className="rh__fieldError">{hotelErrors.capacity}</div>}
                </div>

                <div className="rh__field">
                  <label className="rh__label">
                    Цена (сом) <span className="rh__req">*</span>
                  </label>
                  <input
                    inputMode="decimal"
                    className={`rh__input ${showHotelErr("price") ? "rh__input--invalid" : ""}`}
                    placeholder="Напр., 3500.00"
                    value={hotelForm.price}
                    onBlur={() => setHotelTouched((t) => ({ ...t, price: true }))}
                    onChange={(e) => setHotelForm({ ...hotelForm, price: e.target.value })}
                    required
                    aria-invalid={!!showHotelErr("price")}
                  />
                  {showHotelErr("price") && <div className="rh__fieldError">{hotelErrors.price}</div>}
                </div>

                <div className="rh__field">
                  <label className="rh__label">Описание</label>
                  <textarea
                    rows={3}
                    className={`rh__input ${showHotelErr("description") ? "rh__input--invalid" : ""}`}
                    value={hotelForm.description}
                    onBlur={() => setHotelTouched((t) => ({ ...t, description: true }))}
                    onChange={(e) => setHotelForm({ ...hotelForm, description: e.target.value })}
                    aria-invalid={!!showHotelErr("description")}
                  />
                  {showHotelErr("description") && <div className="rh__fieldError">{hotelErrors.description}</div>}
                </div>
              </div>

              <div className="rh__formActions">
                <button type="button" className="rh__btn rh__btn--secondary" onClick={() => setHotelModalOpen(false)} disabled={saving}>
                  Отмена
                </button>
                <button
                  type="submit"
                  className="rh__btn rh__btn--primary"
                  disabled={saving || hotelHasErrors}
                  title={hotelHasErrors ? "Исправьте ошибки формы" : undefined}
                >
                  {saving ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модал: Залы */}
      {hallModalOpen && (
        <div className="rh__modalOverlay" onClick={() => setHallModalOpen(false)}>
          <div
            className="rh__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rh-hall-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rh__modalHeader">
              <div id="rh-hall-title" className="rh__modalTitle">
                {hallEditingId == null ? "Новый зал" : "Изменить зал"}
              </div>
              <button className="rh__iconBtn" onClick={() => setHallModalOpen(false)} aria-label="Закрыть">
                <FaTimes />
              </button>
            </div>

            {hallSaveError && <div className="rh__formError">{hallSaveError}</div>}

            <form className="rh__form" onSubmit={submitHall} noValidate>
              <div className="rh__formGrid">
                <div className="rh__field">
                  <label className="rh__label">
                    Название зала <span className="rh__req">*</span>
                  </label>
                  <input
                    className={`rh__input ${showHallErr("name") ? "rh__input--invalid" : ""}`}
                    maxLength={100}
                    value={hallForm.name}
                    onBlur={() => setHallTouched((t) => ({ ...t, name: true }))}
                    onChange={(e) => setHallForm({ ...hallForm, name: e.target.value })}
                    required
                    aria-invalid={!!showHallErr("name")}
                  />
                  {showHallErr("name") && <div className="rh__fieldError">{hallErrors.name}</div>}
                </div>

                <div className="rh__field">
                  <label className="rh__label">Вместимость</label>
                  <input
                    type="number"
                    min={0}
                    className={`rh__input ${showHallErr("capacity") ? "rh__input--invalid" : ""}`}
                    value={hallForm.capacity}
                    onBlur={() => setHallTouched((t) => ({ ...t, capacity: true }))}
                    onChange={(e) => setHallForm({ ...hallForm, capacity: Number(e.target.value) })}
                    aria-invalid={!!showHallErr("capacity")}
                  />
                  {showHallErr("capacity") && <div className="rh__fieldError">{hallErrors.capacity}</div>}
                </div>

                <div className="rh__field">
                  <label className="rh__label">
                    Локация <span className="rh__req">*</span>
                  </label>
                  <input
                    className={`rh__input ${showHallErr("location") ? "rh__input--invalid" : ""}`}
                    maxLength={255}
                    value={hallForm.location}
                    onBlur={() => setHallTouched((t) => ({ ...t, location: true }))}
                    onChange={(e) => setHallForm({ ...hallForm, location: e.target.value })}
                    required
                    aria-invalid={!!showHallErr("location")}
                  />
                  {showHallErr("location") && <div className="rh__fieldError">{hallErrors.location}</div>}
                </div>

                <div className="rh__field">
                  <label className="rh__label">
                    Цена (сом) <span className="rh__req">*</span>
                  </label>
                  <input
                    inputMode="decimal"
                    className={`rh__input ${showHallErr("price") ? "rh__input--invalid" : ""}`}
                    placeholder="Напр., 1200.00"
                    value={hallForm.price}
                    onBlur={() => setHallTouched((t) => ({ ...t, price: true }))}
                    onChange={(e) => setHallForm({ ...hallForm, price: e.target.value })}
                    required
                    aria-invalid={!!showHallErr("price")}
                  />
                  {showHallErr("price") && <div className="rh__fieldError">{hallErrors.price}</div>}
                </div>
              </div>

              <div className="rh__formActions">
                <button type="button" className="rh__btn rh__btn--secondary" onClick={() => setHallModalOpen(false)} disabled={saving}>
                  Отмена
                </button>
                <button
                  type="submit"
                  className="rh__btn rh__btn--primary"
                  disabled={saving || hallHasErrors}
                  title={hallHasErrors ? "Исправьте ошибки формы" : undefined}
                >
                  {saving ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модал: Койко-места */}
      {bedModalOpen && (
        <div className="rh__modalOverlay" onClick={() => setBedModalOpen(false)}>
          <div
            className="rh__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rh-bed-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rh__modalHeader">
              <div id="rh-bed-title" className="rh__modalTitle">
                {bedEditingId == null ? "Новое койко-место" : "Изменить койко-место"}
              </div>
              <button className="rh__iconBtn" onClick={() => setBedModalOpen(false)} aria-label="Закрыть">
                <FaTimes />
              </button>
            </div>

            {bedSaveError && <div className="rh__formError">{bedSaveError}</div>}

            <form className="rh__form" onSubmit={submitBed} noValidate>
              <div className="rh__formGrid">
                <div className="rh__field">
                  <label className="rh__label">
                    Название <span className="rh__req">*</span>
                  </label>
                  <input
                    className={`rh__input ${showBedErr("name") ? "rh__input--invalid" : ""}`}
                    maxLength={200}
                    value={bedForm.name}
                    onBlur={() => setBedTouched((t) => ({ ...t, name: true }))}
                    onChange={(e) => setBedForm({ ...bedForm, name: e.target.value })}
                    required
                    aria-invalid={!!showBedErr("name")}
                  />
                  {showBedErr("name") && <div className="rh__fieldError">{bedErrors.name}</div>}
                </div>

                <div className="rh__field">
                  <label className="rh__label">
                    Количество мест <span className="rh__req">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    className={`rh__input ${showBedErr("capacity") ? "rh__input--invalid" : ""}`}
                    value={bedForm.capacity}
                    onBlur={() => setBedTouched((t) => ({ ...t, capacity: true }))}
                    onChange={(e) => setBedForm({ ...bedForm, capacity: Number(e.target.value) })}
                    required
                    aria-invalid={!!showBedErr("capacity")}
                  />
                  {showBedErr("capacity") && <div className="rh__fieldError">{bedErrors.capacity}</div>}
                </div>

                <div className="rh__field">
                  <label className="rh__label">
                    Цена (сом) <span className="rh__req">*</span>
                  </label>
                  <input
                    inputMode="decimal"
                    className={`rh__input ${showBedErr("price") ? "rh__input--invalid" : ""}`}
                    placeholder="Напр., 700.00"
                    value={bedForm.price}
                    onBlur={() => setBedTouched((t) => ({ ...t, price: true }))}
                    onChange={(e) => setBedForm({ ...bedForm, price: e.target.value })}
                    required
                    aria-invalid={!!showBedErr("price")}
                  />
                  {showBedErr("price") && <div className="rh__fieldError">{bedErrors.price}</div>}
                </div>

                <div className="rh__field">
                  <label className="rh__label">Описание</label>
                  <textarea
                    rows={3}
                    className={`rh__input ${showBedErr("description") ? "rh__input--invalid" : ""}`}
                    value={bedForm.description}
                    onBlur={() => setBedTouched((t) => ({ ...t, description: true }))}
                    onChange={(e) => setBedForm({ ...bedForm, description: e.target.value })}
                    aria-invalid={!!showBedErr("description")}
                  />
                  {showBedErr("description") && <div className="rh__fieldError">{bedErrors.description}</div>}
                </div>
              </div>

              <div className="rh__formActions">
                <button type="button" className="rh__btn rh__btn--secondary" onClick={() => setBedModalOpen(false)} disabled={saving}>
                  Отмена
                </button>
                <button
                  type="submit"
                  className="rh__btn rh__btn--primary"
                  disabled={saving || bedHasErrors}
                  title={bedHasErrors ? "Исправьте ошибки формы" : undefined}
                >
                  {saving ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
