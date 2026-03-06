// RecordaModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../../../../api";
import { FaPlus, FaTimes, FaChevronDown, FaChevronUp } from "react-icons/fa";
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
} from "./RecordaUtils";

import RecordaTimeField from "./RecordaTimeField";
import RecordaServicesPicker from "./RecordaServicesPicker";
import RecordaMiniClientModal from "./RecordaMiniClientModal";
import RecordaTimeSlots from "./RecordaTimeSlots";

/* ===== основной модальный компонент ===== */
const RecordaModal = ({
  isOpen,
  onClose,
  currentRecord,
  clients,
  barbers,
  services,
  appointments,
  defaultDate,
  onReload,
  onClientsChange,
}) => {
  const [saving, setSaving] = useState(false);
  const [formAlerts, setFormAlerts] = useState([]);
  const [fieldErrs, setFieldErrs] = useState({});

  // форма - НОВЫЙ ПОРЯДОК: Сотрудник → Услуги → Дата/Время → Клиент
  const [selBarber, setSelBarber] = useState("");
  const [selServices, setSelServices] = useState([]);
  console.log('48', selServices);
  
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

  // UI состояния
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useTimeSlots, setUseTimeSlots] = useState(true);

  // мини-клиент
  const [miniOpen, setMiniOpen] = useState(false);

  const isEditing = !!currentRecord;

  const closeModal = () => {
    if (!saving) onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    setFormAlerts([]);
    setFieldErrs({});
    setShowAdvanced(false);

    if (currentRecord) {
      const rec = currentRecord;
      setSelClient(rec.client ? String(rec.client) : "");
      const recSvcs = Array.isArray(rec.services)
        ? rec.services.map(String)
        : rec.service
        ? [String(rec.service)]
        : [];
      setSelServices(recSvcs);
      setStartDate(toDate(rec.start_at));
      setStartTime(clampToRange(rec.start_at ? rec.start_at.slice(11, 16) : ""));
      setEndTime(clampToRange(rec.end_at ? rec.end_at.slice(11, 16) : ""));

      setAutoEnd(true);

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
      // При редактировании показываем расширенные поля
      setShowAdvanced(true);
    } else {
      setSelClient("");
      setStartDate(defaultDate);
      setSelServices([]);
      const now = new Date();
      const tNow = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const st = inRange(tNow) ? clampToRange(tNow) : `${pad(OPEN_HOUR)}:00`;
      setStartTime(st);
      setEndTime("");
      setAutoEnd(true);
      setSelBarber("");
      setStatus("booked");
      setComment("");
      setDiscountInput("");
      setPriceInput("");
      setIsManualPrice(false);
    }
  }, [isOpen, currentRecord, defaultDate]);

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

  const serviceItems = useMemo(
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
          categoryName: s.category_name || "",
        })),
    [services]
  );

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
      const it = serviceItems.find((s) => String(s.id) === String(id));
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
  }, [selServices, serviceItems]);

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
    const arr = barbers.map((b) => {
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
  }, [barbers, busyBarbersOnInterval]);

  // Простые barberItems без статуса занятости (для начального выбора)
  const simpleBarberItems = useMemo(() => {
    return barbers.map((b) => ({
      id: String(b.id),
      label: b.name,
      search: b.name,
    })).sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [barbers]);

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

  if (!isOpen) return null;

  // Формируем подсказку о недостающих полях
  const getMissingFieldsHint = () => {
    const missing = [];
    if (!selBarber) missing.push("мастера");
    if (!selServices.length) missing.push("услугу");
    if (!startTime) missing.push("время");
    return missing.length > 0 ? `Выберите ${missing.join(", ")}` : null;
  };

  const missingHint = getMissingFieldsHint();

  return (
    <>
      {/* основная модалка */}
      <div className="barberrecorda__overlay" onClick={closeModal}>
        <div
          className="barberrecorda__modal barberrecorda__modal--improved"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="barberrecorda__modalHeader">
            <h3 className="barberrecorda__modalTitle">
              {currentRecord ? "Редактировать запись" : "Новая запись"}
            </h3>
            <button
              type="button"
              className="barberrecorda__iconBtn"
              aria-label="Закрыть"
              onClick={closeModal}
            >
              <FaTimes />
            </button>
          </div>

          {formAlerts.length > 0 && (
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
          )}

          <form className="barberrecorda__form" onSubmit={handleSubmit} noValidate>
            <div className="barberrecorda__grid">
              <div className="barberrecorda__gridMain">
                
                {/* 1. МАСТЕР (первый!) */}
                <label
                  className={`barberrecorda__field barberrecorda__field--full ${
                    fieldErrs.barber || validationState.errors.barber ? "is-invalid" : ""
                  }`}
                >
                  <span className="barberrecorda__label">
                    <span>
                      Мастер <b className="barberrecorda__req">*</b>
                    </span>
                    {selBarber && (
                      <span className="barberrecorda__labelHint">
                        {busyBarbersOnInterval.has(String(selBarber)) 
                          ? "⚠ Занят" 
                          : "✓ Свободен"}
                      </span>
                    )}
                  </span>
                  <RecordaServicesPicker
                    mode="single"
                    items={selServices.length && startTime ? barberItems : simpleBarberItems}
                    selectedId={selBarber}
                    onChange={(id) => setSelBarber(String(id))}
                    placeholder="Поиск мастера..."
                    placeholderSelected="Выберите мастера"
                    renderMeta={false}
                  />
                </label>

                {/* 2. УСЛУГИ */}
                <div
                  className={`barberrecorda__field barberrecorda__field--full barberrecorda__field--services ${
                    fieldErrs.services || validationState.errors.services ? "is-invalid" : ""
                  }`}
                >
                  <span className="barberrecorda__label">
                    Услуги <b className="barberrecorda__req">*</b>
                  </span>
                  
                  <RecordaServicesPicker
                    items={serviceItems}
                    selectedIds={selServices}
                    onChange={setSelServices}
                    summary={servicesSummary}
                  />
                </div>

                {/* 3. ДАТА */}
                <label
                  className={`barberrecorda__field barberrecorda__field--full ${
                    fieldErrs.startDate || validationState.errors.startDate ? "is-invalid" : ""
                  }`}
                >
                  <span className="barberrecorda__label">
                    Дата <b className="barberrecorda__req">*</b>
                  </span>
                  <div className="barberrecorda__inputIconWrap">
                    <input
                      type="date"
                      className="barberrecorda__input"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                    />
                  </div>
                </label>

                {/* 4. ВРЕМЯ - визуальные слоты */}
                <div className={`barberrecorda__field barberrecorda__field--full ${
                  fieldErrs.startTime || validationState.errors.startTime ? "is-invalid" : ""
                }`}>
                  <span className="barberrecorda__label">
                    <span>
                      Время <b className="barberrecorda__req">*</b>
                    </span>
                    <button
                      type="button"
                      className="barberrecorda__timeModeToggle"
                      onClick={() => setUseTimeSlots(!useTimeSlots)}
                    >
                      {useTimeSlots ? "Ручной ввод" : "Слоты времени"}
                    </button>
                  </span>

                  {useTimeSlots ? (
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
                  ) : (
                    <div className="barberrecorda__row barberrecorda__row--2">
                      <div className={`barberrecorda__timeFieldWrap ${
                        fieldErrs.startTime ? "is-invalid" : ""
                      }`}>
                        <span className="barberrecorda__timeFieldLabel">Начало</span>
                        <RecordaTimeField
                          value={startTime}
                          onChange={setStartStrict}
                          invalid={!!fieldErrs.startTime}
                        />
                      </div>

                      <div className={`barberrecorda__timeFieldWrap ${
                        fieldErrs.endTime ? "is-invalid" : ""
                      }`}>
                        <span className="barberrecorda__timeFieldLabel">
                          <span>Конец</span>
                          <span className="barberrecorda__autoEnd">
                            <input
                              id="autoEnd"
                              type="checkbox"
                              checked={autoEnd}
                              onChange={(e) => setAutoEnd(e.target.checked)}
                            />
                            <label htmlFor="autoEnd">Авто</label>
                          </span>
                        </span>
                        <RecordaTimeField
                          value={endTime}
                          onChange={setEndStrict}
                          invalid={!!fieldErrs.endTime}
                        />
                      </div>
                    </div>
                  )}

                  {/* Показываем выбранное время при использовании слотов */}
                  {useTimeSlots && startTime && (
                    <div className="barberrecorda__selectedTimeInfo">
                      <span>Выбрано: <b>{startTime}</b> — <b>{endTime}</b></span>
                      <span className="barberrecorda__autoEnd">
                        <input
                          id="autoEndSlots"
                          type="checkbox"
                          checked={autoEnd}
                          onChange={(e) => setAutoEnd(e.target.checked)}
                        />
                        <label htmlFor="autoEndSlots">Авто-конец</label>
                      </span>
                    </div>
                  )}
                </div>

                {/* 5. КЛИЕНТ (опционально, в конце) */}
                <label
                  className={`barberrecorda__field barberrecorda__field--full ${
                    fieldErrs.client ? "is-invalid" : ""
                  }`}
                >
                  <span className="barberrecorda__label">
                    Клиент
                    <span className="barberrecorda__labelOptional">(опционально)</span>
                  </span>
                  <div className="barberrecorda__fieldRow">
                    <RecordaServicesPicker
                      mode="single"
                      items={activeClientItems}
                      selectedId={selClient}
                      onChange={(id) => setSelClient(String(id))}
                      placeholder="Поиск..."
                      placeholderSelected="Выберите клиента"
                      renderMeta={false}
                    />

                    <button
                      type="button"
                      className="barberrecorda__btn barberrecorda__btn--primary barberrecorda__btn--square"
                      aria-label="Создать"
                      title="Создать клиента"
                      onClick={openMini}
                    >
                      <FaPlus />
                    </button>
                  </div>
                </label>

                {/* ===== К ОПЛАТЕ ===== */}
                <div className="barberrecorda__totalCard">
                  <div className="barberrecorda__totalLabel">К ОПЛАТЕ</div>
                  <div className="barberrecorda__totalValue">
                    {uiFinalPrice
                      ? `${uiFinalPrice.toLocaleString("ru-RU")} СОМ`
                      : "0 СОМ"}
                  </div>
                </div>

                {/* ===== ДОПОЛНИТЕЛЬНО (скрываемая секция) ===== */}
                <div className="barberrecorda__advancedSection">
                  <button
                    type="button"
                    className="barberrecorda__advancedToggle"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    <span>Дополнительно</span>
                    {showAdvanced ? <FaChevronUp /> : <FaChevronDown />}
                  </button>

                  {showAdvanced && (
                    <div className="barberrecorda__advancedContent">
                      {/* Статус - только при редактировании */}
                      {isEditing && (
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
                      )}

                      {/* Скидка / Цена */}
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

                      {/* Комментарий */}
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
                  )}
                </div>
              </div>
            </div>

            {/* Нижняя подсказка */}
            {missingHint && (
              <div className="barberrecorda__bottomHint">
                <span className="barberrecorda__bottomHintIcon">⚠</span>
                <span>{missingHint}</span>
              </div>
            )}

            <div className="barberrecorda__footer">
              <span className="barberrecorda__spacer" />
              <button
                type="button"
                className="barberrecorda__btn barberrecorda__btn--secondary"
                onClick={closeModal}
                disabled={saving}
              >
                Отмена
              </button>
              <button
                type="submit"
                className={`barberrecorda__btn barberrecorda__btn--primary ${
                  !validationState.isValid ? "is-disabled" : ""
                }`}
                disabled={
                  saving ||
                  (selectedStartISO &&
                    selectedEndISO &&
                    busyBarbersOnInterval.has(String(selBarber)))
                }
                title={
                  !validationState.isValid
                    ? missingHint
                    : busyBarbersOnInterval.has(String(selBarber))
                    ? "Мастер занят"
                    : ""
                }
              >
                {saving ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
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
