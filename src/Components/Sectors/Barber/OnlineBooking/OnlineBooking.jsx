import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  FaCalendarAlt,
  FaClock,
  FaUser,
  FaPhone,
  FaComment,
  FaCreditCard,
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaSearch,
  FaCut,
  FaSpinner,
} from "react-icons/fa";
import api from "../../../../api";
import "./OnlineBooking.scss";

/* ===== helpers ===== */
const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

const toNum = (v) => {
  if (v == null) return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const fmtPrice = (v) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(toNum(v)) + " сом";

const normStr = (s) => String(s || "").trim();

const pad2 = (n) => String(n).padStart(2, "0");

const formatDate = (d) => {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const formatDateDisplay = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
};

const formatTime = (timeStr) => {
  if (!timeStr) return "";
  return timeStr.slice(0, 5);
};

const addMinutes = (timeStr, minutes) => {
  const [h, m] = timeStr.split(":").map(Number);
  const totalMin = h * 60 + m + minutes;
  const newH = Math.floor(totalMin / 60) % 24;
  const newM = totalMin % 60;
  return `${pad2(newH)}:${pad2(newM)}`;
};

/* DRF pagination fetch-all */
async function fetchAll(url0) {
  const out = [];
  let url = url0;

  for (let guard = 0; guard < 30 && url; guard += 1) {
    const r = await api.get(url);
    const data = r?.data;
    const chunk = asArray(data);
    out.push(...chunk);
    url = data?.next || null;
  }

  return out;
}

/* ===== Steps ===== */
const STEPS = [
  { id: "services", label: "Услуги", icon: FaCut },
  { id: "master", label: "Мастер", icon: FaUser },
  { id: "datetime", label: "Дата и время", icon: FaCalendarAlt },
  { id: "info", label: "Контакты", icon: FaPhone },
  { id: "confirm", label: "Подтверждение", icon: FaCheck },
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Наличными" },
  { value: "card", label: "Картой" },
  { value: "online", label: "Онлайн" },
];

/* ===== Generate time slots ===== */
const generateTimeSlots = (startHour = 9, endHour = 21, interval = 30) => {
  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += interval) {
      slots.push(`${pad2(h)}:${pad2(m)}`);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

/* ===== Generate next 14 days ===== */
const generateDates = (count = 14) => {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push({
      date: formatDate(d),
      dayName: d.toLocaleDateString("ru-RU", { weekday: "short" }),
      dayNum: d.getDate(),
      month: d.toLocaleDateString("ru-RU", { month: "short" }),
      isToday: i === 0,
    });
  }
  return dates;
};

const OnlineBooking = () => {
  const { company_slug } = useParams();

  /* ===== Data state ===== */
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [masters, setMasters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  /* ===== Booking state ===== */
  const [step, setStep] = useState(0);
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedMaster, setSelectedMaster] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientComment, setClientComment] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  /* ===== UI state ===== */
  const [searchServices, setSearchServices] = useState("");
  const [activeCatId, setActiveCatId] = useState("all");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const dates = useMemo(() => generateDates(14), []);

  /* ===== Load data ===== */
  const load = useCallback(async () => {
    setLoading(true);
    setErr("");

    try {
      const slug = normStr(company_slug);
      if (!slug) {
        setErr("Не указан slug компании.");
        setLoading(false);
        return;
      }

      // Публичные эндпоинты для барбершопа (согласно swagger)
      const servicesUrl = `/barbershop/public/${slug}/services/`;
      const categoriesUrl = `/barbershop/public/${slug}/service-categories/`;
      const mastersUrl = `/barbershop/public/${slug}/masters/`;

      const [servicesData, categoriesData, mastersData] = await Promise.all([
        fetchAll(servicesUrl).catch((e) => {
          console.warn("Services endpoint error:", e?.response?.status);
          return [];
        }),
        fetchAll(categoriesUrl).catch((e) => {
          console.warn("Categories endpoint error:", e?.response?.status);
          return [];
        }),
        fetchAll(mastersUrl).catch((e) => {
          console.warn("Masters endpoint error:", e?.response?.status);
          return [];
        }),
      ]);

      setServices(servicesData || []);
      setMasters(mastersData || []);

      // Категории приходят напрямую из API
      setCategories((categoriesData || []).map((c) => ({
        id: c.id,
        name: c.name,
      })));

      // Set default date to today
      if (dates.length > 0) {
        setSelectedDate(dates[0].date);
      }
    } catch (e) {
      console.error("Ошибка загрузки данных:", e);
      setErr("Не удалось загрузить данные. Проверьте slug и доступность API.");
    } finally {
      setLoading(false);
    }
  }, [company_slug, dates]);

  useEffect(() => {
    load();
  }, [load]);

  /* ===== Filtered services ===== */
  const filteredServices = useMemo(() => {
    let result = services;

    if (activeCatId !== "all") {
      result = result.filter((s) => {
        // По сваггеру: category - это UUID категории
        const catId = s.category;
        return String(catId) === String(activeCatId);
      });
    }

    const q = searchServices.trim().toLowerCase();
    if (q) {
      result = result.filter((s) => {
        const name = String(s.name || "").toLowerCase();
        const catName = String(s.category_name || "").toLowerCase();
        return name.includes(q) || catName.includes(q);
      });
    }

    return result;
  }, [services, activeCatId, searchServices]);

  /* ===== Parse duration from time field ===== */
  const parseDuration = (svc) => {
    // time может быть "30", "30 мин", "1 час" и т.д.
    const timeStr = String(svc.time || svc.duration_min || svc.duration || "30");
    const num = parseInt(timeStr, 10);
    return Number.isFinite(num) && num > 0 ? num : 30;
  };

  /* ===== Summary ===== */
  const summary = useMemo(() => {
    let totalPrice = 0;
    let totalDuration = 0;

    selectedServices.forEach((svc) => {
      totalPrice += toNum(svc.price);
      totalDuration += parseDuration(svc);
    });

    return { totalPrice, totalDuration, count: selectedServices.length };
  }, [selectedServices]);

  /* ===== Calculate end time ===== */
  const timeEnd = useMemo(() => {
    if (!selectedTime) return null;
    return addMinutes(selectedTime, summary.totalDuration || 30);
  }, [selectedTime, summary.totalDuration]);

  /* ===== Service toggle ===== */
  const toggleService = (service) => {
    setSelectedServices((prev) => {
      const exists = prev.find((s) => s.id === service.id);
      if (exists) {
        return prev.filter((s) => s.id !== service.id);
      }
      return [...prev, service];
    });
  };

  /* ===== Validation ===== */
  const canProceed = useMemo(() => {
    switch (step) {
      case 0: // services
        return selectedServices.length > 0;
      case 1: // master (optional)
        return true;
      case 2: // datetime
        return selectedDate && selectedTime;
      case 3: // info
        return clientName.trim().length >= 2 && clientPhone.trim().length >= 10;
      case 4: // confirm
        return true;
      default:
        return false;
    }
  }, [step, selectedServices, selectedDate, selectedTime, clientName, clientPhone]);

  /* ===== Navigation ===== */
  const nextStep = () => {
    if (step < STEPS.length - 1 && canProceed) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  /* ===== Submit booking ===== */
  const handleSubmit = async () => {
    if (submitting) return;

    setSubmitting(true);
    setErr("");

    try {
      const slug = normStr(company_slug);
      const payload = {
        services: selectedServices.map((s) => ({
          service_id: s.id,
          title: s.name || "Услуга",
          price: toNum(s.price),
          duration_min: parseDuration(s),
        })),
        master_id: selectedMaster?.id || null,
        master_name: selectedMaster?.full_name || 
          (selectedMaster ? `${selectedMaster.first_name || ""} ${selectedMaster.last_name || ""}`.trim() : null),
        date: selectedDate,
        time_start: selectedTime + ":00",
        time_end: timeEnd + ":00",
        client_name: clientName.trim(),
        client_phone: clientPhone.trim(),
        client_comment: clientComment.trim() || null,
        payment_method: paymentMethod,
      };

      await api.post(`/barbershop/public/${slug}/bookings/`, payload);
      setSuccess(true);
    } catch (e) {
      console.error("Ошибка бронирования:", e);
      const msg = e?.response?.data?.detail || e?.response?.data?.message || "Произошла ошибка при бронировании";
      setErr(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* ===== Success screen ===== */
  if (success) {
    return (
      <section className="onlinebooking">
        <div className="onlinebooking__wrap">
          <div className="onlinebooking__success">
            <div className="onlinebooking__successIcon">
              <FaCheck />
            </div>
            <h2 className="onlinebooking__successTitle">Запись создана!</h2>
            <p className="onlinebooking__successText">
              Спасибо, {clientName}! Ваша запись на{" "}
              <strong>{formatDateDisplay(selectedDate)}</strong> в{" "}
              <strong>{formatTime(selectedTime)}</strong> успешно создана.
            </p>
            <p className="onlinebooking__successText">
              Мы свяжемся с вами по номеру <strong>{clientPhone}</strong> для подтверждения.
            </p>
            <button
              type="button"
              className="onlinebooking__successBtn"
              onClick={() => {
                setSuccess(false);
                setStep(0);
                setSelectedServices([]);
                setSelectedMaster(null);
                setSelectedTime(null);
                setClientName("");
                setClientPhone("");
                setClientComment("");
              }}
            >
              Записаться ещё
            </button>
          </div>
        </div>
      </section>
    );
  }

  /* ===== Main render ===== */
  return (
    <section className="onlinebooking">
      <div className="onlinebooking__wrap">
        {/* Header */}
        <header className="onlinebooking__header">
          <div className="onlinebooking__headerIcon">
            <FaCut />
          </div>
          <div>
            <h1 className="onlinebooking__title">Онлайн-запись</h1>
            <div className="onlinebooking__subtitle">Барбершоп</div>
          </div>
        </header>

        {/* Steps indicator */}
        <div className="onlinebooking__steps">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isActive = idx === step;
            const isDone = idx < step;

            return (
              <div
                key={s.id}
                className={`onlinebooking__step ${isActive ? "is-active" : ""} ${isDone ? "is-done" : ""}`}
              >
                <div className="onlinebooking__stepIcon">
                  {isDone ? <FaCheck /> : <Icon />}
                </div>
                <span className="onlinebooking__stepLabel">{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Error */}
        {err && (
          <div className="onlinebooking__error">
            <div className="onlinebooking__errorText">{err}</div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="onlinebooking__loading">
            <FaSpinner className="onlinebooking__spinner" />
            <span>Загрузка...</span>
          </div>
        )}

        {/* Content */}
        {!loading && (
          <div className="onlinebooking__content">
            {/* Step 0: Services */}
            {step === 0 && (
              <div className="onlinebooking__section">
                <h2 className="onlinebooking__sectionTitle">Выберите услуги</h2>

                {/* Search */}
                <div className="onlinebooking__search">
                  <FaSearch className="onlinebooking__searchIcon" />
                  <input
                    type="text"
                    className="onlinebooking__searchInput"
                    placeholder="Поиск услуг..."
                    value={searchServices}
                    onChange={(e) => setSearchServices(e.target.value)}
                  />
                </div>

                {/* Categories */}
                {categories.length > 0 && (
                  <div className="onlinebooking__categories">
                    <button
                      type="button"
                      className={`onlinebooking__catBtn ${activeCatId === "all" ? "is-active" : ""}`}
                      onClick={() => setActiveCatId("all")}
                    >
                      Все
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        className={`onlinebooking__catBtn ${String(activeCatId) === String(cat.id) ? "is-active" : ""}`}
                        onClick={() => setActiveCatId(cat.id)}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Services list */}
                <div className="onlinebooking__servicesList">
                  {filteredServices.map((svc) => {
                    const isSelected = selectedServices.some((s) => s.id === svc.id);
                    const name = svc.name || "Услуга";
                    const price = toNum(svc.price);
                    const duration = parseDuration(svc);

                    return (
                      <button
                        key={svc.id}
                        type="button"
                        className={`onlinebooking__serviceCard ${isSelected ? "is-selected" : ""}`}
                        onClick={() => toggleService(svc)}
                      >
                        <div className="onlinebooking__serviceInfo">
                          <div className="onlinebooking__serviceName">{name}</div>
                          <div className="onlinebooking__serviceMeta">
                            <span>{duration} мин</span>
                            <span className="onlinebooking__servicePrice">{fmtPrice(price)}</span>
                          </div>
                        </div>
                        <div className="onlinebooking__serviceCheck">
                          {isSelected && <FaCheck />}
                        </div>
                      </button>
                    );
                  })}

                  {filteredServices.length === 0 && (
                    <div className="onlinebooking__empty">Услуг не найдено</div>
                  )}
                </div>

                {/* Summary */}
                {selectedServices.length > 0 && (
                  <div className="onlinebooking__summary">
                    <div className="onlinebooking__summaryItem">
                      <span>Услуг:</span>
                      <strong>{summary.count}</strong>
                    </div>
                    <div className="onlinebooking__summaryItem">
                      <span>Время:</span>
                      <strong>{summary.totalDuration} мин</strong>
                    </div>
                    <div className="onlinebooking__summaryItem onlinebooking__summaryItem--total">
                      <span>Итого:</span>
                      <strong>{fmtPrice(summary.totalPrice)}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 1: Master */}
            {step === 1 && (
              <div className="onlinebooking__section">
                <h2 className="onlinebooking__sectionTitle">Выберите мастера</h2>
                <p className="onlinebooking__hint">Можно пропустить — мы подберём свободного мастера</p>

                <div className="onlinebooking__mastersList">
                  <button
                    type="button"
                    className={`onlinebooking__masterCard ${!selectedMaster ? "is-selected" : ""}`}
                    onClick={() => setSelectedMaster(null)}
                  >
                    <div className="onlinebooking__masterAvatar">
                      <FaUser />
                    </div>
                    <div className="onlinebooking__masterInfo">
                      <div className="onlinebooking__masterName">Любой мастер</div>
                      <div className="onlinebooking__masterDesc">Мы подберём свободного</div>
                    </div>
                    <div className="onlinebooking__masterCheck">
                      {!selectedMaster && <FaCheck />}
                    </div>
                  </button>

                  {masters.map((master) => {
                    const isSelected = selectedMaster?.id === master.id;
                    const name = master.full_name || 
                      `${master.first_name || ""} ${master.last_name || ""}`.trim() || "Мастер";

                    return (
                      <button
                        key={master.id}
                        type="button"
                        className={`onlinebooking__masterCard ${isSelected ? "is-selected" : ""}`}
                        onClick={() => setSelectedMaster(master)}
                      >
                        <div className="onlinebooking__masterAvatar">
                          {master.avatar ? (
                            <img src={master.avatar} alt={name} />
                          ) : (
                            <FaUser />
                          )}
                        </div>
                        <div className="onlinebooking__masterInfo">
                          <div className="onlinebooking__masterName">{name}</div>
                        </div>
                        <div className="onlinebooking__masterCheck">
                          {isSelected && <FaCheck />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Date & Time */}
            {step === 2 && (
              <div className="onlinebooking__section">
                <h2 className="onlinebooking__sectionTitle">Выберите дату и время</h2>

                {/* Date picker */}
                <div className="onlinebooking__dateLabel">Дата</div>
                <div className="onlinebooking__dateScroll">
                  {dates.map((d) => (
                    <button
                      key={d.date}
                      type="button"
                      className={`onlinebooking__dateCard ${selectedDate === d.date ? "is-selected" : ""}`}
                      onClick={() => setSelectedDate(d.date)}
                    >
                      <span className="onlinebooking__dateDayName">{d.dayName}</span>
                      <span className="onlinebooking__dateDayNum">{d.dayNum}</span>
                      <span className="onlinebooking__dateMonth">{d.month}</span>
                      {d.isToday && <span className="onlinebooking__dateToday">Сегодня</span>}
                    </button>
                  ))}
                </div>

                {/* Time picker */}
                <div className="onlinebooking__timeLabel">Время</div>
                <div className="onlinebooking__timeGrid">
                  {TIME_SLOTS.map((time) => (
                    <button
                      key={time}
                      type="button"
                      className={`onlinebooking__timeSlot ${selectedTime === time ? "is-selected" : ""}`}
                      onClick={() => setSelectedTime(time)}
                    >
                      {time}
                    </button>
                  ))}
                </div>

                {selectedTime && (
                  <div className="onlinebooking__timePreview">
                    <FaClock />
                    <span>
                      {formatTime(selectedTime)} – {formatTime(timeEnd)} ({summary.totalDuration} мин)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Contact info */}
            {step === 3 && (
              <div className="onlinebooking__section">
                <h2 className="onlinebooking__sectionTitle">Ваши контакты</h2>

                <div className="onlinebooking__formGroup">
                  <label className="onlinebooking__label">
                    <FaUser className="onlinebooking__labelIcon" />
                    Ваше имя *
                  </label>
                  <input
                    type="text"
                    className="onlinebooking__input"
                    placeholder="Введите ваше имя"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>

                <div className="onlinebooking__formGroup">
                  <label className="onlinebooking__label">
                    <FaPhone className="onlinebooking__labelIcon" />
                    Телефон *
                  </label>
                  <input
                    type="tel"
                    className="onlinebooking__input"
                    placeholder="+996 XXX XXX XXX"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                  />
                </div>

                <div className="onlinebooking__formGroup">
                  <label className="onlinebooking__label">
                    <FaComment className="onlinebooking__labelIcon" />
                    Комментарий
                  </label>
                  <textarea
                    className="onlinebooking__textarea"
                    placeholder="Пожелания к записи (необязательно)"
                    value={clientComment}
                    onChange={(e) => setClientComment(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="onlinebooking__formGroup">
                  <label className="onlinebooking__label">
                    <FaCreditCard className="onlinebooking__labelIcon" />
                    Способ оплаты
                  </label>
                  <div className="onlinebooking__paymentOptions">
                    {PAYMENT_METHODS.map((pm) => (
                      <button
                        key={pm.value}
                        type="button"
                        className={`onlinebooking__paymentBtn ${paymentMethod === pm.value ? "is-selected" : ""}`}
                        onClick={() => setPaymentMethod(pm.value)}
                      >
                        {pm.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Confirmation */}
            {step === 4 && (
              <div className="onlinebooking__section">
                <h2 className="onlinebooking__sectionTitle">Подтверждение записи</h2>

                <div className="onlinebooking__confirmCard">
                  <div className="onlinebooking__confirmRow">
                    <span className="onlinebooking__confirmLabel">Услуги:</span>
                    <span className="onlinebooking__confirmValue">
                      {selectedServices.map((s) => s.name).join(", ")}
                    </span>
                  </div>

                  <div className="onlinebooking__confirmRow">
                    <span className="onlinebooking__confirmLabel">Мастер:</span>
                    <span className="onlinebooking__confirmValue">
                      {selectedMaster
                        ? (selectedMaster.full_name || `${selectedMaster.first_name || ""} ${selectedMaster.last_name || ""}`.trim())
                        : "Любой свободный"}
                    </span>
                  </div>

                  <div className="onlinebooking__confirmRow">
                    <span className="onlinebooking__confirmLabel">Дата:</span>
                    <span className="onlinebooking__confirmValue">
                      {formatDateDisplay(selectedDate)}
                    </span>
                  </div>

                  <div className="onlinebooking__confirmRow">
                    <span className="onlinebooking__confirmLabel">Время:</span>
                    <span className="onlinebooking__confirmValue">
                      {formatTime(selectedTime)} – {formatTime(timeEnd)}
                    </span>
                  </div>

                  <div className="onlinebooking__confirmRow">
                    <span className="onlinebooking__confirmLabel">Клиент:</span>
                    <span className="onlinebooking__confirmValue">{clientName}</span>
                  </div>

                  <div className="onlinebooking__confirmRow">
                    <span className="onlinebooking__confirmLabel">Телефон:</span>
                    <span className="onlinebooking__confirmValue">{clientPhone}</span>
                  </div>

                  {clientComment && (
                    <div className="onlinebooking__confirmRow">
                      <span className="onlinebooking__confirmLabel">Комментарий:</span>
                      <span className="onlinebooking__confirmValue">{clientComment}</span>
                    </div>
                  )}

                  <div className="onlinebooking__confirmRow">
                    <span className="onlinebooking__confirmLabel">Оплата:</span>
                    <span className="onlinebooking__confirmValue">
                      {PAYMENT_METHODS.find((pm) => pm.value === paymentMethod)?.label}
                    </span>
                  </div>

                  <div className="onlinebooking__confirmTotal">
                    <span>Итого к оплате:</span>
                    <strong>{fmtPrice(summary.totalPrice)}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        {!loading && (
          <div className="onlinebooking__nav">
            {step > 0 && (
              <button
                type="button"
                className="onlinebooking__navBtn onlinebooking__navBtn--back"
                onClick={prevStep}
              >
                <FaChevronLeft />
                <span>Назад</span>
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                className="onlinebooking__navBtn onlinebooking__navBtn--next"
                onClick={nextStep}
                disabled={!canProceed}
              >
                <span>Далее</span>
                <FaChevronRight />
              </button>
            ) : (
              <button
                type="button"
                className="onlinebooking__navBtn onlinebooking__navBtn--submit"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <FaSpinner className="onlinebooking__spinner" />
                    <span>Отправка...</span>
                  </>
                ) : (
                  <>
                    <FaCheck />
                    <span>Записаться</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default OnlineBooking;
