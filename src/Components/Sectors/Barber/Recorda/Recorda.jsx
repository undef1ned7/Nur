import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../../../api";
import "./Recorda.scss";
import { FaSearch, FaPlus, FaEdit, FaTimes, FaChevronDown, FaCalendarAlt } from "react-icons/fa";

/* ====== утилиты ====== */
const pad = (n) => String(n).padStart(2, "0");
const toDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d)) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const toTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d)) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const asArray = (d) => (Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : []);
const fmtMoney = (v) =>
  v === null || v === undefined || v === "" ? "—" : `${Number(v).toLocaleString("ru-RU")} сом`;

const TZ = "+06:00";
const makeISO = (date, time) => `${date}T${time}:00${TZ}`;
const ts = (iso) => new Date(iso).getTime();
const overlaps = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

const BLOCKING = new Set(["booked", "confirmed", "completed", "no_show"]);
const STATUS_LABELS = {
  booked: "Забронировано",
  confirmed: "Подтверждено",
  completed: "Завершено",
  canceled: "Отменено",
  no_show: "Не пришёл",
};

const LIST_PAGE = 10;
const PAGE_SIZE = 12;

/* ====== Компонент: Комбобокс ====== */
const ComboBox = ({
  items,
  value,
  onChange,
  placeholder = "Выберите",
  triggerClass = "",
  listMaxHeight = 260,
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    const base = items.filter((i) => !i.disabled);
    if (!text) return base;
    return base.filter((i) => (i.search || i.label).toLowerCase().includes(text));
  }, [items, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / LIST_PAGE));
  const pageSafe = Math.min(page, totalPages);
  const pageItems = filtered.slice((pageSafe - 1) * LIST_PAGE, pageSafe * LIST_PAGE);

  useEffect(() => {
    setPage(1);
  }, [q, items.length, open]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus?.(), 0);
  }, [open]);

  const selected = items.find((i) => String(i.id) === String(value));
  const placeholderText = placeholder;

  return (
    <div className={`barberrecorda__combo ${open ? "is-open" : ""}`} ref={wrapRef}>
      <button
        type="button"
        className={`barberrecorda__comboTrigger ${triggerClass}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selected?.label || placeholderText}
      >
        <span className={`barberrecorda__comboText ${selected ? "" : "is-placeholder"}`}>
          {selected?.label || placeholderText}
        </span>
        <FaChevronDown className="barberrecorda__comboCaret" />
      </button>

      {open && (
        <div className="barberrecorda__comboPopup" role="listbox" style={{ maxHeight: listMaxHeight }}>
          <div className="barberrecorda__comboSearch">
            <FaSearch className="barberrecorda__comboSearchIcon" />
            <input
              ref={inputRef}
              className="barberrecorda__comboSearchInput"
              placeholder={
                placeholderText.startsWith("Все ")
                  ? `Поиск ${placeholderText.slice(4).toLowerCase()}…`
                  : `Поиск ${placeholderText.toLowerCase()}…`
              }
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="barberrecorda__comboList">
            {pageItems.length === 0 ? (
              <div className="barberrecorda__comboEmpty">Ничего не найдено</div>
            ) : (
              pageItems.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className="barberrecorda__comboOption"
                  onClick={() => {
                    onChange?.(it.id, it);
                    setOpen(false);
                  }}
                >
                  {it.label}
                </button>
              ))
            )}
          </div>

          <div className="barberrecorda__comboPager">
            <button
              type="button"
              className="barberrecorda__pagerBtn"
              disabled={pageSafe === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Назад
            </button>
            <span className="barberrecorda__pagerInfo">Стр. {pageSafe}/{totalPages}</span>
            <button
              type="button"
              className="barberrecorda__pagerBtn"
              disabled={pageSafe === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Далее
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ====== основной компонент ====== */
const Recorda = () => {
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [fltClient, setFltClient] = useState(""); // id | ""
  const [fltBarber, setFltBarber] = useState(""); // id | ""
  const [fltDate, setFltDate] = useState("");     // YYYY-MM-DD | ""
  const [q, setQ] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [current, setCurrent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formAlerts, setFormAlerts] = useState([]);
  const [fieldErrs, setFieldErrs] = useState({});

  const [selClient, setSelClient] = useState("");
  const [selBarber, setSelBarber] = useState("");
  const [selService, setSelService] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [status, setStatus] = useState("booked");
  const [comment, setComment] = useState("");

  const [page, setPage] = useState(1);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setPageError("");
      const [cl, em, sv, ap] = await Promise.all([
        api.get("/barbershop/clients/"),
        api.get("/users/employees/"),
        api.get("/barbershop/services/"),
        api.get("/barbershop/appointments/"),
      ]);

      const cls = asArray(cl.data)
        .filter((c) => {
          const code = String(c.status || "").toLowerCase();
          return code === "active" || code === "vip" || code === "";
        })
        .map((c) => ({
          id: c.id,
          name: c.full_name || c.name || "",
          phone: c.phone || c.phone_number || "",
          status: c.status || "active",
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));

      const emps = asArray(em.data)
        .map((e) => {
          const first = e.first_name ?? "";
          const last = e.last_name ?? "";
          const name = ([last, first].filter(Boolean).join(" ").trim()) || e.email || "—";
          return { id: e.id, name };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));

      const svcs = asArray(sv.data)
        .filter((s) => s.is_active !== false)
        .map((s) => ({
          id: s.id,
          name: s.service_name || s.name || "",
          price: s.price ?? null,
          active: s.is_active !== false,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));

      setClients(cls);
      setBarbers(emps);
      setServices(svcs);
      setAppointments(asArray(ap.data));
    } catch (e) {
      setPageError(e?.response?.data?.detail || "Не удалось загрузить данные.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const priceOf = (r) => {
    const inRow = r.service_price ?? r.price ?? null;
    if (inRow != null) return inRow;
    const svc = services.find((s) => String(s.id) === String(r.service));
    return svc?.price ?? null;
  };

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return appointments.filter((r) => {
      const passClient = fltClient ? String(r.client) === String(fltClient) : true;
      const passBarber = fltBarber ? String(r.barber) === String(fltBarber) : true;
      const passDate =
        !fltDate ||
        toDate(r.start_at) === fltDate ||
        toDate(r.end_at) === fltDate;

      if (!(passClient && passBarber && passDate)) return false;
      if (!text) return true;

      const clientName =
        (r.client_name ||
          clients.find((c) => String(c.id) === String(r.client))?.name ||
          "").toLowerCase();
      const barberName =
        (r.barber_name ||
          barbers.find((b) => String(b.id) === String(r.barber))?.name ||
          "").toLowerCase();
      const serviceName =
        (r.service_name ||
          services.find((s) => String(s.id) === String(r.service))?.name ||
          "").toLowerCase();
      const st = (STATUS_LABELS[r.status] || r.status || "").toLowerCase();

      return (
        clientName.includes(text) ||
        barberName.includes(text) ||
        serviceName.includes(text) ||
        st.includes(text)
      );
    });
  }, [appointments, q, fltClient, fltBarber, fltDate, clients, barbers, services]);

  const sumFiltered = useMemo(
    () => filtered.reduce((acc, r) => acc + (Number(priceOf(r)) || 0), 0),
    [filtered]
  );

  useEffect(() => {
    setPage(1);
  }, [filtered.length, q, fltClient, fltBarber, fltDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const rows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const Pager = () =>
    filtered.length <= PAGE_SIZE ? null : (
      <nav className="barberrecorda__pager" aria-label="Пагинация">
        <button
          className="barberrecorda__pageBtn"
          disabled={pageSafe === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Назад
        </button>
        <ul className="barberrecorda__pageList">
          {(() => {
            const set = new Set([1, pageSafe - 1, pageSafe, pageSafe + 1, totalPages]);
            const list = [...set].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
            return list.map((n, i) => {
              const prev = list[i - 1];
              const gap = prev && n - prev > 1;
              return (
                <React.Fragment key={n}>
                  {gap && <li className="barberrecorda__dots">…</li>}
                  <li>
                    <button
                      className={`barberrecorda__pageBtn ${n === pageSafe ? "is-active" : ""}`}
                      onClick={() => setPage(n)}
                      aria-current={n === pageSafe ? "page" : undefined}
                    >
                      {n}
                    </button>
                  </li>
                </React.Fragment>
              );
            });
          })()}
        </ul>
        <button
          className="barberrecorda__pageBtn"
          disabled={pageSafe === totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          Далее
        </button>
      </nav>
    );

  /* -------- модалка -------- */
  const openModal = (rec = null) => {
    setCurrent(rec);
    setFormAlerts([]);
    setFieldErrs({});
    if (rec) {
      setSelClient(String(rec.client || ""));
      setSelBarber(String(rec.barber || ""));
      setSelService(String(rec.service || ""));
      const d = toDate(rec.start_at);
      setStartDate(d);
      setStartTime(toTime(rec.start_at));
      setEndTime(toTime(rec.end_at));
      setStatus(rec.status || "booked");
      setComment(rec.comment || "");
    } else {
      setSelClient("");
      setSelBarber("");
      setSelService("");
      const now = new Date();
      setStartDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
      setStartTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
      setEndTime("");
      setStatus("booked");
      setComment("");
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    if (!saving) setModalOpen(false);
  };

  const activeClientItems = useMemo(
    () =>
      clients.map((c) => ({
        id: String(c.id),
        label: c.name || "Без имени",
        search: `${c.name} ${c.phone}`,
      })),
    [clients]
  );

  const barberItems = useMemo(
    () => barbers.map((b) => ({ id: String(b.id), label: b.name, search: b.name })),
    [barbers]
  );

  const serviceItems = useMemo(
    () =>
      services
        .filter((s) => s.active)
        .map((s) => ({
          id: String(s.id),
          label: s.price ? `${s.name} — ${fmtMoney(s.price)}` : s.name,
          search: s.name,
        })),
    [services]
  );

  const filterClientItems = activeClientItems;
  const filterBarberItems = barberItems;

  const validate = () => {
    const alerts = [];
    const errs = {};

    if (!selClient) {
      errs.client = true;
      alerts.push("Выберите клиента.");
    }
    if (!selBarber) {
      errs.barber = true;
      alerts.push("Выберите мастера.");
    }
    if (!selService) {
      errs.service = true;
      alerts.push("Выберите услугу.");
    }
    if (!startDate) {
      errs.startDate = true;
      alerts.push("Укажите дату начала.");
    }
    if (!startTime) {
      errs.startTime = true;
      alerts.push("Укажите время начала.");
    }
    if (!endTime) {
      errs.endTime = true;
      alerts.push("Укажите время окончания.");
    }

    if (alerts.length) return { alerts, errs };

    const startISO = makeISO(startDate, startTime);
    const endISO = makeISO(startDate, endTime);
    const t1 = ts(startISO);
    const t2 = ts(endISO);

    if (!(t2 > t1)) {
      errs.endTime = true;
      alerts.push("Время окончания должно быть позже времени начала (в тот же день).");
      return { alerts, errs };
    }

    const conflictsMaster = appointments.filter((a) => {
      if (String(a.barber) !== String(selBarber)) return false;
      if (!BLOCKING.has(a.status)) return false;
      if (current?.id && String(current.id) === String(a.id)) return false;
      return overlaps(t1, t2, ts(a.start_at), ts(a.end_at));
    });

    if (conflictsMaster.length) {
      errs.startTime = errs.endTime = true;
      alerts.push("Мастер уже занят в выбранный интервал. Выберите другое время.");
    }

    const conflictsClient = appointments.filter((a) => {
      if (String(a.client) !== String(selClient)) return false;
      if (!BLOCKING.has(a.status)) return false;
      if (current?.id && String(current.id) === String(a.id)) return false;
      return overlaps(t1, t2, ts(a.start_at), ts(a.end_at));
    });

    if (conflictsClient.length) {
      errs.startTime = errs.endTime = true;
      alerts.push("У клиента уже есть запись в этот интервал. Выберите другое время.");
    }

    return { alerts, errs, startISO, endISO };
  };

  const submit = async (e) => {
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

    try {
      const payload = {
        client: selClient,
        barber: selBarber,
        service: selService,
        start_at: startISO,
        end_at: endISO,
        status,
        comment: comment?.trim() || null,
        company: localStorage.getItem("company"),
      };

      if (current?.id) {
        await api.patch(`/barbershop/appointments/${current.id}/`, payload);
      } else {
        await api.post("/barbershop/appointments/", payload);
      }
      await fetchAll();
      closeModal();
    } catch (e2) {
      const d = e2?.response?.data;
      const msgs = [];
      if (typeof d === "string") msgs.push(d);
      else if (d && typeof d === "object") {
        Object.values(d).forEach((v) => msgs.push(String(Array.isArray(v) ? v[0] : v)));
      }
      if (!msgs.length) msgs.push("Не удалось сохранить запись.");
      setFormAlerts(msgs);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="barberrecorda">
      <div className="barberrecorda__header">
        <div className="barberrecorda__titleWrap">
          <h2 className="barberrecorda__title">Записи</h2>
          <span className="barberrecorda__subtitle">
            {loading ? "Загрузка…" : `${filtered.length} шт · сумма ${fmtMoney(sumFiltered)}`}
          </span>
        </div>

        <div className="barberrecorda__filters">
          <ComboBox
            items={filterClientItems}
            value={fltClient}
            onChange={(id) => setFltClient(String(id))}
            placeholder="Все клиенты"
          />
          <ComboBox
            items={filterBarberItems}
            value={fltBarber}
            onChange={(id) => setFltBarber(String(id))}
            placeholder="Все мастера"
          />
          <div className="barberrecorda__dateFilter">
            <FaCalendarAlt className="barberrecorda__dateIcon" />
            <input
              className="barberrecorda__dateInput"
              type="date"
              value={fltDate}
              onChange={(e) => setFltDate(e.target.value)}
              aria-label="Фильтр по дате"
            />
          </div>

          <div className="barberrecorda__search">
            <FaSearch className="barberrecorda__searchIcon" />
            <input
              className="barberrecorda__searchInput"
              placeholder="Поиск: клиент, мастер, услуга, статус"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Поиск по записям"
            />
          </div>

          <button
            className="barberrecorda__btn barberrecorda__btn--primary"
            onClick={() => openModal(null)}
            aria-label="Добавить запись"
            title="Добавить"
          >
            <FaPlus />
          </button>
        </div>
      </div>

      {pageError && <div className="barberrecorda__alert">{pageError}</div>}

      <div className="barberrecorda__tableWrap">
        <table className="barberrecorda__table">
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Мастер</th>
              <th>Услуга</th>
              <th>Цена</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td className="barberrecorda__empty" colSpan={6}>Ничего не найдено</td>
              </tr>
            )}
            {loading && (
              <tr>
                <td className="barberrecorda__empty" colSpan={6}>Загрузка…</td>
              </tr>
            )}

            {!loading &&
              rows.map((r) => {
                const client =
                  r.client_name ||
                  clients.find((c) => String(c.id) === String(r.client))?.name ||
                  "—";
                const barber =
                  r.barber_name ||
                  barbers.find((b) => String(b.id) === String(r.barber))?.name ||
                  "—";
                const service =
                  r.service_name ||
                  services.find((s) => String(s.id) === String(r.service))?.name ||
                  "—";
                const price = priceOf(r);
                return (
                  <tr key={r.id}>
                    <td>{client}</td>
                    <td>{barber}</td>
                    <td>{service}</td>
                    <td>{fmtMoney(price)}</td>
                    <td>
                      <span className={`barberrecorda__badge barberrecorda__badge--${r.status}`}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>
                    <td className="barberrecorda__actionsCell">
                      <button
                        className="barberrecorda__btn barberrecorda__btn--secondary"
                        onClick={() => openModal(r)}
                        aria-label="Редактировать запись"
                      >
                        <FaEdit /> Ред.
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <Pager />

      {modalOpen && (
        <div className="barberrecorda__overlay" onClick={closeModal}>
          <div className="barberrecorda__modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="barberrecorda__modalHeader">
              <h3 className="barberrecorda__modalTitle">
                {current ? "Редактировать запись" : "Новая запись"}
              </h3>
              <button className="barberrecorda__iconBtn" aria-label="Закрыть" onClick={closeModal}>
                <FaTimes />
              </button>
            </div>

            {formAlerts.length > 0 && (
              <div className="barberrecorda__alert barberrecorda__alert--inModal">
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

            <form className="barberrecorda__form" onSubmit={submit} noValidate>
              <div className="barberrecorda__grid">
                <label className={`barberrecorda__field ${fieldErrs.client ? "is-invalid" : ""}`}>
                  <span className="barberrecorda__label">Клиент <b className="barberrecorda__req">*</b></span>
                  <ComboBox
                    items={activeClientItems}
                    value={selClient}
                    onChange={(id) => setSelClient(String(id))}
                    placeholder="Выберите клиента"
                  />
                </label>

                <label className={`barberrecorda__field ${fieldErrs.barber ? "is-invalid" : ""}`}>
                  <span className="barberrecorda__label">Мастер <b className="barberrecorda__req">*</b></span>
                  <ComboBox
                    items={barberItems}
                    value={selBarber}
                    onChange={(id) => setSelBarber(String(id))}
                    placeholder="Выберите мастера"
                  />
                </label>

                <label className={`barberrecorda__field ${fieldErrs.service ? "is-invalid" : ""}`}>
                  <span className="barberrecorda__label">Услуга <b className="barberrecorda__req">*</b></span>
                  <ComboBox
                    items={serviceItems}
                    value={selService}
                    onChange={(id) => setSelService(String(id))}
                    placeholder="Выберите услугу"
                  />
                </label>

                <label className={`barberrecorda__field ${fieldErrs.startDate ? "is-invalid" : ""}`}>
                  <span className="barberrecorda__label">Начало — дата <b className="barberrecorda__req">*</b></span>
                  <input
                    type="date"
                    className="barberrecorda__input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </label>

                <label className={`barberrecorda__field ${fieldErrs.startTime ? "is-invalid" : ""}`}>
                  <span className="barberrecorda__label">Начало — время <b className="barberrecorda__req">*</b></span>
                  <input
                    type="time"
                    className="barberrecorda__input"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </label>

                <label className={`barberrecorda__field ${fieldErrs.endTime ? "is-invalid" : ""}`}>
                  <span className="barberrecorda__label">Конец — время <b className="barberrecorda__req">*</b></span>
                  <input
                    type="time"
                    className="barberrecorda__input"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </label>

                <label className="barberrecorda__field">
                  <span className="barberrecorda__label">Статус <b className="barberrecorda__req">*</b></span>
                  <select
                    className="barberrecorda__input"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    required
                  >
                    <option value="booked">{STATUS_LABELS.booked}</option>
                    <option value="confirmed">{STATUS_LABELS.confirmed}</option>
                    <option value="completed">{STATUS_LABELS.completed}</option>
                    <option value="canceled">{STATUS_LABELS.canceled}</option>
                    <option value="no_show">{STATUS_LABELS.no_show}</option>
                  </select>
                </label>

                <label className="barberrecorda__field barberrecorda__field--full">
                  <span className="barberrecorda__label">Комментарий</span>
                  <textarea
                    className="barberrecorda__textarea"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Заметка для мастера/клиента"
                  />
                </label>
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
                  disabled={saving}
                >
                  {saving ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Recorda;
