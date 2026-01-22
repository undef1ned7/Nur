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
  FaTimes,
  FaBan,
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

const formatDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

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

/* ===== Parse duration from time field ===== */
const parseDuration = (svc) => {
  const timeStr = String(svc.time || svc.duration_min || svc.duration || "30");
  const num = parseInt(timeStr, 10);
  return Number.isFinite(num) && num > 0 ? num : 30;
};

/* ===== Step definitions ===== */
const STEP_DEFS = {
  services: { id: "services", label: "Услуги", icon: FaCut },
  master: { id: "master", label: "Мастер", icon: FaUser },
  datetime: { id: "datetime", label: "Дата и время", icon: FaCalendarAlt },
  info: { id: "info", label: "Контакты", icon: FaPhone },
  confirm: { id: "confirm", label: "Готово", icon: FaCheck },
};

/* ===== Step orders based on start choice ===== */
const STEP_ORDERS = {
  services: ["services", "master", "datetime", "info", "confirm"],
  master: ["master", "services", "datetime", "info", "confirm"],
};

/* ===== Start options ===== */
const START_OPTIONS = [
  { id: "services", label: "Выбрать услугу", icon: FaCut, desc: "Начните с выбора услуги" },
  { id: "master", label: "Выбрать мастера", icon: FaUser, desc: "Начните с выбора мастера" },
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
  const [availability, setAvailability] = useState(null); // данные о занятости мастеров
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  /* ===== Booking state ===== */
  const [stepIndex, setStepIndex] = useState(-1); // -1 = start screen
  const [startChoice, setStartChoice] = useState(null); // "services" | "master"
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedMaster, setSelectedMaster] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientComment, setClientComment] = useState("");


  /* ===== UI state ===== */
  const [searchServices, setSearchServices] = useState("");
  const [searchMasters, setSearchMasters] = useState("");
  const [activeCatId, setActiveCatId] = useState("all");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  /* ===== Dynamic steps based on start choice ===== */
  const stepOrder = useMemo(() => {
    if (!startChoice) return [];
    return STEP_ORDERS[startChoice] || STEP_ORDERS.services;
  }, [startChoice]);

  const currentStepId = stepOrder[stepIndex] || null;

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

      const servicesUrl = `/barbershop/public/${slug}/services/`;
      const categoriesUrl = `/barbershop/public/${slug}/service-categories/`;
      const mastersUrl = `/barbershop/public/${slug}/masters/`;

      const [servicesData, categoriesData, mastersData] = await Promise.all([
        fetchAll(servicesUrl).catch(() => []),
        fetchAll(categoriesUrl).catch(() => []),
        fetchAll(mastersUrl).catch(() => []),
      ]);

      setServices(servicesData || []);
      setMasters(mastersData || []);
      setCategories((categoriesData || []).map((c) => ({
        id: c.id,
        name: c.name,
      })));

      if (dates.length > 0) {
        setSelectedDate(dates[0].date);
      }
    } catch (e) {
      setErr("Не удалось загрузить данные.");
    } finally {
      setLoading(false);
    }
  }, [company_slug, dates]);

  useEffect(() => {
    load();
  }, [load]);

  /* ===== Load availability when date changes ===== */
  const loadAvailability = useCallback(async (date, masterId = null) => {
    if (!date || !company_slug) return;

    setLoadingAvailability(true);
    try {
      const slug = normStr(company_slug);
      let url;
      
      // Если выбран мастер, используем schedule endpoint
      if (masterId) {
        url = `/barbershop/public/${slug}/masters/${masterId}/schedule/?date=${date}&days=7`;
      } else {
        // Иначе используем общий availability
        url = `/barbershop/public/${slug}/masters/availability/?date=${date}`;
      }
      
      const res = await api.get(url);
      const data = res?.data;
      
      // Если это schedule одного мастера, преобразуем в формат availability
      if (masterId && data) {
        setAvailability({
          masters: [{
            master_id: data.master_id || masterId,
            work_start: data.work_start,
            work_end: data.work_end,
            busy_slots: data.busy_slots || []
          }]
        });
      } else if (data) {
        // Для общего availability проверяем формат
        if (data.masters && Array.isArray(data.masters)) {
          setAvailability(data);
        } else {
          // Если формат другой, пытаемся адаптировать
          setAvailability({ masters: [data] });
        }
      } else {
        setAvailability(null);
      }
    } catch (e) {
      console.error("Error loading availability:", e);
      setAvailability(null);
    } finally {
      setLoadingAvailability(false);
    }
  }, [company_slug]);

  // Загружаем availability при изменении даты или мастера
  useEffect(() => {
    if (selectedDate) {
      const masterId = selectedMaster?.id || null;
      loadAvailability(selectedDate, masterId);
    }
  }, [selectedDate, selectedMaster, loadAvailability]);

  /* ===== Filtered services ===== */
  const filteredServices = useMemo(() => {
    let result = services;

    if (activeCatId !== "all") {
      result = result.filter((s) => String(s.category) === String(activeCatId));
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

  /* ===== Filtered masters ===== */
  const filteredMasters = useMemo(() => {
    const q = searchMasters.trim().toLowerCase();
    if (!q) return masters;

    return masters.filter((m) => {
      const name = (m.full_name || `${m.first_name || ""} ${m.last_name || ""}`).toLowerCase();
      return name.includes(q);
    });
  }, [masters, searchMasters]);

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

  /* ===== Busy time slots for selected date and master ===== */
  const busySlots = useMemo(() => {
    if (!selectedDate || !availability?.masters) return new Set();

    const set = new Set();
    const SLOT_INTERVAL = 30;
    const TIMEZONE_OFFSET_HOURS = 6; // UTC+6 для Кыргызстана

    // Получаем данные о занятости мастеров
    let mastersToCheck = availability.masters;

    // Если выбран конкретный мастер, фильтруем только его
    if (selectedMaster) {
      mastersToCheck = mastersToCheck.filter(
        (m) => String(m.master_id) === String(selectedMaster.id)
      );
    }

    // Собираем все занятые слоты
    mastersToCheck.forEach((master) => {
      (master.busy_slots || []).forEach((slot) => {
        // Парсим время из ISO формата: "2026-01-23T04:00:00Z" (UTC)
        const startAt = slot.start_at;
        const endAt = slot.end_at;

        if (!startAt || !endAt) return;

        // Парсим UTC время напрямую (без учета локального часового пояса браузера)
        // Формат: "2026-01-23T04:00:00Z" -> извлекаем дату и время
        const startMatch = startAt.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
        const endMatch = endAt.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
        
        if (!startMatch || !endMatch) return;
        
        // Извлекаем компоненты UTC времени
        const startYear = parseInt(startMatch[1], 10);
        const startMonth = parseInt(startMatch[2], 10) - 1; // месяцы 0-11
        const startDay = parseInt(startMatch[3], 10);
        const startHourUTC = parseInt(startMatch[4], 10);
        const startMinUTC = parseInt(startMatch[5], 10);
        
        const endYear = parseInt(endMatch[1], 10);
        const endMonth = parseInt(endMatch[2], 10) - 1;
        const endDay = parseInt(endMatch[3], 10);
        const endHourUTC = parseInt(endMatch[4], 10);
        const endMinUTC = parseInt(endMatch[5], 10);
        
        // Добавляем 6 часов для перевода из UTC в местное время (UTC+6)
        const startHourLocal = startHourUTC + TIMEZONE_OFFSET_HOURS;
        const endHourLocal = endHourUTC + TIMEZONE_OFFSET_HOURS;
        
        // Создаем дату в местном времени для проверки даты
        const startDateLocal = new Date(startYear, startMonth, startDay, startHourLocal, startMinUTC);
        const endDateLocal = new Date(endYear, endMonth, endDay, endHourLocal, endMinUTC);
        
        // Проверяем, что запись относится к выбранной дате
        const slotDateStr = formatDate(startDateLocal);
        if (slotDateStr !== selectedDate) return;

        // Вычисляем минуты в местном времени
        const startMins = startHourLocal * 60 + startMinUTC;
        const endMins = endHourLocal * 60 + endMinUTC;

        // Помечаем все слоты, которые пересекаются с записью
        for (let mins = startMins; mins < endMins; mins += SLOT_INTERVAL) {
          const hours = Math.floor(mins / 60);
          const minutes = mins % 60;
          // Обрабатываем переход через полночь
          if (hours >= 24) {
            // Если вышли за пределы дня, пропускаем
            continue;
          }
          const slotTime = `${pad2(hours)}:${pad2(minutes)}`;
          set.add(slotTime);
        }
      });
    });

    return set;
  }, [selectedDate, selectedMaster, availability]);

  /* ===== Get work hours from availability ===== */
  const workHours = useMemo(() => {
    if (!availability?.masters?.length) {
      return { start: 9, end: 21 }; // default
    }

    // Если выбран мастер, берём его рабочее время
    if (selectedMaster) {
      const masterData = availability.masters.find(
        (m) => String(m.master_id) === String(selectedMaster.id)
      );
      if (masterData?.work_start && masterData?.work_end) {
        const [startH] = masterData.work_start.split(":").map(Number);
        const [endH] = masterData.work_end.split(":").map(Number);
        return { start: startH, end: endH };
      }
    }

    // Иначе берём общее время (минимум начала, максимум конца)
    let minStart = 24;
    let maxEnd = 0;
    availability.masters.forEach((m) => {
      if (m.work_start && m.work_end) {
        const [startH] = m.work_start.split(":").map(Number);
        const [endH] = m.work_end.split(":").map(Number);
        if (startH < minStart) minStart = startH;
        if (endH > maxEnd) maxEnd = endH;
      }
    });

    return {
      start: minStart < 24 ? minStart : 9,
      end: maxEnd > 0 ? maxEnd : 21,
    };
  }, [availability, selectedMaster]);

  /* ===== Generate time slots based on work hours ===== */
  const timeSlots = useMemo(() => {
    return generateTimeSlots(workHours.start, workHours.end, 30);
  }, [workHours]);

  /* ===== Check if time slot can fit selected services ===== */
  const canFitSlot = useCallback((slotTime) => {
    if (busySlots.has(slotTime)) return false;

    const [h, m] = slotTime.split(":").map(Number);
    const startMins = h * 60 + m;
    const totalDuration = summary.totalDuration || 30;
    const endMins = startMins + totalDuration;
    const SLOT_INTERVAL = 30;

    // Проверяем, что все слоты до конца услуги свободны
    for (let mins = startMins; mins < endMins; mins += SLOT_INTERVAL) {
      const checkTime = `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
      if (busySlots.has(checkTime)) return false;
    }

    // Проверяем, что не выходим за рабочее время
    if (endMins > workHours.end * 60) return false;

    return true;
  }, [busySlots, summary.totalDuration, workHours.end]);

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

  /* ===== Remove service ===== */
  const removeService = (id) => {
    setSelectedServices((prev) => prev.filter((s) => s.id !== id));
  };

  /* ===== Validation ===== */
  const canProceed = useMemo(() => {
    switch (currentStepId) {
      case "services":
        return selectedServices.length > 0;
      case "master":
        return true; // можно пропустить
      case "datetime":
        return selectedDate && selectedTime;
      case "info":
        return clientName.trim().length >= 2 && clientPhone.trim().length >= 10;
      case "confirm":
        return true;
      default:
        return false;
    }
  }, [currentStepId, selectedServices, selectedDate, selectedTime, clientName, clientPhone]);

  /* ===== Navigation ===== */
  const handleStartChoice = (choice) => {
    setStartChoice(choice);
    setStepIndex(0);
  };

  const nextStep = () => {
    if (stepIndex < stepOrder.length - 1 && canProceed) {
      setStepIndex(stepIndex + 1);
    }
  };

  const prevStep = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    } else {
      // Вернуться на стартовый экран
      setStepIndex(-1);
      setStartChoice(null);
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

      };

      await api.post(`/barbershop/public/${slug}/bookings/`, payload);
      setSuccess(true);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.response?.data?.message || "Произошла ошибка при бронировании";
      setErr(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* ===== Reset form ===== */
  const resetForm = () => {
    setSuccess(false);
    setStepIndex(-1);
    setStartChoice(null);
    setSelectedServices([]);
    setSelectedMaster(null);
    setSelectedTime(null);
    setClientName("");
    setClientPhone("");
    setClientComment("");
  };

  /* ===== Success screen ===== */
  if (success) {
    return (
      <section className="ob">
        <div className="ob__wrap">
          <div className="ob__success">
            <div className="ob__successIcon">
              <FaCheck />
            </div>
            <h2 className="ob__successTitle">Запись создана!</h2>
            <p className="ob__successText">
              Спасибо, <strong>{clientName}</strong>!
            </p>
            <p className="ob__successText">
              Ваша запись на <strong>{formatDateDisplay(selectedDate)}</strong> в{" "}
              <strong>{formatTime(selectedTime)}</strong> успешно создана.
            </p>
            <p className="ob__successHint">
              Мы свяжемся с вами по номеру <strong>{clientPhone}</strong>
            </p>
            <button type="button" className="ob__btn ob__btn--primary" onClick={resetForm}>
              Записаться ещё
            </button>
          </div>
        </div>
      </section>
    );
  }

  /* ===== Main render ===== */
  return (
    <section className="ob">
      <div className="ob__wrap">
        {/* Header */}
        <header className="ob__header">
          <div className="ob__logo">
            <FaCut />
          </div>
          <div className="ob__headerText">
            <h1 className="ob__title">Онлайн-запись</h1>
            <p className="ob__subtitle">Барбершоп</p>
          </div>
        </header>

        {/* Steps - показываем только если не на стартовом экране */}
        {stepIndex >= 0 && stepOrder.length > 0 && (
          <div className="ob__steps">
            {stepOrder.map((stepId, idx) => {
              const stepDef = STEP_DEFS[stepId];
              if (!stepDef) return null;
              const Icon = stepDef.icon;
              const isActive = idx === stepIndex;
              const isDone = idx < stepIndex;

              return (
                <button
                  key={stepId}
                  type="button"
                  className={`ob__step ${isActive ? "is-active" : ""} ${isDone ? "is-done" : ""}`}
                  onClick={() => idx < stepIndex && setStepIndex(idx)}
                  disabled={idx > stepIndex}
                >
                  <span className="ob__stepIcon">
                    {isDone ? <FaCheck /> : <Icon />}
                  </span>
                  <span className="ob__stepLabel">{stepDef.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Error */}
        {err && (
          <div className="ob__alert">
            <span>{err}</span>
            <button type="button" className="ob__alertClose" onClick={() => setErr("")}>
              <FaTimes />
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="ob__loading">
            <FaSpinner className="ob__spinner" />
            <span>Загрузка...</span>
          </div>
        )}

        {/* Content */}
        {!loading && (
          <div className="ob__content">
            {/* Start screen - выбор с чего начать */}
            {stepIndex === -1 && (
              <div className="ob__section">
                <h2 className="ob__sectionTitle">С чего начнём?</h2>
                <p className="ob__hint">Выберите удобный способ записи</p>

                <div className="ob__startOptions">
                  {START_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className="ob__startCard"
                        onClick={() => handleStartChoice(opt.id)}
                      >
                        <span className="ob__startIcon">
                          <Icon />
                        </span>
                        <span className="ob__startLabel">{opt.label}</span>
                        <span className="ob__startDesc">{opt.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Services step */}
            {currentStepId === "services" && (
              <div className="ob__section">
                <h2 className="ob__sectionTitle">Выберите услуги</h2>

                {/* Search */}
                <div className="ob__searchWrap">
                  <FaSearch className="ob__searchIcon" />
                  <input
                    type="text"
                    className="ob__searchInput"
                    placeholder="Поиск услуг..."
                    value={searchServices}
                    onChange={(e) => setSearchServices(e.target.value)}
                  />
                </div>

                {/* Categories */}
                {categories.length > 0 && (
                  <div className="ob__cats">
                    <button
                      type="button"
                      className={`ob__catBtn ${activeCatId === "all" ? "is-active" : ""}`}
                      onClick={() => setActiveCatId("all")}
                    >
                      Все
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        className={`ob__catBtn ${String(activeCatId) === String(cat.id) ? "is-active" : ""}`}
                        onClick={() => setActiveCatId(cat.id)}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Services list */}
                <div className="ob__servicesList">
                  {filteredServices.map((svc) => {
                    const isSelected = selectedServices.some((s) => s.id === svc.id);
                    const name = svc.name || "Услуга";
                    const price = toNum(svc.price);
                    const duration = parseDuration(svc);

                    return (
                      <button
                        key={svc.id}
                        type="button"
                        className={`ob__serviceCard ${isSelected ? "is-selected" : ""}`}
                        onClick={() => toggleService(svc)}
                      >
                        <div className="ob__serviceMain">
                          <span className="ob__serviceName">{name}</span>
                          <span className="ob__serviceMeta">
                            {duration} мин • {fmtPrice(price)}
                          </span>
                        </div>
                        <span className="ob__serviceCheck">
                          {isSelected && <FaCheck />}
                        </span>
                      </button>
                    );
                  })}

                  {filteredServices.length === 0 && (
                    <div className="ob__empty">Услуг не найдено</div>
                  )}
                </div>

                {/* Selected services */}
                {selectedServices.length > 0 && (
                  <div className="ob__selectedServices">
                    <div className="ob__selectedHeader">
                      <span>Выбрано: {summary.count}</span>
                      <span>{summary.totalDuration} мин</span>
                    </div>
                    <div className="ob__selectedList">
                      {selectedServices.map((s, idx) => (
                        <div key={s.id} className="ob__selectedItem">
                          <span className="ob__selectedIdx">{idx + 1}</span>
                          <span className="ob__selectedName">{s.name}</span>
                          <button
                            type="button"
                            className="ob__selectedDel"
                            onClick={() => removeService(s.id)}
                          >
                            <FaTimes />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="ob__totalCard">
                      <span className="ob__totalLabel">Итого</span>
                      <span className="ob__totalValue">{fmtPrice(summary.totalPrice)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Master step */}
            {currentStepId === "master" && (
              <div className="ob__section">
                <h2 className="ob__sectionTitle">Выберите мастера</h2>
                <p className="ob__hint">Можно пропустить — мы подберём свободного мастера</p>

                {/* Search masters - всегда показываем */}
                <div className="ob__searchWrap">
                  <FaSearch className="ob__searchIcon" />
                  <input
                    type="text"
                    className="ob__searchInput"
                    placeholder="Поиск мастера..."
                    value={searchMasters}
                    onChange={(e) => setSearchMasters(e.target.value)}
                  />
                </div>

                <div className="ob__mastersList">
                  <button
                    type="button"
                    className={`ob__masterCard ${!selectedMaster ? "is-selected" : ""}`}
                    onClick={() => setSelectedMaster(null)}
                  >
                    <div className="ob__masterAvatar">
                      <FaUser />
                    </div>
                    <div className="ob__masterInfo">
                      <span className="ob__masterName">Любой мастер</span>
                      <span className="ob__masterDesc">Мы подберём свободного</span>
                    </div>
                    <span className="ob__masterCheck">
                      {!selectedMaster && <FaCheck />}
                    </span>
                  </button>

                  {filteredMasters.map((master) => {
                    const isSelected = selectedMaster?.id === master.id;
                    const name = master.full_name ||
                      `${master.first_name || ""} ${master.last_name || ""}`.trim() || "Мастер";

                    return (
                      <button
                        key={master.id}
                        type="button"
                        className={`ob__masterCard ${isSelected ? "is-selected" : ""}`}
                        onClick={() => setSelectedMaster(master)}
                      >
                        <div className="ob__masterAvatar">
                          {master.avatar ? (
                            <img src={master.avatar} alt={name} />
                          ) : (
                            <FaUser />
                          )}
                        </div>
                        <div className="ob__masterInfo">
                          <span className="ob__masterName">{name}</span>
                        </div>
                        <span className="ob__masterCheck">
                          {isSelected && <FaCheck />}
                        </span>
                      </button>
                    );
                  })}

                  {filteredMasters.length === 0 && searchMasters && (
                    <div className="ob__empty">Мастеров не найдено</div>
                  )}
                </div>
              </div>
            )}

            {/* Date & Time step */}
            {currentStepId === "datetime" && (
              <div className="ob__section">
                <h2 className="ob__sectionTitle">Дата и время</h2>

                <div className="ob__fieldLabel">
                  <FaCalendarAlt />
                  <span>Дата</span>
                </div>
                <div className="ob__dateScroll">
                  {dates.map((d) => (
                    <button
                      key={d.date}
                      type="button"
                      className={`ob__dateCard ${selectedDate === d.date ? "is-selected" : ""}`}
                      onClick={() => {
                        setSelectedDate(d.date);
                        setSelectedTime(null); // сбрасываем время при смене даты
                      }}
                    >
                      <span className="ob__dateDayName">{d.dayName}</span>
                      <span className="ob__dateDayNum">{d.dayNum}</span>
                      <span className="ob__dateMonth">{d.month}</span>
                      {d.isToday && <span className="ob__dateToday">Сегодня</span>}
                    </button>
                  ))}
                </div>

                <div className="ob__fieldLabel">
                  <FaClock />
                  <span>Время</span>
                </div>

                {/* Time slots legend */}
                <div className="ob__timeLegend">
                  <span className="ob__legendItem">
                    <span className="ob__legendDot ob__legendDot--free"></span>
                    Свободно
                  </span>
                  <span className="ob__legendItem">
                    <span className="ob__legendDot ob__legendDot--busy"></span>
                    Занято
                  </span>
                  <span className="ob__legendItem">
                    <span className="ob__legendDot ob__legendDot--selected"></span>
                    Выбрано
                  </span>
                </div>

                <div className="ob__timeGrid">
                  {loadingAvailability && (
                    <div className="ob__loadingSlots">
                      <FaSpinner className="ob__spinner" />
                      <span>Загрузка...</span>
                    </div>
                  )}
                  {!loadingAvailability && timeSlots.map((time) => {
                    const isBusy = busySlots.has(time);
                    const canFit = canFitSlot(time);
                    const isSelected = selectedTime === time;
                    
                    // Проверяем, входит ли слот в выбранный диапазон
                    let isInSelectedRange = false;
                    if (selectedTime) {
                      const [selectedH, selectedM] = selectedTime.split(":").map(Number);
                      const selectedMins = selectedH * 60 + selectedM;
                      const [timeH, timeM] = time.split(":").map(Number);
                      const timeMins = timeH * 60 + timeM;
                      const totalDuration = summary.totalDuration || 30;
                      const endMins = selectedMins + totalDuration;
                      
                      // Слот входит в диапазон, если он между началом и концом выбранного времени
                      isInSelectedRange = timeMins >= selectedMins && timeMins < endMins;
                    }

                    let slotClass = "ob__timeSlot";
                    if (isSelected) slotClass += " is-selected";
                    else if (isInSelectedRange) slotClass += " is-selected-range";
                    else if (isBusy) slotClass += " is-busy";
                    else if (!canFit) slotClass += " is-partial";
                    else slotClass += " is-free";

                    return (
                      <button
                        key={time}
                        type="button"
                        className={slotClass}
                        onClick={() => !isBusy && canFit && setSelectedTime(time)}
                        disabled={isBusy || !canFit}
                        title={
                          isBusy
                            ? "Занято"
                            : !canFit
                            ? "Недостаточно времени"
                            : `Начать в ${time}`
                        }
                      >
                        {time}
                        {isBusy && <FaBan className="ob__slotBusy" />}
                      </button>
                    );
                  })}
                </div>
                
                {!loadingAvailability && timeSlots.length === 0 && (
                  <div className="ob__empty">Нет доступного времени на эту дату</div>
                )}

                {selectedTime && (
                  <div className="ob__timePreview">
                    <FaClock />
                    <span className="ob__timePreviewText">
                      <strong>{formatTime(selectedTime)}</strong> – <strong>{formatTime(timeEnd)}</strong>
                    </span>
                    <span className="ob__timePreviewDuration">({summary.totalDuration} мин)</span>
                  </div>
                )}
              </div>
            )}

            {/* Contact info step */}
            {currentStepId === "info" && (
              <div className="ob__section">
                <h2 className="ob__sectionTitle">Ваши контакты</h2>

                <div className="ob__field">
                  <label className="ob__label">
                    <FaUser className="ob__labelIcon" />
                    Ваше имя <span className="ob__req">*</span>
                  </label>
                  <input
                    type="text"
                    className="ob__input"
                    placeholder="Введите имя"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>

                <div className="ob__field">
                  <label className="ob__label">
                    <FaPhone className="ob__labelIcon" />
                    Телефон <span className="ob__req">*</span>
                  </label>
                  <input
                    type="tel"
                    className="ob__input"
                    placeholder="+996 XXX XXX XXX"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                  />
                </div>

                <div className="ob__field">
                  <label className="ob__label">
                    <FaComment className="ob__labelIcon" />
                    Комментарий
                  </label>
                  <textarea
                    className="ob__textarea"
                    placeholder="Пожелания (необязательно)"
                    value={clientComment}
                    onChange={(e) => setClientComment(e.target.value)}
                    rows={3}
                  />
                </div>

              </div>
            )}

            {/* Confirmation step */}
            {currentStepId === "confirm" && (
              <div className="ob__section">
                <h2 className="ob__sectionTitle">Подтверждение</h2>

                <div className="ob__confirmCard">
                  <div className="ob__confirmRow">
                    <span className="ob__confirmLabel">Услуги</span>
                    <span className="ob__confirmValue">
                      {selectedServices.map((s) => s.name).join(", ")}
                    </span>
                  </div>

                  <div className="ob__confirmRow">
                    <span className="ob__confirmLabel">Мастер</span>
                    <span className="ob__confirmValue">
                      {selectedMaster
                        ? (selectedMaster.full_name || `${selectedMaster.first_name || ""} ${selectedMaster.last_name || ""}`.trim())
                        : "Любой свободный"}
                    </span>
                  </div>

                  <div className="ob__confirmRow">
                    <span className="ob__confirmLabel">Дата</span>
                    <span className="ob__confirmValue">{formatDateDisplay(selectedDate)}</span>
                  </div>

                  <div className="ob__confirmRow">
                    <span className="ob__confirmLabel">Время</span>
                    <span className="ob__confirmValue">
                      {formatTime(selectedTime)} – {formatTime(timeEnd)}
                    </span>
                  </div>

                  <div className="ob__confirmRow">
                    <span className="ob__confirmLabel">Клиент</span>
                    <span className="ob__confirmValue">{clientName}</span>
                  </div>

                  <div className="ob__confirmRow">
                    <span className="ob__confirmLabel">Телефон</span>
                    <span className="ob__confirmValue">{clientPhone}</span>
                  </div>

                  {clientComment && (
                    <div className="ob__confirmRow">
                      <span className="ob__confirmLabel">Комментарий</span>
                      <span className="ob__confirmValue">{clientComment}</span>
                    </div>
                  )}


                  <div className="ob__confirmTotal">
                    <span>К оплате</span>
                    <strong>{fmtPrice(summary.totalPrice)}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation - не показываем на стартовом экране */}
        {!loading && stepIndex >= 0 && (
          <div className="ob__nav">
            <button type="button" className="ob__btn ob__btn--secondary" onClick={prevStep}>
              <FaChevronLeft />
              <span>Назад</span>
            </button>

            <div className="ob__navSpacer" />

            {currentStepId !== "confirm" ? (
              <button
                type="button"
                className="ob__btn ob__btn--primary"
                onClick={nextStep}
                disabled={!canProceed}
              >
                <span>Далее</span>
                <FaChevronRight />
              </button>
            ) : (
              <button
                type="button"
                className="ob__btn ob__btn--primary"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <FaSpinner className="ob__spinner" />
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
