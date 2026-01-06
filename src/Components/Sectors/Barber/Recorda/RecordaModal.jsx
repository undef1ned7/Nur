// RecordaModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../../../api";
import { FaPlus, FaTimes } from "react-icons/fa";
import "./Recorda.scss";

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

  // форма
  const [selClient, setSelClient] = useState("");
  const [startDate, setStartDate] = useState(defaultDate);
  const [selServices, setSelServices] = useState([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [autoEnd, setAutoEnd] = useState(true);
  const [selBarber, setSelBarber] = useState("");
  const [status, setStatus] = useState("booked");
  const [comment, setComment] = useState("");

  const [discountInput, setDiscountInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [isManualPrice, setIsManualPrice] = useState(false);

  // мини-клиент
  const [miniOpen, setMiniOpen] = useState(false);

  const closeModal = () => {
    if (!saving) onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    setFormAlerts([]);
    setFieldErrs({});

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

      // 🔥 РАНЬШЕ БЫЛО: setAutoEnd(false);
      // Теперь при открытии существующей записи "Авто" остаётся включённым,
      // пока пользователь сам не начнёт менять конец/время вручную.
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

      const hasSavedPrice =
        rec.price !== null &&
        rec.price !== undefined &&
        String(rec.price) !== "";
      setIsManualPrice(hasSavedPrice);
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

    const hasSavedPrice =
      currentRecord?.price !== null &&
      currentRecord?.price !== undefined &&
      String(currentRecord.price).trim() !== "";

    // если цена сохранена — не трогаем
    if (hasSavedPrice) return;

    // если услуг нет/не посчитались — тоже не трогаем
    if (!basePrice) return;

    // если пользователь вручную вводил цену — не трогаем
    if (isManualPrice) return;

    // иначе подставляем авто-цену
    const d = parsePercent(discountInput);
    const final = calcFinalPrice(basePrice, d);
    setPriceInput(String(final == null ? basePrice : final));
  }, [isOpen, currentRecord?.price, basePrice, discountInput, isManualPrice]);

  const discountPercent = useMemo(() => parsePercent(discountInput), [discountInput]);

  const uiFinalPrice = useMemo(() => {
    const raw = String(priceInput || "").trim();
    const n = Number(raw.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n) && n >= 0) return n; // ручная цена => скидку не считаем

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
          ? "Пересечение с другой записью в выбранный интервал"
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
    setAutoEnd(false); // ручное изменение конца выключает "Авто"
  };

  /* валидация */
  const validate = () => {
    const alerts = [];
    const errs = {};

    if (!startDate) {
      errs.startDate = true;
      alerts.push("Укажите дату.");
    }
    if (!selServices.length) {
      errs.services = true;
      alerts.push("Добавьте хотя бы одну услугу.");
    }
    if (!startTime) {
      errs.startTime = true;
      alerts.push("Укажите начало.");
    }
    if (!endTime) {
      errs.endTime = true;
      alerts.push("Укажите конец.");
    }
    if (!selBarber) {
      errs.barber = true;
      alerts.push("Выберите сотрудника.");
    }

    const sM = minsOf(startTime);
    const eM = minsOf(endTime);

    if (!errs.startTime && !errs.endTime) {
      if (!(inRange(startTime) && inRange(endTime))) {
        errs.startTime = true;
        errs.endTime = true;
        alerts.push("Время должно быть в пределах 09:00–21:00.");
      } else if (eM <= sM) {
        errs.endTime = true;
        alerts.push("Конец должен быть позже начала.");
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
      alerts.push("Такая запись уже существует.");
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
      alerts.push("Сотрудник занят в этот интервал.");
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
        alerts.push("У клиента уже есть запись в этот интервал.");
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
      setFormAlerts(["Исправьте ошибки в форме.", ...alerts]);
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
        msgs.push("Не удалось сохранить запись.");
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

  return (
    <>
      {/* основная модалка */}
      <div className="barberrecorda__overlay" onClick={closeModal}>
        <div
          className="barberrecorda__modal"
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
                {/* Клиент (без *) */}
                <label
                  className={`barberrecorda__field barberrecorda__field--full ${
                    fieldErrs.client ? "is-invalid" : ""
                  }`}
                >
                  <span className="barberrecorda__label">Клиент</span>
                  <div className="barberrecorda__fieldRow">
                    {/* ✅ только поиск/выбор, без создания через поиск */}
                    <RecordaServicesPicker
                      mode="single"
                      items={activeClientItems}
                      selectedId={selClient}
                      onChange={(id) => setSelClient(String(id))}
                      placeholder="Поиск клиента..."
                      placeholderSelected="Выберите клиента"
                      renderMeta={false}
                    />

                    {/* ✅ создание только через модалку */}
                    <button
                      type="button"
                      className="barberrecorda__btn barberrecorda__btn--primary barberrecorda__btn--square"
                      aria-label="Создать клиента"
                      title="Создать клиента"
                      onClick={openMini}
                    >
                      <FaPlus />
                    </button>
                  </div>
                </label>

                {/* Дата */}
                <label
                  className={`barberrecorda__field barberrecorda__field--full ${
                    fieldErrs.startDate ? "is-invalid" : ""
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

                {/* Услуги */}
                <label
                  className={`barberrecorda__field barberrecorda__field--full barberrecorda__field--services ${
                    fieldErrs.services ? "is-invalid" : ""
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
                </label>

                {/* Начало / Конец */}
                <div className="barberrecorda__row barberrecorda__row--2">
                  <label
                    className={`barberrecorda__field ${
                      fieldErrs.startTime ? "is-invalid" : ""
                    }`}
                  >
                    <span className="barberrecorda__label">
                      Начало <b className="barberrecorda__req">*</b>
                    </span>
                    <RecordaTimeField
                      value={startTime}
                      onChange={setStartStrict}
                      invalid={!!fieldErrs.startTime}
                    />
                  </label>

                  <label
                    className={`barberrecorda__field ${
                      fieldErrs.endTime ? "is-invalid" : ""
                    }`}
                  >
                    <span className="barberrecorda__label">
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
                  </label>
                </div>

                {/* Сотрудник */}
                <label
                  className={`barberrecorda__field barberrecorda__field--full ${
                    fieldErrs.barber ? "is-invalid" : ""
                  }`}
                >
                  <span className="barberrecorda__label">
                    Сотрудник <b className="barberrecorda__req">*</b>
                  </span>
                  <RecordaServicesPicker
                    mode="single"
                    items={barberItems}
                    selectedId={selBarber}
                    onChange={(id) => setSelBarber(String(id))}
                    placeholder="Поиск сотрудника..."
                    placeholderSelected="Выберите сотрудника"
                    renderMeta={false}
                  />
                  <div className="barberrecorda__availHint">
                    {selectedStartISO && selectedEndISO ? (
                      <>
                        Свободны:{" "}
                        <b>{barberItems.filter((i) => !i.disabled).length}</b> /{" "}
                        <b>{barberItems.length}</b>
                      </>
                    ) : (
                      "Выберите дату, услуги и время, чтобы увидеть доступность"
                    )}
                  </div>
                </label>

                {/* Статус */}
                <label className="barberrecorda__field">
                  <span className="barberrecorda__label">
                    Статус <b className="barberrecorda__req">*</b>
                  </span>
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

                {/* Скидка / Цена */}
                <div className="barberrecorda__row barberrecorda__row--2">
                  <label className="barberrecorda__field">
                    <span className="barberrecorda__label">Скидка, %</span>
                    <input
                      type="text"
                      className="barberrecorda__input"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
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
                      placeholder="Сумма по услугам"
                    />
                  </label>
                </div>

                {/* К ОПЛАТЕ */}
                <div className="barberrecorda__totalCard">
                  <div className="barberrecorda__totalLabel">К ОПЛАТЕ</div>
                  <div className="barberrecorda__totalValue">
                    {uiFinalPrice
                      ? `${uiFinalPrice.toLocaleString("ru-RU")} СОМ`
                      : "0 СОМ"}
                  </div>
                </div>

                {/* Комментарий */}
                <label className="barberrecorda__field barberrecorda__field--full">
                  <span className="barberrecorda__label">Комментарий</span>
                  <textarea
                    className="barberrecorda__textarea"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Добавьте заметку или особые пожелания…"
                  />
                </label>
              </div>
            </div>

            {/* Нижняя подсказка */}
            <div className="barberrecorda__bottomHint">
              <span className="barberrecorda__bottomHintIcon">⚠</span>
              <span>Выберите сотрудника и добавьте услуги</span>
            </div>

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
                className="barberrecorda__btn barberrecorda__btn--primary"
                disabled={
                  saving ||
                  (selectedStartISO &&
                    selectedEndISO &&
                    busyBarbersOnInterval.has(String(selBarber)))
                }
                title={
                  busyBarbersOnInterval.has(String(selBarber))
                    ? "Сотрудник занят в этот интервал"
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
