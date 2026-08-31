// RecordaModal.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import api from "../../../../../api";
import { FaPlus, FaTimes, FaChevronDown, FaChevronUp, FaWalking, FaCalendarAlt, FaClock, FaSync, FaSearch, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import "../Recorda.scss";

import {
  pad,
  toDate,
  makeISO,
  ts,
  minsOf,
  inRange,
  clampToRange,
  BLOCKING,
  STATUS_LABELS,
  parsePercent,
  calcFinalPrice,
  OPEN_HOUR,
  CLOSE_HOUR,
  todayStr,
  getNowSlot,
  defaultTimeForDate,
  fmtMoney,
} from "./RecordaUtils";

import RecordaTimeField from "./RecordaTimeField";
import RecordaServicesPicker from "./RecordaServicesPicker";
import RecordaMiniClientModal from "./RecordaMiniClientModal";
import RecordaTimeSlots from "./RecordaTimeSlots";

const serviceBarberIds = (service) => {
  if (!service) return [];
  if (Array.isArray(service.barbers) && service.barbers.length) {
    return service.barbers.map(String);
  }
  return [];
};

const barberCanDoService = (barberId, service) => {
  const ids = serviceBarberIds(service);
  if (!ids.length) return true;
  return ids.includes(String(barberId));
};

const barberCanDoAllServices = (barberId, serviceList, serviceIds) => {
  if (!serviceIds.length) return true;
  return serviceIds.every((sid) => {
    const svc = serviceList.find((s) => String(s.id) === String(sid));
    return barberCanDoService(barberId, svc);
  });
};

/* ===== основной модальный компонент ===== */
const RecordaModal = ({
  isOpen,
  onClose,
  currentRecord,
  initialMode = "booking",
  clients,
  barbers,
  services,
  appointments,
  defaultDate,
  slotDraft = null,
  onReload,
  onClientsChange,
}) => {
  const [saving, setSaving] = useState(false);
  const [formAlerts, setFormAlerts] = useState([]);
  const [fieldErrs, setFieldErrs] = useState({});

  const [mode, setMode] = useState(initialMode);

  const [selBarber, setSelBarber] = useState("");
  const [selServices, setSelServices] = useState([]);

  const [startDate, setStartDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [autoEnd, setAutoEnd] = useState(true);
  const [selClient, setSelClient] = useState("");
  const [status, setStatus] = useState("booked");
  const [comment, setComment] = useState("");

  const [discountInput, setDiscountInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [isManualPrice, setIsManualPrice] = useState(false);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useTimeSlots, setUseTimeSlots] = useState(true);
  const [timeExpanded, setTimeExpanded] = useState(false);

  const [miniOpen, setMiniOpen] = useState(false);
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState("all");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [focusedStep, setFocusedStep] = useState(null);
  const [serviceSearch, setServiceSearch] = useState("");

  const isEditing = !!currentRecord;
  const isWalkIn = mode === "walkin" && !isEditing;

  const applyModeDefaults = useCallback((nextMode) => {
    setMode(nextMode);
    setFormAlerts([]);
    setFieldErrs({});
    setTimeExpanded(false);
    setFocusedStep(null);
    setServiceSearch("");

    if (nextMode === "walkin") {
      setStartDate(todayStr());
      setStartTime(getNowSlot());
      setEndTime("");
      setAutoEnd(true);
      setStatus("confirmed");
      setUseTimeSlots(false);
    } else {
      setStartDate(defaultDate);
      setStartTime(defaultTimeForDate(defaultDate));
      setEndTime("");
      setAutoEnd(true);
      setStatus("booked");
      setUseTimeSlots(true);
    }
  }, [defaultDate]);

  const closeModal = () => {
    if (!saving) onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    setFormAlerts([]);
    setFieldErrs({});
    setShowAdvanced(false);
    setTimeExpanded(false);
    setServiceCategoryFilter("all");
    setSubmitAttempted(false);
    setFocusedStep(null);
    setServiceSearch("");

    if (currentRecord) {
      const rec = currentRecord;
      setMode("booking");
      setSelClient(rec.client ? String(rec.client) : "");
      const recSvcs = Array.isArray(rec.services)
        ? rec.services.map((s) =>
            typeof s === "object" && s !== null
              ? String(s?.service_id ?? s?.service ?? s?.id ?? "")
              : String(s)
          ).filter(Boolean)
        : rec.service
        ? [String(rec.service)]
        : [];
      setSelServices(recSvcs);
      setStartDate(toDate(rec.start_at));
      setStartTime(clampToRange(rec.start_at ? rec.start_at.slice(11, 16) : ""));
      setEndTime(clampToRange(rec.end_at ? rec.end_at.slice(11, 16) : ""));

      setAutoEnd(true);
      setUseTimeSlots(true);

      setSelBarber(String(rec.barber || ""));
      setStatus(rec.status || "booked");
      setComment(rec.comment || "");
      setDiscountInput(
        rec.discount !== null && rec.discount !== undefined
          ? String(rec.discount)
          : ""
      );
      setPriceInput(
        rec.price !== null && rec.price !== undefined ? String(rec.price) : ""
      );

      setIsManualPrice(false);
      setShowAdvanced(true);
    } else {
      setSelClient("");
      setSelServices([]);
      setSelBarber("");
      setComment("");
      setDiscountInput("");
      setPriceInput("");
      setIsManualPrice(false);
      applyModeDefaults(initialMode);

      if (slotDraft?.barberId) {
        setSelBarber(String(slotDraft.barberId));
      }
      if (slotDraft?.startTime) {
        setStartTime(clampToRange(slotDraft.startTime));
        setAutoEnd(true);
      }
      if (slotDraft && initialMode === "booking") {
        setFocusedStep("services");
      }
    }
  }, [isOpen, currentRecord, defaultDate, initialMode, slotDraft, applyModeDefaults]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [isOpen]);

  /* источники для комбобоксов */
  const activeClientItems = useMemo(
    () =>
      clients.map((c) => ({
        id: String(c.id),
        label: c.name || "Без имени",
        search: `${c.name} ${c.phone}`,
      })),
    [clients]
  );

  const allServiceItems = useMemo(
    () =>
      services
        .filter((s) => s.active)
        .map((s) => ({
          id: String(s.id),
          label: s.name,
          search: `${s.name} ${s.time || ""} ${s.price || ""} ${
            s.category_name || ""
          }`,
          price: Number.isFinite(Number(s.price)) ? Number(s.price) : null,
          minutes: Number(s.minutes ?? s.time ?? 0),
          categoryId: s.category_id || "",
          categoryName: s.category_name || "",
          barbers: serviceBarberIds(s),
        })),
    [services]
  );

  const serviceItems = useMemo(() => {
    if (!selBarber) return allServiceItems;
    return allServiceItems.filter((it) => {
      if (!it.barbers.length) return true;
      return it.barbers.includes(String(selBarber));
    });
  }, [allServiceItems, selBarber]);

  const serviceCategories = useMemo(() => {
    const map = new Map();
    serviceItems.forEach((it) => {
      const id = it.categoryId ? String(it.categoryId) : "__none__";
      const name = it.categoryName || "Без категории";
      if (!map.has(id)) {
        map.set(id, { id, name, count: 0 });
      }
      map.get(id).count += 1;
    });
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "ru"),
    );
  }, [serviceItems]);

  const filteredServiceItems = useMemo(() => {
    if (serviceCategoryFilter === "all") return serviceItems;
    if (serviceCategoryFilter === "__none__") {
      return serviceItems.filter((it) => !it.categoryId);
    }
    return serviceItems.filter(
      (it) => String(it.categoryId) === String(serviceCategoryFilter),
    );
  }, [serviceItems, serviceCategoryFilter]);

  const filteredBarbers = useMemo(() => {
    if (!selServices.length) return barbers;
    return barbers.filter((b) =>
      barberCanDoAllServices(b.id, services, selServices)
    );
  }, [barbers, selServices, services]);

  const handleBarberChange = (id) => {
    const nextId = id ? String(id) : "";
    setSelBarber(nextId);
    if (!nextId) return;
    setSelServices((prev) =>
      prev.filter((sid) => {
        const svc = services.find((s) => String(s.id) === String(sid));
        return barberCanDoService(nextId, svc);
      })
    );
  };

  const handleServicesChange = (ids) => {
    const next = Array.isArray(ids) ? ids.map(String) : [];
    setSelServices(next);
    if (!selBarber || !next.length) return;
    if (!barberCanDoAllServices(selBarber, services, next)) {
      setSelBarber("");
    }
  };

  const handleQuickService = (id) => {
    const sid = String(id);
    setSelServices((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
    );
  };

  const refreshNowTime = () => {
    setStartDate(todayStr());
    setStartTime(getNowSlot());
    setAutoEnd(true);
  };

  const selectedBarberName = useMemo(() => {
    if (!selBarber) return null;
    return barbers.find((b) => String(b.id) === String(selBarber))?.name || null;
  }, [selBarber, barbers]);

  const selectedClientName = useMemo(() => {
    if (!selClient) return null;
    return clients.find((c) => String(c.id) === String(selClient))?.name || null;
  }, [selClient, clients]);

  const statusItems = useMemo(
    () =>
      Object.entries(STATUS_LABELS).map(([key, label]) => ({
        id: key,
        label,
        search: label,
      })),
    []
  );

  const servicesSummary = useMemo(() => {
    let totalMinutes = 0;
    let totalPrice = 0;
    selServices.forEach((id) => {
      const it = allServiceItems.find((s) => String(s.id) === String(id));
      if (it) {
        totalMinutes += it.minutes || 0;
        if (Number.isFinite(it.price)) totalPrice += it.price;
      }
    });
    return {
      totalMinutes,
      totalPrice,
      count: selServices.length,
    };
  }, [selServices, allServiceItems]);

  const basePrice = servicesSummary.totalPrice || 0;

  /* авто-конец */
  useEffect(() => {
    if (!autoEnd) return;
    const base = startTime || `${pad(OPEN_HOUR)}:00`;
    const total = servicesSummary.totalMinutes || 30;
    let mm = minsOf(base) + total;
    const max = CLOSE_HOUR * 60;
    if (mm > max) mm = max;
    const H = Math.floor(mm / 60);
    const M = mm % 60;
    setEndTime(`${pad(H)}:${pad(H === CLOSE_HOUR ? 0 : M)}`);
  }, [startTime, servicesSummary.totalMinutes, autoEnd]);

  /* перерасчёт цены по услугам и скидке (для поля ввода) */
  useEffect(() => {
    if (!isOpen) return;
    if (!basePrice) return;
    if (isManualPrice) return;

    const d = parsePercent(discountInput);
    const final = calcFinalPrice(basePrice, d);
    setPriceInput(String(final == null ? basePrice : final));
  }, [isOpen, basePrice, discountInput, isManualPrice]);

  const discountPercent = useMemo(() => parsePercent(discountInput), [discountInput]);

  const uiFinalPrice = useMemo(() => {
    const raw = String(priceInput || "").trim();
    const n = Number(raw.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n) && n >= 0) return n;

    if (!basePrice) return 0;
    const d = parsePercent(discountInput);
    const final = calcFinalPrice(basePrice, d);
    return final == null ? basePrice : final;
  }, [priceInput, basePrice, discountInput]);

  /* занятость мастеров */
  const selectedStartISO = useMemo(
    () => (startDate && startTime ? makeISO(startDate, startTime) : null),
    [startDate, startTime]
  );

  const selectedEndISO = useMemo(
    () => (startDate && endTime ? makeISO(startDate, endTime) : null),
    [startDate, endTime]
  );

  const busyBarbersOnInterval = useMemo(() => {
    const set = new Set();
    if (!selectedStartISO || !selectedEndISO) return set;
    const t1 = ts(selectedStartISO);
    const t2 = ts(selectedEndISO);
    appointments.forEach((a) => {
      if (toDate(a.start_at) !== startDate) return;
      if (!BLOCKING.has(a.status)) return;
      if (currentRecord?.id && String(currentRecord.id) === String(a.id)) {
        return;
      }
      if (ts(a.start_at) < t2 && t1 < ts(a.end_at)) {
        set.add(String(a.barber));
      }
    });
    return set;
  }, [appointments, selectedStartISO, selectedEndISO, startDate, currentRecord]);

  const barberItems = useMemo(() => {
    const busy = busyBarbersOnInterval;
    const arr = filteredBarbers.map((b) => {
      const isBusy = busy.has(String(b.id));
      return {
        id: String(b.id),
        label: `${b.name} ${isBusy ? "· занят" : "· свободен"}`,
        search: `${b.name} ${isBusy ? "занят" : "свободен"}`,
        disabled: isBusy,
        hint: isBusy
          ? "Занят в это время"
          : "Свободен",
      };
    });
    arr.sort(
      (a, b) =>
        Number(a.disabled) - Number(b.disabled) ||
        a.label.localeCompare(b.label, "ru")
    );
    return arr;
  }, [filteredBarbers, busyBarbersOnInterval]);

  // Простые barberItems без статуса занятости (для начального выбора)
  const simpleBarberItems = useMemo(() => {
    return filteredBarbers.map((b) => ({
      id: String(b.id),
      label: b.name,
      search: b.name,
    })).sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [filteredBarbers]);

  /* strict setters */
  const setStartStrict = (v) => {
    const vv = clampToRange(v);
    setStartTime(vv);
    if (!autoEnd && minsOf(endTime) <= minsOf(vv)) {
      const mm = Math.min(minsOf(vv) + 1, CLOSE_HOUR * 60);
      const H = Math.floor(mm / 60);
      const M = mm % 60;
      setEndTime(`${pad(H)}:${pad(H === CLOSE_HOUR ? 0 : M)}`);
    }
  };

  const setEndStrict = (v) => {
    let vv = clampToRange(v);
    if (minsOf(vv) <= minsOf(startTime)) {
      const mm = Math.min(minsOf(startTime) + 1, CLOSE_HOUR * 60);
      const H = Math.floor(mm / 60);
      const M = mm % 60;
      vv = `${pad(H)}:${pad(H === CLOSE_HOUR ? 0 : M)}`;
    }
    setEndTime(vv);
    setAutoEnd(false);
  };

  // Обработчик выбора слота времени
  const handleSlotSelect = (time) => {
    setStartStrict(time);
    setAutoEnd(true);
  };

  /* валидация в реальном времени */
  const validationState = useMemo(() => {
    const errors = {};
    
    if (!selBarber) errors.barber = true;
    if (!selServices.length) errors.services = true;
    if (!startDate) errors.startDate = true;
    if (!startTime) errors.startTime = true;
    if (!endTime) errors.endTime = true;

    const sM = minsOf(startTime);
    const eM = minsOf(endTime);

    if (startTime && endTime) {
      if (!(inRange(startTime) && inRange(endTime))) {
        errors.startTime = true;
        errors.endTime = true;
      } else if (eM <= sM) {
        errors.endTime = true;
      }
    }

    // Проверка занятости мастера
    if (selBarber && selectedStartISO && selectedEndISO) {
      if (busyBarbersOnInterval.has(String(selBarber))) {
        errors.barber = true;
      }
    }

    return {
      errors,
      isValid: Object.keys(errors).length === 0,
      missingFields: Object.keys(errors),
    };
  }, [selBarber, selServices, startDate, startTime, endTime, selectedStartISO, selectedEndISO, busyBarbersOnInterval]);

  /* валидация */
  const validate = () => {
    const alerts = [];
    const errs = {};

    if (!startDate) {
      errs.startDate = true;
      alerts.push("Укажите дату");
    }
    if (!selServices.length) {
      errs.services = true;
      alerts.push("Добавьте услугу");
    }
    if (!startTime) {
      errs.startTime = true;
      alerts.push("Укажите начало");
    }
    if (!endTime) {
      errs.endTime = true;
      alerts.push("Укажите конец");
    }
    if (!selBarber) {
      errs.barber = true;
      alerts.push("Выберите мастера");
    }

    const sM = minsOf(startTime);
    const eM = minsOf(endTime);

    if (!errs.startTime && !errs.endTime) {
      if (!(inRange(startTime) && inRange(endTime))) {
        errs.startTime = true;
        errs.endTime = true;
        alerts.push("Время: 09:00–21:00");
      } else if (eM <= sM) {
        errs.endTime = true;
        alerts.push("Конец позже начала");
      }
    }

    if (alerts.length) {
      return { alerts, errs };
    }

    const startISO = makeISO(startDate, startTime);
    const endISO = makeISO(startDate, endTime);
    const t1 = ts(startISO);
    const t2 = ts(endISO);

    const dup = appointments.find((a) => {
      if (String(a.barber) !== String(selBarber)) return false;
      if (!BLOCKING.has(a.status)) return false;
      if (currentRecord?.id && String(currentRecord.id) === String(a.id)) {
        return false;
      }
      return Math.abs(ts(a.start_at) - t1) < 60000;
    });

    if (dup) {
      errs.startTime = true;
      alerts.push("Запись уже существует");
      return { alerts, errs };
    }

    const conflictsMaster = appointments.filter((a) => {
      if (String(a.barber) !== String(selBarber)) return false;
      if (!BLOCKING.has(a.status)) return false;
      if (currentRecord?.id && String(currentRecord.id) === String(a.id)) {
        return false;
      }
      return ts(a.start_at) < t2 && t1 < ts(a.end_at);
    });
    if (conflictsMaster.length) {
      errs.barber = true;
      alerts.push("Мастер занят");
    }

    if (selClient) {
      const conflictsClient = appointments.filter((a) => {
        if (String(a.client) !== String(selClient)) return false;
        if (!BLOCKING.has(a.status)) return false;
        if (currentRecord?.id && String(currentRecord.id) === String(a.id)) {
          return false;
        }
        return ts(a.start_at) < t2 && t1 < ts(a.end_at);
      });
      if (conflictsClient.length) {
        errs.startTime = true;
        alerts.push("Клиент уже записан");
      }
    }

    return { alerts, errs, startISO, endISO };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setSaving(true);
    setFormAlerts([]);
    setFieldErrs({});

    const { alerts, errs, startISO, endISO } = validate();

    if (alerts.length) {
      setSaving(false);
      setFormAlerts(alerts);
      setFieldErrs(errs);
      return;
    }

    const discountVal = isManualPrice ? null : parsePercent(discountInput);

    let finalPrice = null;
    const rawPrice = String(priceInput || "").trim();

    if (rawPrice !== "") {
      const n = Number(rawPrice.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(n) && n >= 0) {
        finalPrice = n;
      }
    }

    if (finalPrice === null) {
      finalPrice = calcFinalPrice(basePrice, discountVal);
    }

    try {
      const payload = {
        client: selClient || null,
        barber: selBarber,
        services: selServices,
        start_at: startISO,
        end_at: endISO,
        status,
        comment: comment?.trim() || null,
        company: localStorage.getItem("company"),
        price: finalPrice !== null && finalPrice !== undefined ? finalPrice : null,
      };

      if (discountVal !== null && discountVal !== undefined) {
        payload.discount = discountVal;
      }

      if (currentRecord?.id) {
        await api.patch(`/barbershop/appointments/${currentRecord.id}/`, payload);
      } else {
        await api.post("/barbershop/appointments/", payload);
      }

      await onReload();
      closeModal();
    } catch (e2) {
      const d = e2?.response?.data;
      const msgs = [];
      if (typeof d === "string") {
        msgs.push(d);
      } else if (d && typeof d === "object") {
        Object.values(d).forEach((v) =>
          msgs.push(String(Array.isArray(v) ? v[0] : v))
        );
      }
      if (!msgs.length) {
        msgs.push("Ошибка сохранения");
      }
      setFormAlerts(msgs);
    } finally {
      setSaving(false);
    }
  };

  /* мини-клиент */
  const openMini = () => setMiniOpen(true);
  const closeMini = () => setMiniOpen(false);

  const getMissingFieldsHint = () => {
    const missing = [];
    if (!selBarber) missing.push("мастера");
    if (!selServices.length) missing.push("услугу");
    if (!startTime) missing.push("время");
    return missing.length > 0 ? `Выберите ${missing.join(", ")}` : null;
  };

  const missingHint = getMissingFieldsHint();
  const submitDisabled =
    saving ||
    !validationState.isValid ||
    (selectedStartISO &&
      selectedEndISO &&
      busyBarbersOnInterval.has(String(selBarber)));

  const modalTitle = isEditing
    ? "Редактировать запись"
    : isWalkIn
    ? "Клиент пришёл"
    : "Запланировать запись";

  const submitLabel = saving
    ? "Сохранение…"
    : isWalkIn
    ? "Принять клиента"
    : "Сохранить запись";

  const walkInActiveStep = useMemo(() => {
    if (!selServices.length) return "services";
    if (!selBarber || validationState.errors.barber) return "barber";
    return "client";
  }, [selServices.length, selBarber, validationState.errors.barber]);

  const bookingActiveStep = useMemo(() => {
    if (!startTime || validationState.errors.startTime) return "datetime";
    if (!selBarber || validationState.errors.barber) return "barber";
    if (!selServices.length) return "services";
    return "client";
  }, [
    startTime,
    validationState.errors.startTime,
    selBarber,
    validationState.errors.barber,
    selServices.length,
  ]);

  const activeStep = isWalkIn ? walkInActiveStep : bookingActiveStep;
  const displayStep = focusedStep ?? activeStep;
  const useShellLayout = !isEditing;

  const progressSteps = useMemo(() => {
    if (isWalkIn) {
      return [
        { id: "services", label: "Услуги", done: selServices.length > 0 },
        {
          id: "barber",
          label: "Мастер",
          done: !!selBarber && !validationState.errors.barber,
        },
        { id: "client", label: "Клиент", optional: true, done: !!selClient },
      ];
    }

    return [
      {
        id: "datetime",
        label: "Когда",
        done: !!startTime && !validationState.errors.startTime,
      },
      {
        id: "barber",
        label: "Мастер",
        done: !!selBarber && !validationState.errors.barber,
      },
      { id: "services", label: "Услуги", done: selServices.length > 0 },
      { id: "client", label: "Клиент", optional: true, done: !!selClient },
    ];
  }, [
    isWalkIn,
    selServices.length,
    selBarber,
    validationState.errors.barber,
    validationState.errors.startTime,
    selClient,
    startTime,
  ]);

  const canAccessStep = useCallback(
    (stepId) => {
      if (stepId === "datetime") return true;
      if (stepId === "services") {
        return isWalkIn ? true : !!selBarber;
      }
      if (stepId === "barber") {
        return isWalkIn ? selServices.length > 0 : !!startTime;
      }
      if (stepId === "client") {
        if (isWalkIn) return !!selBarber;
        return selServices.length > 0 && !!selBarber;
      }
      return true;
    },
    [isWalkIn, selServices.length, selBarber, startTime],
  );

  const gridServiceItems = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    if (!q) return filteredServiceItems;
    return filteredServiceItems.filter((it) =>
      String(it.search || it.label || "")
        .toLowerCase()
        .includes(q),
    );
  }, [filteredServiceItems, serviceSearch]);

  const stepIndex = Math.max(
    0,
    progressSteps.findIndex((s) => s.id === displayStep),
  );
  const isFirstStep = stepIndex <= 0;
  const isLastStep = stepIndex >= progressSteps.length - 1;

  const canProceedFromStep = (stepId) => {
    if (stepId === "services") return selServices.length > 0;
    if (stepId === "barber") {
      return !!selBarber && !validationState.errors.barber;
    }
    if (stepId === "datetime") {
      return !!startTime && !!endTime && !validationState.errors.startTime;
    }
    return true;
  };

  const goToStep = (stepId) => {
    if (!canAccessStep(stepId)) return;
    setFocusedStep(stepId);
  };

  const goNext = () => {
    if (!canProceedFromStep(displayStep)) return;
    if (stepIndex < progressSteps.length - 1) {
      setFocusedStep(progressSteps[stepIndex + 1].id);
    }
  };

  const goPrev = () => {
    if (stepIndex > 0) {
      setFocusedStep(progressSteps[stepIndex - 1].id);
    }
  };

  const renderServicesPanel = () => (
    <div className="barberrecorda__panel">
      <div className="barberrecorda__panelHead">
        <h4 className="barberrecorda__panelTitle">Какие услуги?</h4>
        <p className="barberrecorda__panelHint">
          Можно выбрать несколько — сумма и время посчитаются автоматически
        </p>
      </div>

      {serviceCategories.length > 0 ? (
        <div className="barberrecorda__catRail">
          <button
            type="button"
            className={`barberrecorda__catPill ${
              serviceCategoryFilter === "all" ? "is-active" : ""
            }`}
            onClick={() => setServiceCategoryFilter("all")}
          >
            Все
          </button>
          {serviceCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`barberrecorda__catPill ${
                serviceCategoryFilter === cat.id ? "is-active" : ""
              }`}
              onClick={() => setServiceCategoryFilter(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      ) : null}

      <label className="barberrecorda__searchField">
        <FaSearch aria-hidden="true" />
        <input
          type="search"
          value={serviceSearch}
          onChange={(e) => setServiceSearch(e.target.value)}
          placeholder="Поиск услуги..."
        />
      </label>

      <div className="barberrecorda__serviceGrid">
        {gridServiceItems.length === 0 ? (
          <div className="barberrecorda__panelEmpty">Услуги не найдены</div>
        ) : (
          gridServiceItems.map((s) => {
            const selected = selServices.includes(String(s.id));
            return (
              <button
                key={s.id}
                type="button"
                className={`barberrecorda__serviceTile ${
                  selected ? "is-selected" : ""
                }`}
                onClick={() => handleQuickService(s.id)}
              >
                <span className="barberrecorda__serviceTileName">{s.label}</span>
                <span className="barberrecorda__serviceTileMeta">
                  {s.minutes ? `${s.minutes} мин` : "—"}
                  {Number.isFinite(s.price) ? ` · ${fmtMoney(s.price)}` : ""}
                </span>
                {selected ? (
                  <span className="barberrecorda__serviceTileCheck">✓</span>
                ) : null}
              </button>
            );
          })
        )}
      </div>

      {selServices.length > 0 ? (
        <div className="barberrecorda__selectionSummary">
          <span>
            {servicesSummary.count} усл. · {servicesSummary.totalMinutes} мин
          </span>
          <strong>{fmtMoney(servicesSummary.totalPrice)}</strong>
        </div>
      ) : null}
    </div>
  );

  const renderBarberPanel = () => (
    <div className="barberrecorda__panel">
      <div className="barberrecorda__panelHead">
        <h4 className="barberrecorda__panelTitle">Кто будет принимать?</h4>
        <p className="barberrecorda__panelHint">
          {isWalkIn
            ? "Зелёные карточки — мастера свободны прямо сейчас"
            : selBarber && startTime && busyBarbersOnInterval.has(String(selBarber))
            ? "Выбранный мастер занят — выберите другого"
            : "Выберите мастера для записи"}
        </p>
      </div>

      {isWalkIn && !selServices.length ? (
        <div className="barberrecorda__panelNotice">
          Сначала выберите услуги на предыдущем шаге
        </div>
      ) : null}

      {isWalkIn ? (
        <div
          className={`barberrecorda__masterGrid ${
            !selServices.length ? "is-disabled" : ""
          }`}
        >
          {filteredBarbers.length === 0 ? (
            <div className="barberrecorda__panelEmpty">
              Нет мастеров для выбранных услуг
            </div>
          ) : (
            filteredBarbers.map((b) => {
              const id = String(b.id);
              const busy = busyBarbersOnInterval.has(id);
              const selected = String(selBarber) === id;
              const initials = String(b.name || "?")
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              return (
                <button
                  key={id}
                  type="button"
                  className={`barberrecorda__masterCard ${
                    selected ? "is-selected" : ""
                  } ${busy ? "is-busy" : ""}`}
                  disabled={busy || !selServices.length}
                  onClick={() => handleBarberChange(id)}
                >
                  <span className="barberrecorda__masterAvatar">{initials}</span>
                  <span className="barberrecorda__masterName">{b.name}</span>
                  <span className="barberrecorda__masterStatus">
                    {busy ? "Занят" : selected ? "Выбран" : "Свободен"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : (
        <RecordaServicesPicker
          mode="single"
          items={selServices.length && startTime ? barberItems : simpleBarberItems}
          selectedId={selBarber}
          onChange={handleBarberChange}
          placeholder="Поиск мастера..."
          placeholderSelected="Выберите мастера"
          renderMeta={false}
        />
      )}
    </div>
  );

  const renderClientPanel = () => (
    <div className="barberrecorda__panel">
      <div className="barberrecorda__panelHead">
        <h4 className="barberrecorda__panelTitle">
          Клиент
          {isWalkIn ? (
            <span className="barberrecorda__panelOptional">необязательно</span>
          ) : null}
        </h4>
        <p className="barberrecorda__panelHint">
          Найдите в базе или быстро создайте нового
        </p>
      </div>
      <div className="barberrecorda__clientRow">
        <RecordaServicesPicker
          mode="single"
          items={activeClientItems}
          selectedId={selClient}
          onChange={(id) => setSelClient(String(id))}
          placeholder="Имя или телефон..."
          placeholderSelected={selectedClientName || "Выберите клиента"}
          renderMeta={false}
        />
        <button
          type="button"
          className="barberrecorda__iconAction"
          aria-label="Создать клиента"
          title="Создать клиента"
          onClick={openMini}
        >
          <FaPlus />
        </button>
      </div>
    </div>
  );

  const renderDateTimePanel = () => (
    <div className="barberrecorda__panel">
      <div className="barberrecorda__panelHead">
        <h4 className="barberrecorda__panelTitle">Когда запись?</h4>
        <p className="barberrecorda__panelHint">Выберите дату и свободный слот</p>
      </div>

      <label className={`barberrecorda__field barberrecorda__field--full ${fieldErrs.startDate ? "is-invalid" : ""}`}>
        <span className="barberrecorda__label">Дата</span>
        <input
          type="date"
          className="barberrecorda__input"
          value={startDate}
          onChange={(e) => {
            const d = e.target.value;
            setStartDate(d);
            setStartTime(defaultTimeForDate(d));
            setAutoEnd(true);
          }}
        />
      </label>

      <div className="barberrecorda__timeSectionHead">
        <span className="barberrecorda__label">Время</span>
        <button
          type="button"
          className="barberrecorda__timeModeToggle"
          onClick={() => setUseTimeSlots(!useTimeSlots)}
        >
          {useTimeSlots ? "Ручной ввод" : "Слоты"}
        </button>
      </div>

      {useTimeSlots ? (
        <>
          <RecordaTimeSlots
            selectedDate={startDate}
            selectedBarber={selBarber}
            appointments={appointments}
            currentRecordId={currentRecord?.id}
            startTime={startTime}
            endTime={endTime}
            totalMinutes={servicesSummary.totalMinutes || 30}
            onSelectSlot={handleSlotSelect}
            disabled={!selBarber}
          />
          {startTime ? (
            <div className="barberrecorda__selectedTimeInfo">
              <span>
                Выбрано: <b>{startTime}</b> — <b>{endTime}</b>
              </span>
            </div>
          ) : null}
        </>
      ) : (
        <div className="barberrecorda__row barberrecorda__row--2">
          <div className="barberrecorda__timeFieldWrap">
            <span className="barberrecorda__timeFieldLabel">Начало</span>
            <RecordaTimeField
              value={startTime}
              onChange={setStartStrict}
              invalid={submitAttempted && !!fieldErrs.startTime}
            />
          </div>
          <div className="barberrecorda__timeFieldWrap">
            <span className="barberrecorda__timeFieldLabel">Конец</span>
            <RecordaTimeField
              value={endTime}
              onChange={setEndStrict}
              invalid={submitAttempted && !!fieldErrs.endTime}
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderStepPanel = () => {
    switch (displayStep) {
      case "services":
        return renderServicesPanel();
      case "barber":
        return renderBarberPanel();
      case "client":
        return renderClientPanel();
      case "datetime":
        return renderDateTimePanel();
      default:
        return null;
    }
  };

  const renderAdvancedSection = () => (
    <div className="barberrecorda__advancedSection">
      <button
        type="button"
        className="barberrecorda__advancedToggle"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        <span>
          Дополнительно — скидка, комментарий{isEditing ? ", статус" : ""}
        </span>
        {showAdvanced ? <FaChevronUp /> : <FaChevronDown />}
      </button>

      {showAdvanced ? (
        <div className="barberrecorda__advancedContent">
          {isEditing ? (
            <label className="barberrecorda__field">
              <span className="barberrecorda__label">Статус</span>
              <RecordaServicesPicker
                mode="single"
                items={statusItems}
                selectedId={status}
                onChange={(id) => setStatus(String(id))}
                placeholder="Поиск статуса..."
                placeholderSelected="Выберите статус"
                renderMeta={false}
              />
            </label>
          ) : null}

          {isWalkIn && timeExpanded ? (
            <div className="barberrecorda__walkinTimeStripManual barberrecorda__walkinTimeStripManual--inline">
              <div className="barberrecorda__timeFieldWrap">
                <span className="barberrecorda__timeFieldLabel">Начало</span>
                <RecordaTimeField
                  value={startTime}
                  onChange={setStartStrict}
                  invalid={submitAttempted && !!fieldErrs.startTime}
                />
              </div>
              <div className="barberrecorda__timeFieldWrap">
                <span className="barberrecorda__timeFieldLabel">Конец</span>
                <RecordaTimeField
                  value={endTime}
                  onChange={setEndStrict}
                  invalid={submitAttempted && !!fieldErrs.endTime}
                />
              </div>
            </div>
          ) : null}

          <div className="barberrecorda__row barberrecorda__row--2">
            <label className="barberrecorda__field">
              <span className="barberrecorda__label">Скидка %</span>
              <input
                type="text"
                className="barberrecorda__input"
                value={discountInput}
                onChange={(e) => {
                  setDiscountInput(e.target.value);
                  setIsManualPrice(false);
                }}
                placeholder="0"
              />
            </label>
            <label className="barberrecorda__field">
              <span className="barberrecorda__label">Цена</span>
              <input
                type="text"
                className="barberrecorda__input"
                value={priceInput}
                onChange={(e) => {
                  setPriceInput(e.target.value);
                  setIsManualPrice(true);
                }}
                placeholder="Авто"
              />
            </label>
          </div>

          <label className="barberrecorda__field barberrecorda__field--full">
            <span className="barberrecorda__label">Комментарий</span>
            <textarea
              className="barberrecorda__textarea"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Заметка..."
            />
          </label>
        </div>
      ) : null}
    </div>
  );

  if (!isOpen) return null;

  return (
    <>
      <div
        className="barberrecorda__overlay barberrecorda__overlay--lock"
        onClick={closeModal}
      >
        <div
          className={`barberrecorda__modal barberrecorda__modal--shell ${
            isWalkIn ? "barberrecorda__modal--walkin" : ""
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="recorda-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="barberrecorda__shellHeader">
            <div className="barberrecorda__shellHeaderRow">
              <div className="barberrecorda__shellHeaderMain">
                <h3 className="barberrecorda__modalTitle" id="recorda-modal-title">
                  {modalTitle}
                </h3>
                {!isEditing ? (
                  <p className="barberrecorda__shellHeaderHint">
                    {isWalkIn
                      ? "Быстрая запись без предварительной брони"
                      : "Запись на выбранную дату и время"}
                  </p>
                ) : null}
              </div>

              {isWalkIn ? (
                <div className="barberrecorda__timeBadge">
                  <FaClock aria-hidden="true" />
                  <span>
                    {startTime && endTime ? `${startTime}–${endTime}` : startTime || "—"}
                  </span>
                  <button
                    type="button"
                    className="barberrecorda__timeBadgeBtn"
                    onClick={refreshNowTime}
                    title="Обновить время"
                  >
                    <FaSync />
                  </button>
                  <button
                    type="button"
                    className="barberrecorda__timeBadgeLink"
                    onClick={() => {
                      setShowAdvanced(true);
                      setTimeExpanded(true);
                    }}
                  >
                    изменить
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                className="barberrecorda__shellClose"
                aria-label="Закрыть"
                onClick={closeModal}
              >
                <FaTimes />
              </button>
            </div>

            {!isEditing ? (
              <div className="barberrecorda__segment" role="tablist" aria-label="Тип записи">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "walkin"}
                  className={`barberrecorda__segmentBtn ${
                    mode === "walkin" ? "is-active" : ""
                  }`}
                  onClick={() => applyModeDefaults("walkin")}
                >
                  <FaWalking aria-hidden="true" />
                  Клиент пришёл
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "booking"}
                  className={`barberrecorda__segmentBtn ${
                    mode === "booking" ? "is-active" : ""
                  }`}
                  onClick={() => applyModeDefaults("booking")}
                >
                  <FaCalendarAlt aria-hidden="true" />
                  Запланировать
                </button>
              </div>
            ) : null}
          </header>

          {formAlerts.length > 0 ? (
            <div className="barberrecorda__alert barberrecorda__alert--inModal barberrecorda__alert--danger">
              {formAlerts.length === 1 ? (
                formAlerts[0]
              ) : (
                <ul className="barberrecorda__alertList">
                  {formAlerts.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <form className="barberrecorda__form barberrecorda__form--shell" onSubmit={handleSubmit} noValidate>
            {useShellLayout ? (
              <div className="barberrecorda__shellBody">
                <aside className="barberrecorda__shellNav" aria-label="Шаги">
                  {progressSteps.map((step, index) => {
                    const accessible = canAccessStep(step.id);
                    const isCurrent = displayStep === step.id;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        className={`barberrecorda__navItem ${
                          step.done ? "is-done" : ""
                        } ${isCurrent ? "is-current" : ""}`}
                        disabled={!accessible && !step.done}
                        onClick={() => goToStep(step.id)}
                      >
                        <span className="barberrecorda__navIndex">
                          {step.done ? "✓" : index + 1}
                        </span>
                        <span className="barberrecorda__navText">
                          <strong>{step.label}</strong>
                          {step.optional ? (
                            <small>необязательно</small>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}

                  <div className="barberrecorda__shellAsideCard">
                    <span className="barberrecorda__shellAsideLabel">Сводка</span>
                    <div className="barberrecorda__shellAsideRows">
                      {selServices.length > 0 ? (
                        <div className="barberrecorda__shellAsideRow">
                          <span>Услуги</span>
                          <strong>
                            {servicesSummary.count} · {servicesSummary.totalMinutes} мин
                          </strong>
                        </div>
                      ) : null}
                      {selectedBarberName ? (
                        <div className="barberrecorda__shellAsideRow">
                          <span>Мастер</span>
                          <strong>{selectedBarberName}</strong>
                        </div>
                      ) : null}
                      {selectedClientName ? (
                        <div className="barberrecorda__shellAsideRow">
                          <span>Клиент</span>
                          <strong>{selectedClientName}</strong>
                        </div>
                      ) : null}
                      {startTime && endTime ? (
                        <div className="barberrecorda__shellAsideRow">
                          <span>Время</span>
                          <strong>
                            {startTime}–{endTime}
                          </strong>
                        </div>
                      ) : null}
                    </div>
                    <div className="barberrecorda__shellAsideTotal">
                      <span>Итого</span>
                      <strong>
                        {uiFinalPrice
                          ? `${uiFinalPrice.toLocaleString("ru-RU")} сом`
                          : "—"}
                      </strong>
                    </div>
                  </div>
                </aside>

                <main className="barberrecorda__shellMain">
                  {submitAttempted &&
                  ((displayStep === "services" &&
                    (fieldErrs.services || validationState.errors.services)) ||
                    (displayStep === "barber" &&
                      (fieldErrs.barber || validationState.errors.barber))) ? (
                    <div className="barberrecorda__panelError">
                      Заполните обязательные поля на этом шаге
                    </div>
                  ) : null}
                  {renderStepPanel()}
                  {renderAdvancedSection()}
                </main>
              </div>
            ) : (
              <div className="barberrecorda__editStack">
                {renderDateTimePanel()}
                {renderBarberPanel()}
                {renderServicesPanel()}
                {renderClientPanel()}
                {renderAdvancedSection()}
              </div>
            )}

            {submitAttempted && missingHint && !validationState.isValid ? (
              <div className="barberrecorda__bottomHint">
                <span className="barberrecorda__bottomHintIcon">⚠</span>
                <span>{missingHint}</span>
              </div>
            ) : null}

            <footer className="barberrecorda__shellFooter">
              <div className="barberrecorda__shellFooterLeft">
                {useShellLayout && !isFirstStep ? (
                  <button
                    type="button"
                    className="barberrecorda__btn barberrecorda__btn--ghost"
                    onClick={goPrev}
                    disabled={saving}
                  >
                    <FaChevronLeft aria-hidden="true" />
                    Назад
                  </button>
                ) : (
                  <button
                    type="button"
                    className="barberrecorda__btn barberrecorda__btn--secondary"
                    onClick={closeModal}
                    disabled={saving}
                  >
                    Отмена
                  </button>
                )}
              </div>

              <div className="barberrecorda__shellFooterRight">
                {useShellLayout && !isLastStep && canProceedFromStep(displayStep) ? (
                  <button
                    type="button"
                    className="barberrecorda__btn barberrecorda__btn--primary"
                    onClick={goNext}
                    disabled={saving}
                  >
                    Далее
                    <FaChevronRight aria-hidden="true" />
                  </button>
                ) : null}

                <button
                  type="submit"
                  className={`barberrecorda__btn ${
                    isWalkIn
                      ? "barberrecorda__btn--walkin"
                      : "barberrecorda__btn--primary"
                  } ${submitDisabled ? "is-disabled" : ""}`}
                  disabled={submitDisabled}
                  title={
                    !validationState.isValid
                      ? missingHint
                      : busyBarbersOnInterval.has(String(selBarber))
                      ? "Мастер занят"
                      : ""
                  }
                >
                  {submitLabel}
                </button>
              </div>
            </footer>
          </form>
        </div>
      </div>

      {/* мини-клиент */}
      <RecordaMiniClientModal
        isOpen={miniOpen}
        onClose={closeMini}
        clients={clients}
        onClientsChange={onClientsChange}
        onSelectClient={setSelClient}
      />
    </>
  );
};

export default RecordaModal;
